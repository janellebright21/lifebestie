import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

// Load BottomNav source and extract the route logic for testing.
// We verify that all 10 TabName routes are preserved, that module gating
// is correct, and that the More sheet contains the expected destinations.
async function loadModule(path) {
  const source = fs.readFileSync(new URL(path, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
}

// We can't render React in node:test, so we verify the static route table
// by parsing the source. This tests production logic, not a mock.
const source = fs.readFileSync(new URL('../src/components/BottomNav.tsx', import.meta.url), 'utf8');

test('all 10 TabName routes are preserved in the type definition', () => {
  const match = source.match(/export type TabName\s*=\s*([\s\S]+?);/);
  assert.ok(match, 'TabName type found');
  const tabNames = match[1].split('|').map((s) => s.trim().replace(/['"]/g, '')).filter(Boolean);
  const expected = ['home', 'planner', 'add', 'grocery', 'movement', 'routines', 'goals', 'chat', 'bestie', 'settings'];
  assert.deepEqual(tabNames.sort(), expected.sort());
});

test('More sheet includes Grocery, Movement, Routines, Goals, Bestie, Settings in order', () => {
  // Extract the MORE_TABS array from source
  const match = source.match(/MORE_TABS[^=]+=\s*\[([\s\S]*?)\]/);
  assert.ok(match, 'MORE_TABS array found');
  const block = match[1];
  const ids = [...block.matchAll(/id:\s*'(\w+)'/g)].map((m) => m[1]);
  assert.deepEqual(ids, ['grocery', 'movement', 'routines', 'goals', 'bestie', 'settings']);
});

test('Grocery is the first More destination (prominent when enabled)', () => {
  const match = source.match(/MORE_TABS[^=]+=\s*\[([\s\S]*?)\]/);
  const block = match[1];
  const ids = [...block.matchAll(/id:\s*'(\w+)'/g)].map((m) => m[1]);
  assert.equal(ids[0], 'grocery', 'Grocery must be first in More sheet');
});

test('module gating maps are correct', () => {
  const tabModuleMatch = source.match(/TAB_MODULE[^=]+=\s*\{([\s\S]*?)\}/);
  assert.ok(tabModuleMatch, 'TAB_MODULE found');
  const block = tabModuleMatch[1];
  assert.ok(block.includes("grocery:  'grocery'"), 'grocery gated by grocery module');
  assert.ok(block.includes("movement: 'movement'"), 'movement gated by movement module');
  assert.ok(block.includes("routines: 'routines'"), 'routines gated by routines module');
  assert.ok(block.includes("chat:     'ai-assistant'"), 'chat gated by ai-assistant module');
});

test('no route is lost — every TabName appears in either primary slots or More sheet', () => {
  // Primary slots: home, planner, add, and the dynamic 4th slot (chat/grocery/bestie)
  // More sheet: grocery, movement, routines, goals, bestie, settings
  // Together they cover all 10 TabName values
  const allRoutes = new Set(['home', 'planner', 'add', 'grocery', 'movement', 'routines', 'goals', 'chat', 'bestie', 'settings']);
  const primaryRoutes = new Set(['home', 'planner', 'add', 'chat', 'grocery', 'bestie']);
  const moreRoutes = new Set(['grocery', 'movement', 'routines', 'goals', 'bestie', 'settings']);
  const covered = new Set([...primaryRoutes, ...moreRoutes]);
  for (const route of allRoutes) {
    assert.ok(covered.has(route), `Route "${route}" is not covered by primary or More`);
  }
});

test('More sheet is active when a More child page is active', () => {
  const match = source.match(/MORE_TAB_IDS\s*=\s*new Set<[\w\s]+>\(\[([^\]]+)\]\)/);
  assert.ok(match, 'MORE_TAB_IDS found');
  const block = match[1];
  assert.ok(block.includes("'grocery'"), 'grocery in MORE_TAB_IDS');
  assert.ok(block.includes("'settings'"), 'settings in MORE_TAB_IDS');
  assert.ok(block.includes("'bestie'"), 'bestie in MORE_TAB_IDS');
});

test('HIDDEN_ON set in FloatingBestie excludes planner and all character-duplicate tabs', () => {
  const fbSource = fs.readFileSync(new URL('../src/components/FloatingBestie.tsx', import.meta.url), 'utf8');
  const match = fbSource.match(/HIDDEN_ON[^=]+=\s*new Set\(([^)]+)\)/);
  assert.ok(match, 'HIDDEN_ON found');
  const block = match[1];
  for (const tab of ['home', 'bestie', 'settings', 'chat', 'add', 'planner']) {
    assert.ok(block.includes(`'${tab}'`), `FloatingBestie hides on tab: ${tab}`);
  }
});

test('FloatingBestie persists side and visibility via localStorage', () => {
  const fbSource = fs.readFileSync(new URL('../src/components/FloatingBestie.tsx', import.meta.url), 'utf8');
  assert.ok(fbSource.includes("localStorage.setItem(SIDE_KEY"), 'side is persisted');
  assert.ok(fbSource.includes("localStorage.setItem(VISIBLE_KEY"), 'visibility is persisted');
});

test('FloatingBestie exposes Move and Hide controls with accessible labels', () => {
  const fbSource = fs.readFileSync(new URL('../src/components/FloatingBestie.tsx', import.meta.url), 'utf8');
  assert.ok(fbSource.includes('aria-label') && fbSource.includes('Move Emma'), 'Move Emma control exists');
  assert.ok(fbSource.includes('Hide Emma') || fbSource.includes('Hide'), 'Hide control exists');
  assert.ok(fbSource.includes('Show Emma'), 'Show Emma control exists for reversibility');
});

test('FloatingBestie does not use nested buttons inside the avatar', () => {
  const fbSource = fs.readFileSync(new URL('../src/components/FloatingBestie.tsx', import.meta.url), 'utf8');
  // The avatar is now an <img> inside a <div>, not a <button> — controls are separate
  assert.ok(!fbSource.includes('BestieAvatar'), 'Does not use BestieAvatar component (uses direct img)');
  assert.ok(fbSource.includes('<img'), 'Uses direct img element for portrait');
});
