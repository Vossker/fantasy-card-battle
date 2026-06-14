// 引擎纯函数单测(vitest)。引擎不碰 React,可直接构造 state 调用。
import { describe, expect, it } from "vitest";
import type { GameState, Minion, SideState } from "./types";
import {
  castDeckSpell, castSpell, dmgHero, draw, effCard, effCost, endTurnCleanup,
  gainMoonCopy, initGame, moonTutor, playMinion, rand, resolveAttack, spSummary,
} from "./engine";
import { byId } from "./cards";
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
  taunt: false, charge: false, rush: false, sick: false, attacked: false, ...over,
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
    const g1 = initGame(null, 42);
    const g2 = initGame(null, 42);
    expect(g1.p.deck).toEqual(g2.p.deck);
    expect(g1.a.deck).toEqual(g2.a.deck);
    expect(g1.first).toBe(g2.first);
  });

  it("computeAiTurn 对同一局面产出完全相同的快照(可复现回放)", () => {
    const base = initGame(null, 2024);
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
