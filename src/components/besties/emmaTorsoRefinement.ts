import * as THREE from 'three';

/** Small rest-mesh sculpt for the approved Emma v1 sweatshirt. */
export function refineEmmaTorso(root: THREE.Object3D): number {
  let changed = 0;
  const gaussian = (v: number, center: number, width: number) => Math.exp(-(((v-center)/width)**2));
  const smooth = (v: number) => { const t = THREE.MathUtils.clamp(v, 0, 1); return t*t*(3-2*t); };
  root.traverse(node => {
    const jewelry = node.name === 'Emma_gold_necklace' || node.name === 'Emma_gold_pendant';
    if (!(node instanceof THREE.SkinnedMesh) || (jewelry || node.parent?.name !== 'Emma_movement-ready_sweatshirt') || node.userData.emmaTorsoRefined) return;
    const source = node.geometry;
    const position = source.getAttribute('position');
    if (!position || position.itemSize !== 3) return;
    // Source vertices use glTF Y-up: Blender (x,y,z) becomes (x,z,-y).
    const geometry = source.clone();
    const target = geometry.getAttribute('position') as THREE.BufferAttribute;
    const normals = geometry.getAttribute('normal') as THREE.BufferAttribute;
    const sourceNormals = source.getAttribute('normal');
    const shape = (x: number, height: number, front: number) => {
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
  // Fit front jewelry to the sculpted cloth surface instead of floating it forward.
  const grid = new Map<string, THREE.Vector3[]>(), cell = .02;
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh) || node.parent?.name !== 'Emma_movement-ready_sweatshirt') return;
    const p = node.geometry.getAttribute('position');
    for (let i=0;i<p.count;i++) {
      if (p.getZ(i)<.04 || Math.abs(p.getX(i))>.18) continue;
      const point = new THREE.Vector3(p.getX(i),p.getY(i),p.getZ(i));
      const key = `${Math.floor(point.x/cell)},${Math.floor(point.y/cell)}`;
      const list = grid.get(key) ?? []; list.push(point); grid.set(key,list);
    }
  });
  const cache = new Map<string,number>();
  const surface = (x: number, y: number, fallback: number) => {
    const key = `${Math.round(x/.00001)},${Math.round(y/.00001)}`;
    if (cache.has(key)) return cache.get(key)!;
    const candidates: Array<{distance:number; depth:number}> = [];
    const gx=Math.floor(x/cell), gy=Math.floor(y/cell);
    for (let i=-2;i<=2;i++) for(let j=-2;j<=2;j++) {
      for(const point of grid.get(`${gx+i},${gy+j}`) ?? []) {
        candidates.push({distance:(point.x-x)**2+(point.y-y)**2,depth:point.z});
      }
    }
    let total=0, weight=0;
    for (const point of candidates) { const w = Math.exp(-point.distance/.00020); total += w*point.depth; weight += w; }
    const value = weight ? total/weight : fallback; cache.set(key,value); return value;
  };
  root.traverse(node => {
    if (!(node instanceof THREE.SkinnedMesh) || !/^Emma_gold_(necklace|pendant)$/.test(node.name) || node.userData.emmaTorsoRefined) return;
    const geometry=node.geometry.clone(), p=geometry.getAttribute('position') as THREE.BufferAttribute;
    const pendant=node.name==='Emma_gold_pendant';
    const center=new THREE.Vector3(); for(let i=0;i<p.count;i++)center.add(new THREE.Vector3(p.getX(i),p.getY(i),p.getZ(i)));center.multiplyScalar(1/p.count);
    const shift=surface(center.x,center.y,center.z)+.005-center.z;
    for(let i=0;i<p.count;i++) {
      const x=p.getX(i), y=p.getY(i), z=p.getZ(i);
      const blend=smooth((z-.025)/.04)*(1-smooth((y-1.335)/.035));
      const dz=pendant ? shift : (surface(x,y,z)+.006-z)*blend;
      if(Math.abs(dz)<1e-7)continue;
      p.setXYZ(i,x,y,z+dz);changed++;
    }
    p.needsUpdate=true;geometry.computeBoundingBox();geometry.computeBoundingSphere();
    node.geometry=geometry;node.userData.emmaTorsoRefined=true;
  });
  return changed;
}
