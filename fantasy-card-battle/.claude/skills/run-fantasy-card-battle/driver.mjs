// Drives the running 奥术王座 (Arcane Throne) web app with a real browser.
//
// Prereq: dev server already running (npm run dev, default http://localhost:5173)
//         and `npm i -D playwright-core` done.
//
// Usage:
//   node .claude/skills/run-fantasy-card-battle/driver.mjs [url] [outDir]
//
// Env:
//   CHROME_PATH  override the browser binary (default: macOS Google Chrome)
//   SEED_DECK=1  inject a legacy single-deck localStorage save to exercise migration
//
// Screenshots are written to outDir (default /tmp/fcb-shots) and every
// console message / page error is printed. Exits non-zero on a page error
// or if the React root never mounts.
import { chromium } from "playwright-core";

const URL = process.argv[2] || "http://localhost:5173/";
const OUT = process.argv[3] || "/tmp/fcb-shots";
const CHROME =
  process.env.CHROME_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

import { mkdirSync } from "node:fs";
mkdirSync(OUT, { recursive: true });

const errors = [];
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
page.on("console", (m) => console.log(`[console.${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => { errors.push(e.message); console.log(`[pageerror] ${e.message}`); });

if (process.env.SEED_DECK === "1") {
  await page.addInitScript(() => {
    const deck = [];
    [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15].forEach((id) => deck.push(id, id)); // 30 cards
    localStorage.setItem("arcane-deck", JSON.stringify(deck));
  });
}

const shot = async (n) => { await page.screenshot({ path: `${OUT}/${n}.png` }); console.log("shot:", `${OUT}/${n}.png`); };

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForSelector("#root *", { timeout: 10000 }); // React mounted
await page.waitForTimeout(400);
await shot("1-menu");

// Menu -> deck builder
await page.getByText("构 建 牌 组").click();
await page.waitForTimeout(400);
await shot("2-deck-builder");

// Edit the first saved deck -> right panel switches to live preview of the deck
const editBtn = page.getByText("✏️ 编辑").first();
if (await editBtn.count()) {
  await editBtn.click();
  await page.waitForTimeout(400);
  await page.locator("div[title='点击移除一张']").first().hover();
  await page.waitForTimeout(300);
  await shot("3-edit-preview");
  await page.getByText("← 牌组列表").click(); // back to deck list
  await page.waitForTimeout(200);
}

// Build + save a fresh deck (新建牌组 also switches right panel to preview)
await page.getByText("✚ 新建牌组").click();
await page.waitForTimeout(200);
await page.getByText("随机补满").click();
await page.waitForTimeout(300);
await page.getByText("保存牌组").first().click();
await page.waitForTimeout(300);
await shot("4-after-save");

await browser.close();

if (errors.length) { console.error(`\nFAILED: ${errors.length} page error(s)`); process.exit(1); }
console.log("\nOK: drove menu -> deck builder -> preview -> save, no page errors");
