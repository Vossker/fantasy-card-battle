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
  | { k: "moonlight" }
  | { k: "ready" } // 伺机待发:下一张法术减 2 费(仅本回合)
  | { k: "passage" } // 秘密通道:手牌换成牌库随机 4 张,回合结束换回
  | { k: "shuffleDraw"; back: number; draw: number } // 换挡漂移:最左 back 张洗回牌库,抽 draw 张
  | { k: "bounce"; t: "fm" } // 街舞起跳:友方随从回手,召唤同属性"舞者"
  | { k: "shadow" } // 殒命暗影:在手牌中即变成你上一张打出的法术
  | { k: "spelldraw" }; // 暗影之门:从牌库随机抽一张法术牌

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
  rush?: 1; // 突袭:登场当回合可攻击敌方随从,但不能攻击英雄
  aura?: "cheapSpells";
  bc?: { k: "summonMini" };
  costScale?: "spellsPlayed"; // 奥术巨人:每使用过一张法术,费用 -1(下限 0)
  sp?: undefined;
}

export interface SpellCard extends CardBase {
  type: "s";
  sp: SpellDef;
  atk?: undefined;
  hp?: undefined;
  taunt?: undefined;
  charge?: undefined;
  rush?: undefined;
  aura?: undefined;
  bc?: undefined;
}

export type Card = MinionCard | SpellCard;

export interface HandEntry {
  uid: number;
  cid: number;
  moon?: number; // 月光指引复制:记录获得复制的回合号
  borrowed?: 1; // 秘密通道借来的临时牌:回合结束时未打出的会洗回牌库(本回合抽到的牌不带此标记,予以保留)
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
  rush: boolean; // 突袭:登场当回合(sick 期间)可攻击敌方随从,但不能攻击英雄
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
  spellDiscount?: number; // 伺机待发:下一张法术减费量,仅本回合(startTurn 时本方清零)
  spellsPlayed?: number; // 本局从手牌打出的法术总数(奥术巨人减费用)
  lastSpell?: number; // 本局最后一张从手牌打出的法术 cid(殒命暗影复制用)
  stash?: HandEntry[]; // 秘密通道:被暂存的原手牌,回合结束时取回
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
