import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, dbError } from '../lib/supabase';

// ─── Level definitions ─────────────────────────────────────────────────────────

interface LevelDef {
  level: 1 | 2 | 3 | 4 | 5;
  label: string;
  minScore: number;
  maxScore: number | null;
  message: string;
}

const LEVELS: LevelDef[] = [
  {
    level:    1,
    label:    'New Besties',
    minScore: 0,
    maxScore: 49,
    message:  "We're just getting started — I'm so excited to be here for you!",
  },
  {
    level:    2,
    label:    'Getting to Know You',
    minScore: 50,
    maxScore: 149,
    message:  "I'm really getting to know you and I love every moment of it!",
  },
  {
    level:    3,
    label:    'Trusted Besties',
    minScore: 150,
    maxScore: 299,
    message:  "You can count on me for anything — we've got this together!",
  },
  {
    level:    4,
    label:    'Close Besties',
    minScore: 300,
    maxScore: 499,
    message:  "We're so close — you inspire me every single day!",
  },
  {
    level:    5,
    label:    'Life Besties',
    minScore: 500,
    maxScore: null,
    message:  "We're inseparable! You're absolutely crushing it and I'm so proud.",
  },
];

function deriveLevel(score: number): LevelDef {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (score >= LEVELS[i]!.minScore) return LEVELS[i]!;
  }
  return LEVELS[0]!;
}

// ─── Public types ──────────────────────────────────────────────────────────────

export interface BestieRelationshipData {
  score:          number;
  level:          1 | 2 | 3 | 4 | 5;
  levelLabel:     string;
  levelMessage:   string;
  progressToNext: number;        // 0–100
  pointsToNext:   number | null; // null at max level
  nextLevelLabel: string | null;
  loading:        boolean;
}

export interface BestieRelationshipHook extends BestieRelationshipData {
  addScore: (points: number) => void;
  /** Award points for a task completion only once per task id. */
  awardTaskCompletion: (taskId: string, points?: number) => void;
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useBestieRelationship(): BestieRelationshipHook {
  const [score, setScore]     = useState(0);
  const [loading, setLoading] = useState(true);

  // Refs so async flush always sees latest values without stale closures
  const scoreRef    = useRef(0);
  const flushTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef  = useRef(0);

  // Set of task IDs that have already been rewarded in this session.
  // On load we also fetch the persisted set from Supabase so page refreshes
  // are protected even before any interaction occurs.
  const rewardedTaskIds = useRef<Set<string>>(new Set());

  const persistScore = useCallback(async (finalScore: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const today = new Date().toISOString().split('T')[0];
    const { error } = await supabase
      .from('bestie_relationship')
      .upsert(
        { user_id: user.id, score: finalScore, last_app_open_date: today, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
    dbError('bestie_relationship (persist)', error);
  }, []);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const today = new Date().toISOString().split('T')[0];

    const { data } = await supabase
      .from('bestie_relationship')
      .select('score, last_app_open_date, rewarded_task_ids')
      .eq('user_id', user.id)
      .maybeSingle();

    let current = data?.score ?? 0;
    const lastOpen = data?.last_app_open_date ?? null;

    // Restore the set of already-rewarded task IDs so refreshing the page
    // does not award duplicate points for previously completed tasks.
    const persisted: string[] = data?.rewarded_task_ids ?? [];
    rewardedTaskIds.current = new Set(persisted);

    if (lastOpen !== today) {
      current += 15;
      await persistScore(current);
    }

    scoreRef.current = current;
    setScore(current);
    setLoading(false);
  }, [persistScore]);

  useEffect(() => { load(); }, [load]);

  const addScore = useCallback((points: number) => {
    const next = scoreRef.current + points;
    scoreRef.current = next;
    pendingRef.current += points;
    setScore(next);

    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(() => {
      pendingRef.current = 0;
      persistScore(scoreRef.current);
    }, 2000);
  }, [persistScore]);

  const awardTaskCompletion = useCallback((taskId: string, points = 10) => {
    if (rewardedTaskIds.current.has(taskId)) return;
    rewardedTaskIds.current.add(taskId);
    addScore(points);

    // Persist the updated rewarded set alongside the score.
    // We do this asynchronously without blocking the UI.
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const ids = Array.from(rewardedTaskIds.current);
      await supabase
        .from('bestie_relationship')
        .upsert(
          { user_id: user.id, rewarded_task_ids: ids, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        );
    })();
  }, [addScore]);

  const currentLevel  = deriveLevel(score);
  const nextLevelDef  = LEVELS.find((l) => l.level === (currentLevel.level as number) + 1) ?? null;

  const progressToNext = nextLevelDef
    ? Math.min(
        100,
        Math.round(
          ((score - currentLevel.minScore) / (nextLevelDef.minScore - currentLevel.minScore)) * 100
        )
      )
    : 100;

  return {
    score,
    level:          currentLevel.level,
    levelLabel:     currentLevel.label,
    levelMessage:   currentLevel.message,
    progressToNext,
    pointsToNext:   nextLevelDef ? Math.max(0, nextLevelDef.minScore - score) : null,
    nextLevelLabel: nextLevelDef?.label ?? null,
    loading,
    addScore,
    awardTaskCompletion,
  };
}
