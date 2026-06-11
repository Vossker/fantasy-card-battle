import { useState, useRef, useEffect } from "react";

// ================= 卡牌数据(全部原创) =================
const POOL = [
  { id: 1, name: "农夫民兵", emoji: "👨‍🌾", cost: 1, type: "m", atk: 2, hp: 1, desc: "拿起草叉保卫家园。" },
  { id: 2, name: "新兵盾卫", emoji: "🛡️", cost: 1, type: "m", atk: 1, hp: 2, taunt: 1, desc: "我来挡!" },
  { id: 3, name: "灵猫", emoji: "🐈", cost: 1, type: "m", atk: 1, hp: 1, charge: 1, desc: "敏捷如风。" },
  { id: 4, name: "见习法师", emoji: "🧙", cost: 2, type: "m", atk: 2, hp: 2, desc: "刚学会第一个法术。" },
  { id: 5, name: "矮人战士", emoji: "🪓", cost: 2, type: "m", atk: 3, hp: 2, desc: "山岭之子。" },
  { id: 6, name: "石墙守护者", emoji: "🗿", cost: 2, type: "m", atk: 1, hp: 4, taunt: 1, desc: "坚如磐石。" },
  { id: 7, name: "游侠射手", emoji: "🏹", cost: 3, type: "m", atk: 3, hp: 3, desc: "百步穿杨。" },
  { id: 8, name: "狮鹫骑士", emoji: "🦅", cost: 3, type: "m", atk: 2, hp: 3, charge: 1, desc: "自天空俯冲!" },
  { id: 9, name: "暗影刺客", emoji: "🗡️", cost: 3, type: "m", atk: 4, hp: 2, desc: "无声无息。" },
  { id: 10, name: "圣殿骑士", emoji: "🤺", cost: 4, type: "m", atk: 3, hp: 5, taunt: 1, desc: "以圣光之名。" },
  { id: 11, name: "火焰元素", emoji: "🔥", cost: 4, type: "m", atk: 5, hp: 3, desc: "燃烧吧!" },
  { id: 12, name: "皇家狮鹫", emoji: "🦁", cost: 4, type: "m", atk: 4, hp: 4, desc: "王室空中卫队。" },
  { id: 13, name: "独角兽守卫", emoji: "🦄", cost: 5, type: "m", atk: 5, hp: 5, desc: "圣洁之力。" },
  { id: 14, name: "树人长老", emoji: "🌳", cost: 5, type: "m", atk: 4, hp: 6, taunt: 1, desc: "森林的守望者。" },
  { id: 15, name: "风暴巨人", emoji: "⛈️", cost: 6, type: "m", atk: 6, hp: 6, desc: "雷霆之怒。" },
  { id: 16, name: "城堡卫士", emoji: "🏰", cost: 6, type: "m", atk: 5, hp: 7, taunt: 1, desc: "王城最后的防线。" },
  { id: 17, name: "远古巨龙", emoji: "🐉", cost: 7, type: "m", atk: 8, hp: 8, desc: "传说中的灾厄。" },
  { id: 18, name: "闪电箭", emoji: "⚡", cost: 1, type: "s", sp: { k: "dmg", n: 2, t: "any" }, desc: "造成 2 点伤害。" },
  { id: 19, name: "力量祝福", emoji: "💪", cost: 1, type: "s", sp: { k: "buff", a: 2, h: 0, t: "fm" }, desc: "使一个友方随从 +2 攻击力。" },
  { id: 20, name: "寒冰箭", emoji: "❄️", cost: 2, type: "s", sp: { k: "dmg", n: 3, t: "any" }, desc: "造成 3 点伤害。" },
  { id: 21, name: "治疗之光", emoji: "✨", cost: 2, type: "s", sp: { k: "heal", n: 6, t: "any" }, desc: "恢复 6 点生命值。" },
  { id: 22, name: "奥术智慧", emoji: "📜", cost: 3, type: "s", sp: { k: "draw", n: 2 }, desc: "抽两张牌。" },
  { id: 23, name: "神圣新星", emoji: "🌟", cost: 3, type: "s", sp: { k: "aoe", n: 2 }, desc: "对所有敌方随从造成 2 点伤害。" },
  { id: 24, name: "王者祝福", emoji: "👑", cost: 4, type: "s", sp: { k: "buff", a: 3, h: 3, t: "fm" }, desc: "使一个友方随从 +3/+3。" },
  { id: 25, name: "火球术", emoji: "☄️", cost: 4, type: "s", sp: { k: "dmg", n: 6, t: "any" }, desc: "造成 6 点伤害。" },
  { id: 26, name: "烈焰风暴", emoji: "🌋", cost: 6, type: "s", sp: { k: "aoe", n: 4 }, desc: "对所有敌方随从造成 4 点伤害。" },
];
const byId = {};
POOL.forEach((c) => (byId[c.id] = c));
let UID = 1, FXID = 1;

const clone = (o) => JSON.parse(JSON.stringify(o));
const other = (s) => (s === "p" ? "a" : "p");
const kw = (c) => `${c.taunt ? "【嘲讽】" : ""}${c.charge ? "【冲锋】" : ""}`;

function buildDeck() {
  const counts = {}, deck = [];
  while (deck.length < 20) {
    const c = POOL[Math.floor(Math.random() * POOL.length)];
    if ((counts[c.id] || 0) >= 2) continue;
    counts[c.id] = (counts[c.id] || 0) + 1;
    deck.push(c.id);
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// ================= 规则引擎 =================
function fx(st, key, text, color) {
  st.fx.push({ id: FXID++, key, text, color, ts: Date.now() });
}
function dmgHero(st, side, n) {
  st[side].hp -= n;
  fx(st, side + "-hero", "-" + n, "#ff6060");
  if (st[side].hp <= 0) { st[side].hp = 0; st.winner = other(side); }
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
    if (!s.deck.length) {
      s.fatigue++;
      dmgHero(st, side, s.fatigue);
      st.lastLog = (side === "p" ? "你" : "对手") + `的牌库已空,受到 ${s.fatigue} 点疲劳伤害`;
      continue;
    }
    const cid = s.deck.pop();
    if (s.hand.length >= 8) {
      st.lastLog = (side === "p" ? "你" : "对手") + "的手牌已满,一张牌被烧掉了";
      continue;
    }
    s.hand.push({ uid: UID++, cid });
  }
}
function startTurn(st, side) {
  const s = st[side];
  s.maxMana = Math.min(10, s.maxMana + 1);
  s.mana = s.maxMana;
  s.board.forEach((m) => { m.sick = false; m.attacked = false; });
  draw(st, side, 1);
}
function playMinion(st, side, i) {
  const s = st[side];
  const en = s.hand[i];
  if (!en) return;
  const c = byId[en.cid];
  s.mana -= c.cost;
  s.hand.splice(i, 1);
  s.board.push({
    uid: en.uid, cid: c.id, name: c.name, emoji: c.emoji,
    atk: c.atk, hp: c.hp, maxHp: c.hp,
    taunt: !!c.taunt, charge: !!c.charge, sick: !c.charge, attacked: false,
  });
}
function castSpell(st, side, i, tgt) {
  const s = st[side];
  const en = s.hand[i];
  if (!en) return;
  const c = byId[en.cid], sp = c.sp;
  s.mana -= c.cost;
  s.hand.splice(i, 1);
  if (sp.k === "dmg") {
    if (tgt.hero) dmgHero(st, tgt.side, sp.n);
    else dmgMinion(st, tgt.side, tgt.uid, sp.n);
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
  } else if (sp.k === "aoe") {
    const e = other(side);
    st[e].board.map((m) => m.uid).forEach((u) => dmgMinion(st, e, u, sp.n));
  }
}
function resolveAttack(st, side, auid, tgt) {
  const A = st[side].board.find((m) => m.uid === auid);
  if (!A) return;
  A.attacked = true;
  const e = other(side);
  if (tgt.hero) { dmgHero(st, e, A.atk); return; }
  const D = st[e].board.find((m) => m.uid === tgt.uid);
  if (!D) return;
  const dAtk = D.atk;
  dmgMinion(st, e, D.uid, A.atk);
  dmgMinion(st, side, A.uid, dAtk);
}

// ================= AI 对手 =================
function aiPlay(st) {
  const A = st.a, P = st.p;
  const hand = A.hand.map((e, i) => ({ i, c: byId[e.cid] }));
  const can = hand.filter((h) => h.c.cost <= A.mana);
  if (!can.length) return false;
  const dmg = can.filter((h) => h.c.sp && h.c.sp.k === "dmg").sort((x, y) => y.c.sp.n - x.c.sp.n);
  // 斩杀
  for (const h of dmg) {
    if (h.c.sp.n >= P.hp) {
      castSpell(st, "a", h.i, { side: "p", hero: true });
      st.lastLog = `对手使用「${h.c.name}」直击你的英雄!`;
      return true;
    }
  }
  // 群体清场
  const aoe = can.filter((h) => h.c.sp && h.c.sp.k === "aoe").sort((x, y) => y.c.sp.n - x.c.sp.n);
  if (aoe.length && P.board.length >= 3) {
    castSpell(st, "a", aoe[0].i, null);
    st.lastLog = `对手施放了「${aoe[0].c.name}」`;
    return true;
  }
  // 点杀大威胁
  if (dmg.length && P.board.length) {
    const th = [...P.board].sort((a, b) => b.atk * 2 + b.hp - (a.atk * 2 + a.hp))[0];
    if (th.atk >= 3) {
      const eff = [...dmg].reverse().find((h) => h.c.sp.n >= th.hp);
      if (eff) {
        castSpell(st, "a", eff.i, { side: "p", uid: th.uid });
        st.lastLog = `对手对「${th.name}」使用了「${eff.c.name}」`;
        return true;
      }
    }
  }
  // 治疗
  const heal = can.find((h) => h.c.sp && h.c.sp.k === "heal");
  if (heal && A.hp <= 20) {
    castSpell(st, "a", heal.i, { side: "a", hero: true });
    st.lastLog = `对手使用「${heal.c.name}」恢复了生命`;
    return true;
  }
  // 铺随从(优先大体格)
  const mins = can.filter((h) => h.c.type === "m").sort((x, y) => y.c.cost - x.c.cost || y.c.atk - x.c.atk);
  if (mins.length && A.board.length < 6) {
    playMinion(st, "a", mins[0].i);
    st.lastLog = `对手打出了「${mins[0].c.name}」`;
    return true;
  }
  // 强化
  const bf = can.find((h) => h.c.sp && h.c.sp.k === "buff");
  if (bf && A.board.length) {
    const m = [...A.board].sort((a, b) => b.atk + b.hp - (a.atk + a.hp))[0];
    castSpell(st, "a", bf.i, { side: "a", uid: m.uid });
    st.lastLog = `对手对「${m.name}」使用了「${bf.c.name}」`;
    return true;
  }
  // 抽牌
  const dr = can.find((h) => h.c.sp && h.c.sp.k === "draw");
  if (dr && A.hand.length <= 5 && A.deck.length > 2) {
    castSpell(st, "a", dr.i, null);
    st.lastLog = `对手使用了「${dr.c.name}」`;
    return true;
  }
  // 残局烧脸
  if (dmg.length && P.hp <= 15) {
    castSpell(st, "a", dmg[0].i, { side: "p", hero: true });
    st.lastLog = `对手使用「${dmg[0].c.name}」攻击你的英雄`;
    return true;
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
    if (total >= st.p.hp) tgt = { hero: true };
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
  resolveAttack(st, "a", m.uid, tgt);
  st.lastLog = `对手的「${m.name}」攻击了${tgt.hero ? "你的英雄" : `「${tname}」`}`;
  return true;
}
function computeAiTurn(b) {
  const snaps = [];
  let st = clone(b);
  const push = () => snaps.push(clone(st));
  st.fx = [];
  startTurn(st, "a");
  if (!st.winner) st.lastLog = "对手抽了一张牌";
  push();
  if (st.winner) return snaps;
  let g = 0;
  while (g++ < 12 && !st.winner) { st.fx = []; if (!aiPlay(st)) break; push(); }
  g = 0;
  while (g++ < 12 && !st.winner) { st.fx = []; if (!aiAttack(st)) break; push(); }
  return snaps;
}

function initGame() {
  const st = {
    phase: "play", turn: "p", turnNum: 1, winner: null, fx: [],
    lastLog: "对决开始!点击手牌查看,再次点击打出。",
    banner: { text: "决斗开始!", id: Date.now() },
    p: { hp: 30, mana: 0, maxMana: 0, fatigue: 0, deck: buildDeck(), hand: [], board: [] },
    a: { hp: 30, mana: 0, maxMana: 0, fatigue: 0, deck: buildDeck(), hand: [], board: [] },
  };
  draw(st, "p", 3);
  draw(st, "a", 4);
  startTurn(st, "p");
  return st;
}

const CSS = `
@keyframes fUp{0%{opacity:1;transform:translate(-50%,0) scale(1.25)}100%{opacity:0;transform:translate(-50%,-36px) scale(.9)}}
@keyframes pulseR{0%,100%{box-shadow:0 0 0 3px rgba(248,80,80,.95),0 0 14px rgba(248,80,80,.8)}50%{box-shadow:0 0 0 2px rgba(248,80,80,.45),0 0 5px rgba(248,80,80,.35)}}
@keyframes banner{0%{opacity:0;transform:scale(.5)}18%{opacity:1;transform:scale(1.08)}32%{transform:scale(1)}70%{opacity:1}100%{opacity:0;transform:scale(1.02)}}
`;

// ================= 组件 =================
export default function ArcaneThrone() {
  const [game, setGame] = useState({ phase: "menu" });
  const [selHand, setSelHand] = useState(null);
  const [selAtk, setSelAtk] = useState(null);
  const [hint, setHint] = useState(null);
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
    setGame(initGame());
  };

  function handleHand(i) {
    if (!myTurn) return;
    const en = game.p.hand[i];
    if (!en) return;
    const c = byId[en.cid];
    if (selHand !== i) {
      setSelHand(i); setSelAtk(null);
      if (c.cost > game.p.mana) setHint({ t: "法力水晶不足", id: Date.now() });
      else if (c.sp && c.sp.t === "fm" && !game.p.board.length) setHint({ t: "场上没有可选目标", id: Date.now() });
      else if (c.sp && (c.sp.t === "any" || c.sp.t === "fm")) setHint({ t: "点击目标施放法术", id: Date.now() });
      return;
    }
    if (c.cost > game.p.mana) { setHint({ t: "法力水晶不足", id: Date.now() }); return; }
    if (c.type === "m") {
      if (game.p.board.length >= 6) { setHint({ t: "随从区已满(最多 6 个)", id: Date.now() }); return; }
      mutate((st) => { playMinion(st, "p", i); st.lastLog = `你打出了「${c.name}」`; });
      setSelHand(null);
    } else if (!(c.sp.t === "any" || c.sp.t === "fm")) {
      mutate((st) => { castSpell(st, "p", i, null); st.lastLog = `你施放了「${c.name}」`; });
      setSelHand(null);
    } else setHint({ t: "点击目标施放法术", id: Date.now() });
  }

  function clickEntity(side, uid) {
    if (!myTurn) return;
    const selCard = selHand != null && game.p.hand[selHand] ? byId[game.p.hand[selHand].cid] : null;
    if (selCard && selCard.sp && (selCard.sp.t === "any" || selCard.sp.t === "fm") && selCard.cost <= game.p.mana) {
      if (selCard.sp.t === "fm" && (side !== "p" || !uid)) return;
      const idx = selHand;
      mutate((st) => {
        castSpell(st, "p", idx, uid ? { side, uid } : { side, hero: true });
        st.lastLog = `你施放了「${selCard.name}」`;
      });
      setSelHand(null);
      return;
    }
    if (side === "p" && uid) {
      const m = game.p.board.find((x) => x.uid === uid);
      if (!m) return;
      if (m.sick) { setHint({ t: "刚上场的随从需等待一回合(冲锋除外)", id: Date.now() }); return; }
      if (m.attacked) { setHint({ t: "该随从本回合已攻击过", id: Date.now() }); return; }
      const next = selAtk === uid ? null : uid;
      setSelAtk(next); setSelHand(null);
      if (next) setHint({ t: "点击敌方随从或英雄发起攻击", id: Date.now() });
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
          resolveAttack(st, "p", a, { uid });
          st.lastLog = `你的「${A ? A.name : "随从"}」攻击了「${t.name}」`;
        });
      } else {
        if (taunts.length) { setHint({ t: "必须先攻击带 🛡️ 嘲讽的随从", id: Date.now() }); return; }
        mutate((st) => {
          const A = st.p.board.find((x) => x.uid === a);
          resolveAttack(st, "p", a, { hero: true });
          st.lastLog = `你的「${A ? A.name : "随从"}」攻击了敌方英雄`;
        });
      }
      setSelAtk(null);
    }
  }

  function endTurn() {
    if (!myTurn) return;
    setSelHand(null); setSelAtk(null);
    const base = clone(gameRef.current);
    base.turn = "a";
    base.banner = { text: "对手回合", id: Date.now() };
    base.lastLog = "对手回合开始";
    base.fx = [];
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
        if (!st.winner) st.lastLog = "你的回合 — 抽了一张牌";
        return st;
      });
    }, 750 * (snaps.length + 1));
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
  const spellTargeting = !!(selCard && selCard.sp && (selCard.sp.t === "any" || selCard.sp.t === "fm") && selCard.cost <= (game.p ? game.p.mana : 0));
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

  const Badge = ({ pos, v, bg }) => (
    <span style={{ position: "absolute", bottom: -7, [pos === "bl" ? "left" : "right"]: -7, width: 22, height: 22, borderRadius: "50%", background: bg, border: "2px solid #e7cf8e", color: "#fff", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", textShadow: "0 1px 2px #000", zIndex: 5 }}>
      {v}
    </span>
  );

  const MinionEl = ({ side, m }) => {
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

  const HeroEl = ({ side }) => {
    const h = game[side];
    const tgt = isT(side, null);
    return (
      <div
        onClick={(e) => { e.stopPropagation(); clickEntity(side, null); }}
        style={{ position: "relative", display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "4px 10px", borderRadius: 12, background: "rgba(0,0,0,.28)", border: "2px solid " + (side === "p" ? "#d9b85c" : "#a06bc4"), animation: tgt ? "pulseR 1s infinite" : "none" }}
      >
        <span style={{ fontSize: 30 }}>{side === "p" ? "🤴" : "💀"}</span>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#f4e6c1", whiteSpace: "nowrap" }}>{side === "p" ? "圣辉骑士(你)" : "死灵领主"}</div>
          <div style={{ fontSize: 15, fontWeight: 900, color: "#ff8585" }}>❤️ {h.hp}</div>
        </div>
        {floats(side + "-hero")}
      </div>
    );
  };

  const HandCard = ({ en, i }) => {
    const c = byId[en.cid];
    const sel = selHand === i;
    const afford = c.cost <= game.p.mana && myTurn;
    return (
      <div
        onClick={(e) => { e.stopPropagation(); handleHand(i); }}
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
        <span style={{ position: "absolute", top: -6, left: -6, width: 20, height: 20, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%,#9fd6ff,#1f63c4 60%,#0b3a7e)", border: "2px solid #cfe6ff", color: "#fff", fontSize: 11, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 5 }}>
          {c.cost}
        </span>
        <span style={{ fontSize: 22, lineHeight: 1 }}>{c.emoji}</span>
        <span style={{ fontSize: 9, color: "#f7ecd2", fontWeight: 700, textAlign: "center", lineHeight: 1.15 }}>{c.name}</span>
        {c.type === "m" ? (
          <>
            <Badge pos="bl" v={c.atk} bg="#b8860b" />
            <Badge pos="br" v={c.hp} bg="#7f1d1d" />
          </>
        ) : (
          <span style={{ fontSize: 8, color: "#aebdf2" }}>法术</span>
        )}
        {(c.taunt || c.charge) && <span style={{ position: "absolute", top: 2, right: 2, fontSize: 9 }}>{c.taunt ? "🛡️" : "⚡"}</span>}
      </div>
    );
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
          🛡️ <b>嘲讽</b>:敌人必须先攻击该随从<br />
          ⚡ <b>冲锋</b>:登场当回合即可攻击<br />
          🃏 牌库抽空后,每次抽牌受到递增的疲劳伤害
        </div>
        <div style={{ maxWidth: 340, color: "#bfae84", fontSize: 12, lineHeight: 1.9, textAlign: "center" }}>
          操作:点击手牌查看 → <b>再次点击打出</b>;指向性法术点击目标施放;<br />
          点击我方随从,再点击敌方目标即可发起攻击。
        </div>
        <button onClick={start} style={goldBtn}>开 始 对 战</button>
      </div>
    );
  }

  // ---------- 对战界面 ----------
  return (
    <div style={outer}>
      <style>{CSS}</style>

      {/* 顶栏:敌方 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", background: "linear-gradient(180deg,#523c20,#3a2a14)", borderBottom: "2px solid #8a6d3b", gap: 8 }}>
        <HeroEl side="a" />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
          <div style={{ display: "flex" }}>
            {Array.from({ length: Math.min(game.a.hand.length, 8) }).map((_, i) => (
              <div key={i} style={{ width: 18, height: 26, marginLeft: i ? -7 : 0, borderRadius: 3, background: "linear-gradient(160deg,#5b3fa0,#2c1d52)", border: "1px solid #9d86d9" }} />
            ))}
          </div>
          <span style={{ fontSize: 10, color: "#cdbf9a" }}>手牌 {game.a.hand.length} · 牌库 {game.a.deck.length}</span>
        </div>
      </div>

      {/* 战场 */}
      <div onClick={() => { setSelHand(null); setSelAtk(null); }} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-evenly", padding: "4px 4px", minHeight: 230 }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 12, minHeight: 88, alignItems: "center", overflowX: "auto", padding: "10px 4px" }}>
          {game.a.board.length ? game.a.board.map((m) => <MinionEl key={m.uid} side="a" m={m} />) : <span style={{ color: "rgba(230,220,180,.25)", fontSize: 11, letterSpacing: 3 }}>— 敌 方 空 场 —</span>}
        </div>

        {/* 中线 */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 8px" }}>
          <span style={{ fontSize: 10, color: "#bfae84", whiteSpace: "nowrap" }}>回合 {game.turnNum}</span>
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
          {game.p.board.length ? game.p.board.map((m) => <MinionEl key={m.uid} side="p" m={m} />) : <span style={{ color: "rgba(230,220,180,.25)", fontSize: 11, letterSpacing: 3 }}>— 我 方 空 场 —</span>}
        </div>
      </div>

      {/* 选中卡牌大图预览 */}
      {selCard && (
        <div style={{ position: "absolute", bottom: 138, left: "50%", transform: "translateX(-50%)", zIndex: 70, pointerEvents: "none", width: 156, borderRadius: 12, padding: "10px 8px", background: selCard.type === "m" ? "linear-gradient(170deg,#7a5c33,#3c2b12)" : "linear-gradient(170deg,#3d4f8a,#1d2244)", border: "2px solid #ffd700", boxShadow: "0 8px 24px rgba(0,0,0,.7)", textAlign: "center" }}>
          <div style={{ fontSize: 34 }}>{selCard.emoji}</div>
          <div style={{ color: "#ffe9b0", fontWeight: 800, fontSize: 14 }}>{selCard.name}</div>
          <div style={{ color: "#9fd6ff", fontSize: 11, fontWeight: 700 }}>
            {selCard.cost} 费{selCard.type === "m" ? ` · ${selCard.atk} 攻 / ${selCard.hp} 血` : " · 法术"}
          </div>
          <div style={{ color: "#e8dcc0", fontSize: 11, marginTop: 3, lineHeight: 1.4 }}>
            {kw(selCard)}{selCard.desc}
          </div>
          <div style={{ color: "#ffd700", fontSize: 10, marginTop: 5, fontStyle: "italic" }}>
            {selCard.type === "m" || !(selCard.sp.t === "any" || selCard.sp.t === "fm") ? "再次点击卡牌打出" : "点击目标施放"}
          </div>
        </div>
      )}

      {/* 手牌 */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", padding: "18px 6px 8px", minHeight: 108 }}>
        {game.p.hand.length ? game.p.hand.map((en, i) => <HandCard key={en.uid} en={en} i={i} />) : <span style={{ color: "#8a8468", fontSize: 12 }}>(手牌为空)</span>}
      </div>

      {/* 底栏:我方 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", background: "linear-gradient(0deg,#523c20,#3a2a14)", borderTop: "2px solid #8a6d3b", gap: 8 }}>
        <HeroEl side="p" />
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
          <span style={{ fontSize: 60 }}>{game.winner === "p" ? "🏆" : "💀"}</span>
          <span style={{ fontSize: 36, fontWeight: 900, color: game.winner === "p" ? "#ffd700" : "#b9b9c9", textShadow: "0 2px 8px #000", letterSpacing: 10 }}>
            {game.winner === "p" ? "胜 利" : "战 败"}
          </span>
          <span style={{ color: "#cbbd96", fontSize: 13, textAlign: "center" }}>
            {game.winner === "p" ? "死灵领主被击败了!王国恢复了和平。" : "圣辉骑士倒下了……下次再战!"}
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
