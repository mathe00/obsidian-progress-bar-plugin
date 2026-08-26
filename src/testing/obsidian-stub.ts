/**
 * Minimal runtime stand-in for the `obsidian` module, used ONLY by Vitest
 * (see vitest.config.mts alias). The real `obsidian` npm package ships type
 * definitions without runtime JavaScript - the actual implementation is
 * provided by the Obsidian application itself and stays external in bundles.
 *
 * Only what the unit-tested components touch is implemented here.
 */

/** Minimal base class mirroring Obsidian's MarkdownRenderChild lifecycle API. */
export class MarkdownRenderChild {
  constructor(public readonly containerEl: HTMLElement) {}

  /**
   * Mirror of `Component.registerDomEvent`: binds the listener and lets the
   * component own it. Tests rely on real DOM listeners being attached so they
   * can dispatch genuine events.
   */
  registerDomEvent<K extends keyof HTMLElementEventMap>(
    el: HTMLElement,
    type: K,
    listener: (event: HTMLElementEventMap[K]) => void
  ): void {
    el.addEventListener(type, listener as EventListener);
  }
}
