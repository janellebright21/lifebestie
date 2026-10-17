import { lazy, Suspense, useEffect, useState } from 'react';
import type { AvatarExpression } from '../../lib/supabase';
import { loadEmmaModelSrc } from '../../lib/emmaModelAsset';
import './EmmaFullBodyAvatar.css';
import EmmaFullBodyIllustration from './EmmaFullBodyIllustration';
const ModelViewer = lazy(() => import('./EmmaModelViewer'));
export const EMMA_FULL_BODY_REFERENCE = '/assets/emma/design/emma-full-body-approved.png';
// Activates automatically when public/characters/emma/Emma-App-v1.glb is
// deployed; the 2D artwork remains the fallback until the probe verifies it.
export default function EmmaFullBodyAvatar({ expression = 'happy', greetOnArrival = false }: { expression?: AvatarExpression; greetOnArrival?: boolean }) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [wave, setWave] = useState(0);
  const [modelSrc, setModelSrc] = useState<string | undefined>(undefined);
  useEffect(() => {
    let active = true;
    loadEmmaModelSrc().then(src => { if (active) setModelSrc(src); });
    return () => { active = false; };
  }, []);
  return <div className="emma-full-body">
    {!ready && <EmmaFullBodyIllustration expression={expression} greetOnArrival={greetOnArrival} />}
    {modelSrc && !failed && <Suspense fallback={null}><ModelViewer modelSrc={modelSrc} waveRequest={wave} expression={expression} onReady={() => setReady(true)} onFailure={() => { setReady(false); setFailed(true); }} /></Suspense>}
    {ready && <button className="emma-full-body__interaction" type="button" aria-label="Say hi to Emma" title="Tap Emma for a wave" onClick={() => setWave(n => n + 1)} />}
  </div>;
}
