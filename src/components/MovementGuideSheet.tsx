import { useEffect, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { MovementActivity } from '../hooks/useMovement';

type GuideMove = {
  name: string;
  dose: string;
  setup: string;
  phases: [string, string, string];
  cue: string;
};

type ActivityGuide = {
  intro: string;
  plan: string;
  moves: GuideMove[];
};

const guides: Record<string, ActivityGuide> = {
  'low-walk': {
    intro: 'A relaxed walk is enough. Keep a pace that lets you talk comfortably.',
    plan: '10 minutes · easy pace',
    moves: [{ name: 'Comfortable walk', dose: 'Walk for 10 minutes', setup: 'Choose a level route and wear shoes that feel secure.', phases: ['Stand tall and look ahead.', 'Take short, easy steps. Let your arms swing naturally.', 'Slow down for the last minute and finish at a comfortable pace.'], cue: 'Keep your shoulders relaxed and let your heel roll gently toward your toes.' }],
  },
  'low-stretch': {
    intro: 'Move gently and stay in a comfortable range. These are easy holds, not a flexibility test.',
    plan: '5 minutes · hold each stretch for 15–20 seconds',
    moves: [
      { name: 'Seated hamstring stretch', dose: '15–20 seconds per side', setup: 'Sit near the front of a sturdy chair. Extend one leg with the heel down and toes up.', phases: ['Sit tall with one leg extended.', 'Hinge forward slightly from your hips.', 'Stop at a gentle stretch, then sit upright and switch sides.'], cue: 'Keep your back long; do not bounce or pull on your knee.' },
      { name: 'Chest opener', dose: '15–20 seconds', setup: 'Stand or sit tall. Bring your arms out comfortably to the sides.', phases: ['Let your shoulders rest down.', 'Gently draw your shoulder blades toward each other.', 'Breathe slowly, then release without forcing your arms back.'], cue: 'Keep your ribs relaxed and stop if you feel pinching.' },
    ],
  },
  'low-mobility': {
    intro: 'Small, controlled movements help you loosen up. Use a chair or wall for balance if needed.',
    plan: '10 minutes · move slowly and comfortably',
    moves: [
      { name: 'Chair-supported hip hinge', dose: '6 slow repetitions', setup: 'Stand behind a sturdy chair with hands resting lightly on it.', phases: ['Stand with feet about hip-width apart.', 'Send your hips gently back while keeping your back long.', 'Press through your feet to return to standing.'], cue: 'The movement comes from your hips; keep your knees soft.' },
      { name: 'Ankle rocks', dose: '8 repetitions per side', setup: 'Stand facing a wall or chair for support.', phases: ['Place one foot slightly in front.', 'Shift your knee forward over your toes while keeping the heel down.', 'Return to the start and repeat, then switch sides.'], cue: 'Keep the motion small enough that your heel stays grounded.' },
      { name: 'Shoulder circles', dose: '6 circles each direction', setup: 'Sit or stand comfortably with arms relaxed.', phases: ['Lift your shoulders gently toward your ears.', 'Roll them back and down in a smooth circle.', 'Reverse direction and keep your neck relaxed.'], cue: 'Make slow, comfortable circles rather than forcing a large range.' },
    ],
  },
  'mod-bodyweight': {
    intro: 'A short full-body circuit using a chair, wall, or floor. Rest whenever you need.',
    plan: 'About 20 minutes · 2–3 rounds at a comfortable pace',
    moves: [
      { name: 'Chair squat', dose: '8–10 repetitions', setup: 'Place a sturdy chair behind you. Stand with feet about shoulder-width apart.', phases: ['Stand tall with weight balanced across both feet.', 'Send hips back and bend knees to tap the chair lightly.', 'Press through your whole foot to stand tall again.'], cue: 'Keep knees pointing the same direction as your toes; use the chair for support.' },
      { name: 'Wall push-up', dose: '8–10 repetitions', setup: 'Face a wall. Place hands at chest height, a little wider than your shoulders.', phases: ['Step back until your body forms a straight line.', 'Bend elbows and bring your chest toward the wall.', 'Press the wall away and return to the start.'], cue: 'Keep your body in one line and elbows angled slightly back.' },
      { name: 'Glute bridge', dose: '8–12 repetitions', setup: 'Lie on your back with knees bent and feet flat, about hip-width apart.', phases: ['Rest with your lower back comfortable and arms by your sides.', 'Press through your feet and lift your hips until your body makes a gentle slope.', 'Lower your hips slowly to the floor.'], cue: 'Lift only as high as feels comfortable; avoid arching your lower back.' },
    ],
  },
  'mod-bands': {
    intro: 'Use a light resistance band and check it for damage first. Keep every repetition controlled.',
    plan: 'About 15 minutes · 2 rounds, 8–12 repetitions each',
    moves: [
      { name: 'Seated band row', dose: '8–12 repetitions', setup: 'Sit tall with the band looped around your feet. Hold an end in each hand.', phases: ['Start with arms long and shoulders relaxed.', 'Pull elbows back close to your sides.', 'Slowly reach forward again without rounding your back.'], cue: 'Use light tension and keep the band away from your face.' },
      { name: 'Band side steps', dose: '8 steps each direction', setup: 'Place a light loop above your knees or around your ankles. Stand near a support.', phases: ['Stand with knees softly bent and feet hip-width apart.', 'Step sideways while keeping gentle tension in the band.', 'Bring the other foot in slowly; repeat and switch directions.'], cue: 'Keep toes facing forward and avoid letting knees collapse inward.' },
      { name: 'Standing band press', dose: '8–10 repetitions', setup: 'Place the band behind your upper back and hold the ends at chest height.', phases: ['Stand tall with a soft bend in your knees.', 'Press hands forward until arms are comfortably extended.', 'Bring hands back slowly to chest height.'], cue: 'Keep the band behind your body and shoulders down.' },
    ],
  },
  'mod-fastwalk': {
    intro: 'Build a little pace without rushing. You should still be able to speak in short sentences.',
    plan: '20 minutes · alternate easy and brisk walking',
    moves: [{ name: 'Easy–brisk walk', dose: 'Repeat 4 times', setup: 'Choose a clear, level route and begin with an easy pace.', phases: ['Walk easily for 2 minutes to warm up.', 'Walk briskly for 2 minutes using shorter, quicker steps.', 'Return to an easy pace for 1 minute before the next round.'], cue: 'Stay tall, swing your arms naturally, and ease off if you feel unsteady.' }],
  },
  'high-strength': {
    intro: 'A simple strength circuit. Choose the easier option or stop a set while your form still feels steady.',
    plan: 'About 45 minutes · 3 rounds with 60–90 seconds of rest',
    moves: [
      { name: 'Chair squat', dose: '10–12 repetitions', setup: 'Place a sturdy chair behind you and stand with feet about shoulder-width apart.', phases: ['Stand tall and brace gently through your middle.', 'Send hips back and tap the chair with control.', 'Press through your whole foot to stand.'], cue: 'Keep knees aligned with toes; hold a counter if you want extra support.' },
      { name: 'Supported split squat', dose: '8 repetitions per side', setup: 'Stand beside a wall or chair. Step one foot back into a comfortable split stance.', phases: ['Hold the support lightly and stand tall.', 'Bend both knees a small amount, keeping your torso upright.', 'Press through the front foot to return; switch sides.'], cue: 'Use a short range and keep most of your weight through the front foot.' },
      { name: 'Incline push-up', dose: '8–12 repetitions', setup: 'Use a stable counter or wall. Place hands slightly wider than shoulders.', phases: ['Make a straight line from head to heels.', 'Bend elbows and bring your chest toward the surface.', 'Press away and return to the straight starting position.'], cue: 'Only use a surface that will not slide or tip.' },
      { name: 'Glute bridge', dose: '10–12 repetitions', setup: 'Lie on your back with knees bent and feet flat.', phases: ['Set your feet about hip-width apart.', 'Press through your feet and lift hips comfortably.', 'Lower slowly and reset before the next repetition.'], cue: 'Keep ribs relaxed and avoid arching your back.' },
    ],
  },
  'high-cardio': {
    intro: 'Pick the low-impact version if jumping does not feel good. Take breaks and keep water nearby.',
    plan: 'About 30 minutes · 3 rounds, 30 seconds each move, rest as needed',
    moves: [
      { name: 'March in place', dose: '30 seconds', setup: 'Stand tall near a chair or wall for balance.', phases: ['Start with feet under your hips.', 'Lift one knee comfortably while the opposite arm swings.', 'Set the foot down softly and alternate sides.'], cue: 'Choose a knee height that feels steady; marching in place is enough.' },
      { name: 'Step jack', dose: '30 seconds', setup: 'Stand with feet together and arms by your sides.', phases: ['Step one foot out while lifting arms only as high as comfortable.', 'Step the foot back in and lower arms.', 'Repeat to the other side at a steady pace.'], cue: 'Keep it low impact: step side to side instead of jumping.' },
      { name: 'Shadow boxing', dose: '30 seconds', setup: 'Stand with feet staggered and hands up near chest height.', phases: ['Keep a soft bend in your knees and elbows.', 'Reach one hand forward gently, then bring it back.', 'Alternate hands while turning your body only a little.'], cue: 'Do not lock your elbows or swing with force.' },
    ],
  },
  'high-full': {
    intro: 'A balanced starter session with strength and a short cardio finisher. Rest between moves as needed.',
    plan: 'About 60 minutes · warm up, 3 rounds, then cool down',
    moves: [
      { name: 'Chair squat', dose: '10 repetitions', setup: 'Place a sturdy chair behind you. Stand with feet about shoulder-width apart.', phases: ['Stand tall with weight even through your feet.', 'Send hips back and lightly tap the chair.', 'Press through your feet and return to standing.'], cue: 'Keep knees tracking with toes and use support if needed.' },
      { name: 'Wall push-up', dose: '10 repetitions', setup: 'Face a wall with hands at chest height.', phases: ['Step back and make a straight line through your body.', 'Bend elbows to bring your chest toward the wall.', 'Press away and return to the start.'], cue: 'Keep your body straight; move closer to the wall to make it easier.' },
      { name: 'Glute bridge', dose: '12 repetitions', setup: 'Lie on your back with knees bent and feet flat.', phases: ['Set your arms by your sides and relax your shoulders.', 'Press through your feet and lift hips gently.', 'Lower slowly, keeping the movement comfortable.'], cue: 'Stop before your back starts to arch.' },
      { name: 'Easy march', dose: '2 minutes', setup: 'Stand near support and begin at an easy pace.', phases: ['Start with relaxed shoulders and feet under hips.', 'Alternate lifting your feet with a gentle arm swing.', 'Slow your steps and take a few steady breaths.'], cue: 'Keep the pace comfortable and stop if you feel dizzy or unwell.' },
    ],
  },
};

const phaseLabels = ['Set up', 'Move', 'Finish'] as const;

export default function MovementGuideSheet({
  activity,
  onClose,
}: {
  activity: MovementActivity;
  onClose: () => void;
}) {
  const guide = guides[activity.id];
  const [moveIndex, setMoveIndex] = useState(0);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const move = guide?.moves[moveIndex];

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!guide || !move) return null;

  function selectMove(index: number) {
    setMoveIndex(index);
    setPhaseIndex(0);
  }

  function moveNext() {
    if (phaseIndex < 2) {
      setPhaseIndex((phase) => phase + 1);
    } else if (moveIndex < guide.moves.length - 1) {
      selectMove(moveIndex + 1);
    }
  }

  function moveBack() {
    if (phaseIndex > 0) {
      setPhaseIndex((phase) => phase - 1);
    } else if (moveIndex > 0) {
      selectMove(moveIndex - 1);
      setPhaseIndex(2);
    }
  }

  const isLast = moveIndex === guide.moves.length - 1 && phaseIndex === 2;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/40 p-0 sm:items-center sm:p-5"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="movement-guide-title"
        className="flex max-h-[92dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl"
      >
        <header className="flex items-start gap-3 border-b border-rose-100 bg-gradient-to-r from-rose-50 to-amber-50 px-5 pb-4 pt-5">
          <img src="/characters/emma.webp" alt="" className="h-12 w-12 shrink-0 rounded-2xl object-cover" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-rose-500">Emma's form guide</p>
            <h2 id="movement-guide-title" className="mt-0.5 text-lg font-bold leading-tight text-slate-800">{activity.label}</h2>
            <p className="mt-1 text-xs text-slate-500">{guide.plan}</p>
          </div>
          <button onClick={onClose} aria-label="Close form guide" className="rounded-full p-2 text-slate-400 hover:bg-white hover:text-slate-700">
            <X size={19} />
          </button>
        </header>

        <div className="overflow-y-auto px-5 py-4">
          <p className="text-sm leading-relaxed text-slate-600">{guide.intro}</p>

          {guide.moves.length > 1 && (
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="Choose a movement">
              {guide.moves.map((item, index) => (
                <button
                  key={item.name}
                  onClick={() => selectMove(index)}
                  aria-pressed={moveIndex === index}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${moveIndex === index ? 'border-rose-300 bg-rose-100 text-rose-800' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'}`}
                >
                  {index + 1}. {item.name}
                </button>
              ))}
            </div>
          )}

          <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Move {moveIndex + 1} of {guide.moves.length}</p>
                <h3 className="mt-1 text-base font-bold text-slate-800">{move.name}</h3>
                <p className="mt-1 text-xs font-semibold text-rose-600">{move.dose}</p>
              </div>
              <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-slate-500">Step {phaseIndex + 1} of 3</span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {phaseLabels.map((label, index) => (
                <div key={label} className={`rounded-xl border p-2.5 transition-colors ${phaseIndex === index ? 'border-rose-200 bg-white shadow-sm' : 'border-transparent bg-white/60'}`}>
                  <div className={`mb-2 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${phaseIndex === index ? 'bg-rose-500 text-white' : index < phaseIndex ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'}`}>
                    {index < phaseIndex ? <Check size={14} /> : index + 1}
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-700">{move.phases[index]}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">Form cue</p>
              <p className="mt-0.5 text-xs leading-relaxed text-amber-800">{move.cue}</p>
            </div>
          </div>

          <div className="mt-4 rounded-xl bg-rose-50 px-3.5 py-3">
            <p className="text-xs leading-relaxed text-rose-800"><span className="font-bold">Start here:</span> {move.setup}</p>
          </div>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-slate-100 bg-white px-5 py-4">
          <button onClick={moveBack} disabled={moveIndex === 0 && phaseIndex === 0} className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
            <ChevronLeft size={17} /> Back
          </button>
          <button onClick={isLast ? onClose : moveNext} className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-rose-600 active:scale-[0.98]">
            {isLast ? 'Done' : phaseIndex === 2 ? 'Next movement' : 'Next step'}
            {!isLast && <ChevronRight size={16} />}
          </button>
        </footer>
      </section>
    </div>
  );
}
