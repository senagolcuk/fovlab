/**
 * Whether this browser can actually draw the viewports.
 *
 * three needs a WebGL 2 context, and without one the canvas comes up blank with the failure only
 * in the console — the app looks broken rather than unsupported. Asking first costs one throwaway
 * canvas and lets the tool say what it needs.
 *
 * WebGL 2 is also the real floor for the whole app: Chrome 56, Firefox 51, Edge 79 and Safari 15.
 * Everything else here is comfortably older than that.
 */
export function hasWebGL2(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    // Free the context rather than leaving it to the collector: browsers cap how many are alive,
    // and the real one is about to ask for its own.
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return Boolean(gl);
  } catch {
    // Some builds throw rather than returning null when WebGL is switched off.
    return false;
  }
}
