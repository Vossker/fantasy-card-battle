// Drives a battle start to verify the mulligan (起手调度) overlay.
import { chromium } from "playwright-core";

const URL = process.argv[2] || "http://localhost:5173/";
const OUT = process.argv[3] || "/tmp/fcb-mull";
const CHROME = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

import { mkdirSync } from "node:fs";
mkdirSync(OUT, { recursive: true });

const errors = [];
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
page.on("console", (m) => console.log(`[console.${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => { errors.push(e.message); console.log(`[pageerror] ${e.message}`); });
const shot = async (n) => { await page.screenshot({ path: `${OUT}/${n}.png` }); console.log("shot:", `${OUT}/${n}.png`); };

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForSelector("#root *", { timeout: 10000 });
await page.waitForTimeout(400);

// menu -> start battle dialog -> random deck
await page.getByText("开 始 对 战").click();
await page.waitForTimeout(300);
await page.getByText("🎲 随 机 牌 组").click();
await page.waitForTimeout(600);

// expect mulligan overlay
const mullTitle = page.getByText("起手调度", { exact: false });
const hasMull = await mullTitle.count();
console.log("mulligan overlay present:", hasMull > 0);
await shot("1-mulligan");
if (!hasMull) { errors.push("mulligan overlay did not appear"); }

// toggle the first hand card (click a card with cost badge inside overlay area), then confirm
const cards = page.locator("div", { hasText: /替换|攻 \/|耐久/ });
// click the first hand card by its name region — simplest: click the first big emoji card
const firstCard = page.locator("text=/.*/").first();
// toggle: click first card div that shows 攻/血 etc. Use a robust approach: click the leftmost card.
await page.mouse.click(360, 380);
await page.waitForTimeout(300);
await shot("2-toggled");

// confirm button: matches 替换 N 张并开始 or 全部保留并开始
const confirmBtn = page.getByText(/并开始/);
console.log("confirm button present:", await confirmBtn.count());
await confirmBtn.first().click();
await page.waitForTimeout(1200);

// mulligan overlay should be gone; game proceeding
const stillMull = await page.getByText("起手调度", { exact: false }).count();
console.log("mulligan overlay after confirm (should be 0):", stillMull);
if (stillMull > 0) errors.push("mulligan overlay still present after confirm");
await shot("3-after-confirm");

await browser.close();
if (errors.length) { console.error(`\nFAILED:\n- ${errors.join("\n- ")}`); process.exit(1); }
console.log("\nOK: mulligan overlay appeared, toggled, confirmed, game proceeded");
