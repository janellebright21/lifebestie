import { useState, useEffect, useRef } from 'react';
import { CreditCard, CheckCircle2, Loader2, AlertCircle, Calendar, Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { SubscriptionState } from '../hooks/useSubscription';

interface MembershipSectionProps {
  subscription: SubscriptionState;
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

function formatPrice(priceInfo: { amount: number; currency: string; interval: string } | null): string {
  if (!priceInfo) return '';
  const dollars = (priceInfo.amount / 100).toFixed(2);
  const currencySymbol: Record<string, string> = { usd: '$', eur: '€', gbp: '£' };
  const symbol = currencySymbol[priceInfo.currency] ?? priceInfo.currency.toUpperCase() + ' ';
  return `${symbol}${dollars}/${priceInfo.interval}`;
}

export default function MembershipSection({ subscription }: MembershipSectionProps) {
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [portalLoading, setPortalLoading]     = useState(false);
  const [actionError, setActionError]         = useState<string | null>(null);
  const [pendingCheckout, setPendingCheckout] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const subscriptionRef = useRef(subscription);
  subscriptionRef.current = subscription;

  // Check for checkout redirect result on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'success') {
      setPendingCheckout(true);
      window.history.replaceState({}, '', window.location.pathname);

      // Poll for webhook confirmation using a ref to avoid stale closure
      pollRef.current = setInterval(async () => {
        await subscriptionRef.current.refresh();
        const s = subscriptionRef.current;
        if (!s.loading && s.hasAccess && s.status !== 'none') {
          setPendingCheckout(false);
          if (pollRef.current) clearInterval(pollRef.current);
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
        }
      }, 3000);

      // Timeout: keep pending state with retry option (don't imply success)
      timeoutRef.current = setTimeout(() => {
        if (pollRef.current) clearInterval(pollRef.current);
        // Keep pendingCheckout true — user sees a retry button instead of implied success
      }, 30000);

      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
    }
    if (params.get('checkout') === 'cancelled') {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  async function handleStartTrial() {
    setCheckoutLoading(true);
    setActionError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('stripe-checkout');
      if (fnError) {
        setActionError('Could not connect to checkout. Please try again.');
        return;
      }
      const payload = data as Record<string, unknown>;
      if (payload.error) {
        const code = String(payload.error);
        if (code === 'STRIPE_NOT_CONFIGURED') {
          setActionError('Payments are not yet configured. Please check back soon.');
        } else if (code === 'ALREADY_SUBSCRIBED') {
          setActionError('You already have an active subscription.');
        } else if (code === 'CHECKOUT_BUSY') {
          setActionError('A checkout is already in progress. Please wait a moment.');
        } else {
          setActionError(String(payload.message ?? 'Checkout failed.'));
        }
        return;
      }
      if (payload.url) {
        window.location.href = payload.url as string;
      }
    } catch {
      setActionError('Could not start checkout. Please try again.');
    } finally {
      setCheckoutLoading(false);
    }
  }

  async function handleManageBilling() {
    setPortalLoading(true);
    setActionError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('stripe-portal');
      if (fnError) {
        setActionError('Could not open billing portal.');
        return;
      }
      const payload = data as Record<string, unknown>;
      if (payload.error) {
        setActionError(String(payload.message ?? 'Could not open billing portal.'));
        return;
      }
      if (payload.url) {
        window.location.href = payload.url as string;
      }
    } catch {
      setActionError('Could not open billing portal.');
    } finally {
      setPortalLoading(false);
    }
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (subscription.loading) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-3">
          <CreditCard size={14} className="text-gray-400" />
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-0">Membership</h2>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-6 flex items-center justify-center gap-2">
          <Loader2 size={16} className="animate-spin text-gray-300" />
          <p className="text-sm text-gray-400">Checking membership…</p>
        </div>
      </div>
    );
  }

  // ── Stripe not configured ──────────────────────────────────────────────────
  if (subscription.notConfigured) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-3">
          <CreditCard size={14} className="text-gray-400" />
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-0">Membership</h2>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-4">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-gray-700">Payments coming soon</p>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                Subscriptions are being set up. You can continue using BestieLife in the meantime.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Pending checkout confirmation (with retry on timeout) ──────────────────
  if (pendingCheckout) {
    const stillPending = subscription.status === 'none' || !subscription.hasAccess;
    return (
      <div>
        <div className="flex items-center gap-2 mb-3">
          <CreditCard size={14} className="text-gray-400" />
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-0">Membership</h2>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-6 flex flex-col items-center gap-3">
          {stillPending ? (
            <>
              <Loader2 size={20} className="animate-spin text-gray-400" />
              <p className="text-sm font-semibold text-gray-600">Confirming your subscription…</p>
              <p className="text-xs text-gray-400 text-center leading-relaxed">
                We're verifying your payment with Stripe. This usually takes a few seconds.
              </p>
              <button
                onClick={() => subscription.refresh()}
                className="mt-1 text-xs font-semibold text-gray-500 underline"
              >
                Refresh status
              </button>
            </>
          ) : (
            <>
              <CheckCircle2 size={20} className="text-emerald-500" />
              <p className="text-sm font-semibold text-gray-600">Subscription confirmed!</p>
            </>
          )}
        </div>
      </div>
    );
  }

  const hasActiveSub = subscription.status === 'active' || subscription.status === 'trialing' || subscription.status === 'past_due';
  const isCanceledWithAccess = subscription.status === 'canceled' && subscription.cancelAtPeriodEnd && subscription.hasAccess;
  const isCanceledExpired = subscription.status === 'canceled' && !subscription.hasAccess;
  const isExpired = !subscription.hasAccess && !hasActiveSub && subscription.status !== 'none';
  const hasStripeCustomer = Boolean(subscription.status !== 'none' || subscription.currentPeriodEnd);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <CreditCard size={14} className="text-gray-400" />
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-0">Membership</h2>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-4 space-y-4">
        {/* Status badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {subscription.hasAccess ? (
              <CheckCircle2 size={18} className="text-emerald-500" />
            ) : (
              <AlertCircle size={18} className="text-gray-300" />
            )}
            <span className={`text-sm font-semibold ${subscription.hasAccess ? 'text-gray-800' : 'text-gray-400'}`}>
              {subscription.status === 'trialing' && 'Free Trial Active'}
              {subscription.status === 'active' && 'Subscribed'}
              {subscription.status === 'past_due' && 'Payment Retry'}
              {isCanceledWithAccess && 'Canceled (access until period end)'}
              {isCanceledExpired && 'Subscription Ended'}
              {isExpired && 'No Active Plan'}
              {subscription.status === 'none' && 'Free Trial Available'}
              {subscription.devAccess && subscription.status === 'none' && ' (Development Access)'}
            </span>
          </div>
        </div>

        {/* Price display */}
        {subscription.priceInfo && (
          <div className="text-xs text-gray-500 leading-relaxed">
            <span className="font-semibold text-gray-700">{formatPrice(subscription.priceInfo)}</span>
            {subscription.trialEligible && subscription.trialDays > 0 && (
              <span> after a {subscription.trialDays}-day free trial</span>
            )}
          </div>
        )}

        {/* Trial info */}
        {subscription.status === 'trialing' && subscription.trialEnd && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Calendar size={12} className="text-gray-400" />
            <span>Trial ends {formatDate(subscription.trialEnd)}</span>
          </div>
        )}

        {/* Billing date */}
        {(hasActiveSub || isCanceledWithAccess) && subscription.currentPeriodEnd && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Calendar size={12} className="text-gray-400" />
            <span>
              {isCanceledWithAccess ? 'Access until' : 'Next billing date'}: {formatDate(subscription.currentPeriodEnd)}
            </span>
          </div>
        )}

        {/* Cancellation note */}
        {isCanceledWithAccess && (
          <p className="text-[11px] text-gray-400 leading-relaxed">
            You'll keep access until your current billing period ends. No further charges will be made.
          </p>
        )}

        {/* Expired / no access */}
        {(isExpired || isCanceledExpired) && (
          <p className="text-xs text-gray-500 leading-relaxed">
            Your subscription has ended. Resubscribe to regain access to Emma chat and AI features.
            Your saved data is safe and ready when you return.
          </p>
        )}

        {/* Action buttons */}
        <div className="space-y-2 pt-1">
          {/* Start trial (eligible) */}
          {subscription.status === 'none' && subscription.trialEligible && (
            <button
              onClick={handleStartTrial}
              disabled={checkoutLoading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-white text-sm font-semibold active:scale-[0.98] transition-all disabled:opacity-50 theme-bg-primary"
            >
              {checkoutLoading ? (
                <><Loader2 size={14} className="animate-spin" /> Starting trial…</>
              ) : (
                <><Sparkles size={14} /> Start {subscription.trialDays}-Day Free Trial</>
              )}
            </button>
          )}

          {/* Subscribe without trial (returning customer or trial used) */}
          {(subscription.status === 'none' || isExpired || isCanceledExpired) && !subscription.trialEligible && (
            <button
              onClick={handleStartTrial}
              disabled={checkoutLoading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-white text-sm font-semibold active:scale-[0.98] transition-all disabled:opacity-50 theme-bg-primary"
            >
              {checkoutLoading ? (
                <><Loader2 size={14} className="animate-spin" /> Processing…</>
              ) : (
                <><CreditCard size={14} /> Subscribe Now</>
              )}
            </button>
          )}

          {/* Resubscribe (expired/canceled) with trial eligible */}
          {(isExpired || isCanceledExpired) && subscription.trialEligible && (
            <button
              onClick={handleStartTrial}
              disabled={checkoutLoading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-white text-sm font-semibold active:scale-[0.98] transition-all disabled:opacity-50 theme-bg-primary"
            >
              {checkoutLoading ? (
                <><Loader2 size={14} className="animate-spin" /> Starting trial…</>
              ) : (
                <><Sparkles size={14} /> Start {subscription.trialDays}-Day Free Trial</>
              )}
            </button>
          )}

          {/* Manage billing — available for any existing Stripe customer, even after expiration */}
          {hasStripeCustomer && (
            <button
              onClick={handleManageBilling}
              disabled={portalLoading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-gray-200 bg-white text-sm font-semibold text-gray-600 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {portalLoading ? (
                <><Loader2 size={14} className="animate-spin" /> Opening…</>
              ) : (
                <><CreditCard size={14} /> Manage Billing</>
              )}
            </button>
          )}
        </div>

        {/* Trial terms — show actual price, trial length, charge date, and cancellation terms */}
        {subscription.trialEligible && subscription.status === 'none' && (
          <div className="text-[11px] text-gray-400 leading-relaxed space-y-1">
            <p>
              Start your {subscription.trialDays}-day free trial.
              {subscription.priceInfo
                ? ` You'll be charged ${formatPrice(subscription.priceInfo)} after your trial ends.`
                : ' You\'ll be charged the monthly subscription fee after your trial ends.'
              }
            </p>
            <p>Cancel anytime before your trial ends to avoid being charged.</p>
          </div>
        )}

        {/* Error messages */}
        {actionError && (
          <div className="flex items-start gap-2 bg-red-50 rounded-xl px-3 py-2.5">
            <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-600 leading-relaxed">{actionError}</p>
          </div>
        )}

        {subscription.error && (
          <div className="flex items-start gap-2 bg-red-50 rounded-xl px-3 py-2.5">
            <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-red-600 leading-relaxed">{subscription.error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
