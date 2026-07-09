import { useState, useEffect, useCallback } from 'react';
import { supabase, dbError } from '../lib/supabase';

// ─── Reward constants ──────────────────────────────────────────────────────────

/** Points awarded on the first app open of each calendar day. */
export const DAILY_CHECKIN_POINTS = 5;

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
  /**
   * Award points atomically via the database function.
   * Duplicate (same reward_type + source_id) returns silently with no score change.
   * Score state is only updated after the DB confirms success.
   */
  awardPoints: (
    rewardType: string,
    sourceId:   string,
    points:     number,
    description?: string,
  ) => Promise<void>;

  /** Convenience wrapper: award task-completion points (reward_type = 'task_complete'). */
  awardTaskCompletion: (taskId: string, points?: number) => Promise<void>;
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useBestieRelationship(): BestieRelationshipHook {
  const [score, setScore]     = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    // Load current score from the relationship row.
    const { data } = await supabase
      .from('bestie_relationship')
      .select('score')
      .eq('user_id', user.id)
      .maybeSingle();

    const current = data?.score ?? 0;

    // Daily check-in reward: use today's date as the unique source_id.
    // The DB function's unique constraint guarantees this only awards once per day
    // regardless of how many times the page loads or how many tabs are open.
    const today = new Date().toISOString().split('T')[0];
    const { data: rpc, error: rpcErr } = await supabase.rpc('award_bestie_points', {
      p_reward_type: 'daily_checkin',
      p_source_id:   today,
      p_points:      DAILY_CHECKIN_POINTS,
      p_description: 'Daily check-in',
    });

    if (rpcErr) {
      dbError('award_bestie_points (daily_checkin)', rpcErr);
      // Fall back to the score we already loaded
      setScore(current);
    } else {
      const result = rpc as { awarded: boolean; new_score: number };
      setScore(result.new_score ?? current);
    }

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Core atomic award function ─────────────────────────────────────────────
  // All score mutations go through here. No optimistic updates — the score
  // state is only changed after the DB confirms the transaction succeeded.

  const awardPoints = useCallback(async (
    rewardType:  string,
    sourceId:    string,
    points:      number,
    description = '',
  ): Promise<void> => {
    const { data, error } = await supabase.rpc('award_bestie_points', {
      p_reward_type: rewardType,
      p_source_id:   sourceId,
      p_points:      points,
      p_description: description,
    });

    if (error) {
      dbError(`award_bestie_points (${rewardType}:${sourceId})`, error);
      return;
    }

    const result = data as { awarded: boolean; new_score: number };
    // Update React state only when the DB confirms the score changed.
    if (result.awarded) {
      setScore(result.new_score);
    }
    // If not awarded (duplicate), state is already correct — no change needed.
  }, []);

  const awardTaskCompletion = useCallback(async (
    taskId: string,
    points  = 10,
  ): Promise<void> => {
    await awardPoints('task_complete', taskId, points, 'Task completed');
  }, [awardPoints]);

  // ── Derived level data ─────────────────────────────────────────────────────

  const currentLevel = deriveLevel(score);
  const nextLevelDef = LEVELS.find((l) => l.level === (currentLevel.level as number) + 1) ?? null;

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
    awardPoints,
    awardTaskCompletion,
  };
}
