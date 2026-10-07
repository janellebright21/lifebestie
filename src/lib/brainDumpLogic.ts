import type { ModuleId, TaskCategory, TaskPriority } from './supabase';

export type SuggestionType = 'task' | 'grocery' | 'note';

export type SuggestionStatus = 'pending' | 'saving' | 'saved' | 'error';

export interface BrainDumpSuggestion {
  id: string;
  type: SuggestionType;
  title: string;
  selected: boolean;
  dueDate?: string | null;
  category?: TaskCategory;
  priority?: TaskPriority;
  quantity?: string;
  unit?: string;
  groceryCategory?: string;
  status: SuggestionStatus;
  savedId?: string;
  errorMsg?: string;
}

export interface BrainDumpResult {
  text: string;
  suggestions: BrainDumpSuggestion[];
}

const MAX_SUGGESTIONS = 20;
const MAX_TITLE_LENGTH = 200;
const MAX_TEXT_LENGTH = 2000;

const VALID_TASK_CATEGORIES = new Set<string>(['Work', 'Kids', 'Home', 'Self-care', 'Grocery', 'Personal', 'Other']);
const VALID_PRIORITIES = new Set<string>(['low', 'medium', 'high']);
const VALID_GROCERY_CATEGORIES = new Set<string>([
  'Produce', 'Dairy', 'Meat', 'Seafood', 'Bakery', 'Frozen',
  'Beverages', 'Pantry', 'Snacks', 'Personal Care', 'Household', 'Baby', 'Pet',
]);
const VALID_TYPES = new Set<string>(['task', 'grocery', 'note']);

let idCounter = 0;
function genId(): string {
  return `bd-${Date.now()}-${++idCounter}`;
}

/** Validate a YYYY-MM-DD string is a real calendar date. */
export function isValidLocalDate(dateStr: string): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const y = parseInt(m[1]!, 10);
  const mo = parseInt(m[2]!, 10);
  const d = parseInt(m[3]!, 10);
  if (mo < 1 || mo > 12) return false;
  if (d < 1 || d > 31) return false;
  const date = new Date(y, mo - 1, d);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d;
}

/** Normalize and validate a single raw suggestion from AI output. Returns null if invalid. */
export function normalizeSuggestion(raw: unknown): BrainDumpSuggestion | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const type = typeof r.type === 'string' ? r.type.toLowerCase().trim() : '';
  if (!VALID_TYPES.has(type)) return null;

  const title = typeof r.title === 'string' ? r.title.trim() : '';
  if (!title || title.length > MAX_TITLE_LENGTH) return null;

  const suggestion: BrainDumpSuggestion = {
    id: genId(),
    type: type as SuggestionType,
    title,
    selected: false,
    status: 'pending',
  };

  if (type === 'task') {
    if (typeof r.due_date === 'string' && r.due_date.trim()) {
      const dd = r.due_date.trim();
      if (isValidLocalDate(dd)) suggestion.dueDate = dd;
    }
    const cat = typeof r.category === 'string' ? r.category.trim() : '';
    suggestion.category = VALID_TASK_CATEGORIES.has(cat) ? (cat as TaskCategory) : 'Other';
    const pri = typeof r.priority === 'string' ? r.priority.toLowerCase().trim() : '';
    suggestion.priority = VALID_PRIORITIES.has(pri) ? (pri as TaskPriority) : 'medium';
  }

  if (type === 'grocery') {
    if (typeof r.quantity === 'string' && r.quantity.trim()) {
      suggestion.quantity = r.quantity.trim().slice(0, 50);
    }
    if (typeof r.unit === 'string' && r.unit.trim()) {
      suggestion.unit = r.unit.trim().slice(0, 20);
    }
    const gcat = typeof r.category === 'string' ? r.category.trim() : '';
    suggestion.groceryCategory = VALID_GROCERY_CATEGORIES.has(gcat) ? gcat : 'Pantry';
  }

  return suggestion;
}

/** Validate the full AI response object. Returns null if invalid. */
export function validateBrainDumpResult(raw: unknown): BrainDumpResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;

  const text = typeof r.text === 'string' ? r.text.trim() : '';
  if (!text || text.length > MAX_TEXT_LENGTH) return null;

  const rawSuggestions = r.suggestions;
  if (!Array.isArray(rawSuggestions)) return null;
  if (rawSuggestions.length > MAX_SUGGESTIONS) return null;

  const suggestions: BrainDumpSuggestion[] = [];
  for (const rawS of rawSuggestions) {
    const s = normalizeSuggestion(rawS);
    if (s) suggestions.push(s);
  }

  return { text, suggestions };
}

/** Filter suggestions by enabled modules. Tasks and notes are always available. */
export function filterByModules(
  suggestions: BrainDumpSuggestion[],
  enabledModules: Set<ModuleId>,
): BrainDumpSuggestion[] {
  return suggestions.filter((s) => {
    if (s.type === 'task') return true;
    if (s.type === 'grocery') return enabledModules.has('grocery');
    if (s.type === 'note') return true;
    return false;
  });
}

/** Whether a suggestion type can be saved given current modules. */
export function canSave(suggestion: BrainDumpSuggestion, enabledModules: Set<ModuleId>): boolean {
  if (suggestion.status === 'saved') return false;
  if (suggestion.type === 'task') return true;
  if (suggestion.type === 'grocery') return enabledModules.has('grocery');
  return false;
}

export interface SaveOutcome {
  status: 'saved' | 'error';
  savedId?: string;
  errorMsg?: string;
}

export type SaveOneFn = (suggestion: BrainDumpSuggestion) => Promise<{
  success: boolean;
  id?: string;
  error?: string;
}>;

/**
 * Create a retry-safe save orchestrator.
 * Saves only selected items that are pending or error — never retries already-saved items.
 * Saves sequentially to prevent concurrent duplicate inserts.
 */
export function createSaveOrchestrator(saveOne: SaveOneFn) {
  return async function save(
    suggestions: BrainDumpSuggestion[],
  ): Promise<Map<string, SaveOutcome>> {
    const results = new Map<string, SaveOutcome>();
    const toSave = suggestions.filter(
      (s) => s.selected && s.status !== 'saved' && s.status !== 'saving',
    );
    for (const s of toSave) {
      try {
        const result = await saveOne(s);
        if (result.success && result.id) {
          results.set(s.id, { status: 'saved', savedId: result.id });
        } else {
          results.set(s.id, { status: 'error', errorMsg: result.error ?? 'Save failed' });
        }
      } catch (err) {
        results.set(s.id, {
          status: 'error',
          errorMsg: err instanceof Error ? err.message : 'Unexpected error',
        });
      }
    }
    return results;
  };
}

export function hasRetryable(suggestions: BrainDumpSuggestion[]): boolean {
  return suggestions.some((s) => s.selected && s.status === 'error');
}

export function countSaved(suggestions: BrainDumpSuggestion[]): number {
  return suggestions.filter((s) => s.status === 'saved').length;
}

export function countErrors(suggestions: BrainDumpSuggestion[]): number {
  return suggestions.filter((s) => s.status === 'error').length;
}

export function countSelected(suggestions: BrainDumpSuggestion[]): number {
  return suggestions.filter((s) => s.selected).length;
}
