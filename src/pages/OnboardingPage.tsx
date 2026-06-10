import { useState, useEffect, useRef } from 'react';
import { ChevronRight, Check } from 'lucide-react';
import { HouseholdType, WorkSchedule, Chronotype, MainGoal } from '../lib/supabase';
import LifeBestieAvatar from '../components/LifeBestieAvatar';

interface OnboardingPageProps {
  onComplete: (data: {
    preferred_name: string;
    household_type: HouseholdType;
    work_schedule: WorkSchedule;
    chronotype: Chronotype;
    main_goals: MainGoal[];
    biggest_challenge: string;
  }) => Promise<void>;
}

// ─── Step definitions ─────────────────────────────────────────────────────────

type StepId = 'name' | 'household' | 'work' | 'chronotype' | 'goals' | 'challenge';

interface StepBase {
  id: StepId;
  question: (name: string) => string;
}

interface TextStep extends StepBase { type: 'text'; placeholder: string; }
interface ChoiceStep extends StepBase { type: 'choice'; options: { value: string; label: string; emoji: string }[]; }
interface MultiStep extends StepBase { type: 'multi'; options: { value: string; label: string; emoji: string }[]; min: number; }

type Step = TextStep | ChoiceStep | MultiStep;

const STEPS: Step[] = [
  {
    id: 'name',
    type: 'text',
    question: () => "Hi! I'm LifeBestie 💛 I'm here to help make your day a little easier. What should I call you?",
    placeholder: 'Your name or nickname…',
  },
  {
    id: 'household',
    type: 'choice',
    question: (name) => `Love that, ${name}! Who's in your household?`,
    options: [
      { value: 'solo',        label: 'Just me',              emoji: '🙋' },
      { value: 'couple',      label: 'Me + partner',         emoji: '💑' },
      { value: 'family_kids', label: 'Family with young kids', emoji: '👶' },
      { value: 'family_teens',label: 'Family with teens',    emoji: '🧑' },
      { value: 'multi_gen',   label: 'Multi-generational',   emoji: '👨‍👩‍👧‍👦' },
      { value: 'other',       label: 'Other',                emoji: '🏠' },
    ],
  },
  {
    id: 'work',
    type: 'choice',
    question: () => 'Got it! How would you describe your work schedule?',
    options: [
      { value: 'full_time',      label: 'Full-time office',    emoji: '🏢' },
      { value: 'work_from_home', label: 'Work from home',      emoji: '💻' },
      { value: 'part_time',      label: 'Part-time',           emoji: '⏰' },
      { value: 'stay_home',      label: 'Stay at home',        emoji: '🏡' },
      { value: 'shift_work',     label: 'Shift work',          emoji: '🔄' },
      { value: 'flexible',       label: 'Flexible / freelance', emoji: '🎯' },
    ],
  },
  {
    id: 'chronotype',
    type: 'choice',
    question: () => 'Are you more of a morning person or a night owl?',
    options: [
      { value: 'morning', label: 'Morning person', emoji: '🌅' },
      { value: 'evening', label: 'Night owl',      emoji: '🌙' },
      { value: 'neither', label: 'Somewhere in between', emoji: '☁️' },
    ],
  },
  {
    id: 'goals',
    type: 'multi',
    min: 1,
    question: () => 'What are your main goals right now? Pick all that apply.',
    options: [
      { value: 'stay_organized',  label: 'Stay organized',    emoji: '📋' },
      { value: 'reduce_stress',   label: 'Reduce stress',     emoji: '🧘' },
      { value: 'save_money',      label: 'Save money',        emoji: '💰' },
      { value: 'eat_healthier',   label: 'Eat healthier',     emoji: '🥗' },
      { value: 'more_family_time',label: 'More family time',  emoji: '❤️' },
      { value: 'better_routines', label: 'Better routines',   emoji: '✅' },
      { value: 'fitness',         label: 'Move more',         emoji: '💪' },
    ],
  },
  {
    id: 'challenge',
    type: 'text',
    question: () => "Almost there! What's your biggest day-to-day challenge? (In your own words)",
    placeholder: 'e.g. Keeping up with everything, never having time for myself…',
  },
];

// ─── Message bubble ───────────────────────────────────────────────────────────

function BotBubble({ text, visible }: { text: string; visible: boolean }) {
  return (
    <div className={`flex items-end gap-2 transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
      <LifeBestieAvatar size="sm" />
      <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm border border-gray-100 max-w-[85%]">
        <p className="text-sm text-gray-700 leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="bg-rose-400 rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[80%]">
        <p className="text-sm text-white font-medium">{text}</p>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OnboardingPage({ onComplete }: OnboardingPageProps) {
  const [stepIdx, setStepIdx] = useState(0);
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [answers, setAnswers] = useState<Record<StepId, string | string[]>>({
    name: '', household: '', work: '', chronotype: '', goals: [], challenge: '',
  });
  const [textInput, setTextInput] = useState('');
  const [multiSelected, setMultiSelected] = useState<string[]>([]);
  const [history, setHistory] = useState<{ bot: string; user?: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const step = STEPS[stepIdx]!;
  const name = (answers.name as string) || 'friend';

  // Show question bubble with slight delay
  useEffect(() => {
    setBubbleVisible(false);
    const t = setTimeout(() => setBubbleVisible(true), 150);
    return () => clearTimeout(t);
  }, [stepIdx]);

  // Scroll to bottom when history changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, bubbleVisible]);

  function submitText() {
    const val = textInput.trim();
    if (!val) return;
    advance(val, val);
  }

  function submitChoice(value: string, label: string) {
    advance(value, label);
  }

  function toggleMulti(value: string) {
    setMultiSelected((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  }

  function submitMulti() {
    const step = STEPS[stepIdx] as MultiStep;
    if (multiSelected.length < step.min) return;
    const labels = step.options
      .filter((o) => multiSelected.includes(o.value))
      .map((o) => `${o.emoji} ${o.label}`)
      .join(', ');
    advance(multiSelected, labels);
  }

  async function advance(value: string | string[], displayLabel: string) {
    const newAnswers = { ...answers, [step.id]: value };
    setAnswers(newAnswers);

    // Push current question + user answer to history
    setHistory((prev) => [...prev, { bot: step.question(name), user: displayLabel }]);
    setTextInput('');
    setMultiSelected([]);
    setBubbleVisible(false);

    if (stepIdx < STEPS.length - 1) {
      setStepIdx(stepIdx + 1);
    } else {
      // Onboarding complete
      setSaving(true);
      await onComplete({
        preferred_name: newAnswers.name as string,
        household_type: newAnswers.household as HouseholdType,
        work_schedule: newAnswers.work as WorkSchedule,
        chronotype: newAnswers.chronotype as Chronotype,
        main_goals: newAnswers.goals as MainGoal[],
        biggest_challenge: newAnswers.challenge as string,
      });
    }
  }

  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4 shrink-0">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <LifeBestieAvatar size="md" pulse />
          <div>
            <h1 className="text-base font-bold text-gray-800 leading-none">LifeBestie</h1>
            <p className="text-xs text-gray-400 mt-0.5">Let's get to know each other</p>
          </div>
          {/* Step dots */}
          <div className="ml-auto flex items-center gap-1">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`rounded-full transition-all duration-300 ${
                  i < stepIdx ? 'w-1.5 h-1.5 bg-rose-300' :
                  i === stepIdx ? 'w-3 h-1.5 bg-rose-400' :
                  'w-1.5 h-1.5 bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 max-w-md mx-auto w-full">
        {/* Historical exchanges */}
        {history.map((item, i) => (
          <div key={i} className="space-y-3">
            <BotBubble text={item.bot} visible />
            {item.user && <UserBubble text={item.user} />}
          </div>
        ))}

        {/* Current question */}
        {!saving && (
          <BotBubble text={step.question(name)} visible={bubbleVisible} />
        )}

        {saving && (
          <div className="flex items-end gap-2">
            <LifeBestieAvatar size="sm" pulse />
            <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm border border-gray-100">
              <div className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-rose-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-rose-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-rose-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      {!saving && (
        <div className="bg-white border-t border-gray-100 px-4 py-4 shrink-0">
          <div className="max-w-md mx-auto">

            {step.type === 'text' && (
              <div className="flex gap-2">
                <input
                  autoFocus
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitText()}
                  placeholder={step.placeholder}
                  className="flex-1 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-rose-200"
                />
                <button
                  onClick={submitText}
                  disabled={!textInput.trim()}
                  className="w-11 h-11 rounded-full bg-rose-400 flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform shadow-sm shadow-rose-100"
                >
                  <ChevronRight size={18} className="text-white" />
                </button>
              </div>
            )}

            {step.type === 'choice' && (
              <div className="grid grid-cols-2 gap-2">
                {step.options.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => submitChoice(opt.value, `${opt.emoji} ${opt.label}`)}
                    className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-2xl px-3 py-3 text-left active:scale-95 transition-all hover:border-rose-200 hover:bg-rose-50"
                  >
                    <span className="text-base leading-none shrink-0">{opt.emoji}</span>
                    <span className="text-xs font-semibold text-gray-700 leading-tight">{opt.label}</span>
                  </button>
                ))}
              </div>
            )}

            {step.type === 'multi' && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {step.options.map((opt) => {
                    const selected = multiSelected.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        onClick={() => toggleMulti(opt.value)}
                        className={`flex items-center gap-2 border rounded-2xl px-3 py-3 text-left active:scale-95 transition-all ${
                          selected
                            ? 'bg-rose-50 border-rose-300'
                            : 'bg-gray-50 border-gray-100 hover:border-rose-200 hover:bg-rose-50'
                        }`}
                      >
                        <span className="text-base leading-none shrink-0">{opt.emoji}</span>
                        <span className={`text-xs font-semibold leading-tight flex-1 ${selected ? 'text-rose-700' : 'text-gray-700'}`}>
                          {opt.label}
                        </span>
                        {selected && <Check size={12} className="text-rose-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={submitMulti}
                  disabled={multiSelected.length < step.min}
                  className="w-full py-3 rounded-2xl bg-rose-400 text-white text-sm font-bold disabled:opacity-40 active:scale-95 transition-transform"
                >
                  {multiSelected.length === 0 ? 'Select at least one' : `Continue (${multiSelected.length} selected)`}
                </button>
              </div>
            )}

          </div>
        </div>
      )}
    </div>
  );
}
