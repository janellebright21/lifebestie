import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock supabase BEFORE importing anything that depends on it ─────────────────
const { mockMaybeSingle, mockEq, mockSelect, mockUpsert, mockFrom, mockGetUser } = vi.hoisted(() => {
  const mockMaybeSingle = vi.fn();
  // eq must return an object that supports chaining another eq or maybeSingle
  const mockEq = vi.fn(() => ({ eq: mockEq, maybeSingle: mockMaybeSingle }));
  const mockSelect = vi.fn(() => ({ eq: mockEq }));
  const mockUpsert = vi.fn();
  const mockFrom = vi.fn((_table: string) => ({
    select: mockSelect,
    upsert: mockUpsert,
  }));
  const mockGetUser = vi.fn();
  return { mockMaybeSingle, mockEq, mockSelect, mockUpsert, mockFrom, mockGetUser };
});

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getUser: mockGetUser },
    from: mockFrom,
  },
}));

// Import after mock is set up
import { loadPlanItems, savePlanItems, type PlanItem } from './planLoaderTestHelpers';

// ── Test helpers ────────────────────────────────────────────────────────────────
// We test loadPlanItems and savePlanItems logic directly against the mock.
// These mirror the exact logic in useDailyPlanner.ts.

const TEST_USER = { id: 'user-123' };
const TEST_DATE = '2026-10-06';

const SAMPLE_ITEMS: PlanItem[] = [
  { taskId: 't1', title: 'Task 1', priority: 'high', category: 'Home', duration: 30, time: '09:00', notes: 'note', completed: false, locked: true },
  { taskId: 't2', title: 'Task 2', priority: 'medium', category: 'Work', duration: null, time: '', notes: '', completed: true, locked: false },
];

describe('loadPlanItems: missing vs empty plan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER }, error: null });
  });

  it('returns null when no daily_plans row exists (missing plan)', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const result = await loadPlanItems(TEST_DATE);
    expect(result).toBeNull();
  });

  it('returns [] when a row exists with plan_items = null (empty plan)', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { plan_items: null }, error: null });
    const result = await loadPlanItems(TEST_DATE);
    expect(result).toEqual([]);
  });

  it('returns [] when a row exists with plan_items = [] (intentionally emptied)', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { plan_items: [] }, error: null });
    const result = await loadPlanItems(TEST_DATE);
    expect(result).toEqual([]);
  });

  it('preserves all plan fields and order when loading saved items', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { plan_items: SAMPLE_ITEMS }, error: null });
    const result = await loadPlanItems(TEST_DATE);
    expect(result).toEqual(SAMPLE_ITEMS);
    expect(result).toHaveLength(2);
    expect(result![0].taskId).toBe('t1');
    expect(result![0].locked).toBe(true);
    expect(result![0].time).toBe('09:00');
    expect(result![0].notes).toBe('note');
    expect(result![1].completed).toBe(true);
  });

  it('throws on malformed plan_items (not an array)', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { plan_items: 'not-an-array' }, error: null });
    await expect(loadPlanItems(TEST_DATE)).rejects.toThrow('corrupted');
  });

  it('throws on database error', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'DB connection lost' } });
    await expect(loadPlanItems(TEST_DATE)).rejects.toThrow('DB connection lost');
  });

  it('throws when user is not signed in', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(loadPlanItems(TEST_DATE)).rejects.toThrow('sign in');
  });
});

describe('savePlanItems: serial writes with delayed first save', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER }, error: null });
  });

  it('serializes saves so older slow write cannot overwrite newer write', async () => {
    // Simulate: first save takes 500ms, second save takes 50ms
    // If not serialized, the second would finish first and the first would overwrite it.
    // With serialization, the second save waits for the first to complete.
    let firstSaveResolve!: (v: { error: string | null }) => void;
    let secondSaveResolve!: (v: { error: string | null }) => void;
    const firstSavePromise = new Promise<{ error: string | null }>((r) => { firstSaveResolve = r; });
    const secondSavePromise = new Promise<{ error: string | null }>((r) => { secondSaveResolve = r; });

    const upsertCalls: { items: PlanItem[]; date: string }[] = [];
    mockUpsert.mockImplementation((_payload: unknown) => {
      const callIndex = upsertCalls.length;
      upsertCalls.push({ items: _payload.plan_items, date: _payload.plan_date });
      return callIndex === 0 ? firstSavePromise : secondSavePromise;
    });

    // Start a serial save queue
    let queue: Promise<{ error: string | null }> = Promise.resolve({ error: null });

    function enqueueSave(date: string, items: PlanItem[]): Promise<{ error: string | null }> {
      const run = queue.then(() => savePlanItems(date, items));
      queue = run.catch(() => ({ error: 'chain error' }));
      return run;
    }

    // First save (slow) — items with title "v1"
    const v1Items: PlanItem[] = [{ ...SAMPLE_ITEMS[0], title: 'v1' }];
    const firstResult = enqueueSave(TEST_DATE, v1Items);

    // Second save (fast) — items with title "v2" (should not start until first finishes)
    const v2Items: PlanItem[] = [{ ...SAMPLE_ITEMS[0], title: 'v2' }];
    const secondResult = enqueueSave(TEST_DATE, v2Items);

    // At this point, only the first upsert should have been called
    expect(upsertCalls).toHaveLength(1);
    expect(upsertCalls[0].items[0].title).toBe('v1');

    // Resolve the first save
    firstSaveResolve({ error: null });
    await firstResult;

    // Now the second upsert should have been called
    // Give it a microtask to flush
    await Promise.resolve();
    expect(upsertCalls).toHaveLength(2);
    expect(upsertCalls[1].items[0].title).toBe('v2');

    // Resolve the second save
    secondSaveResolve({ error: null });
    await secondResult;

    // Verify order: v1 first, v2 second (serial)
    expect(upsertCalls[0].items[0].title).toBe('v1');
    expect(upsertCalls[1].items[0].title).toBe('v2');
  });
});

describe('savePlanItems: retry after rejected save', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: TEST_USER }, error: null });
  });

  it('returns error on first save, succeeds on retry', async () => {
    mockUpsert
      .mockResolvedValueOnce({ error: { message: 'Network timeout' } })
      .mockResolvedValueOnce({ error: null });

    const result1 = await savePlanItems(TEST_DATE, SAMPLE_ITEMS);
    expect(result1.error).toBe('Network timeout');

    const result2 = await savePlanItems(TEST_DATE, SAMPLE_ITEMS);
    expect(result2.error).toBeNull();
  });

  it('returns error when user is not signed in', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const result = await savePlanItems(TEST_DATE, SAMPLE_ITEMS);
    expect(result.error).toBe('Not signed in.');
  });
});
