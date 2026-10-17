import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
// Hashes of the validated Blender exports; keep checks independent of missing binary imports.
const originalHashes = {
  "arm-00.webp": "7e64110023d03a8de8b86a3fa190ee9a0746f7fc7d9c83b75099bd88f3ae577f",
  "arm-01.webp": "db278c17eaaf5eafbb80ca133dddd64abf4e6fc39a57e3a92ee495b82ea37ff7",
  "arm-02.webp": "e1802b34ba79a0eda16ebe9078bc7895d823b26323484844145de22207b31a9e",
  "arm-03.webp": "071769fb2610d8dff2d9482113f72432e0348926bd624db9ebffc80a05e8283f",
  "arm-04.webp": "8e4738c4bc8f386b4d1dc01061eb9a2c23222ba6e31a1872492801d5c492aab7",
  "arm-05.webp": "1840a7463d01cd57871f44e6dba6b7812782735b6672a80de690ec70c00d1f19",
  "arm-06.webp": "02a4e6ed0bcc0f7be366e3783a6e0cc30c43d262bf5b08c486a1d70b9098401b",
  "arm-07.webp": "789eea8714e9261a1e21d3c2773cd003cf776bf39f23ebc0d75f1988a41dcd90",
  "arm-08.webp": "39e1331c3a5ba46074a4de42837450739867974a2048c931fbeb1886a805a2d9",
  "arm-09.webp": "5f7840245323613b2792d51d27215904893ceeb0390a8561db2dc62e4a145e6d",
  "arm-10.webp": "640b1391c3b70f1349584414b25cb59109e2c4f210173477f38e76a6c504cc64",
  "arm-11.webp": "18b2d4d958306c4a2261188256f180fee4b8271952b99b38944e7ca24a59e259",
  "arm-12.webp": "95ec3e3eeb4778cbc2c62c767a8c3e0d04456abc3fa077ed3b63e0f9ef902a33",
  "arm-13.webp": "0d4e8bfcbded8cdfe5ec7e8f9b8580ba8accc0715f462f5eff92694bb967c2e1",
  "arm-14.webp": "9a6029607b910e59600c6ecbfa28187cb3124e82944f64a58f567509b87c6b1b",
  "arm-15.webp": "605ca5516e2f259e3eee7407b3ccca1fa3939a8f7a848f36f66fbf5ecee2e787",
  "arm-16.webp": "f4f5a8be85984f2a58d66520392eec4a6a9d1b04e35274e5d2cdd85412d4a5aa",
  "arm-17.webp": "388f44d1d6bf99d78fb0d39811b2ef432f34dfc495abedcfb84e495c95646fa6",
  "arm-18.webp": "8da184c4a4783bc6395168352d73ab58cee6778392f952fea6e78e0d2ec0d128",
  "arm-19.webp": "136c60b413f79669eda23ca94ca182f2fcdfa4cfe23dfa9586ef0cf35a09289f",
  "arm-20.webp": "a0f220fcc5fd338aac81084227e0148467e6ff297ce0edad910dad18d4796f59",
  "arm-21.webp": "d542281e3c46e233b08b9797bd9933cd370f39f8fd168d395f0a0ec58ec5ec43",
  "arm-22.webp": "1308e1ae5f840f37b284faead8bb7a39bdd92c3418df1ee03c8001dc32b213d5",
  "arm-23.webp": "497efcfb43cd03f35fb8984bd7c729cdd561527c338a763333d0712ddd5e5a76",
  "arm-24.webp": "6b905bfe4374ae5d525d6b1d217e93d0fbba31fd309b3f3ee31dd2daee86d0a8",
  "blink.webp": "b40abea582cf4058fc863245c901dd74d846170cf74d4bd35b97ce2a9a5b8a40",
  "body.webp": "48d6bb3e3de979574ace0e7b102840c7366c49a846172e1bf7fd04686aa223c4",
  "poster.webp": "6a6fd14549e9b0a9355d3b01e23865ad088c0e08d58a5183d14f10ba0d47dd9c"
};
const root = new URL('../public/assets/emma/rig/mesh-v1/', import.meta.url);
test('Bolt text bundle preserves all animation image bytes and includes every manifest tile', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', root)));
  const images = JSON.parse(fs.readFileSync(new URL('images.json', root)));
  const names = ['body.webp', 'blink.webp', ...manifest.atlases];
  assert.equal(names.length, 27);
  assert.deepEqual(Object.keys(images).sort(), names.sort());
  for (const name of names) {
    const decoded = Buffer.from(images[name], 'base64');
    assert.equal(createHash('sha256').update(decoded).digest('hex'), originalHashes[name], name);
    assert.equal(decoded.toString('ascii', 0, 4), 'RIFF');
    assert.equal(decoded.toString('ascii', 8, 12), 'WEBP');
  }
  const posterModule = fs.readFileSync(new URL('../src/components/besties/emmaRigPoster.ts', import.meta.url), 'utf8');
  const encoded = JSON.parse(posterModule.slice(posterModule.indexOf('export default ') + 15).trim().replace(/;$/, ''));
  assert.equal(createHash('sha256').update(Buffer.from(encoded.split(',')[1], 'base64')).digest('hex'), originalHashes['poster.webp']);
});
