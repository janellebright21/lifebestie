import {getEmmaPortrait,subscribeEmmaPortrait} from './emmaPortraitCache';
import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from 'react';
import type { AvatarExpression } from '../../lib/supabase';
import type { EmmaActivity } from './emmaMasterController';
import { loadEmmaModel, resetEmmaModelProbe, type EmmaModelProbe } from '../../lib/emmaModelAsset';
import { resolveExpressionSrc, getDefaultSrc } from '../../lib/characterAssets';
import './EmmaFullBodyAvatar.css';

const ModelViewer = lazy(() => import('./EmmaModelViewer'));

// Activates automatically when public/characters/emma/Emma-Master.glb is
// deployed; only a neutral placeholder or current-master portrait is shown while loading.
const DEV = import.meta.env.DEV;
function statusText(probe: EmmaModelProbe, loadError: string | undefined, ready: boolean): string {
  if (ready) return '3D loaded';
  if (probe.state === 'probing') return 'probing for 3D model…';
  if (probe.state === 'unavailable') return `probe failed: ${probe.reason}`;
  if (loadError) return `loader error: ${loadError}`;
  return 'loading GLB…';
}
export default function EmmaFullBodyAvatar({ expression = 'happy', activity = 'idle', greetOnArrival = false, framing = 'full' }: { expression?: AvatarExpression; activity?: EmmaActivity; greetOnArrival?: boolean; framing?: 'full' | 'portrait' }) {
  const poster=useSyncExternalStore(subscribeEmmaPortrait,getEmmaPortrait,getEmmaPortrait);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loadError, setLoadError] = useState<string | undefined>(undefined);
  const [wave, setWave] = useState(0);
  const [probeResult, setProbeResult] = useState<EmmaModelProbe>({ state: 'probing' });
  useEffect(() => {
    let active = true, retry: number | undefined;
    const run = () => loadEmmaModel().then(result => {
      if (!active) return;
      setProbeResult(result);
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
    {probeResult.state === 'ready' && !failed && <Suspense fallback={null}><div className={ready?"emma-model-layer is-ready":"emma-model-layer"}><ModelViewer modelSrc={probeResult.url} waveRequest={wave} expression={expression} activity={activity} greetOnArrival={greetOnArrival} framing={framing} onReady={() => setReady(true)} onFailure={message => { setReady(false); setFailed(true); setLoadError(message); }} /></div></Suspense>}
    {ready && framing === 'full' && <button className="emma-full-body__interaction" type="button" aria-label="Say hi to Emma" title="Tap Emma for a wave" onClick={() => setWave(n => n + 1)} />}
    {DEV && !ready && <div style={{ position: 'absolute', left: 0, right: 0, bottom: -20, fontSize: 10, lineHeight: 1.3, textAlign: 'center', color: '#6b7280', pointerEvents: 'none', zIndex: 5 }}>
      {statusText(probeResult, loadError, ready)}
    </div>}
  </div>;
}
