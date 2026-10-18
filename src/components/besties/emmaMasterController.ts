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
  private idlePhase = 0;
  private idleWait = 0;
  private attentionWait = 7;
  private waveWait = 8;
  private performedExpression = '';
  constructor(readonly root: THREE.Object3D, clips: THREE.AnimationClip[], private options: {allowStance?:boolean;idleTime?:number} = {}) {
    this.mixer = new THREE.AnimationMixer(root);
    for (const name of EMMA_CLIPS) {
      const clip = clips.find(c => c.name === name);
      if (!clip) throw new Error(`Emma master is missing ${name}`);
      this.actions.set(name, this.mixer.clipAction(clip));
    }
    this.mixer.addEventListener('finished', this.finished);
    this.play('Idle');
    this.idlePhase = options.idleTime ?? 0; this.actions.get('Idle')!.time = this.idlePhase;
  }
  get state(): EmmaClip { return this.current; }
  get idleTime(): number { return this.idlePhase; }
  private finished = (event: {action: THREE.AnimationAction}) => {
    if (this.disposed || event.action !== this.actions.get(this.current) || this.current === 'Idle') return;
    const next = this.pending ?? 'Idle'; this.pending = undefined;
    this.play(next); this.speakingWait = 4; this.attentionWait = 7;
  };
  private play(name: EmmaClip) {
    if (this.disposed) return;
    const next = this.actions.get(name)!;
    const old = this.actions.get(this.current);
    if(name === 'Wave')this.waveWait = 0;
    this.current = name; this.retiring.delete(next);
    const phase = name === 'Idle' ? this.idlePhase : 0;
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1);
    next.time = phase; this.idleWait = 0;
    next.setLoop(name === 'Idle' ? THREE.LoopRepeat : THREE.LoopOnce, name === 'Idle' ? Infinity : 1);
    next.clampWhenFinished = name !== 'Idle'; next.play();
    if (old && old !== next && old.isScheduled()) {
      const fade = name === 'Wave' || old.getClip().name === 'Stance-Change' ? .35 : .55;
      old.fadeOut(fade); next.fadeIn(fade); this.retiring.set(old, fade + .01);
    }
  }
  request(name: EmmaClip): boolean {
    if (this.disposed || this.reduced) return false;
    if (name === this.current) return false;
    if (name === 'Wave' && this.waveWait < 8) return false;
    // Let the lifted foot plant before switching away from the stance change.
    // Finish a greeting before another emotional performance takes ownership.
    if (this.current === 'Stance-Change' || (this.current === 'Wave' && name !== 'Wave')) {
      this.pending = name; return true;
    }
    this.pending = undefined; if (name === 'Wave') this.waveWait = 0; this.play(name); return true;
  }
  setExpression(expression: string) {
    if (this.expression === expression) return;
    this.expression = expression;
    if (this.activity === 'idle') {this.performedExpression = expression; this.request(emotionClip(expression));}
  }
  setActivity(activity: EmmaActivity) {
    if (this.activity === activity) return;
    this.activity = activity; this.speakingWait = 0;
    const reaction = this.performedExpression !== this.expression ? emotionClip(this.expression) : 'Idle';
    if (activity === 'idle') this.performedExpression = this.expression;
    this.request(activity === 'speaking' ? 'Conversational' : activity === 'idle' ? reaction : 'Listening');
  }
  setReducedMotion(reduced: boolean) {
    if (this.disposed || this.reduced === reduced) return;
    this.reduced = reduced; this.pending = undefined; this.retiring.clear(); this.mixer.stopAllAction();
    this.play('Idle');
    const idle = this.actions.get('Idle')!; idle.paused = reduced; this.mixer.update(0);
  }
  update(delta: number) {
    if (this.disposed || this.reduced || !Number.isFinite(delta) || delta <= 0) return;
    const dt = Math.min(delta, .05); this.waveWait += dt; this.mixer.update(dt); if(this.current === 'Idle') this.idlePhase = this.actions.get('Idle')!.time;
    for (const [action, time] of this.retiring) {
      if (time <= dt) { action.stop(); this.retiring.delete(action); }
      else this.retiring.set(action, time - dt);
    }
    if (this.current === 'Idle' && (this.activity === 'listening' || this.activity === 'thinking')) {
      this.attentionWait -= dt; if(this.attentionWait <= 0) this.request('Listening');
    }
    if (this.current === 'Idle' && this.activity === 'idle' && this.options.allowStance) {
      this.idleWait += dt; if(this.idleWait >= 24) this.request('Stance-Change');
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
