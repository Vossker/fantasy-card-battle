// ================= 规则引擎(纯函数,不碰 React) =================
// 所有函数签名形如 fn(st, side, ...):直接修改传入的 state 对象 st,side 为 "p"(玩家)或 "a"(AI)
import { COIN, HAND_LIMIT, buildDeck, byId, shuffle, spTarget } from "./cards";
import type {
  AttackTarget, BloomMode, CampOpt, ChooseOpt, GameState, HandEntry,
  MinionCard, Side, SpellDef, SpellTarget,
} from "./types";

// 模块级自增全局变量:HMR 热更新后继续累加,不要假设从 1 开始
let UID = 1, FXID = 1;

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
      log(st, who + `的手牌已满,「${byId[cid].name}」被烧掉了`, true);
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
  s.maxMana = Math.min(10, s.maxMana + 1);
  s.mana = s.maxMana;
  s.board.forEach((m) => { m.sick = false; m.attacked = false; });
  draw(st, side, 1);
}
export function playMinion(st: GameState, side: Side, i: number): boolean {
  const s = st[side];
  if (!s) return false;
  const en = s.hand[i];
  if (!en) return false;
  const c = byId[en.cid];
  if (!c || c.type !== "m" || c.cost > s.mana || s.board.length >= 6) return false;
  s.mana -= c.cost;
  s.hand.splice(i, 1);
  s.board.push({
    uid: en.uid, cid: c.id, name: c.name, emoji: c.emoji,
    atk: c.atk, hp: c.hp, maxHp: c.hp,
    taunt: !!c.taunt, charge: !!c.charge, sick: !c.charge, attacked: false,
  });
  if (c.bc) doBattlecry(st, side, c);
  moonTutor(st, side, en);
  return true;
}
// 战吼:仅从手牌打出时触发(从牌库召唤不触发)
function doBattlecry(st: GameState, side: Side, c: MinionCard) {
  if (c.bc?.k === "summonMini") {
    const s = st[side];
    const pool = s.deck.filter((cid) => byId[cid].type === "m");
    if (!pool.length || s.board.length >= 6) return;
    const mc = byId[randPick(st, pool)];
    s.board.push({
      uid: UID++, cid: mc.id, name: mc.name, emoji: mc.emoji,
      atk: 1, hp: 1, maxHp: 1,
      taunt: !!mc.taunt, charge: !!mc.charge, sick: !mc.charge, attacked: false,
    });
    log(st, `「${c.name}」从牌库召唤了「${mc.name}」的 1/1 复制`);
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
  if (s.hand.length >= HAND_LIMIT) {
    log(st, `「月光指引」:${who}的手牌已满,本体「${byId[cid].name}」被烧掉了`, true);
    return;
  }
  s.hand.push({ uid: UID++, cid });
  log(st, `「月光指引」:${who}打出了复制,从牌库抽取了本体「${byId[cid].name}」`);
}
export function gainMoonCopy(st: GameState, side: Side, cid: number) {
  const s = st[side];
  if (s.hand.length >= HAND_LIMIT) {
    log(st, `${side === "p" ? "你" : "对手"}的手牌已满,「${byId[cid].name}」的复制被烧掉了`, true);
    return;
  }
  s.hand.push({ uid: UID++, cid, moon: st.turnNum });
}
export function sampleDeckAny(st: GameState, side: Side): number[] {
  const cids = [...new Set(st[side].deck)];
  shuffle(cids, () => rand(st));
  return cids.slice(0, 3);
}

// 光环减费:伊谢尔在场时法术费用变 1
export const effCost = (st: GameState, side: Side, c: { type: "m" | "s"; cost: number }) =>
  c.type === "s" && st[side].board.some((m) => byId[m.cid]?.aura === "cheapSpells") ? Math.min(1, c.cost) : c.cost;
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
    taunt: !!c.taunt, charge: !!c.charge, sick: !c.charge, attacked: false,
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
    summary: (sp, bonus) => (bonus > 0 ? `伤害* ${sp.n + bonus} *` : `伤害 ${sp.n}`),
    cast: (st, side, sp, tgt, bonus) => {
      const t = tgt!; // isValidSpellTarget 已保证非空
      const n = sp.n + bonus;
      if (t.hero) dmgHero(st, t.side, n);
      else dmgMinion(st, t.side, t.uid!, n);
      dmgExtras(st, side, sp);
    },
    autoCast: (st, side, sp, bonus) => {
      const e = other(side);
      const n = sp.n + bonus;
      const tgts: AttackTarget[] = st[e].board.map((m) => ({ uid: m.uid }));
      tgts.push({ hero: true });
      const t = randPick(st, tgts);
      if (t.hero) dmgHero(st, e, n);
      else dmgMinion(st, e, t.uid!, n);
      dmgExtras(st, side, sp);
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
        log(st, `「${name}」(随机)从牌库施放了「${byId[pick].name}」`);
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
};

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

export function castSpell(st: GameState, side: Side, i: number, tgt: SpellTarget | null): boolean {
  const s = st[side];
  if (!s) return false;
  const en = s.hand[i];
  if (!en) return false;
  const c = byId[en.cid];
  if (!c || c.type !== "s") return false;
  const sp = c.sp; // c 已收窄为 SpellCard,sp 为 SpellDef(非 undefined)
  const handler = effectFor(sp.k);
  if (!handler.cast) return false; // 交互类法术(choose/camp/bloom/moonlight)不从此路径打出,由 UI 的 pending 接管
  const cost = effCost(st, side, c);
  if (cost > s.mana || !isValidSpellTarget(st, side, sp, tgt)) return false;
  s.mana -= cost;
  s.hand.splice(i, 1);
  handler.cast(st, side, sp, tgt, s.spellDmg || 0);
  moonTutor(st, side, en);
  return true;
}
export function resolveAttack(st: GameState, side: Side, auid: number, tgt: AttackTarget | null): boolean {
  if (!tgt) return false;
  const attacker = st[side];
  const e = other(side);
  const defender = st[e];
  if (!attacker || !defender) return false;
  const A = attacker.board.find((m) => m.uid === auid);
  if (!A || A.sick || A.attacked || A.atk <= 0) return false;
  const taunts = defender.board.filter((m) => m.taunt);
  if (tgt.hero) {
    if (taunts.length) return false;
    A.attacked = true;
    dmgHero(st, e, A.atk);
    return true;
  }
  const D = defender.board.find((m) => m.uid === tgt.uid);
  if (!D || (taunts.length && !D.taunt)) return false;
  A.attacked = true;
  const dAtk = D.atk;
  dmgMinion(st, e, D.uid, A.atk);
  dmgMinion(st, side, A.uid, dAtk);
  return true;
}

// seed 缺省取系统熵;测试传入固定 seed 即可复现整局。
export function initGame(playerDeck: number[] | null = null, seed: number = (Date.now() ^ (Math.random() * 0x100000000)) | 0): GameState {
  const st: GameState = {
    phase: "play", turn: "p", first: "p", turnNum: 0, winner: null, rngState: seed | 0, fx: [], logs: [], notice: null, pending: null,
    lastLog: "", banner: null,
    p: { hp: 30, armor: 0, mana: 0, maxMana: 0, fatigue: 0, spellDmg: 0, deck: [], hand: [], board: [] },
    a: { hp: 30, armor: 0, mana: 0, maxMana: 0, fatigue: 0, spellDmg: 0, deck: [], hand: [], board: [] },
  };
  const rng = () => rand(st);
  const first: Side = rand(st) < 0.5 ? "p" : "a";
  const second = other(first);
  st.turn = first;
  st.first = first;
  st.turnNum = first === "p" ? 1 : 0;
  st.banner = { text: first === "p" ? "你是先手!" : "对手先手", id: Date.now() };
  st.p.deck = playerDeck ? shuffle([...playerDeck], rng) : buildDeck(rng);
  st.a.deck = buildDeck(rng);
  log(st, first === "p"
    ? "你获得先手!点击手牌查看,再次点击打出。"
    : "对手获得先手,你作为后手多抽一张牌并获得「幸运币」。");
  draw(st, first, 3);
  draw(st, second, 4);
  st[second].hand.push({ uid: UID++, cid: COIN.id });
  if (first === "p") startTurn(st, "p");
  return st;
}
