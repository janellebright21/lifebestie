import type { ModuleId } from '../lib/supabase';

export type TabName =
  | 'home' | 'planner' | 'add' | 'grocery' | 'movement'
  | 'routines' | 'goals' | 'chat' | 'bestie' | 'settings';

// ── Shared navigation-selection logic (tested by tests/navigation.test.mjs) ──

export const TAB_MODULE: Partial<Record<TabName, ModuleId>> = {
  grocery:  'grocery',
  movement: 'movement',
  routines: 'routines',
  chat:     'ai-assistant',
};

export const MORE_TAB_IDS = new Set<TabName>(['grocery', 'movement', 'routines', 'goals', 'bestie', 'settings']);

export const ALL_TAB_NAMES: TabName[] = [
  'home', 'planner', 'add', 'grocery', 'movement',
  'routines', 'goals', 'chat', 'bestie', 'settings',
];

export interface MoreDestination {
  id: TabName;
  label: string;
}

export const MORE_DESTINATIONS: MoreDestination[] = [
  { id: 'grocery',  label: 'Grocery' },
  { id: 'movement', label: 'Movement' },
  { id: 'routines', label: 'Routines' },
  { id: 'goals',    label: 'Goals' },
  { id: 'bestie',   label: 'My Bestie' },
  { id: 'settings', label: 'Settings' },
];

/**
 * Determine which tab fills the 4th primary nav slot.
 * Priority: Chat (ai-assistant) > Grocery > Bestie fallback.
 */
export function resolveFourthSlot(enabledModules: Set<ModuleId>): TabName {
  if (enabledModules.has('ai-assistant')) return 'chat';
  if (enabledModules.has('grocery')) return 'grocery';
  return 'bestie';
}

/**
 * Filter More-sheet destinations to those enabled by the user's modules.
 */
export function resolveMoreDestinations(enabledModules: Set<ModuleId>): MoreDestination[] {
  return MORE_DESTINATIONS.filter((d) => {
    const mod = TAB_MODULE[d.id];
    return !mod || enabledModules.has(mod);
  });
}

/**
 * Whether the More button should show active state.
 * True when a More-child page is active AND that child is not the 4th slot
 * (so only one primary destination claims aria-current at a time).
 */
export function isMoreActive(activeTab: TabName, fourthTab: TabName): boolean {
  return MORE_TAB_IDS.has(activeTab) && activeTab !== fourthTab;
}

/**
 * Whether a tab is reachable given the user's modules.
 * Primary slots (home, planner, add) and un-gated tabs (bestie, settings, goals)
 * are always reachable. Gated tabs require their module.
 */
export function isTabReachable(tab: TabName, enabledModules: Set<ModuleId>): boolean {
  const mod = TAB_MODULE[tab];
  return !mod || enabledModules.has(mod);
}
