import * as THREE from 'three';
import { buildEmmaFacialClip, type EmmaFacialPose } from './emmaFacialAnimation';

export async function loadEmmaBodyClips(root: THREE.Object3D): Promise<THREE.AnimationClip[]> {
  // Failure of an optional gesture must not remove the character or its face.
  const results = await Promise.allSettled(['listening', 'empathetic', 'proud'].map(async name => {
    const response = await fetch(`/characters/emma/body-${name}.json`);
    if (!response.ok) throw new Error(`Emma ${name} gesture HTTP ${response.status}`);
    return buildEmmaFacialClip(root, await response.json() as EmmaFacialPose);
  }));
  return results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
}

export function createEmmaBodyPerformance(mixer: THREE.AnimationMixer, clips: THREE.AnimationClip[]) {
  const actions = new Map<string, THREE.AnimationAction>();
  for (const clip of clips) {
    const additive = THREE.AnimationUtils.makeClipAdditive(clip.clone(), 0, clip, 30);
    const action = mixer.clipAction(additive).setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = false;
    actions.set(clip.name.replace('Body-', '').toLowerCase(), action);
  }
  let last = '', pending = '', delay = 0;
  return {
    update(expression: string, delta: number, enabled: boolean) {
      if (!enabled) {
        for (const action of actions.values()) action.stop();
        last = ''; pending = ''; delay = 0; return;
      }
      if (expression !== last) {
        last = expression; pending = expression; delay = .2;
        for (const action of actions.values()) if (action.isRunning()) action.fadeOut(.25);
      }
      if (!pending) return;
      delay -= Math.min(Math.max(delta, 0), .05);
      if (delay > 0) return;
      const action = actions.get(pending); pending = '';
      action?.reset().setEffectiveWeight(1).fadeIn(.25).play();
    },
    dispose() { for (const action of actions.values()) action.stop(); actions.clear(); },
  };
}
