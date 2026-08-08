import type { ComponentProps } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import CoreHomePage from './HomePageCore';
import FirstUseGuideCard from '../components/FirstUseGuideCard';
import { CHARACTERS } from '../lib/supabase';
import type { TabName } from '../components/BottomNav';
import { resolveExpressionSrc, getDefaultSrc } from '../lib/characterAssets';
import { getHomeExpression } from '../lib/bestieExpression';
import { useEmmaContext } from '../hooks/useEmmaContext';
import { useMovement } from '../hooks/useMovement';
import { generateEmmaGreeting, getEmmaAction, type EmmaActionType } from '../lib/emmaGreeting';

type HomePageProps = ComponentProps<typeof CoreHomePage>;

function actionTab(type: EmmaActionType): TabName {
  switch (type) {
    case 'review_tasks':   return 'planner';
    case 'view_schedule':  return 'planner';
    case 'plan_meal':      return 'planner';
    case 'open_grocery':   return 'grocery';
    case 'view_movement':  return 'movement';
    case 'chat_with_emma': return 'chat';
  }
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function HomePage(props: HomePageProps) {
  const today = localDateKey(new Date());
  const pendingTasks = props.tasks.filter((task) => !task.completed);
  const hasOverdueTasks = pendingTasks.some((task) => task.due_date && task.due_date < today);
  const homeExpression = getHomeExpression(pendingTasks.length, hasOverdueTasks, false);
  const { todayMovements } = useMovement(props.events);

  const characterId = props.character ?? 'emma';
  const characterDef = CHARACTERS.find((character) => character.id === characterId) ?? CHARACTERS[0]!;

  const hasStartedUsingBestieLife =
    props.tasks.length > 0 ||
    props.events.length > 0 ||
    props.meals.length > 0 ||
    props.routineTemplates.length > 0 ||
    (props.groceryItems?.length ?? 0) > 0 ||
    (props.memoriesCount ?? 0) > 0;

  const showFirstUseGuide =
    (props.relationshipScore ?? 0) < 100 &&
    !hasStartedUsingBestieLife;

  const bestieContext = useEmmaContext({
    preferredName: props.preferredName,
    relationshipScore: props.relationshipScore ?? 0,
    tasks: props.tasks,
    events: props.events,
    meals: props.meals,
    groceryItems: props.groceryItems ?? [],
    movementPlanned: todayMovements.length > 0,
    firstVisitToday: showFirstUseGuide,
  });

  const greeting = generateEmmaGreeting(bestieContext);
  const action = getEmmaAction(bestieContext);

  let subtitle: string;
  if (showFirstUseGuide) {
    subtitle = `${characterDef.name} will help you build your day one small step at a time.`;
  } else if (props.bestieNotes && (props.memoriesCount ?? 0) >= 4 && props.bestieNotes.planning_struggle) {
    subtitle = `Remember: ${props.bestieNotes.planning_struggle.toLowerCase()} — I've got you.`;
  } else if (bestieContext.situation.hasNoPlans) {
    subtitle = 'Your day is open — choose what would make it feel easier.';
  } else if (bestieContext.situation.hasOverdue) {
    subtitle = 'We can sort what matters most without trying to do everything at once.';
  } else if (bestieContext.situation.hasCompletedTasks) {
    subtitle = 'You are making progress. Keep the next step small.';
  } else {
    subtitle = 'One thing at a time. Your Bestie is right here with you.';
  }

  return (
    <div className="bestie-home-shell">
      <div className="px-4 sm:px-6 pt-6 pb-2 w-full max-w-2xl mx-auto">
        <div className="flex items-center gap-3 sm:gap-6">
          <div
            className="relative shrink-0"
            style={{
              width: 'clamp(96px, 25vw, 160px)',
              height: 'clamp(96px, 25vw, 160px)',
            }}
          >
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: '-12%',
                borderRadius: '50%',
                background: 'radial-gradient(circle, var(--theme-primary-mid) 0%, var(--theme-primary-light) 48%, transparent 72%)',
                filter: 'blur(12px)',
                opacity: 0.7,
                zIndex: 0,
              }}
            />
            <Sparkles
              size={13}
              aria-hidden="true"
              className="hidden sm:block"
              style={{
                position: 'absolute',
                top: '2%',
                right: '0%',
                color: 'var(--theme-primary)',
                opacity: 0.55,
                zIndex: 2,
              }}
            />
            <img
              src={resolveExpressionSrc(characterId, homeExpression)}
              alt={`${characterDef.name} ${homeExpression}`}
              onError={(event) => {
                const target = event.currentTarget;
                const fallback = getDefaultSrc(characterId);
                if (!target.src.endsWith(fallback)) target.src = fallback;
              }}
              style={{
                position: 'relative',
                zIndex: 1,
                display: 'block',
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                objectPosition: 'center',
                userSelect: 'none',
                pointerEvents: 'none',
              }}
            />
          </div>

          <div className="flex-1 min-w-0 pt-1">
            <p
              className="text-xs font-medium uppercase tracking-widest mb-0.5"
              style={{ color: 'var(--theme-primary)' }}
            >
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 leading-tight">
              {greeting}
            </h1>
            <p className="text-sm text-gray-400 mt-1 leading-relaxed">
              {subtitle}
            </p>
            <button
              type="button"
              onClick={() => props.onTabChange(actionTab(action.type))}
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full text-white active:scale-95 transition-all"
              style={{ backgroundColor: 'var(--theme-primary)' }}
            >
              {action.label}
              <ArrowRight size={11} />
            </button>
          </div>
        </div>

        {showFirstUseGuide && (
          <div className="mt-5 animate-fade-in">
            <FirstUseGuideCard
              bestieName={characterDef.name}
              onTabChange={props.onTabChange}
            />
          </div>
        )}
      </div>

      <div className="bestie-home-core">
        <CoreHomePage {...props} />
      </div>

      <style>{`
        .bestie-home-core > div > div:first-child { display: none; }
        .bestie-home-core > div { padding-top: 0 !important; }
        .bestie-home-core > div > :nth-child(2) { margin-top: 0 !important; }
      `}</style>
    </div>
  );
}
