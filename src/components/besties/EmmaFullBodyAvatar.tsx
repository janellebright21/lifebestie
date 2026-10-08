import { lazy, Suspense, useState } from 'react';
import type { AvatarExpression } from '../../lib/supabase';
import './EmmaFullBodyAvatar.css';
import EmmaFullBodyIllustration from './EmmaFullBodyIllustration';
const ModelViewer = lazy(() => import('./EmmaModelViewer'));
export const EMMA_FULL_BODY_REFERENCE = '/assets/emma/design/emma-full-body-approved.png';
// Set this only when the approved, rigged GLB has been built and checked.
export const EMMA_MODEL_SRC: string | undefined = undefined;
export default function EmmaFullBodyAvatar({ expression = 'happy', modelSrc = EMMA_MODEL_SRC, greetOnArrival = false }: { expression?: AvatarExpression; modelSrc?: string; greetOnArrival?: boolean }) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [wave, setWave] = useState(0);
  return <div className="emma-full-body">
    {!ready && <EmmaFullBodyIllustration expression={expression} greetOnArrival={greetOnArrival} />}
    {modelSrc && !failed && <Suspense fallback={null}><ModelViewer modelSrc={modelSrc} waveRequest={wave} expression={expression} onReady={() => setReady(true)} onFailure={() => { setReady(false); setFailed(true); }} /></Suspense>}
    {ready && <button className="emma-full-body__interaction" type="button" aria-label="Say hi to Emma" title="Tap Emma for a wave" onClick={() => setWave(n => n + 1)} />}
  </div>;
}
