import { lazy, Suspense, useEffect, useState } from 'react';
import type { AvatarExpression } from '../../lib/supabase';
import type { EmmaActivity } from './emmaIdleMotion';
import { loadEmmaModel, resetEmmaModelProbe, type EmmaModelProbe } from '../../lib/emmaModelAsset';
import './EmmaFullBodyAvatar.css';
import EmmaFullBodyIllustration from './EmmaFullBodyIllustration';
const ModelViewer = lazy(() => import('./EmmaModelViewer'));
export const EMMA_FULL_BODY_REFERENCE = '/assets/emma/design/emma-full-body-approved.png';
// Activates automatically when public/characters/emma/Emma-App-v1.glb is
// deployed; the 2D artwork remains the fallback until the probe verifies it.
const DEV = import.meta.env.DEV;
function statusText(probe: EmmaModelProbe, loadError: string | undefined, ready: boolean): string {
  if (ready) return '3D loaded';
  if (probe.state === 'probing') return 'probing for 3D model…';
  if (probe.state === 'unavailable') return `probe failed: ${probe.reason}`;
  if (loadError) return `loader error: ${loadError}`;
  return 'loading GLB…';
}
export default function EmmaFullBodyAvatar({ expression = 'happy', activity = 'idle', greetOnArrival = false }: { expression?: AvatarExpression; activity?: EmmaActivity; greetOnArrival?: boolean }) {
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
    {!ready && <EmmaFullBodyIllustration expression={expression} greetOnArrival={greetOnArrival} />}
    {probeResult.state === 'ready' && !failed && <Suspense fallback={null}><ModelViewer modelSrc={probeResult.url} waveRequest={wave} expression={expression} activity={activity} onReady={() => setReady(true)} onFailure={message => { setReady(false); setFailed(true); setLoadError(message); }} /></Suspense>}
    {ready && <button className="emma-full-body__interaction" type="button" aria-label="Say hi to Emma" title="Tap Emma for a wave" onClick={() => setWave(n => n + 1)} />}
    {DEV && !ready && <div style={{ position: 'absolute', left: 0, right: 0, bottom: -20, fontSize: 10, lineHeight: 1.3, textAlign: 'center', color: '#6b7280', pointerEvents: 'none', zIndex: 5 }}>
      {statusText(probeResult, loadError, ready)}
    </div>}
  </div>;
}
