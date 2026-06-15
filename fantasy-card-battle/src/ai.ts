// ================= AI 对手 =================
// aiPlay 是一条优先级 if-return 链,每次只做一个动作,返回是否有动作。
// 抉择类法术 AI 不走弹窗:在分支内手动扣费 + splice 手牌,按启发式直接结算(与玩家的延迟支付路径不同)。
import { byId, HAND_LIMIT, HERO_POWER_COST } from "./cards";
import {
  afterSpellPlayed, applyOpt, campEffect, castDeckSpell, castSpell, clone,
  dredgePick, effCard, effCost, endTurnCleanup, gainMoonCopy, heroAtkVal, log, mapTake, mapTutor, moonTutor,
  playMinion, playWeapon, removeFromDeck, resolveAttack, resolveHeroAttack, sampleDeck, sampleDeckAny,
  startTurn, summonFromDeck, thawFrozen, useHeroPower,
} from "./engine";
import type { AttackTarget, Card, GameState, HandEntry, Minion, MinionCard, Side } from "./types";
import { planPlayPhase } from "./aiPlanner";

// dmg/aoe 法术的基础伤害值(用于排序与斩杀计算)
const spDmgN = (c: Card): number => (c.sp && (c.sp.k === "dmg" || c.sp.k === "aoe") ? c.sp.n : 0);

// 随从本回合是否还能发起攻击(突袭随从在召唤失调期间也能攻击随从)。
// 回收类法术(街舞起跳/暗影步)只回收"打不出去"的随从,绝不动正能攻击的随从,以免浪费伤害。
const canAttackNow = (m: Minion): boolean => !m.attacked && m.atk > 0 && !m.frozen && (!m.sick || m.rush);

// 当前手牌里可支付、能直击的单体伤害法术(含法伤加成),按手牌实体 uid 索引以便结算后重新定位
const burnInHand = (st: GameState): { uid: number; dmg: number }[] => {
  const A = st.a;
  return A.hand
    .map((e) => ({ e, c: effCard(st, "a", e) }))
    .filter((h) => h.c.sp?.k === "dmg" && effCost(st, "a", h.c, h.e) <= A.mana)
    .map((h) => ({ uid: h.e.uid, dmg: spDmgN(h.c) + (A.spellDmg || 0) }));
};
const handIdxByUid = (st: GameState, uid: number): number => st.a.hand.findIndex((e) => e.uid === uid);

// 综合斩杀:把"非召唤失调随从攻击 + 英雄武器攻击 + 可支付的烧脸法术"合并成一套击杀序列。
// 先用打不到脸的资源(突袭随从→烧脸→英雄→普通随从)清掉嘲讽,再全力打脸。
// 每个原子动作后调用 step()(供 computeAiTurn 逐帧产出快照)。只在 lethalReachable 确认后对真实 state 执行。
function forceKill(st: GameState, step?: () => void): void {
  const A = st.a, P = st.p;
  // 成功才推进快照;失败则返回 false,调用方据此跳出循环避免空转
  const act = (fn: () => boolean): boolean => { st.fx = []; st.act = null; const ok = fn(); if (ok) step?.(); return ok; };
  // 1) 逐个清掉嘲讽
  let guard = 0;
  while (!st.winner && P.board.some((m) => m.taunt) && guard++ < 24) {
    const taunt = [...P.board].filter((m) => m.taunt).sort((a, b) => a.hp - b.hp)[0];
    // a) 召唤失调的突袭随从打不了脸,优先拿来撞嘲讽(取刚好能击杀的,否则最小的去消耗)
    const rushSick = A.board
      .filter((m) => !m.attacked && m.atk > 0 && !m.frozen && m.sick && m.rush)
      .sort((a, b) => a.atk - b.atk);
    const r = rushSick.find((m) => m.atk >= taunt.hp) || rushSick[0];
    if (r) { if (!act(() => resolveAttack(st, "a", r.uid, { uid: taunt.uid }))) break; continue; }
    // b) 烧脸法术点掉嘲讽(取刚好够的,省下大的打脸)
    const b = burnInHand(st).filter((x) => x.dmg >= taunt.hp).sort((a, b) => a.dmg - b.dmg)[0];
    if (b) { if (!act(() => castSpell(st, "a", handIdxByUid(st, b.uid), { side: "p", uid: taunt.uid }))) break; continue; }
    // c) 英雄攻击嘲讽
    if (heroAtkVal(A) >= taunt.hp && !A.heroAttacked) {
      if (!act(() => resolveHeroAttack(st, "a", { uid: taunt.uid }))) break; continue;
    }
    // d) 最后才动用能打脸的随从
    const m = A.board
      .filter((x) => !x.attacked && x.atk > 0 && !x.frozen && !x.sick && x.atk >= taunt.hp)
      .sort((a, b) => a.atk - b.atk)[0];
    if (m) { if (!act(() => resolveAttack(st, "a", m.uid, { uid: taunt.uid }))) break; continue; }
    break; // 清不掉嘲讽,放弃(克隆模拟里走到这步即视为不可斩杀)
  }
  if (st.winner || P.board.some((m) => m.taunt)) return;
  // 2) 全力打脸:随从 → 英雄 → 剩余烧脸
  guard = 0;
  while (!st.winner && guard++ < 24) {
    const m = A.board.find((x) => !x.attacked && x.atk > 0 && !x.frozen && !x.sick);
    if (!m || !act(() => resolveAttack(st, "a", m.uid, { hero: true }))) break;
  }
  if (!st.winner && heroAtkVal(A) > 0 && !A.heroAttacked) act(() => resolveHeroAttack(st, "a", { hero: true }));
  guard = 0;
  while (!st.winner && guard++ < 24) {
    const b = burnInHand(st).sort((a, b) => b.dmg - a.dmg)[0];
    if (!b || !act(() => castSpell(st, "a", handIdxByUid(st, b.uid), { side: "p", hero: true }))) break;
  }
}

// 在克隆上跑一遍 forceKill,看是否真能把玩家打死(同一份确定性代码,真机回放必然复现)。
function lethalReachable(st: GameState): boolean {
  const c = clone(st);
  forceKill(c);
  return c.winner === "a";
}

// 模拟“接下来这一整回合还能花掉多少法力”(用于幸运币价值判断)。在去掉所有币的克隆上循环跑 aiPlay。
function simSpend(s: GameState): number {
  let spent = 0, guard = 0;
  while (guard++ < 16) {
    const m0 = s.a.mana;
    if (!aiPlay(s, true)) break; // noSim:模拟里禁用幸运币分支,避免 aiPlay↔simSpend 无限递归
    spent += m0 - s.a.mana;
  }
  return spent;
}

// ===== 交互类法术的 AI 启发式结算 =====
// choose/camp/bloom/moonlight/map/dredge 不走 castSpell(没有 EFFECTS.cast),AI 在此手动扣费 + splice + 启发式抉择。
// 抽成独立 helper 供 aiPlay 贪婪链与 aiPlanner 搜索共用,确保两条路径对这些牌的决策完全一致。
// 约定:返回 true 表示已结算;返回 false 表示当前不适用(未触碰 state),调用方据此跳过。
const payAndRemove = (st: GameState, side: Side, i: number): Card => {
  const s = st[side];
  const en = s.hand[i];
  const c = effCard(st, side, en);
  s.mana -= effCost(st, side, c);
  s.hand.splice(i, 1);
  afterSpellPlayed(st, side, c.id);
  moonTutor(st, side, en);
  mapTutor(st, side, en); // 异教地图:抉择类发现牌(探底/地图/抉择等)从手牌打出也触发后续抽取
  return c;
};
export function applyBloom(st: GameState, side: Side, i: number): boolean {
  const A = st[side];
  const mOk = A.board.length < 6 && A.deck.some((cid) => byId[cid].type === "m");
  const sOk = A.deck.some((cid) => byId[cid].type === "s");
  if (!mOk && !sOk) return false;
  payAndRemove(st, side, i);
  if (mOk) {
    const pick = sampleDeck(st, side, "m").sort((x, y) => byId[y].cost - byId[x].cost)[0];
    removeFromDeck(st, side, pick);
    log(st, `对手的「夜影花蕾」从牌库召唤了「${byId[pick].name}」`);
    summonFromDeck(st, side, pick);
  } else {
    const pick = sampleDeck(st, side, "s")[0];
    removeFromDeck(st, side, pick);
    log(st, `对手的「夜影花蕾」从牌库施放了一张法术`); // 对手的法术牌名不公开
    castDeckSpell(st, side, pick);
  }
  return true;
}
export function applyCamp(st: GameState, side: Side, i: number): boolean {
  const A = st[side];
  payAndRemove(st, side, i);
  for (let k = 0; k < 3; k++) {
    const opt = A.hp + (A.armor || 0) <= 24 ? "armor" : A.hand.length <= 6 ? "draw" : "mana";
    campEffect(st, side, opt);
  }
  log(st, `对手施放了「星夜露宿」`); // 对手的抉择选项不公开
  return true;
}
export function applyChoose(st: GameState, side: Side, i: number): boolean {
  const A = st[side];
  const c = effCard(st, side, A.hand[i]);
  if (c.sp?.k !== "choose") return false;
  const opts = c.sp.opts;
  const manaOpt = opts.find((o) => o.fx === "manaEmpty" || o.fx === "manaFull");
  const drawOpt = opts.find((o) => o.fx === "draw");
  const pick = A.maxMana < 10 && A.hand.length > 2 && manaOpt ? manaOpt : drawOpt || manaOpt || opts[0];
  payAndRemove(st, side, i);
  applyOpt(st, side, pick);
  log(st, `对手施放了「${c.name}」`); // 对手的抉择选项不公开
  return true;
}
export function applyMoonlight(st: GameState, side: Side, i: number): boolean {
  const A = st[side];
  if (!A.deck.length || A.hand.length >= HAND_LIMIT) return false;
  const c = payAndRemove(st, side, i);
  const pick = sampleDeckAny(st, side).sort((x, y) => byId[y].cost - byId[x].cost)[0];
  gainMoonCopy(st, side, pick);
  log(st, `对手施放「${c.name}」,发现了一张牌的复制`);
  return true;
}
export function applyMap(st: GameState, side: Side, i: number): boolean {
  const A = st[side];
  if (A.hand.length >= HAND_LIMIT || !A.deck.length) return false;
  const c = payAndRemove(st, side, i);
  const opts = sampleDeckAny(st, side);
  const pick = [...opts].sort((x, y) => byId[y].cost - byId[x].cost)[0];
  mapTake(st, side, pick, opts.filter((cid) => cid !== pick));
  log(st, `对手施放了「${c.name}」`);
  return true;
}
export function applyDredge(st: GameState, side: Side, i: number): boolean {
  const A = st[side];
  if (!A.deck.length) return false;
  const en = A.hand[i];
  const c = effCard(st, side, en);
  if (c.sp?.k !== "dredge") return false;
  const willDraw = !!c.sp.comboDraw && (A.playedThisTurn || 0) > 0;
  payAndRemove(st, side, i);
  const n = Math.min(3, A.deck.length);
  let best = 0;
  for (let k = 1; k < n; k++) if (byId[A.deck[k]].cost > byId[A.deck[best]].cost) best = k;
  dredgePick(st, side, best, willDraw);
  log(st, `对手施放了「${c.name}」`);
  return true;
}

// noSim=true 时禁用会自我模拟(simSpend)的分支,供 simSpend 内部调用以杜绝递归
export function aiPlay(st: GameState, noSim = false): boolean {
  const A = st.a, P = st.p;
  // effCard 解析殒命暗影:在手牌中即视为上一张打出的法术(无可复制时仍为原牌,不会被任何分支选中)
  const hand = A.hand.map((e, i) => ({ i, c: effCard(st, "a", e), e }));
  const can = hand.filter((h) => effCost(st, "a", h.c, h.e) <= A.mana);
  if (!can.length) return false;
  const dmg = can.filter((h) => h.c.sp?.k === "dmg").sort((x, y) => spDmgN(y.c) - spDmgN(x.c));
  const bonus = A.spellDmg || 0;
  // 魔法方碑:有伤害法术可跟进时先开碑
  const obe = can.find((h) => h.c.sp?.k === "obelisk");
  if (obe && can.some((h) => h.c.sp && (h.c.sp.k === "dmg" || h.c.sp.k === "aoe") && effCost(st, "a", h.c) <= A.mana - effCost(st, "a", obe.c))) {
    if (castSpell(st, "a", obe.i, null)) return true; // 施放日志由引擎宣告
  }
  // 斩杀
  for (const h of dmg) {
    if (spDmgN(h.c) + bonus >= P.hp + (P.armor || 0)) {
      if (castSpell(st, "a", h.i, { side: "p", hero: true })) return true; // 施放日志由引擎宣告
    }
  }
  // 群体清场
  const aoe = can.filter((h) => h.c.sp?.k === "aoe").sort((x, y) => spDmgN(y.c) - spDmgN(x.c));
  if (aoe.length && P.board.length >= 3) {
    if (castSpell(st, "a", aoe[0].i, null)) return true; // 施放日志由引擎宣告
  }
  // 点杀大威胁
  if (dmg.length && P.board.length) {
    const th = [...P.board].sort((a, b) => b.atk * 2 + b.hp - (a.atk * 2 + a.hp))[0];
    if (th.atk >= 3) {
      const eff = [...dmg].reverse().find((h) => spDmgN(h.c) + bonus >= th.hp);
      if (eff) {
        if (castSpell(st, "a", eff.i, { side: "p", uid: th.uid })) return true; // 施放日志由引擎宣告
      }
    }
  }
  // 治疗
  const heal = can.find((h) => h.c.sp?.k === "heal");
  if (heal && A.hp <= 20) {
    if (castSpell(st, "a", heal.i, { side: "a", hero: true })) return true; // 施放日志由引擎宣告
  }
  // 夜影花蕾:优先召唤随从,否则施放法术
  const bloom = can.find((h) => h.c.sp?.k === "bloom");
  if (bloom && applyBloom(st, "a", bloom.i)) return true;
  // 星夜露宿:按局势抉择三次
  const camp = can.find((h) => h.c.sp?.k === "camp");
  if (camp && applyCamp(st, "a", camp.i)) return true;
  // 鼓舞/滋养类抉择:法力未满时优先涨水晶,否则抽牌
  const chooser = can.find((h) => h.c.sp?.k === "choose");
  if (chooser && applyChoose(st, "a", chooser.i)) return true;
  // 生物计划:法力未满时铺水晶
  const bio = can.find((h) => h.c.sp?.k === "bio");
  if (bio && A.maxMana < 10) {
    if (castSpell(st, "a", bio.i, null)) return true; // 施放日志由引擎宣告
  }
  // 幸运币:仅当“多这 1 费,本回合能多花掉法力(打出更贵/更多的牌)”时才用,否则留着,避免空过浪费
  const coin = can.find((h) => h.c.sp?.k === "coin");
  if (coin && A.mana < 10 && !noSim) {
    // simSpend 走 noSim,内部不会再碰幸运币分支,故无需在克隆里剔除币
    const without = clone(st);
    const withc = clone(st); withc.a.mana = Math.min(10, withc.a.mana + 1);
    if (simSpend(withc) > simSpend(without)) {
      if (castSpell(st, "a", coin.i, null)) return true; // 施放日志由引擎宣告
    }
  }
  // 月光指引:发现费用最高的牌
  const moon = can.find((h) => h.c.sp?.k === "moonlight");
  if (moon && applyMoonlight(st, "a", moon.i)) return true;
  // 铺随从(优先大体格)
  const mins = can
    .filter((h): h is { i: number; c: MinionCard; e: HandEntry } => h.c.type === "m")
    .sort((x, y) => y.c.cost - x.c.cost || y.c.atk - x.c.atk);
  if (mins.length && A.board.length < 6) {
    if (playMinion(st, "a", mins[0].i)) return true; // 打出日志由引擎宣告
  }
  // 装备武器:无武器或新武器(攻击×耐久)更强时打出
  const wep = can.find((h) => h.c.type === "w");
  if (wep && wep.c.type === "w") {
    const cur = A.weapon;
    if (!cur || wep.c.atk * wep.c.dur > cur.atk * cur.dur) {
      if (playWeapon(st, "a", wep.i)) return true; // 装备日志由引擎宣告
    }
  }
  // 强化
  const bf = can.find((h) => h.c.sp?.k === "buff");
  if (bf && A.board.length) {
    const m = [...A.board].sort((a, b) => b.atk + b.hp - (a.atk + a.hp))[0];
    if (castSpell(st, "a", bf.i, { side: "a", uid: m.uid })) return true; // 施放日志由引擎宣告
  }
  // 抽牌
  const dr = can.find((h) => h.c.sp?.k === "draw");
  if (dr && A.hand.length <= 5 && A.deck.length > 2) {
    if (castSpell(st, "a", dr.i, null)) return true; // 施放日志由引擎宣告
  }
  // 暗影之门:牌库还有法术且手牌未满时补法术
  const sdraw = can.find((h) => h.c.sp?.k === "spelldraw");
  if (sdraw && A.hand.length < HAND_LIMIT && A.deck.some((cid) => byId[cid].type === "s")) {
    if (castSpell(st, "a", sdraw.i, null)) return true; // 施放日志由引擎宣告
  }
  // 换挡漂移:手牌不多时循环过牌(净 +1 张)
  const regear = can.find((h) => h.c.sp?.k === "shuffleDraw");
  if (regear && A.hand.length <= 6 && A.deck.length > 3) {
    if (castSpell(st, "a", regear.i, null)) return true; // 施放日志由引擎宣告
  }
  // 街舞起跳:只回收“本回合无法攻击”的随从(刚下、非突袭的召唤失调随从),换成能突袭交换的舞者;
  // 绝不回收本回合能动的随从,以免浪费其攻击/葬送斩杀(斩杀已在 computeAiTurn 前置处理)
  const dance = can.find((h) => h.c.sp?.k === "bounce");
  if (dance && A.board.length < 6) {
    const cand = A.board.filter((m) => !canAttackNow(m));
    if (cand.length) {
      const m = [...cand].sort((a, b) => b.atk + b.hp - (a.atk + a.hp))[0];
      if (castSpell(st, "a", dance.i, { side: "a", uid: m.uid })) return true; // 施放日志由引擎宣告
    }
  }
  // 异教地图:发现并抽一张(取费用最高);若本回合稍后打出它,触发后续抽取
  const map = can.find((h) => h.c.sp?.k === "map");
  if (map && applyMap(st, "a", map.i)) return true;
  // 垂钓时光:探底(底部费用最高者置顶);连击则随即抽取
  const dredge = can.find((h) => h.c.sp?.k === "dredge");
  if (dredge && applyDredge(st, "a", dredge.i)) return true;
  // 鬼魅攻击等:连击触发时用小伤害法术换抽牌(优先点掉能击杀的小怪,否则打脸)
  const cantrip = can.find((h) => h.c.sp?.k === "dmg" && h.c.sp.comboDraw);
  if (cantrip && cantrip.c.sp?.k === "dmg" && cantrip.c.sp.comboDraw && (A.playedThisTurn || 0) > 0) {
    const n = spDmgN(cantrip.c) + bonus;
    const killable = P.board.find((m) => m.hp <= n);
    const target = killable ? { side: "p" as const, uid: killable.uid } : { side: "p" as const, hero: true };
    if (castSpell(st, "a", cantrip.i, target)) return true; // 施放日志由引擎宣告
  }
  // 暗影步:回收一个召唤/加税类战吼随从以重施(需本回合能再打出,0 费不占用法力)
  const sstep = can.find((h) => h.c.sp?.k === "shadowstep");
  if (sstep && A.board.length) {
    // 只回收本回合无法攻击的战吼随从(刚下场等),绝不回收正能攻击的随从——让它先攻击
    const reuse = A.board.find((m) => {
      const cc = byId[m.cid];
      if (canAttackNow(m) || !cc.bc) return false;
      if (Math.max(0, cc.cost - 2) > A.mana) return false;
      if (cc.bc.k === "summonMini" || cc.bc.k === "loatheb") return true;
      // 贪婪的伴侣:仅当手中另有 2 费牌(回手重打后能触发硬币)才值得回收
      if (cc.bc.k === "greedyCoin") return A.hand.some((e) => effCost(st, "a", byId[e.cid], e) === 2);
      return false;
    });
    if (reuse && castSpell(st, "a", sstep.i, { side: "a", uid: reuse.uid })) return true; // 施放日志由引擎宣告
  }
  // 伺机待发:手中有"减 2 费后才打得起"的法术时先铺垫(下一轮 aiPlay 会接着打出)。
  // 仅"打得起"还不够——若那张法术因没有合法目标/局势不符而最终不会被打出,铺垫就是空放。
  // 故克隆模拟:打出伺机待发后跑完本回合,确认某张候选法术真的离手才提交。
  const ready = can.find((h) => h.c.sp?.k === "ready");
  if (ready && !noSim) {
    const cand = hand.filter((h) => h.c.type === "s" && h.c.sp?.k !== "ready" && effCost(st, "a", h.c) > A.mana && effCost(st, "a", h.c) - 2 <= A.mana);
    const sim = clone(st);
    if (cand.length && castSpell(sim, "a", ready.i, null)) {
      let guard = 0;
      while (guard++ < 16 && aiPlay(sim, true)) { /* 跑完本回合(noSim 下伺机待发分支被跳过,不会递归/重复减费)*/ }
      const used = cand.some((h) => !sim.a.hand.some((e) => e.uid === h.e.uid));
      if (used && castSpell(st, "a", ready.i, null)) return true; // 施放日志由引擎宣告
    }
  }
  // 秘密通道:手牌偏少时换一手新牌(回合结束自动换回)
  const passage = can.find((h) => h.c.sp?.k === "passage");
  if (passage && !A.stash && A.hand.length <= 3 && A.deck.length >= 4) {
    if (castSpell(st, "a", passage.i, null)) return true; // 施放日志由引擎宣告
  }
  // 英雄技能:潜行者无武器时装备匕首;德鲁伊用富余法力换护甲+攻击(留作攻击/铺场之后)
  if (!A.heroPowerUsed && A.mana >= HERO_POWER_COST) {
    const worth = A.classId === "rogue" ? !A.weapon : true;
    if (worth && useHeroPower(st, "a")) return true;
  }
  // 残局烧脸
  if (dmg.length && P.hp <= 15) {
    if (castSpell(st, "a", dmg[0].i, { side: "p", hero: true })) return true; // 施放日志由引擎宣告
  }
  return false;
}
export function aiAttack(st: GameState): boolean {
  const taunts = st.p.board.filter((x) => x.taunt);
  // 突袭随从在召唤失调(sick)期间也能攻击,但只能打随从(下面 canHero 处理);冻结随从本回合无法攻击
  const ready = st.a.board.filter((m) => !m.attacked && m.atk > 0 && !m.frozen && (!m.sick || m.rush));
  if (!ready.length) return false;
  // 斩杀总伤只统计"能打英雄"的随从(非召唤失调);突袭随从这回合打不了脸
  const faceTotal = ready.filter((m) => !m.sick).reduce((s, m) => s + m.atk, 0);
  const lethal = faceTotal >= st.p.hp + (st.p.armor || 0);
  // 逐个挑出"有有效攻击目标"的随从,避免突袭随从无合适目标时卡住整轮攻击
  for (const m of ready) {
    const canHero = !m.sick; // 召唤失调的突袭随从不能攻击英雄
    let tgt: AttackTarget | null = null;
    if (taunts.length) {
      const t =
        taunts.find((t) => m.atk >= t.hp && t.atk < m.hp) ||
        taunts.find((t) => m.atk >= t.hp) ||
        [...taunts].sort((a, b) => a.hp - b.hp)[0];
      tgt = { uid: t.uid };
    } else if (canHero && lethal) {
      tgt = { hero: true };
    } else {
      const good = st.p.board.filter(
        (t) => m.atk >= t.hp && (t.atk >= 3 || t.atk + t.hp >= m.atk + m.hp) && (t.atk < m.hp || t.atk + t.hp > m.atk + m.hp)
      );
      if (good.length) {
        const t = good.sort((a, b) => b.atk + b.hp - (a.atk + a.hp))[0];
        tgt = { uid: t.uid };
      } else if (canHero) {
        tgt = { hero: true };
      }
      // 否则:突袭随从无合适随从可打且打不了脸 → 跳过,尝试下一个随从
    }
    if (tgt && resolveAttack(st, "a", m.uid, tgt)) return true; // 攻击日志(含伤害)由引擎宣告
  }
  return false;
}
// 英雄攻击:无嘲讽时打脸;有嘲讽时,能击杀或英雄能承受反击才攻击最弱嘲讽。每回合一次。
export function aiHeroAttack(st: GameState): boolean {
  const A = st.a, P = st.p;
  const atk = heroAtkVal(A);
  if (atk <= 0 || A.heroAttacked || A.heroFrozen) return false;
  const taunts = P.board.filter((m) => m.taunt);
  if (taunts.length) {
    const t = [...taunts].sort((a, b) => a.hp - b.hp)[0];
    if (atk >= t.hp || A.hp + (A.armor || 0) > t.atk) {
      if (resolveHeroAttack(st, "a", { uid: t.uid })) return true; // 攻击日志(含伤害)由引擎宣告
    }
    return false;
  }
  if (resolveHeroAttack(st, "a", { hero: true })) return true; // 攻击日志(含伤害)由引擎宣告
  return false;
}
// 门控:仅当手牌存在"需要跨多步铺垫"的 combo 潜力时才开搜索规划器,其余回合走原贪婪链(零回归)。
// 命中条件:① costScale 随从(奥术巨人)在手且当前打不起(连打法术可减费打出);
// ② 有 bounce/shadowstep 回收/复制件,且手里或场上有大体格随从(可被复制放大)。
function shouldPlan(st: GameState): boolean {
  const A = st.a;
  const hasCostScale = A.hand.some((e) => {
    const c = effCard(st, "a", e);
    return c.type === "m" && c.costScale && effCost(st, "a", c, e) > A.mana;
  });
  if (hasCostScale) return true;
  const hasRecycle = A.hand.some((e) => {
    const k = effCard(st, "a", e).sp?.k;
    return k === "bounce" || k === "shadowstep";
  });
  if (hasRecycle) {
    const bigInHand = A.hand.some((e) => { const c = effCard(st, "a", e); return c.type === "m" && c.atk + c.hp >= 10; });
    const bigOnBoard = A.board.some((m) => m.atk + m.hp >= 10);
    if (bigInHand || bigOnBoard) return true;
  }
  return false;
}
// 克隆 state → 跑完整个 AI 回合 → 产出快照数组,UI 层以 750ms 间隔依次回放。
// ⚠️ AI 回合期间不要另行 setGame,会被后续快照覆盖。
export function computeAiTurn(b: GameState): GameState[] {
  const snaps: GameState[] = [];
  let st = clone(b);
  const push = () => snaps.push(clone(st));
  st.fx = []; st.act = null;
  startTurn(st, "a");
  if (!st.winner) log(st, "对手抽了一张牌");
  push();
  if (st.winner) return snaps;
  // 出牌阶段:combo 手牌(门控命中)先跑搜索规划器找最优铺场/combo 线;否则/或非斩杀时走贪婪链。
  let g = 0;
  if (!lethalReachable(st) && shouldPlan(st)) {
    const plan = planPlayPhase(st);
    if (plan) for (const snap of plan) { st = snap; st.fx = []; st.act = null; push(); }
  }
  // 每步前先查综合斩杀(随从+英雄+烧脸),够斩杀就停手铺场转入击杀序列;规划器后用贪婪链补打剩余牌
  while (g++ < 12 && !st.winner) { if (lethalReachable(st)) break; st.fx = []; st.act = null; if (!aiPlay(st)) break; push(); }
  // 综合斩杀:一次性把随从攻击、英雄攻击、烧脸法术串成击杀(替代被割裂的三段式判断)
  if (!st.winner && lethalReachable(st)) forceKill(st, push);
  if (st.winner) return snaps;
  g = 0;
  while (g++ < 12 && !st.winner) { st.fx = []; st.act = null; if (!aiAttack(st)) break; push(); }
  st.fx = []; st.act = null; if (!st.winner && aiHeroAttack(st)) push(); // 英雄武器/变形攻击
  // 攻击后回收 pass:此时已攻击的随从 canAttackNow→false,暗影步回收重打不再浪费攻击(如贪婪的伴侣攻击后回收换硬币)
  g = 0;
  while (g++ < 12 && !st.winner) { st.fx = []; st.act = null; if (!aiPlay(st)) break; push(); }
  if (st.a.stash) { st.fx = []; st.act = null; endTurnCleanup(st, "a"); push(); } // 秘密通道:回合结束换回手牌
  st.fx = []; st.act = null; if (thawFrozen(st, "a")) push(); // 冻结结算:AI 回合结束时解冻己方随从
  return snaps;
}
