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
export interface HomeExpressionContext {
  pendingTaskCount: number;
  hasOverdueTasks: boolean;
  proudFlash: boolean;
  firstVisitToday: boolean;
  localTimePeriod: string;
  hasMoved: boolean;
  hasCompletedMovement: boolean;
  completedTaskCount: number;
}

export function getHomeExpression(ctx: HomeExpressionContext): AvatarExpression {
  if (ctx.proudFlash) return 'proud';
  if (ctx.hasOverdueTasks) return 'empathetic';
  if (ctx.firstVisitToday) return 'excited';
  if (ctx.pendingTaskCount === 0 && ctx.completedTaskCount > 0) return 'proud';
  if (ctx.pendingTaskCount === 0) return 'encouraging';
  if (ctx.hasCompletedMovement) return 'proud';
  if (ctx.localTimePeriod === 'evening' || ctx.localTimePeriod === 'late_night') return 'calm';
  if (ctx.pendingTaskCount >= 5) return 'focused';
  if (ctx.pendingTaskCount >= 3) return 'listening';
  return 'happy';
}
