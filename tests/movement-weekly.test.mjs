import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

async function loadModule(path) {
  let source = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
  // Strip react import — we only test pure functions, not hooks
  source = source.replace(/import\s*\{[^}]*\}\s*from\s*['"]react['"];?/g, 'const useMemo = () => {};');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}

const { getWeeklyMovements } = await loadModule('../src/hooks/useMovement.ts');

// Use a known Wednesday so week boundaries are predictable.
// 2026-10-14 is a Wednesday → week starts Sun 2026-10-11, ends Sat 2026-10-17.
const TODAY = '2026-10-14';

function mkEvent(id, date, time, category = 'Movement', title = 'Walk') {
  return { id, title, event_date: date, event_time: time ?? null, category, notes: null, location: null };
}

test('returns count=0 and next=null when no movement events exist', () => {
  const result = getWeeklyMovements([], TODAY);
  assert.equal(result.count, 0);
  assert.equal(result.next, null);
});

test('counts only Movement-category events within the calendar week (Sun–Sat)', () => {
  const events = [
    mkEvent('e1', '2026-10-11', '08:00'),  // Sunday — start of week
    mkEvent('e2', '2026-10-14', '09:00'),  // Wednesday (today)
    mkEvent('e3', '2026-10-17', '18:00'),  // Saturday — end of week
    mkEvent('e4', '2026-10-10', '08:00'),  // Saturday previous week — excluded
    mkEvent('e5', '2026-10-18', '08:00'),  // Sunday next week — excluded
    mkEvent('e6', '2026-10-14', '10:00', 'Work'),  // non-Movement category — excluded
  ];
  const result = getWeeklyMovements(events, TODAY);
  assert.equal(result.count, 3);
});

test('next is the earliest upcoming session at or after today, sorted by date then time', () => {
  const events = [
    mkEvent('past', '2026-10-12', '08:00', 'Movement', 'Stretching'),  // past, this week
    mkEvent('later', '2026-10-16', '07:00', 'Movement', 'Cardio'),     // upcoming later in week
    mkEvent('today-late', '2026-10-14', '18:00', 'Movement', 'Evening walk'),
    mkEvent('today-early', '2026-10-14', '09:00', 'Movement', 'Morning walk'),
  ];
  const result = getWeeklyMovements(events, TODAY);
  assert.equal(result.count, 4);
  assert.equal(result.next.title, 'Morning walk');
  assert.equal(result.next.date, '2026-10-14');
  assert.equal(result.next.time, '09:00');
});

test('next is null when all sessions this week are in the past', () => {
  const events = [
    mkEvent('e1', '2026-10-11', '08:00', 'Movement', 'Walk'),
    mkEvent('e2', '2026-10-13', '07:00', 'Movement', 'Stretch'),
  ];
  const result = getWeeklyMovements(events, TODAY);
  assert.equal(result.count, 2);
  assert.equal(result.next, null);
});

test('handles events with null time', () => {
  const events = [
    mkEvent('e1', '2026-10-15', null, 'Movement', 'Yoga'),
  ];
  const result = getWeeklyMovements(events, TODAY);
  assert.equal(result.count, 1);
  assert.equal(result.next.title, 'Yoga');
  assert.equal(result.next.time, null);
});
