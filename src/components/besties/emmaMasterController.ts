import * as THREE from 'three';
export const EMMA_CLIPS = ['Idle','Wave','Listening','Empathetic','Proud','Conversational','Stance-Change'] as const;
export type EmmaClip = typeof EMMA_CLIPS[number];
export type EmmaActivity = 'idle' | 'listening' | 'thinking' | 'speaking';
export function emotionClip(expression: string): EmmaClip {
  if (['empathetic','encouraging'].includes(expression)) return 'Empathetic';
  if (['proud','excited','playful'].includes(expression)) return 'Proud';
  if (['thinking','listening','focused'].includes(expression)) return 'Listening';
  return 'Idle';
}
/** Plays complete authored performances. Never stack the old v1 pose overlays. */
export class EmmaMasterController {
  readonly mixer: THREE.AnimationMixer;
  private actions = new Map<EmmaClip, THREE.AnimationAction>();
  private current: EmmaClip = 'Idle';
  private retiring = new Map<THREE.AnimationAction, number>();
  private pending: EmmaClip | undefined;
  private reduced = false;
  private expression = '';
  private activity: EmmaActivity = 'idle';
  private speakingWait = 0;
  private disposed = false;
  constructor(readonly root: THREE.Object3D, clips: THREE.AnimationClip[]) {
    this.mixer = new THREE.AnimationMixer(root);
    for (const name of EMMA_CLIPS) {
      const clip = clips.find(c => c.name === name);
      if (!clip) throw new Error(`Emma master is missing ${name}`);
      this.actions.set(name, this.mixer.clipAction(clip));
    }
    this.mixer.addEventListener('finished', this.finished);
    this.play('Idle');
  }
  get state(): EmmaClip { return this.current; }
  private finished = (event: {action: THREE.AnimationAction}) => {
    if (this.disposed || event.action !== this.actions.get(this.current) || this.current === 'Idle') return;
    const next = this.pending ?? 'Idle'; this.pending = undefined;
    this.play(next); this.speakingWait = 4;
  };
  private play(name: EmmaClip) {
    if (this.disposed) return;
    const next = this.actions.get(name)!;
    const old = this.actions.get(this.current);
    this.current = name; this.retiring.delete(next);
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1);
    next.setLoop(name === 'Idle' ? THREE.LoopRepeat : THREE.LoopOnce, name === 'Idle' ? Infinity : 1);
    next.clampWhenFinished = name !== 'Idle'; next.play();
    if (old && old !== next && old.isScheduled()) {
      old.fadeOut(.30); next.fadeIn(.30); this.retiring.set(old, .31);
    }
  }
  request(name: EmmaClip): boolean {
    if (this.disposed || this.reduced) return false;
    if (name === this.current) return false;
    // Let the lifted foot plant before switching away from the stance change.
    // Finish a greeting before another emotional performance takes ownership.
    if (this.current === 'Stance-Change' || (this.current === 'Wave' && name !== 'Wave')) {
      this.pending = name; return true;
    }
    this.pending = undefined; this.play(name); return true;
  }
  setExpression(expression: string) {
    if (this.expression === expression) return;
    this.expression = expression; this.request(emotionClip(expression));
  }
  setActivity(activity: EmmaActivity) {
    if (this.activity === activity) return;
    this.activity = activity; this.speakingWait = 0;
    this.request(activity === 'speaking' ? 'Conversational' : activity === 'idle' ? emotionClip(this.expression) : 'Listening');
  }
  setReducedMotion(reduced: boolean) {
    if (this.disposed || this.reduced === reduced) return;
    this.reduced = reduced; this.pending = undefined; this.retiring.clear(); this.mixer.stopAllAction();
    this.play('Idle');
    const idle = this.actions.get('Idle')!; idle.paused = reduced; this.mixer.update(0);
  }
  update(delta: number) {
    if (this.disposed || this.reduced || !Number.isFinite(delta) || delta <= 0) return;
    const dt = Math.min(delta, .05); this.mixer.update(dt);
    for (const [action, time] of this.retiring) {
      if (time <= dt) { action.stop(); this.retiring.delete(action); }
      else this.retiring.set(action, time - dt);
    }
    if (this.current === 'Idle' && this.activity === 'speaking') {
      this.speakingWait -= dt;
      if (this.speakingWait <= 0) this.request('Conversational');
    }
  }
  dispose() {
    this.disposed = true; this.mixer.removeEventListener('finished', this.finished);
    this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.root); this.retiring.clear();
  }
}
/** Include the raised hand and stepping foot in the camera envelope. */
export function measureEmmaEnvelope(root: THREE.Object3D, clips: THREE.AnimationClip[]): THREE.Box3 {
  const mixer = new THREE.AnimationMixer(root); const bounds = new THREE.Box3();
  const restingCenterX = new THREE.Box3().setFromObject(root,true).getCenter(new THREE.Vector3()).x;
  for (const clip of clips) {
    mixer.stopAllAction(); const action = mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true; action.play();
    for (const fraction of [0,.25,.5,.75,1]) {
      action.time = clip.duration * fraction; mixer.update(0); root.updateMatrixWorld(true);
      bounds.union(new THREE.Box3().setFromObject(root, true));
    }
  }
  mixer.stopAllAction(); mixer.uncacheRoot(root); root.updateMatrixWorld(true);
  if (bounds.isEmpty() || ![...bounds.min,...bounds.max].every(Number.isFinite)) throw new Error('Emma has invalid animated bounds');
  const halfWidth = Math.max(restingCenterX-bounds.min.x,bounds.max.x-restingCenterX);
  bounds.min.x = restingCenterX-halfWidth; bounds.max.x = restingCenterX+halfWidth;
  return bounds;
}
