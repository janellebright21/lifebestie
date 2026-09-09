/** Returns a local YYYY-MM-DD date string, avoiding UTC drift from toISOString(). */
export function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getTodayLocal(): string {
  return localDateStr();
}

/** Add N days to a YYYY-MM-DD string and return the new local date string. */
export function addDaysLocal(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return localDateStr(d);
}
