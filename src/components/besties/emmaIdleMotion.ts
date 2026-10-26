import * as THREE from 'three';

export interface EmmaExpressionTargets { Friendly: number; Attentive: number; Empathetic: number; Proud: number }
const EXPRESSIONS: Record<string, Pick<EmmaExpressionTargets, 'Friendly' | 'Attentive'> & Partial<EmmaExpressionTargets>> = {
  happy: { Friendly: .68, Attentive: .08 },
  encouraging: { Friendly: .75, Attentive: .2 },
  proud: { Friendly: 0, Attentive: 0, Proud: 1 },
  calm: { Friendly: .18, Attentive: 0 },
  thinking: { Friendly: .08, Attentive: .9 },
  tired: { Friendly: .08, Attentive: 0 },
  listening: { Friendly: .25, Attentive: .65 },
  empathetic: { Friendly: 0, Attentive: 0, Empathetic: 1 },
  focused: { Friendly: .06, Attentive: .5 },
  excited: { Friendly: 1, Attentive: .28 },
  playful: { Friendly: .88, Attentive: .35 },
};
export function getEmmaExpressionTargets(expression: string): EmmaExpressionTargets {
  return { Empathetic: 0, Proud: 0, ...(EXPRESSIONS[expression] ?? EXPRESSIONS.happy) };
}

export type EmmaActivity = 'idle' | 'listening' | 'thinking' | 'speaking';
interface GazeProfile { yaw: number; pitch: number; period: number; dwell: number }
const GAZE: Record<string, GazeProfile> = {
  thinking: { yaw: .045, pitch: -.026, period: 8.8, dwell: 1.1 },
  listening: { yaw: .012, pitch: 0, period: 12.1, dwell: .45 },
  empathetic: { yaw: .016, pitch: .014, period: 11.3, dwell: .65 },
  proud: { yaw: .025, pitch: -.008, period: 10.7, dwell: .6 },
  playful: { yaw: .040, pitch: -.012, period: 9.4, dwell: .65 },
  calm: { yaw: .014, pitch: .006, period: 13.2, dwell: .8 },
  tired: { yaw: .012, pitch: .020, period: 13.7, dwell: .9 },
  focused: { yaw: .009, pitch: .005, period: 14.1, dwell: .4 },
};
const DEFAULT_GAZE: GazeProfile = { yaw: .022, pitch: 0, period: 11.5, dwell: .6 };

interface Offset { bone: THREE.Bone; rotation: THREE.Quaternion; translation: THREE.Vector3 }
export interface EmmaIdleMotion {
  restore(): void;
  apply(time: number, delta: number, expression: string, enabled: boolean, activity?: EmmaActivity): void;
}

// Apply small offsets to the evaluated skeleton, never to the entire character
// or its legs. Restore these offsets BEFORE the next AnimationMixer update.
export function createEmmaIdleMotion(root: THREE.Object3D): EmmaIdleMotion {
  const find = (name: string) => {
    const node = root.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name));
    return node instanceof THREE.Bone ? node : undefined;
  };
  const chest = find('DEF-Spine3'), head = find('DEF-Head'), neck = find('DEF-Neck');
  const leftEye = find('DEF-Eye.L'), rightEye = find('DEF-Eye.R');
  const leftShoulder = find('DEF-Clavicle.L'), rightShoulder = find('DEF-Clavicle.R');
  const offsets: Offset[] = []; let strength = 0, gazeYaw = 0, gazePitch = 0;
  const up = new THREE.Vector3(0, 1, 0), right = new THREE.Vector3(1, 0, 0), forward = new THREE.Vector3(0, 0, 1);
  const worldRotation = new THREE.Quaternion(), inverseWorld = new THREE.Quaternion(), deltaRotation = new THREE.Quaternion(), localAxis = new THREE.Vector3();
  const restore = () => {
    for (let i = offsets.length - 1; i >= 0; i--) {
      const offset = offsets[i]; offset.bone.quaternion.multiply(offset.rotation.clone().invert()).normalize(); offset.bone.position.sub(offset.translation);
    }
    offsets.length = 0;
  };
  const rotate = (bone: THREE.Bone | undefined, axis: THREE.Vector3, angle: number) => {
    if (!bone || Math.abs(angle) < 1e-9) return;
    bone.getWorldQuaternion(worldRotation); inverseWorld.copy(worldRotation).invert(); localAxis.copy(axis).applyQuaternion(inverseWorld).normalize();
    deltaRotation.setFromAxisAngle(localAxis, angle); bone.quaternion.multiply(deltaRotation).normalize();
    offsets.push({ bone, rotation: deltaRotation.clone(), translation: new THREE.Vector3() });
  };
  const translateUp = (bone: THREE.Bone | undefined, distance: number) => {
    if (!bone || Math.abs(distance) < 1e-9) return;
    const shift = up.clone().multiplyScalar(distance);
    if (bone.parent) { bone.parent.getWorldQuaternion(worldRotation); shift.applyQuaternion(worldRotation.invert()); }
    bone.position.add(shift); offsets.push({ bone, rotation: new THREE.Quaternion(), translation: shift });
  };
  return {
    restore,
    apply(time, delta, expression, enabled, activity = 'idle') {
      // Idempotent for previews/tests; the viewer also restores before mixing.
      restore();
      if (!enabled) { strength = 0; gazeYaw = 0; gazePitch = 0; return; }
      strength = THREE.MathUtils.damp(strength, 1, 3.5, Math.min(Math.max(delta, 0), .05));
      const quiet = /^(calm|tired|focused)$/.test(expression) ? .65 : 1;
      const amount = strength * quiet;
      const breath = Math.sin(time * Math.PI * 2 / 4.9);
      const settle = .65 * Math.sin(time * Math.PI * 2 / 13.7) + .35 * Math.sin(time * Math.PI * 2 / 19.3 + .7);
      translateUp(chest, .0025 * breath * amount);
      rotate(chest, right, .0045 * breath * amount);
      rotate(chest, forward, .0045 * settle * amount);
      rotate(leftShoulder, forward, -.0035 * breath * amount);
      rotate(rightShoulder, forward, .0035 * breath * amount);
      rotate(neck, forward, .0025 * Math.sin(time / 3.7) * amount);
      // Mood sets intent; paired eyes share a target and return to eye contact.
      // Speaking can be supplied by a real playback state, never inferred from mood.
      const profile = GAZE[activity === 'thinking' || activity === 'listening' ? activity : expression] ?? DEFAULT_GAZE;
      const period = activity === 'speaking' ? 7.6 : profile.period;
      const phase = time % period;
      const onset = activity === 'speaking' ? 2.5 : 3.0;
      const arrive = onset + .22, release = arrive + profile.dwell, end = release + .38;
      const glance = phase < onset ? 0 : phase < arrive ? THREE.MathUtils.smoothstep(phase, onset, arrive) : phase < release ? 1 : phase < end ? 1 - THREE.MathUtils.smoothstep(phase, release, end) : 0;
      const direction = Math.floor(time / period) % 2 ? -1 : 1;
      const dt = Math.min(Math.max(delta, 0), .05);
      gazeYaw = THREE.MathUtils.damp(gazeYaw, direction * profile.yaw * glance, 18, dt);
      gazePitch = THREE.MathUtils.damp(gazePitch, profile.pitch * glance, 18, dt);
      // Eyes lead a glance; the head follows with a smaller, slower response.
      rotate(head, up, (.012 * Math.sin(time / 4.3) + .22 * gazeYaw) * amount);
      rotate(head, right, (.009 * Math.sin(time / 3.1 + .4) + .2 * gazePitch) * amount);
      rotate(head, forward, .006 * Math.sin(time / 6.2) * amount);
      for (const eye of [leftEye, rightEye]) {
        rotate(eye, up, gazeYaw * amount);
        rotate(eye, right, gazePitch * amount);
      }

    },
  };
}
