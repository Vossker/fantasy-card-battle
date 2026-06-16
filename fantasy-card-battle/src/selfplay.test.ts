// 自对弈台跑分脚本。运行:  npx vitest run src/selfplay.test.ts
// 目的:验证"批量自对弈能跑、能复现、够快",并量化当前启发式 AI 的镜像胜率(看先手优势)。
// 训练阶段会把 selfplay.ts 里 takeTurn 的策略换成可学习策略,这里的跑分框架可直接复用。
import { expect, it } from "vitest";
import { buildDeck } from "./cards";
import { deckSpec, mulberry32, runSelfPlay } from "./selfplay";
import type { ClassId } from "./types";

// TODO(用户): 把下面替换成你"我的牌组"导出的卡表。浏览器 Console 里执行:
//   copy(localStorage.getItem("arcane-decks"))
// 粘出来找到目标牌组的 { classId, cards },把 cards 填进 DECK_CARDS、classId 填进 DECK_CLASS。
// 占位:暂用固定种子生成一副德鲁伊牌组,先把流水线跑通。
const DECK_CLASS: ClassId = "druid";
const DECK_CARDS: number[] | null = null; // null = 用占位随机牌组

it("自对弈台:镜像对局批量跑分", () => {
  const cards = DECK_CARDS ?? buildDeck(mulberry32(12345), DECK_CLASS);
  const deck = deckSpec(cards, DECK_CLASS);
  const N = 200;

  const r = runSelfPlay(deck, deck, N, 999);
  const pct = (x: number) => ((x / r.games) * 100).toFixed(1);
  // vitest 默认捕获 console;用 console.info 打印跑分摘要
  console.info(
    `\n[自对弈跑分] ${r.games} 局 · ${r.ms}ms · ${(r.games / (r.ms / 1000)).toFixed(0)} 局/秒` +
    `\n  P 胜 ${r.pWins}(${pct(r.pWins)}%) · A 胜 ${r.aWins}(${pct(r.aWins)}%) · 和 ${r.draws}` +
    `\n  先手胜率 ${pct(r.firstWins)}% · 平均回合数 ${r.avgTurns.toFixed(1)}`
  );

  // 完整性:每局都分出结果(或计入和局),无漏统计
  expect(r.pWins + r.aWins + r.draws).toBe(N);
  // 镜像同策略 + 固定职业,胜负应大致均衡(留宽容区间,仅排除流程严重失衡的 bug)
  const pWinRate = r.pWins / r.games;
  expect(pWinRate).toBeGreaterThan(0.2);
  expect(pWinRate).toBeLessThan(0.8);
  // 和局应极少(疲劳必然分出胜负),回合上限若被频繁触发说明对局没正常推进
  expect(r.draws).toBeLessThan(r.games * 0.05);

  // 复现性:同参数再跑一次,聚合结果完全一致
  const r2 = runSelfPlay(deck, deck, N, 999);
  expect(r2.pWins).toBe(r.pWins);
  expect(r2.aWins).toBe(r.aWins);
  expect(r2.avgTurns).toBe(r.avgTurns);
});
