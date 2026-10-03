import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export type SubscriptionStatus =
  | 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid' | 'expired' | 'incomplete'
  | 'none';

export interface PriceInfo {
  amount: number;       // cents
  currency: string;     // e.g. "usd"
  interval: string;     // e.g. "month"
}

export interface SubscriptionState {
  hasAccess: boolean;
  trialEligible: boolean;
  status: SubscriptionStatus;
  trialEnd: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  loading: boolean;
  error: string | null;
  notConfigured: boolean;
  devAccess: boolean;
  priceInfo: PriceInfo | null;
  trialDays: number;
  aiUsageToday: Array<{ function_name: string; call_count: number }>;
  refresh: () => Promise<void>;
}

export function useSubscription(): SubscriptionState {
  const [hasAccess, setHasAccess]         = useState(false);
  const [trialEligible, setTrialEligible] = useState(true);
  const [status, setStatus]               = useState<SubscriptionStatus>('none');
  const [trialEnd, setTrialEnd]           = useState<string | null>(null);
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const [devAccess, setDevAccess]         = useState(false);
  const [priceInfo, setPriceInfo]         = useState<PriceInfo | null>(null);
  const [trialDays, setTrialDays]         = useState(7);
  const [aiUsageToday, setAiUsageToday]   = useState<Array<{ function_name: string; call_count: number }>>([]);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const { data, error: fnError } = await supabase.functions.invoke('check-subscription');

      if (fnError) {
        setError('Could not check membership status.');
        setNotConfigured(false);
        return;
      }

      const payload = data as Record<string, unknown>;

      if (payload.notConfigured === true) {
        setNotConfigured(true);
        setHasAccess(true);
        setTrialEligible(true);
        setStatus('none');
        setDevAccess(false);
        setPriceInfo(null);
        setLoading(false);
        return;
      }

      setNotConfigured(false);
      setHasAccess(Boolean(payload.hasAccess));
      setTrialEligible(Boolean(payload.trialEligible));
      setDevAccess(Boolean(payload.devAccess));

      const sub = payload.subscription as Record<string, unknown> | null;
      if (sub && typeof sub === 'object' && !Array.isArray(sub) && Object.keys(sub).length > 0) {
        setStatus((sub.status as SubscriptionStatus) ?? 'none');
        setTrialEnd(sub.trial_end as string | null);
        setCurrentPeriodEnd(sub.current_period_end as string | null);
        setCancelAtPeriodEnd(Boolean(sub.cancel_at_period_end));
      } else {
        setStatus('none');
        setTrialEnd(null);
        setCurrentPeriodEnd(null);
        setCancelAtPeriodEnd(false);
      }

      const usage = payload.aiUsageToday as Array<{ function_name: string; call_count: number }> | null;
      setAiUsageToday(usage ?? []);

      const price = payload.priceInfo as PriceInfo | null;
      setPriceInfo(price ?? null);

      if (typeof payload.trialDays === 'number') setTrialDays(payload.trialDays);
    } catch {
      setError('Could not check membership status.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    hasAccess,
    trialEligible,
    status,
    trialEnd,
    currentPeriodEnd,
    cancelAtPeriodEnd,
    loading,
    error,
    notConfigured,
    devAccess,
    priceInfo,
    trialDays,
    aiUsageToday,
    refresh,
  };
}
