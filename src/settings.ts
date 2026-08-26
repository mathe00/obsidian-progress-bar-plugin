/**
 * Global settings tab.
 *
 * Every input is validated before touching state: numeric fields fall back to
 * their previous value instead of persisting `NaN` (a legacy bug), and the
 * animation dropdown only accepts known modes.
 */

import { PluginSettingTab, Setting } from 'obsidian';
import { type App } from 'obsidian';
import { ANIMATION_MODES, type AnimationMode, isAnimationMode } from './types';
import { parseIntSafe } from './utils';
// Type-only: avoids a runtime circular dependency with the entry point.
import type ProgressBarsPlugin from './main';

/** Capitalized display labels for the animation dropdown. */
const ANIMATION_LABELS: Record<AnimationMode, string> = {
  instant: 'Instant',
  smooth: 'Smooth',
  wave: 'Wave',
};

/** Settings tab listing every option plus inline usage documentation. */
export class ProgressBarSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: ProgressBarsPlugin
  ) {
    super(app, plugin);
  }

  override display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl('h2', { text: 'Interactive Progress Bar Settings' });

    this.addTextTermSetting();
    this.addTotalTermSetting();
    this.addBarColorSetting();
    this.addBackgroundColorSetting();
    this.addAnimationSetting();
    this.addTransitionDurationSetting();
    this.addLegendFontSizeSetting();
    this.addTotalValueSetting();
    this.addResetToggleSetting();

    containerEl.createEl('hr');
    this.renderDocumentation();
  }

  // ------------------------------------------------------------------
  // Individual settings
  // ------------------------------------------------------------------

  private async persist(): Promise<void> {
    await this.plugin.saveSettings();
  }

  private addTextTermSetting(): void {
    new Setting(this.containerEl)
      .setName('Progress Term')
      .setDesc(
        'Placeholder replaced by the current progress inside legend texts.'
      )
      .addText((text) =>
        text
          .setPlaceholder('current_progress')
          .setValue(this.plugin.settings.progressTerm)
          .onChange((value) => {
            if (value.trim() === '') {
              return;
            }
            this.plugin.settings.progressTerm = value;
            void this.persist();
          })
      );
  }

  private addTotalTermSetting(): void {
    new Setting(this.containerEl)
      .setName('Total Term')
      .setDesc('Placeholder replaced by the total inside legend texts.')
      .addText((text) =>
        text
          .setPlaceholder('total')
          .setValue(this.plugin.settings.totalTerm)
          .onChange((value) => {
            if (value.trim() === '') {
              return;
            }
            this.plugin.settings.totalTerm = value;
            void this.persist();
          })
      );
  }

  private addBarColorSetting(): void {
    new Setting(this.containerEl)
      .setName('Default Bar Color')
      .setDesc('Default fill color of the progress bar.')
      .addText((text) =>
        text
          .setPlaceholder('#4caf50')
          .setValue(this.plugin.settings.barColor)
          .onChange((value) => {
            if (value.trim() === '') {
              return;
            }
            this.plugin.settings.barColor = value;
            void this.persist();
          })
      );
  }

  private addBackgroundColorSetting(): void {
    new Setting(this.containerEl)
      .setName('Default Background Color')
      .setDesc('Default track color behind the bar fill.')
      .addText((text) =>
        text
          .setPlaceholder('#e0e0e0')
          .setValue(this.plugin.settings.backgroundColor)
          .onChange((value) => {
            if (value.trim() === '') {
              return;
            }
            this.plugin.settings.backgroundColor = value;
            void this.persist();
          })
      );
  }

  private addAnimationSetting(): void {
    new Setting(this.containerEl)
      .setName('Animation Type')
      .setDesc('Default animation applied to width changes.')
      .addDropdown((dropdown) => {
        for (const mode of ANIMATION_MODES) {
          dropdown.addOption(mode, ANIMATION_LABELS[mode]);
        }
        return dropdown
          .setValue(this.plugin.settings.animation)
          .onChange((value) => {
            if (!isAnimationMode(value)) {
              return;
            }
            this.plugin.settings.animation = value;
            void this.persist();
          });
      });
  }

  private addTransitionDurationSetting(): void {
    new Setting(this.containerEl)
      .setName('Transition Duration')
      .setDesc('CSS duration of the transition animation (e.g. "0.5s").')
      .addText((text) =>
        text
          .setPlaceholder('0.5s')
          .setValue(this.plugin.settings.transitionDuration)
          .onChange((value) => {
            if (value.trim() === '') {
              return;
            }
            this.plugin.settings.transitionDuration = value;
            void this.persist();
          })
      );
  }

  private addLegendFontSizeSetting(): void {
    new Setting(this.containerEl)
      .setName('Legend Font Size')
      .setDesc('Font size of the legend text (e.g. "0.8em").')
      .addText((text) =>
        text
          .setPlaceholder('0.8em')
          .setValue(this.plugin.settings.legendFontSize)
          .onChange((value) => {
            if (value.trim() === '') {
              return;
            }
            this.plugin.settings.legendFontSize = value;
            void this.persist();
          })
      );
  }

  private addTotalValueSetting(): void {
    new Setting(this.containerEl)
      .setName('Total Value')
      .setDesc('Default value representing 100% of the bar.')
      .addText((text) =>
        text
          .setPlaceholder('100')
          .setValue(`${this.plugin.settings.total}`)
          .onChange((value) => {
            const parsed = parseIntSafe(value);
            if (parsed === undefined || parsed <= 0) {
              return; // Keep the previous valid total instead of storing NaN.
            }
            this.plugin.settings.total = parsed;
            void this.persist();
          })
      );
  }

  private addResetToggleSetting(): void {
    new Setting(this.containerEl)
      .setName('Enable Reset on Right Click')
      .setDesc('Allow resetting a progress bar to zero with a right-click.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.enableResetOnRightClick)
          .onChange((value) => {
            this.plugin.settings.enableResetOnRightClick = value;
            void this.persist();
          })
      );
  }

  // ------------------------------------------------------------------
  // Inline documentation
  // ------------------------------------------------------------------

  private renderDocumentation(): void {
    const { containerEl } = this;

    containerEl.createEl('h2', { text: 'Documentation' });
    containerEl.createEl('p', {
      text: 'This plugin renders interactive progress bars inside ```progress-bar``` code blocks. Available options:',
    });

    const optionLines = [
      'name: unique alphabetic identifier used to remember progress per note.',
      'initialProgress: starting value shown when nothing was saved today.',
      'total: value representing 100% for this bar.',
      'color: fill color of the bar.',
      'backgroundColor: track color behind the fill.',
      'increment: amount added on each left click.',
      'width: CSS width of the widget (e.g. "100%").',
      'height: CSS height of the track (e.g. "30px").',
      'legend: text below the bar; supports {current_progress} and {total}.',
      'animation: one of "instant", "smooth", "wave".',
      'transitionDuration: CSS duration of the transition (e.g. "1s").',
      'legendFontSize: font size of the legend text (e.g. "1em").',
    ];
    containerEl.createEl('ul', {}, (ul) => {
      for (const line of optionLines) {
        ul.createEl('li', { text: line });
      }
    });

    containerEl.createEl('h3', { text: 'Examples' });
    this.renderExample(containerEl, [
      'initialProgress: 50',
      'total: 200',
      'color: #ff0000',
      'backgroundColor: #000000',
      'increment: 5',
      'width: 100%',
      'height: 30px',
      'legend: "Progress: {current_progress}/{total}"',
      'animation: wave',
      'transitionDuration: 1s',
      'legendFontSize: 1em',
    ]);
    this.renderExample(containerEl, [
      'initialProgress: 70',
      'total: 150',
      'color: #00ff00',
      'width: 80%',
      'height: 20px',
      'legend: "Completed: {current_progress}%"',
      'animation: smooth',
    ]);
  }

  private renderExample(parentEl: HTMLElement, lines: string[]): void {
    parentEl.createEl('pre', {}, (pre) => {
      pre.createEl('code', {
        text: ['```progress-bar', ...lines, '```'].join('\n'),
      });
    });
  }
}
