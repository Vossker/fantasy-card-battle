// ================= 全局类型定义 =================

export type Side = "p" | "a";
export type Rarity = "c" | "r" | "e" | "l";
export type SpellTargetKind = "any" | "fm";
export type BloomMode = "m" | "s";
export type CampOpt = "mana" | "draw" | "armor";

export interface ChooseOpt {
  fx: "draw" | "manaEmpty" | "manaFull";
  n: number;
  emoji: string;
  label: string;
}

// sp.k 的 discriminated union:新增效果种类后,漏掉某条分发路径会直接成为编译错误
export type SpellDef =
  | { k: "dmg"; n: number; t: "any"; draw?: number; armor?: number; summon?: number }
  | { k: "aoe"; n: number }
  | { k: "heal"; n: number; t: "any" }
  | { k: "buff"; a: number; h: number; t: "fm" }
  | { k: "draw"; n: number }
  | { k: "coin" }
  | { k: "bio" }
  | { k: "obelisk" }
  | { k: "choose"; opts: ChooseOpt[] }
  | { k: "camp" }
  | { k: "bloom" }
  | { k: "moonlight" };

interface CardBase {
  id: number;
  name: string;
  emoji: string;
  cost: number;
  rarity: Rarity;
  desc: string;
  token?: 1;
}

// 互斥字段声明为 `?: undefined`,这样在 Card 上可以直接访问 c.sp / c.atk 而无需先收窄
export interface MinionCard extends CardBase {
  type: "m";
  atk: number;
  hp: number;
  taunt?: 1;
  charge?: 1;
  aura?: "cheapSpells";
  bc?: { k: "summonMini" };
  sp?: undefined;
}

export interface SpellCard extends CardBase {
  type: "s";
  sp: SpellDef;
  atk?: undefined;
  hp?: undefined;
  taunt?: undefined;
  charge?: undefined;
  aura?: undefined;
  bc?: undefined;
}

export type Card = MinionCard | SpellCard;

export interface HandEntry {
  uid: number;
  cid: number;
  moon?: number; // 月光指引复制:记录获得复制的回合号
}

export interface Minion {
  uid: number;
  cid: number;
  name: string;
  emoji: string;
  atk: number;
  hp: number;
  maxHp: number;
  taunt: boolean;
  charge: boolean;
  sick: boolean;
  attacked: boolean;
}

export interface SideState {
  hp: number;
  armor: number;
  mana: number;
  maxMana: number;
  fatigue: number;
  spellDmg: number; // 法伤加成,仅持续当前回合(startTurn 时双方清零)
  deck: number[];
  hand: HandEntry[];
  board: Minion[];
}

export interface FloatFx {
  id: number;
  key: string;
  text: string;
  color: string;
  ts: number;
}

export interface LogEntry {
  id: number;
  turn: number;
  text: string;
  important: boolean;
}

// 抉择弹窗。choose / bloomMode 为延迟支付(存手牌索引 i,确认时才扣费离手,可取消);
// 其余在进入弹窗前已支付,不可取消
export type Pending =
  | { k: "choose"; i: number; name: string; emoji: string; opts: ChooseOpt[] }
  | { k: "bloomMode"; i: number }
  | { k: "bloomPick"; mode: BloomMode; opts: number[] }
  | { k: "moonPick"; opts: number[] }
  | { k: "camp"; remaining: number };

export interface SpellTarget {
  side: Side;
  uid?: number;
  hero?: boolean;
}

export interface AttackTarget {
  uid?: number;
  hero?: boolean;
}

export interface GameState {
  phase: "play" | "over";
  turn: Side;
  first: Side;
  turnNum: number;
  winner: Side | null;
  surrendered?: boolean;
  rngState: number; // 可复现 PRNG 状态(mulberry32 的 uint32 种子);只存数字以保证 JSON 克隆安全
  fx: FloatFx[];
  logs: LogEntry[];
  lastLog: string;
  notice: { text: string; id: number } | null;
  pending: Pending | null;
  banner: { text: string; id: number } | null;
  p: SideState;
  a: SideState;
}
