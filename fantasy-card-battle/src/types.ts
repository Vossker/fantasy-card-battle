// ================= 全局类型定义 =================

export type Side = "p" | "a";
export type Rarity = "c" | "r" | "e" | "l";
export type ClassId = "druid" | "rogue"; // 职业;卡牌 classes 为空/缺省 = 中立(所有职业可用)
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
  | { k: "dmg"; n: number; t: "any"; draw?: number; armor?: number; summon?: number; freeze?: 1; comboDraw?: 1 }
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
  | { k: "spelldraw" } // 暗影之门:从牌库随机抽一张法术牌
  | { k: "shadowstep"; t: "fm" } // 暗影步:友方随从回手,其费用 -2(不叠加)
  | { k: "dredge"; comboDraw?: 1 } // 垂钓时光:探底;连击(本回合先用过其他牌)则抽取置顶的牌
  | { k: "map" }; // 异教地图:发现并抽一张牌;本回合打出该牌则再从剩余选项抽一张

interface CardBase {
  id: number;
  name: string;
  emoji: string;
  cost: number;
  rarity: Rarity;
  desc: string;
  token?: 1;
  classes?: ClassId[]; // 所属职业(可多个);缺省/空数组 = 中立,任意职业可选用
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
  bc?: { k: "summonMini" } | { k: "greedyCoin" } | { k: "loatheb"; amt?: number }; // loatheb.amt:对手下回合法术加税量(缺省 5)
  costScale?: "spellsPlayed"; // 奥术巨人:每使用过一张法术,费用 -1(下限 0)
  inheritStats?: 1; // 属性继承型 token(如舞者):卡面 atk/hp 仅占位,被街舞起跳弹回手牌时记录属性快照
  dur?: undefined;
  sp?: undefined;
}

export interface SpellCard extends CardBase {
  type: "s";
  sp: SpellDef;
  atk?: undefined;
  hp?: undefined;
  dur?: undefined;
  taunt?: undefined;
  charge?: undefined;
  rush?: undefined;
  aura?: undefined;
  bc?: undefined;
}

// 武器牌:英雄装备后获得攻击力,可攻击随从/英雄,每次攻击消耗 1 点耐久,耐久归 0 销毁
export interface WeaponCard extends CardBase {
  type: "w";
  atk: number;
  dur: number;
  hp?: undefined;
  taunt?: undefined;
  charge?: undefined;
  rush?: undefined;
  aura?: undefined;
  bc?: undefined;
  costScale?: undefined;
  inheritStats?: undefined;
  sp?: undefined;
}

export type Card = MinionCard | SpellCard | WeaponCard;

export interface HandEntry {
  uid: number;
  cid: number;
  moon?: number; // 月光指引复制:记录获得复制的回合号
  borrowed?: 1; // 秘密通道借来的临时牌:回合结束时未打出的会洗回牌库(本回合抽到的牌不带此标记,予以保留)
  costred?: number; // 暗影步:该牌的法力消耗减免(仅对随从有效,不叠加,打出后随上场而消失)
  mapTurn?: number; // 异教地图:发现并抽到此牌的回合号(本回合打出则触发后续抽取)
  mapLeft?: number[]; // 异教地图:首次发现时剩余未选的选项(后续从中再抽一张)
  atk?: number; // 属性继承型 token(如舞者)被弹回手牌时记录的攻击力快照;有快照时打出按此属性上场
  hp?: number; // 同上,生命值快照;费用按 round((atk+hp)/2) 计(见 effCard)
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
  frozen: boolean; // 冻结:被冻结的随从在其下一个能攻击的回合无法攻击,该回合结束时解冻
  seq: number; // 登场顺序序号(全局自增):用于裁决伊谢尔光环与洛欧塞布加税的先后,后入场者覆盖先入场者
}

export interface SideState {
  classId?: ClassId; // 本方英雄职业(决定英雄技能);对局内固定
  hp: number;
  armor: number;
  mana: number;
  maxMana: number;
  fatigue: number;
  weapon?: { cid: number; atk: number; dur: number } | null; // 当前装备的武器(null/缺省 = 无)
  heroAtk?: number; // 英雄临时攻击力加成(德鲁伊变形),仅当回合(startTurn 清零)
  heroAttacked?: boolean; // 本回合英雄是否已用攻击力发起过攻击(startTurn 清零)
  heroFrozen?: boolean; // 冻结:被冻结的英雄下个能攻击的回合无法攻击,该回合结束 thawFrozen 解冻
  heroPowerUsed?: boolean; // 本回合是否已使用英雄技能(startTurn 清零)
  spellDmg: number; // 法伤加成,仅持续当前回合(startTurn 时双方清零)
  spellDiscount?: number; // 伺机待发:下一张法术减费量,仅本回合(startTurn 时本方清零)
  spellsPlayed?: number; // 本局从手牌打出的法术总数(奥术巨人减费用)
  playedThisTurn?: number; // 本回合已从手牌使用过的牌数(连击判定:>0 即触发连击;startTurn 清零)
  lastSpell?: number; // 本局最后一张从手牌打出的法术 cid(殒命暗影复制用)
  spellTax?: { amt: number; order: number }; // 洛欧塞布:本回合内法术费用增加 amt;order 为生效时刻的全局序(与伊谢尔光环比入场先后,后者覆盖前者)
  spellTaxNext?: { amt: number; order: number }; // 洛欧塞布:已挂载、将在本方下个回合生效的加税(startTurn 时转为 spellTax)
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
  | { k: "mulligan" } // 起手调度:开局弹窗,玩家选任意张手牌洗回牌库重抽
  | { k: "choose"; i: number; name: string; emoji: string; opts: ChooseOpt[] }
  | { k: "bloomMode"; i: number }
  | { k: "bloomPick"; mode: BloomMode; opts: number[] }
  | { k: "moonPick"; opts: number[] }
  | { k: "camp"; remaining: number }
  | { k: "dredge"; opts: number[]; draw: boolean } // 探底:从牌库底部选 1 张置顶(draw=连击则随即抽取)
  | { k: "mapDiscover"; opts: number[] } // 异教地图:发现 3 张并抽 1 张
  | { k: "mapPick"; opts: number[] }; // 异教地图:本回合打出该牌后,从剩余选项再抽 1 张

export interface SpellTarget {
  side: Side;
  uid?: number;
  hero?: boolean;
}

export interface AttackTarget {
  uid?: number;
  hero?: boolean;
}

// 动作标记:记录"谁对谁做了什么",供 UI 画攻击/法术箭头与攻击前顶动画。
// 每次设置取新 id(变更即触发一次动画),不参与规则计算。
export interface ActMark {
  id: number;
  kind: "attack" | "dmg" | "heal" | "buff";
  src: { side: Side; uid?: number; hero?: boolean };
  tgt: { side: Side; uid?: number; hero?: boolean };
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
  mapFollow?: number[]; // 异教地图后续抽取的待办选项:打出"发现牌"时若正弹着别的抉择窗(如探底),先排队,待其结束再弹 mapPick
  banner: { text: string; id: number } | null;
  act?: ActMark | null; // 最近一次攻击/指向性法术(UI 箭头与前顶动画用,非规则状态)
  p: SideState;
  a: SideState;
}
