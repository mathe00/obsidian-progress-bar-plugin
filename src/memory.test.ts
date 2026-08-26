/**
 * Unit tests for the persistence layer.
 * A tiny in-memory fake adapter replaces Obsidian's `DataAdapter`, so no
 * module mocking is required here.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  MEMORY_FILE_NAME,
  ProgressMemoryStore,
  memoryFilePath,
  parseMemoryData,
  toMemoryEntry,
  type MinimalDataAdapter,
} from './memory';

/** In-memory DataAdapter fake recording every write for assertions. */
function createFakeAdapter(initialContent?: string): MinimalDataAdapter & {
  written: string[];
} {
  const written: string[] = [];
  return {
    written,
    exists: () => Promise.resolve(initialContent !== undefined),
    read: () => Promise.resolve(initialContent ?? ''),
    write: (_path: string, data: string) => {
      written.push(data);
      return Promise.resolve();
    },
  };
}

describe('memoryFilePath', () => {
  it('joins the plugin dir with the file name', () => {
    expect(memoryFilePath('.obsidian/plugins/progress-bar-plugin')).toBe(
      `.obsidian/plugins/progress-bar-plugin/${MEMORY_FILE_NAME}`
    );
  });

  it('tolerates trailing slashes and empty dirs', () => {
    expect(memoryFilePath('plugins/foo/')).toBe(
      `plugins/foo/${MEMORY_FILE_NAME}`
    );
    expect(memoryFilePath('')).toBe(MEMORY_FILE_NAME);
  });
});

describe('toMemoryEntry', () => {
  it('accepts well-formed entries', () => {
    expect(toMemoryEntry({ date: '2026-08-26', progress: 3 })).toEqual({
      date: '2026-08-26',
      progress: 3,
    });
  });

  it('rejects malformed entries instead of trusting them', () => {
    expect(toMemoryEntry(null)).toBeUndefined();
    expect(toMemoryEntry('nope')).toBeUndefined();
    expect(toMemoryEntry({ date: 42, progress: 3 })).toBeUndefined();
    expect(toMemoryEntry({ date: '2026-08-26' })).toBeUndefined();
    expect(toMemoryEntry({ progress: 'many' })).toBeUndefined();
  });
});

describe('parseMemoryData', () => {
  it('parses valid content and skips malformed entries', () => {
    const data = parseMemoryData(
      JSON.stringify({
        good: { date: '2026-08-26', progress: 7 },
        bad: { whatever: true },
      })
    );
    expect(data).toEqual({
      good: { date: '2026-08-26', progress: 7 },
    });
  });

  it('degrades arrays and primitives to an empty store', () => {
    expect(parseMemoryData('[1,2]')).toEqual({});
    expect(parseMemoryData('42')).toEqual({});
    expect(parseMemoryData('"str"')).toEqual({});
  });
});

describe('ProgressMemoryStore', () => {
  it('returns an empty store when the file does not exist', async () => {
    const adapter = createFakeAdapter(undefined);
    const store = new ProgressMemoryStore(adapter, 'plugin-dir');
    await expect(store.load()).resolves.toEqual({});
  });

  it('survives corrupted JSON by returning an empty store', async () => {
    const warnSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const adapter = createFakeAdapter('{not json!');
    const store = new ProgressMemoryStore(adapter, 'plugin-dir');
    await expect(store.load()).resolves.toEqual({});
    expect(warnSpy).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
  });

  it('updateEntry reads, modifies and writes back atomically', async () => {
    const adapter = createFakeAdapter(
      JSON.stringify({
        'note.md-Water': { date: '2026-01-01', progress: 1 },
      })
    );
    const store = new ProgressMemoryStore(adapter, 'plugin-dir');

    await store.updateEntry('note.md-Water', (current) => ({
      date: '2026-08-26',
      progress: (current?.progress ?? 0) + 1,
    }));

    expect(adapter.written).toHaveLength(1);
    const saved = JSON.parse(adapter.written[0] ?? '{}') as Record<
      string,
      { date: string; progress: number }
    >;
    expect(saved['note.md-Water']).toEqual({
      date: '2026-08-26',
      progress: 2,
    });
  });

  it('pruneOldEntries removes entries from other days only', async () => {
    const adapter = createFakeAdapter(
      JSON.stringify({
        keepMe: { date: '2026-08-26', progress: 5 },
        dropMe: { date: '2026-08-25', progress: 9 },
        dropMeToo: { date: '2025-12-31', progress: 1 },
      })
    );
    const store = new ProgressMemoryStore(adapter, 'plugin-dir');

    await expect(store.pruneOldEntries('2026-08-26')).resolves.toBe(2);

    const saved = JSON.parse(adapter.written[0] ?? '{}') as Record<
      string,
      unknown
    >;
    expect(Object.keys(saved)).toEqual(['keepMe']);
  });

  it('pruneOldEntries does not rewrite the file when nothing changed', async () => {
    const adapter = createFakeAdapter(
      JSON.stringify({ fresh: { date: '2026-08-26', progress: 1 } })
    );
    const store = new ProgressMemoryStore(adapter, 'plugin-dir');
    await expect(store.pruneOldEntries('2026-08-26')).resolves.toBe(0);
    expect(adapter.written).toHaveLength(0);
  });
});
