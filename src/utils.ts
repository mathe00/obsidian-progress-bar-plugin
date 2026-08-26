/**
 * Pure helpers shared by the parser, the renderer and the persistence layer.
 * No Obsidian or DOM dependency here: everything is unit-testable as-is.
 */

import {
  type PluginSettings,
  type ResolvedBarOptions,
  isAnimationMode,
} from './types';

/** Current day as a local-independent ISO date string (`YYYY-MM-DD`). */
export function todayISO(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Parse a string into an integer, returning `undefined` instead of `NaN`
 * when the input is missing or not numeric.
 */
export function parseIntSafe(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/**
 * Remove one pair of matching surrounding quotes (`"` or `'`) if present.
 * Users naturally write `legend: "..."` although quotes are not required.
 */
export function stripQuotes(value: string): string {
  const trimmed = value.trim();
  const first = trimmed.charAt(0);
  const last = trimmed.charAt(trimmed.length - 1);
  const isQuoted =
    trimmed.length >= 2 && (first === '"' || first === "'") && first === last;
  return isQuoted ? trimmed.slice(1, -1) : trimmed;
}

/** Clamp a progress value into the `[0, total]` range (safe for `total <= 0`). */
export function clampToTotal(progress: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.min(total, Math.max(0, progress));
}

/** Percentage of the bar to fill, always within `[0, 100]` (safe for `total <= 0`).
 * Rounded to two decimals to avoid IEEE-754 noise such as `7.000000000001%`. */
export function percentOf(progress: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  const raw = (progress / total) * 100;
  return Math.min(100, Math.max(0, Math.round(raw * 100) / 100));
}

/**
 * Next progress after a click, reproducing the historical plugin behavior:
 * clicking past the total resets the bar to zero instead of staying stuck.
 */
export function nextProgressAfterClick(
  progress: number,
  increment: number,
  total: number
): number {
  if (progress >= total) {
    return 0;
  }
  return clampToTotal(progress + increment, total);
}

/**
 * Replace `{term}` placeholders in a legend template.
 * Every occurrence is replaced (the legacy implementation only replaced the
 * first one, which broke legends mentioning the placeholder twice).
 */
export function applyLegendTemplate(
  legend: string,
  current: number,
  total: number,
  terms: { progressTerm: string; totalTerm: string }
): string {
  return legend
    .split(`{${terms.progressTerm}}`)
    .join(current.toFixed(0))
    .split(`{${terms.totalTerm}}`)
    .join(`${total}`);
}

/**
 * Split a raw code-block body into `key -> rawValue` pairs.
 *
 * Improvements over the legacy parser:
 * - commas and newlines both separate options (as before),
 * - values containing colons (e.g. `legend: Time 12:30`) are preserved,
 *   because only the *first* colon separates key from value,
 * - surrounding quotes are stripped from values.
 */
export function parseBarSource(source: string): Record<string, string> {
  const params = source.split(/[\n,]+/);
  const result: Record<string, string> = {};

  for (const param of params) {
    const trimmedParam = param.trim();
    if (trimmedParam === '') {
      continue;
    }
    const separatorIndex = trimmedParam.indexOf(':');
    // A line without ":" carries no usable key/value pair - skip it silently.
    if (separatorIndex === -1) {
      continue;
    }
    const key = trimmedParam.slice(0, separatorIndex).trim();
    const value = stripQuotes(trimmedParam.slice(separatorIndex + 1));
    if (key !== '') {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Strip every non-alphabetic character from a user-provided bar name.
 * Returns an empty string when nothing alphabetic remains.
 */
export function sanitizeBarName(name: string): string {
  return name.replace(/[^a-zA-Z]/g, '');
}

/** Deterministic-in-tests factory for random bar identifiers. */
export type IdGenerator = () => string;

/** Default identifier generator: short, URL-safe, collision-resistant enough. */
export const randomIdGenerator: IdGenerator = () =>
  Math.random().toString(36).slice(2, 11);

/**
 * Resolve raw code-block options against plugin settings.
 *
 * @param source raw body of a ```progress-bar``` code block
 * @param settings current global plugin settings (used as fallbacks)
 * @param generateId injected so tests can be deterministic
 */
export function resolveBarOptions(
  source: string,
  settings: PluginSettings,
  generateId: IdGenerator = randomIdGenerator
): ResolvedBarOptions {
  const raw = parseBarSource(source);

  const rawName = raw['name'];
  const sanitizedName = rawName !== undefined ? sanitizeBarName(rawName) : '';
  const name =
    sanitizedName !== '' ? sanitizedName : `bar-${generateId().slice(0, 5)}`;

  const parsedAnimationCandidate = raw['animation'];
  const parsedAnimation =
    parsedAnimationCandidate !== undefined &&
    isAnimationMode(parsedAnimationCandidate)
      ? parsedAnimationCandidate
      : undefined;

  return {
    initialProgress: parseIntSafe(raw['initialProgress']) ?? 0,
    total: parseIntSafe(raw['total']) ?? settings.total,
    color: raw['color'] ?? settings.barColor,
    backgroundColor: raw['backgroundColor'] ?? settings.backgroundColor,
    increment: parseIntSafe(raw['increment']) ?? 10,
    width: raw['width'] ?? '100%',
    height: raw['height'] ?? '30px',
    legend: raw['legend'] ?? '',
    animation: parsedAnimation ?? settings.animation,
    transitionDuration:
      raw['transitionDuration'] ?? settings.transitionDuration,
    legendFontSize: raw['legendFontSize'] ?? settings.legendFontSize,
    name,
  };
}
