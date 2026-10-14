import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

async function loadModule(path) {
  let source = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
  source = source.replace(/import\s*\{[^}]*\}\s*from\s*['"]react['"];?/g, 'const useMemo = () => {};');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}

const { parseDurationMinutes, activitiesForTimeRange, TIME_RANGES } = await loadModule('../src/hooks/useMovement.ts');

test('parseDurationMinutes extracts the first number from a duration string', () => {
  assert.equal(parseDurationMinutes('10 min'), 10);
  assert.equal(parseDurationMinutes('5 min'), 5);
  assert.equal(parseDurationMinutes('45 min'), 45);
  assert.equal(parseDurationMinutes('60 min'), 60);
  assert.equal(parseDurationMinutes(''), 0);
  assert.equal(parseDurationMinutes('no numbers here'), 0);
});

test('TIME_RANGES has exactly 3 ranges: short (5-10), medium (15-20), long (30+)', () => {
  assert.equal(TIME_RANGES.length, 3);
  assert.equal(TIME_RANGES[0].id, 'short');
  assert.equal(TIME_RANGES[1].id, 'medium');
  assert.equal(TIME_RANGES[2].id, 'long');
  assert.equal(TIME_RANGES[0].min, 5);
  assert.equal(TIME_RANGES[0].max, 10);
  assert.equal(TIME_RANGES[1].min, 15);
  assert.equal(TIME_RANGES[1].max, 20);
  assert.equal(TIME_RANGES[2].min, 30);
  assert.equal(TIME_RANGES[2].max, Infinity);
});

test('short range returns only activities with 5-10 min duration', () => {
  const result = activitiesForTimeRange('short');
  assert.ok(result.length > 0, 'should have activities');
  for (const a of result) {
    const mins = parseDurationMinutes(a.duration);
    assert.ok(mins >= 5 && mins <= 10, `${a.label} (${a.duration}) should be 5-10 min`);
  }
  // Should include known low-energy activities
  const labels = result.map((a) => a.label);
  assert.ok(labels.includes('Walk around the block'));
  assert.ok(labels.includes('Stretching'));
  assert.ok(labels.includes('Mobility routine'));
});

test('medium range returns only activities with 15-20 min duration', () => {
  const result = activitiesForTimeRange('medium');
  assert.ok(result.length > 0, 'should have activities');
  for (const a of result) {
    const mins = parseDurationMinutes(a.duration);
    assert.ok(mins >= 15 && mins <= 20, `${a.label} (${a.duration}) should be 15-20 min`);
  }
  const labels = result.map((a) => a.label);
  assert.ok(labels.includes('Bodyweight workout'));
  assert.ok(labels.includes('Resistance bands'));
  assert.ok(labels.includes('Fast walk'));
});

test('long range returns only activities with 30+ min duration', () => {
  const result = activitiesForTimeRange('long');
  assert.ok(result.length > 0, 'should have activities');
  for (const a of result) {
    const mins = parseDurationMinutes(a.duration);
    assert.ok(mins >= 30, `${a.label} (${a.duration}) should be 30+ min`);
  }
  const labels = result.map((a) => a.label);
  assert.ok(labels.includes('Strength workout'));
  assert.ok(labels.includes('Cardio workout'));
  assert.ok(labels.includes('Full workout session'));
});

test('every activity across all ranges covers all 9 MOVEMENT_OPTIONS activities exactly once', () => {
  const all = ['short', 'medium', 'long']
    .flatMap((r) => activitiesForTimeRange(r))
    .map((a) => a.id);
  assert.equal(all.length, 9, 'should have exactly 9 activities total');
  assert.equal(new Set(all).size, 9, 'no duplicates across ranges');
});

test('unknown range returns empty array', () => {
  // @ts-expect-error — testing invalid input
  const result = activitiesForTimeRange('nonexistent');
  assert.equal(result.length, 0);
});
