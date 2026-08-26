/**
 * Daily progress persistence layer.
 *
 * Replaces the legacy direct `fs` usage with Obsidian's vault adapter API:
 * - works identically on desktop and mobile,
 * - paths are resolved relative to the plugin folder declared in the manifest,
 * - corrupted or missing files degrade gracefully to an empty store.
 *
 * The store only depends on a structural subset of Obsidian's `DataAdapter`,
 * so unit tests can pass a plain fake without mocking the `obsidian` module.
 */

import { todayISO } from './utils';
import { type MemoryData, type MemoryEntry } from './types';

/** Name of the persistence file living next to the built plugin. */
export const MEMORY_FILE_NAME = 'progressBarMemory.json';

/** Minimal slice of Obsidian's `DataAdapter` used by the store. */
export interface MinimalDataAdapter {
  exists(normalizedPath: string): Promise<boolean>;
  read(normalizedPath: string): Promise<string>;
  write(normalizedPath: string, data: string): Promise<void>;
}

/** Build the vault-normalized path of the memory file inside `pluginDir`. */
export function memoryFilePath(pluginDir: string): string {
  const cleanDir = pluginDir.replace(/\/+$/, '');
  return cleanDir === '' ? MEMORY_FILE_NAME : `${cleanDir}/${MEMORY_FILE_NAME}`;
}

/**
 * Coerce an unknown parsed JSON value into a {@link MemoryEntry}.
 * Returns `undefined` for anything missing required fields or wrong types.
 */
export function toMemoryEntry(value: unknown): MemoryEntry | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const fields = new Map(Object.entries(value as Record<string, unknown>));
  const date = fields.get('date');
  const progress = fields.get('progress');
  if (typeof date !== 'string' || typeof progress !== 'number') {
    return undefined;
  }
  return { date, progress };
}

/**
 * Parse raw file content into validated {@link MemoryData}.
 * Invalid JSON propagates (the caller handles it); individually malformed
 * entries are skipped so one bad key cannot wipe out valid progress.
 */
export function parseMemoryData(content: string): MemoryData {
  const parsed: unknown = JSON.parse(content);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {};
  }

  const data: MemoryData = {};
  for (const [key, rawEntry] of Object.entries(
    parsed as Record<string, unknown>
  )) {
    const entry = toMemoryEntry(rawEntry);
    if (entry !== undefined) {
      data[key] = entry;
    }
  }
  return data;
}

/** Read/write access to the per-day progress memory. */
export class ProgressMemoryStore {
  constructor(
    private readonly adapter: MinimalDataAdapter,
    private readonly pluginDir: string
  ) {}

  /** Load the full memory map; never throws - failures yield an empty store. */
  async load(): Promise<MemoryData> {
    try {
      const filePath = memoryFilePath(this.pluginDir);
      const exists = await this.adapter.exists(filePath);
      if (!exists) {
        return {};
      }
      const content = await this.adapter.read(filePath);
      return parseMemoryData(content);
    } catch (error) {
      console.error(
        `[progress-bar-plugin] Failed to read ${MEMORY_FILE_NAME}:`,
        error
      );
      return {};
    }
  }

  /** Persist the full memory map; failures are logged, not thrown. */
  async save(data: MemoryData): Promise<void> {
    try {
      await this.adapter.write(
        memoryFilePath(this.pluginDir),
        JSON.stringify(data, null, 2)
      );
    } catch (error) {
      console.error(
        `[progress-bar-plugin] Failed to write ${MEMORY_FILE_NAME}:`,
        error
      );
    }
  }

  /**
   * Read-modify-write a single entry under `memoryKey`.
   *
   * @param memoryKey stable identifier (`<notePath>-<barName>`)
   * @param update receives the current entry (or `undefined`) and returns
   *               the entry to persist
   */
  async updateEntry(
    memoryKey: string,
    update: (current: MemoryEntry | undefined) => MemoryEntry
  ): Promise<void> {
    const data = await this.load();
    data[memoryKey] = update(data[memoryKey]);
    await this.save(data);
  }

  /**
   * Drop every entry whose date differs from `today`.
   * Rebuilds the map instead of deleting keys dynamically.
   *
   * @returns the number of pruned entries
   */
  async pruneOldEntries(today: string = todayISO()): Promise<number> {
    const data = await this.load();
    const kept: MemoryData = {};
    let pruned = 0;

    for (const [key, entry] of Object.entries(data)) {
      if (entry.date === today) {
        kept[key] = entry;
      } else {
        pruned += 1;
      }
    }

    if (pruned > 0) {
      await this.save(kept);
    }
    return pruned;
  }
}
