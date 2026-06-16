// CEM 权重训练运行器(默认跳过,避免拖慢普通测试)。
// 运行:  TRAIN=1 npx vitest run src/cem.train.test.ts --disable-console-intercept
// 训完把打印出的 LEARNED_WEIGHTS 粘进 valuePolicy.ts 的 DEFAULT_WEIGHTS 即可启用。
import { expect, it } from "vitest";
import { deckSpec } from "./selfplay";
import { trainCEM } from "./cem";
import { FEATURE_NAMES } from "./valuePolicy";
import type { ClassId } from "./types";

const DECK_CLASS: ClassId = "rogue";
const DECK_CARDS: number[] = [
  38, 38, 42, 44, 44, 46, 46, 40, 40, 41, 41, 43, 43, 47, 47,
  49, 49, 39, 39, 48, 48, 53, 53, 45, 45, 20, 20, 51, 50, 50,
];

// 经 globalThis 取 env,免引入 @types/node(项目无该依赖)
const TRAIN = !!(globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.TRAIN;

(TRAIN ? it : it.skip)("CEM 训练价值策略权重", () => {
  const deck = deckSpec(DECK_CARDS, DECK_CLASS);
  const fmt = (w: number[]) => w.map((x) => x.toFixed(2)).join(", ");

  const res = trainCEM(deck, {
    generations: 5,
    population: 12,
    gamesPerEval: 40,
    nodeCap: 400,   // 训练期小预算换吞吐
    seed: 1,
    onGen: (g) => console.info(
      `  [第 ${g.gen} 代] 候选均值胜率 ${(g.meanFitness * 100).toFixed(1)}% · 精英 ${(g.eliteFitness * 100).toFixed(1)}% · 最佳 ${(g.bestFitness * 100).toFixed(1)}%`
    ),
  });

  console.info(
    `\n[CEM 验收] 大样本 + nodeCap 2000` +
    `\n  初始权重胜率 ${(res.baseFitness * 100).toFixed(1)}%  →  训练后胜率 ${(res.bestFitness * 100).toFixed(1)}%` +
    `\n  各维权重(对齐 FEATURE_NAMES):` +
    res.best.map((x, i) => `\n    ${FEATURE_NAMES[i]}: ${x.toFixed(2)}`).join("") +
    `\n\n  LEARNED_WEIGHTS = [${fmt(res.best)}]\n`
  );

  expect(res.best.length).toBe(FEATURE_NAMES.length);
  expect(res.history.length).toBe(5);
  // 训练后不应显著劣于初始权重(允许验收噪声)
  expect(res.bestFitness).toBeGreaterThan(res.baseFitness - 0.08);
}, 1_200_000);
