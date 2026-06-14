// 引擎纯函数单测(vitest)。引擎不碰 React,可直接构造 state 调用。
import { describe, expect, it } from "vitest";
import type { GameState, Minion, SideState } from "./types";
import {
  castDeckSpell, castSpell, dmgHero, draw, effCard, effCost, endTurnCleanup,
  gainMoonCopy, initGame, moonTutor, playMinion, rand, resolveAttack, spSummary,
  freezeMinion, thawFrozen, startTurn, dredgePick, mapTake, mapTutor,
  equipWeapon, playWeapon, resolveHeroAttack, useHeroPower, heroAtkVal,
} from "./engine";
import { byId, DAGGER } from "./cards";
import { computeAiTurn } from "./ai";

// ---------- 构造最小 state 的辅助 ----------
const side = (over: Partial<SideState> = {}): SideState => ({
  hp: 30, armor: 0, mana: 10, maxMana: 10, fatigue: 0, spellDmg: 0, deck: [], hand: [], board: [], ...over,
});
const mkState = (over: Partial<GameState> = {}): GameState => ({
  phase: "play", turn: "p", first: "p", turnNum: 1, winner: null, rngState: 12345,
  fx: [], logs: [], lastLog: "", notice: null, pending: null, banner: null,
  p: side(), a: side(), ...over,
});
const minion = (over: Partial<Minion> = {}): Minion => ({
  uid: 1, cid: 1, name: "测试随从", emoji: "🧪", atk: 1, hp: 1, maxHp: 1,
  taunt: false, charge: false, rush: false, sick: false, attacked: false, frozen: false, seq: 1, ...over,
});

describe("draw:疲劳与烧牌", () => {
  it("牌库抽空后疲劳递增并扣血", () => {
    const st = mkState({ p: side({ deck: [] }) });
    draw(st, "p", 1);
    expect(st.p.fatigue).toBe(1);
    expect(st.p.hp).toBe(29);
    draw(st, "p", 1);
    expect(st.p.fatigue).toBe(2);
    expect(st.p.hp).toBe(27); // 29 - 2
  });

  it("手牌满(10)时抽到的牌被烧掉,不进手牌", () => {
    const hand = Array.from({ length: 10 }, (_, i) => ({ uid: i + 1, cid: 1 }));
    const st = mkState({ p: side({ deck: [18, 20], hand }) });
    draw(st, "p", 1);
    expect(st.p.hand.length).toBe(10); // 仍是 10,新牌被烧
    expect(st.p.deck.length).toBe(1); // 牌库少了一张
  });
});

describe("dmgHero:护甲先于生命抵挡", () => {
  it("护甲吸收后剩余才扣血", () => {
    const st = mkState({ p: side({ hp: 30, armor: 5 }) });
    dmgHero(st, "p", 8);
    expect(st.p.armor).toBe(0);
    expect(st.p.hp).toBe(27); // 8 - 5 护甲 = 3
  });

  it("血量归零判定对方胜利", () => {
    const st = mkState({ a: side({ hp: 3, armor: 0 }) });
    dmgHero(st, "a", 5);
    expect(st.a.hp).toBe(0);
    expect(st.winner).toBe("p");
  });
});

describe("resolveAttack:嘲讽规则", () => {
  it("有嘲讽时不能攻击英雄或非嘲讽随从", () => {
    const attacker = minion({ uid: 1, atk: 3, hp: 3 });
    const st = mkState({
      p: side({ board: [attacker] }),
      a: side({ board: [minion({ uid: 2, taunt: true, hp: 4, atk: 1 }), minion({ uid: 3, hp: 2, atk: 2 })] }),
    });
    expect(resolveAttack(st, "p", 1, { hero: true })).toBe(false);
    expect(resolveAttack(st, "p", 1, { uid: 3 })).toBe(false);
    expect(resolveAttack(st, "p", 1, { uid: 2 })).toBe(true); // 只能打嘲讽
  });

  it("刚上场(sick)的随从无法攻击", () => {
    const st = mkState({ p: side({ board: [minion({ uid: 1, atk: 3, sick: true })] }), a: side() });
    expect(resolveAttack(st, "p", 1, { hero: true })).toBe(false);
  });
});

describe("castSpell:法伤加成与扣费", () => {
  it("dmg 法术实际伤害 = 基础 + spellDmg,并扣费离手", () => {
    // 闪电箭(id 18,造成 2 点伤害),叠加 1 点法伤 → 3 点
    const st = mkState({ p: side({ mana: 5, spellDmg: 1, hand: [{ uid: 1, cid: 18 }] }), a: side({ hp: 30 }) });
    const ok = castSpell(st, "p", 0, { side: "a", hero: true });
    expect(ok).toBe(true);
    expect(st.a.hp).toBe(27); // 30 - (2+1)
    expect(st.p.mana).toBe(4); // 闪电箭 1 费
    expect(st.p.hand.length).toBe(0);
  });
});

describe("effCost:伊谢尔光环减费", () => {
  it("伊谢尔在场时法术费用变 1", () => {
    const st = mkState({ p: side({ board: [minion({ uid: 1, cid: 27 })] }) });
    // 火球术 id 25,原 4 费 → 1
    expect(effCost(st, "p", { type: "s", cost: 4 })).toBe(1);
    // 随从不受影响
    expect(effCost(st, "p", { type: "m", cost: 4 })).toBe(4);
  });
  it("伊谢尔在场时 0 费法术也变为 1 费", () => {
    const st = mkState({ p: side({ board: [minion({ uid: 1, cid: 27 })] }) });
    expect(effCost(st, "p", { type: "s", cost: 0 })).toBe(1);
  });
});

describe("冻结状态", () => {
  it("寒冰箭(id 20)对存活的随从造成伤害并冻结,被冻结者无法攻击", () => {
    const st = mkState({
      p: side({ mana: 5, hand: [{ uid: 1, cid: 20 }] }),
      a: side({ board: [minion({ uid: 7, atk: 4, hp: 5, sick: false })] }),
    });
    expect(castSpell(st, "p", 0, { side: "a", uid: 7 })).toBe(true);
    const m = st.a.board.find((x) => x.uid === 7)!;
    expect(m.hp).toBe(2); // 5 - 3
    expect(m.frozen).toBe(true);
    expect(resolveAttack(st, "a", 7, { hero: true })).toBe(false); // 冻结无法攻击
  });
  it("足够致死时随从死亡,不会留下冻结目标", () => {
    const st = mkState({
      p: side({ mana: 5, hand: [{ uid: 1, cid: 20 }] }),
      a: side({ board: [minion({ uid: 7, atk: 4, hp: 3, sick: false })] }),
    });
    expect(castSpell(st, "p", 0, { side: "a", uid: 7 })).toBe(true);
    expect(st.a.board.length).toBe(0); // 3 伤打死,无残留
  });
  it("thawFrozen 解冻后随从可再次攻击", () => {
    const st = mkState({ a: side({ board: [minion({ uid: 7, atk: 4, hp: 5, sick: false, frozen: true })] }) });
    expect(thawFrozen(st, "a")).toBe(true);
    expect(st.a.board[0].frozen).toBe(false);
    expect(resolveAttack(st, "a", 7, { hero: true })).toBe(true);
  });
  it("freezeMinion 对已不在场的随从无副作用", () => {
    const st = mkState({ a: side({ board: [] }) });
    expect(() => freezeMinion(st, "a", 99)).not.toThrow();
  });
});

describe("一次性登场效果:攻击后清除", () => {
  it("冲锋随从登场攻击后 charge 角标清除", () => {
    const st = mkState({ p: side({ board: [minion({ uid: 1, atk: 2, hp: 2, charge: true, sick: false })] }), a: side({ hp: 30 }) });
    expect(resolveAttack(st, "p", 1, { hero: true })).toBe(true);
    expect(st.p.board[0].charge).toBe(false);
  });
  it("熬过登场回合后,startTurn 清除未使用的 charge/rush", () => {
    const st = mkState({ p: side({ board: [minion({ uid: 1, charge: true, rush: true, sick: false })] }) });
    startTurn(st, "p");
    expect(st.p.board[0].charge).toBe(false);
    expect(st.p.board[0].rush).toBe(false);
  });
});

describe("月光指引:复制链", () => {
  it("打出本回合获得的复制时,从牌库定向抽取本体", () => {
    // 牌库里有本体(农夫民兵 id 1),手里是本回合的 moon 复制
    const st = mkState({
      turnNum: 3,
      p: side({ deck: [1], hand: [{ uid: 99, cid: 1, moon: 3 }] }),
    });
    const ok = playMinion(st, "p", 0);
    expect(ok).toBe(true);
    expect(st.p.board.length).toBe(1); // 复制上场
    expect(st.p.deck.length).toBe(0); // 本体已被定向抽走
    expect(st.p.hand.some((e) => e.cid === 1)).toBe(true); // 本体进手牌
  });

  it("复制不是本回合获得的则不触发定向抽取", () => {
    const st = mkState({ turnNum: 3, p: side({ deck: [1], hand: [{ uid: 99, cid: 1, moon: 2 }] }) });
    moonTutor(st, "p", st.p.hand[0]);
    expect(st.p.deck.length).toBe(1); // 未触发
  });

  it("gainMoonCopy 给复制打上当前回合标记", () => {
    const st = mkState({ turnNum: 4, p: side({ hand: [] }) });
    gainMoonCopy(st, "p", 17);
    expect(st.p.hand[0]).toMatchObject({ cid: 17, moon: 4 });
  });
});

describe("效果注册表(步骤 3):spSummary 与 castDeckSpell 委派", () => {
  it("spSummary 覆盖所有 POOL 法术且法伤加成时渲染 * n *", () => {
    // 每张法术牌都应有非「法术」兜底的简述(证明注册表对所有 k 都登记了 summary)
    for (const c of Object.values(byId)) {
      if (c.type === "s") expect(spSummary(c.sp)).not.toBe("法术");
    }
    expect(spSummary({ k: "dmg", n: 2, t: "any" }, 1)).toBe("伤害* 3 *");
    expect(spSummary({ k: "aoe", n: 4 }, 2)).toBe("全体* 6 *");
    expect(spSummary({ k: "dmg", n: 2, t: "any" }, 0)).toBe("伤害 2");
  });

  it("castDeckSpell 的 dmg 自动选中目标并结算附带效果", () => {
    // 火球术 id 25(6 点伤害),敌方仅英雄可选 → 直击英雄
    const st = mkState({ p: side({ deck: [] }), a: side({ hp: 30, board: [] }) });
    castDeckSpell(st, "p", 25);
    expect(st.a.hp).toBe(24);
  });

  it("castDeckSpell 的 obelisk 设置当前回合法伤", () => {
    const st = mkState({ p: side({ spellDmg: 0 }) });
    castDeckSpell(st, "p", 36); // 魔法方碑
    expect(st.p.spellDmg).toBe(1);
  });
});

describe("RNG:可复现性(步骤 4 注入种子的成果)", () => {
  it("rand 同种子产生同序列", () => {
    const a = mkState({ rngState: 777 });
    const b = mkState({ rngState: 777 });
    const seqA = [rand(a), rand(a), rand(a)];
    const seqB = [rand(b), rand(b), rand(b)];
    expect(seqA).toEqual(seqB);
  });

  it("initGame 同种子生成完全相同的牌库", () => {
    const g1 = initGame(null, "druid", 42);
    const g2 = initGame(null, "druid", 42);
    expect(g1.p.deck).toEqual(g2.p.deck);
    expect(g1.a.deck).toEqual(g2.a.deck);
    expect(g1.first).toBe(g2.first);
  });

  it("computeAiTurn 对同一局面产出完全相同的快照(可复现回放)", () => {
    const base = initGame(null, "druid", 2024);
    base.turn = "a"; // 让 AI 接管
    const s1 = computeAiTurn(base);
    const s2 = computeAiTurn(base);
    // UID/FXID 是模块级自增全局(见指南「常见坑」),跨调用继续累加,故剥离这些单调 id
    // 后比较「游戏指纹」:rngState 与双方血/法力/牌库/手牌 cid/场面,验证 RNG 驱动的逻辑可复现。
    const fingerprint = (snaps: GameState[]) =>
      snaps.map((s) => ({
        rngState: s.rngState, winner: s.winner,
        p: { hp: s.p.hp, mana: s.p.mana, deck: s.p.deck, hand: s.p.hand.map((e) => e.cid), board: s.p.board.map((m) => [m.cid, m.atk, m.hp]) },
        a: { hp: s.a.hp, mana: s.a.mana, deck: s.a.deck, hand: s.a.hand.map((e) => e.cid), board: s.a.board.map((m) => [m.cid, m.atk, m.hp]) },
      }));
    expect(fingerprint(s1)).toEqual(fingerprint(s2));
  });
});

describe("新增卡牌机制", () => {
  it("奥术巨人:每打出过一张法术减 1 费,下限 0", () => {
    expect(effCost(mkState({ p: side({ spellsPlayed: 3 }) }), "p", byId[45])).toBe(9);
    expect(effCost(mkState({ p: side({ spellsPlayed: 20 }) }), "p", byId[45])).toBe(0);
  });

  it("奥术巨人:按折后费用即可打出并扣费", () => {
    // spellsPlayed=9 → 奥术巨人(id 45,原 12 费)折后 3 费;只有 3 法力也能打出
    const st = mkState({ p: side({ mana: 3, spellsPlayed: 9, hand: [{ uid: 1, cid: 45 }], board: [] }) });
    expect(playMinion(st, "p", 0)).toBe(true);
    expect(st.p.mana).toBe(0); // 扣的是折后 3 费,而非 12
    expect(st.p.board[0].cid).toBe(45);
  });

  it("从手牌打出法术会累计 spellsPlayed 并记录 lastSpell", () => {
    const st = mkState({ p: side({ hand: [{ uid: 1, cid: 18 }] }) });
    castSpell(st, "p", 0, { side: "a", hero: true });
    expect(st.p.spellsPlayed).toBe(1);
    expect(st.p.lastSpell).toBe(18);
  });

  it("伺机待发:下一张法术减 2 费,打出后消耗减费", () => {
    const st = mkState({ p: side({ mana: 10, hand: [{ uid: 1, cid: 38 }, { uid: 2, cid: 25 }] }) });
    expect(castSpell(st, "p", 0, null)).toBe(true); // 伺机待发(0 费)
    expect(st.p.spellDiscount).toBe(2);
    expect(effCost(st, "p", byId[25])).toBe(2); // 火球术 4 → 2
    castSpell(st, "p", 0, { side: "a", hero: true }); // 此时火球术在 index 0
    expect(st.p.mana).toBe(8); // 10 - 0 - 2
    expect(st.p.spellDiscount).toBe(0); // 已消耗
  });

  it("殒命暗影:effCard 解析为上一张打出的法术,无则保持原牌", () => {
    const st = mkState({ p: side() });
    expect(effCard(st, "p", { uid: 1, cid: 42 }).id).toBe(42); // 未打过法术 → 仍为自身(不可打出)
    st.p.lastSpell = 18;
    expect(effCard(st, "p", { uid: 1, cid: 42 }).id).toBe(18); // 变为闪电箭
  });

  it("换挡漂移:最左 2 张洗回牌库,抽 3 张", () => {
    const st = mkState({ p: side({ mana: 10, hand: [{ uid: 1, cid: 40 }, { uid: 2, cid: 18 }, { uid: 3, cid: 20 }], deck: [21, 22, 23, 24, 25] }) });
    castSpell(st, "p", 0, null);
    expect(st.p.hand.length).toBe(3); // 离手后剩 2 张洗回,抽 3
    expect(st.p.deck.length).toBe(4); // 5 + 2 - 3
  });

  it("暗影之门:从牌库随机抽一张法术牌", () => {
    const st = mkState({ p: side({ mana: 10, hand: [{ uid: 1, cid: 43 }], deck: [1, 2, 18] }) });
    castSpell(st, "p", 0, null);
    expect(st.p.hand.map((e) => e.cid)).toEqual([18]); // 只有 18 是法术
    expect([...st.p.deck].sort((a, b) => a - b)).toEqual([1, 2]);
  });

  it("秘密通道:换手牌并在回合结束换回原手牌", () => {
    const st = mkState({ p: side({ mana: 10, hand: [{ uid: 1, cid: 39 }, { uid: 2, cid: 18 }], deck: [20, 21, 22, 23, 24, 25] }) });
    castSpell(st, "p", 0, null);
    expect(st.p.hand.length).toBe(4); // 抽 4 张临时手牌
    expect(st.p.stash?.map((e) => e.cid)).toEqual([18]); // 原手牌暂存
    expect(st.p.deck.length).toBe(2);
    endTurnCleanup(st, "p");
    expect(st.p.hand.map((e) => e.cid)).toEqual([18]); // 取回原手牌
    expect(st.p.deck.length).toBe(6); // 未打出的临时牌洗回
    expect(st.p.stash).toBeUndefined();
  });

  it("秘密通道:本回合抽到的牌不被洗回,只洗回未打出的借牌", () => {
    const st = mkState({ p: side({ mana: 10, hand: [{ uid: 1, cid: 39 }, { uid: 2, cid: 18 }], deck: [20, 21, 22, 23, 24, 25] }) });
    castSpell(st, "p", 0, null); // 借 4 张(标记 borrowed),牌库剩 2 张
    draw(st, "p", 1); // 模拟用借牌(如暗影之门)抽到一张新牌(不带 borrowed)
    expect(st.p.hand.length).toBe(5); // 4 借 + 1 抽
    endTurnCleanup(st, "p");
    expect([...st.p.hand.map((e) => e.cid)].sort((a, b) => a - b)).toEqual([18, 21]); // 原手牌 + 抽到的牌
    expect(st.p.deck.length).toBe(5); // 1 张剩余 + 4 张借牌洗回
    expect(st.p.hand.some((e) => e.borrowed)).toBe(false);
  });

  it("街舞起跳:友方随从回手并召唤继承当前属性的舞者", () => {
    const m = minion({ uid: 5, cid: 9, atk: 4, hp: 2, maxHp: 2 }); // 暗影刺客
    const st = mkState({ p: side({ mana: 10, hand: [{ uid: 1, cid: 41 }], board: [m] }) });
    castSpell(st, "p", 0, { side: "p", uid: 5 });
    expect(st.p.hand.map((e) => e.cid)).toEqual([9]); // 随从回手(原始卡)
    expect(st.p.board.length).toBe(1);
    expect(st.p.board[0].cid).toBe(97); // 舞者 token
    expect([st.p.board[0].atk, st.p.board[0].hp]).toEqual([4, 2]); // 继承当前攻/血
    expect(st.p.board[0].sick).toBe(true); // 召唤失调
  });

  it("街舞起跳:舞者自身被弹回手牌后再打出仍保留继承属性(不退化为 0/0)", () => {
    // 场上一个 6/4 的舞者(由先前街舞起跳召唤),再次街舞起跳将其弹回手牌
    const dancer = minion({ uid: 5, cid: 97, atk: 6, hp: 4, maxHp: 4, rush: true });
    const st = mkState({ p: side({ mana: 10, hand: [{ uid: 1, cid: 41 }], board: [dancer] }) });
    castSpell(st, "p", 0, { side: "p", uid: 5 });
    const back = st.p.hand.find((e) => e.cid === 97)!;
    expect([back.atk, back.hp]).toEqual([6, 4]); // 手牌条目带回属性快照
    expect(effCost(st, "p", effCard(st, "p", back), back)).toBe(5); // 费用 = round((6+4)/2)
    // 把场上召唤出的舞者清掉腾位,打出手牌里的舞者
    st.p.board = [];
    const idx = st.p.hand.findIndex((e) => e.uid === back.uid);
    expect(playMinion(st, "p", idx)).toBe(true);
    const replayed = st.p.board[0];
    expect(replayed.cid).toBe(97);
    expect([replayed.atk, replayed.hp, replayed.maxHp]).toEqual([6, 4, 4]); // 仍是 6/4,而非 0/0
  });

  it("伪造的幸运币:与幸运币同效,本回合 +1 法力", () => {
    const st = mkState({ p: side({ mana: 3, maxMana: 5, hand: [{ uid: 1, cid: 44 }] }) });
    castSpell(st, "p", 0, null);
    expect(st.p.mana).toBe(4);
  });
});

describe("突袭关键词", () => {
  it("突袭随从登场当回合(sick)可攻击随从,但不能攻击英雄", () => {
    const st = mkState({
      p: side({ board: [minion({ uid: 1, atk: 3, hp: 3, rush: true, sick: true })] }),
      a: side({ hp: 30, board: [minion({ uid: 2, atk: 1, hp: 2 })] }),
    });
    expect(resolveAttack(st, "p", 1, { hero: true })).toBe(false); // 不能打脸
    expect(resolveAttack(st, "p", 1, { uid: 2 })).toBe(true); // 可以打随从
    expect(st.a.board.length).toBe(0); // 敌方随从被消灭
  });

  it("突袭随从在下一回合(sick 清除后)可攻击英雄", () => {
    const st = mkState({ p: side({ board: [minion({ uid: 1, atk: 3, hp: 3, rush: true, sick: false })] }), a: side({ hp: 30 }) });
    expect(resolveAttack(st, "p", 1, { hero: true })).toBe(true);
    expect(st.a.hp).toBe(27);
  });

  it("街舞起跳召唤的舞者带突袭且本回合召唤失调", () => {
    const st = mkState({ p: side({ mana: 10, hand: [{ uid: 1, cid: 41 }], board: [minion({ uid: 5, cid: 9, atk: 4, hp: 2, maxHp: 2 })] }) });
    castSpell(st, "p", 0, { side: "p", uid: 5 });
    const dancer = st.p.board[0];
    expect(dancer.cid).toBe(97);
    expect(dancer.rush).toBe(true);
    expect(dancer.sick).toBe(true);
  });
});

// ================= 新增关键词与卡牌 =================
describe("连击:鬼魅攻击(id49)", () => {
  it("本回合未出过其他牌时,不抽牌", () => {
    const st = mkState({ p: side({ hand: [{ uid: 1, cid: 49 }], deck: [18, 20], playedThisTurn: 0 }), a: side({ hp: 30 }) });
    castSpell(st, "p", 0, { side: "a", hero: true });
    expect(st.a.hp).toBe(29); // 造成 1 点伤害
    expect(st.p.hand.length).toBe(0); // 未触发连击,无抽牌
    expect(st.p.deck.length).toBe(2);
  });
  it("本回合先出过牌(连击)时,额外抽一张", () => {
    const st = mkState({ p: side({ hand: [{ uid: 1, cid: 49 }], deck: [18, 20], playedThisTurn: 1 }), a: side({ hp: 30 }) });
    castSpell(st, "p", 0, { side: "a", hero: true });
    expect(st.a.hp).toBe(29);
    expect(st.p.hand.length).toBe(1); // 连击抽了一张
    expect(st.p.deck.length).toBe(1);
  });
});

describe("探底:dredgePick(id47 垂钓时光)", () => {
  it("把牌库底部选中的牌置于牌库顶,不抽牌", () => {
    const st = mkState({ p: side({ deck: [18, 20, 25, 22] }) }); // 底部=deck[0]=18
    dredgePick(st, "p", 0, false);
    expect(st.p.deck.length).toBe(4);
    expect(st.p.deck[st.p.deck.length - 1]).toBe(18); // 18 被置顶(末尾即牌库顶)
  });
  it("连击时探底后随即抽取置顶的牌", () => {
    const st = mkState({ p: side({ deck: [18, 20, 25, 22], hand: [] }) });
    dredgePick(st, "p", 0, true);
    expect(st.p.deck.length).toBe(3); // 18 已被抽走
    expect(st.p.hand.map((e) => e.cid)).toContain(18);
  });
});

describe("异教地图:mapTake / mapTutor(id48)", () => {
  it("发现并抽取选中牌,剩余选项记在手牌上", () => {
    const st = mkState({ p: side({ deck: [18, 20, 25], hand: [] }) });
    mapTake(st, "p", 18, [20, 25]);
    expect(st.p.deck).not.toContain(18);
    const en = st.p.hand[0];
    expect(en.cid).toBe(18);
    expect(en.mapTurn).toBe(st.turnNum);
    expect(en.mapLeft).toEqual([20, 25]);
  });
  it("本回合打出发现牌后,AI 自动从剩余选项再抽一张", () => {
    const st = mkState({ a: side({ deck: [20, 25], hand: [] }) });
    const en = { uid: 1, cid: 18, mapTurn: st.turnNum, mapLeft: [20, 25] };
    mapTutor(st, "a", en); // AI 取费用最高者(火球 id25 cost4 > 寒冰箭 id20 cost2)
    expect(st.a.hand.map((e) => e.cid)).toContain(25);
    expect(st.a.deck).not.toContain(25);
  });
  it("玩家打出发现牌后弹出后续抉择(mapPick)", () => {
    const st = mkState({ p: side({ deck: [20, 25], hand: [] }) });
    const en = { uid: 1, cid: 18, mapTurn: st.turnNum, mapLeft: [20, 25] };
    mapTutor(st, "p", en);
    expect(st.pending).toEqual({ k: "mapPick", opts: [20, 25] });
  });
});

describe("暗影步(id46)", () => {
  it("随从回手并使其费用 -2,打出后恢复原消耗、丢失增益", () => {
    const st = mkState({ p: side({ mana: 10, hand: [{ uid: 1, cid: 46 }], board: [minion({ uid: 5, cid: 13, atk: 9, hp: 9, maxHp: 9 })] }) }); // 独角兽 cost5,被增益到 9/9
    castSpell(st, "p", 0, { side: "p", uid: 5 });
    expect(st.p.board.length).toBe(0);
    const en = st.p.hand.find((e) => e.cid === 13)!;
    expect(en.costred).toBe(2);
    expect(effCost(st, "p", byId[13], en)).toBe(3); // 5 - 2
    const i = st.p.hand.indexOf(en);
    playMinion(st, "p", i);
    const m = st.p.board.find((x) => x.cid === 13)!;
    expect(m.atk).toBe(5); // 回到原始 5/5,增益丢失
    expect(m.hp).toBe(5);
  });
});

describe("贪婪的伴侣(id50)战吼", () => {
  it("手牌另有 2 费牌时获得幸运币", () => {
    const st = mkState({ p: side({ mana: 10, hand: [{ uid: 1, cid: 50 }, { uid: 2, cid: 5 }] }) }); // 矮人战士 id5 cost2
    playMinion(st, "p", 0);
    expect(st.p.hand.map((e) => e.cid)).toContain(99); // 幸运币
  });
  it("手牌无其他 2 费牌时不获得幸运币", () => {
    const st = mkState({ p: side({ mana: 10, hand: [{ uid: 1, cid: 50 }, { uid: 2, cid: 1 }] }) }); // 农夫 id1 cost1
    playMinion(st, "p", 0);
    expect(st.p.hand.map((e) => e.cid)).not.toContain(99);
  });
});

describe("洛欧塞布(id51)加税", () => {
  it("战吼使对手下个回合法术 +5 费,本方不受影响", () => {
    const st = mkState({ a: side({ mana: 10, hand: [{ uid: 1, cid: 51 }], deck: [18] }), p: side({ deck: [18] }) });
    playMinion(st, "a", 0);
    expect(st.p.spellTaxNext).toBeTruthy();
    startTurn(st, "p"); // 进入玩家回合,加税生效
    expect(effCost(st, "p", byId[25])).toBe(9); // 火球 4 → 9
    startTurn(st, "p"); // 再过一个玩家回合,加税清除
    expect(effCost(st, "p", byId[25])).toBe(4);
  });
  it("与伊谢尔光环冲突:后入场者覆盖前者", () => {
    // 加税更晚登场(order 大于光环随从 seq)→ 税生效,法术为基础+5
    const taxLater = mkState({ p: side({ board: [minion({ seq: 5, cid: 27 })], spellTax: { amt: 5, order: 100 } }) });
    expect(effCost(taxLater, "p", byId[25])).toBe(9);
    // 光环更晚登场(seq 大于加税 order)→ 光环生效,法术固定为 1
    const auraLater = mkState({ p: side({ board: [minion({ seq: 200, cid: 27 })], spellTax: { amt: 5, order: 100 } }) });
    expect(effCost(auraLater, "p", byId[25])).toBe(1);
  });
});

describe("武器与英雄攻击", () => {
  it("装备武器后英雄获得攻击力,攻击英雄消耗 1 耐久、无反击", () => {
    const st = mkState({ p: side(), a: side({ hp: 30 }) });
    equipWeapon(st, "p", 52); // 炽炎战斧 3/2
    expect(heroAtkVal(st.p)).toBe(3);
    expect(resolveHeroAttack(st, "p", { hero: true })).toBe(true);
    expect(st.a.hp).toBe(27);
    expect(st.p.weapon!.dur).toBe(1); // 耐久 -1
    expect(st.p.heroAttacked).toBe(true);
    expect(st.p.hp).toBe(30); // 打脸无反击
  });

  it("英雄每回合只能攻击一次", () => {
    const st = mkState({ p: side({ weapon: { cid: 52, atk: 3, dur: 2 } }), a: side() });
    expect(resolveHeroAttack(st, "p", { hero: true })).toBe(true);
    expect(resolveHeroAttack(st, "p", { hero: true })).toBe(false);
  });

  it("英雄攻击随从承受反击,耐久归零销毁武器", () => {
    const st = mkState({ p: side({ weapon: { cid: 96, atk: 1, dur: 1 } }), a: side({ board: [minion({ uid: 9, atk: 2, hp: 3 })] }) });
    expect(resolveHeroAttack(st, "p", { uid: 9 })).toBe(true);
    expect(st.a.board[0].hp).toBe(2); // 受到 1 点
    expect(st.p.hp).toBe(28); // 反击 2 点
    expect(st.p.weapon).toBe(null); // 耐久 1→0 销毁
  });

  it("有嘲讽时英雄不能攻击英雄,只能打嘲讽随从", () => {
    const st = mkState({ p: side({ weapon: { cid: 52, atk: 3, dur: 2 } }), a: side({ board: [minion({ uid: 9, taunt: true, hp: 4 })] }) });
    expect(resolveHeroAttack(st, "p", { hero: true })).toBe(false);
    expect(resolveHeroAttack(st, "p", { uid: 9 })).toBe(true);
  });

  it("playWeapon 从手牌装备武器并扣费", () => {
    const st = mkState({ p: side({ mana: 5, hand: [{ uid: 1, cid: 52 }] }) });
    expect(playWeapon(st, "p", 0)).toBe(true);
    expect(st.p.weapon).toEqual({ cid: 52, atk: 3, dur: 2 });
    expect(st.p.mana).toBe(2); // 5 - 3
    expect(st.p.hand.length).toBe(0);
  });
});

describe("英雄技能", () => {
  it("潜行者「暗影匕首」装备 1/2 匕首,消耗 2 法力且每回合一次", () => {
    const st = mkState({ p: side({ classId: "rogue", mana: 5 }) });
    expect(useHeroPower(st, "p")).toBe(true);
    expect(st.p.weapon).toEqual({ cid: DAGGER.id, atk: 1, dur: 2 });
    expect(st.p.mana).toBe(3);
    expect(useHeroPower(st, "p")).toBe(false); // 本回合已用
  });

  it("德鲁伊「变形」获得 1 护甲与 1 临时攻击力,startTurn 清攻击力但护甲保留", () => {
    const st = mkState({ p: side({ classId: "druid", mana: 5, armor: 0, deck: [1, 2] }) });
    expect(useHeroPower(st, "p")).toBe(true);
    expect(st.p.armor).toBe(1);
    expect(heroAtkVal(st.p)).toBe(1);
    expect(st.p.mana).toBe(3);
    startTurn(st, "p"); // 牌库有牌,抽牌不触发疲劳
    expect(st.p.heroAtk).toBe(0); // 临时攻击力清零
    expect(st.p.armor).toBe(1); // 护甲保留
    expect(st.p.heroPowerUsed).toBe(false); // 可再次使用
  });

  it("法力不足时无法使用英雄技能", () => {
    const st = mkState({ p: side({ classId: "druid", mana: 1 }) });
    expect(useHeroPower(st, "p")).toBe(false);
  });
});
