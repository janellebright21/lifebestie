import {getEmmaPortrait,publishEmmaPortrait} from './emmaPortraitCache';
import {useEffect, useRef} from 'react';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import { EmmaMasterController, measureEmmaEnvelope, type EmmaActivity } from './emmaMasterController';
const envelopeCache = new Map<string,THREE.Box3>();
const idlePhases = new Map<string,number>();
let lastGreeting = 0;
function shouldGreet(){let last=lastGreeting;try{last=Math.max(last,Number(sessionStorage.getItem('emma-last-greeting'))||0);}catch{} const now=Date.now();if(now-last<20*60*1000)return false;lastGreeting=now;try{sessionStorage.setItem('emma-last-greeting',String(now));}catch{}return true;}
interface Props {
  modelSrc: string; waveRequest: number; expression: string;
  activity?: EmmaActivity; greetOnArrival?: boolean;
  /** 'full' (default) shows the whole figure; 'portrait' frames head to shoulders. */
  framing?: 'full' | 'portrait';
  onReady: () => void; onFailure: (message: string) => void;
}
function disposeModel(root: THREE.Object3D) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  root.traverse(node => {
    if (!(node instanceof THREE.Mesh)) return;
    geometries.add(node.geometry);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      materials.add(material); for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  for (const texture of textures) texture.dispose(); for (const material of materials) material.dispose(); for (const geometry of geometries) geometry.dispose();
}
/** Replacement for the old viewer; retain the surrounding avatar/fallback component. */
export default function EmmaModelViewer(props: Props) {
  const host = useRef<HTMLDivElement>(null), latest = useRef(props); latest.current = props;
  const control = useRef<EmmaMasterController | undefined>(undefined);
  const refresh = useRef<() => void>(() => {});
  const previousWave = useRef(props.waveRequest);
  useEffect(() => {control.current?.setExpression(props.expression); refresh.current();}, [props.expression]);
  useEffect(() => {const timer=window.setTimeout(()=>{control.current?.setActivity(latest.current.activity ?? 'idle');refresh.current();},180);return()=>window.clearTimeout(timer);}, [props.activity]);
  useEffect(() => {
    if (latest.current.framing === 'portrait') return;
    if (props.waveRequest !== previousWave.current) {previousWave.current = props.waveRequest; control.current?.request('Wave'); refresh.current();}
  }, [props.waveRequest]);
  useEffect(() => {
    const container = host.current; if (!container) return;
    let renderer: THREE.WebGLRenderer;
    try {renderer = new THREE.WebGLRenderer({alpha:true, antialias:true, powerPreference:'low-power'});}
    catch (error) {latest.current.onFailure(error instanceof Error ? error.message : 'WebGL unavailable'); return;}
    let disposed = false, failed = false, raf = 0, previous = 0, onscreen = true;
    let root: THREE.Object3D | undefined, controller: EmmaMasterController | undefined;
    let envelope: THREE.Box3 | undefined;
    const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-1,1,1,-1,.01,100);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1,1.5)); renderer.setClearColor(0,0);
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%'; container.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight(0xffffff,0x786981,2)); const key = new THREE.DirectionalLight(0xfff5e9,2.5); key.position.set(2,3,4); scene.add(key);
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const stop = () => {if (raf) cancelAnimationFrame(raf); raf = 0; previous = 0;};
    const fail = (message: string) => {if (disposed || failed) return; failed = true; stop(); latest.current.onFailure(message);};
    const fit = () => {
      const w = container.clientWidth, h = container.clientHeight; if (!w || !h) return;
      renderer.setSize(w,h,false); if (!envelope) return;
      const size = envelope.getSize(new THREE.Vector3()), center = envelope.getCenter(new THREE.Vector3()), aspect = w/h;
      // Portrait framing is a fixed head-and-shoulders shot derived from the
      // static animated envelope: top margin above the bun, bottom at upper
      // chest, wide enough for both shoulders. It never tracks the clips.
      const portrait = latest.current.framing === 'portrait';
      const span = portrait ? size.y * .32 : size.y * 1.12;
      const focusY = portrait ? envelope.max.y - size.y * .015 - span / 2 : center.y;
      const halfHeight = Math.max(span * .5, portrait ? size.x * .30 / aspect : size.x * .56 / aspect);
      const halfWidth = halfHeight * aspect;
      camera.left = -halfWidth; camera.right = halfWidth; camera.top = halfHeight; camera.bottom = -halfHeight;
      camera.position.set(center.x, focusY, center.z + Math.max(3, size.z + 1)); camera.lookAt(center.x, focusY, center.z); camera.updateProjectionMatrix();
    };
    const draw = (time: number) => {
      raf = 0; if (disposed || failed || document.hidden || !onscreen || !root) return;
      const dt = previous ? Math.min((time-previous)/1000,.05) : 0; previous = time;
      try {controller?.update(dt); renderer.render(scene,camera);} catch (error) {fail(error instanceof Error ? error.message : 'Emma render failed'); return;}
      if (!media.matches) raf = requestAnimationFrame(draw);
    };
    const start = () => {stop(); if (!disposed && !failed && !document.hidden && onscreen && root) raf = requestAnimationFrame(draw);};
    refresh.current = start;
    const preference = () => {controller?.setReducedMotion(media.matches); start();};
    const visibility = () => document.hidden ? stop() : start();
    const lost = (event: Event) => {event.preventDefault(); fail('WebGL context lost');};
    const resize = new ResizeObserver(() => {fit();start();}); resize.observe(container);
    const observer = new IntersectionObserver(entries => {onscreen = entries.some(e => e.isIntersecting); onscreen ? start() : stop();}); observer.observe(container);
    renderer.domElement.addEventListener('webglcontextlost',lost); media.addEventListener('change',preference); document.addEventListener('visibilitychange',visibility);
    new GLTFLoader().load(props.modelSrc, gltf => {
      if (disposed || failed) {disposeModel(gltf.scene); return;}
      root = gltf.scene;
      try {
        envelope = envelopeCache.get(props.modelSrc)?.clone();
        if(!envelope){envelope=measureEmmaEnvelope(root,gltf.animations);envelopeCache.set(props.modelSrc,envelope.clone());}
        controller = new EmmaMasterController(root,gltf.animations,{allowStance:latest.current.framing!=='portrait',idleTime:idlePhases.get(latest.current.framing??'full')??0}); control.current = controller;
        controller.setReducedMotion(media.matches); controller.setExpression(latest.current.expression); controller.setActivity(latest.current.activity ?? 'idle');
        scene.add(root); fit(); renderer.render(scene,camera); if(latest.current.framing==='portrait'&&!getEmmaPortrait().src){try{publishEmmaPortrait(renderer.domElement.toDataURL('image/png'));}catch{/* Main animated view remains usable. */}} latest.current.onReady();
        if (latest.current.greetOnArrival && latest.current.framing !== 'portrait' && !media.matches && shouldGreet()) controller.request('Wave'); start();
      } catch (error) {fail(error instanceof Error ? error.message : 'Emma initialization failed');}
    },undefined,error => fail(error instanceof Error ? error.message : 'Emma model failed to load'));
    return () => {
      disposed = true; stop(); refresh.current = () => {}; control.current = undefined; if(controller)idlePhases.set(latest.current.framing??'full',controller.idleTime); controller?.dispose();
      resize.disconnect(); observer.disconnect(); media.removeEventListener('change',preference); document.removeEventListener('visibilitychange',visibility); renderer.domElement.removeEventListener('webglcontextlost',lost);
      if (root) disposeModel(root); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    };
  }, [props.modelSrc]);
  return <div className="emma-full-body__canvas" ref={host} aria-hidden="true" />;
}
