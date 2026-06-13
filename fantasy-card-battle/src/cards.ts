// ================= 卡牌数据(全部原创)与卡面展示辅助 =================
import type { Card, Rarity, SpellDef, SpellTargetKind } from "./types";

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
// token 衍生牌:不进 POOL(不出现在牌组构建器),单独注册进 byId
export const COIN: Card = { id: 99, name: "幸运币", emoji: "🪙", cost: 0, type: "s", rarity: "c", sp: { k: "coin" }, token: 1, desc: "在本回合获得一个法力水晶。" };
export const GHOUL: Card = { id: 98, name: "食尸鬼", emoji: "🧟", cost: 5, type: "m", rarity: "c", atk: 5, hp: 5, token: 1, desc: "由「终极感染」召唤。" };
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
export const HAND_LIMIT = 10; // 手牌上限,超出时抽到的牌会被烧掉

export const kw = (c: { taunt?: boolean | 1; charge?: boolean | 1 }) =>
  `${c.taunt ? "【嘲讽】" : ""}${c.charge ? "【冲锋】" : ""}`;

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
export function buildDeck(rng: () => number = Math.random): number[] {
  const counts: Record<number, number> = {};
  const deck: number[] = [];
  while (deck.length < 30) {
    const c = POOL[Math.floor(rng() * POOL.length)];
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
  cards: number[]; // 可不足 30 张(预览中移除卡牌后即为未完成),仅 30 张时可用于对战
}
export const MAX_DECKS = 9;
const DECKS_KEY = "arcane-decks";
const ACTIVE_KEY = "arcane-active-deck";

export const genDeckId = (): string => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// 校验一副牌组的卡牌组成:不含 token、每种不超出上限、总数 ≤ 30。合法返回净化后的数组,否则 null
function validDeckCards(d: unknown): number[] | null {
  if (!Array.isArray(d) || d.length > 30) return null;
  const counts: Record<number, number> = {};
  for (const id of d) {
    const c = byId[id];
    if (!c || c.token) return null;
    counts[id] = (counts[id] || 0) + 1;
    if (counts[id] > maxCopies(c)) return null;
  }
  return d as number[];
}

export function saveDecks(decks: SavedDeck[]): void {
  try { localStorage.setItem(DECKS_KEY, JSON.stringify(decks)); } catch {}
}

export function loadDecks(): SavedDeck[] {
  try {
    const raw = JSON.parse(localStorage.getItem(DECKS_KEY) || "null");
    if (Array.isArray(raw)) {
      const decks: SavedDeck[] = [];
      for (const x of raw) {
        if (!x || typeof x.id !== "string" || typeof x.name !== "string") continue;
        const cards = validDeckCards(x.cards);
        if (!cards) continue;
        decks.push({ id: x.id, name: x.name, cards });
        if (decks.length >= MAX_DECKS) break;
      }
      return decks;
    }
    // 旧版只存一副牌组(arcane-deck),迁移为列表中的第一副并设为激活
    const old = loadPlayerDeck();
    if (old) {
      const d: SavedDeck = { id: genDeckId(), name: "我的牌组", cards: old };
      saveDecks([d]);
      try { localStorage.setItem(ACTIVE_KEY, d.id); } catch {}
      return [d];
    }
  } catch {}
  return [];
}

export function loadActiveDeckId(): string | null {
  try { return localStorage.getItem(ACTIVE_KEY); } catch { return null; }
}
export function saveActiveDeckId(id: string | null): void {
  try { id ? localStorage.setItem(ACTIVE_KEY, id) : localStorage.removeItem(ACTIVE_KEY); } catch {}
}
