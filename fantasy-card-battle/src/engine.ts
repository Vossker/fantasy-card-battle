// ================= 规则引擎(纯函数,不碰 React) =================
// 所有函数签名形如 fn(st, side, ...):直接修改传入的 state 对象 st,side 为 "p"(玩家)或 "a"(AI)
import { CLASS_IDS, COIN, DAGGER, DANCER, HAND_LIMIT, HERO_POWER_COST, buildDeck, byId, shuffle, spTarget } from "./cards";
import type {
  ActMark, AttackTarget, BloomMode, Card, CampOpt, ChooseOpt, ClassId, GameState, HandEntry,
  MinionCard, Side, SideState, SpellDef, SpellTarget,
} from "./types";

// 模块级自增全局变量:HMR 热更新后继续累加,不要假设从 1 开始
let UID = 1, FXID = 1, ENTRY = 1; // ENTRY:登场顺序时钟(每次随从上场 / 洛欧塞布加税生效各取一格)

export const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o));
export const other = (s: Side): Side => (s === "p" ? "a" : "p");

// 可复现随机数:mulberry32 PRNG,状态即 st.rngState(单个 uint32)。
// 引擎所有随机都走这里,初始化时注入种子即可复现整局(含 AI 回合);克隆安全因为只存数字。
export function rand(st: GameState): number {
  let a = (st.rngState + 0x6d2b79f5) | 0;
  st.rngState = a;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const randInt = (st: GameState, n: number): number => Math.floor(rand(st) * n);
export const randPick = <T>(st: GameState, arr: T[]): T => arr[randInt(st, arr.length)];

export function fx(st: GameState, key: string, text: string, color: string) {
  st.fx.push({ id: FXID++, key, text, color, ts: Date.now() });
}
// 记录一次动作(攻击/指向性法术),供 UI 画箭头与攻击前顶动画。每次取新 id。
export function markAct(st: GameState, kind: ActMark["kind"], src: ActMark["src"], tgt: ActMark["tgt"]) {
  st.act = { id: FXID++, kind, src, tgt };
}
export function log(st: GameState, text: string, important = false) {
  st.lastLog = text;
  if (!st.logs) st.logs = [];
  st.logs.push({ id: FXID++, turn: Math.max(1, st.turnNum), text, important: !!important });
  if (st.logs.length > 50) st.logs.shift();
}
export function notice(st: GameState, text: string) {
  st.notice = { text, id: FXID++ };
}
export function dmgHero(st: GameState, side: Side, n: number) {
  const h = st[side];
  let rest = n;
  if (h.armor > 0) {
    const ab = Math.min(h.armor, rest);
    h.armor -= ab;
    rest -= ab;
  }
  if (rest > 0) h.hp -= rest;
  fx(st, side + "-hero", "-" + n, "#ff6060");
  if (h.hp <= 0) { h.hp = 0; st.winner = other(side); }
}
export function dmgMinion(st: GameState, side: Side, uid: number, n: number) {
  const m = st[side].board.find((x) => x.uid === uid);
  if (!m) return;
  m.hp -= n;
  fx(st, "m" + uid, "-" + n, "#ff6060");
  if (m.hp <= 0) st[side].board = st[side].board.filter((x) => x.uid !== uid);
}
// 冻结一个随从(若它已因伤害死亡则跳过)。被冻结者下一个能攻击的回合无法攻击,该回合结束时由 thawFrozen 解冻。
export function freezeMinion(st: GameState, side: Side, uid: number) {
  const m = st[side].board.find((x) => x.uid === uid);
  if (!m || m.frozen) return;
  m.frozen = true;
  fx(st, "m" + uid, "❄️冻结", "#bfe9ff");
}
// 冻结一方英雄:被冻结的英雄下个能攻击的回合无法攻击,该回合结束由 thawFrozen 解冻。
export function freezeHero(st: GameState, side: Side) {
  const s = st[side];
  if (s.heroFrozen) return;
  s.heroFrozen = true;
  fx(st, side + "-hero", "❄️冻结", "#bfe9ff");
}
// 解冻所属一方的随从与英雄:在该方回合结束时调用,使其冻结恰好覆盖一个能攻击的回合。返回是否有任何单位被解冻。
export function thawFrozen(st: GameState, side: Side): boolean {
  let any = false;
  st[side].board.forEach((m) => {
    if (m.frozen) { m.frozen = false; fx(st, "m" + m.uid, "解冻", "#bfe9ff"); any = true; }
  });
  if (st[side].heroFrozen) { st[side].heroFrozen = false; fx(st, side + "-hero", "解冻", "#bfe9ff"); any = true; }
  return any;
}
export function draw(st: GameState, side: Side, n: number) {
  for (let k = 0; k < n; k++) {
    const s = st[side];
    const who = side === "p" ? "你" : "对手";
    if (!s.deck.length) {
      s.fatigue++;
      dmgHero(st, side, s.fatigue);
      log(st, who + `的牌库已空,受到 ${s.fatigue} 点疲劳伤害`, true);
      notice(st, `🃏 ${who}的牌库已空,受到 ${s.fatigue} 点疲劳伤害!`);
      continue;
    }
    const cid = s.deck.pop()!;
    if (s.hand.length >= HAND_LIMIT) {
      log(st, who + `的手牌已满,${side === "p" ? `「${byId[cid].name}」` : "一张牌"}被烧掉了`, true);
      notice(st, `🔥 ${who}的手牌已满,「${byId[cid].name}」被烧掉了!`);
      continue;
    }
    s.hand.push({ uid: UID++, cid });
  }
}
export function startTurn(st: GameState, side: Side) {
  const s = st[side];
  st.p.spellDmg = 0;
  st.a.spellDmg = 0;
  s.spellDiscount = 0; // 伺机待发:仅本回合,本方回合开始时清零
  s.playedThisTurn = 0; // 连击:本回合已出牌数清零
  s.spellTax = s.spellTaxNext; // 洛欧塞布:回合开始时把已挂载的加税转为生效;无挂载则顺带清除上一回合的加税
  s.spellTaxNext = undefined;
  s.heroAtk = 0; // 变形临时攻击力:仅当回合
  s.heroAttacked = false; // 英雄本回合可再次攻击
  s.heroPowerUsed = false; // 英雄技能本回合可再次使用
  s.maxMana = Math.min(10, s.maxMana + 1);
  s.mana = s.maxMana;
  // 登场窗口结束:冲锋/突袭是一次性登场效果,熬过登场回合后清掉(角标随之消失)
  s.board.forEach((m) => { m.sick = false; m.attacked = false; m.charge = false; m.rush = false; });
  draw(st, side, 1);
}
export function playMinion(st: GameState, side: Side, i: number): boolean {
  const s = st[side];
  if (!s) return false;
  const en = s.hand[i];
  if (!en) return false;
  const c = effCard(st, side, en); // 经此解析属性继承型 token(舞者)的快照属性/费用
  if (!c || c.type !== "m" || s.board.length >= 6) return false;
  const cost = effCost(st, side, c, en); // 奥术巨人/暗影步等按折后费用校验与扣费
  if (cost > s.mana) return false;
  s.mana -= cost;
  s.hand.splice(i, 1);
  s.board.push({
    uid: en.uid, cid: c.id, name: c.name, emoji: c.emoji,
    atk: c.atk, hp: c.hp, maxHp: c.hp,
    taunt: !!c.taunt, charge: !!c.charge, rush: !!c.rush, sick: !c.charge, attacked: false, frozen: false, seq: ENTRY++,
  });
  log(st, `${side === "p" ? "你" : "对手"}打出了「${c.name}」`); // 先宣告打出,战吼等效果日志自然排在其后
  if (c.bc) doBattlecry(st, side, c);
  s.playedThisTurn = (s.playedThisTurn || 0) + 1; // 连击:打出随从也计入"使用过的牌"
  moonTutor(st, side, en);
  mapTutor(st, side, en); // 异教地图:本回合打出发现的牌则再抽一张
  return true;
}
// 战吼:仅从手牌打出时触发(从牌库召唤不触发)
function doBattlecry(st: GameState, side: Side, c: MinionCard) {
  const s = st[side];
  if (c.bc?.k === "summonMini") {
    const pool = s.deck.filter((cid) => byId[cid].type === "m");
    if (!pool.length || s.board.length >= 6) return;
    const mc = byId[randPick(st, pool)];
    s.board.push({
      uid: UID++, cid: mc.id, name: mc.name, emoji: mc.emoji,
      atk: 1, hp: 1, maxHp: 1,
      taunt: !!mc.taunt, charge: !!mc.charge, rush: !!mc.rush, sick: !mc.charge, attacked: false, frozen: false, seq: ENTRY++,
    });
    log(st, `「${c.name}」从牌库召唤了「${mc.name}」的 1/1 复制`);
  } else if (c.bc?.k === "greedyCoin") {
    // 贪婪的伴侣:此时本体已离手,手牌中只要还有一张当前 2 费牌(含被减费到 2 的奥术巨人、另一张贪婪的伴侣)即满足
    if (!s.hand.some((e) => effCost(st, side, byId[e.cid], e) === 2)) return;
    if (s.hand.length >= HAND_LIMIT) { log(st, `「${c.name}」:手牌已满,幸运币被烧掉了`, true); return; }
    s.hand.push({ uid: UID++, cid: COIN.id });
    log(st, `「${c.name}」:手牌中有其他 2 费牌,获得一张幸运币`);
  } else if (c.bc?.k === "loatheb") {
    const e = other(side);
    const amt = c.bc.amt ?? 5;
    // 同回合多次加税累加(如连打两张牧师);order 取最新一格登场序,与伊谢尔光环比先后
    st[e].spellTaxNext = { amt: (st[e].spellTaxNext?.amt ?? 0) + amt, order: ENTRY++ };
    log(st, `「${c.name}」:${e === "p" ? "你" : "对手"}下个回合法术费用增加 ${amt} 点`, true);
  }
}
// 月光指引:本回合内打出发现的复制,则从牌库定向抽取本体
// 任何"从手牌打出"的路径结尾都要调用它,新增路径不要漏掉
export function moonTutor(st: GameState, side: Side, en: HandEntry) {
  if (!en || en.moon !== st.turnNum) return;
  const s = st[side];
  const i = s.deck.indexOf(en.cid);
  if (i < 0) return;
  const cid = s.deck.splice(i, 1)[0];
  const who = side === "p" ? "你" : "对手";
  const nm = side === "p" ? `「${byId[cid].name}」` : ""; // 对手的本体牌名不公开
  if (s.hand.length >= HAND_LIMIT) {
    log(st, `「月光指引」:${who}的手牌已满,本体${nm}被烧掉了`, true);
    return;
  }
  s.hand.push({ uid: UID++, cid });
  log(st, `「月光指引」:${who}打出了复制,从牌库抽取了本体${nm}`);
}
// 连击:本回合在打出当前这张牌之前,是否已使用过其他牌(随从或法术都算)
export const combo = (st: GameState, side: Side): boolean => (st[side].playedThisTurn || 0) > 0;

// 异教地图(首次发现):抽取 cid 到手,并把剩余未选选项记在该手牌上(本回合打出它则可再抽一张)
export function mapTake(st: GameState, side: Side, cid: number, left: number[]) {
  const s = st[side];
  const who = side === "p" ? "你" : "对手";
  removeFromDeck(st, side, cid);
  const nm = side === "p" ? `「${byId[cid].name}」` : "一张牌"; // 对手发现的牌名不公开
  if (s.hand.length >= HAND_LIMIT) { log(st, `${who}的手牌已满,${nm}被烧掉了`, true); return; }
  s.hand.push({ uid: UID++, cid, mapTurn: st.turnNum, mapLeft: left });
  log(st, `「异教地图」:${who}发现并抽取了${nm}`);
}
// 异教地图(后续):从剩余选项里把 cid 抽到手
export function mapDrawLeft(st: GameState, side: Side, cid: number) {
  const s = st[side];
  const who = side === "p" ? "你" : "对手";
  removeFromDeck(st, side, cid);
  const nm = side === "p" ? `「${byId[cid].name}」` : "一张牌"; // 对手抽取的牌名不公开
  if (s.hand.length >= HAND_LIMIT) { log(st, `${who}的手牌已满,${nm}被烧掉了`, true); return; }
  s.hand.push({ uid: UID++, cid });
  log(st, `「异教地图」:${who}又抽取了${nm}`);
}
// 异教地图触发:本回合打出"发现得来的牌"时,从剩余选项再抽一张。
// 任何"从手牌打出"的路径都应在 moonTutor 之后调用。玩家走弹窗抉择,AI 自动取费用最高者。
export function mapTutor(st: GameState, side: Side, en: HandEntry) {
  if (!en || en.mapTurn !== st.turnNum || !en.mapLeft) return;
  const s = st[side];
  const opts = en.mapLeft.filter((cid) => s.deck.includes(cid)); // 仍在牌库中的剩余选项
  if (!opts.length) return;
  if (side === "p") {
    // 打出"发现牌"时本身又弹出了抉择窗(探底/夜影花蕾/抉择等):不能直接覆盖该窗,先排队,待其结束再弹 mapPick
    if (st.pending) st.mapFollow = opts;
    else st.pending = { k: "mapPick", opts };
  } else {
    const pick = [...opts].sort((x, y) => byId[y].cost - byId[x].cost)[0];
    mapDrawLeft(st, "a", pick);
  }
}
// 前一个抉择窗(探底等)结束后,把排队的异教地图后续抽取弹成 mapPick;无待办则返回 false
export function resolveMapFollow(st: GameState, side: Side): boolean {
  const opts = (st.mapFollow || []).filter((cid) => st[side].deck.includes(cid));
  delete st.mapFollow;
  if (!opts.length) return false;
  st.pending = { k: "mapPick", opts };
  return true;
}
// 探底:把牌库底部(deck 开头)第 idx 张移到牌库顶(deck 末尾);andDraw 为真则随即抽取该牌
export function dredgePick(st: GameState, side: Side, idx: number, andDraw: boolean) {
  const s = st[side];
  const who = side === "p" ? "你" : "对手";
  if (idx >= 0 && idx < s.deck.length) {
    const [cid] = s.deck.splice(idx, 1);
    s.deck.push(cid);
    log(st, `${who}探底,将${side === "p" ? `「${byId[cid].name}」` : "一张牌"}置于牌库顶`);
  }
  if (andDraw) draw(st, side, 1);
}
export function gainMoonCopy(st: GameState, side: Side, cid: number) {
  const s = st[side];
  if (s.hand.length >= HAND_LIMIT) {
    log(st, `${side === "p" ? "你" : "对手"}的手牌已满,${side === "p" ? `「${byId[cid].name}」` : "一张牌"}的复制被烧掉了`, true);
    return;
  }
  s.hand.push({ uid: UID++, cid, moon: st.turnNum });
}
export function sampleDeckAny(st: GameState, side: Side): number[] {
  const cids = [...new Set(st[side].deck)];
  shuffle(cids, () => rand(st));
  return cids.slice(0, 3);
}

// 费用计算(显示与结算的单一来源):
//   法术 — 伊谢尔光环(费用一律变为 1)优先级高于伺机待发减费:光环在场时直接固定为 1(含 0 费牌),不再叠加减费;
//          无光环时按伺机待发减费,下限 0;
//   随从 — costScale 随从(奥术巨人)按本方已打出法术数减费,下限 0。
export const effCost = (st: GameState, side: Side, c: { type: "m" | "s" | "w"; cost: number; costScale?: "spellsPlayed" }, en?: HandEntry): number => {
  const s = st[side];
  if (c.type === "s") {
    // 伊谢尔光环(变 1)与洛欧塞布加税(+amt)可能同时存在,按入场先后裁决:后入场覆盖先入场。
    const auraM = s.board.find((m) => byId[m.cid]?.aura === "cheapSpells");
    const tax = s.spellTax;
    const auraWins = auraM && (!tax || auraM.seq > tax.order); // 光环更晚登场 → 固定为 1
    if (auraWins) return 1;
    const base = Math.max(0, c.cost - (s.spellDiscount || 0));
    return base + (tax ? tax.amt : 0); // 无光环或加税更晚:基础减费后叠加税额(0 费牌也会被加税)
  }
  const red = en?.costred || 0; // 暗影步:随从费用减免(仅手牌生效)
  if (c.costScale === "spellsPlayed") return Math.max(0, c.cost - (s.spellsPlayed || 0) - red);
  return Math.max(0, c.cost - red);
};

// 殒命暗影:在手牌中即显示/结算为本方上一张打出的法术。无可复制法术时返回原牌(此时不可打出)。
// 任何"读取手牌卡牌"的展示/出牌路径都应经此解析,以同时支持普通牌与变身牌。
export function effCard(st: GameState, side: Side, en: HandEntry): Card {
  const c = byId[en.cid];
  if (c.sp?.k === "shadow") {
    const last = st[side].lastSpell;
    if (last != null && byId[last]) return byId[last];
  }
  // 属性继承型 token(舞者)被弹回手牌:用快照覆盖占位的卡面属性,费用按 round((atk+hp)/2) 计
  if (c.type === "m" && c.inheritStats && en.atk != null && en.hp != null) {
    return { ...c, atk: en.atk, hp: en.hp, cost: Math.round((en.atk + en.hp) / 2) };
  }
  return c;
}

// 一张法术"从手牌打出"后统一登记:累计计数(奥术巨人)、记录上一张法术(殒命暗影)、
// 消耗伺机待发减费(伺机待发自身除外,其效果会重新累加减费)。cid 须为实际生效的法术(变身后取被复制者)。
// 注意:夜影花蕾等从牌库自动施放(castDeckSpell)不经此函数,故不计入。
export function afterSpellPlayed(st: GameState, side: Side, cid: number) {
  const s = st[side];
  s.spellsPlayed = (s.spellsPlayed || 0) + 1;
  s.playedThisTurn = (s.playedThisTurn || 0) + 1; // 连击:法术计入本回合"使用过的牌"
  s.lastSpell = cid;
  if (byId[cid]?.sp?.k !== "ready") s.spellDiscount = 0;
}

// 街舞起跳:将指定友方随从移回手牌(恢复原始卡),并召唤一个继承其当前攻/血的舞者
function doBounce(st: GameState, side: Side, uid: number) {
  const s = st[side];
  const idx = s.board.findIndex((m) => m.uid === uid);
  if (idx < 0) return;
  const m = s.board[idx];
  const atk = m.atk, hp = m.hp, cid = m.cid;
  const who = side === "p" ? "你" : "对手";
  s.board.splice(idx, 1);
  if (s.hand.length < HAND_LIMIT) {
    // 属性继承型 token(舞者)卡面属性仅占位,须随快照带回当前攻/血,否则再次打出会变 0/0
    const bc = byId[cid];
    const back: HandEntry = bc.type === "m" && bc.inheritStats ? { uid: UID++, cid, atk, hp } : { uid: UID++, cid };
    s.hand.push(back);
  } else log(st, `${who}的手牌已满,「${byId[cid].name}」无法回到手牌`, true);
  if (s.board.length < 6) {
    s.board.push({
      uid: UID++, cid: DANCER.id, name: DANCER.name, emoji: DANCER.emoji,
      atk, hp, maxHp: hp, taunt: false, charge: false, rush: true, sick: true, attacked: false, frozen: false, seq: ENTRY++,
    });
  }
  log(st, `「街舞起跳」:${byId[cid].name}回到${who === "你" ? "你的" : "对手的"}手牌,召唤了 ${atk}/${hp} 的舞者`);
}

// 暗影步:将指定友方随从移回手牌(还原为原始卡牌、丢失场上增益),该手牌费用 -2(不叠加,打出后失效)
function doShadowstep(st: GameState, side: Side, uid: number) {
  const s = st[side];
  const idx = s.board.findIndex((m) => m.uid === uid);
  if (idx < 0) return;
  const cid = s.board[idx].cid;
  const who = side === "p" ? "你" : "对手";
  s.board.splice(idx, 1);
  if (s.hand.length < HAND_LIMIT) s.hand.push({ uid: UID++, cid, costred: 2 });
  else log(st, `${who}的手牌已满,「${byId[cid].name}」无法回到手牌`, true);
  log(st, `「暗影步」:「${byId[cid].name}」回到${who === "你" ? "你的" : "对手的"}手牌,费用减少 2 点`);
}

// 秘密通道:把当前手牌暂存,换成牌库随机至多 4 张(本牌须已离手再调用)。
// 借来的牌打 borrowed 标记,以便回合结束只洗回它们,而不波及本回合抽到的其他牌。
function swapHandFromDeck(st: GameState, side: Side) {
  const s = st[side];
  s.stash = s.hand;
  s.hand = [];
  const n = Math.min(4, s.deck.length);
  for (let k = 0; k < n; k++) s.hand.push({ uid: UID++, cid: s.deck.pop()!, borrowed: 1 });
  fx(st, side + "-hero", "🚪", "#c478f0");
}

// 回合结束清理:伺机待发减费此处不动(在 startTurn 清);秘密通道在此结算换回:
// 仅把"未打出的借牌(borrowed)"洗回牌库,本回合抽到的牌保留并与取回的原手牌合并(超出手牌上限则烧掉)。
export function endTurnCleanup(st: GameState, side: Side) {
  const s = st[side];
  if (!s.stash) return;
  const kept: HandEntry[] = [];
  s.hand.forEach((e) => (e.borrowed ? s.deck.push(e.cid) : kept.push(e)));
  shuffle(s.deck, () => rand(st));
  s.hand = [...s.stash, ...kept];
  s.stash = undefined;
  const who = side === "p" ? "你" : "对手";
  while (s.hand.length > HAND_LIMIT) {
    const burned = s.hand.pop()!;
    log(st, `${who}的手牌已满,「${byId[burned.cid].name}」被烧掉了`, true);
  }
}
export function removeFromDeck(st: GameState, side: Side, cid: number) {
  const i = st[side].deck.indexOf(cid);
  if (i >= 0) st[side].deck.splice(i, 1);
}
export function sampleDeck(st: GameState, side: Side, type: "m" | "s"): number[] {
  const idxs: number[] = [];
  st[side].deck.forEach((cid, i) => {
    const c = byId[cid];
    if (c.type === type) idxs.push(i);
  });
  shuffle(idxs, () => rand(st));
  return idxs.slice(0, 3).map((i) => st[side].deck[i]);
}
// 注意:名字有误导,它不从牌库移除,只是按 cid 把随从放上场(需要移除时调用方自己 removeFromDeck)
export function summonFromDeck(st: GameState, side: Side, cid: number): boolean {
  const c = byId[cid];
  if (!c || c.type !== "m" || st[side].board.length >= 6) return false;
  st[side].board.push({
    uid: UID++, cid: c.id, name: c.name, emoji: c.emoji,
    atk: c.atk, hp: c.hp, maxHp: c.hp,
    taunt: !!c.taunt, charge: !!c.charge, rush: !!c.rush, sick: !c.charge, attacked: false, frozen: false, seq: ENTRY++,
  });
  return true;
}
// 伤害法术的附加效果:抽牌、护甲、召唤衍生物(castSpell 与 castDeckSpell 共用)
function dmgExtras(st: GameState, side: Side, sp: { draw?: number; armor?: number; summon?: number }) {
  if (sp.draw) draw(st, side, sp.draw);
  if (sp.armor) {
    const s = st[side];
    s.armor = (s.armor || 0) + sp.armor;
    fx(st, side + "-hero", `+${sp.armor}🛡`, "#bfd3e6");
  }
  if (sp.summon && summonFromDeck(st, side, sp.summon)) {
    const t = byId[sp.summon];
    log(st, `${side === "p" ? "你" : "对手"}召唤了一个 ${t.atk}/${t.hp} 的「${t.name}」`);
  }
}
// ================= 效果注册表(替代 sp.k 的多处 switch 分发) =================
// 每种法术效果集中定义三件事:
//   summary  — 卡面角标简述(显示层);
//   cast     — 从手牌打出(有明确目标,玩家与 AI 共用);交互类法术(choose/camp/bloom/moonlight)
//              省略此项,从手牌打出时由 UI 的 pending 流程接管;
//   autoCast — 从牌库自动施放(夜影花蕾翻出时),目标自动选择、抉择随机结算。
// EffectRegistry 是受 mapped type 约束的完整映射:给 SpellDef 新增一个 k 却忘了在此登记,直接编译报错。
type EffectHandler<S extends SpellDef> = {
  summary: (sp: S, bonus: number) => string;
  cast?: (st: GameState, side: Side, sp: S, tgt: SpellTarget | null, bonus: number) => void;
  autoCast: (st: GameState, side: Side, sp: S, bonus: number, name: string) => void;
};
type EffectRegistry = { [K in SpellDef["k"]]: EffectHandler<Extract<SpellDef, { k: K }>> };

const EFFECTS: EffectRegistry = {
  dmg: {
    summary: (sp, bonus) => `${bonus > 0 ? `伤害* ${sp.n + bonus} *` : `伤害 ${sp.n}`}${sp.freeze ? " ❄️" : ""}`,
    cast: (st, side, sp, tgt, bonus) => {
      const t = tgt!; // isValidSpellTarget 已保证非空
      const n = sp.n + bonus;
      if (t.hero) { dmgHero(st, t.side, n); if (sp.freeze) freezeHero(st, t.side); }
      else { dmgMinion(st, t.side, t.uid!, n); if (sp.freeze) freezeMinion(st, t.side, t.uid!); }
      dmgExtras(st, side, sp);
      if (sp.comboDraw && combo(st, side)) draw(st, side, 1); // 鬼魅攻击:连击则抽一张
    },
    autoCast: (st, side, sp, bonus) => {
      const e = other(side);
      const n = sp.n + bonus;
      const tgts: AttackTarget[] = st[e].board.map((m) => ({ uid: m.uid }));
      tgts.push({ hero: true });
      const t = randPick(st, tgts);
      if (t.hero) { dmgHero(st, e, n); if (sp.freeze) freezeHero(st, e); }
      else { dmgMinion(st, e, t.uid!, n); if (sp.freeze) freezeMinion(st, e, t.uid!); }
      dmgExtras(st, side, sp);
      if (sp.comboDraw && combo(st, side)) draw(st, side, 1);
    },
  },
  aoe: {
    summary: (sp, bonus) => (bonus > 0 ? `全体* ${sp.n + bonus} *` : `全体 ${sp.n}`),
    cast: (st, side, sp, _tgt, bonus) => {
      const e = other(side);
      st[e].board.map((m) => m.uid).forEach((u) => dmgMinion(st, e, u, sp.n + bonus));
    },
    autoCast: (st, side, sp, bonus) => {
      const e = other(side);
      st[e].board.map((m) => m.uid).forEach((u) => dmgMinion(st, e, u, sp.n + bonus));
    },
  },
  heal: {
    summary: (sp) => `治疗 ${sp.n}`,
    cast: (st, _side, sp, tgt) => {
      const t = tgt!;
      if (t.hero) {
        const h = st[t.side];
        h.hp = Math.min(30, h.hp + sp.n);
        fx(st, t.side + "-hero", "+" + sp.n, "#5ef08a");
      } else {
        const m = st[t.side].board.find((x) => x.uid === t.uid);
        if (m) { m.hp = Math.min(m.maxHp, m.hp + sp.n); fx(st, "m" + m.uid, "+" + sp.n, "#5ef08a"); }
      }
    },
    autoCast: (st, side, sp) => {
      const h = st[side];
      h.hp = Math.min(30, h.hp + sp.n);
      fx(st, side + "-hero", "+" + sp.n, "#5ef08a");
    },
  },
  buff: {
    summary: (sp) => `+${sp.a}/+${sp.h}`,
    cast: (st, _side, sp, tgt) => {
      const t = tgt!;
      const m = st[t.side].board.find((x) => x.uid === t.uid);
      if (m) { m.atk += sp.a; m.hp += sp.h; m.maxHp += sp.h; fx(st, "m" + m.uid, `+${sp.a}/+${sp.h}`, "#ffd700"); }
    },
    autoCast: (st, side, sp) => {
      const board = st[side].board;
      if (board.length) {
        const m = [...board].sort((a, b) => b.atk + b.hp - (a.atk + a.hp))[0];
        m.atk += sp.a; m.hp += sp.h; m.maxHp += sp.h;
        fx(st, "m" + m.uid, `+${sp.a}/+${sp.h}`, "#ffd700");
      }
    },
  },
  draw: {
    summary: (sp) => `抽 ${sp.n} 张`,
    cast: (st, side, sp) => draw(st, side, sp.n),
    autoCast: (st, side, sp) => draw(st, side, sp.n),
  },
  coin: {
    summary: () => "+1 法力",
    cast: (st, side) => {
      const s = st[side];
      s.mana = Math.min(10, s.mana + 1);
      fx(st, side + "-hero", "+1💎", "#7cc4ff");
    },
    autoCast: (st, side) => {
      const s = st[side];
      s.mana = Math.min(10, s.mana + 1);
      fx(st, side + "-hero", "+1💎", "#7cc4ff");
    },
  },
  bio: {
    summary: () => "双方+2水晶",
    cast: (st, side) => { gainMana(st, side, 2); gainMana(st, other(side), 2); },
    autoCast: (st, side) => { gainMana(st, side, 2); gainMana(st, other(side), 2); },
  },
  obelisk: {
    summary: () => "法伤+1",
    cast: (st, side, _sp, _tgt, bonus) => { st[side].spellDmg = bonus + 1; fx(st, side + "-hero", "法伤+1", "#c478f0"); },
    autoCast: (st, side, _sp, bonus) => { st[side].spellDmg = bonus + 1; fx(st, side + "-hero", "法伤+1", "#c478f0"); },
  },
  // 以下为交互类:从手牌打出时由 UI pending 接管,故无 cast;仅在被夜影花蕾从牌库翻出时随机结算(autoCast)。
  choose: {
    summary: () => "抉择",
    autoCast: (st, side, sp, _bonus, name) => {
      const o = randPick(st, sp.opts);
      applyOpt(st, side, o);
      log(st, `「${name}」(随机)抉择了${o.label}`);
    },
  },
  camp: {
    summary: () => "抉择×3",
    autoCast: (st, side, _sp, _bonus, name) => {
      const picked: string[] = [];
      for (let k = 0; k < 3; k++) {
        const o = randPick(st, ["mana", "draw", "armor"] as const);
        campEffect(st, side, o);
        picked.push(campLabel(o));
      }
      log(st, `「${name}」(随机)抉择了:${picked.join("、")}`);
    },
  },
  bloom: {
    summary: () => "抉择",
    autoCast: (st, side, _sp, _bonus, name) => {
      const mOk = st[side].board.length < 6 && st[side].deck.some((x) => byId[x].type === "m");
      const sOk = st[side].deck.some((x) => byId[x].type === "s");
      const modes: BloomMode[] = [];
      if (mOk) modes.push("m");
      if (sOk) modes.push("s");
      if (!modes.length) return;
      const mode = randPick(st, modes);
      const picks = sampleDeck(st, side, mode);
      const pick = randPick(st, picks);
      removeFromDeck(st, side, pick);
      if (mode === "m") {
        log(st, `「${name}」(随机)从牌库召唤了「${byId[pick].name}」`);
        summonFromDeck(st, side, pick);
      } else {
        log(st, side === "p" ? `「${name}」(随机)从牌库施放了「${byId[pick].name}」` : `「${name}」(随机)从牌库施放了一张法术`);
        castDeckSpell(st, side, pick);
      }
    },
  },
  moonlight: {
    summary: () => "发现",
    autoCast: (st, side, _sp, _bonus, name) => {
      const opts = sampleDeckAny(st, side);
      if (opts.length) {
        const pick = randPick(st, opts);
        gainMoonCopy(st, side, pick);
        log(st, `「${name}」(随机)发现了「${byId[pick].name}」的复制`);
      }
    },
  },
  ready: {
    summary: () => "省 2 费",
    cast: (st, side) => { st[side].spellDiscount = (st[side].spellDiscount || 0) + 2; fx(st, side + "-hero", "下张-2费", "#7cc4ff"); },
    autoCast: (st, side) => { st[side].spellDiscount = (st[side].spellDiscount || 0) + 2; fx(st, side + "-hero", "下张-2费", "#7cc4ff"); },
  },
  passage: {
    summary: () => "换 4 张",
    cast: (st, side) => { swapHandFromDeck(st, side); log(st, `${side === "p" ? "你" : "对手"}的手牌被替换为牌库中随机 ${st[side].hand.length} 张牌,回合结束时换回`); },
    autoCast: (st, side) => { swapHandFromDeck(st, side); log(st, `${side === "p" ? "你" : "对手"}的手牌被替换为牌库中随机 ${st[side].hand.length} 张牌,回合结束时换回`); },
  },
  shuffleDraw: {
    summary: (sp) => `洗 ${sp.back} 抽 ${sp.draw}`,
    cast: (st, side, sp) => {
      const s = st[side];
      const back = s.hand.splice(0, sp.back).map((e) => e.cid);
      back.forEach((cid) => s.deck.push(cid));
      shuffle(s.deck, () => rand(st));
      draw(st, side, sp.draw);
    },
    autoCast: (st, side, sp) => {
      const s = st[side];
      const back = s.hand.splice(0, sp.back).map((e) => e.cid);
      back.forEach((cid) => s.deck.push(cid));
      shuffle(s.deck, () => rand(st));
      draw(st, side, sp.draw);
    },
  },
  bounce: {
    summary: () => "复制随从",
    cast: (st, side, _sp, tgt) => { if (tgt?.uid != null) doBounce(st, side, tgt.uid); },
    autoCast: (st, side) => {
      const board = st[side].board;
      if (!board.length) return;
      const m = [...board].sort((a, b) => b.atk + b.hp - (a.atk + a.hp))[0];
      doBounce(st, side, m.uid);
    },
  },
  shadow: {
    summary: () => "复制法术",
    // 从手牌打出时由 castSpell 先解析成"上一张法术"再分发,不会走到此处的 cast;
    // 仅当被夜影花蕾从牌库翻出时,以牌库施放方式结算上一张法术。
    autoCast: (st, side, _sp, _bonus, name) => {
      const last = st[side].lastSpell;
      if (last == null) return;
      log(st, `「${name}」复制并施放了「${byId[last].name}」`);
      castDeckSpell(st, side, last);
    },
  },
  spelldraw: {
    summary: () => "抽法术",
    cast: (st, side) => drawSpell(st, side),
    autoCast: (st, side) => drawSpell(st, side),
  },
  shadowstep: {
    summary: () => "随从回手 -2",
    cast: (st, side, _sp, tgt) => { if (tgt?.uid != null) doShadowstep(st, side, tgt.uid); },
    autoCast: (st, side) => {
      const board = st[side].board;
      if (!board.length) return;
      const m = [...board].sort((a, b) => b.atk + b.hp - (a.atk + a.hp))[0]; // 自动取最强随从回手
      doShadowstep(st, side, m.uid);
    },
  },
  dredge: {
    summary: (sp) => (sp.comboDraw ? "探底·连击抽" : "探底"),
    // 从手牌打出走 UI 的探底弹窗;autoCast(夜影花蕾翻出)自动把底部费用最高的牌置顶,连击则抽取
    autoCast: (st, side, sp) => {
      const n = Math.min(3, st[side].deck.length);
      const andDraw = !!sp.comboDraw && combo(st, side);
      if (!n) { if (andDraw) draw(st, side, 1); return; }
      let best = 0;
      for (let k = 1; k < n; k++) if (byId[st[side].deck[k]].cost > byId[st[side].deck[best]].cost) best = k;
      dredgePick(st, side, best, andDraw);
    },
  },
  map: {
    summary: () => "发现抽牌",
    // 从手牌打出走 UI 的发现弹窗;autoCast(夜影花蕾翻出)自动发现费用最高者抽取(仍挂后续触发)
    autoCast: (st, side) => {
      const opts = sampleDeckAny(st, side);
      if (!opts.length) return;
      const pick = [...opts].sort((x, y) => byId[y].cost - byId[x].cost)[0];
      mapTake(st, side, pick, opts.filter((c) => c !== pick));
    },
  },
};

// 暗影之门:从牌库随机抽一张法术牌到手(牌库无法术则不触发、无疲劳)
function drawSpell(st: GameState, side: Side) {
  const s = st[side];
  const who = side === "p" ? "你" : "对手";
  const spells = s.deck.filter((cid) => byId[cid].type === "s");
  if (!spells.length) { log(st, `${who}的牌库中没有法术牌`); return; }
  const pick = randPick(st, spells);
  removeFromDeck(st, side, pick);
  if (s.hand.length >= HAND_LIMIT) { log(st, `${who}的手牌已满,${side === "p" ? `「${byId[pick].name}」` : "一张牌"}被烧掉了`, true); return; }
  s.hand.push({ uid: UID++, cid: pick });
  log(st, side === "p" ? `你从牌库抽到了法术牌「${byId[pick].name}」` : "对手从牌库抽到了一张法术牌");
}

// 按 k 动态取处理器:TS 无法表达"索引出的 handler 与传入的 sp 同 k",在此做一次本地断言收口。
type AnyEffect = {
  summary: (sp: SpellDef, bonus: number) => string;
  cast?: (st: GameState, side: Side, sp: SpellDef, tgt: SpellTarget | null, bonus: number) => void;
  autoCast: (st: GameState, side: Side, sp: SpellDef, bonus: number, name: string) => void;
};
const effectFor = (k: SpellDef["k"]): AnyEffect => EFFECTS[k] as unknown as AnyEffect;

// 卡面法术简述(显示层单一来源)。法伤加成生效时由各效果的 summary 自行渲染为 * n * 形式。
export const spSummary = (sp?: SpellDef, bonus = 0): string => (sp ? effectFor(sp.k).summary(sp, bonus) : "法术");

// 从牌库直接施放:目标自动选择,抉择类随机结算(委派注册表的 autoCast)
export function castDeckSpell(st: GameState, side: Side, cid: number) {
  const c = byId[cid];
  if (!c || !c.sp) return;
  effectFor(c.sp.k).autoCast(st, side, c.sp, st[side].spellDmg || 0, c.name);
}
export function gainMana(st: GameState, side: Side, n: number, empty = false) {
  const s = st[side];
  s.maxMana = Math.min(10, s.maxMana + n);
  if (!empty) s.mana = Math.min(10, s.mana + n);
  fx(st, side + "-hero", `+${n}${empty ? "💠" : "💎"}`, "#7cc4ff");
}
export function applyOpt(st: GameState, side: Side, o: ChooseOpt) {
  if (o.fx === "draw") draw(st, side, o.n);
  else if (o.fx === "manaEmpty") gainMana(st, side, o.n, true);
  else if (o.fx === "manaFull") gainMana(st, side, o.n);
}
export const campLabel = (o: CampOpt) => (o === "mana" ? "回复 3 个法力水晶" : o === "draw" ? "抽两张牌" : "获得 5 点护甲");
export function campEffect(st: GameState, side: Side, opt: CampOpt) {
  const s = st[side];
  if (opt === "mana") s.mana = Math.min(s.maxMana, s.mana + 3);
  else if (opt === "draw") draw(st, side, 2);
  else if (opt === "armor") { s.armor = (s.armor || 0) + 5; fx(st, side + "-hero", "+5🛡", "#bfd3e6"); }
}

export function isValidSpellTarget(st: GameState, side: Side, sp: SpellDef | undefined, tgt: SpellTarget | null): boolean {
  if (!sp) return false;
  const caster = st[side];
  if (!caster) return false;
  // 数据驱动:目标类型直接读卡面 sp.t。无目标法术(无 t 字段)统一走 !tgt,
  // 新增无目标法术不再需要修改本函数(此前要往硬编码白名单里加一行)。
  const t = spTarget(sp);
  if (!t) return !tgt;
  if (!tgt) return false;
  if (t === "fm") return tgt.side === side && !!tgt.uid && !!caster.board.find((m) => m.uid === tgt.uid);
  // t === "any":任意角色
  const targetSide = st[tgt.side];
  if (!targetSide) return false;
  if (tgt.hero) return true;
  return !!tgt.uid && !!targetSide.board.find((m) => m.uid === tgt.uid);
}

// 法术日志的目标名:英雄按视角译成「敌方英雄/你的英雄/自身英雄」,随从取卡名
function tgtName(st: GameState, side: Side, tgt: SpellTarget | null): string {
  if (!tgt) return "";
  if (tgt.hero) return tgt.side === side ? "自身英雄" : side === "p" ? "敌方英雄" : "你的英雄";
  const m = st[tgt.side].board.find((x) => x.uid === tgt.uid);
  return m ? `「${m.name}」` : "目标";
}
// 法术宣告日志的伤害/目标后缀(只显示造成的伤害)。须在效果结算前调用,目标随从尚未死亡。
function spellDetail(st: GameState, side: Side, sp: SpellDef, tgt: SpellTarget | null): string {
  const bonus = st[side].spellDmg || 0;
  if (sp.k === "dmg") return `,对${tgtName(st, side, tgt)}造成 ${sp.n + bonus} 点伤害`;
  if (sp.k === "aoe") return `,对所有敌方随从造成 ${sp.n + bonus} 点伤害`;
  if (sp.k === "heal") return `,为${tgtName(st, side, tgt)}恢复 ${sp.n} 点生命`;
  if (sp.k === "buff") return `,使${tgtName(st, side, tgt)}获得 +${sp.a}/+${sp.h}`;
  return "";
}
export function castSpell(st: GameState, side: Side, i: number, tgt: SpellTarget | null): boolean {
  const s = st[side];
  if (!s) return false;
  const en = s.hand[i];
  if (!en) return false;
  // 殒命暗影:打出时解析为上一张法术;无可复制法术(仍为 shadow)时不可打出
  const c = effCard(st, side, en);
  if (!c || c.type !== "s" || c.sp.k === "shadow") return false;
  const sp = c.sp; // c 已收窄为 SpellCard,sp 为 SpellDef(非 undefined)
  const handler = effectFor(sp.k);
  if (!handler.cast) return false; // 交互类法术(choose/camp/bloom/moonlight)不从此路径打出,由 UI 的 pending 接管
  const cost = effCost(st, side, c); // 费用按实际生效的法术(殒命暗影沿用被复制者的费用)
  if (cost > s.mana || !isValidSpellTarget(st, side, sp, tgt)) return false;
  s.mana -= cost;
  s.hand.splice(i, 1);
  // 指向性法术:记录从施法者英雄指向目标的箭头(治疗绿、增益金、其余红)
  if (tgt) {
    const kind: ActMark["kind"] = sp.k === "heal" ? "heal" : sp.k === "buff" || sp.k === "bounce" || sp.k === "shadowstep" ? "buff" : "dmg";
    markAct(st, kind, { side, hero: true }, { side: tgt.side, uid: tgt.uid, hero: tgt.hero });
  }
  log(st, `${side === "p" ? "你" : "对手"}施放了「${c.name}」${spellDetail(st, side, sp, tgt)}`); // 先宣告施放,效果内部日志(抽牌/换手等)排在其后
  handler.cast(st, side, sp, tgt, s.spellDmg || 0);
  afterSpellPlayed(st, side, c.id);
  moonTutor(st, side, en);
  mapTutor(st, side, en); // 异教地图:本回合打出发现的牌则再抽一张
  return true;
}
export function resolveAttack(st: GameState, side: Side, auid: number, tgt: AttackTarget | null): boolean {
  if (!tgt) return false;
  const attacker = st[side];
  const e = other(side);
  const defender = st[e];
  if (!attacker || !defender) return false;
  const A = attacker.board.find((m) => m.uid === auid);
  if (!A || A.attacked || A.atk <= 0 || A.frozen) return false; // 冻结的随从无法攻击
  // 召唤失调:不能攻击。突袭随从是例外——在 sick 期间可攻击敌方随从,但仍不能攻击英雄
  if (A.sick && !(A.rush && !tgt.hero)) return false;
  const taunts = defender.board.filter((m) => m.taunt);
  if (tgt.hero) {
    if (taunts.length) return false;
    A.attacked = true;
    A.charge = false; A.rush = false; // 登场攻击后清掉一次性登场效果(角标随之消失)
    markAct(st, "attack", { side, uid: auid }, { side: e, hero: true });
    dmgHero(st, e, A.atk);
    log(st, `${side === "p" ? "你的" : "对手的"}「${A.name}」攻击${side === "p" ? "敌方英雄" : "你的英雄"},造成 ${A.atk} 点伤害`);
    return true;
  }
  const D = defender.board.find((m) => m.uid === tgt.uid);
  if (!D || (taunts.length && !D.taunt)) return false;
  A.attacked = true;
  A.charge = false; A.rush = false; // 登场攻击后清掉一次性登场效果(角标随之消失)
  markAct(st, "attack", { side, uid: auid }, { side: e, uid: D.uid });
  const dAtk = D.atk;
  const aAtk = A.atk, aName = A.name, dName = D.name; // 先捕获名字与攻击力(随从可能因伤害死亡)
  dmgMinion(st, e, D.uid, A.atk);
  dmgMinion(st, side, A.uid, dAtk);
  log(st, `${side === "p" ? "你的" : "对手的"}「${aName}」攻击「${dName}」,造成 ${aAtk} 点伤害`);
  return true;
}

// ================= 武器 / 英雄攻击 / 英雄技能 =================
// 英雄当前总攻击力 = 武器攻击 + 临时攻击力加成(变形)
export const heroAtkVal = (s: SideState): number => (s.weapon?.atk || 0) + (s.heroAtk || 0);

// 装备武器:替换并销毁当前武器(剩余耐久作废)
export function equipWeapon(st: GameState, side: Side, cid: number) {
  const c = byId[cid];
  if (!c || c.type !== "w") return;
  st[side].weapon = { cid: c.id, atk: c.atk, dur: c.dur };
  fx(st, side + "-hero", `🗡️${c.atk}/${c.dur}`, "#e0c080");
}

// 英雄发起一次攻击后消耗 1 点武器耐久,耐久归 0 则销毁(无武器时——纯变形攻击力——不消耗任何东西)
function consumeWeaponDur(st: GameState, side: Side) {
  const w = st[side].weapon;
  if (!w) return;
  w.dur -= 1;
  if (w.dur <= 0) {
    st[side].weapon = null;
    fx(st, side + "-hero", "💥武器损毁", "#ff9a5c");
  }
}

// 英雄攻击:攻击随从时承受随从攻击力的反击伤害(先扣护甲);攻击英雄无反击。每回合一次,消耗 1 点耐久。
export function resolveHeroAttack(st: GameState, side: Side, tgt: AttackTarget | null): boolean {
  if (!tgt) return false;
  const s = st[side];
  const e = other(side);
  const defender = st[e];
  if (!s || !defender) return false;
  const atk = heroAtkVal(s);
  if (atk <= 0 || s.heroAttacked || s.heroFrozen) return false;
  const taunts = defender.board.filter((m) => m.taunt);
  if (tgt.hero) {
    if (taunts.length) return false;
    s.heroAttacked = true;
    markAct(st, "attack", { side, hero: true }, { side: e, hero: true });
    dmgHero(st, e, atk);
    consumeWeaponDur(st, side);
    log(st, `${side === "p" ? "你的" : "对手的"}英雄攻击${side === "p" ? "敌方英雄" : "你的英雄"},造成 ${atk} 点伤害`);
    return true;
  }
  const D = defender.board.find((m) => m.uid === tgt.uid);
  if (!D || (taunts.length && !D.taunt)) return false;
  s.heroAttacked = true;
  markAct(st, "attack", { side, hero: true }, { side: e, uid: D.uid });
  const dAtk = D.atk;
  const dName = D.name; // 先捕获名字(随从可能因伤害死亡)
  dmgMinion(st, e, D.uid, atk);
  if (dAtk > 0) dmgHero(st, side, dAtk); // 反击伤害
  consumeWeaponDur(st, side);
  log(st, `${side === "p" ? "你的" : "对手的"}英雄攻击「${dName}」,造成 ${atk} 点伤害`);
  return true;
}

// 从手牌打出武器牌:支付费用、装备。武器走通用"打出"路径(计连击、月光指引/异教地图触发)。
export function playWeapon(st: GameState, side: Side, i: number): boolean {
  const s = st[side];
  if (!s) return false;
  const en = s.hand[i];
  if (!en) return false;
  const c = byId[en.cid];
  if (!c || c.type !== "w") return false;
  const cost = effCost(st, side, c, en);
  if (cost > s.mana) return false;
  s.mana -= cost;
  s.hand.splice(i, 1);
  equipWeapon(st, side, c.id);
  log(st, `${side === "p" ? "你" : "对手"}装备了「${c.name}」`);
  s.playedThisTurn = (s.playedThisTurn || 0) + 1;
  moonTutor(st, side, en);
  mapTutor(st, side, en);
  return true;
}

// 英雄技能:每回合限用一次,消耗 HERO_POWER_COST。德鲁伊「变形」/潜行者「暗影匕首」。
export function useHeroPower(st: GameState, side: Side): boolean {
  const s = st[side];
  if (!s || s.heroPowerUsed || s.mana < HERO_POWER_COST) return false;
  s.mana -= HERO_POWER_COST;
  s.heroPowerUsed = true;
  if (s.classId === "rogue") {
    equipWeapon(st, side, DAGGER.id);
    log(st, `${side === "p" ? "你" : "对手"}使用「暗影匕首」装备了匕首`);
  } else {
    // 德鲁伊变形:+1 护甲,+1 攻击力(仅当回合)
    s.armor = (s.armor || 0) + 1;
    s.heroAtk = (s.heroAtk || 0) + 1;
    fx(st, side + "-hero", "+1🛡 +1⚔", "#bfd3e6");
    log(st, `${side === "p" ? "你" : "对手"}使用「变形」,获得 1 点护甲和 1 点攻击力`);
  }
  return true;
}

// seed 缺省取系统熵;测试传入固定 seed 即可复现整局。
export function initGame(playerDeck: number[] | null = null, playerClass?: ClassId, seed: number = (Date.now() ^ (Math.random() * 0x100000000)) | 0, aiDeck: number[] | null = null, aiClass?: ClassId, mulligan = false): GameState {
  const st: GameState = {
    phase: "play", turn: "p", first: "p", turnNum: 0, winner: null, rngState: seed | 0, fx: [], logs: [], notice: null, pending: null,
    lastLog: "", banner: null, act: null,
    p: { hp: 30, armor: 0, mana: 0, maxMana: 0, fatigue: 0, spellDmg: 0, weapon: null, heroAtk: 0, deck: [], hand: [], board: [] },
    a: { hp: 30, armor: 0, mana: 0, maxMana: 0, fatigue: 0, spellDmg: 0, weapon: null, heroAtk: 0, deck: [], hand: [], board: [] },
  };
  const rng = () => rand(st);
  const first: Side = rand(st) < 0.5 ? "p" : "a";
  const second = other(first);
  st.turn = first;
  st.first = first;
  st.turnNum = first === "p" ? 1 : 0;
  st.banner = { text: first === "p" ? "你是先手!" : "对手先手", id: Date.now() };
  // 玩家职业取所选牌组的职业(随机牌组时随机一个);AI 随机一个职业并按职业建库
  const pClass: ClassId = playerClass || randPick(st, CLASS_IDS);
  const aClass: ClassId = aiClass || randPick(st, CLASS_IDS);
  st.p.classId = pClass;
  st.a.classId = aClass;
  st.p.deck = playerDeck ? shuffle([...playerDeck], rng) : buildDeck(rng, pClass);
  st.a.deck = aiDeck ? shuffle([...aiDeck], rng) : buildDeck(rng, aClass);
  log(st, first === "p"
    ? "你获得先手!点击手牌查看,再次点击打出。"
    : "对手获得先手,你作为后手多抽一张牌并获得「幸运币」。");
  draw(st, first, 3);
  draw(st, second, 4);
  if (mulligan) {
    // 起手调度:AI 自动调度,玩家通过 pending 弹窗手动调度;幸运币与先手回合都推迟到 finishMulligan
    aiMulligan(st, "a");
    st.pending = { k: "mulligan" };
    return st;
  }
  st[second].hand.push({ uid: UID++, cid: COIN.id });
  if (first === "p") startTurn(st, "p");
  return st;
}

// 起手调度:把指定手牌(按 uid)换掉——先从牌库顶补抽同样数量,再把换掉的牌洗回牌库,
// 故换掉的牌当次不可能被重新抽到(炉石规则)。走 rand(st) 保证可复现。
export function applyMulligan(st: GameState, side: Side, replaceUids: number[]) {
  const s = st[side];
  if (!replaceUids.length) return;
  const set = new Set(replaceUids);
  const toReplace = s.hand.filter((c) => set.has(c.uid));
  s.hand = s.hand.filter((c) => !set.has(c.uid));
  const rng = () => rand(st);
  for (let i = 0; i < toReplace.length && s.deck.length; i++) {
    s.hand.push({ uid: UID++, cid: s.deck.pop()! });
  }
  for (const c of toReplace) s.deck.push(c.cid);
  shuffle(s.deck, rng);
}

// AI 起手调度:简单曲线策略——换掉费用 ≥4 的牌,留下早期可打的低费牌
function aiMulligan(st: GameState, side: Side) {
  const replace = st[side].hand.filter((c) => byId[c.cid].cost >= 4).map((c) => c.uid);
  applyMulligan(st, side, replace);
}

// 玩家确认调度:换牌 → 关闭弹窗 → 给后手方幸运币 → 若玩家先手则正式开始其回合
export function finishMulligan(st: GameState, replaceUids: number[]) {
  applyMulligan(st, "p", replaceUids);
  st.pending = null;
  const second = other(st.first);
  st[second].hand.push({ uid: UID++, cid: COIN.id });
  if (st.first === "p") startTurn(st, "p");
}
