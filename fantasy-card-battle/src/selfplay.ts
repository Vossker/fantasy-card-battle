// ================= Headless 自对弈台 =================
// 脱开 React,用纯函数引擎批量跑完整对局,统计胜率/平均回合数/吞吐。
// 这是后续"自对弈训练"(可参数化价值策略 + CEM/TD 调权重)的共同地基:
// 先用它验证"批量自对弈能跑、能复现、够快",再把 takeTurn 里的策略换成可学习策略。
//
// 关键技巧:computeAiTurn 只驱动 "a" 方且自带 startTurn、不修改入参(内部 clone 后返回快照)。
// 故让 "p" 方行动时先交换 st.a/st.p,让 computeAiTurn 以为在打 "a",打完再换回并翻转 winner。
// 由此同一套现有启发式 AI 即可驱动双方,无需改动 ai.ts。
import { applyMulligan, initGame, other } from "./engine";
import { computeAiTurn } from "./ai";
import { byId, COIN } from "./cards";
import type { ClassId, GameState, Side } from "./types";

// 起手补发的幸运币需要一个 uid。引擎的 UID 是小步自增的模块级私有变量,这里用高位区间避免冲突。
let HUID = 2_000_000_000;

export interface DeckSpec {
  cards: number[]; // 30 张卡牌 id(可含重复,遵守张数上限)
  cls: ClassId; // 牌组职业(决定英雄技能)
}

export interface GameResult {
  winner: Side | null; // null = 达到回合上限的和局(理论上罕见,疲劳应先分胜负)
  turns: number; // 实际进行的回合数(双方合计)
  first: Side; // 先手方
}

export interface SelfPlayResult {
  games: number;
  pWins: number;
  aWins: number;
  draws: number;
  firstWins: number; // 由先手方取得的胜场(衡量先手优势)
  avgTurns: number;
  ms: number; // 总耗时(毫秒)
}

// 策略接口:输入"回合开始前"的状态与行动方,返回该方打完整整一回合后的新状态。
// 约定策略自身负责 startTurn 与回合结束清理(与 computeAiTurn 一致),且不依赖修改入参。
export type Policy = (st: GameState, side: Side) => GameState;

// 现有启发式 AI(aiPlay/aiAttack/aiHeroAttack 经 computeAiTurn 串成整回合)封装为 side 无关策略:
// computeAiTurn 只驱动 "a" 且自带 startTurn、不改入参,故 p 方行动时交换 a/p、打完换回并翻转 winner。
export const heuristicPolicy: Policy = (st, side) => {
  if (side === "p") { const t = st.a; st.a = st.p; st.p = t; }
  const snaps = computeAiTurn(st);
  const last = snaps[snaps.length - 1]; // computeAiTurn 至少产出 1 帧(startTurn 后即 push),末帧为本回合终态
  if (side === "p") {
    const t = last.a; last.a = last.p; last.p = t;
    if (last.winner) last.winner = other(last.winner); // 翻转回真实视角
  }
  return last;
};

// 跑一整局。固定 seed 即可完整复现(引擎随机全走 rngState)。pPol/aPol 分别驱动 p / a 方的回合。
export function playOneGame(p: DeckSpec, a: DeckSpec, pPol: Policy, aPol: Policy, seed: number, turnCap = 100): GameResult {
  // mulligan=true 让 initGame 在起手调度处提前返回——绕过它对先手方的预启动(startTurn),
  // 把"回合开始"统一交给 takeTurn/computeAiTurn 负责,避免先手首回合被启动两次。
  const st = initGame(p.cards, p.cls, seed, a.cards, a.cls, true);
  // 手动完成玩家方(p)起手调度:沿用 AI 的曲线策略(换掉费用 ≥4 的牌)。a 方已在 initGame 内调度。
  const pPick = st.p.hand.filter((c) => byId[c.cid].cost >= 4).map((c) => c.uid);
  applyMulligan(st, "p", pPick);
  st.pending = null;
  st[other(st.first)].hand.push({ uid: HUID++, cid: COIN.id }); // 后手方补发幸运币(复刻 finishMulligan)

  const first = st.first;
  let turn: Side = first;
  let cur = st;
  let turns = 0;
  while (!cur.winner && turns < turnCap) {
    cur.turn = turn;
    cur = (turn === "p" ? pPol : aPol)(cur, turn);
    turns++;
    if (cur.winner) break;
    cur.turnNum = (cur.turnNum || 0) + 1;
    turn = other(turn);
  }
  return { winner: cur.winner, turns, first };
}

// 批量自对弈。每局用不同(但确定)的 seed,统计聚合结果。
export function runSelfPlay(p: DeckSpec, a: DeckSpec, pPol: Policy, aPol: Policy, n: number, seed0 = 1): SelfPlayResult {
  const t0 = Date.now();
  let pWins = 0, aWins = 0, draws = 0, firstWins = 0, totTurns = 0;
  for (let i = 0; i < n; i++) {
    const r = playOneGame(p, a, pPol, aPol, (seed0 + Math.imul(i, 0x9e3779b1)) | 0);
    totTurns += r.turns;
    if (r.winner === "p") pWins++;
    else if (r.winner === "a") aWins++;
    else draws++;
    if (r.winner && r.winner === r.first) firstWins++;
  }
  return { games: n, pWins, aWins, draws, firstWins, avgTurns: totTurns / n, ms: Date.now() - t0 };
}

// 把别处导出的 SavedDeck.cards 直接当 DeckSpec 用的便捷构造器。
export const deckSpec = (cards: number[], cls: ClassId): DeckSpec => ({ cards, cls });

// 可复现 PRNG(mulberry32),供脚本生成占位牌组用。引擎内部另有自己的 rand,互不影响。
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
