import type { AvatarExpression } from './supabase';

/**
 * Maps named app contexts to the best Bestie expression.
 * Add new context keys here as new app states are introduced.
 */
export type BestieContext =
  | 'home'
  | 'loading'
  | 'completed'
  | 'wellness'
  | 'overwhelmed'
  | 'encouraging'
  | 'chat-idle'
  | 'chat-typing'
  | 'planner-empty'
  | 'grocery-loading'
  | 'movement'
  | 'evening'
  | 'default';

const CONTEXT_MAP: Record<BestieContext, AvatarExpression> = {
  'home':            'happy',
  'loading':         'thinking',
  'completed':       'proud',
  'wellness':        'calm',
  'overwhelmed':     'encouraging',
  'encouraging':     'encouraging',
  'chat-idle':       'happy',
  'chat-typing':     'thinking',
  'planner-empty':   'encouraging',
  'grocery-loading': 'thinking',
  'movement':        'calm',
  'evening':         'calm',
  'default':         'happy',
};

/**
 * Returns the AvatarExpression for a given app context.
 * Falls back to 'happy' for any unrecognised key.
 *
 * @example
 * getBestieExpression('completed')  // => 'proud'
 * getBestieExpression('loading')    // => 'thinking'
 * getBestieExpression('wellness')   // => 'calm'
 */
export function getBestieExpression(context: BestieContext | string): AvatarExpression {
  return CONTEXT_MAP[context as BestieContext] ?? 'happy';
}

/**
 * Derives the best expression for the Home screen based on live task state.
 * Priority: overdue/missed → encouraging | no tasks today → encouraging | default → happy
 */
export function getHomeExpression(
  pendingTaskCount: number,
  hasOverdueTasks: boolean,
  proudFlash: boolean,
): AvatarExpression {
  if (proudFlash) return 'proud';
  if (hasOverdueTasks) return 'encouraging';
  if (pendingTaskCount === 0) return 'encouraging';
  return 'happy';
}
