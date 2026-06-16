// ================= CEM 权重训练(交叉熵方法 / 进化策略) =================
// 用自对弈胜率作适应度,训练 valuePolicy 的线性权重 w。
// 流程:维护权重分布 N(mean, std²) → 每代采样一批 w → 各自对打 heuristicPolicy 测胜率
//   → 取胜率最高的若干"精英" → 用精英更新 mean/std → 迭代收敛。
//
// 降噪要点:
//  - 公共随机数:同一代内所有候选用同一 evalSeed(同一组对局),只比策略不比运气,排名方差大降;
//    代间换 seed,避免把权重过拟合到某几局特定牌序。
//  - 精英主义:每代把"当前均值 mean"也作为一个候选评估,确保分布中心不被一代噪声带偏(不回退)。
//  - 训练用小 nodeCap 换吞吐,最终用大 nodeCap + 大样本验收。
import { runSelfPlay, heuristicPolicy, mulberry32 } from "./selfplay";
import type { DeckSpec, Policy } from "./selfplay";
import { DEFAULT_WEIGHTS, playValueTurnSearch } from "./valuePolicy";
import type { GameState, Side } from "./types";

export interface CEMOpts {
  generations?: number;   // 迭代代数。默认 5
  population?: number;    // 每代候选数。默认 12
  eliteFrac?: number;     // 精英比例。默认 1/3
  gamesPerEval?: number;  // 每个候选评估的对局数(越大越稳越慢)。默认 40
  nodeCap?: number;       // 训练期 lookahead 节点上限(小=快)。默认 400
  maxDepth?: number;      // lookahead 深度。默认 10
  initMean?: number[];    // 初始均值。默认 DEFAULT_WEIGHTS
  initStd?: number;       // 初始标准差(各维相同)。默认 1.5
  minStd?: number;        // 标准差下限(防过早收敛)。默认 0.15
  seed?: number;          // 训练随机种子。默认 1
  onGen?: (info: GenInfo) => void; // 每代回调(打印进度)
}

export interface GenInfo {
  gen: number;
  meanFitness: number;  // 本代全部候选平均胜率
  eliteFitness: number; // 精英平均胜率
  bestFitness: number;  // 本代最佳候选胜率
  mean: number[];       // 更新后的分布均值
}

export interface CEMResult {
  best: number[];        // 训练得到的权重(收敛后的分布均值)
  bestFitness: number;   // best 在验收设置下的胜率
  baseFitness: number;   // 初始权重在同一验收设置下的胜率(对照)
  history: GenInfo[];
}

// 标准正态采样(Box-Muller),输入为 [0,1) 均匀 PRNG。
function gaussian(rng: () => number): number {
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// 把权重 w 包装成 Policy(side 无关)。
const valuePolicyOf = (w: number[], nodeCap: number, maxDepth: number): Policy =>
  (st: GameState, side: Side) => playValueTurnSearch(st, side, w, { nodeCap, maxDepth });

// 适应度:w 驱动的价值策略(P)对 heuristicPolicy(A)在 games 局里的胜率。evalSeed 固定即可复现。
function fitness(deck: DeckSpec, w: number[], games: number, nodeCap: number, maxDepth: number, evalSeed: number): number {
  const r = runSelfPlay(deck, deck, valuePolicyOf(w, nodeCap, maxDepth), heuristicPolicy, games, evalSeed);
  return r.pWins / r.games;
}

export function trainCEM(deck: DeckSpec, opts: CEMOpts = {}): CEMResult {
  const generations = opts.generations ?? 5;
  const population = opts.population ?? 12;
  const eliteFrac = opts.eliteFrac ?? 1 / 3;
  const gamesPerEval = opts.gamesPerEval ?? 40;
  const nodeCap = opts.nodeCap ?? 400;
  const maxDepth = opts.maxDepth ?? 10;
  const minStd = opts.minStd ?? 0.15;
  const dim = (opts.initMean ?? DEFAULT_WEIGHTS).length;
  const nElite = Math.max(2, Math.round(population * eliteFrac));
  const rng = mulberry32(opts.seed ?? 1);

  let mean = (opts.initMean ?? DEFAULT_WEIGHTS).slice();
  let std = new Array(dim).fill(opts.initStd ?? 1.5);
  const history: GenInfo[] = [];

  for (let g = 0; g < generations; g++) {
    const evalSeed = (1000 + g * 7919) | 0; // 同代公共随机数,代间不同
    // 候选 = 采样 (population-1) 个 + 当前均值(精英主义,保证中心被评估)
    const samples: number[][] = [mean.slice()];
    for (let k = 1; k < population; k++) {
      samples.push(mean.map((m, i) => m + std[i] * gaussian(rng)));
    }
    const scored = samples.map((w) => ({ w, f: fitness(deck, w, gamesPerEval, nodeCap, maxDepth, evalSeed) }));
    scored.sort((a, b) => b.f - a.f);
    const elites = scored.slice(0, nElite);

    // 用精英更新分布:均值 = 精英均值,标准差 = 精英标准差(带下限)
    const newMean = new Array(dim).fill(0);
    for (const e of elites) for (let i = 0; i < dim; i++) newMean[i] += e.w[i] / elites.length;
    const newStd = new Array(dim).fill(0);
    for (const e of elites) for (let i = 0; i < dim; i++) newStd[i] += (e.w[i] - newMean[i]) ** 2 / elites.length;
    for (let i = 0; i < dim; i++) newStd[i] = Math.max(minStd, Math.sqrt(newStd[i]));
    mean = newMean;
    std = newStd;

    const info: GenInfo = {
      gen: g,
      meanFitness: scored.reduce((s, x) => s + x.f, 0) / scored.length,
      eliteFitness: elites.reduce((s, x) => s + x.f, 0) / elites.length,
      bestFitness: scored[0].f,
      mean: mean.slice(),
    };
    history.push(info);
    opts.onGen?.(info);
  }

  // 验收:用更大样本 + 更大 nodeCap,公平对比"初始权重"与"训练后均值"。
  const valGames = Math.max(120, gamesPerEval * 3);
  const valNodeCap = Math.max(nodeCap, 2000);
  const valSeed = 987654;
  const baseFitness = fitness(deck, opts.initMean ?? DEFAULT_WEIGHTS, valGames, valNodeCap, maxDepth, valSeed);
  const bestFitness = fitness(deck, mean, valGames, valNodeCap, maxDepth, valSeed);

  return { best: mean, bestFitness, baseFitness, history };
}
