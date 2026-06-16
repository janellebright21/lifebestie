import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, dbError } from '../lib/supabase';

// ─── Level definitions ─────────────────────────────────────────────────────────

interface LevelDef {
  level: 1 | 2 | 3 | 4;
  label: string;
  minScore: number;
  maxScore: number | null;
  message: string;
}

const LEVELS: LevelDef[] = [
  {
    level:    1,
    label:    'New Friend',
    minScore: 0,
    maxScore: 99,
    message:  "We're just getting started — I'm so excited to be here for you!",
  },
  {
    level:    2,
    label:    'Supportive Friend',
    minScore: 100,
    maxScore: 299,
    message:  "I'm really getting to know you and I love every moment of it!",
  },
  {
    level:    3,
    label:    'Trusted Bestie',
    minScore: 300,
    maxScore: 599,
    message:  "You can count on me for anything — we've got this together!",
  },
  {
    level:    4,
    label:    'Life Bestie',
    minScore: 600,
    maxScore: null,
    message:  "We're inseparable! You're absolutely crushing it and I'm so proud.",
  },
];

function deriveLevel(score: number): LevelDef {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (score >= LEVELS[i].minScore) return LEVELS[i];
  }
  return LEVELS[0];
}

// ─── Public types ──────────────────────────────────────────────────────────────

export interface BestieRelationshipData {
  score:          number;
  level:          1 | 2 | 3 | 4;
  levelLabel:     string;
  levelMessage:   string;
  progressToNext: number;        // 0–100
  pointsToNext:   number | null; // null at max level
  nextLevelLabel: string | null;
  loading:        boolean;
}

export interface BestieRelationshipHook extends BestieRelationshipData {
  addScore: (points: number) => void;
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useBestieRelationship(): BestieRelationshipHook {
  const [score, setScore]     = useState(0);
  const [loading, setLoading] = useState(true);

  // Refs so async flush always sees latest values without stale closures
  const scoreRef    = useRef(0);
  const flushTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef  = useRef(0);

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
      .select('score, last_app_open_date')
      .eq('user_id', user.id)
      .maybeSingle();

    let current = data?.score ?? 0;
    const lastOpen = data?.last_app_open_date ?? null;

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

  const currentLevel  = deriveLevel(score);
  const nextLevelDef  = LEVELS.find((l) => l.level === currentLevel.level + 1) ?? null;

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
  };
}
