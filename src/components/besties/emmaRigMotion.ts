export type IdleGesture = 'weight-left' | 'weight-right';
export const WAVE_MS = 6400;
export const IDLE_MS = 4200;
export const ease = (value: number) => {
  const x = Math.max(0, Math.min(1, value));
  return x * x * (3 - 2 * x);
};
// Preserve pose across pauses; never catch up time spent in a hidden tab.
export class EmmaMotionClock {
  elapsed = 0;
  waveElapsed = 0;
  idleElapsed = 0;
  private previousTime: number | null = null;
  private active = false;
  private greeting = false;
  private gesture: IdleGesture | null = null;
  private waveFinished = false;
  private idleFinished = false;
  suspend() { this.active = false; }
  tick(time: number, moving: boolean, greeting: boolean, gesture: IdleGesture | null) {
    if (greeting && !this.greeting) { this.waveElapsed = 0; this.waveFinished = false; }
    if (gesture !== this.gesture) { this.idleElapsed = 0; this.idleFinished = false; }
    const delta = moving && this.active && this.previousTime !== null
      ? Math.max(0, Math.min(50, time - this.previousTime)) : 0;
    this.previousTime = time;
    this.active = moving;
    this.greeting = greeting;
    this.gesture = gesture;
    this.elapsed += delta;
    if (greeting) this.waveElapsed = Math.min(WAVE_MS, this.waveElapsed + delta);
    if (gesture) this.idleElapsed = Math.min(IDLE_MS, this.idleElapsed + delta);
    const waveDone = greeting && this.waveElapsed >= WAVE_MS && !this.waveFinished;
    const idleDone = gesture !== null && this.idleElapsed >= IDLE_MS && !this.idleFinished;
    if (waveDone) this.waveFinished = true;
    if (idleDone) this.idleFinished = true;
    return { waveDone, idleDone };
  }
}
export function pose(clock: EmmaMotionClock, greeting: boolean, gesture: IdleGesture | null, reduced: boolean) {
  if (reduced) return { frame: 0, scaleX: 1, scaleY: 1, skew: 0, tilt: 0, blink: 0 };
  const breath = (1 - Math.cos(clock.elapsed / 5500 * Math.PI * 2)) / 2;
  const blinkTime = clock.elapsed % 7300;
  const eyelids = (start: number) => ease((blinkTime - start) / 65) * ease((start + 190 - blinkTime) / 75);
  const shift = gesture ? ease(clock.idleElapsed / 1680) * ease((IDLE_MS - clock.idleElapsed) / 1470) : 0;
  const greet = greeting ? ease(clock.waveElapsed / 1550) * ease((WAVE_MS - clock.waveElapsed) / 1700) : 0;
  return {
    frame: greeting ? Math.min(384, Math.floor(clock.waveElapsed * 60 / 1000)) : 0,
    scaleX: 1 + .003 * breath, scaleY: 1 + .004 * breath,
    skew: (gesture === 'weight-right' ? -1 : 1) * .8 * Math.PI / 180 * shift,
    tilt: -.12 * Math.PI / 180 * greet,
    blink: Math.max(eyelids(2280), eyelids(6300)),
  };
}
