/**
 * Plugin entry point.
 *
 * Responsibilities are deliberately thin: load/validate settings, expose the
 * memory store, register the ```progress-bar``` code-block processor and the
 * settings tab. Rendering and persistence live in their own modules.
 */

import { Plugin } from 'obsidian';
import { ProgressBar, type ProgressBarHost } from './progress-bar';
import { ProgressMemoryStore } from './memory';
import { ProgressBarSettingTab } from './settings';
import { normalizePluginSettings } from './types';

/**
 * Interactive Progress Bar plugin.
 *
 * Renders clickable progress bars from ```progress-bar``` code blocks.
 * Each bar persists its own daily progress in
 * `<plugin-folder>/progressBarMemory.json` through the vault adapter.
 */
export default class ProgressBarsPlugin
  extends Plugin
  implements ProgressBarHost
{
  /** Validated settings - always a complete object, never partial data. */
  override settings = normalizePluginSettings(undefined);

  /** Initialized during `onload`, once the vault adapter is available. */
  memory!: ProgressMemoryStore;

  override async onload(): Promise<void> {
    this.settings = normalizePluginSettings(await this.loadData());

    // The adapter API works on desktop and mobile alike (the legacy build
    // used raw `fs`, which broke the `isDesktopOnly: false` promise).
    this.memory = new ProgressMemoryStore(
      this.app.vault.adapter,
      this.manifest.dir ?? ''
    );

    this.registerMarkdownCodeBlockProcessor(
      'progress-bar',
      (source, el, ctx) => {
        // The child component renders itself during its own onload() and
        // Obsidian tears it down automatically with the view.
        ctx.addChild(new ProgressBar(this, source, ctx.sourcePath, el));
      }
    );

    this.addSettingTab(new ProgressBarSettingTab(this.app, this));

    // Daily reset: drop entries not stamped with today's date.
    await this.memory.pruneOldEntries();
  }

  /**
   * Persist current settings to `data.json`.
   * Called by the settings tab after every validated change.
   */
  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
