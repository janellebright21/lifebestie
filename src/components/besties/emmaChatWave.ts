import * as THREE from 'three';
/** Camera envelope of the actual authored wave; used only by Chat's opt-in greeting. */
export function measureChatWaveEnvelope(root: THREE.Object3D, clips: THREE.AnimationClip[]): THREE.Box3 {
  const wave=clips.find(clip=>clip.name==='Wave');
  if(!wave)throw new Error('Emma master is missing Wave');
  const mixer=new THREE.AnimationMixer(root), bounds=new THREE.Box3();
  const action=mixer.clipAction(wave).setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();
  for(let frame=0;frame<=24;frame++){
    action.time=wave.duration*frame/24;mixer.update(0);root.updateMatrixWorld(true);
    bounds.union(new THREE.Box3().setFromObject(root,true));
  }
  mixer.stopAllAction();mixer.uncacheRoot(root);root.updateMatrixWorld(true);
  if(bounds.isEmpty() || ![...bounds.min,...bounds.max].every(Number.isFinite))throw new Error('Invalid Emma wave bounds');
  return bounds;
}
