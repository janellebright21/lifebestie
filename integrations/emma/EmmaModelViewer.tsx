import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ensureEmmaFacialSymmetry, loadEmmaFacialClips } from './emmaFacialAnimation';
import { createEmmaIdleMotion, getEmmaExpressionTargets, type EmmaIdleMotion } from './emmaIdleMotion';
import type { AvatarExpression } from '../../lib/supabase';
interface Props { modelSrc: string; waveRequest: number; expression: AvatarExpression; onReady: () => void; onFailure: (message: string) => void }
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
  const refreshExpression = useRef<() => void>(() => {});
  useEffect(() => { refreshExpression.current(); }, [expression]);
  useEffect(() => { greet.current(); }, [waveRequest]);
  useEffect(() => {
    const container = host.current; if (!container) return;
    let disposed = false, frame = 0, renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({alpha:true, antialias:true, powerPreference:'low-power'}); } catch (error) { callbacks.current.onFailure(error instanceof Error ? `WebGL init failed: ${error.message}` : 'WebGL init failed'); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); renderer.setClearColor(0, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(30,1,.01,50);
    scene.add(new THREE.HemisphereLight(0xffffff,0x786981,2)); const key = new THREE.DirectionalLight(0xfff5e9,3); key.position.set(2,3,4); scene.add(key);
    let root: THREE.Object3D | undefined, mixer: THREE.AnimationMixer | undefined, idle: THREE.AnimationAction | undefined, waving: THREE.AnimationAction | undefined;
    let previous = 0, nextBlink = 3.8, elapsed = 0;
    let syncMirroredMorphs = () => {};
    let idleMotion: EmmaIdleMotion | undefined;
    let blink: THREE.AnimationAction | undefined;
    const faceActions: Partial<Record<'Friendly' | 'Attentive' | 'Empathetic' | 'Proud', THREE.AnimationAction>> = {};
    const faceWeights = { Friendly: 0, Attentive: 0, Empathetic: 0, Proud: 0 };
    const targetExpression = () => getEmmaExpressionTargets(String(expressionRef.current));
    const activateFacePoses = () => {
      for (const name of ['Friendly', 'Attentive', 'Empathetic', 'Proud'] as const) {
        const action = faceActions[name]; if (!action) continue;
        action.reset().setLoop(THREE.LoopOnce, 1).setEffectiveWeight(faceWeights[name]).play();
        action.time = action.getClip().duration; action.paused = true;
      }
    };
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
      if (mixer) {
        idleMotion?.restore();
        const target = targetExpression();
        for (const name of ['Friendly', 'Attentive', 'Empathetic', 'Proud'] as const) {
          faceWeights[name] = media.matches ? target[name] : THREE.MathUtils.damp(faceWeights[name], target[name], 9, delta);
          faceActions[name]?.setEffectiveWeight(faceWeights[name]);
        }
        if (!media.matches) {
          elapsed += delta;
          if (blink && elapsed >= nextBlink && !blink.isRunning()) {
            blink.reset().setLoop(THREE.LoopOnce, 1).setEffectiveWeight(1).play();
            nextBlink = elapsed + 3.2 + Math.random() * 2.8;
          }
        }
        // Facial clips are additive: eyelid, lash, brow and lip motion layers
        // over Idle or Wave without replacing the body's animation tracks.
        mixer.update(media.matches ? 0 : delta);
        idleMotion?.apply(elapsed, delta, String(expressionRef.current), !media.matches && !waving?.isRunning());
      }
      syncMirroredMorphs();
      renderer.render(scene,camera); if (!media.matches) frame = requestAnimationFrame(draw);
    };
    const start = () => { stop(); if (!document.hidden && root) frame = requestAnimationFrame(draw); };
    refreshExpression.current = start;
    const greetModel = () => {
      if (media.matches || document.hidden || !waving || waving.isRunning()) return;
      idleMotion?.restore();
      idle?.fadeOut(.2); waving.reset().setLoop(THREE.LoopOnce,1); waving.clampWhenFinished = true; waving.fadeIn(.2).play(); start();
    }; greet.current = greetModel;
    const finished = (event: {action: THREE.AnimationAction}) => { if (event.action === waving) { waving?.fadeOut(.2); idle?.reset().fadeIn(.2).play(); nextBlink = elapsed + 1.5; } };
    const preference = () => {
      idleMotion?.restore();
      mixer?.stopAllAction(); idle?.reset().play(); activateFacePoses();
      nextBlink = elapsed + 3.8; start();
    };
    const visibility = () => document.hidden ? stop() : start();
    const lost = (event: Event) => { event.preventDefault(); stop(); callbacks.current.onFailure('WebGL context lost'); };
    renderer.domElement.addEventListener('webglcontextlost',lost); media.addEventListener('change',preference); document.addEventListener('visibilitychange',visibility);
    const resize = new ResizeObserver(() => {fit();start();}); resize.observe(container); fit();
    new GLTFLoader().load(modelSrc,async gltf => {
      if (disposed) { disposeModel(gltf.scene); return; }
      root = gltf.scene; const bounds = new THREE.Box3().setFromObject(root); const size = bounds.getSize(new THREE.Vector3());
      if (!Number.isFinite(size.y) || size.y <= 0) {disposeModel(root);root=undefined;callbacks.current.onFailure('model has invalid bounds');return;}
      root.scale.multiplyScalar(2/size.y); const normalized = new THREE.Box3().setFromObject(root); const center = normalized.getCenter(new THREE.Vector3()); root.position.sub(new THREE.Vector3(center.x,normalized.min.y,center.z)); scene.add(root);
      syncMirroredMorphs = ensureEmmaFacialSymmetry(root);
      if (!gltf.animations.some(clip => clip.name === 'Blink')) {
        try { gltf.animations.push(...await loadEmmaFacialClips(root)); }
        catch (error) { if (import.meta.env.DEV) console.warn('[EmmaModelViewer] facial poses unavailable:', error); }
        if (disposed) return;
      }
      mixer = new THREE.AnimationMixer(root); const find = (pattern: RegExp) => gltf.animations.find(clip => pattern.test(clip.name));
      // Keep the existing body clips; the separate facial poses layer over them.
      const idleClip = find(/^(idle|relaxed|standing)([ _-]|$)/i), waveClip = find(/wave|greet/i);
      if (idleClip) idle = mixer.clipAction(idleClip); if (waveClip) waving = mixer.clipAction(waveClip);
      for (const name of ['Blink', 'Friendly', 'Attentive', 'Empathetic', 'Proud'] as const) {
        const clip = gltf.animations.find(candidate => candidate.name === name); if (!clip) continue;
        const additive = THREE.AnimationUtils.makeClipAdditive(clip.clone(), 0, clip, 30);
        additive.name = `${name}-additive`;
        const action = mixer.clipAction(additive); action.setLoop(THREE.LoopOnce, 1);
        if (name === 'Blink') { action.clampWhenFinished = false; blink = action; }
        else { action.clampWhenFinished = true; faceActions[name] = action; }
      }
      activateFacePoses();
      idleMotion = createEmmaIdleMotion(root);
      mixer.addEventListener('finished',finished); idle?.play(); mixer.update(0); fit(); renderer.render(scene,camera); callbacks.current.onReady(); start(); greetModel();
    },undefined,error => {if(!disposed){const message = error instanceof Error ? error.message : String(error ?? 'GLB load failed'); if (import.meta.env.DEV) console.error('[EmmaModelViewer] GLB load failed:', message); callbacks.current.onFailure(message);}});
    return () => {disposed=true;stop();idleMotion?.restore();greet.current=()=>{};refreshExpression.current=()=>{};resize.disconnect();media.removeEventListener('change',preference);document.removeEventListener('visibilitychange',visibility);renderer.domElement.removeEventListener('webglcontextlost',lost);mixer?.removeEventListener('finished',finished);mixer?.stopAllAction();if(root){mixer?.uncacheRoot(root);disposeModel(root);}renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();};
  },[modelSrc]);
  return <div className="emma-full-body__canvas" ref={host} aria-hidden="true" />;
}
