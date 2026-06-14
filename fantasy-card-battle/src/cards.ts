// ================= 卡牌数据(全部原创)与卡面展示辅助 =================
import type { Card, ClassId, Rarity, SpellDef, SpellTargetKind } from "./types";

// 职业元数据:名称、徽记、英雄技能(英雄技能行为在 engine.useHeroPower 中实现)
export const CLASS_IDS: ClassId[] = ["druid", "rogue"];
export const CLASS_META: Record<ClassId, { name: string; emoji: string; power: { name: string; emoji: string; desc: string } }> = {
  druid: { name: "德鲁伊", emoji: "🐻", power: { name: "变形", emoji: "🐾", desc: "获得 1 点护甲和 1 点攻击力(仅当回合)" } },
  rogue: { name: "潜行者", emoji: "🥷", power: { name: "暗影双匕", emoji: "⚔️", desc: "装备一把 1 攻击力 / 2 耐久的匕首" } },
};
export const HERO_POWER_COST = 2; // 英雄技能统一消耗 2 法力,每回合限用一次
export const cardClasses = (c: Card): ClassId[] => c.classes ?? [];
export const isNeutral = (c: Card): boolean => !c.classes || c.classes.length === 0;
// 某张牌能否被某职业选用:中立牌或归属该职业
export const cardInClass = (c: Card, cls: ClassId): boolean => isNeutral(c) || c.classes!.includes(cls);

export const POOL: Card[] = [
  { id: 1, name: "农夫民兵", emoji: "👨‍🌾", cost: 1, type: "m", rarity: "c", atk: 2, hp: 1, desc: "拿起草叉保卫家园。" },
  { id: 2, name: "新兵盾卫", emoji: "🛡️", cost: 1, type: "m", rarity: "c", atk: 1, hp: 2, taunt: 1, desc: "我来挡!" },
  { id: 3, name: "灵猫", emoji: "🐈", cost: 1, type: "m", rarity: "c", atk: 1, hp: 1, charge: 1, desc: "敏捷如风。" },
  { id: 4, name: "见习法师", emoji: "🧙", cost: 2, type: "m", rarity: "c", atk: 3, hp: 2, desc: "刚学会第一个法术。" },
  { id: 5, name: "矮人战士", emoji: "🪓", cost: 2, type: "m", rarity: "c", atk: 2, hp: 3, desc: "山岭之子。" },
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
  { id: 20, name: "寒冰箭", emoji: "❄️", cost: 2, type: "s", rarity: "c", sp: { k: "dmg", n: 3, t: "any", freeze: 1 }, desc: "造成 3 点伤害,并使其冻结。" },
  { id: 21, name: "治疗之光", emoji: "✨", cost: 2, type: "s", rarity: "c", sp: { k: "heal", n: 6, t: "any" }, desc: "恢复 6 点生命值。" },
  { id: 22, name: "奥术智慧", emoji: "📜", cost: 3, type: "s", rarity: "r", sp: { k: "draw", n: 2 }, desc: "抽两张牌。" },
  { id: 23, name: "神圣新星", emoji: "🌟", cost: 3, type: "s", rarity: "r", sp: { k: "aoe", n: 2 }, desc: "对所有敌方随从造成 2 点伤害。" },
  { id: 24, name: "王者祝福", emoji: "👑", cost: 4, type: "s", rarity: "r", sp: { k: "buff", a: 3, h: 3, t: "fm" }, desc: "使一个友方随从 +3/+3。" },
  { id: 25, name: "火球术", emoji: "☄️", cost: 4, type: "s", rarity: "r", sp: { k: "dmg", n: 6, t: "any" }, desc: "造成 6 点伤害。" },
  { id: 26, name: "烈焰风暴", emoji: "🌋", cost: 6, type: "s", rarity: "e", sp: { k: "aoe", n: 4 }, desc: "对所有敌方随从造成 4 点伤害。" },
  { id: 27, name: "伊谢尔·风歌", emoji: "🧝‍♀️", cost: 9, type: "m", rarity: "l", classes: ["druid"], atk: 5, hp: 5, aura: "cheapSpells", desc: "本随从在场时,你的所有法术牌费用变为(1)点。" },
  { id: 28, name: "夜影花蕾", emoji: "🌺", cost: 8, type: "s", rarity: "e", classes: ["druid"], sp: { k: "bloom" }, desc: "【抉择】从你的牌库随机 3 张随从牌中选 1 张召唤;或从随机 3 张法术牌中选 1 张施放。" },
  { id: 29, name: "星夜露宿", emoji: "🏕️", cost: 8, type: "s", rarity: "e", classes: ["druid"], sp: { k: "camp" }, desc: "【抉择三次】回复 3 个法力水晶;或抽两张牌;或获得 5 点护甲。" },
  { id: 30, name: "星火术", emoji: "💫", cost: 6, type: "s", rarity: "r", classes: ["druid"], sp: { k: "dmg", n: 5, t: "any", draw: 1 }, desc: "造成 5 点伤害,抽一张牌。" },
  { id: 31, name: "鼓舞", emoji: "📯", cost: 2, type: "s", rarity: "c", classes: ["druid"], sp: { k: "choose", opts: [{ fx: "draw", n: 1, emoji: "🃏", label: "抽一张牌" }, { fx: "manaEmpty", n: 1, emoji: "💠", label: "获得 1 个空的法力水晶" }] }, desc: "【抉择】抽一张牌;或获得 1 个空的法力水晶。" },
  { id: 32, name: "滋养", emoji: "🌿", cost: 5, type: "s", rarity: "r", classes: ["druid"], sp: { k: "choose", opts: [{ fx: "draw", n: 3, emoji: "🃏", label: "抽三张牌" }, { fx: "manaFull", n: 2, emoji: "💎", label: "获得 2 个法力水晶" }] }, desc: "【抉择】抽三张牌;或获得 2 个法力水晶。" },
  { id: 33, name: "生物计划", emoji: "🧬", cost: 1, type: "s", rarity: "e", classes: ["druid"], sp: { k: "bio" }, desc: "双方各获得 2 个法力水晶。" },
  { id: 34, name: "终极感染", emoji: "🦠", cost: 10, type: "s", rarity: "e", classes: ["druid"], sp: { k: "dmg", n: 5, t: "any", draw: 5, armor: 5, summon: 98 }, desc: "造成 5 点伤害,抽五张牌,获得 5 点护甲值,召唤一个 5/5 的食尸鬼。" },
  { id: 35, name: "月光指引", emoji: "🌙", cost: 2, type: "s", rarity: "r", classes: ["druid"], sp: { k: "moonlight" }, desc: "【发现】你牌库中的一张牌,获得其复制;如果你在本回合打出该复制,则从牌库抽取本体。" },
  { id: 36, name: "魔法方碑", emoji: "🧿", cost: 1, type: "s", rarity: "r", sp: { k: "obelisk" }, desc: "本回合内,你的所有法术造成的伤害加 1。" },
  { id: 37, name: "巴内斯", emoji: "🎭", cost: 5, type: "m", rarity: "l", atk: 3, hp: 4, bc: { k: "summonMini" }, desc: "【战吼】从你的牌库中随机召唤一个随从,其攻击力和生命值变为 1。" },
  { id: 38, name: "伺机待发", emoji: "⏳", cost: 0, type: "s", rarity: "e", classes: ["rogue"], sp: { k: "ready" }, desc: "你使用的下一张法术牌费用减少 2 点(仅本回合)。" },
  { id: 39, name: "秘密通道", emoji: "🚪", cost: 2, type: "s", rarity: "e", classes: ["rogue"], sp: { k: "passage" }, desc: "将你的手牌替换为牌库中随机 4 张牌,回合结束时换回。" },
  { id: 40, name: "换挡漂移", emoji: "🏎️", cost: 1, type: "s", rarity: "r", classes: ["rogue"], sp: { k: "shuffleDraw", back: 2, draw: 3 }, desc: "将你手牌最左侧的 2 张牌洗回牌库,抽 3 张牌。" },
  { id: 41, name: "街舞起跳", emoji: "🕺", cost: 1, type: "s", rarity: "e", classes: ["rogue"], sp: { k: "bounce", t: "fm" }, desc: "将一个友方随从移回手牌,并召唤一个具有相同属性值的「舞者」。" },
  { id: 42, name: "殒命暗影", emoji: "🌑", cost: 0, type: "s", rarity: "l", classes: ["rogue"], sp: { k: "shadow" }, desc: "该牌会变成你打出的上一张法术牌的复制。" },
  { id: 43, name: "暗影之门", emoji: "🌀", cost: 1, type: "s", rarity: "r", classes: ["rogue"], sp: { k: "spelldraw" }, desc: "从你的牌库中随机抽一张法术牌。" },
  { id: 44, name: "伪造的幸运币", emoji: "🪙", cost: 0, type: "s", rarity: "r", classes: ["rogue"], sp: { k: "coin" }, desc: "在本回合中获得一个法力水晶。" },
  { id: 45, name: "奥术巨人", emoji: "🔮", cost: 12, type: "m", rarity: "e", atk: 8, hp: 8, costScale: "spellsPlayed", desc: "在本局对战中你每使用过一张法术牌,本随从的法力消耗减少 1 点。" },
  { id: 46, name: "暗影步", emoji: "👣", cost: 0, type: "s", rarity: "r", classes: ["rogue"], sp: { k: "shadowstep", t: "fm" }, desc: "将一个友方随从移回手牌,其法力消耗减少 2 点。" },
  { id: 47, name: "垂钓时光", emoji: "🎣", cost: 1, type: "s", rarity: "r", classes: ["rogue"], sp: { k: "dredge", comboDraw: 1 }, desc: "探底。连击:抽取这张牌。" },
  { id: 48, name: "异教地图", emoji: "🗺️", cost: 2, type: "s", rarity: "r", classes: ["rogue"], sp: { k: "map" }, desc: "从牌库中发现一张牌并抽取;如果你在本回合使用这张牌,则从剩余选项中选一张牌并抽取。" },
  { id: 49, name: "鬼魅攻击", emoji: "👻", cost: 1, type: "s", rarity: "r", classes: ["rogue"], sp: { k: "dmg", n: 1, t: "any", comboDraw: 1 }, desc: "造成 1 点伤害。连击:抽一张牌。" },
  { id: 50, name: "贪婪的伴侣", emoji: "🐀", cost: 2, type: "m", rarity: "r", atk: 2, hp: 3, bc: { k: "greedyCoin" }, desc: "【战吼】如果你手牌中有其他 2 费牌,获得一张幸运币。" },
  { id: 51, name: "洛欧塞布", emoji: "🦠", cost: 5, type: "m", rarity: "l", atk: 5, hp: 5, bc: { k: "loatheb" }, desc: "【战吼】你的对手下个回合法术的法力消耗增加 5 点。" },
  { id: 52, name: "炽炎战斧", emoji: "🪓", cost: 3, type: "w", rarity: "c", atk: 3, dur: 2, desc: "为你的英雄装备一把 3 攻击力 / 2 耐久的战斧。" },
];
// token 衍生牌:不进 POOL(不出现在牌组构建器),单独注册进 byId
export const COIN: Card = { id: 99, name: "幸运币", emoji: "🪙", cost: 0, type: "s", rarity: "c", sp: { k: "coin" }, token: 1, desc: "在本回合获得一个法力水晶。" };
export const GHOUL: Card = { id: 98, name: "食尸鬼", emoji: "🧟", cost: 5, type: "m", rarity: "c", atk: 5, hp: 5, token: 1, desc: "由「终极感染」召唤。" };
// 舞者:由「街舞起跳」召唤,攻/血在召唤时继承自被弹回的随从(此处 atk/hp 仅占位)
export const DANCER: Card = { id: 97, name: "舞者", emoji: "💃", cost: 0, type: "m", rarity: "c", atk: 0, hp: 0, rush: 1, token: 1, inheritStats: 1, desc: "由「街舞起跳」召唤,属性继承自被移回手牌的随从。" };
// 匕首:由潜行者英雄技能「暗影匕首」装备的 token 武器(不进 POOL)
export const DAGGER: Card = { id: 96, name: "匕首", emoji: "🔪", cost: 2, type: "w", rarity: "c", atk: 1, dur: 2, token: 1, desc: "由「暗影匕首」装备。" };
export const RARITY: Record<Rarity, { label: string; color: string }> = {
  c: { label: "普通", color: "#cfd6dd" },
  r: { label: "稀有", color: "#4da3ff" },
  e: { label: "史诗", color: "#c478f0" },
  l: { label: "传说", color: "#ffa726" },
};
export const maxCopies = (c: Card) => (c.rarity === "l" ? 1 : 2);
export const byId: Record<number, Card> = {};
POOL.forEach((c) => (byId[c.id] = c));
byId[COIN.id] = COIN;
byId[GHOUL.id] = GHOUL;
byId[DANCER.id] = DANCER;
byId[DAGGER.id] = DAGGER;
export const HAND_LIMIT = 10; // 手牌上限,超出时抽到的牌会被烧掉

export const kw = (c: { taunt?: boolean | 1; charge?: boolean | 1; rush?: boolean | 1 }) =>
  `${c.taunt ? "【嘲讽】" : ""}${c.charge ? "【冲锋】" : ""}${c.rush ? "【突袭】" : ""}`;

// 法术的目标类型:"any" 任意角色 / "fm" 友方随从 / undefined 无目标
export const spTarget = (sp?: SpellDef): SpellTargetKind | undefined => (sp && "t" in sp ? sp.t : undefined);

// spSummary 已迁至 engine.ts,与效果注册表(EFFECTS)共用同一处定义,避免"加一张卡两处改"。
// 法伤加成生效时,牌面描述中的伤害数字改为 * n * 形式(如 +1 法伤的闪电箭显示"造成* 3 *点伤害")
export const cardDesc = (c: Card, bonus = 0) =>
  c.sp && bonus > 0 && (c.sp.k === "dmg" || c.sp.k === "aoe")
    ? c.desc.replace(` ${c.sp.n} 点伤害`, `* ${c.sp.n + bonus} *点伤害`)
    : c.desc;

// rng 默认 Math.random;引擎调用时注入基于 st.rngState 的可复现 PRNG(见 engine.rand)
export function shuffle<T>(deck: T[], rng: () => number = Math.random): T[] {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
// 按职业随机生成 30 张牌组:只取该职业可用的牌(中立 + 本职业)。cls 缺省回退到全部 POOL。
export function buildDeck(rng: () => number = Math.random, cls?: ClassId): number[] {
  const pool = cls ? POOL.filter((c) => cardInClass(c, cls)) : POOL;
  const counts: Record<number, number> = {};
  const deck: number[] = [];
  while (deck.length < 30) {
    const c = pool[Math.floor(rng() * pool.length)];
    if ((counts[c.id] || 0) >= maxCopies(c)) continue;
    counts[c.id] = (counts[c.id] || 0) + 1;
    deck.push(c.id);
  }
  return shuffle(deck, rng);
}
export function loadPlayerDeck(): number[] | null {
  try {
    const d = JSON.parse(localStorage.getItem("arcane-deck") || "null");
    if (!Array.isArray(d) || d.length !== 30) return null;
    const counts: Record<number, number> = {};
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

// ================= 多牌组管理(我的牌组,上限 9) =================
export interface SavedDeck {
  id: string;
  name: string;
  classId: ClassId; // 牌组绑定的职业
  cards: number[]; // 可不足 30 张(预览中移除卡牌后即为未完成),仅 30 张时可用于对战
}
export const MAX_DECKS = 9;
const DECKS_KEY = "arcane-decks";
const ACTIVE_KEY = "arcane-active-deck";

export const genDeckId = (): string => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// 校验一副牌组的卡牌组成:不含 token、每种不超出上限、总数 ≤ 30、且全部为该职业可用(中立/本职业)。
// 合法返回净化后的数组,否则 null。
function validDeckCards(d: unknown, cls: ClassId): number[] | null {
  if (!Array.isArray(d) || d.length > 30) return null;
  const counts: Record<number, number> = {};
  for (const id of d) {
    const c = byId[id];
    if (!c || c.token || !cardInClass(c, cls)) return null;
    counts[id] = (counts[id] || 0) + 1;
    if (counts[id] > maxCopies(c)) return null;
  }
  return d as number[];
}
const isClassId = (x: unknown): x is ClassId => x === "druid" || x === "rogue";

export function saveDecks(decks: SavedDeck[]): void {
  try { localStorage.setItem(DECKS_KEY, JSON.stringify(decks)); } catch {}
}

export function loadDecks(): SavedDeck[] {
  try {
    const raw = JSON.parse(localStorage.getItem(DECKS_KEY) || "null");
    if (Array.isArray(raw)) {
      const decks: SavedDeck[] = [];
      for (const x of raw) {
        if (!x || typeof x.id !== "string" || typeof x.name !== "string" || !isClassId(x.classId)) continue;
        const cards = validDeckCards(x.cards, x.classId);
        if (!cards) continue;
        decks.push({ id: x.id, name: x.name, classId: x.classId, cards });
        if (decks.length >= MAX_DECKS) break;
      }
      return decks;
    }
    // 旧版牌组(无职业字段)在引入职业系统后一律作废,不再迁移。
  } catch {}
  return [];
}

export function loadActiveDeckId(): string | null {
  try { return localStorage.getItem(ACTIVE_KEY); } catch { return null; }
}
export function saveActiveDeckId(id: string | null): void {
  try { id ? localStorage.setItem(ACTIVE_KEY, id) : localStorage.removeItem(ACTIVE_KEY); } catch {}
}
