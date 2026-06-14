// ================= AI 对手 =================
// aiPlay 是一条优先级 if-return 链,每次只做一个动作,返回是否有动作。
// 抉择类法术 AI 不走弹窗:在分支内手动扣费 + splice 手牌,按启发式直接结算(与玩家的延迟支付路径不同)。
import { byId, HAND_LIMIT } from "./cards";
import {
  afterSpellPlayed, applyOpt, campEffect, campLabel, castDeckSpell, castSpell, clone,
  effCard, effCost, endTurnCleanup, gainMoonCopy, log, moonTutor, playMinion,
  removeFromDeck, resolveAttack, sampleDeck, sampleDeckAny, startTurn, summonFromDeck,
} from "./engine";
import type { AttackTarget, Card, GameState, MinionCard } from "./types";

// dmg/aoe 法术的基础伤害值(用于排序与斩杀计算)
const spDmgN = (c: Card): number => (c.sp && (c.sp.k === "dmg" || c.sp.k === "aoe") ? c.sp.n : 0);

export function aiPlay(st: GameState): boolean {
  const A = st.a, P = st.p;
  // effCard 解析殒命暗影:在手牌中即视为上一张打出的法术(无可复制时仍为原牌,不会被任何分支选中)
  const hand = A.hand.map((e, i) => ({ i, c: effCard(st, "a", e) }));
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
      afterSpellPlayed(st, "a", bloom.c.id);
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
    afterSpellPlayed(st, "a", camp.c.id);
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
    afterSpellPlayed(st, "a", chooser.c.id);
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
    afterSpellPlayed(st, "a", moon.c.id);
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
  // 暗影之门:牌库还有法术且手牌未满时补法术
  const sdraw = can.find((h) => h.c.sp?.k === "spelldraw");
  if (sdraw && A.hand.length < HAND_LIMIT && A.deck.some((cid) => byId[cid].type === "s")) {
    if (castSpell(st, "a", sdraw.i, null)) { log(st, `对手使用了「${sdraw.c.name}」`); return true; }
  }
  // 换挡漂移:手牌不多时循环过牌(净 +1 张)
  const regear = can.find((h) => h.c.sp?.k === "shuffleDraw");
  if (regear && A.hand.length <= 6 && A.deck.length > 3) {
    if (castSpell(st, "a", regear.i, null)) { log(st, `对手使用了「${regear.c.name}」`); return true; }
  }
  // 街舞起跳:复制场上最强随从(有随从且未满场)
  const dance = can.find((h) => h.c.sp?.k === "bounce");
  if (dance && A.board.length && A.board.length < 6) {
    const m = [...A.board].sort((a, b) => b.atk + b.hp - (a.atk + a.hp))[0];
    if (castSpell(st, "a", dance.i, { side: "a", uid: m.uid })) { log(st, `对手对「${m.name}」使用了「${dance.c.name}」`); return true; }
  }
  // 伺机待发:手中有"减 2 费后才打得起"的法术时先铺垫(下一轮 aiPlay 会接着打出)
  const ready = can.find((h) => h.c.sp?.k === "ready");
  if (ready && hand.some((h) => h.c.type === "s" && h.c.sp?.k !== "ready" && effCost(st, "a", h.c) > A.mana && effCost(st, "a", h.c) - 2 <= A.mana)) {
    if (castSpell(st, "a", ready.i, null)) { log(st, `对手使用了「${ready.c.name}」,下一张法术费用降低`); return true; }
  }
  // 秘密通道:手牌偏少时换一手新牌(回合结束自动换回)
  const passage = can.find((h) => h.c.sp?.k === "passage");
  if (passage && !A.stash && A.hand.length <= 3 && A.deck.length >= 4) {
    if (castSpell(st, "a", passage.i, null)) { log(st, `对手施放了「${passage.c.name}」`); return true; }
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
  const taunts = st.p.board.filter((x) => x.taunt);
  // 突袭随从在召唤失调(sick)期间也能攻击,但只能打随从(下面 canHero 处理)
  const ready = st.a.board.filter((m) => !m.attacked && m.atk > 0 && (!m.sick || m.rush));
  if (!ready.length) return false;
  // 斩杀总伤只统计"能打英雄"的随从(非召唤失调);突袭随从这回合打不了脸
  const faceTotal = ready.filter((m) => !m.sick).reduce((s, m) => s + m.atk, 0);
  const lethal = faceTotal >= st.p.hp + (st.p.armor || 0);
  // 逐个挑出"有有效攻击目标"的随从,避免突袭随从无合适目标时卡住整轮攻击
  for (const m of ready) {
    const canHero = !m.sick; // 召唤失调的突袭随从不能攻击英雄
    let tgt: AttackTarget | null = null, tname = "";
    if (taunts.length) {
      const t =
        taunts.find((t) => m.atk >= t.hp && t.atk < m.hp) ||
        taunts.find((t) => m.atk >= t.hp) ||
        [...taunts].sort((a, b) => a.hp - b.hp)[0];
      tgt = { uid: t.uid }; tname = t.name;
    } else if (canHero && lethal) {
      tgt = { hero: true };
    } else {
      const good = st.p.board.filter(
        (t) => m.atk >= t.hp && (t.atk >= 3 || t.atk + t.hp >= m.atk + m.hp) && (t.atk < m.hp || t.atk + t.hp > m.atk + m.hp)
      );
      if (good.length) {
        const t = good.sort((a, b) => b.atk + b.hp - (a.atk + a.hp))[0];
        tgt = { uid: t.uid }; tname = t.name;
      } else if (canHero) {
        tgt = { hero: true };
      }
      // 否则:突袭随从无合适随从可打且打不了脸 → 跳过,尝试下一个随从
    }
    if (tgt && resolveAttack(st, "a", m.uid, tgt)) {
      log(st, `对手的「${m.name}」攻击了${tgt.hero ? "你的英雄" : `「${tname}」`}`);
      return true;
    }
  }
  return false;
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
  if (st.a.stash) { st.fx = []; endTurnCleanup(st, "a"); push(); } // 秘密通道:回合结束换回手牌
  return snaps;
}
