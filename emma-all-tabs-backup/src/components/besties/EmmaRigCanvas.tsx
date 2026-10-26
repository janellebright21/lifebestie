import { useEffect, useRef, useState } from 'react';
import { EmmaMotionClock, pose, type IdleGesture } from './emmaRigMotion';
import poster from './emmaRigPoster';

const ROOT = '/assets/emma/rig/mesh-v1/';
type Manifest = {
  width: number; height: number; fps: number; frameCount: number; durationMs: number;
  groundX: number; groundY: number; columns: number; framesPerAtlas: number;
  crop: { x: number; y: number; width: number; height: number }; atlases: string[];
};
type Assets = { manifest: Manifest; body: HTMLImageElement; blink: HTMLImageElement; atlases: HTMLImageElement[] };
let cachedAssets: Promise<Assets> | undefined;
async function image(source: string) {
  const result = new Image();
  result.src = source;
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
      // Bolt's GitHub import may omit binary files. The same lossless pixels
      // travel in a text bundle so previews and deployed builds use one source.
      const bundleResponse = await fetch(ROOT + 'images.json');
      if (!bundleResponse.ok) throw new Error('Emma artwork unavailable');
      const bundle: Record<string, string> = await bundleResponse.json();
      const artwork = (name: string) => {
        if (typeof bundle[name] !== 'string' || !bundle[name]) throw new Error('Incomplete Emma artwork');
        return image('data:image/webp;base64,' + bundle[name]);
      };
      const [body, blink, atlases] = await Promise.all([
        artwork('body.webp'), artwork('blink.webp'), Promise.all(manifest.atlases.map(artwork)),
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
      let lastSignature = '';
      const draw = (time: number) => {
        if (disposed) return;
        const p = latest.current;
        const events = clock.tick(time, p.moving && !p.reduced, p.greeting, p.gesture);
        const motion = pose(clock, p.greeting, p.gesture, p.reduced);
        // Skip the expensive redraw while time is frozen (paused/hidden/reduced)
        // and nothing visual changed; keep the RAF loop so state changes and
        // resumes are noticed immediately.
        const signature = `${motion.frame}|${motion.scaleX.toFixed(5)}|${motion.scaleY.toFixed(5)}`
          + `|${motion.skew.toFixed(5)}|${motion.tilt.toFixed(5)}|${motion.blink.toFixed(3)}`;
        const changed = signature !== lastSignature || events.waveDone || events.idleDone;
        if (changed) {
          lastSignature = signature;
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
        }
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
    <img className="emma-standing__poster" src={poster} alt="Emma standing in her lavender sweatshirt, blue jeans and white tennis shoes" hidden={ready} />
    <canvas ref={canvas} className="emma-standing__canvas" hidden={!ready} role="img"
      aria-label="Emma standing in her lavender sweatshirt, blue jeans and white tennis shoes" />
  </>;
}
