import * as THREE from "three";
const EMMA_CLIPS = ["Idle", "Wave", "Listening", "Empathetic", "Proud", "Conversational", "Stance-Change"];
const IDLE_GESTURES = ["Listening", "Stance-Change", "Conversational"];
function emotionClip(expression) {
  if (["empathetic", "encouraging"].includes(expression)) return "Empathetic";
  if (["proud", "excited", "playful"].includes(expression)) return "Proud";
  if (["thinking", "listening", "focused"].includes(expression)) return "Listening";
  return "Idle";
}
const WAVE_FINGER_JOINT_CURL = [0.02, 0.02, 0.01];
const WAVE_FINGER_CHAINS = ["Index", "Middle", "Ring", "Pinky"].map((finger) => [1, 2, 3].map((joint) => `DEF-${finger}${joint}L`));
const WAVE_WRIST_BONE = "DEF-HandL";
const WAVE_WRIST_RAD = 30 * Math.PI / 180;
const WAVE_SWAY_START = 1.5;
const WAVE_SWAY_DURATION = 2;
const WAVE_HOLD_END = 3.6;
const WAVE_EXIT_FADE = 1.1;
const WAVE_UPPER_ARM_DIR = new THREE.Vector3(0.1, -0.3, 0.95).normalize();
const WAVE_FOREARM_DIR = new THREE.Vector3(0, 0.94, 0.33).normalize();
const WAVE_PALM_FORWARD = new THREE.Vector3(0, 0, 1);
class EmmaMasterController {
  constructor(root, clips, options = {}) {
    this.root = root;
    this.options = options;
    this.waveFingers = WAVE_FINGER_CHAINS.map((chain) => chain.map((name) => root.getObjectByName(name)).filter((bone) => !!bone));
    const [upper, forearm, hand, fingerBase, fingerTip] = ["DEF-Upperarm1L", "DEF-Forearm1L", WAVE_WRIST_BONE, "DEF-Middle1L", "DEF-Middle3L"].map((name) => root.getObjectByName(name));
    this.waveArm = upper && forearm && hand && fingerBase && fingerTip ? { upper, forearm, hand, fingerBase, fingerTip, foreLength: forearm.getWorldPosition(new THREE.Vector3()).distanceTo(hand.getWorldPosition(new THREE.Vector3())) } : void 0;
    this.mixer = new THREE.AnimationMixer(root);
    for (const name of EMMA_CLIPS) {
      const clip = clips.find((c) => c.name === name);
      if (!clip) throw new Error(`Emma master is missing ${name}`);
      this.actions.set(name, this.mixer.clipAction(clip));
    }
    this.mixer.addEventListener("finished", this.finished);
    this.play("Idle");
    this.idlePhase = options.idleTime ?? 0;
    this.actions.get("Idle").time = this.idlePhase;
  }
  mixer;
  actions = /* @__PURE__ */ new Map();
  current = "Idle";
  retiring = /* @__PURE__ */ new Map();
  pending;
  reduced = false;
  expression = "";
  activity = "idle";
  speakingWait = 0;
  disposed = false;
  idlePhase = 0;
  idleWait = 0;
  nextIdleGestureWait = 13;
  idleGestureIndex = 0;
  attentionWait = 7;
  waveWait = 8;
  waveElapsed = 0;
  performedExpression = "";
  waveFingers;
  waveFingerOffsets = /* @__PURE__ */ new Map();
  waveArmBasePose;
  waveBlend = 0;
  fingerClock = 0;
  waveArm;
  get state() {
    return this.current;
  }
  get waving() {
    return this.current === "Wave";
  }
  get idleTime() {
    return this.idlePhase;
  }
  finished = (event) => {
    if (this.disposed || event.action !== this.actions.get(this.current) || this.current === "Idle") return;
    if (this.current === "Wave") return;
    this.endPerformance();
  };
  endPerformance() {
    const next = this.pending ?? "Idle";
    this.pending = void 0;
    this.play(next);
    this.speakingWait = 4;
    this.attentionWait = 7;
  }
  play(name) {
    if (this.disposed) return;
    const next = this.actions.get(name);
    const old = this.actions.get(this.current);
    if (name === "Wave") {
      this.waveWait = 0;
      this.waveElapsed = 0;
    }
    this.current = name;
    this.retiring.delete(next);
    const phase = name === "Idle" ? this.idlePhase : 0;
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1);
    next.time = phase;
    this.idleWait = 0;
    next.setLoop(name === "Idle" ? THREE.LoopRepeat : THREE.LoopOnce, name === "Idle" ? Infinity : 1);
    next.clampWhenFinished = name !== "Idle";
    next.play();
    if (old && old !== next && old.isScheduled()) {
      const fade = name === "Wave" ? 0.5 : old.getClip().name === "Wave" ? WAVE_EXIT_FADE : old.getClip().name === "Stance-Change" ? 0.35 : 0.55;
      old.fadeOut(fade);
      next.fadeIn(fade);
      this.retiring.set(old, fade + 0.01);
    }
  }
  request(name, userTap = false) {
    if (this.disposed || this.reduced) return false;
    if (name === this.current) return false;
    if (name === "Wave" && !userTap && this.waveWait < 8) return false;
    if (this.current === "Stance-Change" || this.current === "Wave" && name !== "Wave") {
      this.pending = name;
      return true;
    }
    this.pending = void 0;
    if (name === "Wave") this.waveWait = 0;
    this.play(name);
    return true;
  }
  setExpression(expression) {
    if (this.expression === expression) return;
    this.expression = expression;
    if (this.activity === "idle") {
      this.performedExpression = expression;
      this.request(emotionClip(expression));
    }
  }
  setActivity(activity) {
    if (this.activity === activity) return;
    this.activity = activity;
    this.speakingWait = 0;
    const reaction = this.performedExpression !== this.expression ? emotionClip(this.expression) : "Idle";
    if (activity === "idle") this.performedExpression = this.expression;
    this.request(activity === "speaking" ? "Conversational" : activity === "idle" ? reaction : "Listening");
  }
  setReducedMotion(reduced) {
    if (this.disposed || this.reduced === reduced) return;
    this.reduced = reduced;
    this.pending = void 0;
    this.retiring.clear();
    this.restoreWaveOverlays();
    this.waveBlend = 0;
    this.mixer.stopAllAction();
    this.play("Idle");
    const idle = this.actions.get("Idle");
    idle.paused = reduced;
    this.mixer.update(0);
  }
  update(delta) {
    if (this.disposed || this.reduced || !Number.isFinite(delta) || delta <= 0) return;
    const dt = Math.min(delta, 0.05);
    this.waveWait += dt;
    if (this.current === "Wave") this.waveElapsed += dt;
    this.restoreWaveOverlays();
    this.mixer.update(dt);
    if (this.current === "Idle") this.idlePhase = this.actions.get("Idle").time;
    if (this.current === "Wave" && this.waveElapsed >= WAVE_HOLD_END) this.endPerformance();
    this.applyWaveFingers(dt);
    for (const [action, time] of this.retiring) {
      if (time <= dt) {
        action.stop();
        this.retiring.delete(action);
      } else this.retiring.set(action, time - dt);
    }
    if (this.current === "Idle" && (this.activity === "listening" || this.activity === "thinking")) {
      this.attentionWait -= dt;
      if (this.attentionWait <= 0) this.request("Listening");
    }
    if (this.current === "Idle" && this.activity === "idle" && this.options.allowStance) {
      this.idleWait += dt;
      if (this.idleWait >= this.nextIdleGestureWait) {
        this.nextIdleGestureWait = 12 + Math.random() * 6;
        const gesture = IDLE_GESTURES[this.idleGestureIndex++ % IDLE_GESTURES.length];
        this.request(gesture);
      }
    }
    if (this.current === "Idle" && this.activity === "speaking") {
      this.speakingWait -= dt;
      if (this.speakingWait <= 0) this.request("Conversational");
    }
  }
  /** Additive finger curl layered after the mixer so the authored clip values are untouched. */
  applyWaveFingers(dt) {
    const target = this.current === "Wave" ? 1 : 0;
    const rate = this.current === "Wave" ? 4 : 3.2;
    this.waveBlend += (target - this.waveBlend) * (1 - Math.exp(-dt * rate));
    this.fingerClock += dt;
    if (this.waveBlend < 2e-3) return;
    this.applyWaveArm(this.waveBlend);
    const axis = new THREE.Vector3(1, 0, 0), curl = new THREE.Quaternion();
    this.waveFingers.forEach((joints, finger) => {
      const pulse = 0.75 + 0.25 * Math.sin(this.fingerClock * 2.2 - finger * 0.8);
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
  applyWaveArm(weight) {
    if (!this.waveArm || weight < 1e-3) return;
    const { upper, forearm, hand, fingerBase, fingerTip, foreLength } = this.waveArm;
    this.waveArmBasePose = [upper, forearm, hand].map((bone) => ({
      bone,
      position: bone.position.clone(),
      quaternion: bone.quaternion.clone(),
      scale: bone.scale.clone()
    }));
    this.root.updateMatrixWorld(true);
    const shoulder = upper.getWorldPosition(new THREE.Vector3());
    const elbow = forearm.getWorldPosition(new THREE.Vector3());
    const wrist = hand.getWorldPosition(new THREE.Vector3());
    const identity = new THREE.Quaternion();
    const shoulderTurn = new THREE.Quaternion().slerpQuaternions(identity, new THREE.Quaternion().setFromUnitVectors(elbow.clone().sub(shoulder).normalize(), WAVE_UPPER_ARM_DIR), weight);
    const onShoulder = (p) => p.clone().sub(shoulder).applyQuaternion(shoulderTurn).add(shoulder);
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
  restoreWaveOverlays() {
    if (this.waveArmBasePose) {
      for (const pose of this.waveArmBasePose) {
        pose.bone.position.copy(pose.position);
        pose.bone.quaternion.copy(pose.quaternion);
        pose.bone.scale.copy(pose.scale);
      }
      this.waveArmBasePose = void 0;
      this.root.updateMatrixWorld(true);
    }
    for (const [bone, offset] of this.waveFingerOffsets) bone.quaternion.multiply(offset.clone().invert());
    this.waveFingerOffsets.clear();
  }
  dispose() {
    this.restoreWaveOverlays();
    this.disposed = true;
    this.mixer.removeEventListener("finished", this.finished);
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);
    this.retiring.clear();
  }
}
function setWorldPose(bone, position, quaternion) {
  const parentInverse = bone.parent ? bone.parent.matrixWorld.clone().invert() : new THREE.Matrix4();
  const world = new THREE.Matrix4().compose(position, quaternion, bone.getWorldScale(new THREE.Vector3()));
  parentInverse.multiply(world).decompose(bone.position, bone.quaternion, bone.scale);
}
function measureEmmaEnvelope(root, clips) {
  const mixer = new THREE.AnimationMixer(root);
  const bounds = new THREE.Box3();
  const restingCenterX = new THREE.Box3().setFromObject(root, true).getCenter(new THREE.Vector3()).x;
  for (const clip of clips) {
    mixer.stopAllAction();
    const action = mixer.clipAction(clip).setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
      action.time = clip.duration * fraction;
      mixer.update(0);
      root.updateMatrixWorld(true);
      bounds.union(new THREE.Box3().setFromObject(root, true));
    }
  }
  mixer.stopAllAction();
  mixer.uncacheRoot(root);
  root.updateMatrixWorld(true);
  if (bounds.isEmpty() || ![...bounds.min, ...bounds.max].every(Number.isFinite)) throw new Error("Emma has invalid animated bounds");
  const halfWidth = Math.max(restingCenterX - bounds.min.x, bounds.max.x - restingCenterX);
  bounds.min.x = restingCenterX - halfWidth;
  bounds.max.x = restingCenterX + halfWidth;
  return bounds;
}
export {
  EMMA_CLIPS,
  EmmaMasterController,
  emotionClip,
  measureEmmaEnvelope
};
