import { useEffect, useRef, useState } from 'react';
import { EmmaMotionClock, pose, type IdleGesture } from './emmaRigMotion';

const ROOT = '/assets/emma/rig/mesh-v1/';
type Manifest = {
  width: number; height: number; fps: number; frameCount: number; durationMs: number;
  groundX: number; groundY: number; columns: number; framesPerAtlas: number;
  crop: { x: number; y: number; width: number; height: number }; atlases: string[];
};
type Assets = { manifest: Manifest; body: HTMLImageElement; blink: HTMLImageElement; atlases: HTMLImageElement[] };
let cachedAssets: Promise<Assets> | undefined;
async function image(name: string) {
  const result = new Image();
  result.src = ROOT + name;
  await result.decode();
  return result;
}
function loadAssets() {
  if (!cachedAssets) {
    cachedAssets = (async () => {
      const response = await fetch(ROOT + 'manifest.json');
      if (!response.ok) throw new Error('Emma animation unavailable');
      const manifest: Manifest = await response.json();
      if (manifest.frameCount !== 385 || manifest.fps !== 60 || manifest.atlases.length !== 25) throw new Error('Invalid Emma animation');
      const [body, blink, atlases] = await Promise.all([
        image('body.webp'), image('blink.webp'), Promise.all(manifest.atlases.map(image)),
      ]);
      if ([body, blink].some(asset => asset.width !== manifest.width || asset.height !== manifest.height)
        || atlases.some(asset => asset.width !== manifest.crop.width * 4 || asset.height !== manifest.crop.height * 4)) throw new Error('Incomplete Emma animation');
      return { manifest, body, blink, atlases };
    })().catch(error => { cachedAssets = undefined; throw error; });
  }
  return cachedAssets;
}
type Props = {
  moving: boolean; reduced: boolean; greeting: boolean; gesture: IdleGesture | null;
  onReady: () => void; onWaveComplete: () => void; onIdleComplete: () => void;
};
export default function EmmaRigCanvas(props: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef(props);
  latest.current = props;
  const clockRef = useRef<EmmaMotionClock | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!props.moving || props.reduced) clockRef.current?.suspend();
  }, [props.moving, props.reduced]);
  useEffect(() => {
    let disposed = false;
    let request = 0;
    const clock = new EmmaMotionClock();
    clockRef.current = clock;
    loadAssets().then(assets => {
      if (disposed || !canvas.current) return;
      const element = canvas.current;
      const ctx = element.getContext('2d');
      if (!ctx) return;
      const { manifest: m } = assets;
      element.width = m.width; element.height = m.height;
      const draw = (time: number) => {
        if (disposed) return;
        const p = latest.current;
        const events = clock.tick(time, p.moving && !p.reduced, p.greeting, p.gesture);
        const motion = pose(clock, p.greeting, p.gesture, p.reduced);
        const index = Math.floor(motion.frame / m.framesPerAtlas);
        const tile = motion.frame % m.framesPerAtlas;
        ctx.clearRect(0, 0, m.width, m.height);
        ctx.save();
        ctx.translate(m.groundX, m.groundY);
        ctx.rotate(motion.tilt);
        ctx.transform(motion.scaleX, 0, Math.tan(motion.skew), motion.scaleY, 0, 0);
        ctx.translate(-m.groundX, -m.groundY);
        ctx.drawImage(assets.body, 0, 0);
        ctx.drawImage(assets.atlases[index], (tile % m.columns) * m.crop.width,
          Math.floor(tile / m.columns) * m.crop.height, m.crop.width, m.crop.height,
          m.crop.x, m.crop.y, m.crop.width, m.crop.height);
        ctx.globalAlpha = motion.blink;
        ctx.drawImage(assets.blink, 0, 0);
        ctx.restore();
        element.dataset.frame = String(motion.frame);
        element.dataset.wave = p.greeting ? 'active' : 'rest';
        element.dataset.idleGesture = p.gesture ?? 'rest';
        if (events.waveDone) p.onWaveComplete();
        if (events.idleDone) p.onIdleComplete();
        request = requestAnimationFrame(draw);
      };
      draw(performance.now());
      setReady(true);
      latest.current.onReady();
    }).catch(() => { /* Keep the matching complete still image on load failure. */ });
    return () => { disposed = true; cancelAnimationFrame(request); };
  }, []);
  return <>
    <img className="emma-standing__poster" src={ROOT + 'poster.webp'} alt="" aria-hidden="true" hidden={ready} />
    <canvas ref={canvas} className="emma-standing__canvas" hidden={!ready} role="img"
      aria-label="Emma standing in her lavender sweatshirt, blue jeans and white tennis shoes" />
  </>;
}
