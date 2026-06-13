---
name: run-fantasy-card-battle
description: Build, launch, and drive 奥术王座 / Fantasy Card Battle — the Vite + React card-game web app. Use to run, start, dev-serve, screenshot, or smoke-test the app in a real browser (menu, deck builder, "我的牌组" panel, live deck preview, battle).
---

# Run: 奥术王座 (Fantasy Card Battle)

A single-page Vite + React 19 + TypeScript card-battle game. No backend,
no router — everything is one component tree; player decks persist in
`localStorage` (`arcane-decks` / `arcane-active-deck`, legacy `arcane-deck`).

Because it's a client-rendered SPA, `curl` only returns an empty
`<div id="root">`. To actually see/verify anything you drive it with a
real browser via **[driver.mjs](.claude/skills/run-fantasy-card-battle/driver.mjs)**
(`playwright-core` against the system Chrome).

> Paths below are relative to the project root (the dir with `package.json`).
> Verified on macOS (darwin). The dev server is cross-platform; the driver's
> default Chrome path is macOS — override with `CHROME_PATH` elsewhere.

## Prerequisites

```bash
npm install                 # app deps
npm i -D playwright-core     # browser driver (drives system Chrome, no browser download)
```

The driver uses Google Chrome at the macOS default path. On other OSes (or
if Chrome lives elsewhere) set `CHROME_PATH=/path/to/chrome`.

## Build / sanity-check (no browser needed)

```bash
npm run typecheck    # tsc --noEmit
npm run build        # tsc --noEmit && vite build  -> dist/
npm test             # vitest run (engine unit tests)
```

## Run — agent path (drive it in a browser)

Start the dev server, then run the driver against it:

```bash
# 1. dev server in the background (pick any free port)
npx vite --port 5174 > /tmp/vite.log 2>&1 &
sleep 3

# 2. drive: menu -> deck builder -> edit deck (live preview, hover) -> new deck -> save
#    SEED_DECK=1 injects a legacy single-deck save to also exercise migration
SEED_DECK=1 node .claude/skills/run-fantasy-card-battle/driver.mjs http://localhost:5174/ /tmp/fcb-shots

# 3. stop the server when done
kill %1
```

Args: `driver.mjs [url] [outDir]` (defaults `http://localhost:5173/`,
`/tmp/fcb-shots`). The driver prints every console message + page error,
exits non-zero on any page error or if the React root never mounts, and
writes screenshots: `1-menu`, `2-deck-builder`, `3-edit-preview`,
`4-after-save`. **Open the PNGs and look** — a blank frame means it
didn't render.

To drive a different flow, edit `driver.mjs` — it's agent tooling, meant
to be hacked on. Elements are reached by visible Chinese text
(`page.getByText("构 建 牌 组")`, `"✏️ 编辑"`, `"← 牌组列表"`, `"随机补满"`, `"保存牌组"`).
Editing a deck (or `"✚ 新建牌组"`) switches the right panel into the live
deck preview, whose card rows are `div[title='点击移除一张']` (click to remove
one copy).

## Run — human path

```bash
npm run dev          # opens http://localhost:5173 ; Ctrl-C to stop
```

Open the URL in a browser. Useless headless — use the driver path instead.

## Gotchas

- **SPA: `curl` proves nothing.** The HTML shell is static; all UI is
  rendered by React after `/src/main.tsx` loads. Always drive with a browser.
- **A `[console.error] Failed to load resource: 404` is expected** — it's
  the missing favicon, not an app error. The driver only fails on real
  `pageerror`s, so this is ignored.
- **UI text is Chinese** and several labels contain spaces for letter-spacing
  (`构 建 牌 组`, `开 始 对 战`). Match the exact spaced string in selectors.
- **Decks persist in `localStorage`.** A previous run's saved decks carry
  over. `SEED_DECK=1` pre-seeds a legacy `arcane-deck` to test migration into
  the new `arcane-decks` list; clear site data for a truly clean slate.
- **`dist/` is committed.** `npm run build` rewrites hashed asset filenames —
  `git checkout -- dist/` after building if you don't intend to commit it.
- **Scripts in `/tmp` can't import `playwright-core`** — Node resolves
  `node_modules` from the script's location, so keep the driver inside the
  project tree (it is).

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Cannot find package 'playwright-core'` | `npm i -D playwright-core`; run the driver from inside the project dir. |
| `browserType.launch: Executable doesn't exist` / spawn ENOENT | Chrome not at the default path — set `CHROME_PATH=/path/to/chrome`. |
| Driver hangs on `waitForSelector("#root *")` | Dev server not up / wrong port — check `/tmp/vite.log` and the URL arg. |
| `getByText(...)` times out | Label text or spacing changed — copy the exact visible string from the source/JSX. |
