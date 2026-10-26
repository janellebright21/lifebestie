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

function seededRandom(seed) {
  return () => { seed = (Math.imul(1664525, seed) + 1013904223) >>> 0; return seed / 4294967296; };
}
test('a minute of idle has irregular blink spacing and bounded, continuous breathing', () => {
  const clock = new EmmaMotionClock(seededRandom(42));
  const blinkStarts = [];
  const breathPeaks = [];
  let previousBlink = 0, previousBreath = 0, rising = true;
  for (let time = 0; time <= 60000; time += 10) {
    clock.tick(time, true, false, null);
    const motion = pose(clock, false, null, false);
    assert.ok(motion.blink >= 0 && motion.blink <= 1);
    assert.ok(motion.scaleX >= 1 && motion.scaleX <= 1.003);
    assert.ok(motion.scaleY >= 1 && motion.scaleY <= 1.004);
    assert.ok(Math.abs(clock.breath - previousBreath) < .015);
    if (clock.blink > 0 && previousBlink === 0) blinkStarts.push(time);
    if (rising && clock.breath < previousBreath) { breathPeaks.push(time); rising = false; }
    if (clock.breath > previousBreath) rising = true;
    previousBlink = clock.blink; previousBreath = clock.breath;
  }
  const gaps = blinkStarts.slice(1).map((t, i) => t - blinkStarts[i]);
  assert.ok(blinkStarts.length >= 8);
  assert.ok(new Set(gaps).size >= 4, 'blink cadence must not be a fixed loop');
  const breathGaps = breathPeaks.slice(1).map((t, i) => t - breathPeaks[i]);
  assert.ok(new Set(breathGaps).size >= 4);
});
test('occasional double blink is followed by a normal interval rather than a rapid chain', () => {
  const clock = new EmmaMotionClock(() => .05);
  const starts = [];
  let last = 0;
  for (let t = 0; t <= 15000; t += 10) {
    clock.tick(t, true, false, null);
    if (clock.blink > 0 && last === 0) starts.push(t);
    last = clock.blink;
  }
  const gaps = starts.slice(1).map((t, i) => t - starts[i]);
  assert.ok(gaps.some(gap => gap < 600));
  for (let i = 1; i < gaps.length; i++) if (gaps[i - 1] < 600) assert.ok(gaps[i] > 2500);
});
test('pause during a blink preserves eyelids and breathing, including through a greeting', () => {
  const clock = new EmmaMotionClock(() => .5);
  for (let t = 0; t <= 3150; t += 10) clock.tick(t, true, false, null);
  const before = pose(clock, false, null, false);
  assert.ok(before.blink > 0 && before.blink < 1);
  clock.tick(3160, false, false, null);
  clock.tick(20000, false, false, null);
  assert.deepEqual(pose(clock, false, null, false), before);
  clock.tick(20010, true, true, null);
  const greeting = pose(clock, true, null, false);
  assert.equal(greeting.blink, before.blink);
  assert.equal(greeting.scaleY, before.scaleY);
});
test('different idle instances vary without changing artwork or greeting frame selection', () => {
  const a = new EmmaMotionClock(() => .1), b = new EmmaMotionClock(() => .9);
  for (let t = 0; t <= 3000; t += 10) { a.tick(t, true, true, null); b.tick(t, true, true, null); }
  const pa = pose(a, true, null, false), pb = pose(b, true, null, false);
  assert.equal(pa.frame, pb.frame);
  assert.notEqual(pa.scaleY, pb.scaleY);
});
