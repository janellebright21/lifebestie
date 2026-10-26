// Pinned Emma-Master asset descriptor. The probe and loader verify against
// these values; the old v1 size/hash must not reject the new asset.
const manifest = {
  asset: '/characters/emma/Emma-Master.glb',
  bytes: 23517212,
  sha256: '329f670418f62ad5428fad8dbe85cdee135ea01914b813696089d670ba189fe9',
} as const;
export default manifest;
