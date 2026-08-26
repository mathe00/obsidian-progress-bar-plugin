# AGENTS.md — obsidian-progress-bar-plugin

Guidelines for AI agents (and humans) working in this repository.

## Project

Interactive progress bars inside Obsidian notes via ` ```progress-bar ` code
blocks: click to increment, right-click to reset, per-day persistence.
TypeScript rewrite of the original single-file JavaScript plugin.

## Commands (run with Bun)

| Command           | What it does                                              |
| ----------------- | --------------------------------------------------------- |
| `bun install`     | Install dependencies                                      |
| `bun run dev`     | Watch mode: rebuilds `main.js` + `styles.css` on change   |
| `bun run build`   | Typecheck (`tsc --noEmit`) + production esbuild bundle    |
| `bun run test`    | Vitest run (happy-dom environment)                        |
| `bun run lint`    | ESLint (strict type-checked config)                       |
| `bun run format`  | Prettier write                                            |
| `bun run check`   | Full pipeline: typecheck + lint + format + tests + build  |

Always run `bun run check` before considering work done. It must exit 0.

## Architecture

```
src/
  main.ts          Plugin entry: settings load/save, code-block processor,
                   memory store wiring. Kept deliberately thin.
  types.ts         Pure domain types + defaults + normalizePluginSettings().
  utils.ts         Pure helpers: source parser, legend templating, clamping.
  memory.ts        ProgressMemoryStore - persists progressBarMemory.json
                   through the vault adapter (no raw fs/path).
  progress-bar.ts  ProgressBar extends MarkdownRenderChild; rendering +
                   interactions. Render happens in its own onload() via
                   ctx.addChild() in main.ts.
  settings.ts      Settings tab (typed inputs, validated onChange handlers).
  styles/wave.css  CSS sources concatenated into root styles.css at build.
  testing/obsidian-stub.ts  Runtime stub for the types-only `obsidian`
                            package, aliased in vitest.config.mts.
```

Design rules:

- Pure logic lives in `utils.ts`/`types.ts` and must stay free of Obsidian/DOM
  imports so it is unit-testable without mocks.
- Persistence goes exclusively through the Obsidian vault adapter API
  (desktop **and** mobile). Never import `fs`/`path` for plugin data.
- DOM events are attached with `registerDomEvent`; never raw
  `addEventListener` inside components.
- The wave texture is embedded at bundle time by esbuild's `.svg → dataurl`
  loader (see `esbuild.config.mjs`). Do not reference asset files at runtime.

## Conventions

- TypeScript strictest tsconfig (all strict flags, `exactOptionalPropertyTypes`,
  `noUncheckedIndexedAccess`, …). Do not weaken flags to make errors disappear;
  fix the code.
- ESLint `strictTypeChecked` + `stylisticTypeChecked`. Notable rules:
  no `any`, no non-null assertions, explicit `override`, parameter properties
  preferred, `eqeqeq`, no dynamic `delete` (rebuild objects instead).
- Prettier: single quotes, 2 spaces, 80 cols, ES5 trailing commas.
- English everywhere (code, comments, docs, commit messages).

## Known constraints / gotchas

- **TypeScript version**: pinned to latest 5.x. TS 7 (native Go compiler) is GA
  but ships no programmatic API until 7.1, so `typescript-eslint` cannot run on
  it yet (peer range `<6.1.0`; see typescript-eslint issue #10940). When 7.1
  lands its stable API, bump `typescript` and re-verify `bun run check`.
  The intermediate `@typescript/typescript6@6.0.2` bridge package is broken
  (circular self-alias dependency) - do not use it.
- The npm `obsidian` package contains **only type definitions**. That is why
  Vitest aliases it to `src/testing/obsidian-stub.ts`.
- Bun's global supply-chain config (~/.bunfig.toml) enforces a 3-day release
  cooldown. If a brand-new dependency version fails to resolve, pin the latest
 *mature* release instead of bypassing the cooldown.
- `main.js`, `styles.css` and `progressBarMemory.json` are generated/runtime
  files: git-ignored, never edit them by hand. Edit `src/**` and rebuild.
- Releasing: bump with `bun version patch|minor|major` (runs
  `version-bump.mjs`, syncing `manifest.json` + `versions.json`), then push a
  matching tag; CI/release notes attach the built files.
