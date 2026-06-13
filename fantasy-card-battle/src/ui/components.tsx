// ================= 展示组件(模块顶层,避免每次渲染重挂载导致 transition 失效) =================
// 新增展示组件请保持定义在模块顶层的写法,不要移回主组件内部
import type { ReactNode } from "react";
import { byId, RARITY, spSummary } from "../cards";
import type { HandEntry, Minion, Side, SideState } from "../types";

export const CSS = `
@keyframes fUp{0%{opacity:1;transform:translate(-50%,0) scale(1.25)}100%{opacity:0;transform:translate(-50%,-36px) scale(.9)}}
@keyframes pulseR{0%,100%{box-shadow:0 0 0 3px rgba(248,80,80,.95),0 0 14px rgba(248,80,80,.8)}50%{box-shadow:0 0 0 2px rgba(248,80,80,.45),0 0 5px rgba(248,80,80,.35)}}
@keyframes banner{0%{opacity:0;transform:scale(.5)}18%{opacity:1;transform:scale(1.08)}32%{transform:scale(1)}70%{opacity:1}100%{opacity:0;transform:scale(1.02)}}
@keyframes noticeFx{0%{opacity:0;transform:translateY(12px)}10%{opacity:1;transform:translateY(0)}80%{opacity:1}100%{opacity:0}}
`;

export type FloatsFn = (key: string) => ReactNode;
export type ClickEntityFn = (side: Side, uid: number | null) => void;
export type IsTargetFn = (side: Side, uid: number | null) => boolean;

export const Badge = ({ pos, v, bg }: { pos: "bl" | "br"; v: number; bg: string }) => (
  <span style={{ position: "absolute", bottom: -7, [pos === "bl" ? "left" : "right"]: -7, width: 22, height: 22, borderRadius: "50%", background: bg, border: "2px solid #e7cf8e", color: "#fff", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", textShadow: "0 1px 2px #000", zIndex: 5 }}>
    {v}
  </span>
);

export const MinionEl = ({ side, m, myTurn, selAtk, isT, clickEntity, floats }: {
  side: Side; m: Minion; myTurn: boolean; selAtk: number | null;
  isT: IsTargetFn; clickEntity: ClickEntityFn; floats: FloatsFn;
}) => {
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

export const HeroEl = ({ side, h, isT, clickEntity, floats }: {
  side: Side; h: SideState; isT: IsTargetFn; clickEntity: ClickEntityFn; floats: FloatsFn;
}) => {
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

export const HandCard = ({ en, i, selHand, mana, myTurn, handleHand, setHovHand, cost, bonus }: {
  en: HandEntry; i: number; selHand: number | null; mana: number; myTurn: boolean;
  handleHand: (i: number) => void; setHovHand: (i: number | null) => void;
  cost: number; bonus: number;
}) => {
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
