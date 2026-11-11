import * as THREE from 'three';
export const EMMA_CLIPS = ['Idle','Wave','Listening','Empathetic','Proud','Conversational','Stance-Change'] as const;
export type EmmaClip = typeof EMMA_CLIPS[number];
export type EmmaActivity = 'idle' | 'listening' | 'thinking' | 'speaking';
const IDLE_GESTURES: readonly EmmaClip[] = ['Listening', 'Stance-Change', 'Conversational'];
export function emotionClip(expression: string): EmmaClip {
  if (['empathetic','encouraging'].includes(expression)) return 'Empathetic';
  if (['proud','excited','playful'].includes(expression)) return 'Proud';
  if (['thinking','listening','focused'].includes(expression)) return 'Listening';
  return 'Idle';
}
const WAVE_FINGER_JOINT_CURL = [0.02, 0.02, 0.01];
const WAVE_FINGER_CHAINS = ['Index', 'Middle', 'Ring', 'Pinky'].map(finger => [1, 2, 3].map(joint => `DEF-${finger}${joint}L`));
const WAVE_WRIST_BONE = 'DEF-HandL';
const WAVE_WRIST_RAD = 30 * Math.PI / 180;
const WAVE_SWAY_START = 1.5;
const WAVE_SWAY_DURATION = 2;
const WAVE_HOLD_END = 3.6;
const WAVE_EXIT_FADE = 1.1;
const WAVE_UPPER_ARM_DIR = new THREE.Vector3(0.1, -0.3, 0.95).normalize();
const WAVE_FOREARM_DIR = new THREE.Vector3(0, 0.94, 0.33).normalize();
const WAVE_PALM_FORWARD = new THREE.Vector3(0, 0, 1);

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
  private nextIdleGestureWait = 13;
  private idleGestureIndex = 0;
  private attentionWait = 7;
  private waveWait = 8;
  private waveElapsed = 0;
  private performedExpression = '';
  private waveFingers: THREE.Object3D[][];
  private waveFingerOffsets = new Map<THREE.Object3D, THREE.Quaternion>();
  private waveArmBasePose: Array<{bone: THREE.Object3D; position: THREE.Vector3; quaternion: THREE.Quaternion; scale: THREE.Vector3}> | undefined;
  private waveBlend = 0;
  private fingerClock = 0;
  private waveArm: { upper: THREE.Object3D; forearm: THREE.Object3D; hand: THREE.Object3D; fingerBase: THREE.Object3D; fingerTip: THREE.Object3D; foreLength: number } | undefined;
  constructor(readonly root: THREE.Object3D, clips: THREE.AnimationClip[], private options: {allowStance?:boolean;idleTime?:number} = {}) {
    this.waveFingers = WAVE_FINGER_CHAINS.map(chain => chain.map(name => root.getObjectByName(name)).filter((bone): bone is THREE.Object3D => !!bone));
    const [upper, forearm, hand, fingerBase, fingerTip] = ['DEF-Upperarm1L', 'DEF-Forearm1L', WAVE_WRIST_BONE, 'DEF-Middle1L', 'DEF-Middle3L'].map(name => root.getObjectByName(name));
    this.waveArm = upper && forearm && hand && fingerBase && fingerTip ? { upper, forearm, hand, fingerBase, fingerTip, foreLength: forearm.getWorldPosition(new THREE.Vector3()).distanceTo(hand.getWorldPosition(new THREE.Vector3())) } : undefined;
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
  get waving(): boolean { return this.current === 'Wave'; }
  get idleTime(): number { return this.idlePhase; }
  private finished = (event: {action: THREE.AnimationAction}) => {
    if (this.disposed || event.action !== this.actions.get(this.current) || this.current === 'Idle') return;
    // The authored Wave clip may finish before the full greeting should end.
    // Leave its last raised pose clamped; update() owns the hold and exit timing.
    if (this.current === 'Wave') return;
    this.endPerformance();
  };
  private endPerformance() {
    const next = this.pending ?? 'Idle'; this.pending = undefined;
    this.play(next); this.speakingWait = 4; this.attentionWait = 7;
  }
  private play(name: EmmaClip) {
    if (this.disposed) return;
    const next = this.actions.get(name)!;
    const old = this.actions.get(this.current);
    if(name === 'Wave'){this.waveWait = 0; this.waveElapsed = 0;}
    this.current = name; this.retiring.delete(next);
    const phase = name === 'Idle' ? this.idlePhase : 0;
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1);
    next.time = phase; this.idleWait = 0;
    next.setLoop(name === 'Idle' ? THREE.LoopRepeat : THREE.LoopOnce, name === 'Idle' ? Infinity : 1);
    next.clampWhenFinished = name !== 'Idle'; next.play();
    if (old && old !== next && old.isScheduled()) {
      const fade = name === 'Wave' ? .5 : old.getClip().name === 'Wave' ? WAVE_EXIT_FADE : old.getClip().name === 'Stance-Change' ? .35 : .55;
      old.fadeOut(fade); next.fadeIn(fade); this.retiring.set(old, fade + .01);
    }
  }
  request(name: EmmaClip, userTap = false): boolean {
    if (this.disposed || this.reduced) return false;
    if (name === this.current) return false;
    if (name === 'Wave' && !userTap && this.waveWait < 8) return false;
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
    this.reduced = reduced; this.pending = undefined; this.retiring.clear(); this.restoreWaveOverlays(); this.waveBlend = 0; this.mixer.stopAllAction();
    this.play('Idle');
    const idle = this.actions.get('Idle')!; idle.paused = reduced; this.mixer.update(0);
  }
  update(delta: number) {
    if (this.disposed || this.reduced || !Number.isFinite(delta) || delta <= 0) return;
    const dt = Math.min(delta, .05); this.waveWait += dt;
    if (this.current === 'Wave') this.waveElapsed += dt;
    this.restoreWaveOverlays();
    this.mixer.update(dt); if(this.current === 'Idle') this.idlePhase = this.actions.get('Idle')!.time;
    if (this.current === 'Wave' && this.waveElapsed >= WAVE_HOLD_END) this.endPerformance();
    this.applyWaveFingers(dt);
    for (const [action, time] of this.retiring) {
      if (time <= dt) { action.stop(); this.retiring.delete(action); }
      else this.retiring.set(action, time - dt);
    }
    if (this.current === 'Idle' && (this.activity === 'listening' || this.activity === 'thinking')) {
      this.attentionWait -= dt; if(this.attentionWait <= 0) this.request('Listening');
    }
    if (this.current === 'Idle' && this.activity === 'idle' && this.options.allowStance) {
      this.idleWait += dt;
      if (this.idleWait >= this.nextIdleGestureWait) {
        // Sprinkle in an authored listening gesture and a gentle stance shift,
        // with a little timing variation so her idle does not feel looped.
        this.nextIdleGestureWait = 12 + Math.random() * 6;
        const gesture = IDLE_GESTURES[this.idleGestureIndex++ % IDLE_GESTURES.length];
        this.request(gesture);
      }
    }
    if (this.current === 'Idle' && this.activity === 'speaking') {
      this.speakingWait -= dt;
      if (this.speakingWait <= 0) this.request('Conversational');
    }
  }
  /** Additive finger curl layered after the mixer so the authored clip values are untouched. */
  private applyWaveFingers(dt: number) {
    const target = this.current === 'Wave' ? 1 : 0;
    const rate = this.current === 'Wave' ? 4 : 3.2;
    this.waveBlend += (target - this.waveBlend) * (1 - Math.exp(-dt * rate));
    this.fingerClock += dt;
    if (this.waveBlend < .002) return;
    this.applyWaveArm(this.waveBlend);
    const axis = new THREE.Vector3(1, 0, 0), curl = new THREE.Quaternion();
    this.waveFingers.forEach((joints, finger) => {
      const pulse = .75 + .25 * Math.sin(this.fingerClock * 2.2 - finger * .8);
      joints.forEach((bone, joint) => {
        curl.setFromAxisAngle(axis, WAVE_FINGER_JOINT_CURL[joint] * this.waveBlend * pulse);
        bone.quaternion.multiply(curl);
        this.waveFingerOffsets.set(bone, curl.clone());
      });
    });
    if (this.waveArm) {
      const u = THREE.MathUtils.clamp((this.waveWait - WAVE_SWAY_START) / WAVE_SWAY_DURATION, 0, 1);
      const angle = Math.sin(Math.PI * u) * Math.sin(4 * Math.PI * u) * WAVE_WRIST_RAD * this.waveBlend;
      const sway = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), angle);
      this.waveArm.hand.quaternion.multiply(sway);
    }
  }
  /** Rigidly rotates the upper arm about the shoulder and the forearm and hand about the elbow so the chain never separates. */
  private applyWaveArm(weight: number) {
    if (!this.waveArm || weight < .001) return;
    const { upper, forearm, hand, fingerBase, fingerTip, foreLength } = this.waveArm;
    this.waveArmBasePose = [upper, forearm, hand].map(bone => ({
      bone, position: bone.position.clone(), quaternion: bone.quaternion.clone(), scale: bone.scale.clone(),
    }));
    this.root.updateMatrixWorld(true);
    const shoulder = upper.getWorldPosition(new THREE.Vector3());
    const elbow = forearm.getWorldPosition(new THREE.Vector3());
    const wrist = hand.getWorldPosition(new THREE.Vector3());
    const identity = new THREE.Quaternion();
    const shoulderTurn = new THREE.Quaternion().slerpQuaternions(identity, new THREE.Quaternion().setFromUnitVectors(elbow.clone().sub(shoulder).normalize(), WAVE_UPPER_ARM_DIR), weight);
    const onShoulder = (p: THREE.Vector3) => p.clone().sub(shoulder).applyQuaternion(shoulderTurn).add(shoulder);
    const elbowTurned = onShoulder(elbow), wristTurned = onShoulder(wrist);
    const elbowTurn = new THREE.Quaternion().slerpQuaternions(identity, new THREE.Quaternion().setFromUnitVectors(wristTurned.clone().sub(elbowTurned).normalize(), WAVE_FOREARM_DIR), weight);
    const wristFinal = wristTurned.clone().sub(elbowTurned).normalize().multiplyScalar(foreLength).applyQuaternion(elbowTurn).add(elbowTurned);
    const forearmTurn = elbowTurn.clone().multiply(shoulderTurn);
    const handQuat = hand.getWorldQuaternion(new THREE.Quaternion());
    const fingerDirection = fingerTip.getWorldPosition(new THREE.Vector3()).sub(fingerBase.getWorldPosition(new THREE.Vector3()));
    const palmNormal = new THREE.Vector3(1, 0, 0).applyQuaternion(handQuat).cross(fingerDirection).normalize().applyQuaternion(forearmTurn);
    const palmTurn = new THREE.Quaternion().slerpQuaternions(identity, new THREE.Quaternion().setFromUnitVectors(palmNormal, WAVE_PALM_FORWARD), weight);
    setWorldPose(upper, shoulder, shoulderTurn.clone().multiply(upper.getWorldQuaternion(new THREE.Quaternion())));
    setWorldPose(forearm, elbowTurned, forearmTurn.clone().multiply(forearm.getWorldQuaternion(new THREE.Quaternion())));
    setWorldPose(hand, wristFinal, palmTurn.multiply(forearmTurn).multiply(handQuat));
  }
  private restoreWaveOverlays() {
    if (this.waveArmBasePose) {
      for (const pose of this.waveArmBasePose) {
        pose.bone.position.copy(pose.position);
        pose.bone.quaternion.copy(pose.quaternion);
        pose.bone.scale.copy(pose.scale);
      }
      this.waveArmBasePose = undefined;
      this.root.updateMatrixWorld(true);
    }
    for (const [bone, offset] of this.waveFingerOffsets) bone.quaternion.multiply(offset.clone().invert());
    this.waveFingerOffsets.clear();
  }
  dispose() {
    this.restoreWaveOverlays();
    this.disposed = true; this.mixer.removeEventListener('finished', this.finished);
    this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.root); this.retiring.clear();
  }
}
function setWorldPose(bone: THREE.Object3D, position: THREE.Vector3, quaternion: THREE.Quaternion) {
  const parentInverse = bone.parent ? bone.parent.matrixWorld.clone().invert() : new THREE.Matrix4();
  const world = new THREE.Matrix4().compose(position, quaternion, bone.getWorldScale(new THREE.Vector3()));
  parentInverse.multiply(world).decompose(bone.position, bone.quaternion, bone.scale);
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
