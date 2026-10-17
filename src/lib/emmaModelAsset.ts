// Runtime probe for the rigged Blender export. When the GLB is present and
// valid, EmmaFullBodyAvatar swaps the 2D illustration for the 3D viewer;
// until then the existing artwork stays. The check is cached per session.
export const EMMA_GLB_PATH = '/characters/emma/Emma-App-v1.glb';

let probe: Promise<string | undefined> | undefined;

function verify(url: string): Promise<string | undefined> {
  return (async () => {
    try {
      // The SPA rewrites unknown paths to index.html with HTTP 200, so a
      // status check alone would mistake the app shell for the model.
      // Range-request the first bytes and verify the glTF magic number.
      const response = await fetch(url, { headers: { Range: 'bytes=0-3' } });
      if (!response.ok) return undefined;
      const type = response.headers.get('content-type') || '';
      if (type.includes('text/html')) return undefined;
      const buffer = new Uint8Array(await response.arrayBuffer());
      const magic = String.fromCharCode(...buffer.slice(0, 4));
      return magic === 'glTF' ? url : undefined;
    } catch {
      return undefined;
    }
  })();
}

export function loadEmmaModelSrc(): Promise<string | undefined> {
  probe ??= verify(EMMA_GLB_PATH);
  return probe;
}
