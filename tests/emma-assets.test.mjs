import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const root = new URL('../public/assets/emma/rig/mesh-v1/', import.meta.url);
test('Bolt text bundle preserves all animation image bytes and includes every manifest tile', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', root)));
  const images = JSON.parse(fs.readFileSync(new URL('images.json', root)));
  const names = ['body.webp', 'blink.webp', ...manifest.atlases];
  assert.equal(names.length, 27);
  assert.deepEqual(Object.keys(images).sort(), names.sort());
  for (const name of names) {
    const decoded = Buffer.from(images[name], 'base64');
    assert.deepEqual(decoded, fs.readFileSync(new URL(name, root)), name);
    assert.equal(decoded.toString('ascii', 0, 4), 'RIFF');
    assert.equal(decoded.toString('ascii', 8, 12), 'WEBP');
  }
  const posterModule = fs.readFileSync(new URL('../src/components/besties/emmaRigPoster.ts', import.meta.url), 'utf8');
  const encoded = JSON.parse(posterModule.slice(posterModule.indexOf('export default ') + 15).trim().replace(/;$/, ''));
  assert.deepEqual(Buffer.from(encoded.split(',')[1], 'base64'), fs.readFileSync(new URL('poster.webp', root)));
});
