import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../src/components/besties/emmaRigMotion.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { EmmaMotionClock, pose, WAVE_MS } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);

test('greeting completes once and joins the identical rest frame without resetting breathing', () => {
  const clock = new EmmaMotionClock();
  clock.tick(0, true, false, null);
  for (let time = 16; time <= 2000; time += 16) clock.tick(time, true, false, null);
  const before = clock.elapsed;
  let completions = 0;
  for (let time = 2016; time < 9000; time += 16) completions += Number(clock.tick(time, true, true, null).waveDone);
  assert.equal(completions, 1);
  assert.equal(clock.waveElapsed, WAVE_MS);
  assert.equal(pose(clock, true, null, false).frame, 384);
  assert.deepEqual({ ...pose(clock, true, null, false), frame: 0 }, pose(clock, false, null, false));
  assert.ok(clock.elapsed > before);
});
test('pause and hidden-tab suspension retain the pose and resume without catching up', () => {
  const clock = new EmmaMotionClock();
  clock.tick(0, true, true, 'weight-left');
  clock.tick(16, true, true, 'weight-left');
  clock.tick(32, false, true, 'weight-left');
  const saved = pose(clock, true, 'weight-left', false);
  clock.tick(9000, false, true, 'weight-left');
  clock.tick(9016, true, true, 'weight-left');
  assert.deepEqual(pose(clock, true, 'weight-left', false), saved);
  clock.tick(9032, true, true, 'weight-left');
  assert.equal(clock.waveElapsed, 32);
  clock.suspend();
  clock.tick(80000, true, true, 'weight-left');
  assert.equal(clock.waveElapsed, 32);
});
test('idle shifts do not trigger waving; both shifts return to zero and complete once', () => {
  for (const gesture of ['weight-left', 'weight-right']) {
    const clock = new EmmaMotionClock();
    clock.tick(0, true, false, gesture);
    let completions = 0;
    for (let time = 16; time < 6000; time += 16) {
      completions += Number(clock.tick(time, true, false, gesture).idleDone);
      assert.equal(pose(clock, false, gesture, false).frame, 0);
    }
    assert.equal(completions, 1);
    assert.equal(Math.abs(pose(clock, false, gesture, false).skew), 0);
  }
});
test('reduced motion is a complete still and long rendering hitches have bounded movement', () => {
  const clock = new EmmaMotionClock();
  clock.tick(0, true, true, null);
  clock.tick(5000, true, true, null);
  assert.equal(clock.waveElapsed, 50);
  assert.deepEqual(pose(clock, true, 'weight-left', true), { frame: 0, scaleX: 1, scaleY: 1, skew: 0, tilt: 0, blink: 0 });
});
