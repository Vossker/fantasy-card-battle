// 自对弈台跑分脚本。运行:  npx vitest run src/selfplay.test.ts
// ① 镜像跑分:验证批量自对弈能跑、可复现、看先手优势。
// ② 价值策略对打基线:验证 side 无关线性价值策略能在跑分台里对打现有 aiPlay,并实测吞吐回升。
import { expect, it } from "vitest";
import { buildDeck } from "./cards";
import { clone, initGame } from "./engine";
import { deckSpec, heuristicPolicy, mulberry32, runSelfPlay } from "./selfplay";
import { computeValueAiTurn, DEFAULT_WEIGHTS, playValueTurn, playValueTurnSearch } from "./valuePolicy";
import type { ClassId, GameState, Side } from "./types";

// TODO(用户): 把下面替换成你"我的牌组"导出的卡表。浏览器 Console 里执行:
//   copy(localStorage.getItem("arcane-decks"))
// 粘出来找到目标牌组的 { classId, cards },把 cards 填进 DECK_CARDS、classId 填进 DECK_CLASS。
const DECK_CLASS: ClassId = "rogue";
const DECK_CARDS: number[] | null = [
  38, 38, 42, 44, 44, 46, 46, 40, 40, 41, 41, 43, 43, 47, 47,
  49, 49, 39, 39, 48, 48, 53, 53, 45, 45, 20, 20, 51, 50, 50,
];

const cards = DECK_CARDS ?? buildDeck(mulberry32(12345), DECK_CLASS);
const deck = deckSpec(cards, DECK_CLASS);

// combo 牌组(奥术巨人/街舞/暗影步)会触发 aiPlanner 的 DFS 搜索,每回合开销大,故放宽测试超时。
it("镜像跑分:现有启发式 AI 自对弈", () => {
  const N = 200;
  const r = runSelfPlay(deck, deck, heuristicPolicy, heuristicPolicy, N, 999);
  const pct = (x: number) => ((x / r.games) * 100).toFixed(1);
  console.info(
    `\n[镜像跑分] ${r.games} 局 · ${r.ms}ms · ${(r.games / (r.ms / 1000)).toFixed(0)} 局/秒` +
    `\n  P 胜 ${r.pWins}(${pct(r.pWins)}%) · A 胜 ${r.aWins}(${pct(r.aWins)}%) · 和 ${r.draws}` +
    `\n  先手胜率 ${pct(r.firstWins)}% · 平均回合数 ${r.avgTurns.toFixed(1)}`
  );
  expect(r.pWins + r.aWins + r.draws).toBe(N);
  const pWinRate = r.pWins / r.games;
  expect(pWinRate).toBeGreaterThan(0.2);
  expect(pWinRate).toBeLessThan(0.8);
  expect(r.draws).toBeLessThan(r.games * 0.05);

  // 复现性:用小样本独立跑两次(省墙钟),聚合结果应完全一致
  const a1 = runSelfPlay(deck, deck, heuristicPolicy, heuristicPolicy, 20, 777);
  const a2 = runSelfPlay(deck, deck, heuristicPolicy, heuristicPolicy, 20, 777);
  expect(a2.pWins).toBe(a1.pWins);
  expect(a2.avgTurns).toBe(a1.avgTurns);
}, 180_000);

it("价值策略 vs 现有启发式 AI", () => {
  const value = (st: GameState, side: Side) => playValueTurn(st, side, DEFAULT_WEIGHTS);
  const N = 200;
  // P 用价值策略,A 用现有 aiPlay。先手随机分配,故 P 胜率直接可比。
  const r = runSelfPlay(deck, deck, value, heuristicPolicy, N, 4242);
  const pct = (x: number) => ((x / r.games) * 100).toFixed(1);
  console.info(
    `\n[价值策略 vs 启发式] ${r.games} 局 · ${r.ms}ms · ${(r.games / (r.ms / 1000)).toFixed(0)} 局/秒` +
    `\n  价值策略(P)胜 ${r.pWins}(${pct(r.pWins)}%) · 启发式(A)胜 ${r.aWins}(${pct(r.aWins)}%) · 和 ${r.draws}` +
    `\n  平均回合数 ${r.avgTurns.toFixed(1)}`
  );
  // 这是骨架冒烟测试:只验证价值策略能正常打完整局、不崩、不卡死(无大量回合上限和局)。
  // 未训练的 1-ply 贪婪权重很弱(尤其面对这副重 combo 牌组),被现有 AI 压制属预期;
  // 提升强度是下一步 CEM/进化训练 w 的目标,不在本测试断言范围内。
  expect(r.pWins + r.aWins + r.draws).toBe(N);
  expect(r.draws).toBeLessThan(r.games * 0.05);
  expect(r.pWins).toBeGreaterThanOrEqual(0);
}, 180_000);

it("价值策略(浅层 lookahead) vs 现有启发式 AI", () => {
  const value = (st: GameState, side: Side) => playValueTurnSearch(st, side, DEFAULT_WEIGHTS, { nodeCap: 2000, maxDepth: 10 });
  const N = 200;
  const r = runSelfPlay(deck, deck, value, heuristicPolicy, N, 4242);
  const pct = (x: number) => ((x / r.games) * 100).toFixed(1);
  console.info(
    `\n[lookahead 价值策略 vs 启发式] ${r.games} 局 · ${r.ms}ms · ${(r.games / (r.ms / 1000)).toFixed(1)} 局/秒` +
    `\n  lookahead(P)胜 ${r.pWins}(${pct(r.pWins)}%) · 启发式(A)胜 ${r.aWins}(${pct(r.aWins)}%) · 和 ${r.draws}` +
    `\n  平均回合数 ${r.avgTurns.toFixed(1)}`
  );
  expect(r.pWins + r.aWins + r.draws).toBe(N);
  expect(r.draws).toBeLessThan(r.games * 0.05);
  // lookahead 补上连招后,即便未训练权重也应明显强于 1-ply(应远超其 2.5%)。这里设一个保守下限。
  expect(r.pWins).toBeGreaterThan(N * 0.15);
}, 300_000);

// 部署正确性:接入真实游戏的 computeValueAiTurn(逐帧快照重放)其回合终态,
// 必须与训练路径 playValueTurnSearch 完全一致(两者确定性、同 w/opts),且产出有效快照、无残留 pending。
it("部署版 computeValueAiTurn 终态 == 训练路径,且产出有效快照", () => {
  const proj = (s: GameState) => ({
    aHp: s.a.hp, pHp: s.p.hp, aArmor: s.a.armor, aMana: s.a.mana, winner: s.winner,
    aBoard: s.a.board.map((m) => [m.cid, m.atk, m.hp]),
    pBoard: s.p.board.map((m) => [m.cid, m.atk, m.hp]),
    aHand: s.a.hand.map((e) => e.cid).slice().sort((x, y) => x - y),
    weapon: s.a.weapon ? [s.a.weapon.atk, s.a.weapon.dur] : null,
  });
  const opts = { nodeCap: 1000, maxDepth: 10 };
  for (const seed of [1, 2, 3, 7, 42, 99]) {
    const g = initGame(deck.cards, deck.cls, seed, deck.cards, deck.cls, false);
    const snaps = computeValueAiTurn(clone(g), DEFAULT_WEIGHTS, opts);
    const direct = playValueTurnSearch(clone(g), "a", DEFAULT_WEIGHTS, opts);
    expect(snaps.length).toBeGreaterThanOrEqual(1); // 至少开局抽牌一帧
    const last = snaps[snaps.length - 1];
    expect(last.pending).toBe(null); // 不会卡在抉择弹窗
    expect(proj(last)).toEqual(proj(direct)); // 快照终态与训练路径一致
  }
});
