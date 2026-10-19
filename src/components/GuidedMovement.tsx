import { useState } from 'react';
import StickFigureDemo, { type Motion } from './StickFigureDemo';

// Only show a motion where the current illustration represents the named step.
// Other steps show written guidance until purpose-built animation frames exist.
const STEP_MOTIONS: Record<string, (Motion | null)[]> = {
  'low-walk': [null, 'walk', 'walk'],
  'low-stretch': [null, 'reach', null],
  'low-mobility': [null, null, null],
  'mod-bodyweight': ['march', null, 'push', null],
  'mod-bands': [null, 'row', null],
  'mod-fastwalk': ['walk', 'walk', 'walk'],
  'high-strength': ['march', null, null, null],
  'high-cardio': ['walk', 'walk', 'walk', 'walk'],
  'high-full': ['walk', null, null, 'reach'],
};
import { ArrowLeft, ArrowRight, X, CheckCircle2 } from 'lucide-react';
import type { MovementActivity } from '../hooks/useMovement';

const GUIDES: Record<string, { title: string; instruction: string }[]> = {
  'low-walk': [
    { title: 'Get comfortable', instruction: 'Wear supportive shoes and start at an easy pace.' },
    { title: 'Find your rhythm', instruction: 'Walk with relaxed shoulders and take comfortable steps.' },
    { title: 'Cool down', instruction: 'Slow your pace for the last minute. Pause if you feel dizzy or unwell.' },
  ],
  'low-stretch': [
    { title: 'Shoulder rolls', instruction: 'Slowly roll your shoulders back five times, then forward five times.' },
    { title: 'Side reaches', instruction: 'Reach one arm overhead and gently lean away. Hold briefly, then switch sides.' },
    { title: 'Calf stretch', instruction: 'Place one foot behind you and keep its heel down as you gently bend the front knee. Switch sides.' },
  ],
  'low-mobility': [
    { title: 'Neck and shoulders', instruction: 'Slowly turn your head left and right, then roll your shoulders.' },
    { title: 'Hip circles', instruction: 'Stand with a hand on a sturdy support and make small, comfortable hip circles.' },
    { title: 'Ankle mobility', instruction: 'Lift one heel and slowly circle your ankle. Switch sides.' },
  ],
  'mod-bodyweight': [
    { title: 'Warm up', instruction: 'March in place and gently move your arms for a few minutes.' },
    { title: 'Chair squats', instruction: 'Stand in front of a stable chair, sit back until you touch the seat, then stand. Keep the movement controlled.' },
    { title: 'Wall push-ups', instruction: 'Place your hands on a wall, bend your elbows to bring your chest toward it, then push away.' },
    { title: 'Repeat gently', instruction: 'Alternate comfortable sets of chair squats and wall push-ups. Take breaks as needed.' },
  ],
  'mod-bands': [
    { title: 'Check your band', instruction: 'Inspect the resistance band for tears and choose light resistance.' },
    { title: 'Seated band row', instruction: 'With a securely positioned band, pull elbows back slowly and release with control. Never aim a stretched band toward your face.' },
    { title: 'Band pull-aparts', instruction: 'Hold the band at chest height and gently pull hands apart, keeping shoulders relaxed.' },
  ],
  'mod-fastwalk': [
    { title: 'Easy start', instruction: 'Walk at a comfortable pace for the first few minutes.' },
    { title: 'Pick up the pace', instruction: 'Walk briskly enough to breathe a little harder while still being able to talk.' },
    { title: 'Cool down', instruction: 'Return to an easy pace for the final few minutes.' },
  ],
  'high-strength': [
    { title: 'Warm up', instruction: 'Start with gentle marching, arm circles, and easy squats.' },
    { title: 'Lower body', instruction: 'Perform controlled squats or supported sit-to-stands using a comfortable range.' },
    { title: 'Upper body', instruction: 'Try wall push-ups or another suitable push movement, then a light pulling movement.' },
    { title: 'Rest and repeat', instruction: 'Rest between sets, repeat only while your technique remains comfortable, and cool down.' },
  ],
  'high-cardio': [
    { title: 'Warm up', instruction: 'Begin with easy walking or marching.' },
    { title: 'Build gradually', instruction: 'Increase your pace to a challenging but manageable level, then ease back to recover.' },
    { title: 'Intervals', instruction: 'Repeat the faster and slower portions as your energy allows, without pushing through pain.' },
    { title: 'Cool down', instruction: 'Slow down for several minutes before stopping.' },
  ],
  'high-full': [
    { title: 'Warm up', instruction: 'Start with easy walking and joint mobility.' },
    { title: 'Strength portion', instruction: 'Alternate a comfortable squat, push, and pull movement, resting between sets.' },
    { title: 'Cardio portion', instruction: 'Choose walking, cycling, or another accessible cardio activity.' },
    { title: 'Cool down', instruction: 'Finish with a slower pace and gentle stretching.' },
  ],
};

export default function GuidedMovement({ activity, onClose, onFinish }: {
  activity: MovementActivity;
  onClose: () => void;
  onFinish: () => void;
}) {
  const [step, setStep] = useState(0);
  const steps = GUIDES[activity.id] ?? [];
  const current = steps[step];
  const stepMotion = STEP_MOTIONS[activity.id]?.[step] ?? null;
  if (!current) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label={`Guided ${activity.label}`} className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-3">
      <div className="bg-white rounded-3xl w-full max-w-md p-5 space-y-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-xs font-semibold text-rose-500">Guided movement · {activity.duration}</p>
            <h2 className="text-lg font-bold text-gray-800 mt-1">{activity.label}</h2></div>
          <button type="button" onClick={onClose} aria-label="Close guide" className="rounded-full p-2 bg-gray-100 text-gray-600"><X size={18}/></button>
        </div>
        <div className="flex gap-1.5" aria-label={`Step ${step + 1} of ${steps.length}`}>
          {steps.map((_, i) => <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-rose-400' : 'bg-gray-200'}`}/>)}
        </div>
        <div className="rounded-2xl bg-rose-50 px-5 py-7 min-h-44">
          <p className="text-xs font-bold text-rose-500 mb-2">STEP {step + 1} OF {steps.length}</p>
          <h3 className="font-bold text-gray-800 text-xl">{current.title}</h3>
          <p className="text-sm text-gray-700 leading-relaxed mt-3">{current.instruction}</p>
        </div>
        {stepMotion ? <StickFigureDemo key={`${activity.id}-${step}`} activity={activity} motion={stepMotion} caption={current.title} /> : (
          <div className="rounded-2xl border border-gray-200 bg-slate-50 px-4 py-5 text-center text-xs text-slate-600">
            A matching movement demonstration is still being developed for this step. Please use the written instructions above.
          </div>
        )}
        <p className="text-xs text-gray-500">Move at your own pace. Stop if anything hurts, or if you feel faint or unwell. These are general instructions, not a live form check.</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0} className="px-4 py-3 rounded-xl border text-sm font-semibold disabled:opacity-40 flex items-center gap-1"><ArrowLeft size={15}/> Back</button>
          {step < steps.length - 1
            ? <button type="button" onClick={() => setStep(s => s + 1)} className="flex-1 rounded-xl bg-rose-500 text-white font-semibold flex justify-center items-center gap-2">Next <ArrowRight size={16}/></button>
            : <button type="button" onClick={onFinish} className="flex-1 rounded-xl bg-emerald-600 text-white font-semibold flex justify-center items-center gap-2"><CheckCircle2 size={16}/> Finish guide</button>}
        </div>
      </div>
    </div>
  );
}
