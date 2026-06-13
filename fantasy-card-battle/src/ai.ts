// ================= AI 对手 =================
// aiPlay 是一条优先级 if-return 链,每次只做一个动作,返回是否有动作。
// 抉择类法术 AI 不走弹窗:在分支内手动扣费 + splice 手牌,按启发式直接结算(与玩家的延迟支付路径不同)。
import { byId, HAND_LIMIT } from "./cards";
import {
  applyOpt, campEffect, campLabel, castDeckSpell, castSpell, clone, effCost,
  gainMoonCopy, log, moonTutor, playMinion, removeFromDeck, resolveAttack,
  sampleDeck, sampleDeckAny, startTurn, summonFromDeck,
} from "./engine";
import type { AttackTarget, Card, GameState, MinionCard } from "./types";

// dmg/aoe 法术的基础伤害值(用于排序与斩杀计算)
const spDmgN = (c: Card): number => (c.sp && (c.sp.k === "dmg" || c.sp.k === "aoe") ? c.sp.n : 0);

export function aiPlay(st: GameState): boolean {
  const A = st.a, P = st.p;
  const hand = A.hand.map((e, i) => ({ i, c: byId[e.cid] }));
  const can = hand.filter((h) => effCost(st, "a", h.c) <= A.mana);
  if (!can.length) return false;
  const dmg = can.filter((h) => h.c.sp?.k === "dmg").sort((x, y) => spDmgN(y.c) - spDmgN(x.c));
  const bonus = A.spellDmg || 0;
  // 魔法方碑:有伤害法术可跟进时先开碑
  const obe = can.find((h) => h.c.sp?.k === "obelisk");
  if (obe && can.some((h) => h.c.sp && (h.c.sp.k === "dmg" || h.c.sp.k === "aoe") && effCost(st, "a", h.c) <= A.mana - effCost(st, "a", obe.c))) {
    if (castSpell(st, "a", obe.i, null)) {
      log(st, `对手施放了「${obe.c.name}」,本回合法术伤害 +1`);
      return true;
    }
  }
  // 斩杀
  for (const h of dmg) {
    if (spDmgN(h.c) + bonus >= P.hp + (P.armor || 0)) {
      if (castSpell(st, "a", h.i, { side: "p", hero: true })) {
        log(st, `对手使用「${h.c.name}」直击你的英雄!`);
        return true;
      }
    }
  }
  // 群体清场
  const aoe = can.filter((h) => h.c.sp?.k === "aoe").sort((x, y) => spDmgN(y.c) - spDmgN(x.c));
  if (aoe.length && P.board.length >= 3) {
    if (castSpell(st, "a", aoe[0].i, null)) {
      log(st, `对手施放了「${aoe[0].c.name}」`);
      return true;
    }
  }
  // 点杀大威胁
  if (dmg.length && P.board.length) {
    const th = [...P.board].sort((a, b) => b.atk * 2 + b.hp - (a.atk * 2 + a.hp))[0];
    if (th.atk >= 3) {
      const eff = [...dmg].reverse().find((h) => spDmgN(h.c) + bonus >= th.hp);
      if (eff) {
        if (castSpell(st, "a", eff.i, { side: "p", uid: th.uid })) {
          log(st, `对手对「${th.name}」使用了「${eff.c.name}」`);
          return true;
        }
      }
    }
  }
  // 治疗
  const heal = can.find((h) => h.c.sp?.k === "heal");
  if (heal && A.hp <= 20) {
    if (castSpell(st, "a", heal.i, { side: "a", hero: true })) {
      log(st, `对手使用「${heal.c.name}」恢复了生命`);
      return true;
    }
  }
  // 夜影花蕾:优先召唤随从,否则施放法术
  const bloom = can.find((h) => h.c.sp?.k === "bloom");
  if (bloom) {
    const mOk = A.board.length < 6 && A.deck.some((cid) => byId[cid].type === "m");
    const sOk = A.deck.some((cid) => byId[cid].type === "s");
    if (mOk || sOk) {
      const en2 = A.hand[bloom.i];
      A.mana -= effCost(st, "a", bloom.c);
      A.hand.splice(bloom.i, 1);
      moonTutor(st, "a", en2);
      if (mOk) {
        const pick = sampleDeck(st, "a", "m").sort((x, y) => byId[y].cost - byId[x].cost)[0];
        removeFromDeck(st, "a", pick);
        log(st, `对手的「夜影花蕾」从牌库召唤了「${byId[pick].name}」`);
        summonFromDeck(st, "a", pick);
      } else {
        const pick = sampleDeck(st, "a", "s")[0];
        removeFromDeck(st, "a", pick);
        log(st, `对手的「夜影花蕾」从牌库施放了「${byId[pick].name}」`);
        castDeckSpell(st, "a", pick);
      }
      return true;
    }
  }
  // 星夜露宿:按局势抉择三次
  const camp = can.find((h) => h.c.sp?.k === "camp");
  if (camp) {
    const en2 = A.hand[camp.i];
    A.mana -= effCost(st, "a", camp.c);
    A.hand.splice(camp.i, 1);
    moonTutor(st, "a", en2);
    const picked: string[] = [];
    for (let k = 0; k < 3; k++) {
      const opt = A.hp + (A.armor || 0) <= 24 ? "armor" : A.hand.length <= 6 ? "draw" : "mana";
      campEffect(st, "a", opt);
      picked.push(campLabel(opt));
    }
    log(st, `对手施放「星夜露宿」,抉择了:${picked.join("、")}`);
    return true;
  }
  // 鼓舞/滋养类抉择:法力未满时优先涨水晶,否则抽牌
  const chooser = can.find((h) => h.c.sp?.k === "choose");
  if (chooser && chooser.c.sp?.k === "choose") {
    const opts = chooser.c.sp.opts;
    const manaOpt = opts.find((o) => o.fx === "manaEmpty" || o.fx === "manaFull");
    const drawOpt = opts.find((o) => o.fx === "draw");
    const pick = A.maxMana < 10 && A.hand.length > 2 && manaOpt ? manaOpt : drawOpt || manaOpt || opts[0];
    const en2 = A.hand[chooser.i];
    A.mana -= effCost(st, "a", chooser.c);
    A.hand.splice(chooser.i, 1);
    moonTutor(st, "a", en2);
    applyOpt(st, "a", pick);
    log(st, `对手施放「${chooser.c.name}」,抉择了${pick.label}`);
    return true;
  }
  // 生物计划:法力未满时铺水晶
  const bio = can.find((h) => h.c.sp?.k === "bio");
  if (bio && A.maxMana < 10) {
    if (castSpell(st, "a", bio.i, null)) {
      log(st, `对手施放了「${bio.c.name}」,双方各获得 2 个法力水晶`);
      return true;
    }
  }
  // 幸运币:恰好能解锁一张差 1 费的牌时使用
  const coin = can.find((h) => h.c.sp?.k === "coin");
  if (coin && A.mana < 10 && hand.some((h) => effCost(st, "a", h.c) === A.mana + 1)) {
    if (castSpell(st, "a", coin.i, null)) {
      log(st, "对手使用了「幸运币」");
      return true;
    }
  }
  // 月光指引:发现费用最高的牌
  const moon = can.find((h) => h.c.sp?.k === "moonlight");
  if (moon && A.deck.length && A.hand.length < HAND_LIMIT) {
    const en2 = A.hand[moon.i];
    A.mana -= effCost(st, "a", moon.c);
    A.hand.splice(moon.i, 1);
    moonTutor(st, "a", en2);
    const pick = sampleDeckAny(st, "a").sort((x, y) => byId[y].cost - byId[x].cost)[0];
    gainMoonCopy(st, "a", pick);
    log(st, `对手施放「${moon.c.name}」,发现了一张牌的复制`);
    return true;
  }
  // 铺随从(优先大体格)
  const mins = can
    .filter((h): h is { i: number; c: MinionCard } => h.c.type === "m")
    .sort((x, y) => y.c.cost - x.c.cost || y.c.atk - x.c.atk);
  if (mins.length && A.board.length < 6) {
    if (playMinion(st, "a", mins[0].i)) {
      log(st, `对手打出了「${mins[0].c.name}」`);
      return true;
    }
  }
  // 强化
  const bf = can.find((h) => h.c.sp?.k === "buff");
  if (bf && A.board.length) {
    const m = [...A.board].sort((a, b) => b.atk + b.hp - (a.atk + a.hp))[0];
    if (castSpell(st, "a", bf.i, { side: "a", uid: m.uid })) {
      log(st, `对手对「${m.name}」使用了「${bf.c.name}」`);
      return true;
    }
  }
  // 抽牌
  const dr = can.find((h) => h.c.sp?.k === "draw");
  if (dr && A.hand.length <= 5 && A.deck.length > 2) {
    if (castSpell(st, "a", dr.i, null)) {
      log(st, `对手使用了「${dr.c.name}」`);
      return true;
    }
  }
  // 残局烧脸
  if (dmg.length && P.hp <= 15) {
    if (castSpell(st, "a", dmg[0].i, { side: "p", hero: true })) {
      log(st, `对手使用「${dmg[0].c.name}」攻击你的英雄`);
      return true;
    }
  }
  return false;
}
export function aiAttack(st: GameState): boolean {
  const ready = st.a.board.filter((m) => !m.sick && !m.attacked && m.atk > 0);
  if (!ready.length) return false;
  const m = ready[0];
  const taunts = st.p.board.filter((x) => x.taunt);
  let tgt: AttackTarget, tname = "";
  if (taunts.length) {
    const t =
      taunts.find((t) => m.atk >= t.hp && t.atk < m.hp) ||
      taunts.find((t) => m.atk >= t.hp) ||
      [...taunts].sort((a, b) => a.hp - b.hp)[0];
    tgt = { uid: t.uid }; tname = t.name;
  } else {
    const total = ready.reduce((s, x) => s + x.atk, 0);
    if (total >= st.p.hp + (st.p.armor || 0)) tgt = { hero: true };
    else {
      const good = st.p.board.filter(
        (t) => m.atk >= t.hp && (t.atk >= 3 || t.atk + t.hp >= m.atk + m.hp) && (t.atk < m.hp || t.atk + t.hp > m.atk + m.hp)
      );
      if (good.length) {
        const t = good.sort((a, b) => b.atk + b.hp - (a.atk + a.hp))[0];
        tgt = { uid: t.uid }; tname = t.name;
      } else tgt = { hero: true };
    }
  }
  if (!resolveAttack(st, "a", m.uid, tgt)) return false;
  log(st, `对手的「${m.name}」攻击了${tgt.hero ? "你的英雄" : `「${tname}」`}`);
  return true;
}
// 克隆 state → 跑完整个 AI 回合 → 产出快照数组,UI 层以 750ms 间隔依次回放。
// ⚠️ AI 回合期间不要另行 setGame,会被后续快照覆盖。
export function computeAiTurn(b: GameState): GameState[] {
  const snaps: GameState[] = [];
  let st = clone(b);
  const push = () => snaps.push(clone(st));
  st.fx = [];
  startTurn(st, "a");
  if (!st.winner) log(st, "对手抽了一张牌");
  push();
  if (st.winner) return snaps;
  let g = 0;
  while (g++ < 12 && !st.winner) { st.fx = []; if (!aiPlay(st)) break; push(); }
  g = 0;
  while (g++ < 12 && !st.winner) { st.fx = []; if (!aiAttack(st)) break; push(); }
  return snaps;
}
