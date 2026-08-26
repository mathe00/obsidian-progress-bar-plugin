/**
 * Shared domain types for the Interactive Progress Bar plugin.
 * Everything here is plain data - no Obsidian or DOM imports - so it can be
 * unit tested in isolation.
 */

/** Animation modes supported by a progress bar. */
export type AnimationMode = 'instant' | 'smooth' | 'wave';

/** All values are valid members of {@link AnimationMode}. */
export const ANIMATION_MODES: readonly AnimationMode[] = [
  'instant',
  'smooth',
  'wave',
];

/** Type guard narrowing an arbitrary string to an {@link AnimationMode}. */
export function isAnimationMode(value: string): value is AnimationMode {
  return (ANIMATION_MODES as readonly string[]).includes(value);
}

/** Global plugin settings, persisted by Obsidian in `data.json`. */
export interface PluginSettings {
  /** Placeholder replaced by the current progress inside legends. */
  progressTerm: string;
  /** Placeholder replaced by the total inside legends. */
  totalTerm: string;
  /** Default bar color when the code block does not define one. */
  barColor: string;
  /** Default track color when the code block does not define one. */
  backgroundColor: string;
  /** Default animation mode when the code block does not define one. */
  animation: AnimationMode;
  /** Default CSS transition duration (e.g. `"0.5s"`). */
  transitionDuration: string;
  /** Default legend font size (e.g. `"0.8em"`). */
  legendFontSize: string;
  /** Default value representing 100% of the bar. */
  total: number;
  /** Whether right-clicking a bar resets its progress to zero. */
  enableResetOnRightClick: boolean;
}

/** Factory returning fresh defaults so callers never share mutable state. */
export function createDefaultSettings(): PluginSettings {
  return {
    progressTerm: 'current_progress',
    totalTerm: 'total',
    barColor: '#4caf50',
    backgroundColor: '#e0e0e0',
    animation: 'smooth',
    transitionDuration: '0.5s',
    legendFontSize: '0.8em',
    total: 100,
    enableResetOnRightClick: true,
  };
}

/** {@linkcode parseBarSource} output with every field resolved against defaults. */
export interface ResolvedBarOptions {
  initialProgress: number;
  total: number;
  color: string;
  backgroundColor: string;
  increment: number;
  width: string;
  height: string;
  legend: string;
  animation: AnimationMode;
  transitionDuration: string;
  legendFontSize: string;
  name: string;
}

/** One persisted snapshot: valid for a single calendar day. */
export interface MemoryEntry {
  /** ISO date (`YYYY-MM-DD`) the entry was last updated. */
  date: string;
  /** Progress value at last update. */
  progress: number;
}

/** Shape of `progressBarMemory.json`: keyed by `<notePath>-<barName>`. */
export type MemoryData = Record<string, MemoryEntry>;

/**
 * Rebuild validated settings from arbitrary persisted data (`data.json`).
 * Unknown or malformed fields silently fall back to defaults, so a corrupted
 * file can never crash the plugin at startup.
 *
 * @param saved whatever `plugin.loadData()` returned
 */
export function normalizePluginSettings(saved: unknown): PluginSettings {
  const defaults = createDefaultSettings();
  if (typeof saved !== 'object' || saved === null || Array.isArray(saved)) {
    return defaults;
  }

  const fields = new Map(Object.entries(saved as Record<string, unknown>));

  /** Keep strings only when non-blank; anything else falls back. */
  const stringOr = (key: string, fallback: string): string => {
    const value = fields.get(key);
    return typeof value === 'string' && value.trim() !== '' ? value : fallback;
  };

  const animationCandidate = fields.get('animation');
  const totalCandidate = fields.get('total');
  const resetCandidate = fields.get('enableResetOnRightClick');

  return {
    progressTerm: stringOr('progressTerm', defaults.progressTerm),
    totalTerm: stringOr('totalTerm', defaults.totalTerm),
    barColor: stringOr('barColor', defaults.barColor),
    backgroundColor: stringOr('backgroundColor', defaults.backgroundColor),
    transitionDuration: stringOr(
      'transitionDuration',
      defaults.transitionDuration
    ),
    legendFontSize: stringOr('legendFontSize', defaults.legendFontSize),
    animation:
      typeof animationCandidate === 'string' &&
      isAnimationMode(animationCandidate)
        ? animationCandidate
        : defaults.animation,
    total:
      typeof totalCandidate === 'number' &&
      Number.isFinite(totalCandidate) &&
      totalCandidate > 0
        ? totalCandidate
        : defaults.total,
    enableResetOnRightClick:
      typeof resetCandidate === 'boolean'
        ? resetCandidate
        : defaults.enableResetOnRightClick,
  };
}
