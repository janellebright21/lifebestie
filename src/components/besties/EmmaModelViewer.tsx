import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { AvatarExpression } from '../../lib/supabase';
interface Props { modelSrc: string; waveRequest: number; expression: AvatarExpression; onReady: () => void; onFailure: () => void }
function disposeModel(root: THREE.Object3D) {
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse(node => { if (!(node instanceof THREE.Mesh)) return; node.geometry.dispose(); const list = Array.isArray(node.material) ? node.material : [node.material]; list.forEach(material => { materials.add(material); Object.values(material).forEach(value => { if (value instanceof THREE.Texture) textures.add(value); }); }); });
  textures.forEach(texture => texture.dispose()); materials.forEach(material => material.dispose());
}
export default function EmmaModelViewer({modelSrc, waveRequest, expression, onReady, onFailure}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const greet = useRef<() => void>(() => {});
  const callbacks = useRef({onReady, onFailure}); callbacks.current = {onReady, onFailure};
  const expressionRef = useRef(expression); expressionRef.current = expression;
  useEffect(() => { greet.current(); }, [waveRequest]);
  useEffect(() => {
    const container = host.current; if (!container) return;
    let disposed = false, frame = 0, renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({alpha:true, antialias:true, powerPreference:'low-power'}); } catch { callbacks.current.onFailure(); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); renderer.setClearColor(0, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(30,1,.01,50);
    scene.add(new THREE.HemisphereLight(0xffffff,0x786981,2)); const key = new THREE.DirectionalLight(0xfff5e9,3); key.position.set(2,3,4); scene.add(key);
    let root: THREE.Object3D | undefined, mixer: THREE.AnimationMixer | undefined, idle: THREE.AnimationAction | undefined, waving: THREE.AnimationAction | undefined;
    let previous = 0, nextBlink = 3.8, blinkEnd = 0, elapsed = 0;
    const eyes: Array<{ mesh: THREE.Mesh; indices: number[] }> = [];
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const fit = () => {
      const w = container.clientWidth, h = container.clientHeight; if (!w || !h) return;
      renderer.setSize(w,h,false); camera.aspect = w/h;
      // The model is normalized to two units high with feet on y=0.
      const v = THREE.MathUtils.degToRad(camera.fov); const half = Math.max(1.12,.65/camera.aspect); camera.position.set(0,1.05,half/Math.tan(v/2)); camera.lookAt(0,1.05,0); camera.updateProjectionMatrix();
    };
    const stop = () => { cancelAnimationFrame(frame); frame = 0; previous = 0; };
    const draw = (time: number) => {
      frame = 0; if (disposed || document.hidden) return;
      const delta = previous ? Math.min((time-previous)/1000,.05) : 0; previous = time;
      if (!media.matches && mixer) {
        elapsed += delta; mixer.update(delta);
        if (elapsed > nextBlink && !blinkEnd) blinkEnd = elapsed + .14;
        const closed = blinkEnd && elapsed < blinkEnd ? 1 : 0;
        eyes.forEach(({mesh,indices}) => indices.forEach(i => { if (mesh.morphTargetInfluences) mesh.morphTargetInfluences[i] = closed; }));
        if (blinkEnd && elapsed >= blinkEnd) { blinkEnd = 0; nextBlink = elapsed + 3.2 + Math.random()*2.8; }
      }
      renderer.render(scene,camera); if (!media.matches) frame = requestAnimationFrame(draw);
    };
    const start = () => { stop(); if (!document.hidden && root) frame = requestAnimationFrame(draw); };
    const greetModel = () => {
      if (media.matches || document.hidden || !waving || waving.isRunning()) return;
      idle?.fadeOut(.2); waving.reset().setLoop(THREE.LoopOnce,1); waving.clampWhenFinished = true; waving.fadeIn(.2).play(); start();
    }; greet.current = greetModel;
    const finished = (event: {action: THREE.AnimationAction}) => { if (event.action === waving) { waving?.fadeOut(.2); idle?.reset().fadeIn(.2).play(); } };
    const preference = () => { if (media.matches) { mixer?.stopAllAction(); eyes.forEach(({mesh,indices}) => indices.forEach(i => { if(mesh.morphTargetInfluences)mesh.morphTargetInfluences[i]=0; })); } else idle?.reset().play(); start(); };
    const visibility = () => document.hidden ? stop() : start();
    const lost = (event: Event) => { event.preventDefault(); stop(); callbacks.current.onFailure(); };
    renderer.domElement.addEventListener('webglcontextlost',lost); media.addEventListener('change',preference); document.addEventListener('visibilitychange',visibility);
    const resize = new ResizeObserver(() => {fit();start();}); resize.observe(container); fit();
    new GLTFLoader().load(modelSrc,gltf => {
      if (disposed) { disposeModel(gltf.scene); return; }
      root = gltf.scene; const bounds = new THREE.Box3().setFromObject(root); const size = bounds.getSize(new THREE.Vector3());
      if (!Number.isFinite(size.y) || size.y <= 0) {disposeModel(root);root=undefined;callbacks.current.onFailure();return;}
      root.scale.multiplyScalar(2/size.y); const normalized = new THREE.Box3().setFromObject(root); const center = normalized.getCenter(new THREE.Vector3()); root.position.sub(new THREE.Vector3(center.x,normalized.min.y,center.z)); scene.add(root);
      mixer = new THREE.AnimationMixer(root); const find = (pattern: RegExp) => gltf.animations.find(clip => pattern.test(clip.name));
      const idleClip = find(/^(idle|relaxed|standing)([ _-]|$)/i), waveClip = find(/wave|greet/i);
      if (idleClip) idle = mixer.clipAction(idleClip); if (waveClip) waving = mixer.clipAction(waveClip);
      root.traverse(node => {if (!(node instanceof THREE.Mesh) || !node.morphTargetDictionary) return; const indices = Object.entries(node.morphTargetDictionary).filter(([name]) => /^(blink|eyeBlinkLeft|eyeBlinkRight)$/i.test(name)).map(([,i])=>i); if(indices.length)eyes.push({mesh:node,indices});});
      mixer.addEventListener('finished',finished); if (!media.matches) idle?.play(); fit(); renderer.render(scene,camera); callbacks.current.onReady(); start(); greetModel();
    },undefined,() => {if(!disposed)callbacks.current.onFailure();});
    return () => {disposed=true;stop();greet.current=()=>{};resize.disconnect();media.removeEventListener('change',preference);document.removeEventListener('visibilitychange',visibility);renderer.domElement.removeEventListener('webglcontextlost',lost);mixer?.removeEventListener('finished',finished);mixer?.stopAllAction();if(root){mixer?.uncacheRoot(root);disposeModel(root);}renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();};
  },[modelSrc]);
  return <div className="emma-full-body__canvas" ref={host} aria-hidden="true" />;
}
