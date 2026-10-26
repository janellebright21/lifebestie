import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

// Load the PRODUCTION navigation helpers from navLogic.ts and transpile for Node.
async function loadModule(path) {
  const source = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}

const {
  resolveFourthSlot,
  resolveMoreDestinations,
  isMoreActive,
  isTabReachable,
  MORE_TAB_IDS,
  ALL_TAB_NAMES,
  TAB_MODULE,
} = await loadModule('../src/components/navLogic.ts');

// ── Module sets used across tests ─────────────────────────────────────────────

const ALL_ENABLED = new Set(['grocery', 'meals', 'budget', 'movement', 'ai-assistant', 'routines']);
const NO_CHAT = new Set(['grocery', 'meals', 'budget', 'movement', 'routines']);
const NO_CHAT_NO_GROCERY = new Set(['meals', 'budget', 'movement', 'routines']);
const NONE = new Set();

// ── Tests ─────────────────────────────────────────────────────────────────────

test('all modules enabled: 4th slot is Chat', () => {
  assert.equal(resolveFourthSlot(ALL_ENABLED), 'chat');
});

test('Chat disabled, Grocery enabled: 4th slot is Grocery', () => {
  assert.equal(resolveFourthSlot(NO_CHAT), 'grocery');
});

test('Chat+Grocery disabled: 4th slot is Bestie fallback (no blank gap)', () => {
  assert.equal(resolveFourthSlot(NO_CHAT_NO_GROCERY), 'bestie');
});

test('no modules enabled: 4th slot is Bestie fallback', () => {
  assert.equal(resolveFourthSlot(NONE), 'bestie');
});

test('More destinations exclude disabled modules', () => {
  const dests = resolveMoreDestinations(NO_CHAT);
  const ids = dests.map((d) => d.id);
  assert.ok(!ids.includes('chat'), 'chat not in More (it is not a More destination)');
  assert.ok(ids.includes('grocery'), 'grocery in More');
  assert.ok(ids.includes('movement'), 'movement in More');
  assert.ok(ids.includes('routines'), 'routines in More');
  assert.ok(ids.includes('goals'), 'goals in More (always available)');
  assert.ok(ids.includes('bestie'), 'bestie in More (always available)');
  assert.ok(ids.includes('settings'), 'settings in More (always available)');
});

test('disabled grocery and movement are excluded from More destinations', () => {
  const restricted = new Set(['meals', 'budget', 'ai-assistant', 'routines']);
  const dests = resolveMoreDestinations(restricted);
  const ids = dests.map((d) => d.id);
  assert.ok(!ids.includes('grocery'), 'grocery excluded when disabled');
  assert.ok(!ids.includes('movement'), 'movement excluded when disabled');
  assert.ok(ids.includes('routines'), 'routines included when enabled');
});

test('Grocery is the first More destination when enabled', () => {
  const dests = resolveMoreDestinations(ALL_ENABLED);
  assert.equal(dests[0].id, 'grocery', 'Grocery must be first in More');
});

test('Grocery remains first in More even when Chat is disabled', () => {
  const dests = resolveMoreDestinations(NO_CHAT);
  assert.equal(dests[0].id, 'grocery');
});

test('every enabled route is reachable', () => {
  for (const tab of ALL_TAB_NAMES) {
    if (tab === 'add') continue; // add is a sheet trigger, not a gated route
    const reachable = isTabReachable(tab, ALL_ENABLED);
    assert.ok(reachable, `Route ${tab} should be reachable with all modules enabled`);
  }
});

test('disabled routes are not reachable', () => {
  assert.equal(isTabReachable('grocery', NONE), false, 'grocery not reachable when disabled');
  assert.equal(isTabReachable('movement', NONE), false, 'movement not reachable when disabled');
  assert.equal(isTabReachable('routines', NONE), false, 'routines not reachable when disabled');
  assert.equal(isTabReachable('chat', NONE), false, 'chat not reachable when disabled');
});

test('ungated routes are always reachable regardless of modules', () => {
  for (const tab of ['home', 'planner', 'add', 'bestie', 'settings', 'goals']) {
    assert.ok(isTabReachable(tab, NONE), `${tab} always reachable`);
  }
});

test('More is active when a More child route is active (not the 4th slot)', () => {
  // When chat is the 4th slot and grocery is active, More should be active
  assert.equal(isMoreActive('grocery', 'chat'), true);
  assert.equal(isMoreActive('movement', 'chat'), true);
  assert.equal(isMoreActive('settings', 'chat'), true);
  assert.equal(isMoreActive('bestie', 'chat'), true);
  assert.equal(isMoreActive('goals', 'chat'), true);
  assert.equal(isMoreActive('routines', 'chat'), true);
});

test('More is NOT active when the active tab is the 4th slot (avoid dual aria-current)', () => {
  // When chat is the 4th slot and chat is active, More should NOT be active
  assert.equal(isMoreActive('chat', 'chat'), false, 'chat is 4th slot, More must not claim active');
  // When grocery is the 4th slot (chat disabled) and grocery is active
  assert.equal(isMoreActive('grocery', 'grocery'), false, 'grocery is 4th slot, More must not claim active');
  // When bestie is the 4th slot and bestie is active
  assert.equal(isMoreActive('bestie', 'bestie'), false, 'bestie is 4th slot, More must not claim active');
});

test('More is NOT active for primary tabs (home, planner, add)', () => {
  assert.equal(isMoreActive('home', 'chat'), false);
  assert.equal(isMoreActive('planner', 'chat'), false);
  assert.equal(isMoreActive('add', 'chat'), false);
});

test('all 10 TabName values are covered by primary slots or More', () => {
  // Primary: home, planner, add, fourthSlot (chat/grocery/bestie)
  // More: grocery, movement, routines, goals, bestie, settings
  // Union must cover all 10
  for (const tab of ALL_TAB_NAMES) {
    const inMore = MORE_TAB_IDS.has(tab);
    const isPrimary = tab === 'home' || tab === 'planner' || tab === 'add' || tab === 'chat' || tab === 'bestie';
    assert.ok(inMore || isPrimary, `Route ${tab} is not covered`);
  }
});

test('no route is lost: union of primary + More = all 10', () => {
  const primary = new Set(['home', 'planner', 'add', 'chat', 'grocery', 'bestie']);
  const more = MORE_TAB_IDS;
  const all = new Set([...primary, ...more]);
  assert.equal(all.size, 10);
  for (const tab of ALL_TAB_NAMES) {
    assert.ok(all.has(tab), `Route ${tab} missing from coverage`);
  }
});

test('TAB_MODULE gating is correct', () => {
  assert.equal(TAB_MODULE['grocery'], 'grocery');
  assert.equal(TAB_MODULE['movement'], 'movement');
  assert.equal(TAB_MODULE['routines'], 'routines');
  assert.equal(TAB_MODULE['chat'], 'ai-assistant');
  assert.equal(TAB_MODULE['home'], undefined, 'home is not gated');
  assert.equal(TAB_MODULE['planner'], undefined, 'planner is not gated');
  assert.equal(TAB_MODULE['bestie'], undefined, 'bestie is not gated');
  assert.equal(TAB_MODULE['settings'], undefined, 'settings is not gated');
  assert.equal(TAB_MODULE['goals'], undefined, 'goals is not gated');
});
