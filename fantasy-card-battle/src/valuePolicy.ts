// ================= 可参数化线性价值策略(side 无关) =================
// 决策 = 枚举当前所有合法原子动作(出牌/英雄技能/随从攻击/英雄攻击)→ 各自 clone 模拟一步
// → 用线性价值 V(s)=w·φ(s) 给落子后状态打分 → 选严格优于"过(pass)"的最高分动作,直到无改进动作。
// 这是一个 1-ply 贪婪价值策略:不做深搜(故不触发 aiPlanner 的 DFS,吞吐高),
// 但权重 w 可被 CEM/进化/TD 用自对弈胜率训练,是把"强化学习"接进来的最小载体。
//
// 与旧 aiPlay 的区别:旧的是手写优先级 if-链;这里把"打什么/打哪/怎么攻击"统一成
// "枚举→估值→取最大",决策完全由 w 决定。side 无关:φ 一切都相对行动方计算。
import {
  castSpell, clone, effCard, effCost, endTurnCleanup, heroAtkVal, isValidSpellTarget, log, other,
  playMinion, playWeapon, resolveAttack, resolveHeroAttack, startTurn, thawFrozen, useHeroPower,
} from "./engine";
import { applyBloom, applyCamp, applyChoose, applyDredge, applyMap, applyMoonlight } from "./ai";
import { HERO_POWER_COST, spTarget } from "./cards";
import type { GameState, Side, SpellTarget } from "./types";

// 交互类法术(无 EFFECTS.cast,走 ai.ts 抽出的 side 无关启发式 helper 结算)
const INTERACTIVE = new Set(["bloom", "camp", "choose", "moonlight", "map", "dredge"]);

const WIN = 1e6;
const LOSS = -1e6;

type Action =
  | { kind: "min" | "wep" | "icast"; i: number }
  | { kind: "spell"; i: number; tgt: SpellTarget | null }
  | { kind: "atk"; uid: number; tgt: { uid?: number; hero?: boolean } }
  | { kind: "hatk"; tgt: { uid?: number; hero?: boolean } }
  | { kind: "hp" };

// ===== 特征向量 φ(s, side):一切相对行动方 me / 对手 opp 计算 =====
// 只读对手的"棋盘+血量"(公开信息),不偷看对手手牌/牌库,保持与人对战时的信息对称。
// 顺序固定;DEFAULT_WEIGHTS 与训练得到的 w 必须与此对齐。
export const FEATURE_NAMES = [
  "生命差(含护甲)", "随从攻击力差", "随从生命值差", "随从数量差",
  "嘲讽数量差", "我方手牌数", "我方剩余法力(负)", "我方武器价值",
  "我方本回合可用攻击力",
] as const;

export function features(st: GameState, side: Side): number[] {
  const me = st[side], opp = st[other(side)];
  const mb = me.board, ob = opp.board;
  const sum = (arr: typeof mb, f: (m: typeof mb[number]) => number) => arr.reduce((s, m) => s + f(m), 0);
  // 本回合还能打出的总攻击力(随从可攻击的 + 英雄可攻击的)。这是出牌阶段唯一能区分
  // "把能攻击的随从回收/复制成召唤失调躯壳"与"留着它攻击"的信号——回收会让此值掉下来。
  const canAtk = (m: typeof mb[number]) => !m.attacked && m.atk > 0 && !m.frozen && (!m.sick || m.rush);
  const heroAvail = heroAtkVal(me) > 0 && !me.heroAttacked && !me.heroFrozen ? heroAtkVal(me) : 0;
  return [
    (me.hp + me.armor) - (opp.hp + opp.armor),
    sum(mb, (m) => m.atk) - sum(ob, (m) => m.atk),
    sum(mb, (m) => m.hp) - sum(ob, (m) => m.hp),
    mb.length - ob.length,
    sum(mb, (m) => (m.taunt ? 1 : 0)) - sum(ob, (m) => (m.taunt ? 1 : 0)),
    me.hand.length,
    -me.mana, // 回合末留着法力 = 浪费,负值;权重为正即"鼓励花光法力"
    me.weapon ? me.weapon.atk * me.weapon.dur : 0,
    sum(mb, (m) => (canAtk(m) ? m.atk : 0)) + heroAvail,
  ];
}

// 价值策略权重(潜行者 combo 牌组),CEM 自对弈训练(9 维特征)。长度必须等于 features 维度;换牌组需重训。
// 加入第 9 维"可用攻击力"并重训后,对 heuristicPolicy 验收 53%→~57%,且价值函数能感知"浪费攻击"的代价。
export const DEFAULT_WEIGHTS: number[] = [
  3.18, // 生命差:压制/斩杀的核心
  4.89, // 攻击力差(combo 牌组看重场面攻击力)
  1.78, // 生命值差
  0.61, // 随从数量差
  2.55, // 嘲讽数量差
  0.95, // 我方手牌数(留牌价值)
  0.48, // 剩余法力惩罚
  -0.20, // 武器价值
  0.80, // 我方本回合可用攻击力(正:回收/复制掉能攻击的随从会损失此值,从而被权衡)
];

export function valueOf(st: GameState, side: Side, w: number[]): number {
  if (st.winner === side) return WIN;
  if (st.winner) return LOSS;
  const f = features(st, side);
  let v = 0;
  for (let i = 0; i < w.length; i++) v += w[i] * f[i];
  return v;
}

// 枚举当前可执行的原子动作。法术按 isValidSpellTarget 展开合法目标;攻击宽松枚举,
// 由 resolveAttack/resolveHeroAttack 自带的嘲讽/召唤失调/冻结校验在 apply 阶段剪枝。
// 出牌阶段动作:打牌(随从/武器/法术/交互类)+ 英雄技能。整回合搜索 enumActions 把它与攻击动作合并展开。
function enumPlayActions(st: GameState, side: Side): Action[] {
  const me = st[side];
  const acts: Action[] = [];
  for (let i = 0; i < me.hand.length; i++) {
    const en = me.hand[i];
    const c = effCard(st, side, en);
    if (effCost(st, side, c, en) > me.mana) continue;
    if (c.type === "m") acts.push({ kind: "min", i });
    else if (c.type === "w") acts.push({ kind: "wep", i });
    else if (c.type === "s" && c.sp) {
      const sp = c.sp;
      if (sp.k === "shadow") continue; // 殒命暗影无可复制法术时不可打出
      if (INTERACTIVE.has(sp.k)) { acts.push({ kind: "icast", i }); continue; }
      const t = spTarget(sp);
      if (!t) { acts.push({ kind: "spell", i, tgt: null }); continue; }
      const cands: SpellTarget[] = [];
      if (t === "any") cands.push({ side: "a", hero: true }, { side: "p", hero: true });
      const sides: Side[] = t === "fm" ? [side] : ["a", "p"];
      for (const sd of sides) for (const m of st[sd].board) cands.push({ side: sd, uid: m.uid });
      for (const tg of cands) if (isValidSpellTarget(st, side, sp, tg)) acts.push({ kind: "spell", i, tgt: tg });
    }
  }
  if (!me.heroPowerUsed && me.mana >= HERO_POWER_COST) acts.push({ kind: "hp" });
  return acts;
}

// 攻击阶段动作:随从攻击 + 英雄攻击。宽松枚举,由 resolveAttack/resolveHeroAttack 自带校验在 apply 阶段剪枝。
function enumAttackActions(st: GameState, side: Side): Action[] {
  const me = st[side], opp = st[other(side)];
  const acts: Action[] = [];
  // 随从攻击:每个"可能可攻击"的随从 × 每个敌方目标(随从 + 英雄)。召唤失调的突袭随从只能打随从。
  for (const m of me.board) {
    if (m.attacked || m.atk <= 0 || m.frozen) continue;
    if (m.sick && !m.rush) continue;
    for (const d of opp.board) acts.push({ kind: "atk", uid: m.uid, tgt: { uid: d.uid } });
    if (!m.sick) acts.push({ kind: "atk", uid: m.uid, tgt: { hero: true } });
  }
  // 英雄攻击(武器/变形攻击力)
  if (heroAtkVal(me) > 0 && !me.heroAttacked && !me.heroFrozen) {
    for (const d of opp.board) acts.push({ kind: "hatk", tgt: { uid: d.uid } });
    acts.push({ kind: "hatk", tgt: { hero: true } });
  }
  return acts;
}

const enumActions = (st: GameState, side: Side): Action[] => [...enumPlayActions(st, side), ...enumAttackActions(st, side)];

// 执行一个动作(直接 mutate st)。返回是否成功——非法/不适用返回 false,调用方跳过该分支。
function applyAct(st: GameState, side: Side, act: Action): boolean {
  switch (act.kind) {
    case "min": return playMinion(st, side, act.i);
    case "wep": return playWeapon(st, side, act.i);
    case "hp": return useHeroPower(st, side);
    case "spell": return castSpell(st, side, act.i, act.tgt);
    case "atk": return resolveAttack(st, side, act.uid, act.tgt);
    case "hatk": return resolveHeroAttack(st, side, act.tgt);
    case "icast": {
      const c = effCard(st, side, st[side].hand[act.i]);
      switch (c.sp?.k) {
        case "bloom": return applyBloom(st, side, act.i);
        case "camp": return applyCamp(st, side, act.i);
        case "choose": return applyChoose(st, side, act.i);
        case "moonlight": return applyMoonlight(st, side, act.i);
        case "map": return applyMap(st, side, act.i);
        case "dredge": return applyDredge(st, side, act.i);
        default: return false;
      }
    }
  }
}

// 用权重 w 打完 side 方整整一回合,返回终态(side 无关,可同时驱动 p / a)。
// 约定与 heuristicPolicy 一致:入参为回合开始前的状态,本函数负责 startTurn 与回合结束清理。
export function playValueTurn(st: GameState, side: Side, w: number[]): GameState {
  let cur = clone(st); // 防御性 clone:不改 caller 的状态
  startTurn(cur, side);
  if (cur.winner) return cur; // 疲劳致死
  let guard = 0;
  while (guard++ < 60 && !cur.winner) {
    const baseV = valueOf(cur, side, w); // "过"的价值:不再行动
    let bestV = baseV;
    let best: GameState | null = null;
    for (const act of enumActions(cur, side)) {
      const ns = clone(cur);
      if (!applyAct(ns, side, act)) continue;
      const v = valueOf(ns, side, w);
      if (v > bestV) { bestV = v; best = ns; } // 仅采纳严格优于"过"的动作
    }
    if (!best) break; // 无改进动作 → 结束回合
    cur = best;
  }
  endTurnCleanup(cur, side); // 秘密通道换回手牌
  thawFrozen(cur, side); // 回合结束解冻己方
  return cur;
}

// ===== 浅层 lookahead 版:补 1-ply 看不到的多步连招 =====
// 决策相关状态指纹(含 rngState/牌库长度,确保不同 RNG 走向/牌序的同态不被误并)。side 无关。
function signature(st: GameState, side: Side): string {
  const a = st[side], o = st[other(side)];
  return JSON.stringify([
    st.rngState, a.mana, a.spellsPlayed || 0, a.spellDiscount || 0, a.heroPowerUsed ? 1 : 0,
    a.hp, o.hp, a.armor || 0,
    a.hand.map((e) => [e.cid, e.costred || 0, e.atk ?? -1, e.hp ?? -1]).sort(),
    a.board.map((m) => [m.cid, m.atk, m.hp, m.sick ? 1 : 0, m.attacked ? 1 : 0, m.taunt ? 1 : 0, m.rush ? 1 : 0]).sort(),
    o.board.map((m) => [m.cid, m.atk, m.hp]).sort(),
    a.weapon ? [a.weapon.atk, a.weapon.dur] : 0,
    a.deck.length,
  ]);
}

export interface SearchOpts {
  nodeCap?: number; // 整回合搜索的节点上限(越大越能找到深连招,越慢)。含攻击后分支变大,默认 6000。
  maxDepth?: number; // 整回合最大动作序列长度(出牌+攻击交织,需容纳整回合)。默认 14。
}

// 整回合有界 DFS:出牌与攻击交织穷举动作序列(memo 合并同态、nodeCap 兜底),用 V 给每个到达局面打分。
// 攻击进搜索后,"先攻击(对手生命↓→生命差↑)再回收"会严格优于"先回收浪费攻击",由价值函数自然择优——
// 无需对回收/复制类法术加硬规则。无分数剪枝:连招中途的"价值凹陷"铺垫步靠穷举越过,叶子估值用可训练的 V。
// 返回最高分局面 best 及到达它的动作序列 actions(供部署时逐帧重放动画;训练只用 best)。
function searchPlayPhase(
  st: GameState, side: Side, w: number[], nodeCap: number, maxDepth: number,
): { best: GameState; actions: Action[] } {
  let best = st;
  let bestV = valueOf(st, side, w);
  let bestActions: Action[] = [];
  const memo = new Set<string>();
  let nodes = 0;
  const dfs = (s: GameState, depth: number, acts: Action[]): void => {
    const v = valueOf(s, side, w);
    if (v > bestV) { bestV = v; best = s; bestActions = acts.slice(); }
    if (s.winner || depth >= maxDepth || nodes >= nodeCap) return;
    for (const act of enumActions(s, side)) {
      if (nodes >= nodeCap) return;
      const ns = clone(s);
      if (!applyAct(ns, side, act)) continue;
      const sig = signature(ns, side);
      if (memo.has(sig)) continue;
      memo.add(sig);
      nodes++;
      acts.push(act);
      dfs(ns, depth + 1, acts);
      acts.pop();
    }
  };
  dfs(st, 0, []);
  return { best, actions: bestActions };
}

// 攻击收尾:1-ply 贪婪兜底(搜索受 nodeCap 截断时漏掉的攻击在此补上;攻击顺序极少影响结果)。
function greedyAttacks(st: GameState, side: Side, w: number[]): GameState {
  let cur = st;
  let guard = 0;
  while (guard++ < 40 && !cur.winner) {
    let bestV = valueOf(cur, side, w);
    let best: GameState | null = null;
    for (const act of enumAttackActions(cur, side)) {
      const ns = clone(cur);
      if (!applyAct(ns, side, act)) continue;
      const v = valueOf(ns, side, w);
      if (v > bestV) { bestV = v; best = ns; }
    }
    if (!best) break;
    cur = best;
  }
  return cur;
}

// 浅层 lookahead 版整回合:出牌阶段有界搜索找最优(含连招)铺场线 → 攻击阶段贪婪 → 回合结束清理。
// 与 playValueTurn 同约定(入参为回合开始前状态,自负责 startTurn/清理),可直接替换为 Policy。
export function playValueTurnSearch(st: GameState, side: Side, w: number[], opts: SearchOpts = {}): GameState {
  const nodeCap = opts.nodeCap ?? 6000;
  const maxDepth = opts.maxDepth ?? 14;
  let cur = clone(st);
  startTurn(cur, side);
  if (cur.winner) return cur; // 疲劳致死
  cur = searchPlayPhase(cur, side, w, nodeCap, maxDepth).best;
  cur = greedyAttacks(cur, side, w);
  endTurnCleanup(cur, side);
  thawFrozen(cur, side);
  return cur;
}

// ===== 部署版:产出逐帧快照,接入真实游戏的 AI 回合(替代 computeAiTurn) =====
// 复刻 computeAiTurn 的快照契约:克隆 state、跑完 AI(总是 "a" 方)整回合、产出快照数组,
// UI 以固定间隔逐帧 setGame 回放成"AI 一步步出牌"。每帧前清 fx/act,使动作的浮字/攻击箭头逐帧呈现。
// 出牌阶段把搜索得到的最优动作序列在真实 state 上逐个重放(确定性,必然复现搜索时的最优局面)。
export function computeValueAiTurn(b: GameState, w: number[] = DEFAULT_WEIGHTS, opts: SearchOpts = {}): GameState[] {
  const nodeCap = opts.nodeCap ?? 6000;
  const maxDepth = opts.maxDepth ?? 14;
  const side: Side = "a";
  const snaps: GameState[] = [];
  const st = clone(b);
  const push = () => snaps.push(clone(st));
  const step = (fn: () => boolean): void => { st.fx = []; st.act = null; if (fn()) push(); };

  st.fx = []; st.act = null;
  startTurn(st, side);
  if (!st.winner) log(st, "对手抽了一张牌");
  push();
  if (st.winner) return snaps;

  // 出牌阶段:搜索最优线,逐个动作重放(每个动作一帧)
  const { actions } = searchPlayPhase(st, side, w, nodeCap, maxDepth);
  for (const act of actions) step(() => applyAct(st, side, act));

  // 攻击阶段:1-ply 贪婪,每次攻击一帧(重新在真实 state 上择优并执行,确定性)
  let guard = 0;
  while (guard++ < 40 && !st.winner) {
    let bestV = valueOf(st, side, w);
    let bestAct: Action | null = null;
    for (const act of enumAttackActions(st, side)) {
      const ns = clone(st);
      if (!applyAct(ns, side, act)) continue;
      const v = valueOf(ns, side, w);
      if (v > bestV) { bestV = v; bestAct = act; }
    }
    if (!bestAct) break;
    const chosen = bestAct;
    step(() => applyAct(st, side, chosen));
  }

  // 回合结束清理(与 computeAiTurn 一致):秘密通道换回手牌、冻结结算
  if (st.a.stash) step(() => { endTurnCleanup(st, side); return true; });
  step(() => thawFrozen(st, side));
  return snaps;
}
