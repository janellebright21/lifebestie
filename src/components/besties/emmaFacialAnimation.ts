import * as THREE from 'three';

export interface EmmaFacialPose {
  name: string;
  times: number[];
  weights?: number[];
  channels: Array<[string, string, string, number[], number[], number[]?]>;
}

export function buildEmmaFacialClip(root: THREE.Object3D, pose: EmmaFacialPose): THREE.AnimationClip {
  const tracks: THREE.KeyframeTrack[] = [];
  const weights = pose.weights ?? (pose.name === 'Blink' ? [0, 1, 1, 0] : [0, 1, 1]);
  for (const [name, path, , neutral, target, samples] of pose.channels) {
    const node = root.getObjectByName(THREE.PropertyBinding.sanitizeNodeName(name));
    if (!node || neutral.length !== target.length) throw new Error(`Missing Emma facial target: ${name}`);
    if (samples ? samples.length !== pose.times.length * neutral.length : pose.times.length !== weights.length) throw new Error('Invalid Emma pose timing');
    const values: number[] = [];
    let previousRotation: THREE.Quaternion | undefined;
    for (let frame = 0; frame < pose.times.length; frame++) {
      const weight = weights[frame];
      const row = samples ? samples.slice(frame * neutral.length, (frame + 1) * neutral.length) : neutral.map((value, i) => value + (target[i] - value) * weight);
      if (row.some(value => !Number.isFinite(value))) throw new Error('Invalid Emma facial pose');
      if (path === 'rotation') {
        // q and -q represent the same orientation. Interpolating their raw
        // components can create a full wrist flip between identical poses.
        const q = samples ? new THREE.Quaternion().fromArray(row).normalize() : new THREE.Quaternion().fromArray(neutral).normalize().slerp(new THREE.Quaternion().fromArray(target).normalize(), weight);
        if (previousRotation && previousRotation.dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
        previousRotation = q.clone(); row.splice(0, row.length, ...q.toArray());
      }
      values.push(...row);
    }
    const property = path === 'translation' ? 'position' : path === 'rotation' ? 'quaternion' : path === 'weights' ? 'morphTargetInfluences' : path === 'scale' ? 'scale' : undefined;
    if (!property) throw new Error(`Unsupported Emma facial property: ${path}`);
    const targets: THREE.Object3D[] = [];
    if (path === 'weights') {
      // Multi-material glTF meshes load as groups. Each primitive owns its
      // own morph influences, including the sweatshirt's elbow corrective.
      node.traverse(child => {
        if (child instanceof THREE.Mesh && child.morphTargetInfluences?.length === neutral.length) targets.push(child);
      });
      if (!targets.length) throw new Error(`Missing Emma morph target: ${name}`);
    } else targets.push(node);
    for (const targetNode of targets) {
      // Match GLTFLoader's existing Idle/Wave binding keys. UUID aliases for
      // the same bone create separate mixers that overwrite one another with
      // the original T-pose instead of layering over the evaluated Idle.
      const trackName = `${targetNode.name || targetNode.uuid}.${property}`;
      tracks.push(path === 'rotation' ? new THREE.QuaternionKeyframeTrack(trackName, pose.times, values) : path === 'weights' ? new THREE.NumberKeyframeTrack(trackName, pose.times, values) : new THREE.VectorKeyframeTrack(trackName, pose.times, values));
    }
  }
  return new THREE.AnimationClip(pose.name, -1, tracks);
}

export async function loadEmmaFacialClips(root: THREE.Object3D): Promise<THREE.AnimationClip[]> {
  return Promise.all(['blink', 'friendly', 'attentive', 'empathetic', 'proud'].map(async name => {
    const response = await fetch(`/characters/emma/face-${name}.json`);
    if (!response.ok) throw new Error(`Emma ${name} pose HTTP ${response.status}`);
    return buildEmmaFacialClip(root, await response.json() as EmmaFacialPose);
  }));
}

// The first export omitted Blender's Mirror modifier on these two meshes.
// Reflect the missing geometry and swap skin joints, retaining the original rig.
// Newer exports that already contain both sides are left intact.
export function ensureEmmaFacialSymmetry(root: THREE.Object3D): () => void {
  const mirrors: Array<{ source: THREE.SkinnedMesh; mirror: THREE.SkinnedMesh }> = [];
  for (const name of ['GEO-rain-eyebrows', 'GEO-rain-eyelashes']) {
    const meshes: THREE.SkinnedMesh[] = [];
    root.traverse(node => { if (node instanceof THREE.SkinnedMesh && node.name.startsWith(name)) meshes.push(node); });
    if (meshes.length !== 1) continue;
    const source = meshes[0]; source.geometry.computeBoundingBox();
    const box = source.geometry.boundingBox;
    if (!box || box.min.x <= 0 || !source.geometry.index) continue;
    const geometry = source.geometry.clone();
    const reflect = (attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, tangent = false) => {
      for (let i = 0; i < attribute.count; i++) { attribute.setX(i, -attribute.getX(i)); if (tangent) attribute.setW(i, -attribute.getW(i)); }
      attribute.needsUpdate = true;
    };
    for (const name of ['position', 'normal', 'tangent'] as const) {
      const attribute = geometry.getAttribute(name); if (attribute) reflect(attribute, name === 'tangent');
      if (name !== 'tangent') for (const morph of geometry.morphAttributes[name] ?? []) reflect(morph);
    }
    const indices = geometry.index!;
    for (let i = 0; i < indices.count; i += 3) { const second = indices.getX(i + 1); indices.setX(i + 1, indices.getX(i + 2)); indices.setX(i + 2, second); }
    indices.needsUpdate = true;
    const boneMap = new Map(source.skeleton.bones.map((bone, index) => [bone.name, index]));
    const jointMap = source.skeleton.bones.map((bone, index) => {
      const opposite = bone.name.endsWith('L') ? `${bone.name.slice(0, -1)}R` : bone.name.endsWith('R') ? `${bone.name.slice(0, -1)}L` : bone.name;
      return boneMap.get(opposite) ?? index;
    });
    const skinIndices = geometry.getAttribute('skinIndex');
    for (let i = 0; i < skinIndices.count; i++) skinIndices.setXYZW(i, jointMap[skinIndices.getX(i)], jointMap[skinIndices.getY(i)], jointMap[skinIndices.getZ(i)], jointMap[skinIndices.getW(i)]);
    skinIndices.needsUpdate = true; geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const mirror = new THREE.SkinnedMesh().copy(source, false); mirror.geometry = geometry; mirror.name = `${source.name}-mirror`;
    mirror.bind(source.skeleton, source.bindMatrix.clone()); source.parent?.add(mirror); mirrors.push({ source, mirror });
  }
  return () => {
    for (const { source, mirror } of mirrors) if (source.morphTargetInfluences && mirror.morphTargetInfluences) mirror.morphTargetInfluences.splice(0, mirror.morphTargetInfluences.length, ...source.morphTargetInfluences);
  };
}
