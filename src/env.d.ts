/**
 * Ambient module declarations for assets handled by esbuild loaders.
 * `.svg` imports are embedded as base64 data URLs at bundle time.
 */
declare module '*.svg' {
  const dataUrl: string;
  export default dataUrl;
}
