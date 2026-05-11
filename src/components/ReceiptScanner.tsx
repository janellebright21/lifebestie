import { useState, useRef, useCallback } from 'react';
import { Camera, Upload, X, Check, CreditCard as Edit3, Save, RotateCcw, Receipt } from 'lucide-react';
import { ReceiptItem, GroceryCategory, GROCERY_CATEGORIES, getCategoryColors } from '../lib/supabase';
import { ScanResult } from '../hooks/useReceipts';

type Step = 'upload' | 'scanning' | 'review' | 'saving' | 'done';

interface Props {
  onClose: () => void;
  onScan: (file: File) => Promise<ScanResult | null>;
  onSave: (result: ScanResult, items: ReceiptItem[]) => Promise<void>;
  scanning: boolean;
  scanError: string | null;
}

export default function ReceiptScanner({ onClose, onScan, onSave, scanError }: Props) {
  const [step, setStep] = useState<Step>('upload');
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<ReceiptItem | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    setStep('scanning');

    const data = await onScan(file);
    if (!data) {
      setStep('upload');
      return;
    }
    setResult(data);
    setItems(data.items.map((i) => ({ ...i, confirmed: true })));
    setStep('review');
  }, [onScan]);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function toggleConfirm(idx: number) {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, confirmed: !item.confirmed } : item));
  }

  function startEdit(idx: number) {
    setEditingIdx(idx);
    setEditDraft({ ...items[idx] });
  }

  function commitEdit() {
    if (editingIdx === null || !editDraft) return;
    setItems((prev) => prev.map((item, i) => i === editingIdx ? editDraft : item));
    setEditingIdx(null);
    setEditDraft(null);
  }

  function cancelEdit() {
    setEditingIdx(null);
    setEditDraft(null);
  }

  async function handleSave() {
    if (!result) return;
    const confirmed = items.filter((i) => i.confirmed);
    if (confirmed.length === 0) return;
    setSaving(true);
    await onSave(result, confirmed);
    setSaving(false);
    setStep('done');
  }

  const confirmedCount = items.filter((i) => i.confirmed).length;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
      {/* Backdrop tap to close */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative bg-white rounded-t-3xl shadow-2xl max-h-[92dvh] flex flex-col">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 shrink-0 border-b border-gray-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
              <Receipt size={16} className="text-amber-500" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-800">Scan Receipt</h2>
              {step === 'review' && result?.store_name && (
                <p className="text-xs text-gray-400">{result.store_name}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
            <X size={13} className="text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Upload step ── */}
          {step === 'upload' && (
            <div className="px-5 py-6 space-y-4">
              <p className="text-sm text-gray-500 leading-relaxed">
                Upload a photo of your grocery receipt and I'll pull out all the items and prices for you.
              </p>

              {scanError && (
                <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-600">
                  {scanError}
                </div>
              )}

              {/* Drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-amber-200 rounded-2xl p-8 flex flex-col items-center gap-3 cursor-pointer hover:border-amber-300 hover:bg-amber-50/50 transition-all active:scale-[0.99]"
              >
                <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center">
                  <Upload size={22} className="text-amber-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-700">Tap to upload a photo</p>
                  <p className="text-xs text-gray-400 mt-0.5">or drag and drop here</p>
                </div>
                <p className="text-xs text-gray-300">JPG, PNG, HEIC supported</p>
              </div>

              {/* Camera shortcut on mobile */}
              <button
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = 'image/*';
                    fileInputRef.current.capture = 'environment';
                    fileInputRef.current.click();
                  }
                }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-100 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
              >
                <Camera size={16} className="text-gray-400" />
                Take a photo
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                  e.target.value = '';
                }}
              />
            </div>
          )}

          {/* ── Scanning step ── */}
          {step === 'scanning' && (
            <div className="px-5 py-10 flex flex-col items-center gap-5">
              {preview && (
                <img src={preview} alt="Receipt" className="w-32 h-40 object-cover rounded-xl shadow-sm opacity-60" />
              )}
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-3 border-amber-300 border-t-amber-500 rounded-full animate-spin" style={{ borderWidth: 3 }} />
                <div className="text-center">
                  <p className="text-sm font-semibold text-gray-700">Reading your receipt…</p>
                  <p className="text-xs text-gray-400 mt-1">This only takes a moment</p>
                </div>
              </div>
            </div>
          )}

          {/* ── Review step ── */}
          {step === 'review' && (
            <div className="px-5 py-4 space-y-4">
              {/* Friendly message */}
              <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                <p className="text-sm text-amber-800 leading-relaxed">
                  I found <span className="font-bold">{items.length} item{items.length !== 1 ? 's' : ''}</span> on your receipt! Check the ones you want to save — I'll remember these prices for next time.
                </p>
              </div>

              {/* Receipt meta */}
              {(result?.store_name || result?.total) && (
                <div className="flex items-center justify-between text-xs text-gray-400 px-1">
                  {result.store_name && <span className="font-medium text-gray-500">{result.store_name}</span>}
                  {result.total && <span>Total: <span className="font-semibold text-gray-600">${result.total.toFixed(2)}</span></span>}
                </div>
              )}

              {/* Select all / deselect */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">{confirmedCount} of {items.length} selected</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setItems((p) => p.map((i) => ({ ...i, confirmed: true })))}
                    className="text-xs font-medium text-amber-600 hover:text-amber-700 transition-colors"
                  >
                    Select all
                  </button>
                  <span className="text-gray-200">·</span>
                  <button
                    onClick={() => setItems((p) => p.map((i) => ({ ...i, confirmed: false })))}
                    className="text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Deselect all
                  </button>
                </div>
              </div>

              {/* Items list */}
              <div className="space-y-2 pb-2">
                {items.map((item, idx) => {
                  const colors = getCategoryColors(item.category);
                  const isEditing = editingIdx === idx;
                  return (
                    <div
                      key={idx}
                      className={`rounded-xl border transition-all duration-150 ${
                        item.confirmed ? 'bg-white border-gray-100 shadow-sm' : 'bg-gray-50 border-gray-100 opacity-50'
                      }`}
                    >
                      {isEditing && editDraft ? (
                        /* Edit mode */
                        <div className="px-3 py-3 space-y-3">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={editDraft.name}
                              onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                              className="flex-1 text-sm font-medium bg-gray-50 rounded-lg px-3 py-2 outline-none border border-gray-200 focus:border-amber-300"
                              placeholder="Item name"
                            />
                            <div className="flex items-center gap-1 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200 focus-within:border-amber-300">
                              <span className="text-xs text-gray-400">$</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={editDraft.price}
                                onChange={(e) => setEditDraft({ ...editDraft, price: parseFloat(e.target.value) || 0 })}
                                className="w-14 text-sm font-semibold text-right bg-transparent outline-none"
                              />
                            </div>
                          </div>
                          {/* Category picker */}
                          <div className="flex flex-wrap gap-1.5">
                            {GROCERY_CATEGORIES.map((cat) => {
                              const c = getCategoryColors(cat);
                              return (
                                <button
                                  key={cat}
                                  onClick={() => setEditDraft({ ...editDraft, category: cat as GroceryCategory })}
                                  className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                                    editDraft.category === cat ? `${c.bg} ${c.text} ring-1 ring-current` : 'bg-gray-100 text-gray-400'
                                  }`}
                                >
                                  {cat}
                                </button>
                              );
                            })}
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={commitEdit}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-amber-400 text-white text-xs font-semibold hover:bg-amber-500 transition-colors"
                            >
                              <Check size={12} /> Done
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-500 text-xs font-semibold hover:bg-gray-200 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* View mode */
                        <div className="flex items-center gap-3 px-3 py-2.5">
                          {/* Confirm checkbox */}
                          <button
                            onClick={() => toggleConfirm(idx)}
                            className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
                              item.confirmed ? 'bg-amber-400 border-amber-400' : 'border-gray-200 bg-white'
                            }`}
                          >
                            {item.confirmed && (
                              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </button>

                          {/* Name + category */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-700 truncate">{item.name}</p>
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                              {item.category}
                            </span>
                          </div>

                          {/* Price */}
                          <span className="text-sm font-semibold text-gray-700 shrink-0">
                            ${item.price.toFixed(2)}
                          </span>

                          {/* Edit button */}
                          <button
                            onClick={() => startEdit(idx)}
                            className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-amber-500 hover:bg-amber-50 transition-colors"
                          >
                            <Edit3 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Try again */}
              <button
                onClick={() => { setStep('upload'); setResult(null); setItems([]); setPreview(null); }}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors border border-gray-100"
              >
                <RotateCcw size={12} />
                Scan a different receipt
              </button>
            </div>
          )}

          {/* ── Done step ── */}
          {step === 'done' && (
            <div className="px-5 py-10 flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center">
                <Check size={28} className="text-emerald-500" />
              </div>
              <div>
                <p className="text-base font-bold text-gray-800">Prices saved!</p>
                <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                  I've updated your grocery price memory. Future estimates will be more accurate.
                </p>
              </div>
              <button
                onClick={onClose}
                className="mt-2 px-8 py-3 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition-colors active:scale-95"
              >
                Done
              </button>
            </div>
          )}
        </div>

        {/* Footer actions — only on review step */}
        {step === 'review' && editingIdx === null && (
          <div className="px-5 py-4 border-t border-gray-50 flex gap-3 shrink-0">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || confirmedCount === 0}
              className="flex-[2] flex items-center justify-center gap-2 py-3 rounded-xl bg-amber-400 text-white text-sm font-semibold hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors active:scale-[0.98]"
            >
              {saving ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save size={14} />
                  Save {confirmedCount} item{confirmedCount !== 1 ? 's' : ''}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
