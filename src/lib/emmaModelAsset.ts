// Runtime probe for the rigged Blender export. When the GLB is present and
// valid, EmmaFullBodyAvatar swaps the 2D illustration for the 3D viewer;
// until then the existing artwork stays. The check is cached per session.
// The verified path and manifest fields come from the pinned Emma-Master.
import manifest from './emmaAssetManifest';
export const EMMA_GLB_PATH = manifest.asset;

export type EmmaModelProbe =
  | { state: 'probing' }
  | { state: 'unavailable'; reason: string }
  | { state: 'ready'; url: string };

let probe: Promise<EmmaModelProbe> | undefined;

function describe(response: Response): string {
  const type = response.headers.get('content-type') || 'unknown';
  return `status=${response.status} type=${type}`;
}

function verify(url: string): Promise<EmmaModelProbe> {
  return (async () => {
    try {
      // The SPA rewrites unknown paths to index.html with HTTP 200, so a
      // status check alone would mistake the app shell for the model.
      // Range-request the first bytes and verify the glTF magic number.
      const response = await fetch(url, { headers: { Range: 'bytes=0-19' } });
      if (!response.ok) return { state: 'unavailable', reason: describe(response) };
      const type = response.headers.get('content-type') || '';
      if (type.includes('text/html')) return { state: 'unavailable', reason: `HTML served for ${describe(response)}` };
      const buffer = new Uint8Array(await response.arrayBuffer());
      // GLB: magic[0..3], version[4..7], total length[8..11],
      // first chunk length[12..15], first chunk type[16..19].
      if (buffer.length < 20) return { state: 'unavailable', reason: `truncated glTF header (${describe(response)})` };
      const header = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
      const declaredBytes = header.getUint32(8, true);
      const jsonBytes = header.getUint32(12, true);
      if (header.getUint32(0, true) !== 0x46546c67 || header.getUint32(4, true) !== 2 ||
          header.getUint32(16, true) !== 0x4e4f534a || jsonBytes === 0 || jsonBytes % 4 !== 0 ||
          jsonBytes > declaredBytes - 20) return { state: 'unavailable', reason: `not a valid glTF container (${describe(response)})` };
      if (declaredBytes !== manifest.bytes) return { state: 'unavailable', reason: 'Emma model size does not match its manifest' };
      if (response.status === 206) {
        const range = response.headers.get('content-range');
        if (range) {
          const match = /^bytes 0-(\d+)\/(\d+)$/.exec(range);
          if (!match || Number(match[1]) < 19 || Number(match[2]) !== manifest.bytes || buffer.length !== Number(match[1]) + 1)
            return { state: 'unavailable', reason: 'Emma model has an invalid partial response' };
        }
      } else if (response.status !== 200 || buffer.length !== manifest.bytes) {
        return { state: 'unavailable', reason: 'Emma model full response is incomplete' };
      }
      if (import.meta.env?.DEV) console.info('[emmaModelAsset] probe ok:', url);
      return { state: 'ready', url };
    } catch (error) {
      return { state: 'unavailable', reason: error instanceof Error ? error.message : String(error) };
    }
  })();
}

export function loadEmmaModel(): Promise<EmmaModelProbe> {
  probe ??= verify(manifest.asset);
  return probe;
}

export function loadEmmaModelSrc(): Promise<string | undefined> {
  return loadEmmaModel().then(result => result.state === 'ready' ? result.url : undefined);
}

// A model dropped into public/ during a running dev session gets picked up on
// the next Home render; a verified-good URL stays cached so production never
// re-probes.
export function resetEmmaModelProbe(): void {
  if (!probe) return;
  probe.then(result => { if (result.state === 'unavailable') probe = undefined; }, () => { probe = undefined; });
}
