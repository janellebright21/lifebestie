import * as THREE from 'three';

/** Small rest-mesh sculpt for the approved Emma v1 sweatshirt. */
export function refineEmmaTorso(root: THREE.Object3D): number {
  let changed = 0;
  const gaussian = (v: number, center: number, width: number) => Math.exp(-(((v-center)/width)**2));
  const smooth = (v: number) => { const t = THREE.MathUtils.clamp(v, 0, 1); return t*t*(3-2*t); };
  root.traverse(node => {
    const jewelry = node.name === 'Emma_gold_necklace' || node.name === 'Emma_gold_pendant';
    if (!(node instanceof THREE.SkinnedMesh) || (!jewelry && node.parent?.name !== 'Emma_movement-ready_sweatshirt') || node.userData.emmaTorsoRefined) return;
    const source = node.geometry;
    const position = source.getAttribute('position');
    if (!position || position.itemSize !== 3) return;
    // Source vertices use glTF Y-up: Blender (x,y,z) becomes (x,z,-y).
    const geometry = source.clone();
    const target = geometry.getAttribute('position') as THREE.BufferAttribute;
    const normals = geometry.getAttribute('normal') as THREE.BufferAttribute;
    const sourceNormals = source.getAttribute('normal');
    const shape = (x: number, height: number, front: number) => {
      if (jewelry) {
        // Keep the necklace outside the fuller knit; the pendant stays rigid.
        const clearance = node.name === 'Emma_gold_pendant' ? .045 : .065*gaussian(height,1.265,.10)*smooth((front-.005)/.04);
        return new THREE.Vector3(x,height,front+clearance);
      }
      const torso = (1-smooth((Math.abs(x)-.155)/.035))*smooth((height-.99)/.05)*(1-smooth((height-1.36)/.045));
      const facing = smooth((front-.015)/.10);
      const waist = gaussian(height,1.105,.072);
      const bust = .98*(gaussian(x,-.067,.057)+gaussian(x,.067,.057));
      return new THREE.Vector3(x+(-x*.17*waist+x*.025*gaussian(height,1.27,.065))*torso,
        height,front+(.100*bust*gaussian(height,1.265,.058)-.018*gaussian(height,1.175,.034)-.010*gaussian(x,0,.024)*gaussian(height,1.26,.043))*facing*torso);
    };
    const jacobian = new THREE.Matrix3(), normalMatrix = new THREE.Matrix3();
    const epsilon = .0001;
    for (let i = 0; i < target.count; i++) {
      const x = position.getX(i), height = position.getY(i), front = position.getZ(i);
      const shaped = shape(x,height,front);
      if (Math.abs(shaped.x-x)+Math.abs(shaped.z-front)<1e-7) continue;
      target.setXYZ(i,shaped.x,shaped.y,shaped.z); changed++;
      if (normals && sourceNormals) {
        // Transform the original smooth normal by the sculpt's Jacobian.
        // Recomputing triangle normals would flatten the exported UV seams.
        const dx = shape(x+epsilon,height,front).sub(shape(x-epsilon,height,front)).multiplyScalar(.5/epsilon);
        const dy = shape(x,height+epsilon,front).sub(shape(x,height-epsilon,front)).multiplyScalar(.5/epsilon);
        const dz = shape(x,height,front+epsilon).sub(shape(x,height,front-epsilon)).multiplyScalar(.5/epsilon);
        jacobian.set(dx.x,dy.x,dz.x,dx.y,dy.y,dz.y,dx.z,dy.z,dz.z);
        normalMatrix.copy(jacobian).invert().transpose();
        const n = new THREE.Vector3(sourceNormals.getX(i),sourceNormals.getY(i),sourceNormals.getZ(i)).applyMatrix3(normalMatrix).normalize();
        normals.setXYZ(i,n.x,n.y,n.z);
      }
    }
    target.needsUpdate = true; if (normals) normals.needsUpdate = true;
    // Correctives are relative deltas; translating all source shapes equally
    // preserves skin weights, joint bindings and clothing motion.
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    node.geometry = geometry; node.userData.emmaTorsoRefined = true;
  });
  return changed;
}
