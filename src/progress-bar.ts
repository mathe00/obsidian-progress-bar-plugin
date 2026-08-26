/**
 * Interactive progress bar rendered inside markdown code blocks.
 *
 * Lifecycle follows the canonical Obsidian pattern: the code-block processor
 * calls `ctx.addChild(new ProgressBar(...))`, and this child component renders
 * during its own `onload()`. Unloading the plugin (or removing the note view)
 * automatically detaches registered DOM events - no manual cleanup needed.
 *
 * Fixes compared to the legacy single-file implementation:
 * - `wave.svg` is now really embedded (the old code referenced an undefined
 *   `waveSVG` variable and crashed with a ReferenceError),
 * - clicks are attached through `registerDomEvent`,
 * - persistence goes through the vault adapter instead of raw `fs`.
 */

// Runtime value import (not type-only): the class below extends it,
// and Obsidian provides the implementation through the external bundle.
import { MarkdownRenderChild } from 'obsidian';
import { type ProgressMemoryStore } from './memory';
import { type PluginSettings, type ResolvedBarOptions } from './types';
import {
  applyLegendTemplate,
  nextProgressAfterClick,
  percentOf,
  resolveBarOptions,
  todayISO,
} from './utils';

// Embedded at bundle time by esbuild's `dataurl` loader (see esbuild.config.mjs).
import waveImageUrl from '../wave.svg';

/**
 * Everything {@link ProgressBar} needs from the plugin.
 * `ProgressBarsPlugin` satisfies this structurally, which keeps the component
 * unit-testable with a plain object instead of an Obsidian mock.
 */
export interface ProgressBarHost {
  readonly settings: PluginSettings;
  readonly memory: ProgressMemoryStore;
}

/** Fallback duration (ms) for the wave flourish when parsing fails. */
const DEFAULT_WAVE_ANIMATION_MS = 500;

/** One interactive, persisted, clickable progress bar. */
export class ProgressBar extends MarkdownRenderChild {
  // Parameter properties keep the eslint `parameter-properties` rule happy.
  private readonly options: ResolvedBarOptions;

  /** Current progress value, always clamped to `[0, total]`. */
  private progress = 0;

  private fillEl: HTMLElement | null = null;
  private trackEl: HTMLElement | null = null;
  private legendEl: HTMLElement | null = null;

  constructor(
    private readonly host: ProgressBarHost,
    source: string,
    private readonly notePath: string,
    containerEl: HTMLElement
  ) {
    super(containerEl);
    this.options = resolveBarOptions(source, host.settings);
  }

  /**
   * Async initialization promise captured by {@linkcode onload}.
   * Exposed through {@linkcode whenReady} so callers/tests can await it
   * despite the void-returning base class signature.
   */
  private ready: Promise<void> | null = null;

  // The base signature returns void; keep it sync and drive the async part
  // separately to satisfy no-misused-promises while never leaking unhandled
  // rejections.
  override onload(): void {
    this.ready = this.initialize().catch((error: unknown) => {
      console.error(
        '[progress-bar-plugin] Failed to render progress bar:',
        error
      );
    });
  }

  /** Resolves once the bar is rendered and interactive. */
  whenReady(): Promise<void> {
    return this.ready ?? Promise.resolve();
  }

  private async initialize(): Promise<void> {
    this.progress = await this.loadInitialProgress();
    this.render();
    this.registerEvents();
  }

  /** Stable persistence key: one bar is scoped to one note. */
  private get memoryKey(): string {
    return `${this.notePath}-${this.options.name}`;
  }

  /**
   * Resolve the starting value: today's saved progress if any, otherwise the
   * `initialProgress` code-block option (the legacy build ignored that option
   * and always restarted at zero - fixed here).
   */
  private async loadInitialProgress(): Promise<number> {
    const data = await this.host.memory.load();
    const entry = data[this.memoryKey];
    if (entry?.date === todayISO()) {
      return entry.progress;
    }
    return this.options.initialProgress;
  }

  // ------------------------------------------------------------------
  // Rendering
  // ------------------------------------------------------------------

  private render(): void {
    const containerEl = this.containerEl;
    containerEl.style.display = 'flex';
    containerEl.style.flexDirection = 'column';
    containerEl.style.marginBottom = '1em';

    const trackEl = document.createElement('div');
    trackEl.style.display = 'flex';
    trackEl.style.alignItems = 'center';
    trackEl.style.backgroundColor = this.options.backgroundColor;
    trackEl.style.borderRadius = '5px';
    trackEl.style.overflow = 'hidden';
    trackEl.style.width = this.options.width;
    trackEl.style.height = this.options.height;
    trackEl.style.cursor = 'pointer';
    trackEl.style.position = 'relative';
    this.trackEl = trackEl;

    this.fillEl = document.createElement('div');
    this.fillEl.style.height = '100%';
    this.fillEl.style.backgroundColor = this.options.color;
    this.applyTransition(this.fillEl);
    trackEl.appendChild(this.fillEl);

    containerEl.appendChild(trackEl);

    if (this.options.legend !== '') {
      this.legendEl = document.createElement('div');
      this.legendEl.style.fontSize = this.options.legendFontSize;
      this.legendEl.style.textAlign = 'center';
      containerEl.appendChild(this.legendEl);
    }

    this.applyFill();
  }

  /** Reflect `progress` into the DOM as the fill width percentage. */
  private applyFill(): void {
    if (this.fillEl === null) {
      return;
    }
    this.fillEl.style.width = `${percentOf(
      this.progress,
      this.options.total
    )}%`;
    this.updateLegend();
  }

  /**
   * Apply the width transition configured by the `animation` option.
   * The `wave` mode additionally tiles the embedded wave texture.
   */
  private applyTransition(el: HTMLElement): void {
    switch (this.options.animation) {
      case 'instant':
        el.style.transition = 'none';
        break;
      case 'wave':
        el.style.transition = `width ${this.options.transitionDuration} ease-in-out`;
        el.style.backgroundImage = `url("${waveImageUrl}")`;
        el.style.backgroundSize = '200% 200%';
        break;
      case 'smooth':
        el.style.transition = `width ${this.options.transitionDuration}`;
        break;
    }
  }

  /** Play a short wave sweep after a change, matching legacy behavior. */
  private playWaveFlourish(): void {
    if (this.fillEl === null || this.options.animation !== 'wave') {
      return;
    }
    this.fillEl.style.animation = 'wave-animation 2s linear';
    const parsedSeconds = Number.parseFloat(this.options.transitionDuration);
    const delayMs =
      Number.isFinite(parsedSeconds) && parsedSeconds > 0
        ? parsedSeconds * 1000
        : DEFAULT_WAVE_ANIMATION_MS;
    setTimeout(() => {
      if (this.fillEl !== null) {
        this.fillEl.style.animation = 'none';
      }
    }, delayMs);
  }

  private updateLegend(): void {
    if (this.legendEl === null || this.options.legend === '') {
      return;
    }
    // Progress is already clamped to [0, total]; display it as an integer.
    const current = Math.round(this.progress);
    this.legendEl.innerText = applyLegendTemplate(
      this.options.legend,
      current,
      this.options.total,
      {
        progressTerm: this.host.settings.progressTerm,
        totalTerm: this.host.settings.totalTerm,
      }
    );
  }

  // ------------------------------------------------------------------
  // Interactions
  // ------------------------------------------------------------------

  private registerEvents(): void {
    if (this.trackEl === null) {
      return;
    }
    // Left click increments; events are auto-released on unload.
    this.registerDomEvent(this.trackEl, 'click', (event: MouseEvent) => {
      if (event.button === 0) {
        this.incrementProgress();
      }
    });

    if (!this.host.settings.enableResetOnRightClick) {
      return;
    }
    this.registerDomEvent(this.trackEl, 'contextmenu', (event: MouseEvent) => {
      event.preventDefault();
      this.resetProgress();
    });
  }

  /** Advance by `increment` (wrapping back to zero past the total). */
  private incrementProgress(): void {
    this.setProgress(
      nextProgressAfterClick(
        this.progress,
        this.options.increment,
        this.options.total
      )
    );
  }

  /** Reset today's progress to zero. */
  private resetProgress(): void {
    this.setProgress(0);
  }

  /** Single funnel for state changes: update memory, then reflect in DOM. */
  private setProgress(value: number): void {
    this.progress = value;
    this.applyFill();
    this.playWaveFlourish();
    void this.persistProgress(value);
  }

  private persistProgress(value: number): Promise<void> {
    return this.host.memory
      .updateEntry(this.memoryKey, () => ({
        date: todayISO(),
        progress: value,
      }))
      .catch((error: unknown) => {
        console.error('[progress-bar-plugin] Failed to save progress:', error);
      });
  }
}
