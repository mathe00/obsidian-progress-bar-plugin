import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // The real `obsidian` package is types-only (no runtime JavaScript).
      // Components under test import this minimal stub instead.
      obsidian: fileURLToPath(
        new URL('./src/testing/obsidian-stub.ts', import.meta.url)
      ),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    // Progress bars manipulate the DOM, so tests run in a browser-like
    // environment.
    environment: 'happy-dom',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/main.ts',
        'src/env.d.ts',
        'src/testing/**',
      ],
    },
  },
});
