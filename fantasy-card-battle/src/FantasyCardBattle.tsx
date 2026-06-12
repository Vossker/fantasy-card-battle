import { useState, useRef, useEffect } from "react";

// ================= 卡牌数据(全部原创) =================
const POOL = [
  { id: 1, name: "农夫民兵", emoji: "👨‍🌾", cost: 1, type: "m", rarity: "c", atk: 2, hp: 1, desc: "拿起草叉保卫家园。" },
  { id: 2, name: "新兵盾卫", emoji: "🛡️", cost: 1, type: "m", rarity: "c", atk: 1, hp: 2, taunt: 1, desc: "我来挡!" },
  { id: 3, name: "灵猫", emoji: "🐈", cost: 1, type: "m", rarity: "c", atk: 1, hp: 1, charge: 1, desc: "敏捷如风。" },
  { id: 4, name: "见习法师", emoji: "🧙", cost: 2, type: "m", rarity: "c", atk: 2, hp: 2, desc: "刚学会第一个法术。" },
  { id: 5, name: "矮人战士", emoji: "🪓", cost: 2, type: "m", rarity: "c", atk: 3, hp: 2, desc: "山岭之子。" },
  { id: 6, name: "石墙守护者", emoji: "🗿", cost: 2, type: "m", rarity: "c", atk: 1, hp: 4, taunt: 1, desc: "坚如磐石。" },
  { id: 7, name: "游侠射手", emoji: "🏹", cost: 3, type: "m", rarity: "c", atk: 3, hp: 3, desc: "百步穿杨。" },
  { id: 8, name: "狮鹫骑士", emoji: "🦅", cost: 3, type: "m", rarity: "r", atk: 2, hp: 3, charge: 1, desc: "自天空俯冲!" },
  { id: 9, name: "暗影刺客", emoji: "🗡️", cost: 3, type: "m", rarity: "r", atk: 4, hp: 2, desc: "无声无息。" },
  { id: 10, name: "圣殿骑士", emoji: "🤺", cost: 4, type: "m", rarity: "r", atk: 3, hp: 5, taunt: 1, desc: "以圣光之名。" },
  { id: 11, name: "火焰元素", emoji: "🔥", cost: 4, type: "m", rarity: "c", atk: 5, hp: 3, desc: "燃烧吧!" },
  { id: 12, name: "皇家狮鹫", emoji: "🦁", cost: 4, type: "m", rarity: "r", atk: 4, hp: 4, desc: "王室空中卫队。" },
  { id: 13, name: "独角兽守卫", emoji: "🦄", cost: 5, type: "m", rarity: "r", atk: 5, hp: 5, desc: "圣洁之力。" },
  { id: 14, name: "树人长老", emoji: "🌳", cost: 5, type: "m", rarity: "r", atk: 4, hp: 6, taunt: 1, desc: "森林的守望者。" },
  { id: 15, name: "风暴巨人", emoji: "⛈️", cost: 6, type: "m", rarity: "e", atk: 6, hp: 6, desc: "雷霆之怒。" },
  { id: 16, name: "城堡卫士", emoji: "🏰", cost: 6, type: "m", rarity: "e", atk: 5, hp: 7, taunt: 1, desc: "王城最后的防线。" },
  { id: 17, name: "远古巨龙", emoji: "🐉", cost: 7, type: "m", rarity: "l", atk: 8, hp: 8, desc: "传说中的灾厄。" },
  { id: 18, name: "闪电箭", emoji: "⚡", cost: 1, type: "s", rarity: "c", sp: { k: "dmg", n: 2, t: "any" }, desc: "造成 2 点伤害。" },
  { id: 19, name: "力量祝福", emoji: "💪", cost: 1, type: "s", rarity: "c", sp: { k: "buff", a: 2, h: 0, t: "fm" }, desc: "使一个友方随从 +2 攻击力。" },
  { id: 20, name: "寒冰箭", emoji: "❄️", cost: 2, type: "s", rarity: "c", sp: { k: "dmg", n: 3, t: "any" }, desc: "造成 3 点伤害。" },
  { id: 21, name: "治疗之光", emoji: "✨", cost: 2, type: "s", rarity: "c", sp: { k: "heal", n: 6, t: "any" }, desc: "恢复 6 点生命值。" },
  { id: 22, name: "奥术智慧", emoji: "📜", cost: 3, type: "s", rarity: "r", sp: { k: "draw", n: 2 }, desc: "抽两张牌。" },
  { id: 23, name: "神圣新星", emoji: "🌟", cost: 3, type: "s", rarity: "r", sp: { k: "aoe", n: 2 }, desc: "对所有敌方随从造成 2 点伤害。" },
  { id: 24, name: "王者祝福", emoji: "👑", cost: 4, type: "s", rarity: "r", sp: { k: "buff", a: 3, h: 3, t: "fm" }, desc: "使一个友方随从 +3/+3。" },
  { id: 25, name: "火球术", emoji: "☄️", cost: 4, type: "s", rarity: "r", sp: { k: "dmg", n: 6, t: "any" }, desc: "造成 6 点伤害。" },
  { id: 26, name: "烈焰风暴", emoji: "🌋", cost: 6, type: "s", rarity: "e", sp: { k: "aoe", n: 4 }, desc: "对所有敌方随从造成 4 点伤害。" },
  { id: 27, name: "伊谢尔·风歌", emoji: "🧝‍♀️", cost: 9, type: "m", rarity: "l", atk: 5, hp: 5, aura: "cheapSpells", desc: "本随从在场时,你的所有法术牌费用变为(1)点。" },
  { id: 28, name: "夜影花蕾", emoji: "🌺", cost: 8, type: "s", rarity: "e", sp: { k: "bloom" }, desc: "【抉择】从你的牌库随机 3 张随从牌中选 1 张召唤;或从随机 3 张法术牌中选 1 张施放。" },
  { id: 29, name: "星夜露宿", emoji: "🏕️", cost: 8, type: "s", rarity: "e", sp: { k: "camp" }, desc: "【抉择三次】回复 3 个法力水晶;或抽两张牌;或获得 5 点护甲。" },
  { id: 30, name: "星火术", emoji: "💫", cost: 6, type: "s", rarity: "r", sp: { k: "dmg", n: 5, t: "any", draw: 1 }, desc: "造成 5 点伤害,抽一张牌。" },
  { id: 31, name: "鼓舞", emoji: "📯", cost: 2, type: "s", rarity: "c", sp: { k: "choose", opts: [{ fx: "draw", n: 1, emoji: "🃏", label: "抽一张牌" }, { fx: "manaEmpty", n: 1, emoji: "💠", label: "获得 1 个空的法力水晶" }] }, desc: "【抉择】抽一张牌;或获得 1 个空的法力水晶。" },
  { id: 32, name: "滋养", emoji: "🌿", cost: 5, type: "s", rarity: "r", sp: { k: "choose", opts: [{ fx: "draw", n: 3, emoji: "🃏", label: "抽三张牌" }, { fx: "manaFull", n: 2, emoji: "💎", label: "获得 2 个法力水晶" }] }, desc: "【抉择】抽三张牌;或获得 2 个法力水晶。" },
  { id: 33, name: "生物计划", emoji: "🧬", cost: 1, type: "s", rarity: "e", sp: { k: "bio" }, desc: "双方各获得 2 个法力水晶。" },
  { id: 34, name: "终极感染", emoji: "🦠", cost: 10, type: "s", rarity: "e", sp: { k: "dmg", n: 5, t: "any", draw: 5, armor: 5, summon: 98 }, desc: "造成 5 点伤害,抽五张牌,获得 5 点护甲值,召唤一个 5/5 的食尸鬼。" },
  { id: 35, name: "月光指引", emoji: "🌙", cost: 2, type: "s", rarity: "r", sp: { k: "moonlight" }, desc: "【发现】你牌库中的一张牌,获得其复制;如果你在本回合打出该复制,则从牌库抽取本体。" },
  { id: 36, name: "魔法方碑", emoji: "🧿", cost: 1, type: "s", rarity: "r", sp: { k: "obelisk" }, desc: "本回合内,你的所有法术造成的伤害加 1。" },
  { id: 37, name: "巴内斯", emoji: "🎭", cost: 5, type: "m", rarity: "l", atk: 3, hp: 4, bc: { k: "summonMini" }, desc: "【战吼】从你的牌库中随机召唤一个随从,其攻击力和生命值变为 1。" },
];
const COIN = { id: 99, name: "幸运币", emoji: "🪙", cost: 0, type: "s", rarity: "c", sp: { k: "coin" }, token: 1, desc: "在本回合获得一个法力水晶。" };
const GHOUL = { id: 98, name: "食尸鬼", emoji: "🧟", cost: 5, type: "m", rarity: "c", atk: 5, hp: 5, token: 1, desc: "由「终极感染」召唤。" };
const RARITY = { c: { label: "普通", color: "#cfd6dd" }, r: { label: "稀有", color: "#4da3ff" }, e: { label: "史诗", color: "#c478f0" }, l: { label: "传说", color: "#ffa726" } };
const maxCopies = (c) => (c.rarity === "l" ? 1 : 2);
const byId = {};
POOL.forEach((c) => (byId[c.id] = c));
byId[COIN.id] = COIN;
byId[GHOUL.id] = GHOUL;
const HAND_LIMIT = 10; // 手牌上限,超出时抽到的牌会被烧掉
let UID = 1, FXID = 1;

const clone = (o) => JSON.parse(JSON.stringify(o));
const other = (s) => (s === "p" ? "a" : "p");
const kw = (c) => `${c.taunt ? "【嘲讽】" : ""}${c.charge ? "【冲锋】" : ""}`;
const spSummary = (sp, bonus = 0) => {
  if (!sp) return "法术";
  if (sp.k === "dmg") return bonus > 0 ? `伤害* ${sp.n + bonus} *` : `伤害 ${sp.n}`;
  if (sp.k === "heal") return `治疗 ${sp.n}`;
  if (sp.k === "buff") return `+${sp.a}/+${sp.h}`;
  if (sp.k === "draw") return `抽 ${sp.n} 张`;
  if (sp.k === "aoe") return bonus > 0 ? `全体* ${sp.n + bonus} *` : `全体 ${sp.n}`;
  if (sp.k === "coin") return "+1 法力";
  if (sp.k === "bloom") return "抉择";
  if (sp.k === "camp") return "抉择×3";
  if (sp.k === "choose") return "抉择";
  if (sp.k === "bio") return "双方+2水晶";
  if (sp.k === "moonlight") return "发现";
  if (sp.k === "obelisk") return "法伤+1";
  return "法术";
};
// 法伤加成生效时,牌面描述中的伤害数字改为 * n * 形式(如 +1 法伤的闪电箭显示"造成* 3 *点伤害")
const cardDesc = (c, bonus = 0) =>
  c.sp && bonus > 0 && (c.sp.k === "dmg" || c.sp.k === "aoe")
    ? c.desc.replace(` ${c.sp.n} 点伤害`, `* ${c.sp.n + bonus} *点伤害`)
    : c.desc;

function shuffle(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
function buildDeck() {
  const counts = {}, deck = [];
  while (deck.length < 30) {
    const c = POOL[Math.floor(Math.random() * POOL.length)];
    if ((counts[c.id] || 0) >= maxCopies(c)) continue;
    counts[c.id] = (counts[c.id] || 0) + 1;
    deck.push(c.id);
  }
  return shuffle(deck);
}
function loadPlayerDeck() {
  try {
    const d = JSON.parse(localStorage.getItem("arcane-deck") || "null");
    if (!Array.isArray(d) || d.length !== 30) return null;
    const counts = {};
    for (const id of d) {
      const c = byId[id];
      if (!c || c.token) return null;
      counts[id] = (counts[id] || 0) + 1;
      if (counts[id] > maxCopies(c)) return null;
    }
    return d;
  } catch {
    return null;
  }
}

// ================= 规则引擎 =================
function fx(st, key, text, color) {
  st.fx.push({ id: FXID++, key, text, color, ts: Date.now() });
}
function log(st, text, important = false) {
  st.lastLog = text;
  if (!st.logs) st.logs = [];
  st.logs.push({ id: FXID++, turn: Math.max(1, st.turnNum), text, important: !!important });
  if (st.logs.length > 50) st.logs.shift();
}
function notice(st, text) {
  st.notice = { text, id: FXID++ };
}
function dmgHero(st, side, n) {
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
function dmgMinion(st, side, uid, n) {
  const m = st[side].board.find((x) => x.uid === uid);
  if (!m) return;
  m.hp -= n;
  fx(st, "m" + uid, "-" + n, "#ff6060");
  if (m.hp <= 0) st[side].board = st[side].board.filter((x) => x.uid !== uid);
}
function draw(st, side, n) {
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
    const cid = s.deck.pop();
    if (s.hand.length >= HAND_LIMIT) {
      log(st, who + `的手牌已满,「${byId[cid].name}」被烧掉了`, true);
      notice(st, `🔥 ${who}的手牌已满,「${byId[cid].name}」被烧掉了!`);
      continue;
    }
    s.hand.push({ uid: UID++, cid });
  }
}
function startTurn(st, side) {
  const s = st[side];
  st.p.spellDmg = 0;
  st.a.spellDmg = 0;
  s.maxMana = Math.min(10, s.maxMana + 1);
  s.mana = s.maxMana;
  s.board.forEach((m) => { m.sick = false; m.attacked = false; });
  draw(st, side, 1);
}
function playMinion(st, side, i) {
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
function doBattlecry(st, side, c) {
  if (c.bc.k === "summonMini") {
    const s = st[side];
    const pool = s.deck.filter((cid) => byId[cid].type === "m");
    if (!pool.length || s.board.length >= 6) return;
    const mc = byId[pool[Math.floor(Math.random() * pool.length)]];
    s.board.push({
      uid: UID++, cid: mc.id, name: mc.name, emoji: mc.emoji,
      atk: 1, hp: 1, maxHp: 1,
      taunt: !!mc.taunt, charge: !!mc.charge, sick: !mc.charge, attacked: false,
    });
    log(st, `「${c.name}」从牌库召唤了「${mc.name}」的 1/1 复制`);
  }
}
// 月光指引:本回合内打出发现的复制,则从牌库定向抽取本体
function moonTutor(st, side, en) {
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
function gainMoonCopy(st, side, cid) {
  const s = st[side];
  if (s.hand.length >= HAND_LIMIT) {
    log(st, `${side === "p" ? "你" : "对手"}的手牌已满,「${byId[cid].name}」的复制被烧掉了`, true);
    return;
  }
  s.hand.push({ uid: UID++, cid, moon: st.turnNum });
}
function sampleDeckAny(st, side) {
  const cids = [...new Set(st[side].deck)];
  shuffle(cids);
  return cids.slice(0, 3);
}

const effCost = (st, side, c) =>
  c.type === "s" && st[side].board.some((m) => (byId[m.cid] || {}).aura === "cheapSpells") ? Math.min(1, c.cost) : c.cost;
function removeFromDeck(st, side, cid) {
  const i = st[side].deck.indexOf(cid);
  if (i >= 0) st[side].deck.splice(i, 1);
}
function sampleDeck(st, side, type) {
  const idxs = [];
  st[side].deck.forEach((cid, i) => {
    const c = byId[cid];
    if (c.type === type) idxs.push(i);
  });
  shuffle(idxs);
  return idxs.slice(0, 3).map((i) => st[side].deck[i]);
}
function summonFromDeck(st, side, cid) {
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
function dmgExtras(st, side, sp) {
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
// 从牌库直接施放的法术自动选择目标;抉择类法术由系统随机选择选项
function castDeckSpell(st, side, cid) {
  const c = byId[cid];
  if (!c || !c.sp) return;
  const sp = c.sp;
  const e = other(side);
  const bonus = st[side].spellDmg || 0;
  if (sp.k === "dmg") {
    const n = sp.n + bonus;
    const tgts = st[e].board.map((m) => ({ uid: m.uid }));
    tgts.push({ hero: true });
    const t = tgts[Math.floor(Math.random() * tgts.length)];
    if (t.hero) dmgHero(st, e, n);
    else dmgMinion(st, e, t.uid, n);
    dmgExtras(st, side, sp);
  } else if (sp.k === "heal") {
    const h = st[side];
    h.hp = Math.min(30, h.hp + sp.n);
    fx(st, side + "-hero", "+" + sp.n, "#5ef08a");
  } else if (sp.k === "buff") {
    const board = st[side].board;
    if (board.length) {
      const m = [...board].sort((a, b) => b.atk + b.hp - (a.atk + a.hp))[0];
      m.atk += sp.a; m.hp += sp.h; m.maxHp += sp.h;
      fx(st, "m" + m.uid, `+${sp.a}/+${sp.h}`, "#ffd700");
    }
  } else if (sp.k === "draw") {
    draw(st, side, sp.n);
  } else if (sp.k === "aoe") {
    st[e].board.map((m) => m.uid).forEach((u) => dmgMinion(st, e, u, sp.n + bonus));
  } else if (sp.k === "bio") {
    gainMana(st, side, 2);
    gainMana(st, e, 2);
  } else if (sp.k === "obelisk") {
    st[side].spellDmg = bonus + 1;
    fx(st, side + "-hero", "法伤+1", "#c478f0");
  } else if (sp.k === "moonlight") {
    const opts = sampleDeckAny(st, side);
    if (opts.length) {
      const pick = opts[Math.floor(Math.random() * opts.length)];
      gainMoonCopy(st, side, pick);
      log(st, `「${c.name}」(随机)发现了「${byId[pick].name}」的复制`);
    }
  } else if (sp.k === "choose") {
    const o = sp.opts[Math.floor(Math.random() * sp.opts.length)];
    applyOpt(st, side, o);
    log(st, `「${c.name}」(随机)抉择了${o.label}`);
  } else if (sp.k === "camp") {
    const picked = [];
    for (let k = 0; k < 3; k++) {
      const o = ["mana", "draw", "armor"][Math.floor(Math.random() * 3)];
      campEffect(st, side, o);
      picked.push(campLabel(o));
    }
    log(st, `「${c.name}」(随机)抉择了:${picked.join("、")}`);
  } else if (sp.k === "bloom") {
    const mOk = st[side].board.length < 6 && st[side].deck.some((x) => byId[x].type === "m");
    const sOk = st[side].deck.some((x) => byId[x].type === "s");
    const modes = [mOk && "m", sOk && "s"].filter(Boolean);
    if (!modes.length) return;
    const mode = modes[Math.floor(Math.random() * modes.length)];
    const picks = sampleDeck(st, side, mode);
    const pick = picks[Math.floor(Math.random() * picks.length)];
    removeFromDeck(st, side, pick);
    if (mode === "m") {
      log(st, `「${c.name}」(随机)从牌库召唤了「${byId[pick].name}」`);
      summonFromDeck(st, side, pick);
    } else {
      log(st, `「${c.name}」(随机)从牌库施放了「${byId[pick].name}」`);
      castDeckSpell(st, side, pick);
    }
  }
}
function gainMana(st, side, n, empty = false) {
  const s = st[side];
  s.maxMana = Math.min(10, s.maxMana + n);
  if (!empty) s.mana = Math.min(10, s.mana + n);
  fx(st, side + "-hero", `+${n}${empty ? "💠" : "💎"}`, "#7cc4ff");
}
function applyOpt(st, side, o) {
  if (o.fx === "draw") draw(st, side, o.n);
  else if (o.fx === "manaEmpty") gainMana(st, side, o.n, true);
  else if (o.fx === "manaFull") gainMana(st, side, o.n);
}
const campLabel = (o) => (o === "mana" ? "回复 3 个法力水晶" : o === "draw" ? "抽两张牌" : "获得 5 点护甲");
function campEffect(st, side, opt) {
  const s = st[side];
  if (opt === "mana") s.mana = Math.min(s.maxMana, s.mana + 3);
  else if (opt === "draw") draw(st, side, 2);
  else if (opt === "armor") { s.armor = (s.armor || 0) + 5; fx(st, side + "-hero", "+5🛡", "#bfd3e6"); }
}

function isValidSpellTarget(st, side, sp, tgt) {
  if (!sp) return false;
  const caster = st[side];
  if (!caster) return false;
  if (sp.k === "draw" || sp.k === "aoe" || sp.k === "coin" || sp.k === "bio" || sp.k === "obelisk") return !tgt;
  if (!tgt) return false;
  if (sp.t === "fm") return tgt.side === side && !!tgt.uid && !!caster.board.find((m) => m.uid === tgt.uid);
  if (sp.t !== "any") return false;
  const targetSide = st[tgt.side];
  if (!targetSide) return false;
  if (tgt.hero) return true;
  return !!tgt.uid && !!targetSide.board.find((m) => m.uid === tgt.uid);
}

function castSpell(st, side, i, tgt) {
  const s = st[side];
  if (!s) return false;
  const en = s.hand[i];
  if (!en) return false;
  const c = byId[en.cid];
  if (!c) return false;
  const sp = c.sp;
  const cost = effCost(st, side, c);
  if (!c || c.type !== "s" || cost > s.mana || !isValidSpellTarget(st, side, sp, tgt)) return false;
  s.mana -= cost;
  s.hand.splice(i, 1);
  const bonus = s.spellDmg || 0;
  if (sp.k === "dmg") {
    const n = sp.n + bonus;
    if (tgt.hero) dmgHero(st, tgt.side, n);
    else dmgMinion(st, tgt.side, tgt.uid, n);
    dmgExtras(st, side, sp);
  } else if (sp.k === "heal") {
    if (tgt.hero) {
      const h = st[tgt.side];
      h.hp = Math.min(30, h.hp + sp.n);
      fx(st, tgt.side + "-hero", "+" + sp.n, "#5ef08a");
    } else {
      const m = st[tgt.side].board.find((x) => x.uid === tgt.uid);
      if (m) { m.hp = Math.min(m.maxHp, m.hp + sp.n); fx(st, "m" + m.uid, "+" + sp.n, "#5ef08a"); }
    }
  } else if (sp.k === "buff") {
    const m = st[tgt.side].board.find((x) => x.uid === tgt.uid);
    if (m) { m.atk += sp.a; m.hp += sp.h; m.maxHp += sp.h; fx(st, "m" + m.uid, `+${sp.a}/+${sp.h}`, "#ffd700"); }
  } else if (sp.k === "draw") {
    draw(st, side, sp.n);
  } else if (sp.k === "coin") {
    s.mana = Math.min(10, s.mana + 1);
    fx(st, side + "-hero", "+1💎", "#7cc4ff");
  } else if (sp.k === "bio") {
    gainMana(st, side, 2);
    gainMana(st, other(side), 2);
  } else if (sp.k === "obelisk") {
    s.spellDmg = bonus + 1;
    fx(st, side + "-hero", "法伤+1", "#c478f0");
  } else if (sp.k === "aoe") {
    const e = other(side);
    st[e].board.map((m) => m.uid).forEach((u) => dmgMinion(st, e, u, sp.n + bonus));
  }
  moonTutor(st, side, en);
  return true;
}
function resolveAttack(st, side, auid, tgt) {
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

// ================= AI 对手 =================
function aiPlay(st) {
  const A = st.a, P = st.p;
  const hand = A.hand.map((e, i) => ({ i, c: byId[e.cid] }));
  const can = hand.filter((h) => effCost(st, "a", h.c) <= A.mana);
  if (!can.length) return false;
  const dmg = can.filter((h) => h.c.sp && h.c.sp.k === "dmg").sort((x, y) => y.c.sp.n - x.c.sp.n);
  const bonus = A.spellDmg || 0;
  // 魔法方碑:有伤害法术可跟进时先开碑
  const obe = can.find((h) => h.c.sp && h.c.sp.k === "obelisk");
  if (obe && can.some((h) => h.c.sp && (h.c.sp.k === "dmg" || h.c.sp.k === "aoe") && effCost(st, "a", h.c) <= A.mana - effCost(st, "a", obe.c))) {
    if (castSpell(st, "a", obe.i, null)) {
      log(st, `对手施放了「${obe.c.name}」,本回合法术伤害 +1`);
      return true;
    }
  }
  // 斩杀
  for (const h of dmg) {
    if (h.c.sp.n + bonus >= P.hp + (P.armor || 0)) {
      if (castSpell(st, "a", h.i, { side: "p", hero: true })) {
        log(st, `对手使用「${h.c.name}」直击你的英雄!`);
        return true;
      }
    }
  }
  // 群体清场
  const aoe = can.filter((h) => h.c.sp && h.c.sp.k === "aoe").sort((x, y) => y.c.sp.n - x.c.sp.n);
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
      const eff = [...dmg].reverse().find((h) => h.c.sp.n + bonus >= th.hp);
      if (eff) {
        if (castSpell(st, "a", eff.i, { side: "p", uid: th.uid })) {
          log(st, `对手对「${th.name}」使用了「${eff.c.name}」`);
          return true;
        }
      }
    }
  }
  // 治疗
  const heal = can.find((h) => h.c.sp && h.c.sp.k === "heal");
  if (heal && A.hp <= 20) {
    if (castSpell(st, "a", heal.i, { side: "a", hero: true })) {
      log(st, `对手使用「${heal.c.name}」恢复了生命`);
      return true;
    }
  }
  // 夜影花蕾:优先召唤随从,否则施放法术
  const bloom = can.find((h) => h.c.sp && h.c.sp.k === "bloom");
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
  const camp = can.find((h) => h.c.sp && h.c.sp.k === "camp");
  if (camp) {
    const en2 = A.hand[camp.i];
    A.mana -= effCost(st, "a", camp.c);
    A.hand.splice(camp.i, 1);
    moonTutor(st, "a", en2);
    const picked = [];
    for (let k = 0; k < 3; k++) {
      const opt = A.hp + (A.armor || 0) <= 24 ? "armor" : A.hand.length <= 6 ? "draw" : "mana";
      campEffect(st, "a", opt);
      picked.push(campLabel(opt));
    }
    log(st, `对手施放「星夜露宿」,抉择了:${picked.join("、")}`);
    return true;
  }
  // 鼓舞/滋养类抉择:法力未满时优先涨水晶,否则抽牌
  const chooser = can.find((h) => h.c.sp && h.c.sp.k === "choose");
  if (chooser) {
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
  const bio = can.find((h) => h.c.sp && h.c.sp.k === "bio");
  if (bio && A.maxMana < 10) {
    if (castSpell(st, "a", bio.i, null)) {
      log(st, `对手施放了「${bio.c.name}」,双方各获得 2 个法力水晶`);
      return true;
    }
  }
  // 幸运币:恰好能解锁一张差 1 费的牌时使用
  const coin = can.find((h) => h.c.sp && h.c.sp.k === "coin");
  if (coin && A.mana < 10 && hand.some((h) => effCost(st, "a", h.c) === A.mana + 1)) {
    if (castSpell(st, "a", coin.i, null)) {
      log(st, "对手使用了「幸运币」");
      return true;
    }
  }
  // 月光指引:发现费用最高的牌
  const moon = can.find((h) => h.c.sp && h.c.sp.k === "moonlight");
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
  const mins = can.filter((h) => h.c.type === "m").sort((x, y) => y.c.cost - x.c.cost || y.c.atk - x.c.atk);
  if (mins.length && A.board.length < 6) {
    if (playMinion(st, "a", mins[0].i)) {
      log(st, `对手打出了「${mins[0].c.name}」`);
      return true;
    }
  }
  // 强化
  const bf = can.find((h) => h.c.sp && h.c.sp.k === "buff");
  if (bf && A.board.length) {
    const m = [...A.board].sort((a, b) => b.atk + b.hp - (a.atk + a.hp))[0];
    if (castSpell(st, "a", bf.i, { side: "a", uid: m.uid })) {
      log(st, `对手对「${m.name}」使用了「${bf.c.name}」`);
      return true;
    }
  }
  // 抽牌
  const dr = can.find((h) => h.c.sp && h.c.sp.k === "draw");
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
function aiAttack(st) {
  const ready = st.a.board.filter((m) => !m.sick && !m.attacked && m.atk > 0);
  if (!ready.length) return false;
  const m = ready[0];
  const taunts = st.p.board.filter((x) => x.taunt);
  let tgt = null, tname = "";
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
function computeAiTurn(b) {
  const snaps = [];
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

function initGame(playerDeck = null) {
  const first = Math.random() < 0.5 ? "p" : "a";
  const second = other(first);
  const st = {
    phase: "play", turn: first, first, turnNum: first === "p" ? 1 : 0, winner: null, fx: [], logs: [], notice: null, pending: null,
    lastLog: "",
    banner: { text: first === "p" ? "你是先手!" : "对手先手", id: Date.now() },
    p: { hp: 30, armor: 0, mana: 0, maxMana: 0, fatigue: 0, spellDmg: 0, deck: playerDeck ? shuffle([...playerDeck]) : buildDeck(), hand: [], board: [] },
    a: { hp: 30, armor: 0, mana: 0, maxMana: 0, fatigue: 0, spellDmg: 0, deck: buildDeck(), hand: [], board: [] },
  };
  log(st, first === "p"
    ? "你获得先手!点击手牌查看,再次点击打出。"
    : "对手获得先手,你作为后手多抽一张牌并获得「幸运币」。");
  draw(st, first, 3);
  draw(st, second, 4);
  st[second].hand.push({ uid: UID++, cid: COIN.id });
  if (first === "p") startTurn(st, "p");
  return st;
}

const CSS = `
@keyframes fUp{0%{opacity:1;transform:translate(-50%,0) scale(1.25)}100%{opacity:0;transform:translate(-50%,-36px) scale(.9)}}
@keyframes pulseR{0%,100%{box-shadow:0 0 0 3px rgba(248,80,80,.95),0 0 14px rgba(248,80,80,.8)}50%{box-shadow:0 0 0 2px rgba(248,80,80,.45),0 0 5px rgba(248,80,80,.35)}}
@keyframes banner{0%{opacity:0;transform:scale(.5)}18%{opacity:1;transform:scale(1.08)}32%{transform:scale(1)}70%{opacity:1}100%{opacity:0;transform:scale(1.02)}}
@keyframes noticeFx{0%{opacity:0;transform:translateY(12px)}10%{opacity:1;transform:translateY(0)}80%{opacity:1}100%{opacity:0}}
`;

// ================= 展示组件(模块顶层,避免每次渲染重挂载导致 transition 失效) =================
const Badge = ({ pos, v, bg }) => (
  <span style={{ position: "absolute", bottom: -7, [pos === "bl" ? "left" : "right"]: -7, width: 22, height: 22, borderRadius: "50%", background: bg, border: "2px solid #e7cf8e", color: "#fff", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", textShadow: "0 1px 2px #000", zIndex: 5 }}>
    {v}
  </span>
);

const MinionEl = ({ side, m, myTurn, selAtk, isT, clickEntity, floats }) => {
  const mine = side === "p";
  const ready = mine && myTurn && !m.sick && !m.attacked;
  const sel = selAtk === m.uid;
  const tgt = isT(side, m.uid);
  return (
    <div
      onClick={(e) => { e.stopPropagation(); clickEntity(side, m.uid); }}
      style={{
        width: 58, height: 74, borderRadius: m.taunt ? 18 : 10, position: "relative", cursor: "pointer", flexShrink: 0,
        background: mine ? "linear-gradient(160deg,#6b5430,#41331a)" : "linear-gradient(160deg,#4a3354,#2c1d33)",
        border: m.taunt ? "3px solid #9aa5b1" : "2px solid " + (mine ? "#c9a85a" : "#8a6da8"),
        boxShadow: tgt ? "none" : sel ? "0 0 0 3px #ffd700,0 0 14px #ffd700" : ready ? "0 0 10px rgba(80,220,100,.85),0 0 0 2px rgba(80,220,100,.6)" : "0 2px 5px rgba(0,0,0,.5)",
        animation: tgt ? "pulseR 1s infinite" : "none",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <span style={{ fontSize: 26 }}>{m.emoji}</span>
      {m.taunt && <span style={{ position: "absolute", top: -9, left: "50%", transform: "translateX(-50%)", fontSize: 11 }}>🛡️</span>}
      {m.charge && <span style={{ position: "absolute", top: 2, right: 3, fontSize: 9 }}>⚡</span>}
      {m.sick && mine && <span style={{ position: "absolute", top: 2, left: 3, fontSize: 9 }}>💤</span>}
      <Badge pos="bl" v={m.atk} bg="#b8860b" />
      <Badge pos="br" v={m.hp} bg={m.hp < m.maxHp ? "#dc2626" : "#7f1d1d"} />
      {floats("m" + m.uid)}
    </div>
  );
};

const HeroEl = ({ side, h, isT, clickEntity, floats }) => {
  const tgt = isT(side, null);
  return (
    <div
      onClick={(e) => { e.stopPropagation(); clickEntity(side, null); }}
      style={{ position: "relative", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "4px 10px", borderRadius: 12, background: "rgba(0,0,0,.28)", border: "2px solid " + (side === "p" ? "#d9b85c" : "#a06bc4"), animation: tgt ? "pulseR 1s infinite" : "none" }}
    >
      <span style={{ fontSize: 30 }}>{side === "p" ? "🤴" : "💀"}</span>
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#f4e6c1", whiteSpace: "nowrap" }}>{side === "p" ? "圣辉骑士(你)" : "死灵领主"}</div>
        <div style={{ fontSize: 15, fontWeight: 900, color: "#ff8585" }}>
          ❤️ {h.hp}
          {h.armor > 0 && <span style={{ color: "#bfd3e6", marginLeft: 6 }}>🛡️ {h.armor}</span>}
        </div>
      </div>
      {floats(side + "-hero")}
    </div>
  );
};

const HandCard = ({ en, i, selHand, mana, myTurn, handleHand, setHovHand, cost, bonus }) => {
  const c = byId[en.cid];
  const sel = selHand === i;
  const afford = cost <= mana && myTurn;
  const discounted = cost < c.cost;
  return (
    <div
      onClick={(e) => { e.stopPropagation(); handleHand(i); }}
      onMouseEnter={() => setHovHand(i)}
      style={{
        width: "clamp(54px,13.5vw,68px)", height: "clamp(80px,19vw,96px)", marginLeft: i === 0 ? 0 : "-10px",
        borderRadius: 9, position: "relative", cursor: "pointer", flexShrink: 0,
        transform: sel ? "translateY(-16px) scale(1.12)" : "none", transition: "transform .15s",
        zIndex: sel ? 40 : 10 + i,
        background: c.type === "m" ? "linear-gradient(170deg,#7a5c33,#4a3517 70%)" : "linear-gradient(170deg,#3d4f8a,#23284e 70%)",
        border: sel ? "2px solid #ffd700" : "2px solid " + (c.type === "m" ? "#caa45c" : "#7d90d8"),
        boxShadow: sel ? "0 6px 16px rgba(0,0,0,.6),0 0 12px rgba(255,215,0,.5)" : "0 3px 6px rgba(0,0,0,.55)",
        filter: afford ? "none" : "grayscale(.7) brightness(.72)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, padding: "4px 2px",
      }}
    >
      <span style={{ position: "absolute", top: -6, left: -6, width: 20, height: 20, borderRadius: "50%", background: discounted ? "radial-gradient(circle at 35% 30%,#b9f2c4,#1f9c44 60%,#0b5e26)" : "radial-gradient(circle at 35% 30%,#9fd6ff,#1f63c4 60%,#0b3a7e)", border: "2px solid " + (discounted ? "#d6f5dc" : "#cfe6ff"), color: "#fff", fontSize: 11, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 5 }}>
        {cost}
      </span>
      <span style={{ fontSize: 22, lineHeight: 1 }}>{c.emoji}</span>
      <span style={{ fontSize: 9, color: c.rarity === "c" ? "#f7ecd2" : RARITY[c.rarity].color, fontWeight: 700, textAlign: "center", lineHeight: 1.15, textShadow: "0 1px 2px #000" }}>{c.name}</span>
      {c.type === "m" ? (
        <>
          <Badge pos="bl" v={c.atk} bg="#b8860b" />
          <Badge pos="br" v={c.hp} bg="#7f1d1d" />
        </>
      ) : (
        <span style={{ fontSize: 9, color: "#aebdf2", fontWeight: 700 }}>{spSummary(c.sp, bonus)}</span>
      )}
      {(c.taunt || c.charge) && <span style={{ position: "absolute", top: 2, right: 2, fontSize: 9 }}>{c.taunt ? "🛡️" : "⚡"}</span>}
    </div>
  );
};

// ================= 组件 =================
export default function ArcaneThrone() {
  const [game, setGame] = useState({ phase: "menu" });
  const [selHand, setSelHand] = useState(null);
  const [selAtk, setSelAtk] = useState(null);
  const [hint, setHint] = useState(null);
  const [hovHand, setHovHand] = useState(null);
  const [inspect, setInspect] = useState(null);
  const [showLog, setShowLog] = useState(false);
  const [confirmSurrender, setConfirmSurrender] = useState(false);
  const [playerDeck, setPlayerDeck] = useState(loadPlayerDeck);
  const [deckSel, setDeckSel] = useState([]);
  const gameRef = useRef(game);
  const timers = useRef([]);

  useEffect(() => { gameRef.current = game; }, [game]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  useEffect(() => {
    if (!game.fx || !game.fx.length) return;
    const t = setTimeout(
      () => setGame((g) => (g.fx && g.fx.length ? { ...g, fx: g.fx.filter((f) => Date.now() - f.ts < 1000) } : g)),
      1100
    );
    return () => clearTimeout(t);
  }, [game.fx]);
  useEffect(() => {
    if (!hint) return;
    const t = setTimeout(() => setHint(null), 1800);
    return () => clearTimeout(t);
  }, [hint]);
  useEffect(() => {
    if (game.phase === "play" && game.winner) {
      const t = setTimeout(() => setGame((g) => (g.phase === "play" ? { ...g, phase: "over" } : g)), 900);
      return () => clearTimeout(t);
    }
  }, [game.winner, game.phase]);

  const T = (fn, ms) => timers.current.push(setTimeout(fn, ms));
  const myTurn = game.phase === "play" && game.turn === "p" && !game.winner;
  const mutate = (fn) => setGame((g) => { const st = clone(g); fn(st); return st; });

  const start = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setSelHand(null); setSelAtk(null); setHint(null);
    setHovHand(null); setInspect(null); setShowLog(false);
    setConfirmSurrender(false);
    const st = initGame(playerDeck);
    if (st.turn === "a") runAiTurn(st);
    else setGame(st);
  };

  function runAiTurn(base) {
    setGame(base);
    const snaps = computeAiTurn(base);
    snaps.forEach((s, i) => T(() => setGame(s), 750 * (i + 1)));
    T(() => {
      setGame((g) => {
        if (g.winner || g.phase !== "play") return g;
        const st = clone(g);
        st.turn = "p";
        st.turnNum++;
        st.fx = [];
        startTurn(st, "p");
        st.banner = { text: "你的回合", id: Date.now() };
        if (!st.winner) log(st, "你的回合 — 抽了一张牌");
        return st;
      });
    }, 750 * (snaps.length + 1));
  }

  const openDeckBuilder = () => {
    setDeckSel(playerDeck ? [...playerDeck] : []);
    setGame({ phase: "deck" });
  };
  const addCard = (id) => setDeckSel((d) => (d.length >= 30 || d.filter((x) => x === id).length >= maxCopies(byId[id]) ? d : [...d, id]));
  const removeCard = (id) =>
    setDeckSel((d) => {
      const i = d.indexOf(id);
      if (i < 0) return d;
      const nd = [...d];
      nd.splice(i, 1);
      return nd;
    });
  const randomFill = () =>
    setDeckSel((d) => {
      const nd = [...d];
      let guard = 0;
      while (nd.length < 30 && guard++ < 500) {
        const c = POOL[Math.floor(Math.random() * POOL.length)];
        if (nd.filter((x) => x === c.id).length >= maxCopies(c)) continue;
        nd.push(c.id);
      }
      return nd;
    });
  const saveDeck = () => {
    if (deckSel.length !== 30) return;
    const d = [...deckSel];
    setPlayerDeck(d);
    try { localStorage.setItem("arcane-deck", JSON.stringify(d)); } catch {}
    setGame({ phase: "menu" });
  };

  // ---------- 抉择处理 ----------
  // 确认夜影花蕾的模式:此时才真正支付费用并移出手牌;翻开牌库的牌后(bloomPick)不可再取消
  function pickBloomMode(mode) {
    mutate((st) => {
      const p = st.pending;
      if (!p || p.k !== "bloomMode") return;
      const en = st.p.hand[p.i];
      if (!en) return;
      const c = byId[en.cid];
      st.p.mana -= effCost(st, "p", c);
      st.p.hand.splice(p.i, 1);
      log(st, `你施放了「${c.name}」`);
      moonTutor(st, "p", en);
      st.pending = { k: "bloomPick", mode, opts: sampleDeck(st, "p", mode) };
    });
  }
  function pickBloomCard(idx) {
    mutate((st) => {
      const p = st.pending;
      if (!p || p.k !== "bloomPick") return;
      const cid = p.opts[idx];
      if (cid == null) return;
      removeFromDeck(st, "p", cid);
      if (p.mode === "m") {
        log(st, `「夜影花蕾」从你的牌库召唤了「${byId[cid].name}」`);
        summonFromDeck(st, "p", cid);
      } else {
        log(st, `「夜影花蕾」从你的牌库施放了「${byId[cid].name}」`);
        castDeckSpell(st, "p", cid);
      }
      st.pending = null;
    });
  }
  function pickCamp(opt) {
    mutate((st) => {
      const p = st.pending;
      if (!p || p.k !== "camp") return;
      campEffect(st, "p", opt);
      log(st, `「星夜露宿」:你抉择了${campLabel(opt)}`);
      p.remaining--;
      if (p.remaining <= 0) st.pending = null;
    });
  }
  // 确认抉择选项:此时才真正支付费用并移出手牌
  function pickChoose(idx) {
    mutate((st) => {
      const p = st.pending;
      if (!p || p.k !== "choose") return;
      const o = p.opts[idx];
      if (!o) return;
      const en = st.p.hand[p.i];
      if (!en) return;
      const c = byId[en.cid];
      st.p.mana -= effCost(st, "p", c);
      st.p.hand.splice(p.i, 1);
      applyOpt(st, "p", o);
      log(st, `你施放了「${c.name}」,抉择了${o.label}`);
      moonTutor(st, "p", en);
      st.pending = null;
    });
  }
  // 取消抉择:仅限尚未看到牌库内容的阶段(choose / bloomMode),费用与手牌均未结算,直接关闭即可
  function cancelPending() {
    mutate((st) => {
      const p = st.pending;
      if (p && (p.k === "choose" || p.k === "bloomMode")) st.pending = null;
    });
  }
  function pickMoon(idx) {
    mutate((st) => {
      const p = st.pending;
      if (!p || p.k !== "moonPick") return;
      const cid = p.opts[idx];
      if (cid == null) return;
      gainMoonCopy(st, "p", cid);
      log(st, `「月光指引」:你发现了「${byId[cid].name}」的复制`);
      st.pending = null;
    });
  }

  function surrender() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setConfirmSurrender(false);
    setSelHand(null); setSelAtk(null); setInspect(null); setHovHand(null);
    mutate((st) => {
      if (st.winner || st.phase !== "play") return;
      st.winner = "a";
      st.surrendered = true;
      log(st, "你选择了认输", true);
    });
  }

  function handleHand(i) {
    if (!myTurn || game.pending) return;
    const en = game.p.hand[i];
    if (!en) return;
    const c = byId[en.cid];
    setInspect(null);
    if (selHand !== i) {
      setSelHand(i); setSelAtk(null);
      if (effCost(game, "p", c) > game.p.mana) setHint({ t: "法力水晶不足", id: Date.now() });
      else if (c.sp && c.sp.t === "fm" && !game.p.board.length) setHint({ t: "场上没有可选目标", id: Date.now() });
      else if (c.sp && (c.sp.t === "any" || c.sp.t === "fm")) setHint({ t: "点击目标施放法术", id: Date.now() });
      return;
    }
    if (effCost(game, "p", c) > game.p.mana) { setHint({ t: "法力水晶不足", id: Date.now() }); return; }
    if (c.type === "m") {
      if (game.p.board.length >= 6) { setHint({ t: "随从区已满(最多 6 个)", id: Date.now() }); return; }
      mutate((st) => { if (playMinion(st, "p", i)) log(st, `你打出了「${c.name}」`); });
      setSelHand(null); setHovHand(null);
    } else if (c.sp.k === "bloom") {
      const mOk = game.p.board.length < 6 && game.p.deck.some((cid) => byId[cid].type === "m");
      const sOk = game.p.deck.some((cid) => byId[cid].type === "s");
      if (!mOk && !sOk) { setHint({ t: "牌库中没有可供抉择的卡牌", id: Date.now() }); return; }
      // 进入抉择界面时不扣费、不离手,确认模式时才结算(可取消)
      mutate((st) => { st.pending = { k: "bloomMode", i }; });
      setSelHand(null); setHovHand(null);
    } else if (c.sp.k === "camp") {
      mutate((st) => {
        const en2 = st.p.hand[i];
        st.p.mana -= effCost(st, "p", c);
        st.p.hand.splice(i, 1);
        st.pending = { k: "camp", remaining: 3 };
        log(st, `你施放了「${c.name}」`);
        moonTutor(st, "p", en2);
      });
      setSelHand(null); setHovHand(null);
    } else if (c.sp.k === "choose") {
      // 进入抉择界面时不扣费、不离手,确认选项时才结算(可取消)
      mutate((st) => { st.pending = { k: "choose", i, name: c.name, emoji: c.emoji, opts: c.sp.opts }; });
      setSelHand(null); setHovHand(null);
    } else if (c.sp.k === "moonlight") {
      if (!game.p.deck.length) { setHint({ t: "牌库已空,无法发现", id: Date.now() }); return; }
      mutate((st) => {
        const en2 = st.p.hand[i];
        st.p.mana -= effCost(st, "p", c);
        st.p.hand.splice(i, 1);
        st.pending = { k: "moonPick", opts: sampleDeckAny(st, "p") };
        log(st, `你施放了「${c.name}」`);
        moonTutor(st, "p", en2);
      });
      setSelHand(null); setHovHand(null);
    } else if (!(c.sp.t === "any" || c.sp.t === "fm")) {
      mutate((st) => { if (castSpell(st, "p", i, null)) log(st, `你施放了「${c.name}」`); });
      setSelHand(null); setHovHand(null);
    } else setHint({ t: "点击目标施放法术", id: Date.now() });
  }

  function clickEntity(side, uid) {
    if (game.pending) return;
    if (!myTurn) {
      if (uid) setInspect({ side, uid });
      return;
    }
    const selCard = selHand != null && game.p.hand[selHand] ? byId[game.p.hand[selHand].cid] : null;
    if (selCard && selCard.sp && (selCard.sp.t === "any" || selCard.sp.t === "fm") && effCost(game, "p", selCard) <= game.p.mana) {
      if (selCard.sp.t === "fm" && (side !== "p" || !uid)) return;
      const idx = selHand;
      mutate((st) => {
        if (castSpell(st, "p", idx, uid ? { side, uid } : { side, hero: true })) {
          log(st, `你施放了「${selCard.name}」`);
        }
      });
      setSelHand(null); setInspect(null);
      return;
    }
    if (side === "p" && uid) {
      const m = game.p.board.find((x) => x.uid === uid);
      if (!m) return;
      if (m.sick) { setInspect({ side, uid }); setHint({ t: "刚上场的随从需等待一回合(冲锋除外)", id: Date.now() }); return; }
      if (m.attacked) { setInspect({ side, uid }); setHint({ t: "该随从本回合已攻击过", id: Date.now() }); return; }
      const next = selAtk === uid ? null : uid;
      setSelAtk(next); setSelHand(null); setInspect(null);
      if (next) setHint({ t: "点击敌方随从或英雄发起攻击", id: Date.now() });
      return;
    }
    if (side === "a" && !selAtk && uid) {
      setInspect({ side, uid }); setSelHand(null);
      return;
    }
    if (side === "a" && selAtk) {
      const taunts = game.a.board.filter((m) => m.taunt);
      const a = selAtk;
      if (uid) {
        const t = game.a.board.find((x) => x.uid === uid);
        if (!t) return;
        if (taunts.length && !t.taunt) { setHint({ t: "必须先攻击带 🛡️ 嘲讽的随从", id: Date.now() }); return; }
        mutate((st) => {
          const A = st.p.board.find((x) => x.uid === a);
          if (resolveAttack(st, "p", a, { uid })) {
            log(st, `你的「${A ? A.name : "随从"}」攻击了「${t.name}」`);
          }
        });
      } else {
        if (taunts.length) { setHint({ t: "必须先攻击带 🛡️ 嘲讽的随从", id: Date.now() }); return; }
        mutate((st) => {
          const A = st.p.board.find((x) => x.uid === a);
          if (resolveAttack(st, "p", a, { hero: true })) {
            log(st, `你的「${A ? A.name : "随从"}」攻击了敌方英雄`);
          }
        });
      }
      setSelAtk(null);
    }
  }

  function endTurn() {
    if (!myTurn || game.pending) return;
    setSelHand(null); setSelAtk(null); setInspect(null); setHovHand(null);
    const base = clone(gameRef.current);
    base.turn = "a";
    base.banner = { text: "对手回合", id: Date.now() };
    log(base, "对手回合开始");
    base.fx = [];
    runAiTurn(base);
  }

  // ---------- 渲染辅助 ----------
  const floats = (key) =>
    (game.fx || [])
      .filter((f) => f.key === key)
      .map((f) => (
        <span key={f.id} style={{ position: "absolute", left: "50%", top: -4, transform: "translateX(-50%)", color: f.color, fontWeight: 900, fontSize: 18, textShadow: "0 1px 3px #000", animation: "fUp 1s ease-out forwards", pointerEvents: "none", zIndex: 60, whiteSpace: "nowrap" }}>
          {f.text}
        </span>
      ));

  const selCard = selHand != null && game.p && game.p.hand[selHand] ? byId[game.p.hand[selHand].cid] : null;
  const hovCard = hovHand != null && game.p && game.p.hand[hovHand] ? byId[game.p.hand[hovHand].cid] : null;
  const previewCard = hovCard || selCard;
  const inspectM = !previewCard && inspect && game[inspect.side] ? game[inspect.side].board.find((m) => m.uid === inspect.uid) : null;
  const spellTargeting = !!(selCard && selCard.sp && (selCard.sp.t === "any" || selCard.sp.t === "fm") && game.p && effCost(game, "p", selCard) <= game.p.mana);
  const enemyTaunts = game.a ? game.a.board.filter((m) => m.taunt) : [];
  const isT = (side, uid) => {
    if (!myTurn) return false;
    if (spellTargeting) {
      if (selCard.sp.t === "any") return true;
      return side === "p" && !!uid;
    }
    if (selAtk) {
      if (side !== "a") return false;
      if (enemyTaunts.length) return !!uid && !!game.a.board.find((m) => m.uid === uid && m.taunt);
      return true;
    }
    return false;
  };

  const goldBtn = {
    padding: "10px 26px", borderRadius: 999, fontWeight: 800, fontSize: 15, cursor: "pointer",
    border: "2px solid #f0d98c", background: "linear-gradient(180deg,#ffe08a,#c79a2e)", color: "#4a3508",
    boxShadow: "0 0 14px rgba(255,215,0,.45)", fontFamily: "inherit",
  };

  const outer = {
    minHeight: "100vh", display: "flex", flexDirection: "column",
    background: "radial-gradient(ellipse at center,#36452c 0%,#222d18 60%,#141b0d 100%)",
    fontFamily: "Georgia,'Noto Serif SC','SimSun',serif", position: "relative", overflow: "hidden", userSelect: "none",
  };

  // ---------- 主菜单 ----------
  if (game.phase === "menu") {
    return (
      <div style={{ ...outer, alignItems: "center", justifyContent: "center", gap: 18, padding: 20 }}>
        <style>{CSS}</style>
        <div style={{ fontSize: 38, fontWeight: 900, color: "#ffd700", textShadow: "0 0 22px rgba(255,200,0,.7),0 2px 4px #000", letterSpacing: 6 }}>⚔️ 奥术王座 ⚔️</div>
        <div style={{ color: "#d8c89a", fontSize: 14, letterSpacing: 3 }}>经 典 奇 幻 卡 牌 对 战</div>
        <div style={{ maxWidth: 340, background: "rgba(0,0,0,.35)", border: "2px solid #8a6d3b", borderRadius: 14, padding: "16px 18px", color: "#e8dcc0", fontSize: 13, lineHeight: 2 }}>
          <div style={{ color: "#ffd700", fontWeight: 800, marginBottom: 4, textAlign: "center" }}>— 对战规则 —</div>
          ❤️ 双方英雄 30 血,先打空对方生命值者获胜<br />
          💎 法力水晶每回合 +1(上限 10),用来支付卡牌费用<br />
          🪙 先后手随机,后手多抽一张牌并获得「幸运币」<br />
          🛡️ <b>嘲讽</b>:敌人必须先攻击该随从<br />
          ⚡ <b>冲锋</b>:登场当回合即可攻击<br />
          🌙 <b>抉择</b>:打出时从多个效果中选择一项<br />
          ⛨ <b>护甲</b>:先于生命值抵挡伤害<br />
          🃏 牌库抽空后,每次抽牌受到递增的疲劳伤害
        </div>
        <div style={{ maxWidth: 340, color: "#bfae84", fontSize: 12, lineHeight: 1.9, textAlign: "center" }}>
          操作:点击手牌查看 → <b>再次点击打出</b>;指向性法术点击目标施放;<br />
          点击我方随从,再点击敌方目标即可发起攻击。
        </div>
        <button onClick={start} style={goldBtn}>开 始 对 战</button>
        <button onClick={openDeckBuilder} style={{ ...goldBtn, background: "rgba(0,0,0,.3)", border: "2px solid #8a6d3b", color: "#e8dcc0", boxShadow: "none" }}>
          构 建 牌 组
        </button>
        <span style={{ fontSize: 11, color: "#9c9272" }}>
          {playerDeck ? "⚔️ 对战将使用:自定义牌组(30 张)" : "⚔️ 对战将使用:随机牌组"}
        </span>
      </div>
    );
  }

  // ---------- 牌组构建 ----------
  if (game.phase === "deck") {
    const counts = {};
    deckSel.forEach((id) => (counts[id] = (counts[id] || 0) + 1));
    const full = deckSel.length >= 30;
    const subBtn = { padding: "7px 14px", borderRadius: 999, fontWeight: 700, fontSize: 12, cursor: "pointer", border: "1px solid #8a6d3b", background: "rgba(0,0,0,.3)", color: "#cdbf9a", fontFamily: "inherit" };
    return (
      <div style={{ ...outer, overflowY: "auto", padding: "16px 12px" }}>
        <style>{CSS}</style>
        <div style={{ width: "100%", maxWidth: 780, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#ffd700", textShadow: "0 1px 3px #000" }}>
              🛠 构建牌组
              <span style={{ marginLeft: 10, fontSize: 14, color: full ? "#5ef08a" : "#d8c89a" }}>{deckSel.length}/30</span>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => setDeckSel([])} style={subBtn}>清空</button>
              <button onClick={randomFill} style={subBtn}>随机补满</button>
              <button
                onClick={saveDeck}
                disabled={!full}
                style={{ ...subBtn, fontWeight: 800, border: "2px solid " + (full ? "#f0d98c" : "#6b6452"), background: full ? "linear-gradient(180deg,#ffe08a,#c79a2e)" : "#4d4738", color: full ? "#4a3508" : "#9a937e", cursor: full ? "pointer" : "default" }}
              >
                保存牌组
              </button>
              <button onClick={() => setGame({ phase: "menu" })} style={subBtn}>返回</button>
            </div>
          </div>
          <div style={{ fontSize: 11, color: "#bfae84" }}>点击卡牌加入牌组(每种最多 2 张,传说卡每种最多 1 张),点击卡牌右下角 − 移除;选满 30 张后保存,对战时使用该牌组。</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12, paddingBottom: 20 }}>
            {[...POOL].sort((a, b) => a.cost - b.cost || a.id - b.id).map((c) => {
              const n = counts[c.id] || 0;
              const addable = !full && n < maxCopies(c);
              return (
                <div
                  key={c.id}
                  onClick={() => addCard(c.id)}
                  style={{ position: "relative", borderRadius: 10, padding: "12px 8px 12px", cursor: addable ? "pointer" : "default", textAlign: "center", background: c.type === "m" ? "linear-gradient(170deg,#7a5c33,#4a3517)" : "linear-gradient(170deg,#3d4f8a,#23284e)", border: n ? "2px solid #ffd700" : "2px solid " + (c.type === "m" ? "#caa45c" : "#7d90d8"), boxShadow: n ? "0 0 10px rgba(255,215,0,.3)" : "0 2px 5px rgba(0,0,0,.4)", opacity: addable || n ? 1 : 0.55 }}
                >
                  <span style={{ position: "absolute", top: -7, left: -7, width: 22, height: 22, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%,#9fd6ff,#1f63c4 60%,#0b3a7e)", border: "2px solid #cfe6ff", color: "#fff", fontSize: 12, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {c.cost}
                  </span>
                  {n > 0 && (
                    <span style={{ position: "absolute", top: -8, right: -6, background: "#ffd700", color: "#4a3508", borderRadius: 999, fontSize: 11, fontWeight: 900, padding: "1px 7px", border: "1px solid #fff3c4" }}>
                      ×{n}
                    </span>
                  )}
                  <div style={{ fontSize: 26 }}>{c.emoji}</div>
                  <div style={{ color: c.rarity === "c" ? "#ffe9b0" : RARITY[c.rarity].color, fontWeight: 800, fontSize: 13, textShadow: "0 1px 2px #000" }}>{c.name}</div>
                  <div style={{ color: RARITY[c.rarity].color, fontSize: 10, fontWeight: 800 }}>◆ {RARITY[c.rarity].label}</div>
                  <div style={{ color: "#9fd6ff", fontSize: 11, fontWeight: 700 }}>{c.type === "m" ? `${c.atk} 攻 / ${c.hp} 血` : spSummary(c.sp)}</div>
                  <div style={{ color: "#d8cdb2", fontSize: 10, marginTop: 2, lineHeight: 1.4 }}>{kw(c)}{c.desc}</div>
                  {n > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); removeCard(c.id); }}
                      style={{ position: "absolute", bottom: -9, right: -7, width: 24, height: 24, borderRadius: "50%", border: "1px solid #e08a7c", background: "#9c3328", color: "#fff", fontWeight: 900, fontSize: 14, cursor: "pointer", lineHeight: 1, fontFamily: "inherit" }}
                    >
                      −
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ---------- 对战界面 ----------
  return (
    <div style={outer}>
      <style>{CSS}</style>

      {/* 顶栏:敌方 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", background: "linear-gradient(180deg,#523c20,#3a2a14)", borderBottom: "2px solid #8a6d3b", gap: 8 }}>
        <HeroEl side="a" h={game.a} isT={isT} clickEntity={clickEntity} floats={floats} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
          <div style={{ display: "flex" }}>
            {Array.from({ length: Math.min(game.a.hand.length, HAND_LIMIT) }).map((_, i) => (
              <div key={i} style={{ width: 18, height: 26, marginLeft: i ? -7 : 0, borderRadius: 3, background: "linear-gradient(160deg,#5b3fa0,#2c1d52)", border: "1px solid #9d86d9" }} />
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "#7cc4ff", fontWeight: 800, fontSize: 13 }}>{game.a.mana}/{game.a.maxMana}</span>
            <div style={{ display: "flex", gap: 2 }}>
              {Array.from({ length: game.a.maxMana }).map((_, i) => (
                <span key={i} style={{ width: 11, height: 11, borderRadius: "50%", background: i < game.a.mana ? "radial-gradient(circle at 35% 30%,#9fd6ff,#1d6fd1 65%,#0c3e85)" : "#16314f", border: "1px solid #5c83ad", boxShadow: i < game.a.mana ? "0 0 5px #4da3ff" : "none" }} />
              ))}
            </div>
          </div>
          <span style={{ fontSize: 10, color: "#cdbf9a" }}>手牌 {game.a.hand.length} · 牌库 {game.a.deck.length}</span>
        </div>
      </div>

      {/* 战场 */}
      <div onClick={() => { setSelHand(null); setSelAtk(null); setInspect(null); setHovHand(null); setShowLog(false); }} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-evenly", padding: "4px 4px", minHeight: 230 }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 12, minHeight: 88, alignItems: "center", overflowX: "auto", padding: "10px 4px" }}>
          {game.a.board.length ? game.a.board.map((m) => <MinionEl key={m.uid} side="a" m={m} myTurn={myTurn} selAtk={selAtk} isT={isT} clickEntity={clickEntity} floats={floats} />) : <span style={{ color: "rgba(230,220,180,.25)", fontSize: 11, letterSpacing: 3 }}>— 敌 方 空 场 —</span>}
        </div>

        {/* 中线 */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 8px" }}>
          <span style={{ fontSize: 10, color: "#bfae84", whiteSpace: "nowrap" }}>回合 {Math.max(1, game.turnNum)}</span>
          <button
            onClick={(e) => { e.stopPropagation(); setShowLog((v) => !v); }}
            title="战斗记录"
            style={{ background: showLog ? "rgba(255,215,0,.18)" : "none", border: "1px solid #8a6d3b", borderRadius: 6, color: "#d8c89a", fontSize: 11, cursor: "pointer", padding: "2px 6px", fontFamily: "inherit", lineHeight: 1.4 }}
          >
            📜
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); if (!game.winner) setConfirmSurrender(true); }}
            title="认输"
            style={{ background: "none", border: "1px solid #8a6d3b", borderRadius: 6, color: "#d8c89a", fontSize: 11, cursor: "pointer", padding: "2px 6px", fontFamily: "inherit", lineHeight: 1.4 }}
          >
            🏳️
          </button>
          <span style={{ flex: 1, fontSize: 11, color: hint ? "#ffd966" : "#d8c89a", fontStyle: "italic", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {hint ? hint.t : game.lastLog}
          </span>
          <button
            onClick={endTurn}
            disabled={!myTurn}
            style={{ padding: "7px 13px", borderRadius: 999, fontWeight: 800, fontSize: 12, cursor: myTurn ? "pointer" : "default", border: "2px solid " + (myTurn ? "#f0d98c" : "#6b6452"), background: myTurn ? "linear-gradient(180deg,#ffe08a,#c79a2e)" : "#4d4738", color: myTurn ? "#4a3508" : "#9a937e", boxShadow: myTurn ? "0 0 10px rgba(255,215,0,.4)" : "none", whiteSpace: "nowrap", fontFamily: "inherit" }}
          >
            {myTurn ? "结束回合" : "对手回合…"}
          </button>
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: 12, minHeight: 88, alignItems: "center", overflowX: "auto", padding: "10px 4px" }}>
          {game.p.board.length ? game.p.board.map((m) => <MinionEl key={m.uid} side="p" m={m} myTurn={myTurn} selAtk={selAtk} isT={isT} clickEntity={clickEntity} floats={floats} />) : <span style={{ color: "rgba(230,220,180,.25)", fontSize: 11, letterSpacing: 3 }}>— 我 方 空 场 —</span>}
        </div>
      </div>

      {/* 卡牌 / 随从详情预览(选中、悬停或点击查看) */}
      {previewCard && (
        <div style={{ position: "absolute", bottom: 138, left: "50%", transform: "translateX(-50%)", zIndex: 70, pointerEvents: "none", width: 156, borderRadius: 12, padding: "10px 8px", background: previewCard.type === "m" ? "linear-gradient(170deg,#7a5c33,#3c2b12)" : "linear-gradient(170deg,#3d4f8a,#1d2244)", border: "2px solid #ffd700", boxShadow: "0 8px 24px rgba(0,0,0,.7)", textAlign: "center" }}>
          <div style={{ fontSize: 34 }}>{previewCard.emoji}</div>
          <div style={{ color: previewCard.rarity === "c" ? "#ffe9b0" : RARITY[previewCard.rarity].color, fontWeight: 800, fontSize: 14, textShadow: "0 1px 2px #000" }}>{previewCard.name}</div>
          <div style={{ color: RARITY[previewCard.rarity].color, fontSize: 10, fontWeight: 800 }}>◆ {RARITY[previewCard.rarity].label}</div>
          <div style={{ color: "#9fd6ff", fontSize: 11, fontWeight: 700 }}>
            {previewCard.cost} 费{previewCard.type === "m" ? ` · ${previewCard.atk} 攻 / ${previewCard.hp} 血` : ` · ${spSummary(previewCard.sp, game.p.spellDmg || 0)}`}
          </div>
          <div style={{ color: "#e8dcc0", fontSize: 11, marginTop: 3, lineHeight: 1.4 }}>
            {kw(previewCard)}{cardDesc(previewCard, game.p.spellDmg || 0)}
          </div>
          <div style={{ color: "#ffd700", fontSize: 10, marginTop: 5, fontStyle: "italic" }}>
            {previewCard !== selCard
              ? "点击卡牌选中"
              : previewCard.type === "m" || !(previewCard.sp.t === "any" || previewCard.sp.t === "fm")
              ? "再次点击卡牌打出"
              : "点击目标施放"}
          </div>
        </div>
      )}
      {inspectM && (
        <div style={{ position: "absolute", bottom: 138, left: "50%", transform: "translateX(-50%)", zIndex: 70, pointerEvents: "none", width: 156, borderRadius: 12, padding: "10px 8px", background: inspect.side === "p" ? "linear-gradient(170deg,#7a5c33,#3c2b12)" : "linear-gradient(170deg,#4a3354,#241a2c)", border: "2px solid " + (inspect.side === "p" ? "#c9a85a" : "#a06bc4"), boxShadow: "0 8px 24px rgba(0,0,0,.7)", textAlign: "center" }}>
          <div style={{ fontSize: 34 }}>{inspectM.emoji}</div>
          <div style={{ color: byId[inspectM.cid] && byId[inspectM.cid].rarity !== "c" ? RARITY[byId[inspectM.cid].rarity].color : "#ffe9b0", fontWeight: 800, fontSize: 14, textShadow: "0 1px 2px #000" }}>{inspectM.name}</div>
          {byId[inspectM.cid] && (
            <div style={{ color: RARITY[byId[inspectM.cid].rarity].color, fontSize: 10, fontWeight: 800 }}>◆ {RARITY[byId[inspectM.cid].rarity].label}</div>
          )}
          <div style={{ color: "#9fd6ff", fontSize: 11, fontWeight: 700 }}>
            {inspectM.atk} 攻 / {inspectM.hp}{inspectM.hp < inspectM.maxHp ? `/${inspectM.maxHp}` : ""} 血
          </div>
          <div style={{ color: "#e8dcc0", fontSize: 11, marginTop: 3, lineHeight: 1.4 }}>
            {kw(inspectM)}{byId[inspectM.cid] ? byId[inspectM.cid].desc : ""}
          </div>
          <div style={{ color: inspect.side === "p" ? "#c9a85a" : "#cf9aef", fontSize: 10, marginTop: 5, fontStyle: "italic" }}>
            {inspect.side === "p" ? "我方随从" : "敌方随从"} · 点击空白处关闭
          </div>
        </div>
      )}

      {/* 手牌 */}
      <div onMouseLeave={() => setHovHand(null)} style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", padding: "18px 6px 8px", minHeight: 108 }}>
        {game.p.hand.length ? game.p.hand.map((en, i) => <HandCard key={en.uid} en={en} i={i} selHand={selHand} mana={game.p.mana} myTurn={myTurn} handleHand={handleHand} setHovHand={setHovHand} cost={effCost(game, "p", byId[en.cid])} bonus={game.p.spellDmg || 0} />) : <span style={{ color: "#8a8468", fontSize: 12 }}>(手牌为空)</span>}
      </div>

      {/* 底栏:我方 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", background: "linear-gradient(0deg,#523c20,#3a2a14)", borderTop: "2px solid #8a6d3b", gap: 8 }}>
        <HeroEl side="p" h={game.p} isT={isT} clickEntity={clickEntity} floats={floats} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "#7cc4ff", fontWeight: 800, fontSize: 13 }}>{game.p.mana}/{game.p.maxMana}</span>
            <div style={{ display: "flex", gap: 2 }}>
              {Array.from({ length: game.p.maxMana }).map((_, i) => (
                <span key={i} style={{ width: 11, height: 11, borderRadius: "50%", background: i < game.p.mana ? "radial-gradient(circle at 35% 30%,#9fd6ff,#1d6fd1 65%,#0c3e85)" : "#16314f", border: "1px solid #5c83ad", boxShadow: i < game.p.mana ? "0 0 5px #4da3ff" : "none" }} />
              ))}
            </div>
          </div>
          <span style={{ fontSize: 10, color: "#cdbf9a" }}>牌库 {game.p.deck.length}</span>
        </div>
      </div>

      {/* 战斗记录面板 */}
      {showLog && (
        <div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: 150, width: "min(360px,92vw)", maxHeight: "42vh", display: "flex", flexDirection: "column", zIndex: 85, background: "rgba(20,15,7,.95)", border: "2px solid #8a6d3b", borderRadius: 12, padding: "8px 12px 10px", boxShadow: "0 8px 24px rgba(0,0,0,.7)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, flexShrink: 0 }}>
            <span style={{ color: "#ffd700", fontSize: 12, fontWeight: 800 }}>📜 战斗记录</span>
            <button onClick={() => setShowLog(false)} style={{ background: "none", border: "none", color: "#cdbf9a", fontSize: 14, cursor: "pointer", padding: "0 2px", fontFamily: "inherit" }}>✕</button>
          </div>
          <div style={{ overflowY: "auto" }}>
            {(game.logs || []).slice().reverse().map((l) => (
              <div key={l.id} style={{ fontSize: 11, lineHeight: 1.7, color: l.important ? "#ffb04d" : "#d8c89a", borderBottom: "1px solid rgba(138,109,59,.25)" }}>
                <span style={{ color: "#8f8568", marginRight: 6 }}>回合{l.turn}</span>
                {l.text}
              </div>
            ))}
            {!(game.logs || []).length && <div style={{ color: "#8f8568", fontSize: 11 }}>暂无记录</div>}
          </div>
        </div>
      )}

      {/* 烧牌 / 疲劳等重要事件提示 */}
      {game.notice && (
        <div key={game.notice.id} style={{ position: "absolute", top: "34%", left: 0, right: 0, display: "flex", justifyContent: "center", pointerEvents: "none", zIndex: 82 }}>
          <span style={{ background: "rgba(112,32,12,.92)", border: "1px solid #ff9a5c", color: "#ffe2c4", padding: "7px 18px", borderRadius: 999, fontSize: 13, fontWeight: 700, boxShadow: "0 4px 14px rgba(0,0,0,.6)", animation: "noticeFx 2.6s ease forwards", maxWidth: "88vw", textAlign: "center" }}>
            {game.notice.text}
          </span>
        </div>
      )}

      {/* 抉择弹窗 */}
      {game.pending && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(8,6,2,.78)", zIndex: 86, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 20 }}>
          <div style={{ fontSize: 19, fontWeight: 900, color: "#ffd700", textShadow: "0 0 14px rgba(255,200,0,.6)", letterSpacing: 2, textAlign: "center" }}>
            {game.pending.k === "camp"
              ? `🏕️ 星夜露宿 — 抉择(剩余 ${game.pending.remaining} 次)`
              : game.pending.k === "bloomMode"
              ? "🌺 夜影花蕾 — 抉择"
              : game.pending.k === "choose"
              ? `${game.pending.emoji} ${game.pending.name} — 抉择`
              : game.pending.k === "moonPick"
              ? "🌙 月光指引 — 发现一张牌,获得其复制"
              : `🌺 夜影花蕾 — ${game.pending.mode === "m" ? "选择一个随从召唤" : "选择一个法术施放"}`}
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
            {game.pending.k === "bloomMode" &&
              (() => {
                const mOk = game.p.board.length < 6 && game.p.deck.some((cid) => byId[cid].type === "m");
                const sOk = game.p.deck.some((cid) => byId[cid].type === "s");
                return [
                  { id: "m", ok: mOk, emoji: "⚔️", title: "召唤随从", desc: "从牌库随机 3 张随从牌中选 1 张召唤", off: !mOk && (game.p.board.length >= 6 ? "随从区已满" : "牌库中没有随从牌") },
                  { id: "s", ok: sOk, emoji: "📜", title: "释放法术", desc: "从牌库随机 3 张法术牌中选 1 张施放", off: !sOk && "牌库中没有可施放的法术牌" },
                ].map((o) => (
                  <div
                    key={o.id}
                    onClick={() => { if (o.ok) pickBloomMode(o.id); }}
                    style={{ width: 160, borderRadius: 12, padding: "16px 12px", cursor: o.ok ? "pointer" : "default", textAlign: "center", background: "linear-gradient(170deg,#4a3354,#241a2c)", border: "2px solid " + (o.ok ? "#ffd700" : "#5a5248"), boxShadow: o.ok ? "0 0 14px rgba(255,215,0,.35)" : "none", opacity: o.ok ? 1 : 0.5 }}
                  >
                    <div style={{ fontSize: 32 }}>{o.emoji}</div>
                    <div style={{ color: "#ffe9b0", fontWeight: 800, fontSize: 14, margin: "4px 0" }}>{o.title}</div>
                    <div style={{ color: "#d8cdb2", fontSize: 11, lineHeight: 1.5 }}>{o.ok ? o.desc : o.off}</div>
                  </div>
                ));
              })()}
            {(game.pending.k === "bloomPick" || game.pending.k === "moonPick") &&
              game.pending.opts.map((cid, idx) => {
                const c = byId[cid];
                const pick = game.pending.k === "moonPick" ? pickMoon : pickBloomCard;
                return (
                  <div
                    key={idx}
                    onClick={() => pick(idx)}
                    style={{ position: "relative", width: 148, borderRadius: 12, padding: "14px 10px", cursor: "pointer", textAlign: "center", background: c.type === "m" ? "linear-gradient(170deg,#7a5c33,#3c2b12)" : "linear-gradient(170deg,#3d4f8a,#1d2244)", border: "2px solid #ffd700", boxShadow: "0 0 14px rgba(255,215,0,.35)" }}
                  >
                    <span style={{ position: "absolute", top: -8, left: -8, width: 24, height: 24, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%,#9fd6ff,#1f63c4 60%,#0b3a7e)", border: "2px solid #cfe6ff", color: "#fff", fontSize: 12, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {c.cost}
                    </span>
                    <div style={{ fontSize: 32 }}>{c.emoji}</div>
                    <div style={{ color: "#ffe9b0", fontWeight: 800, fontSize: 14 }}>{c.name}</div>
                    <div style={{ color: "#9fd6ff", fontSize: 11, fontWeight: 700 }}>{c.type === "m" ? `${c.atk} 攻 / ${c.hp} 血` : spSummary(c.sp, game.p.spellDmg || 0)}</div>
                    <div style={{ color: "#d8cdb2", fontSize: 10, marginTop: 3, lineHeight: 1.4 }}>{kw(c)}{cardDesc(c, game.p.spellDmg || 0)}</div>
                  </div>
                );
              })}
            {game.pending.k === "choose" &&
              game.pending.opts.map((o, idx) => (
                <div
                  key={idx}
                  onClick={() => pickChoose(idx)}
                  style={{ width: 150, borderRadius: 12, padding: "16px 12px", cursor: "pointer", textAlign: "center", background: "linear-gradient(170deg,#33475a,#1a2630)", border: "2px solid #ffd700", boxShadow: "0 0 14px rgba(255,215,0,.35)" }}
                >
                  <div style={{ fontSize: 32 }}>{o.emoji}</div>
                  <div style={{ color: "#ffe9b0", fontWeight: 800, fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>{o.label}</div>
                </div>
              ))}
            {game.pending.k === "camp" &&
              [
                { o: "mana", emoji: "💎", title: "回复法力", desc: "回复 3 个法力水晶" },
                { o: "draw", emoji: "🃏", title: "抽牌", desc: "抽两张牌" },
                { o: "armor", emoji: "🛡️", title: "护甲", desc: "获得 5 点护甲" },
              ].map((x) => (
                <div
                  key={x.o}
                  onClick={() => pickCamp(x.o)}
                  style={{ width: 130, borderRadius: 12, padding: "16px 12px", cursor: "pointer", textAlign: "center", background: "linear-gradient(170deg,#33475a,#1a2630)", border: "2px solid #ffd700", boxShadow: "0 0 14px rgba(255,215,0,.35)" }}
                >
                  <div style={{ fontSize: 32 }}>{x.emoji}</div>
                  <div style={{ color: "#ffe9b0", fontWeight: 800, fontSize: 14, margin: "4px 0" }}>{x.title}</div>
                  <div style={{ color: "#d8cdb2", fontSize: 11 }}>{x.desc}</div>
                </div>
              ))}
          </div>
          {game.pending.k === "choose" || game.pending.k === "bloomMode" ? (
            <button onClick={cancelPending} style={{ padding: "8px 22px", borderRadius: 999, fontWeight: 700, fontSize: 13, cursor: "pointer", border: "1px solid #8a6d3b", background: "rgba(0,0,0,.45)", color: "#cdbf9a", fontFamily: "inherit" }}>
              ↩ 取消(不消耗费用)
            </button>
          ) : (
            <div style={{ color: "#bfae84", fontSize: 11 }}>必须完成抉择才能继续</div>
          )}
        </div>
      )}

      {/* 认输确认 */}
      {confirmSurrender && game.phase === "play" && !game.winner && (
        <div onClick={() => setConfirmSurrender(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 88, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "linear-gradient(170deg,#3a2a14,#241a0a)", border: "2px solid #8a6d3b", borderRadius: 14, padding: "20px 26px", textAlign: "center", maxWidth: 280, boxShadow: "0 8px 24px rgba(0,0,0,.7)" }}>
            <div style={{ fontSize: 32 }}>🏳️</div>
            <div style={{ color: "#f4e6c1", fontSize: 15, fontWeight: 800, margin: "8px 0 4px" }}>确定要认输吗?</div>
            <div style={{ color: "#bfae84", fontSize: 12, marginBottom: 16 }}>本局将立即判负并结束对战</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={surrender} style={{ padding: "8px 20px", borderRadius: 999, fontWeight: 800, fontSize: 13, cursor: "pointer", border: "2px solid #e08a7c", background: "linear-gradient(180deg,#d96a58,#9c3328)", color: "#fff", fontFamily: "inherit" }}>
                认输
              </button>
              <button onClick={() => setConfirmSurrender(false)} style={{ padding: "8px 20px", borderRadius: 999, fontWeight: 800, fontSize: 13, cursor: "pointer", border: "1px solid #8a6d3b", background: "none", color: "#cdbf9a", fontFamily: "inherit" }}>
                继续对战
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 回合横幅 */}
      {game.banner && (
        <div key={game.banner.id} style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 80 }}>
          <span style={{ fontSize: 34, fontWeight: 900, color: "#ffd700", textShadow: "0 0 20px rgba(255,200,0,.9),0 2px 4px #000", animation: "banner 1.6s ease forwards", letterSpacing: 6 }}>
            {game.banner.text}
          </span>
        </div>
      )}

      {/* 结算 */}
      {game.phase === "over" && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.8)", zIndex: 90, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 20 }}>
          <span style={{ fontSize: 60 }}>{game.winner === "p" ? "🏆" : game.surrendered ? "🏳️" : "💀"}</span>
          <span style={{ fontSize: 36, fontWeight: 900, color: game.winner === "p" ? "#ffd700" : "#b9b9c9", textShadow: "0 2px 8px #000", letterSpacing: 10 }}>
            {game.winner === "p" ? "胜 利" : "战 败"}
          </span>
          <span style={{ color: "#cbbd96", fontSize: 13, textAlign: "center" }}>
            {game.winner === "p" ? "死灵领主被击败了!王国恢复了和平。" : game.surrendered ? "你选择了认输……重整旗鼓,下次再战!" : "圣辉骑士倒下了……下次再战!"}
            <br />(共进行 {game.turnNum} 个回合)
          </span>
          <button onClick={start} style={goldBtn}>再 来 一 局</button>
          <button onClick={() => setGame({ phase: "menu" })} style={{ background: "none", border: "1px solid #8a6d3b", borderRadius: 999, color: "#cdbf9a", padding: "8px 20px", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            返回主菜单
          </button>
        </div>
      )}
    </div>
  );
}
