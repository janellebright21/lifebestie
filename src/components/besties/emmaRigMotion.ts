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
  private breathStarted = 0;
  private breathDuration: number;
  private breathStrength: number;
  private blinkStart: number;
  private blinkClose = 65;
  private blinkHold = 25;
  private blinkOpen = 115;
  private doubleBlink = false;
  private shiftStrength = 1;
  breath = 0;
  blink = 0;

  constructor(private readonly random: () => number = Math.random) {
    this.breathDuration = 5000 + random() * 1800;
    this.breathStrength = .8 + random() * .2;
    this.blinkStart = 2200 + random() * 1800;
  }

  private sampleIdle() {
    while (this.elapsed >= this.breathStarted + this.breathDuration) {
      this.breathStarted += this.breathDuration;
      this.breathDuration = 5000 + this.random() * 1800;
      this.breathStrength = .8 + this.random() * .2;
    }
    const phase = (this.elapsed - this.breathStarted) / this.breathDuration;
    // A slightly longer exhale, with cycle lengths/amplitudes that vary gently.
    this.breath = (phase < .42 ? ease(phase / .42) : 1 - ease((phase - .42) / .58)) * this.breathStrength;
    while (this.elapsed >= this.blinkStart + this.blinkClose + this.blinkHold + this.blinkOpen) {
      const end = this.blinkStart + this.blinkClose + this.blinkHold + this.blinkOpen;
      const followUp = !this.doubleBlink && this.random() < .12;
      this.blinkStart = end + (followUp ? 140 + this.random() * 100 : 2600 + this.random() * 3400);
      this.doubleBlink = followUp;
      this.blinkClose = 55 + this.random() * 25;
      this.blinkHold = 20 + this.random() * 20;
      this.blinkOpen = 95 + this.random() * 35;
    }
    const blinkTime = this.elapsed - this.blinkStart;
    this.blink = ease(blinkTime / this.blinkClose)
      * (1 - ease((blinkTime - this.blinkClose - this.blinkHold) / this.blinkOpen));
  }

  get idleStrength() { return this.shiftStrength; }
  suspend() { this.active = false; }
  tick(time: number, moving: boolean, greeting: boolean, gesture: IdleGesture | null) {
    if (greeting && !this.greeting) { this.waveElapsed = 0; this.waveFinished = false; }
    if (gesture !== this.gesture) {
      this.idleElapsed = 0; this.idleFinished = false;
      if (gesture) this.shiftStrength = .7 + this.random() * .3;
    }
    const delta = moving && this.active && this.previousTime !== null
      ? Math.max(0, Math.min(50, time - this.previousTime)) : 0;
    this.previousTime = time;
    this.active = moving;
    this.greeting = greeting;
    this.gesture = gesture;
    this.elapsed += delta;
    this.sampleIdle();
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
  const shift = gesture ? ease(clock.idleElapsed / 1680) * ease((IDLE_MS - clock.idleElapsed) / 1470) : 0;
  const greet = greeting ? ease(clock.waveElapsed / 1550) * ease((WAVE_MS - clock.waveElapsed) / 1700) : 0;
  return {
    frame: greeting ? Math.min(384, Math.floor(clock.waveElapsed * 60 / 1000)) : 0,
    scaleX: 1 + .003 * clock.breath, scaleY: 1 + .004 * clock.breath,
    skew: (gesture === 'weight-right' ? -1 : 1) * .8 * Math.PI / 180 * shift * clock.idleStrength,
    tilt: -.12 * Math.PI / 180 * greet,
    blink: clock.blink,
  };
}
