// ================= 展示组件(模块顶层,避免每次渲染重挂载导致 transition 失效) =================
// 新增展示组件请保持定义在模块顶层的写法,不要移回主组件内部
import { useState, type ReactNode } from "react";
import { CLASS_META, RARITY, byId, kw } from "../cards";
import { heroAtkVal, spSummary } from "../engine";
import type { Card, Minion, Side, SideState } from "../types";

export const CSS = `
@keyframes fUp{0%{opacity:1;transform:translate(-50%,0) scale(1.25)}100%{opacity:0;transform:translate(-50%,-36px) scale(.9)}}
@keyframes pulseR{0%,100%{box-shadow:0 0 0 3px rgba(248,80,80,.95),0 0 14px rgba(248,80,80,.8)}50%{box-shadow:0 0 0 2px rgba(248,80,80,.45),0 0 5px rgba(248,80,80,.35)}}
@keyframes banner{0%{opacity:0;transform:scale(.5)}18%{opacity:1;transform:scale(1.08)}32%{transform:scale(1)}70%{opacity:1}100%{opacity:0;transform:scale(1.02)}}
@keyframes noticeFx{0%{opacity:0;transform:translateY(12px)}10%{opacity:1;transform:translateY(0)}80%{opacity:1}100%{opacity:0}}
@keyframes frostShimmer{0%,100%{box-shadow:inset 0 0 12px rgba(210,245,255,.85),0 0 10px rgba(120,200,255,.7)}50%{box-shadow:inset 0 0 18px rgba(235,250,255,1),0 0 16px rgba(150,220,255,.95)}}
`;

export type FloatsFn = (key: string) => ReactNode;
export type ClickEntityFn = (side: Side, uid: number | null) => void;
export type IsTargetFn = (side: Side, uid: number | null) => boolean;

export const Badge = ({ pos, v, bg, size = 28 }: { pos: "bl" | "br"; v: number; bg: string; size?: number }) => (
  <span style={{ position: "absolute", bottom: -size / 3.5, [pos === "bl" ? "left" : "right"]: -size / 3.5, width: size, height: size, borderRadius: "50%", background: bg, border: "2px solid #e7cf8e", color: "#fff", fontSize: size * 0.54, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", textShadow: "0 1px 2px #000", zIndex: 5 }}>
    {v}
  </span>
);

export const MinionEl = ({ side, m, myTurn, selAtk, isT, clickEntity, floats }: {
  side: Side; m: Minion; myTurn: boolean; selAtk: number | null;
  isT: IsTargetFn; clickEntity: ClickEntityFn; floats: FloatsFn;
}) => {
  const mine = side === "p";
  const ready = mine && myTurn && !m.attacked && !m.frozen && (!m.sick || m.rush); // 突袭随从在 sick 期间也可行动(打随从);冻结时不可行动
  const sel = selAtk === m.uid;
  const tgt = isT(side, m.uid);
  // 悬停时在随从旁边弹出详情:用 position:fixed + 记录的随从矩形,可越过战场容器的 overflow 裁剪
  const [hovRect, setHovRect] = useState<DOMRect | null>(null);
  const card = byId[m.cid];
  return (
    <div
      data-muid={`${side}-${m.uid}`}
      onClick={(e) => { e.stopPropagation(); clickEntity(side, m.uid); }}
      onMouseEnter={(e) => setHovRect(e.currentTarget.getBoundingClientRect())}
      onMouseLeave={() => setHovRect(null)}
      style={{
        width: 76, height: 96, borderRadius: m.taunt ? 22 : 13, position: "relative", cursor: "pointer", flexShrink: 0,
        background: mine ? "linear-gradient(160deg,#6b5430,#41331a)" : "linear-gradient(160deg,#4a3354,#2c1d33)",
        border: m.taunt ? "3px solid #9aa5b1" : "2px solid " + (mine ? "#c9a85a" : "#8a6da8"),
        boxShadow: tgt ? "none" : sel ? "0 0 0 3px #ffd700,0 0 14px #ffd700" : ready ? "0 0 10px rgba(80,220,100,.85),0 0 0 2px rgba(80,220,100,.6)" : "0 2px 5px rgba(0,0,0,.5)",
        animation: tgt ? "pulseR 1s infinite" : "none",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <span style={{ fontSize: 34 }}>{m.emoji}</span>
      {m.frozen && (
        <div title="冻结:下个回合无法攻击" style={{ position: "absolute", inset: 0, borderRadius: m.taunt ? 22 : 13, background: "linear-gradient(160deg,rgba(160,225,255,.5),rgba(90,160,230,.4))", border: "2px solid #cdeeff", animation: "frostShimmer 1.6s ease-in-out infinite", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 4 }}>
          <span style={{ fontSize: 24, filter: "drop-shadow(0 0 4px #fff)" }}>❄️</span>
        </div>
      )}
      {m.taunt && <span style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", fontSize: 14 }}>🛡️</span>}
      {m.charge && <span style={{ position: "absolute", top: 3, right: 4, fontSize: 12 }}>⚡</span>}
      {m.rush && !m.charge && <span title="突袭" style={{ position: "absolute", top: 3, right: 4, fontSize: 12 }}>💨</span>}
      {m.sick && !m.rush && mine && <span style={{ position: "absolute", top: 3, left: 4, fontSize: 12 }}>💤</span>}
      <Badge pos="bl" v={m.atk} bg="#b8860b" />
      <Badge pos="br" v={m.hp} bg={m.hp < m.maxHp ? "#dc2626" : "#7f1d1d"} />
      {floats("m" + m.uid)}
      {hovRect && (
        <div style={{
          position: "fixed", zIndex: 90, width: 152, borderRadius: 11, padding: "9px 8px", textAlign: "center",
          pointerEvents: "none", boxShadow: "0 8px 24px rgba(0,0,0,.7)",
          left: hovRect.left + hovRect.width / 2, transform: "translateX(-50%)",
          ...(mine ? { bottom: window.innerHeight - hovRect.top + 8 } : { top: hovRect.bottom + 8 }),
          background: mine ? "linear-gradient(170deg,#7a5c33,#3c2b12)" : "linear-gradient(170deg,#4a3354,#241a2c)",
          border: "2px solid " + (mine ? "#c9a85a" : "#a06bc4"),
        }}>
          <div style={{ fontSize: 30 }}>{m.emoji}</div>
          <div style={{ color: card && card.rarity !== "c" ? RARITY[card.rarity].color : "#ffe9b0", fontWeight: 800, fontSize: 14, textShadow: "0 1px 2px #000" }}>{m.name}</div>
          {card && <div style={{ color: RARITY[card.rarity].color, fontSize: 11, fontWeight: 800 }}>◆ {RARITY[card.rarity].label}</div>}
          <div style={{ color: "#9fd6ff", fontSize: 12, fontWeight: 700 }}>{m.atk} 攻 / {m.hp}{m.hp < m.maxHp ? `/${m.maxHp}` : ""} 血</div>
          <div style={{ color: "#e8dcc0", fontSize: 12, marginTop: 3, lineHeight: 1.45 }}>
            {m.frozen && <span style={{ color: "#bfe9ff", fontWeight: 700 }}>❄️ 已冻结 </span>}
            {kw(m)}{card ? card.desc : ""}
          </div>
          <div style={{ color: mine ? "#c9a85a" : "#cf9aef", fontSize: 11, marginTop: 4, fontStyle: "italic" }}>{mine ? "我方随从" : "敌方随从"}</div>
        </div>
      )}
    </div>
  );
};

// 英雄区:左=装备的武器(无则不渲染) | 中=英雄图标+下方名字/生命/护甲(攻击力在左下角 Badge) | 右=英雄技能。
// 武器与技能均为鼠标悬停弹出自定义详情浮层;己方技能可点击直接使用,敌方技能仅查看。
export const HeroEl = ({ side, h, isT, clickEntity, floats, canAtk = false, sel = false, onHeroPower, canUseHeroPower = false, heroPowerCost = 2 }: {
  side: Side; h: SideState; isT: IsTargetFn; clickEntity: ClickEntityFn; floats: FloatsFn;
  canAtk?: boolean; sel?: boolean; // canAtk:本回合英雄可攻击(绿光);sel:已被选为攻击者(金框)
  onHeroPower?: () => void; canUseHeroPower?: boolean; heroPowerCost?: number; // 己方技能使用回调与可用状态
}) => {
  const [hov, setHov] = useState<"w" | "p" | null>(null);
  const tgt = isT(side, null);
  const cls = h.classId ? CLASS_META[h.classId] : null;
  const atk = heroAtkVal(h);
  const w = h.weapon;
  const wc = w ? byId[w.cid] : null;
  const pw = cls ? cls.power : null;
  const mine = side === "p";
  // 悬停详情浮层朝战场方向展开:玩家(下栏)向上、AI(上栏)向下
  const panelBase = {
    position: "absolute" as const, zIndex: 80, width: 168, borderRadius: 12, padding: "10px 11px",
    textAlign: "center" as const, boxShadow: "0 8px 24px rgba(0,0,0,.7)", pointerEvents: "none" as const,
    ...(mine ? { bottom: "calc(0% - 8px)" } : { top: "calc(0% - 8px)" }),
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {/* 左:武器(无则不渲染) */}
      {w && (
        <div
          onMouseEnter={() => setHov("w")}
          onMouseLeave={() => setHov((v) => (v === "w" ? null : v))}
          style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 58, height: 60, borderRadius: 12, flexShrink: 0, cursor: "help",
            border: "2px solid #b9a05a", background: "linear-gradient(180deg,#5b5240,#33301f)", color: "#f0e3bf" }}
        >
          <span style={{ fontSize: 22, lineHeight: 1 }}>{wc ? wc.emoji : "🗡️"}</span>
          <span style={{ fontSize: 11, fontWeight: 900, marginTop: 2 }}>
            <span style={{ color: "#ffd45e" }}>{w.atk}</span>
            <span style={{ color: "#9aa5b1" }}> / </span>
            <span style={{ color: "#bfe0ff" }}>{w.dur}</span>
          </span>
          {hov === "w" && (
            <div style={{ ...panelBase, right: 80, background: "linear-gradient(170deg,#5b5240,#2c2818)", border: "2px solid #b9a05a" }}>
              <div style={{ fontSize: 30 }}>{wc ? wc.emoji : "🗡️"}</div>
              <div style={{ color: "#ffe9b0", fontWeight: 800, fontSize: 14 }}>{wc ? wc.name : "武器"}</div>
              <div style={{ color: "#9fd6ff", fontSize: 12, fontWeight: 700, marginTop: 2 }}>{w.atk} 攻 / {w.dur} 耐久</div>
              {wc && wc.desc && <div style={{ color: "#e8dcc0", fontSize: 11, marginTop: 5, lineHeight: 1.5 }}>{wc.desc}</div>}
            </div>
          )}
        </div>
      )}

      {/* 中:英雄图标 + 下方名字 + 攻击/生命/护甲一行(从左到右;攻击、护甲为 0 不显示) */}
      <div
        data-heroel={side}
        onClick={(e) => { e.stopPropagation(); clickEntity(side, null); }}
        style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: "4px 10px", borderRadius: 14, background: "rgba(0,0,0,.28)", boxSizing: "border-box", width: 132,
          border: "2px solid " + (mine ? "#d9b85c" : "#a06bc4"),
          boxShadow: sel ? "0 0 0 3px #ffd700,0 0 14px #ffd700" : canAtk ? "0 0 10px rgba(80,220,100,.85),0 0 0 2px rgba(80,220,100,.6)" : "none",
          animation: tgt ? "pulseR 1s infinite" : "none" }}
      >
        <span style={{ fontSize: 40, lineHeight: 1 }}>
          {cls ? cls.emoji : mine ? "🤴" : "💀"}
        </span>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#f4e6c1", whiteSpace: "nowrap", marginTop: 4 }}>
          {cls ? cls.name : mine ? "英雄" : "对手"}{mine ? "(你)" : ""}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 900, whiteSpace: "nowrap", marginTop: 2 }}>
          {atk > 0 && <span style={{ color: "#ffd45e" }}>🗡️{atk}</span>}
          <span style={{ color: "#ff8585" }}>❤️{h.hp}</span>
          {h.armor > 0 && <span style={{ color: "#bfd3e6" }}>🛡️{h.armor}</span>}
        </div>
        {floats(side + "-hero")}
      </div>

      {/* 右:英雄技能(无职业则不渲染) */}
      {pw && (
        <div
          onMouseEnter={() => setHov("p")}
          onMouseLeave={() => setHov((v) => (v === "p" ? null : v))}
          onClick={(e) => { e.stopPropagation(); if (mine && canUseHeroPower && onHeroPower) onHeroPower(); }}
          style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 58, height: 60, borderRadius: 12, flexShrink: 0,
            cursor: mine ? (canUseHeroPower ? "pointer" : "default") : "help",
            border: "2px solid " + (mine ? (canUseHeroPower ? "#f0d98c" : "#6b6452") : "#a06bc4"),
            background: mine ? (canUseHeroPower ? "linear-gradient(180deg,#5a4a8c,#33285e)" : "#3a3530") : "linear-gradient(180deg,#4a3354,#241a2c)",
            color: mine ? (canUseHeroPower ? "#ffe9b0" : "#8a8470") : "#e8dcc0",
            boxShadow: mine && canUseHeroPower ? "0 0 10px rgba(150,120,255,.5)" : "none" }}
        >
          <span style={{ fontSize: 20, lineHeight: 1 }}>{pw.emoji}</span>
          <span style={{ fontSize: 9.5, fontWeight: 800, marginTop: 2, whiteSpace: "nowrap" }}>{pw.name}</span>
          <span style={{ fontSize: 9, color: mine ? (canUseHeroPower ? "#9fd6ff" : "#8a8470") : "#cf9aef" }}>💧{heroPowerCost}</span>
          {hov === "p" && cls && (
            <div style={{ ...panelBase, left: 80, background: "linear-gradient(170deg,#3a3050,#221a30)", border: "2px solid " + (mine ? "#d9b85c" : "#a06bc4") }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#cdbf9a" }}>{cls.emoji} {cls.name} · {mine ? "你的英雄技能" : "对手英雄技能"}</div>
              <div style={{ fontSize: 30, marginTop: 2 }}>{pw.emoji}</div>
              <div style={{ color: "#ffe9b0", fontWeight: 800, fontSize: 14 }}>{pw.name}</div>
              <div style={{ color: "#9fd6ff", fontSize: 11, fontWeight: 700, marginTop: 2 }}>消耗 {heroPowerCost} 法力 · 每回合一次</div>
              <div style={{ color: "#e8dcc0", fontSize: 11, marginTop: 5, lineHeight: 1.5 }}>{pw.desc}</div>
              {mine && <div style={{ color: canUseHeroPower ? "#9be29b" : "#e0a85c", fontSize: 10, marginTop: 5, fontWeight: 700 }}>{canUseHeroPower ? "点击直接使用" : h.heroPowerUsed ? "本回合已使用" : "法力不足 / 非你的回合"}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const HandCard = ({ c, transformed, i, selHand, mana, myTurn, handleHand, setHovHand, cost, bonus }: {
  c: Card; transformed: boolean; i: number; selHand: number | null; mana: number; myTurn: boolean;
  handleHand: (i: number) => void; setHovHand: (i: number | null) => void;
  cost: number; bonus: number;
}) => {
  const sel = selHand === i;
  const afford = cost <= mana && myTurn;
  const discounted = cost < c.cost;
  return (
    <div
      data-hand={i}
      onClick={(e) => { e.stopPropagation(); handleHand(i); }}
      onMouseEnter={() => setHovHand(i)}
      style={{
        width: "clamp(72px,17vw,90px)", height: "clamp(106px,24vw,128px)", marginLeft: i === 0 ? 0 : "-12px",
        borderRadius: 11, position: "relative", cursor: "pointer", flexShrink: 0,
        transform: sel ? "translateY(-20px) scale(1.12)" : "none", transition: "transform .15s",
        zIndex: sel ? 40 : 10 + i,
        background: c.type === "m" ? "linear-gradient(170deg,#7a5c33,#4a3517 70%)" : c.type === "w" ? "linear-gradient(170deg,#5e6470,#2e3138 70%)" : "linear-gradient(170deg,#3d4f8a,#23284e 70%)",
        border: sel ? "2px solid #ffd700" : "2px solid " + (transformed ? "#b66be0" : c.type === "m" ? "#caa45c" : c.type === "w" ? "#aab2be" : "#7d90d8"),
        boxShadow: sel ? "0 6px 16px rgba(0,0,0,.6),0 0 12px rgba(255,215,0,.5)" : transformed ? "0 3px 6px rgba(0,0,0,.55),0 0 10px rgba(182,107,224,.7)" : "0 3px 6px rgba(0,0,0,.55)",
        filter: afford ? "none" : "grayscale(.7) brightness(.72)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, padding: "6px 3px",
      }}
    >
      <span style={{ position: "absolute", top: -8, left: -8, width: 26, height: 26, borderRadius: "50%", background: discounted ? "radial-gradient(circle at 35% 30%,#b9f2c4,#1f9c44 60%,#0b5e26)" : "radial-gradient(circle at 35% 30%,#9fd6ff,#1f63c4 60%,#0b3a7e)", border: "2px solid " + (discounted ? "#d6f5dc" : "#cfe6ff"), color: "#fff", fontSize: 14, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 5 }}>
        {cost}
      </span>
      <span style={{ fontSize: 29, lineHeight: 1 }}>{c.emoji}</span>
      <span style={{ fontSize: 13, color: c.rarity === "c" ? "#f7ecd2" : RARITY[c.rarity].color, fontWeight: 700, textAlign: "center", lineHeight: 1.15, textShadow: "0 1px 2px #000" }}>{c.name}</span>
      {c.type === "m" ? (
        <>
          <Badge pos="bl" v={c.atk} bg="#b8860b" />
          <Badge pos="br" v={c.hp} bg="#7f1d1d" />
        </>
      ) : c.type === "w" ? (
        <>
          <Badge pos="bl" v={c.atk} bg="#b8860b" />
          <Badge pos="br" v={c.dur} bg="#2f6f9e" />
        </>
      ) : (
        <span style={{ fontSize: 13, color: "#aebdf2", fontWeight: 700 }}>{spSummary(c.sp, bonus)}</span>
      )}
      {(c.taunt || c.charge || c.rush) && <span style={{ position: "absolute", top: 3, right: 3, fontSize: 12 }}>{c.taunt ? "🛡️" : c.charge ? "⚡" : "💨"}</span>}
      {transformed && <span title="殒命暗影:已变为上一张法术" style={{ position: "absolute", top: -8, right: -7, fontSize: 15, filter: "drop-shadow(0 0 3px #b66be0)" }}>🌑</span>}
    </div>
  );
};
