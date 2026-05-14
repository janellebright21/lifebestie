import { useState, useCallback } from 'react';
import { supabase, Receipt, ReceiptItem, GroceryCategory } from '../lib/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export interface ScanResult {
  store_name?: string;
  date?: string;
  total?: number;
  items: ReceiptItem[];
}

export function useReceipts() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from('receipts')
      .select('*')
      .eq('user_id', user.id)
      .order('date', { ascending: false })
      .limit(20);
    if (data) setReceipts(data as Receipt[]);
  }, []);

  async function scanImage(file: File): Promise<ScanResult | null> {
    setScanning(true);
    setScanError(null);
    try {
      const base64 = await fileToBase64(file);
      const mimeType = file.type || 'image/jpeg';

      const res = await fetch(`${SUPABASE_URL}/functions/v1/scan-receipt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      });

      if (!res.ok) {
        setScanError('Could not read the receipt. Please try again.');
        return null;
      }

      const data: ScanResult = await res.json();
      return data;
    } catch {
      setScanError('Something went wrong scanning the receipt.');
      return null;
    } finally {
      setScanning(false);
    }
  }

  async function saveReceipt(
    result: ScanResult,
    items: ReceiptItem[]
  ): Promise<Receipt | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const payload = {
      user_id: user.id,
      date: result.date ?? new Date().toISOString().split('T')[0],
      store_name: result.store_name ?? null,
      total: result.total ?? null,
      items,
    };

    const { data } = await supabase
      .from('receipts')
      .insert(payload)
      .select('*')
      .maybeSingle();

    if (data) {
      setReceipts((prev) => [data as Receipt, ...prev]);
      return data as Receipt;
    }
    return null;
  }

  function getPriceMemory(): Map<string, { price: number; category: GroceryCategory }> {
    const map = new Map<string, { price: number; category: GroceryCategory }>();
    const sorted = [...receipts].reverse();
    for (const receipt of sorted) {
      for (const item of receipt.items) {
        if (item.confirmed && item.price > 0) {
          map.set(item.name.toLowerCase(), { price: item.price, category: item.category });
        }
      }
    }
    return map;
  }

  return { receipts, scanning, scanError, load, scanImage, saveReceipt, getPriceMemory };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
