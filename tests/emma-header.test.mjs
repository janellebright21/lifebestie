// Regression coverage for the Emma master GLB header probe in
// src/lib/emmaModelAsset.ts: a real GLB must verify as ready, while truncated
// or corrupt headers must be rejected with a clear reason.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { transformSync } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const glbPath = path.join(root, 'public/characters/emma/Emma-Master.glb');
const manifest = JSON.parse(
  readFileSync(path.join(root, 'public/characters/emma/Emma-Master.manifest.json'), 'utf8'),
);

// The probe is TypeScript with an inline manifest import; transpile it once and
// inline the manifest values so node --test can exercise the real logic.
const source = readFileSync(path.join(root, 'src/lib/emmaModelAsset.ts'), 'utf8');
const js = transformSync(source, { loader: 'ts', format: 'cjs' }).code
  .replace(/import\.meta\.env\?\.DEV/g, 'false');
const stubManifest = { asset: '/characters/emma/Emma-Master.glb', bytes: manifest.bytes, sha256: manifest.sha256 };
const mod = { exports: {} };
new Function('module', 'exports', 'require', js)(
  mod,
  mod.exports,
  () => stubManifest,
);
const { loadEmmaModel } = mod.exports;

function makeFetch(body, { status = 206, contentType = 'model/gltf-binary', range = `bytes 0-19/${manifest.bytes}` } = {}) {
  return async () => {
    // Copy into a standalone ArrayBuffer so DataView reads stay in bounds.
    const copy = new Uint8Array(Uint8Array.from(body));
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: {
        get(name) {
          if (name === 'content-type') return contentType;
          if (name === 'content-range') return range;
          return null;
        },
      },
      arrayBuffer: async () => copy.buffer,
    };
  };
}

test('real GLB header (first 20 bytes) verifies as ready', async () => {
  const glb = readFileSync(glbPath);
  globalThis.fetch = makeFetch(glb.subarray(0, 20));
  const result = await loadEmmaModel();
  assert.equal(result.state, 'ready');
});

test('truncated header (< 20 bytes) is rejected', async () => {
  const glb = readFileSync(glbPath);
  globalThis.fetch = makeFetch(glb.subarray(0, 12));
  const result = await loadEmmaModel();
  assert.equal(result.state, 'unavailable');
  assert.match(result.reason, /truncated/i);
});

test('wrong magic value is rejected as invalid container', async () => {
  const glb = readFileSync(glbPath);
  const tampered = Buffer.from(glb.subarray(0, 20));
  tampered.writeUInt32LE(0x12345678, 0);
  globalThis.fetch = makeFetch(tampered);
  const result = await loadEmmaModel();
  assert.equal(result.state, 'unavailable');
  assert.match(result.reason, /not a valid glTF container/i);
});

test('declared size mismatch with manifest is rejected', async () => {
  const glb = readFileSync(glbPath);
  const tampered = Buffer.from(glb.subarray(0, 20));
  tampered.writeUInt32LE(manifest.bytes + 1, 8);
  globalThis.fetch = makeFetch(tampered);
  const result = await loadEmmaModel();
  assert.equal(result.state, 'unavailable');
  assert.match(result.reason, /size does not match/i);
});

test('full 200 response with wrong byte count is rejected', async () => {
  const glb = readFileSync(glbPath);
  globalThis.fetch = makeFetch(glb.subarray(0, 20), { status: 200, range: null });
  const result = await loadEmmaModel();
  assert.equal(result.state, 'unavailable');
  assert.match(result.reason, /full response is incomplete/i);
});
