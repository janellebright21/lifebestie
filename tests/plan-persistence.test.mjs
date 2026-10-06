import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

async function loadModule(path) {
  const source = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}
const { readSavedPlan } = await loadModule('../src/lib/savedPlan.ts');
const { createPlanSaveQueue } = await loadModule('../src/lib/planSaveQueue.ts');

test('missing plans and intentionally empty plans remain distinct', () => {
  assert.equal(readSavedPlan(null), null);
  assert.deepEqual(readSavedPlan({ plan_items: [] }), []);
});
test('restore retains order, time, notes, completion and locks', () => {
  const items = [{ taskId: 'two', title: 'Lunch', priority: 'medium', category: 'Other', duration: 20, time: '12:00', notes: 'Prep first', completed: true, locked: true }, { taskId: 'one', title: 'Laundry' }];
  assert.deepEqual(readSavedPlan({ plan_items: items }), items);
});
test('malformed saved plans are rejected instead of replaced with defaults', () => {
  for (const plan_items of [null, {}, [null], [{ title: 'Missing identity' }]]) {
    assert.throws(() => readSavedPlan({ plan_items }), /unexpected format/);
  }
});
test('a newer save waits for a slow older save', async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const written = [];
  const save = createPlanSaveQueue(async (snapshot) => {
    if (snapshot === 'old') await gate;
    written.push(snapshot);
    return { error: null };
  });
  const first = save('old');
  const second = save('new');
  await Promise.resolve();
  assert.deepEqual(written, []);
  release();
  await Promise.all([first, second]);
  assert.deepEqual(written, ['old', 'new']);
});
test('failed saves report errors and do not block retry', async () => {
  let attempts = 0;
  const save = createPlanSaveQueue(async () => {
    if (++attempts === 1) throw new Error('Network unavailable');
    return { error: null };
  });
  assert.deepEqual(await save([]), { error: 'Network unavailable' });
  assert.deepEqual(await save([]), { error: null });
});
