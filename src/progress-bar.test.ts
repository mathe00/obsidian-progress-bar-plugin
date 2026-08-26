/**
 * Integration-style tests for the ProgressBar component.
 * The `obsidian` import is aliased to a local runtime stub (see
 * vitest.config.mts), whose MarkdownRenderChild wires registerDomEvent to
 * real DOM listeners - so genuine click/contextmenu events can be dispatched
 * in happy-dom.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultSettings } from './types';
import { ProgressBar, type ProgressBarHost } from './progress-bar';
import { ProgressMemoryStore, type MinimalDataAdapter } from './memory';

interface FakeAdapter extends MinimalDataAdapter {
  content: string | undefined;
}

/** Host stub backed by an in-memory adapter (no real filesystem). */
function createHost(options?: { enableResetOnRightClick?: boolean }): {
  host: ProgressBarHost;
  adapter: FakeAdapter;
} {
  const adapter: FakeAdapter = {
    content: undefined,
    exists: () => Promise.resolve(adapter.content !== undefined),
    read: () => Promise.resolve(adapter.content ?? ''),
    write: (_path: string, data: string) => {
      adapter.content = data;
      return Promise.resolve();
    },
  };
  const settings = {
    ...createDefaultSettings(),
    enableResetOnRightClick: options?.enableResetOnRightClick ?? true,
  };
  return {
    host: { settings, memory: new ProgressMemoryStore(adapter, '') },
    adapter,
  };
}

/** Build a bar attached to the document and run its async initialization. */
async function mount(
  source: string,
  host: ProgressBarHost,
  notePath = 'notes/today.md'
): Promise<{ containerEl: HTMLElement; bar: ProgressBar }> {
  const containerEl = document.createElement('div');
  document.body.appendChild(containerEl);
  const bar = new ProgressBar(host, source, notePath, containerEl);
  bar.onload();
  await bar.whenReady();
  return { containerEl, bar };
}

/** The fill is the first grandchild (container > track > fill). */
function queryFill(containerEl: HTMLElement): {
  trackEl: HTMLElement;
  fillEl: HTMLElement;
} {
  const fillEl = containerEl.querySelector<HTMLElement>(':scope > div > div');
  const trackEl = fillEl?.parentElement;
  if (!fillEl || !trackEl) {
    throw new Error('Progress bar markup was not rendered');
  }
  return { trackEl, fillEl };
}

/** Flush pending memory writes (microtasks + timers). */
async function flush(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

describe('ProgressBar', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a track and a fill starting at zero', async () => {
    const { host } = createHost();
    const { containerEl } = await mount('', host);

    const { fillEl } = queryFill(containerEl);
    expect(fillEl.style.width).toBe('0%');
    expect(fillEl.style.backgroundColor).toBe('#4caf50');

    const { trackEl } = queryFill(containerEl);
    expect(trackEl.style.backgroundColor).toBe('#e0e0e0');
    expect(trackEl.style.cursor).toBe('pointer');
  });

  it('uses initialProgress before any saved value exists', async () => {
    const { host } = createHost();
    const { containerEl } = await mount(
      'total: 200\ninitialProgress: 50',
      host
    );

    const { fillEl } = queryFill(containerEl);
    expect(fillEl.style.width).toBe('25%'); // 50 / 200
  });

  it('left click increments and persists with today date', async () => {
    const { host, adapter } = createHost();
    const { containerEl } = await mount(
      'name: Water\ntotal: 3000\nincrement: 50',
      host
    );
    const { trackEl } = queryFill(containerEl);

    trackEl.dispatchEvent(new MouseEvent('click', { button: 0 }));
    await flush();

    const { fillEl } = queryFill(containerEl);
    expect(fillEl.style.width).toBe('1.67%'); // 50 / 3000, rounded to 2 decimals

    const saved = JSON.parse(adapter.content ?? '{}') as Record<
      string,
      { date: string; progress: number }
    >;
    expect(saved['notes/today.md-Water']).toEqual({
      date: new Date().toISOString().slice(0, 10),
      progress: 50,
    });
  });

  it('wraps back to zero when clicking past the total', async () => {
    const { host } = createHost();
    const { containerEl } = await mount(
      'name: Wrap\ntotal: 100\ninitialProgress: 100',
      host
    );
    const { trackEl } = queryFill(containerEl);

    trackEl.dispatchEvent(new MouseEvent('click', { button: 0 }));
    await flush();

    const { fillEl } = queryFill(containerEl);
    expect(fillEl.style.width).toBe('0%');
  });

  it('right click resets when enabled in settings', async () => {
    const { host, adapter } = createHost();
    const { containerEl } = await mount(
      'name: Resettable\ninitialProgress: 40',
      host
    );
    const { trackEl } = queryFill(containerEl);

    trackEl.dispatchEvent(new MouseEvent('contextmenu'));
    await flush();

    const { fillEl } = queryFill(containerEl);
    expect(fillEl.style.width).toBe('0%');

    const saved = JSON.parse(adapter.content ?? '{}') as Record<
      string,
      { progress: number }
    >;
    expect(saved['notes/today.md-Resettable']?.progress).toBe(0);
  });

  it('ignores right click reset when disabled in settings', async () => {
    const { host } = createHost({ enableResetOnRightClick: false });
    const { containerEl } = await mount(
      'name: Locked\ninitialProgress: 40',
      host
    );
    const { trackEl } = queryFill(containerEl);

    const event = new MouseEvent('contextmenu');
    const preventSpy = vi.spyOn(event, 'preventDefault');
    trackEl.dispatchEvent(event);

    const { fillEl } = queryFill(containerEl);
    expect(fillEl.style.width).toBe('40%');
    expect(preventSpy).not.toHaveBeenCalled();
  });

  it('renders a legend with placeholders substituted', async () => {
    const { host } = createHost();
    const { containerEl } = await mount(
      'name: Legend\nlegend: "Water: {current_progress}ml/{total}ml"\ntotal: 1000\ninitialProgress: 250',
      host
    );

    const legendEl = Array.from(containerEl.children).at(-1);
    if (!legendEl) {
      throw new Error('Legend element was not rendered');
    }
    expect((legendEl as HTMLElement).innerText).toBe('Water: 250ml/1000ml');
  });

  it('applies wave background image without crashing (legacy ReferenceError)', async () => {
    const { host } = createHost();
    const { containerEl } = await mount('name: Wavy\nanimation: wave', host);

    const { fillEl } = queryFill(containerEl);
    // esbuild embeds the SVG as a data URL in production bundles, while the
    // Vitest pipeline resolves it to an asset path - both are valid here.
    expect(fillEl.style.backgroundImage).toMatch(
      /data:image\/svg\+xml|wave\.svg/
    );
    expect(fillEl.style.transition).toContain('ease-in-out');
  });

  it('reuses today persisted progress instead of initialProgress', async () => {
    const { host, adapter } = createHost();
    // Simulate a save from earlier today.
    adapter.content = JSON.stringify({
      'notes/today.md-Remembered': {
        date: new Date().toISOString().slice(0, 10),
        progress: 7,
      },
    });

    const { containerEl } = await mount(
      'name: Remembered\ntotal: 100\ninitialProgress: 90',
      host
    );

    const { fillEl } = queryFill(containerEl);
    expect(fillEl.style.width).toBe('7%'); // saved value wins over initialProgress
  });
});
