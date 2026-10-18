import * as THREE from 'three';

export interface EmmaExpressionTargets { Friendly: number; Attentive: number }
const EXPRESSIONS: Record<string, EmmaExpressionTargets> = {
  happy: { Friendly: .68, Attentive: .08 },
  encouraging: { Friendly: .75, Attentive: .2 },
  proud: { Friendly: .95, Attentive: .16 },
  calm: { Friendly: .18, Attentive: 0 },
  thinking: { Friendly: .08, Attentive: .9 },
  tired: { Friendly: .08, Attentive: 0 },
  listening: { Friendly: .25, Attentive: .65 },
  empathetic: { Friendly: .32, Attentive: .45 },
  focused: { Friendly: .06, Attentive: .5 },
  excited: { Friendly: 1, Attentive: .28 },
  playful: { Friendly: .88, Attentive: .35 },
};
export function getEmmaExpressionTargets(expression: string): EmmaExpressionTargets {
  return EXPRESSIONS[expression] ?? EXPRESSIONS.happy;
}

interface Offset { bone: THREE.Bone; rotation: THREE.Quaternion; translation: THREE.Vector3 }
export interface EmmaIdleMotion {
  restore(): void;
  apply(time: number, delta: number, expression: string, enabled: boolean): void;
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
  const offsets: Offset[] = []; let strength = 0;
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
    apply(time, delta, expression, enabled) {
      // Idempotent for previews/tests; the viewer also restores before mixing.
      restore();
      if (!enabled) { strength = 0; return; }
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
      // A brief, smooth glance, then sustained eye contact; no constant eye dart.
      const phase = time % 9.7;
      const glance = phase < 2.7 ? 0 : phase < 3.5 ? THREE.MathUtils.smoothstep(phase, 2.7, 3.5) : phase < 4.3 ? 1 : phase < 5.2 ? 1 - THREE.MathUtils.smoothstep(phase, 4.3, 5.2) : 0;
      const direction = Math.floor(time / 9.7) % 2 ? -1 : 1;
      rotate(head, up, (.02 * Math.sin(time / 4.3) + .01 * direction * glance) * amount);
      rotate(head, right, .009 * Math.sin(time / 3.1 + .4) * amount);
      rotate(head, forward, .006 * Math.sin(time / 6.2) * amount);
      for (const eye of [leftEye, rightEye]) {
        rotate(eye, up, .014 * direction * glance * amount);
        rotate(eye, right, .004 * Math.sin(time / 5.1) * amount);
      }
    },
  };
}
