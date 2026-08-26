/**
 * Unit tests for the pure helpers (parsing, templating, arithmetic).
 * These cover the exact spots where the legacy implementation had bugs.
 */

import { describe, expect, it } from 'vitest';
import {
  applyLegendTemplate,
  clampToTotal,
  nextProgressAfterClick,
  parseBarSource,
  parseIntSafe,
  percentOf,
  resolveBarOptions,
  sanitizeBarName,
  stripQuotes,
  todayISO,
} from './utils';
import { createDefaultSettings } from './types';

describe('todayISO', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(todayISO(new Date('2026-08-26T14:30:00Z'))).toBe('2026-08-26');
  });
});

describe('parseIntSafe', () => {
  it('parses plain integers', () => {
    expect(parseIntSafe('42')).toBe(42);
    expect(parseIntSafe(' -7 ')).toBe(-7);
  });

  it('returns undefined for missing or non-numeric input', () => {
    expect(parseIntSafe(undefined)).toBeUndefined();
    expect(parseIntSafe('')).toBeUndefined();
    expect(parseIntSafe('abc')).toBeUndefined();
  });

  it('tolerates trailing junk like legacy parseInt ("12px" -> 12)', () => {
    // Deliberate: keeps notes using values such as "50%" working exactly as
    // before the TypeScript rewrite.
    expect(parseIntSafe('12px')).toBe(12);
    expect(parseIntSafe('50%')).toBe(50);
  });
});

describe('stripQuotes', () => {
  it('removes one pair of matching surrounding quotes', () => {
    expect(stripQuotes('"hello"')).toBe('hello');
    expect(stripQuotes("'hello'")).toBe('hello');
  });

  it('keeps unquoted or unbalanced values untouched', () => {
    expect(stripQuotes('hello')).toBe('hello');
    expect(stripQuotes('"unbalanced')).toBe('"unbalanced');
    expect(stripQuotes("don't")).toBe("don't");
  });
});

describe('clampToTotal and percentOf', () => {
  it('clamps progress into [0, total]', () => {
    expect(clampToTotal(50, 100)).toBe(50);
    expect(clampToTotal(-5, 100)).toBe(0);
    expect(clampToTotal(150, 100)).toBe(100);
  });

  it('is safe for zero or negative totals (legacy divided by zero)', () => {
    expect(clampToTotal(10, 0)).toBe(0);
    expect(percentOf(10, 0)).toBe(0);
    expect(percentOf(10, -5)).toBe(0);
  });

  it('computes bounded percentages', () => {
    expect(percentOf(25, 200)).toBe(12.5);
    expect(percentOf(300, 200)).toBe(100);
  });
});

describe('nextProgressAfterClick', () => {
  it('increments and clamps to the total', () => {
    expect(nextProgressAfterClick(90, 10, 100)).toBe(100);
    expect(nextProgressAfterClick(95, 20, 100)).toBe(100);
  });

  it('wraps back to zero once the total is reached', () => {
    expect(nextProgressAfterClick(100, 10, 100)).toBe(0);
    expect(nextProgressAfterClick(120, 10, 100)).toBe(0);
  });
});

describe('applyLegendTemplate', () => {
  const terms = { progressTerm: 'current_progress', totalTerm: 'total' };

  it('replaces both placeholders with rounded numbers', () => {
    expect(
      applyLegendTemplate('{current_progress}ml/{total}ml', 250.4, 3000, terms)
    ).toBe('250ml/3000ml');
  });

  it('supports custom term names from settings', () => {
    expect(
      applyLegendTemplate('done = {done}, remaining = {goal}', 2, 10, {
        progressTerm: 'done',
        totalTerm: 'goal',
      })
    ).toBe('done = 2, remaining = 10');
  });

  it('replaces every occurrence (legacy only replaced the first)', () => {
    expect(applyLegendTemplate('{total}/{total}', 1, 8, terms)).toBe('8/8');
  });
});

describe('parseBarSource', () => {
  it('splits options on newlines and commas', () => {
    expect(parseBarSource('color: red\nincrement: 5, total: 10')).toEqual({
      color: 'red',
      increment: '5',
      total: '10',
    });
  });

  it('preserves colons inside values (legacy truncated them)', () => {
    expect(parseBarSource('legend: Time 12:30 left')).toEqual({
      legend: 'Time 12:30 left',
    });
  });

  it('strips surrounding quotes from values', () => {
    expect(parseBarSource('legend: "Water: {current_progress}"')).toEqual({
      legend: 'Water: {current_progress}',
    });
  });

  it('skips blank lines and key-less fragments', () => {
    expect(parseBarSource('\n\n   \njusttext\nname: Ok\n,')).toEqual({
      name: 'Ok',
    });
  });
});

describe('sanitizeBarName', () => {
  it('keeps alphabetic characters only (legacy behavior)', () => {
    expect(sanitizeBarName('Blue Water 2026!')).toBe('BlueWater');
    expect(sanitizeBarName('12345')).toBe('');
  });
});

describe('resolveBarOptions', () => {
  const settings = createDefaultSettings();
  const fixedId = () => 'abcd1234efgh';

  it('falls back to settings defaults for missing keys', () => {
    const options = resolveBarOptions('name: Bar', settings, fixedId);
    expect(options).toMatchObject({
      color: '#4caf50',
      backgroundColor: '#e0e0e0',
      animation: 'smooth',
      transitionDuration: '0.5s',
      legendFontSize: '0.8em',
      total: 100,
      increment: 10,
      width: '100%',
      height: '30px',
      legend: '',
      initialProgress: 0,
      name: 'Bar',
    });
  });

  it('applies code-block overrides on top of defaults', () => {
    const source = [
      'total: 3000',
      'increment: 50',
      'color: #0055ff',
      'animation: wave',
      'initialProgress: 250',
    ].join('\n');
    const options = resolveBarOptions(source, settings, fixedId);
    expect(options.total).toBe(3000);
    expect(options.increment).toBe(50);
    expect(options.color).toBe('#0055ff');
    expect(options.animation).toBe('wave');
    expect(options.initialProgress).toBe(250);
  });

  it('rejects unknown animation modes instead of writing broken CSS', () => {
    const options = resolveBarOptions('animation: rainbow', settings, fixedId);
    expect(options.animation).toBe('smooth');
  });

  it('sanitizes names and generates a fallback when empty', () => {
    expect(resolveBarOptions('name: B4r!', settings, fixedId).name).toBe('Br');
    expect(resolveBarOptions('', settings, fixedId).name).toBe('bar-abcd1');
  });
});
