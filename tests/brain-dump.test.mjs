import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

async function loadModule(path) {
  const source = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}

const {
  validateBrainDumpResult,
  normalizeSuggestion,
  filterByModules,
  canSave,
  isValidLocalDate,
  createSaveOrchestrator,
  hasRetryable,
  countSaved,
  countErrors,
  countSelected,
} = await loadModule('../src/lib/brainDumpLogic.ts');

const ALL_MODULES = new Set(['grocery', 'meals', 'budget', 'movement', 'ai-assistant', 'routines']);
const NO_GROCERY = new Set(['meals', 'budget', 'movement', 'ai-assistant', 'routines']);

// ── Mixed dump: milk, call dentist tomorrow, overwhelmed ──────────────────────

test('mixed dump produces task + grocery + note suggestions, all unchecked', () => {
  const raw = {
    text: "I hear you. Let me sort these out together.",
    suggestions: [
      { type: 'task', title: 'Call dentist', due_date: '2026-10-08', category: 'Personal', priority: 'medium' },
      { type: 'grocery', title: 'Milk', category: 'Dairy', quantity: '1', unit: 'gallon' },
      { type: 'note', title: 'Feeling overwhelmed — be gentle with myself' },
    ],
  };
  const result = validateBrainDumpResult(raw);
  assert.ok(result);
  assert.equal(result.suggestions.length, 3);
  assert.equal(result.suggestions[0].type, 'task');
  assert.equal(result.suggestions[1].type, 'grocery');
  assert.equal(result.suggestions[2].type, 'note');
  // All must start unchecked
  for (const s of result.suggestions) {
    assert.equal(s.selected, false);
    assert.equal(s.status, 'pending');
  }
});

// ── Emotion-only: no forced tasks ──────────────────────────────────────────────

test('emotion-only dump produces no task suggestions, only note if any', () => {
  const raw = {
    text: "That sounds really hard. I'm here with you.",
    suggestions: [
      { type: 'note', title: 'Anxious about the week ahead' },
    ],
  };
  const result = validateBrainDumpResult(raw);
  assert.ok(result);
  assert.equal(result.suggestions.length, 1);
  assert.equal(result.suggestions[0].type, 'note');
  assert.equal(result.suggestions[0].selected, false);
});

test('emotion-only dump with zero suggestions is valid', () => {
  const raw = {
    text: "I hear you. No tasks needed — just taking it one step at a time.",
    suggestions: [],
  };
  const result = validateBrainDumpResult(raw);
  assert.ok(result);
  assert.equal(result.suggestions.length, 0);
});

// ── Malformed/empty/oversized outputs ─────────────────────────────────────────

test('null input returns null', () => {
  assert.equal(validateBrainDumpResult(null), null);
});

test('missing text returns null', () => {
  assert.equal(validateBrainDumpResult({ suggestions: [] }), null);
});

test('empty text returns null', () => {
  assert.equal(validateBrainDumpResult({ text: '   ', suggestions: [] }), null);
});

test('missing suggestions array returns null', () => {
  assert.equal(validateBrainDumpResult({ text: 'ok' }), null);
});

test('oversized suggestions (>20) returns null', () => {
  const raw = {
    text: 'ok',
    suggestions: Array.from({ length: 21 }, (_, i) => ({ type: 'task', title: `task ${i}` })),
  };
  assert.equal(validateBrainDumpResult(raw), null);
});

test('suggestion with empty title is filtered out', () => {
  const raw = {
    text: 'ok',
    suggestions: [
      { type: 'task', title: '  ' },
      { type: 'grocery', title: 'Milk' },
    ],
  };
  const result = validateBrainDumpResult(raw);
  assert.ok(result);
  assert.equal(result.suggestions.length, 1);
  assert.equal(result.suggestions[0].title, 'Milk');
});

test('oversized title (>200 chars) is filtered out', () => {
  const raw = {
    text: 'ok',
    suggestions: [{ type: 'task', title: 'x'.repeat(201) }],
  };
  const result = validateBrainDumpResult(raw);
  assert.ok(result);
  assert.equal(result.suggestions.length, 0);
});

// ── Invalid dates/enums/quantities ────────────────────────────────────────────

test('invalid date (Feb 30) is rejected', () => {
  const s = normalizeSuggestion({ type: 'task', title: 'test', due_date: '2026-02-30' });
  assert.ok(s);
  assert.equal(s.dueDate, undefined, 'Feb 30 is not a valid date');
});

test('invalid date format (2026/10/08) is rejected', () => {
  const s = normalizeSuggestion({ type: 'task', title: 'test', due_date: '2026/10/08' });
  assert.ok(s);
  assert.equal(s.dueDate, undefined);
});

test('invalid task category falls back to Other', () => {
  const s = normalizeSuggestion({ type: 'task', title: 'test', category: 'InvalidCat' });
  assert.ok(s);
  assert.equal(s.category, 'Other');
});

test('invalid priority falls back to medium', () => {
  const s = normalizeSuggestion({ type: 'task', title: 'test', priority: 'urgent' });
  assert.ok(s);
  assert.equal(s.priority, 'medium');
});

test('invalid grocery category falls back to Pantry', () => {
  const s = normalizeSuggestion({ type: 'grocery', title: 'test', category: 'InvalidCat' });
  assert.ok(s);
  assert.equal(s.groceryCategory, 'Pantry');
});

test('invalid suggestion type returns null', () => {
  assert.equal(normalizeSuggestion({ type: 'reminder', title: 'test' }), null);
});

test('non-object suggestion returns null', () => {
  assert.equal(normalizeSuggestion('hello'), null);
  assert.equal(normalizeSuggestion(null), null);
  assert.equal(normalizeSuggestion(42), null);
});

// ── isValidLocalDate direct tests ──────────────────────────────────────────────

test('isValidLocalDate: valid dates', () => {
  assert.ok(isValidLocalDate('2026-10-08'));
  assert.ok(isValidLocalDate('2026-02-28'));
  assert.ok(isValidLocalDate('2024-02-29')); // leap year
});

test('isValidLocalDate: invalid dates', () => {
  assert.ok(!isValidLocalDate('2026-02-30'));
  assert.ok(!isValidLocalDate('2026-13-01'));
  assert.ok(!isValidLocalDate('2026-00-15'));
  assert.ok(!isValidLocalDate('2026/10/08'));
  assert.ok(!isValidLocalDate(''));
  assert.ok(!isValidLocalDate('hello'));
  assert.ok(!isValidLocalDate('2025-02-29')); // not a leap year
});

// ── Module gating ─────────────────────────────────────────────────────────────

test('filterByModules: grocery excluded when module disabled', () => {
  const suggestions = [
    { id: '1', type: 'task', title: 'Call dentist', selected: false, status: 'pending' },
    { id: '2', type: 'grocery', title: 'Milk', selected: false, status: 'pending' },
    { id: '3', type: 'note', title: 'Anxious', selected: false, status: 'pending' },
  ];
  const filtered = filterByModules(suggestions, NO_GROCERY);
  assert.equal(filtered.length, 2);
  assert.equal(filtered[0].type, 'task');
  assert.equal(filtered[1].type, 'note');
});

test('filterByModules: all included when grocery enabled', () => {
  const suggestions = [
    { id: '1', type: 'task', title: 'Call dentist', selected: false, status: 'pending' },
    { id: '2', type: 'grocery', title: 'Milk', selected: false, status: 'pending' },
    { id: '3', type: 'note', title: 'Anxious', selected: false, status: 'pending' },
  ];
  const filtered = filterByModules(suggestions, ALL_MODULES);
  assert.equal(filtered.length, 3);
});

test('canSave: grocery cannot save when module disabled', () => {
  const s = { id: '1', type: 'grocery', title: 'Milk', selected: true, status: 'pending' };
  assert.equal(canSave(s, NO_GROCERY), false);
});

test('canSave: task always can save', () => {
  const s = { id: '1', type: 'task', title: 'Test', selected: true, status: 'pending' };
  assert.equal(canSave(s, NO_GROCERY), true);
});

test('canSave: already-saved cannot save again', () => {
  const s = { id: '1', type: 'task', title: 'Test', selected: true, status: 'saved', savedId: 'abc' };
  assert.equal(canSave(s, ALL_MODULES), false);
});

test('canSave: note cannot save (no note API)', () => {
  const s = { id: '1', type: 'note', title: 'Feeling anxious', selected: true, status: 'pending' };
  assert.equal(canSave(s, ALL_MODULES), false);
});

// ── No writes before approval ──────────────────────────────────────────────────

test('save orchestrator: no writes for unselected suggestions', async () => {
  let calls = 0;
  const saveOne = async () => { calls++; return { success: true, id: 'fake' }; };
  const save = createSaveOrchestrator(saveOne);
  const suggestions = [
    { id: 'a', type: 'task', title: 'Task A', selected: false, status: 'pending' },
    { id: 'b', type: 'task', title: 'Task B', selected: false, status: 'pending' },
  ];
  const results = await save(suggestions);
  assert.equal(calls, 0, 'saveOne must not be called for unselected items');
  assert.equal(results.size, 0);
});

// ── Successful writes ──────────────────────────────────────────────────────────

test('save orchestrator: successful writes return saved status with ID', async () => {
  const saveOne = async (s) => {
    return { success: true, id: `db-${s.id}` };
  };
  const save = createSaveOrchestrator(saveOne);
  const suggestions = [
    { id: 'a', type: 'task', title: 'Task A', selected: true, status: 'pending' },
    { id: 'b', type: 'grocery', title: 'Milk', selected: true, status: 'pending' },
  ];
  const results = await save(suggestions);
  assert.equal(results.size, 2);
  assert.equal(results.get('a').status, 'saved');
  assert.equal(results.get('a').savedId, 'db-a');
  assert.equal(results.get('b').status, 'saved');
  assert.equal(results.get('b').savedId, 'db-b');
});

// ── Partial failure + retry excludes successes ────────────────────────────────

test('save orchestrator: partial failure — failed item is retryable, saved is not', async () => {
  const saveOne = async (s) => {
    if (s.id === 'a') return { success: true, id: 'db-a' };
    return { success: false, error: 'Network error' };
  };
  const save = createSaveOrchestrator(saveOne);
  const suggestions = [
    { id: 'a', type: 'task', title: 'Task A', selected: true, status: 'pending' },
    { id: 'b', type: 'task', title: 'Task B', selected: true, status: 'pending' },
  ];
  const results = await save(suggestions);
  assert.equal(results.get('a').status, 'saved');
  assert.equal(results.get('b').status, 'error');
  assert.equal(results.get('b').errorMsg, 'Network error');

  // Simulate retry: only retry items with status 'error'
  const afterRetry = suggestions.map((s) => {
    const r = results.get(s.id);
    return r ? { ...s, status: r.status, savedId: r.savedId, errorMsg: r.errorMsg } : s;
  });
  assert.ok(hasRetryable(afterRetry));
  assert.equal(countSaved(afterRetry), 1);
  assert.equal(countErrors(afterRetry), 1);

  // Retry only failed items
  const retrySaveOne = async (s) => ({ success: true, id: `db-${s.id}` });
  const retrySave = createSaveOrchestrator(retrySaveOne);
  const retryResults = await retrySave(afterRetry);
  assert.equal(retryResults.size, 1, 'only the failed item should be retried');
  assert.equal(retryResults.get('b').status, 'saved');
});

test('save orchestrator: already-saved items are not retried', async () => {
  let calls = 0;
  const saveOne = async (s) => { calls++; return { success: true, id: `db-${s.id}` }; };
  const save = createSaveOrchestrator(saveOne);
  const suggestions = [
    { id: 'a', type: 'task', title: 'Task A', selected: true, status: 'saved', savedId: 'db-a' },
    { id: 'b', type: 'task', title: 'Task B', selected: true, status: 'pending' },
  ];
  const results = await save(suggestions);
  assert.equal(calls, 1, 'saveOne called only for non-saved item');
  assert.equal(results.size, 1);
  assert.equal(results.get('b').status, 'saved');
});

// ── Concurrent double-submit prevention ───────────────────────────────────────

test('save orchestrator: sequential saves prevent concurrent duplicate inserts', async () => {
  const callOrder = [];
  const saveOne = async (s) => {
    callOrder.push(`start-${s.id}`);
    await new Promise((r) => setTimeout(r, 10));
    callOrder.push(`end-${s.id}`);
    return { success: true, id: `db-${s.id}` };
  };
  const save = createSaveOrchestrator(saveOne);
  const suggestions = [
    { id: 'a', type: 'task', title: 'A', selected: true, status: 'pending' },
    { id: 'b', type: 'task', title: 'B', selected: true, status: 'pending' },
  ];
  await save(suggestions);
  // Sequential: start-a, end-a, start-b, end-b
  assert.deepEqual(callOrder, ['start-a', 'end-a', 'start-b', 'end-b']);
});

// ── Account reset / stale AI response ignored ─────────────────────────────────

test('stale AI response (from different account) is re-validated and rejected if malformed', () => {
  // Simulate a stale response with invalid structure
  const stale = { text: 'old text', suggestions: 'not-an-array' };
  assert.equal(validateBrainDumpResult(stale), null);
});

test('stale AI response with valid structure is accepted but suggestions are fresh', () => {
  const stale = {
    text: 'I hear you.',
    suggestions: [{ type: 'task', title: 'Old task' }],
  };
  const result = validateBrainDumpResult(stale);
  assert.ok(result);
  assert.equal(result.suggestions.length, 1);
  // All suggestions must start unchecked and pending regardless of stale state
  assert.equal(result.suggestions[0].selected, false);
  assert.equal(result.suggestions[0].status, 'pending');
});

// ── Counting helpers ───────────────────────────────────────────────────────────

test('countSaved, countErrors, countSelected work correctly', () => {
  const suggestions = [
    { id: '1', type: 'task', title: 'A', selected: true, status: 'saved', savedId: 'x' },
    { id: '2', type: 'task', title: 'B', selected: true, status: 'error', errorMsg: 'fail' },
    { id: '3', type: 'task', title: 'C', selected: false, status: 'pending' },
    { id: '4', type: 'task', title: 'D', selected: true, status: 'pending' },
  ];
  assert.equal(countSaved(suggestions), 1);
  assert.equal(countErrors(suggestions), 1);
  assert.equal(countSelected(suggestions), 3);
});

test('hasRetryable: true when selected+error exists', () => {
  const suggestions = [
    { id: '1', type: 'task', title: 'A', selected: true, status: 'saved', savedId: 'x' },
    { id: '2', type: 'task', title: 'B', selected: true, status: 'error', errorMsg: 'fail' },
  ];
  assert.ok(hasRetryable(suggestions));
});

test('hasRetryable: false when no selected+error', () => {
  const suggestions = [
    { id: '1', type: 'task', title: 'A', selected: true, status: 'saved', savedId: 'x' },
    { id: '2', type: 'task', title: 'B', selected: false, status: 'error', errorMsg: 'fail' },
  ];
  assert.ok(!hasRetryable(suggestions));
});
