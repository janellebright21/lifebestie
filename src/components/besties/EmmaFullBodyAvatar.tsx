import {getEmmaPortrait,subscribeEmmaPortrait} from './emmaPortraitCache';
import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from 'react';
import type { AvatarExpression } from '../../lib/supabase';
import type { EmmaActivity } from './emmaMasterController';
import { loadEmmaModel, resetEmmaModelProbe, type EmmaModelProbe } from '../../lib/emmaModelAsset';
import { resolveExpressionSrc, getDefaultSrc } from '../../lib/characterAssets';
import './EmmaFullBodyAvatar.css';

const ModelViewer = lazy(() => import('./EmmaModelViewer'));

// The 3D model replaces the 2D portrait once it probes and loads; the portrait stays as the fallback.
const DEV = import.meta.env.DEV;
export default function EmmaFullBodyAvatar({ expression = 'happy', activity = 'idle', greetOnArrival = false, framing = 'full', waveRequest, onWave }: { expression?: AvatarExpression; activity?: EmmaActivity; greetOnArrival?: boolean; framing?: 'full' | 'portrait'; waveRequest?: number; onWave?: () => void }) {
  const poster=useSyncExternalStore(subscribeEmmaPortrait,getEmmaPortrait,getEmmaPortrait);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [localWave, setLocalWave] = useState(0);
  const wave = waveRequest ?? localWave;
  const requestWave = onWave ?? (() => setLocalWave(n => n + 1));
  const [probeResult, setProbeResult] = useState<EmmaModelProbe>({ state: 'probing' });
  useEffect(() => {
    let active = true, retry: number | undefined;
    const run = () => loadEmmaModel().then(result => {
      if (!active) return;
      setProbeResult(result);
      if (DEV && result.state === 'unavailable') console.warn('[EmmaFullBodyAvatar] 3D model unavailable:', result.reason);
      // Dev only: a model added while the server runs should appear without a
      // full reload. Production resolves once and keeps the cached result.
      if (DEV && result.state === 'unavailable') retry = window.setTimeout(() => { resetEmmaModelProbe(); run(); }, 5000);
    });
    run();
    return () => { active = false; if (retry) window.clearTimeout(retry); };
  }, []);
  return <div className="emma-full-body">
    {!ready && framing === "portrait" && poster.src && <img src={poster.src} alt="" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"contain"}}/>}
    {!ready && !(framing === "portrait" && poster.src) && (probeResult.state === 'unavailable' || failed
      ? <img src={failed ? getDefaultSrc('emma') : resolveExpressionSrc('emma', expression)} alt="Emma" style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"contain",objectPosition:framing==='portrait'?'center 25%':'center bottom'}}/>
      : <div role="status" aria-label="Loading Emma" style={{position:"absolute",inset:0,borderRadius:"inherit",background:"var(--theme-primary-light,#f5f0fa)"}}/>)
    }
    {probeResult.state === 'ready' && !failed && <Suspense fallback={null}><div className={ready?"emma-model-layer is-ready":"emma-model-layer"}><ModelViewer modelSrc={probeResult.url} waveRequest={wave} expression={expression} activity={activity} greetOnArrival={greetOnArrival} framing={framing} onReady={() => setReady(true)} onFailure={message => { setReady(false); setFailed(true); if (DEV) console.warn('[EmmaFullBodyAvatar] 3D model failed:', message); }} /></div></Suspense>}
    {ready && <button className="emma-full-body__interaction" type="button" aria-label={framing === 'portrait' ? 'Wave hello to Emma' : 'Say hi to Emma'} title={framing === 'portrait' ? 'Wave hello' : 'Tap Emma for a wave'} onClick={requestWave} />}
  </div>;
}
