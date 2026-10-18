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
      if (buffer.length < 20 || String.fromCharCode(...buffer.slice(0, 4)) !== 'glTF' || String.fromCharCode(...buffer.slice(8, 12)) !== 'JSON') return { state: 'unavailable', reason: `not a valid glTF container (${describe(response)})` };
      if (import.meta.env.DEV) console.info('[emmaModelAsset] probe ok:', url);
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
