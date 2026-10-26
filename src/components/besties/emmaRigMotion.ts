export type IdleGesture = 'weight-left' | 'weight-right';
export const WAVE_MS = 6400;
export const IDLE_MS = 4200;
export const ease = (value: number) => {
  const x = Math.max(0, Math.min(1, value));
  return x * x * (3 - 2 * x);
};
// Second easing curve — slower ease-in, gentler ease-out — for organic motion
// where the body should hesitate before committing and settle more softly.
export const easeSoft = (value: number) => {
  const x = Math.max(0, Math.min(1, value));
  return x * x * x * (x * (x * 6 - 15) + 10);
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
  // Low-frequency aperiodic phases — each instance drifts at its own speed
  // so the head and torso feel like they belong to a person, not a metronome.
  headPhase: number;
  headFreq: number;
  torsoPhase: number;
  breath = 0;
  blink = 0;

  constructor(private readonly random: () => number = Math.random) {
    this.breathDuration = 5000 + random() * 1800;
    this.breathStrength = .8 + random() * .2;
    this.blinkStart = 2200 + random() * 1800;
    // Low-frequency aperiodic phases — each instance drifts at its own speed
    // so the head and torso feel like they belong to a person, not a metronome.
    this.headPhase = random() * Math.PI * 2;
    this.headFreq = 0.00022 + random() * 0.00014; // ~1 cycle / 50-80s
    this.torsoPhase = this.headPhase + Math.PI * (0.3 + random() * 0.4);
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
  // Weight-shift gesture — eased with easeSoft so the torso hesitates before
  // leaning and settles gently back, rather than snapping symmetrically.
  const shift = gesture ? easeSoft(clock.idleElapsed / 1680) * easeSoft((IDLE_MS - clock.idleElapsed) / 1470) : 0;
  // Greeting ramp — same soft ease so the wave blends in/out of breathing
  // instead of a mechanical linear fade.
  const greet = greeting ? easeSoft(clock.waveElapsed / 1550) * easeSoft((WAVE_MS - clock.waveElapsed) / 1700) : 0;
  // Occasional-feeling head tilt: two slow sine waves at incommensurate
  // speeds so the motion never repeats exactly. Peaks near half a degree —
  // clearly visible in the head, feet stay planted (rotation origin is ground).
  const headDrift = Math.sin(clock.elapsed * clock.headFreq + clock.headPhase) * 0.32
    + Math.sin(clock.elapsed * clock.headFreq * 1.7 + clock.headPhase * 0.5) * 0.14;
  // Torso leans slightly in the same direction as the head but delayed and
  // attenuated — organic follow-through, not rigid coupling. Only applies
  // during pure rest (no gesture at all) so gesture skew stays clean.
  const torsoFollow = gesture ? 0 : Math.sin(clock.elapsed * clock.headFreq * 0.8 + clock.torsoPhase) * 0.1;
  const gestureSkew = (gesture === 'weight-right' ? -1 : 1) * .8 * Math.PI / 180 * shift * clock.idleStrength;
  // During the wave the arm motion is baked into the sprite frames; a small
  // opposing torso lean plus the greeting tilt suggest the body engaging
  // with the gesture instead of a floating arm.
  const greetLean = -0.25 * greet;
  return {
    frame: greeting ? Math.min(384, Math.floor(clock.waveElapsed * 60 / 1000)) : 0,
    scaleX: 1 + .003 * clock.breath, scaleY: 1 + .004 * clock.breath,
    skew: gestureSkew + (greetLean + torsoFollow * (1 - greet)) * Math.PI / 180,
    tilt: (-.12 * greet + headDrift * (1 - greet * 0.7)) * Math.PI / 180,
    blink: clock.blink,
  };
}
