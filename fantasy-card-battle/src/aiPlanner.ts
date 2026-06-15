// ================= AI 出牌阶段搜索规划器 =================
// aiPlay 的贪婪优先级链每次只做一步,无法发现需要跨多步铺垫的 combo
// (典型:连打法术给 costScale 的奥术巨人减费 → 打出 → 街舞起跳复制成第二个 8/8)。
// 本模块在出牌阶段做一次有界搜索:枚举动作序列、按终局棋盘价值评分、采用最优线。
//
// 用 DFS + 换位表(transposition memo)+ 节点上限:memo 把"硬币/法术打出顺序不同但同态"
// 的状态合并,使 combo 手牌的可达状态空间缩到很小,可近乎穷尽地找到最高分终局,
// 不依赖 beam 那种按即时分剪枝(combo 中途会出现棋盘价值"凹陷",beam 易把它剪掉)。
import { HERO_POWER_COST, spTarget } from "./cards";
import {
  castSpell, clone, effCard, effCost, isValidSpellTarget,
  playMinion, playWeapon, useHeroPower,
} from "./engine";
import { aiPlay, applyBloom, applyCamp, applyChoose, applyDredge, applyMap, applyMoonlight } from "./ai";
import type { GameState, Minion, Side, SpellTarget } from "./types";

const SIDE: Side = "a";
const MAX_DEPTH = 14;   // combo 最长约 10 步,留余量
const NODE_CAP = 15000; // 兜底:超过即返回当前最优
const EPS = 0.5;        // 需严格超过贪婪线此幅度才采用,避免边际收益覆盖贪婪决策

// 交互类法术(无 EFFECTS.cast,走 ai.ts 抽出的启发式 helper)
const INTERACTIVE = new Set(["bloom", "camp", "choose", "moonlight", "map", "dredge"]);

type Action =
  | { kind: "min" | "wep" | "icast"; i: number }
  | { kind: "spell"; i: number; tgt: SpellTarget | null }
  | { kind: "hp" };

// 终局棋盘价值启发式:己方棋盘体格和为主,减去对方棋盘的一半,武器小幅计入。
// DFS 会穷举所有线,故无需用分数引导/剪枝;此分仅用于在终局间排序选最优。
const bodyVal = (m: Minion): number => m.atk + m.hp + (m.taunt ? 1 : 0);
const boardVal = (s: GameState["a"]): number => s.board.reduce((v, m) => v + bodyVal(m), 0);
function scoreState(st: GameState): number {
  const a = st.a;
  let sc = boardVal(a) - 0.5 * boardVal(st.p);
  if (a.weapon) sc += a.weapon.atk * a.weapon.dur * 0.3;
  return sc;
}

// 决策相关状态指纹(含 rngState/牌库,确保不同 RNG 走向的同态不被误并)。
function signature(st: GameState): string {
  const a = st.a;
  return JSON.stringify([
    st.rngState, a.mana, a.spellsPlayed || 0, a.spellDiscount || 0, a.heroPowerUsed ? 1 : 0,
    a.hp, st.p.hp, a.armor || 0,
    a.hand.map((e) => [e.cid, e.costred || 0, e.atk ?? -1, e.hp ?? -1]).sort(),
    a.board.map((m) => [m.cid, m.atk, m.hp, m.sick ? 1 : 0, m.attacked ? 1 : 0, m.taunt ? 1 : 0, m.rush ? 1 : 0]).sort(),
    st.p.board.map((m) => [m.cid, m.atk, m.hp]).sort(),
    a.weapon ? [a.weapon.atk, a.weapon.dur] : 0,
    a.deck.length,
  ]);
}

// 枚举当前可执行的原子动作。法术按 isValidSpellTarget 展开合法目标;交互类法术单列。
function enumerateActions(st: GameState): Action[] {
  const a = st.a;
  const acts: Action[] = [];
  for (let i = 0; i < a.hand.length; i++) {
    const en = a.hand[i];
    const c = effCard(st, SIDE, en);
    if (effCost(st, SIDE, c, en) > a.mana) continue;
    if (c.type === "m") acts.push({ kind: "min", i });
    else if (c.type === "w") acts.push({ kind: "wep", i });
    else if (c.type === "s" && c.sp) {
      const sp = c.sp;
      if (sp.k === "shadow") continue; // 殒命暗影无可复制法术时不可打出
      if (INTERACTIVE.has(sp.k)) { acts.push({ kind: "icast", i }); continue; }
      const t = spTarget(sp);
      if (!t) { acts.push({ kind: "spell", i, tgt: null }); continue; }
      const cands: SpellTarget[] = [];
      if (t === "any") { cands.push({ side: "a", hero: true }, { side: "p", hero: true }); }
      const sides: Side[] = t === "fm" ? ["a"] : ["a", "p"];
      for (const sd of sides) for (const m of st[sd].board) cands.push({ side: sd, uid: m.uid });
      for (const tg of cands) if (isValidSpellTarget(st, SIDE, sp, tg)) acts.push({ kind: "spell", i, tgt: tg });
    }
  }
  if (!a.heroPowerUsed && a.mana >= HERO_POWER_COST) acts.push({ kind: "hp" });
  return acts;
}

// 执行一个动作(直接 mutate 传入 st)。返回是否成功——交互类不适用时返回 false,该分支跳过。
function applyAction(st: GameState, act: Action): boolean {
  switch (act.kind) {
    case "min": return playMinion(st, SIDE, act.i);
    case "wep": return playWeapon(st, SIDE, act.i);
    case "hp": return useHeroPower(st, SIDE);
    case "spell": return castSpell(st, SIDE, act.i, act.tgt);
    case "icast": {
      const c = effCard(st, SIDE, st.a.hand[act.i]);
      switch (c.sp?.k) {
        case "bloom": return applyBloom(st, SIDE, act.i);
        case "camp": return applyCamp(st, SIDE, act.i);
        case "choose": return applyChoose(st, SIDE, act.i);
        case "moonlight": return applyMoonlight(st, SIDE, act.i);
        case "map": return applyMap(st, SIDE, act.i);
        case "dredge": return applyDredge(st, SIDE, act.i);
        default: return false;
      }
    }
  }
}

// 贪婪线得分:在 clone 上跑完贪婪出牌阶段,作为"不得劣于贪婪"的下限。
function greedyScore(st: GameState): number {
  const g = clone(st);
  let guard = 0;
  while (guard++ < 32 && aiPlay(g)) { /* 跑完贪婪出牌阶段 */ }
  return scoreState(g);
}

// 在出牌阶段搜索最优铺场/combo 线。返回最优线沿途的逐帧快照(不含输入帧);
// 若未严格超过贪婪线则返回 null(由 computeAiTurn 回退贪婪 aiPlay)。
export function planPlayPhase(st: GameState): GameState[] | null {
  const baseScore = greedyScore(st);
  const memo = new Set<string>();
  let nodes = 0;
  let bestScore = baseScore;
  let bestPath: GameState[] = [];

  const dfs = (s: GameState, path: GameState[]): void => {
    const sc = scoreState(s);
    if (sc > bestScore) { bestScore = sc; bestPath = path.slice(); }
    if (path.length >= MAX_DEPTH || nodes >= NODE_CAP) return;
    // 大体格随从优先尝试,利于在节点上限内尽早走到 combo 终局
    const acts = enumerateActions(s).sort((x, y) => actRank(s, y) - actRank(s, x));
    for (const act of acts) {
      if (nodes >= NODE_CAP) return;
      const ns = clone(s);
      if (!applyAction(ns, act)) continue;
      const sig = signature(ns);
      if (memo.has(sig)) continue;
      memo.add(sig);
      nodes++;
      path.push(ns);
      dfs(ns, path);
      path.pop();
    }
  };
  dfs(clone(st), []);
  return bestScore > baseScore + EPS ? bestPath : null;
}

// 动作展开顺序的启发权重(仅影响节点上限内的探索次序,不影响正确性):随从 > 其他。
function actRank(st: GameState, act: Action): number {
  if (act.kind === "min") {
    const c = effCard(st, SIDE, st.a.hand[act.i]);
    return 100 + (c.type === "m" ? c.atk + c.hp : 0);
  }
  return act.kind === "spell" || act.kind === "icast" ? 10 : 1;
}
