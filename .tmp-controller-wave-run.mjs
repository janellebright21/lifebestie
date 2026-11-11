import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { EmmaMasterController } from './.tmp-controller-wave-check.mjs';
import fs from 'fs';
globalThis.self = globalThis;
const b=fs.readFileSync('public/characters/emma/Emma-Master.glb');
const gltf=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
const root=clone(gltf.scene); root.updateMatrixWorld(true);
const c=new EmmaMasterController(root,gltf.animations);
const bones=['DEF-Upperarm1L','DEF-Forearm1L','DEF-HandL'].map(n=>root.getObjectByName(n));
const samples=[]; c.request('Wave',true);
for(let f=0;f<420;f++){c.update(1/60);root.updateMatrixWorld(true);if([0,30,60,90,120,150,180,210,240,270,300,330,360,419].includes(f))samples.push({t:+((f+1)/60).toFixed(2),state:c.state,p:bones.map(x=>x.getWorldPosition(new THREE.Vector3()).toArray().map(v=>+v.toFixed(3)))});}
console.log('MOTION_RESULT '+JSON.stringify({samples,final:c.state}));
c.dispose();