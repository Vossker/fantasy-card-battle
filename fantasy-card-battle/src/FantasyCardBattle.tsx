// ================= 主组件:菜单 / 牌组构建 / 对战 UI =================
import { useState, useRef, useEffect, type CSSProperties } from "react";
import {
  POOL, RARITY, byId, maxCopies, HAND_LIMIT, kw, cardDesc, spTarget,
  MAX_DECKS, loadDecks, saveDecks, loadActiveDeckId, saveActiveDeckId, genDeckId, type SavedDeck,
  CLASS_IDS, CLASS_META, HERO_POWER_COST, cardInClass, isNeutral,
} from "./cards";
import {
  clone, log, effCost, effCard, afterSpellPlayed, endTurnCleanup, initGame, startTurn, thawFrozen,
  playMinion, playWeapon, castSpell, castDeckSpell, resolveAttack, resolveHeroAttack, useHeroPower,
  heroAtkVal, removeFromDeck, summonFromDeck,
  sampleDeck, sampleDeckAny, campEffect, campLabel, applyOpt, moonTutor, gainMoonCopy, spSummary,
  draw, dredgePick, mapTake, mapDrawLeft,
} from "./engine";
import { computeAiTurn } from "./ai";
import { CSS, MinionEl, HeroEl, HandCard, Badge } from "./ui/components";
import type { BloomMode, CampOpt, ClassId, GameState, Side } from "./types";

type DeckTab = ClassId | "neutral";

// 主菜单 / 牌组构建阶段没有对局数据;进入 play/over 后是完整 GameState
interface LobbyState extends Partial<Omit<GameState, "phase">> {
  phase: "menu" | "deck";
}
type UiGame = GameState | LobbyState;

export default function ArcaneThrone() {
  const [game, setGame] = useState<UiGame>({ phase: "menu" });
  const [selHand, setSelHand] = useState<number | null>(null);
  const [selAtk, setSelAtk] = useState<number | null>(null);
  const [selHeroAtk, setSelHeroAtk] = useState(false); // 已选中我方英雄作为攻击者
  const [hint, setHint] = useState<{ t: string; id: number } | null>(null);
  const [hovHand, setHovHand] = useState<number | null>(null);
  const [inspect, setInspect] = useState<{ side: Side; uid: number } | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [showRules, setShowRules] = useState(false); // 主菜单「对战规则」弹窗
  const [confirmSurrender, setConfirmSurrender] = useState(false);
  const [decks, setDecks] = useState<SavedDeck[]>(loadDecks);
  const [activeId, setActiveId] = useState<string | null>(loadActiveDeckId);
  const [deckSel, setDeckSel] = useState<number[]>([]);
  const [poolPage, setPoolPage] = useState(0); // 卡池分页(每页 20 张)
  const [editingId, setEditingId] = useState<string | null>(null); // 当前编辑的牌组(null = 新建)
  const [deckName, setDeckName] = useState("");
  const [deckMsg, setDeckMsg] = useState("");
  const [rightMode, setRightMode] = useState<"list" | "preview">("list"); // 右侧面板:牌组列表 / 当前牌组实时预览
  const [buildClass, setBuildClass] = useState<ClassId | null>(null); // 当前正在构建/编辑的牌组职业(null = 仅浏览)
  const [deckTab, setDeckTab] = useState<DeckTab>("druid"); // 卡池筛选标签
  const [choosingClass, setChoosingClass] = useState(false); // 新建牌组:职业选择界面
  const [hovPrevCid, setHovPrevCid] = useState<number | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null); // 瞄准箭头:光标位置(viewport 坐标)
  const aimFrom = useRef<{ x: number; y: number } | null>(null); // 瞄准箭头:源单位中心
  const aiSnaps = useRef<GameState[]>([]); // 当前 AI 回合的快照序列(供"跳过"快进)
  // 激活牌组;仅当满 30 张时用于对战,否则对战使用随机牌组
  const activeDeck = decks.find((d) => d.id === activeId) || null;
  const playerDeck = activeDeck && activeDeck.cards.length === 30 ? activeDeck.cards : null;
  const gameRef = useRef(game);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

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
    if (!deckMsg) return;
    const t = setTimeout(() => setDeckMsg(""), 1800);
    return () => clearTimeout(t);
  }, [deckMsg]);
  useEffect(() => {
    if (game.phase === "play" && game.winner) {
      const t = setTimeout(() => setGame((g) => (g.phase === "play" ? { ...g, phase: "over" as const } : g)), 900);
      return () => clearTimeout(t);
    }
  }, [game.winner, game.phase]);

  const T = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms));
  const myTurn = game.phase === "play" && game.turn === "p" && !game.winner;
  const aiBusy = game.phase === "play" && game.turn === "a" && !game.winner; // AI 回合动画进行中

  // 瞄准箭头:选中攻击者 / 指向性法术时,跟随光标画一条从源单位到指针的连线
  useEffect(() => {
    if (game.phase !== "play" || !myTurn) { aimFrom.current = null; setPointer(null); return; }
    const g = game;
    const targeting =
      selAtk != null || selHeroAtk ||
      (selHand != null && !!g.p.hand[selHand] &&
        (() => {
          const c = effCard(g, "p", g.p.hand[selHand]);
          return !!spTarget(c.sp) && effCost(g, "p", c) <= g.p.mana;
        })());
    if (!targeting) { aimFrom.current = null; setPointer(null); return; }
    const sel = selHeroAtk
      ? document.querySelector(`[data-heroel="p"]`)
      : selAtk != null
      ? document.querySelector(`[data-muid="p-${selAtk}"]`)
      : document.querySelector(`[data-hand="${selHand}"]`);
    aimFrom.current = sel
      ? (() => { const r = (sel as HTMLElement).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })()
      : null;
    const move = (e: PointerEvent) => setPointer({ x: e.clientX, y: e.clientY });
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, [game, selAtk, selHeroAtk, selHand, myTurn]);
  // 状态更新统一走 mutate:深拷贝当前 state → fn 内用引擎函数修改 → setGame
  const mutate = (fn: (st: GameState) => void) =>
    setGame((g) => {
      if (g.phase !== "play" && g.phase !== "over") return g;
      const st = clone(g);
      fn(st);
      return st;
    });

  const start = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setSelHand(null); setSelAtk(null); setSelHeroAtk(false); setHint(null);
    setHovHand(null); setInspect(null); setShowLog(false);
    setConfirmSurrender(false);
    // 对战牌组完整时用其职业;否则随机牌组,职业由引擎随机选取
    const st = initGame(playerDeck, playerDeck ? activeDeck!.classId : undefined);
    if (st.turn === "a") runAiTurn(st);
    else setGame(st);
  };

  // AI 回合结束:把回合交还给玩家(快进与正常回放共用)
  function handoverToPlayer() {
    setGame((g) => {
      if (g.winner || g.phase !== "play") return g;
      const st = clone(g);
      st.turn = "p";
      st.turnNum++;
      st.fx = [];
      startTurn(st, "p");
      st.banner = { text: "你的回合", id: Date.now() };
      if (!st.winner) log(st, "你的回合 — 抽了一张牌");
      return st;
    });
  }

  function runAiTurn(base: GameState) {
    setGame(base);
    const snaps = computeAiTurn(base);
    aiSnaps.current = snaps;
    snaps.forEach((s, i) => T(() => setGame(s), 750 * (i + 1)));
    T(handoverToPlayer, 750 * (snaps.length + 1));
  }

  // 跳过 AI 回合动画:清掉未播放的定时器,直接跳到最终快照并交还回合
  function skipAi() {
    const g = gameRef.current;
    if (g.phase !== "play" || g.turn !== "a" || g.winner) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const snaps = aiSnaps.current;
    if (snaps.length) setGame(snaps[snaps.length - 1]);
    handoverToPlayer();
  }

  // 取一个未使用的默认牌组名(牌组 1、牌组 2……)
  const defaultDeckName = () => {
    for (let i = 1; ; i++) {
      const n = `牌组 ${i}`;
      if (!decks.some((d) => d.name === n)) return n;
    }
  };
  // 退出构建态,回到"仅浏览全部卡牌"的状态(右侧显示牌组列表)
  const exitBuild = () => {
    setBuildClass(null); setEditingId(null); setDeckSel([]); setDeckName("");
    setChoosingClass(false); setRightMode("list");
  };
  const openDeckBuilder = () => {
    exitBuild();
    setDeckTab("druid");
    setRenamingId(null); setConfirmDel(null); setDeckMsg("");
    setGame({ phase: "deck" });
  };
  // 点击"新建牌组":先进入职业选择界面
  const beginNewDeck = () => {
    if (decks.length >= MAX_DECKS) { setDeckMsg(`最多只能保存 ${MAX_DECKS} 个牌组`); return; }
    setChoosingClass(true);
  };
  // 选定职业后开始构建空白牌组
  const chooseClass = (cls: ClassId) => {
    setBuildClass(cls); setEditingId(null); setDeckSel([]); setDeckName(defaultDeckName());
    setDeckTab(cls); setChoosingClass(false); setRightMode("preview"); setDeckMsg("");
  };
  const persistDecks = (next: SavedDeck[]) => { setDecks(next); saveDecks(next); };
  const setActive = (id: string) => { setActiveId(id); saveActiveDeckId(id); };

  // 仅在构建态(buildClass 非空)可加牌,且卡牌须属当前职业可用
  const addCard = (id: number) =>
    setDeckSel((d) => {
      if (!buildClass || !cardInClass(byId[id], buildClass)) return d;
      if (d.length >= 30 || d.filter((x) => x === id).length >= maxCopies(byId[id])) return d;
      return [...d, id];
    });
  const removeCard = (id: number) =>
    setDeckSel((d) => {
      const i = d.indexOf(id);
      if (i < 0) return d;
      const nd = [...d];
      nd.splice(i, 1);
      return nd;
    });
  const randomFill = () =>
    setDeckSel((d) => {
      if (!buildClass) return d;
      const pool = POOL.filter((c) => cardInClass(c, buildClass!));
      const nd = [...d];
      let guard = 0;
      while (nd.length < 30 && guard++ < 500) {
        const c = pool[Math.floor(Math.random() * pool.length)];
        if (nd.filter((x) => x === c.id).length >= maxCopies(c)) continue;
        nd.push(c.id);
      }
      return nd;
    });
  // 保存当前构建区:编辑则更新原牌组,新建则追加(受 9 副上限约束);保存后停留在编辑态
  const saveDeck = () => {
    if (deckSel.length !== 30 || !buildClass) return;
    const cards = [...deckSel];
    const name = deckName.trim() || defaultDeckName();
    if (editingId) {
      persistDecks(decks.map((d) => (d.id === editingId ? { ...d, name, cards, classId: buildClass } : d)));
      setDeckMsg("已更新牌组 ✓");
    } else {
      if (decks.length >= MAX_DECKS) { setDeckMsg(`最多只能保存 ${MAX_DECKS} 个牌组`); return; }
      const id = genDeckId();
      persistDecks([...decks, { id, name, classId: buildClass, cards }]);
      setEditingId(id);
      if (!activeId) setActive(id); // 第一副牌组自动设为对战牌组
      setDeckMsg("已保存牌组 ✓");
    }
  };
  // 载入已有牌组到构建区(锁定为其职业)
  const editDeck = (d: SavedDeck) => {
    setBuildClass(d.classId); setEditingId(d.id); setDeckSel([...d.cards]); setDeckName(d.name);
    setDeckTab(d.classId); setRightMode("preview"); setRenamingId(null);
    setDeckMsg("");
  };
  const deleteDeck = (id: string) => {
    persistDecks(decks.filter((d) => d.id !== id));
    if (activeId === id) { setActiveId(null); saveActiveDeckId(null); }
    if (editingId === id) exitBuild();
    setConfirmDel(null);
  };
  const startRename = (d: SavedDeck) => { setRenamingId(d.id); setRenameText(d.name); };
  const commitRename = () => {
    if (!renamingId) return;
    const name = renameText.trim();
    if (name) {
      persistDecks(decks.map((d) => (d.id === renamingId ? { ...d, name } : d)));
      if (editingId === renamingId) setDeckName(name);
    }
    setRenamingId(null);
  };
  // ---------- 抉择处理 ----------
  // 确认夜影花蕾的模式:此时才真正支付费用并移出手牌;翻开牌库的牌后(bloomPick)不可再取消
  function pickBloomMode(mode: BloomMode) {
    mutate((st) => {
      const p = st.pending;
      if (!p || p.k !== "bloomMode") return;
      const en = st.p.hand[p.i];
      if (!en) return;
      const c = effCard(st, "p", en);
      st.p.mana -= effCost(st, "p", c);
      st.p.hand.splice(p.i, 1);
      afterSpellPlayed(st, "p", c.id);
      log(st, `你施放了「${c.name}」`);
      moonTutor(st, "p", en);
      st.pending = { k: "bloomPick", mode, opts: sampleDeck(st, "p", mode) };
    });
  }
  function pickBloomCard(idx: number) {
    mutate((st) => {
      const p = st.pending;
      if (!p || p.k !== "bloomPick") return;
      const cid = p.opts[idx];
      if (cid == null) return;
      removeFromDeck(st, "p", cid);
      if (p.mode === "m") {
        log(st, `「夜影花蕾」从你的牌库召唤了「${byId[cid].name}」`);
        summonFromDeck(st, "p", cid);
      } else {
        log(st, `「夜影花蕾」从你的牌库施放了「${byId[cid].name}」`);
        castDeckSpell(st, "p", cid);
      }
      st.pending = null;
    });
  }
  function pickCamp(opt: CampOpt) {
    mutate((st) => {
      const p = st.pending;
      if (!p || p.k !== "camp") return;
      campEffect(st, "p", opt);
      log(st, `「星夜露宿」:你抉择了${campLabel(opt)}`);
      p.remaining--;
      if (p.remaining <= 0) st.pending = null;
    });
  }
  // 确认抉择选项:此时才真正支付费用并移出手牌
  function pickChoose(idx: number) {
    mutate((st) => {
      const p = st.pending;
      if (!p || p.k !== "choose") return;
      const o = p.opts[idx];
      if (!o) return;
      const en = st.p.hand[p.i];
      if (!en) return;
      const c = effCard(st, "p", en);
      st.p.mana -= effCost(st, "p", c);
      st.p.hand.splice(p.i, 1);
      afterSpellPlayed(st, "p", c.id);
      applyOpt(st, "p", o);
      log(st, `你施放了「${c.name}」,抉择了${o.label}`);
      moonTutor(st, "p", en);
      st.pending = null;
    });
  }
  // 取消抉择:仅限尚未看到牌库内容的阶段(choose / bloomMode),费用与手牌均未结算,直接关闭即可
  function cancelPending() {
    mutate((st) => {
      const p = st.pending;
      if (p && (p.k === "choose" || p.k === "bloomMode")) st.pending = null;
    });
  }
  function pickMoon(idx: number) {
    mutate((st) => {
      const p = st.pending;
      if (!p || p.k !== "moonPick") return;
      const cid = p.opts[idx];
      if (cid == null) return;
      gainMoonCopy(st, "p", cid);
      log(st, `「月光指引」:你发现了「${byId[cid].name}」的复制`);
      st.pending = null;
    });
  }
  // 探底:把选中的底牌置于牌库顶;垂钓时光连击(draw)时随即抽取
  function pickDredge(idx: number) {
    mutate((st) => {
      const p = st.pending;
      if (!p || p.k !== "dredge") return;
      dredgePick(st, "p", idx, p.draw);
      st.pending = null;
    });
  }
  // 异教地图:首次发现并抽取选中牌(其余两张记为后续可选项)
  function pickMapDiscover(idx: number) {
    mutate((st) => {
      const p = st.pending;
      if (!p || p.k !== "mapDiscover") return;
      const cid = p.opts[idx];
      if (cid == null) return;
      mapTake(st, "p", cid, p.opts.filter((_, j) => j !== idx));
      st.pending = null;
    });
  }
  // 异教地图:本回合打出发现牌后,从剩余选项再抽一张
  function pickMapLeft(idx: number) {
    mutate((st) => {
      const p = st.pending;
      if (!p || p.k !== "mapPick") return;
      const cid = p.opts[idx];
      if (cid == null) return;
      mapDrawLeft(st, "p", cid);
      st.pending = null;
    });
  }

  function surrender() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setConfirmSurrender(false);
    setSelHand(null); setSelAtk(null); setSelHeroAtk(false); setInspect(null); setHovHand(null);
    mutate((st) => {
      if (st.winner || st.phase !== "play") return;
      st.winner = "a";
      st.surrendered = true;
      log(st, "你选择了认输", true);
    });
  }

  function handleHand(i: number) {
    if (game.phase !== "play" || game.pending) return;
    // AI 回合:手牌只读,点击切换该牌的预览(再次点击关闭)
    if (!myTurn) { setHovHand((h) => (h === i ? null : i)); return; }
    const en = game.p.hand[i];
    if (!en) return;
    const c = effCard(game, "p", en); // 殒命暗影:解析为上一张打出的法术
    setInspect(null);
    if (selHand !== i) {
      setSelHand(i); setSelAtk(null);
      if (effCost(game, "p", c, en) > game.p.mana) setHint({ t: "法力水晶不足", id: Date.now() });
      else if (spTarget(c.sp) === "fm" && !game.p.board.length) setHint({ t: "场上没有可选目标", id: Date.now() });
      else if (spTarget(c.sp)) setHint({ t: "点击目标施放法术", id: Date.now() });
      return;
    }
    if (effCost(game, "p", c, en) > game.p.mana) { setHint({ t: "法力水晶不足", id: Date.now() }); return; }
    if (c.type === "s" && c.sp.k === "shadow") { setHint({ t: "你尚未打出过法术,无法复制", id: Date.now() }); return; }
    if (c.type === "m") {
      if (game.p.board.length >= 6) { setHint({ t: "随从区已满(最多 6 个)", id: Date.now() }); return; }
      mutate((st) => { if (playMinion(st, "p", i)) log(st, `你打出了「${c.name}」`); });
      setSelHand(null); setHovHand(null);
    } else if (c.type === "w") {
      mutate((st) => { if (playWeapon(st, "p", i)) log(st, `你装备了「${c.name}」`); });
      setSelHand(null); setHovHand(null);
    } else if (c.sp.k === "bloom") {
      const mOk = game.p.board.length < 6 && game.p.deck.some((cid) => byId[cid].type === "m");
      const sOk = game.p.deck.some((cid) => byId[cid].type === "s");
      if (!mOk && !sOk) { setHint({ t: "牌库中没有可供抉择的卡牌", id: Date.now() }); return; }
      // 进入抉择界面时不扣费、不离手,确认模式时才结算(可取消)
      mutate((st) => { st.pending = { k: "bloomMode", i }; });
      setSelHand(null); setHovHand(null);
    } else if (c.sp.k === "camp") {
      mutate((st) => {
        const en2 = st.p.hand[i];
        st.p.mana -= effCost(st, "p", c);
        st.p.hand.splice(i, 1);
        afterSpellPlayed(st, "p", c.id);
        st.pending = { k: "camp", remaining: 3 };
        log(st, `你施放了「${c.name}」`);
        moonTutor(st, "p", en2);
      });
      setSelHand(null); setHovHand(null);
    } else if (c.sp.k === "choose") {
      // 进入抉择界面时不扣费、不离手,确认选项时才结算(可取消)
      const opts = c.sp.opts;
      mutate((st) => { st.pending = { k: "choose", i, name: c.name, emoji: c.emoji, opts }; });
      setSelHand(null); setHovHand(null);
    } else if (c.sp.k === "moonlight") {
      if (!game.p.deck.length) { setHint({ t: "牌库已空,无法发现", id: Date.now() }); return; }
      mutate((st) => {
        const en2 = st.p.hand[i];
        st.p.mana -= effCost(st, "p", c);
        st.p.hand.splice(i, 1);
        afterSpellPlayed(st, "p", c.id);
        st.pending = { k: "moonPick", opts: sampleDeckAny(st, "p") };
        log(st, `你施放了「${c.name}」`);
        moonTutor(st, "p", en2);
      });
      setSelHand(null); setHovHand(null);
    } else if (c.sp.k === "dredge") {
      const willDraw = !!c.sp.comboDraw && (game.p.playedThisTurn || 0) > 0; // 连击需在本牌计入前判定
      mutate((st) => {
        const en2 = st.p.hand[i];
        st.p.mana -= effCost(st, "p", c);
        st.p.hand.splice(i, 1);
        afterSpellPlayed(st, "p", c.id);
        log(st, `你施放了「${c.name}」`);
        moonTutor(st, "p", en2);
        if (st.p.deck.length) st.pending = { k: "dredge", opts: st.p.deck.slice(0, 3), draw: willDraw };
        else if (willDraw) draw(st, "p", 1); // 牌库已空:无可探底,连击退化为直接抽(疲劳)
      });
      setSelHand(null); setHovHand(null);
    } else if (c.sp.k === "map") {
      if (!game.p.deck.length) { setHint({ t: "牌库已空,无法发现", id: Date.now() }); return; }
      mutate((st) => {
        const en2 = st.p.hand[i];
        st.p.mana -= effCost(st, "p", c);
        st.p.hand.splice(i, 1);
        afterSpellPlayed(st, "p", c.id);
        log(st, `你施放了「${c.name}」`);
        moonTutor(st, "p", en2);
        st.pending = { k: "mapDiscover", opts: sampleDeckAny(st, "p") };
      });
      setSelHand(null); setHovHand(null);
    } else if (!spTarget(c.sp)) {
      mutate((st) => { if (castSpell(st, "p", i, null)) log(st, `你施放了「${c.name}」`); });
      setSelHand(null); setHovHand(null);
    } else setHint({ t: "点击目标施放法术", id: Date.now() });
  }

  function clickEntity(side: Side, uid: number | null) {
    if (game.phase !== "play" || game.pending) return;
    if (!myTurn) {
      if (uid) setInspect({ side, uid });
      return;
    }
    const selCard = selHand != null && game.p.hand[selHand] ? effCard(game, "p", game.p.hand[selHand]) : null;
    if (selCard && spTarget(selCard.sp) && effCost(game, "p", selCard) <= game.p.mana) {
      if (spTarget(selCard.sp) === "fm" && (side !== "p" || !uid)) return;
      const idx = selHand!;
      const name = selCard.name;
      mutate((st) => {
        if (castSpell(st, "p", idx, uid ? { side, uid } : { side, hero: true })) {
          log(st, `你施放了「${name}」`);
        }
      });
      setSelHand(null); setInspect(null);
      return;
    }
    if (side === "p" && uid) {
      const m = game.p.board.find((x) => x.uid === uid);
      if (!m) return;
      if (m.frozen) { setInspect({ side, uid }); setHint({ t: "该随从已被冻结,本回合无法攻击", id: Date.now() }); return; }
      if (m.sick && !m.rush) { setInspect({ side, uid }); setHint({ t: "刚上场的随从需等待一回合(冲锋除外)", id: Date.now() }); return; }
      if (m.attacked) { setInspect({ side, uid }); setHint({ t: "该随从本回合已攻击过", id: Date.now() }); return; }
      const next = selAtk === uid ? null : uid;
      setSelAtk(next); setSelHeroAtk(false); setSelHand(null); setInspect(null);
      if (next) setHint({ t: "点击敌方随从或英雄发起攻击", id: Date.now() });
      return;
    }
    // 选中我方英雄作为攻击者(装备武器或变形后有攻击力,且本回合未攻击)
    if (side === "p" && !uid) {
      if (heroAtkVal(game.p) <= 0) { setHint({ t: "英雄没有攻击力(可装备武器或使用英雄技能)", id: Date.now() }); return; }
      if (game.p.heroAttacked) { setHint({ t: "英雄本回合已攻击过", id: Date.now() }); return; }
      const next = !selHeroAtk;
      setSelHeroAtk(next); setSelAtk(null); setSelHand(null); setInspect(null);
      if (next) setHint({ t: "点击敌方随从或英雄发起攻击", id: Date.now() });
      return;
    }
    if (side === "a" && !selAtk && !selHeroAtk && uid) {
      setInspect({ side, uid }); setSelHand(null);
      return;
    }
    if (side === "a" && (selAtk || selHeroAtk)) {
      const taunts = game.a.board.filter((m) => m.taunt);
      const heroAtk = selHeroAtk;
      const a = selAtk;
      if (uid) {
        const t = game.a.board.find((x) => x.uid === uid);
        if (!t) return;
        if (taunts.length && !t.taunt) { setHint({ t: "必须先攻击带 🛡️ 嘲讽的随从", id: Date.now() }); return; }
        const tname = t.name;
        mutate((st) => {
          if (heroAtk) {
            if (resolveHeroAttack(st, "p", { uid })) log(st, `你的英雄攻击了「${tname}」`);
          } else {
            const A = st.p.board.find((x) => x.uid === a);
            if (resolveAttack(st, "p", a!, { uid })) log(st, `你的「${A ? A.name : "随从"}」攻击了「${tname}」`);
          }
        });
      } else {
        if (taunts.length) { setHint({ t: "必须先攻击带 🛡️ 嘲讽的随从", id: Date.now() }); return; }
        if (!heroAtk) {
          const atkM = game.p.board.find((x) => x.uid === a);
          if (atkM && atkM.sick && atkM.rush) { setHint({ t: "突袭随从登场当回合只能攻击敌方随从", id: Date.now() }); return; }
        }
        mutate((st) => {
          if (heroAtk) {
            if (resolveHeroAttack(st, "p", { hero: true })) log(st, "你的英雄攻击了敌方英雄");
          } else {
            const A = st.p.board.find((x) => x.uid === a);
            if (resolveAttack(st, "p", a!, { hero: true })) log(st, `你的「${A ? A.name : "随从"}」攻击了敌方英雄`);
          }
        });
      }
      setSelAtk(null); setSelHeroAtk(false);
    }
  }

  // 使用英雄技能(每回合一次,消耗 2 法力)
  function doHeroPower() {
    if (!myTurn || game.pending) return;
    if (game.p.heroPowerUsed) { setHint({ t: "本回合已使用过英雄技能", id: Date.now() }); return; }
    if (game.p.mana < HERO_POWER_COST) { setHint({ t: "法力水晶不足", id: Date.now() }); return; }
    setSelHand(null); setSelAtk(null); setSelHeroAtk(false); setInspect(null);
    mutate((st) => { useHeroPower(st, "p"); });
  }

  function endTurn() {
    if (!myTurn || game.pending) return;
    setSelHand(null); setSelAtk(null); setSelHeroAtk(false); setInspect(null); setHovHand(null);
    const cur = gameRef.current;
    if (cur.phase !== "play") return;
    const base = clone(cur);
    endTurnCleanup(base, "p"); // 秘密通道:回合结束换回手牌
    base.turn = "a";
    base.banner = { text: "对手回合", id: Date.now() };
    log(base, "对手回合开始");
    base.fx = [];
    thawFrozen(base, "p"); // 冻结结算:我方回合结束时解冻己方随从
    runAiTurn(base);
  }

  const goldBtn: CSSProperties = {
    padding: "10px 26px", borderRadius: 999, fontWeight: 800, fontSize: 15, cursor: "pointer",
    border: "2px solid #f0d98c", background: "linear-gradient(180deg,#ffe08a,#c79a2e)", color: "#4a3508",
    boxShadow: "0 0 14px rgba(255,215,0,.45)", fontFamily: "inherit",
  };

  const outer: CSSProperties = {
    minHeight: "100vh", display: "flex", flexDirection: "column",
    background: "radial-gradient(ellipse at center,#36452c 0%,#222d18 60%,#141b0d 100%)",
    fontFamily: "Georgia,'Noto Serif SC','SimSun',serif", position: "relative", overflow: "hidden", userSelect: "none",
  };

  // ---------- 主菜单 ----------
  if (game.phase === "menu") {
    return (
      <div style={{ ...outer, alignItems: "center", justifyContent: "center", gap: 18, padding: 20 }}>
        <style>{CSS}</style>
        {/* 标题徽记 */}
        <div style={{ fontSize: 56, lineHeight: 1, filter: "drop-shadow(0 0 18px rgba(255,200,0,.5))" }}>⚔️</div>
        <div style={{ fontSize: 42, fontWeight: 900, color: "#ffd700", textShadow: "0 0 22px rgba(255,200,0,.7),0 2px 4px #000", letterSpacing: 8 }}>奥 术 王 座</div>
        <div style={{ color: "#d8c89a", fontSize: 14, letterSpacing: 3 }}>经 典 奇 幻 卡 牌 对 战</div>

        {/* 操作按钮列 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 14, width: 220 }}>
          <button onClick={start} style={{ ...goldBtn, width: "100%" }}>开 始 对 战</button>
          <button onClick={openDeckBuilder} style={{ ...goldBtn, width: "100%", background: "rgba(0,0,0,.3)", border: "2px solid #8a6d3b", color: "#e8dcc0", boxShadow: "none" }}>
            构 建 牌 组
          </button>
          <button onClick={() => setShowRules(true)} style={{ ...goldBtn, width: "100%", background: "rgba(0,0,0,.3)", border: "2px solid #8a6d3b", color: "#e8dcc0", boxShadow: "none" }}>
            对 战 规 则
          </button>
        </div>

        <span style={{ fontSize: 11, color: activeDeck && !playerDeck ? "#e0a85c" : "#9c9272", textAlign: "center", maxWidth: 340, marginTop: 4 }}>
          {playerDeck
            ? `⚔️ 对战将使用:${activeDeck!.name}(${CLASS_META[activeDeck!.classId].name} · 30 张)`
            : activeDeck
            ? `⚠️ 牌组「${activeDeck.name}」不足 30 张,对战将使用随机牌组`
            : "⚔️ 对战将使用:随机牌组"}
        </span>

        {/* 对战规则弹窗 */}
        {showRules && (
          <div
            onClick={() => setShowRules(false)}
            style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(0,0,0,.72)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ width: "min(420px,94vw)", maxHeight: "86vh", overflowY: "auto", background: "linear-gradient(170deg,#2c3320,#1a2010)", border: "2px solid #8a6d3b", borderRadius: 16, padding: "20px 22px", boxShadow: "0 12px 40px rgba(0,0,0,.7)" }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ color: "#ffd700", fontWeight: 900, fontSize: 18, letterSpacing: 2 }}>📜 对战规则</span>
                <button
                  onClick={() => setShowRules(false)}
                  style={{ width: 30, height: 30, borderRadius: "50%", border: "1px solid #8a6d3b", background: "rgba(0,0,0,.35)", color: "#e8dcc0", fontSize: 16, fontWeight: 900, cursor: "pointer", fontFamily: "inherit", lineHeight: 1 }}
                >
                  ✕
                </button>
              </div>
              <div style={{ color: "#e8dcc0", fontSize: 13, lineHeight: 2 }}>
                ❤️ 双方英雄 30 血,先打空对方生命值者获胜<br />
                💎 法力水晶每回合 +1(上限 10),用来支付卡牌费用<br />
                🪙 先后手随机,后手多抽一张牌并获得「幸运币」<br />
                🛡️ <b>嘲讽</b>:敌人必须先攻击该随从<br />
                ⚡ <b>冲锋</b>:登场当回合即可攻击<br />
                💨 <b>突袭</b>:登场当回合可攻击敌方随从,但不能攻击英雄<br />
                🌙 <b>抉择</b>:打出时从多个效果中选择一项<br />
                ❄️ <b>冻结</b>:被冻结的随从下个回合无法攻击,之后解除<br />
                ⛨ <b>护甲</b>:先于生命值抵挡伤害<br />
                🃏 牌库抽空后,每次抽牌受到递增的疲劳伤害
              </div>
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(138,109,59,.5)", color: "#bfae84", fontSize: 12, lineHeight: 1.9 }}>
                <div style={{ color: "#ffd700", fontWeight: 800, marginBottom: 4 }}>— 操作 —</div>
                点击手牌查看 → <b>再次点击打出</b>;指向性法术点击目标施放;点击我方随从,再点击敌方目标即可发起攻击。
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------- 牌组构建 ----------
  if (game.phase === "deck") {
    const counts: Record<number, number> = {};
    deckSel.forEach((id) => (counts[id] = (counts[id] || 0) + 1));
    const full = deckSel.length >= 30;
    const subBtn: CSSProperties = { padding: "7px 14px", borderRadius: 999, fontWeight: 700, fontSize: 12, cursor: "pointer", border: "1px solid #8a6d3b", background: "rgba(0,0,0,.3)", color: "#cdbf9a", fontFamily: "inherit" };
    const nameInput: CSSProperties = { padding: "5px 10px", borderRadius: 8, border: "1px solid #8a6d3b", background: "rgba(0,0,0,.35)", color: "#f4e6c1", fontSize: 13, fontWeight: 700, fontFamily: "inherit", width: 150 };
    const miniBtn: CSSProperties = { padding: "3px 8px", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer", border: "1px solid #8a6d3b", background: "rgba(0,0,0,.28)", color: "#cdbf9a", fontFamily: "inherit", lineHeight: 1.4 };
    const nameColor = (c: typeof POOL[number]) => RARITY[c.rarity].color;
    const hovPrevCard = hovPrevCid != null ? byId[hovPrevCid] : null;
    // 标签栏:构建态(已选职业)只在「本职业 / 中立」之间切换;浏览态可在全部职业 + 中立间切换
    const tabs: DeckTab[] = buildClass ? [buildClass, "neutral"] : [...CLASS_IDS, "neutral"];
    const tabLabel = (t: DeckTab) => (t === "neutral" ? "中立" : CLASS_META[t].name);
    const tabEmoji = (t: DeckTab) => (t === "neutral" ? "⚪" : CLASS_META[t].emoji);
    const curTab: DeckTab = tabs.includes(deckTab) ? deckTab : tabs[0];
    // 卡池按当前标签筛选:中立标签取中立牌,职业标签取归属该职业的牌
    const tabPool = POOL.filter((c) => (curTab === "neutral" ? isNeutral(c) : (c.classes ?? []).includes(curTab)));
    // 卡池分页:每页 20 张
    const PAGE_SIZE = 20;
    const sortedPool = tabPool.sort((a, b) => a.cost - b.cost || a.id - b.id);
    const pageCount = Math.max(1, Math.ceil(sortedPool.length / PAGE_SIZE));
    const page = Math.min(poolPage, pageCount - 1);
    const pagePool = sortedPool.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

    return (
      <div style={{ ...outer, padding: "12px" }}>
        <style>{CSS}</style>
        <div style={{ width: "100%", maxWidth: 1120, margin: "0 auto", flex: 1, minHeight: 0, display: "flex", gap: 12 }}>
          {/* ---------- 左:构建区 ---------- */}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 18, fontWeight: 900, color: "#ffd700", textShadow: "0 1px 3px #000", whiteSpace: "nowrap" }}>
                  {buildClass ? `🛠 ${editingId ? "编辑" : "新建"}牌组` : "📖 浏览全部卡牌"}
                </span>
                {buildClass && (
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#e8dcc0", background: "rgba(0,0,0,.35)", border: "1px solid #8a6d3b", borderRadius: 999, padding: "3px 10px", whiteSpace: "nowrap" }}>
                    {CLASS_META[buildClass].emoji} {CLASS_META[buildClass].name}
                  </span>
                )}
                {buildClass && (
                  <input
                    value={deckName}
                    maxLength={12}
                    placeholder="牌组名称"
                    onChange={(e) => setDeckName(e.target.value)}
                    style={nameInput}
                  />
                )}
                {buildClass && <span style={{ fontSize: 14, fontWeight: 800, color: full ? "#5ef08a" : "#d8c89a", whiteSpace: "nowrap" }}>{deckSel.length}/30</span>}
              </div>
              {buildClass ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={() => setDeckSel([])} style={subBtn}>清空</button>
                  <button onClick={randomFill} style={subBtn}>随机补满</button>
                  <button
                    onClick={saveDeck}
                    disabled={!full}
                    style={{ ...subBtn, fontWeight: 800, border: "2px solid " + (full ? "#f0d98c" : "#6b6452"), background: full ? "linear-gradient(180deg,#ffe08a,#c79a2e)" : "#4d4738", color: full ? "#4a3508" : "#9a937e", cursor: full ? "pointer" : "default" }}
                  >
                    {editingId ? "更新牌组" : "保存牌组"}
                  </button>
                </div>
              ) : null}
            </div>
            {/* 标签栏:职业 / 中立 切换 */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {tabs.map((t) => {
                const on = curTab === t;
                return (
                  <button
                    key={t}
                    onClick={() => { setDeckTab(t); setPoolPage(0); }}
                    style={{ ...subBtn, padding: "5px 12px", fontWeight: 800, border: "1px solid " + (on ? "#f0d98c" : "#8a6d3b"), background: on ? "rgba(255,215,0,.18)" : "rgba(0,0,0,.3)", color: on ? "#ffe9b0" : "#cdbf9a" }}
                  >
                    {tabEmoji(t)} {tabLabel(t)}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 11, color: deckMsg ? "#5ef08a" : "#bfae84", minHeight: 16 }}>
              {deckMsg || (buildClass
                ? "点击卡牌加入牌组(每种最多 2 张,传说卡每种最多 1 张),点击右下角 − 移除;选满 30 张后保存。"
                : "浏览模式:点击标签查看各职业与中立卡牌。点右上「新建牌组」开始组牌。")}
            </div>
            {/* 顶/左留出内边距,避免卡牌角标(费用/数量)被滚动容器裁切 */}
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "14px 14px 18px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(132px,1fr))", gap: 20 }}>
                {pagePool.map((c) => {
                  const n = counts[c.id] || 0;
                  const addable = !!buildClass && !full && n < maxCopies(c);
                  const cardBg = c.type === "m" ? "linear-gradient(170deg,#7a5c33,#4a3517)" : c.type === "w" ? "linear-gradient(170deg,#5e6470,#2e3138)" : "linear-gradient(170deg,#3d4f8a,#23284e)";
                  const cardBorder = c.type === "m" ? "#caa45c" : c.type === "w" ? "#aab2be" : "#7d90d8";
                  return (
                    <div
                      key={c.id}
                      onClick={() => addCard(c.id)}
                      style={{ position: "relative", minHeight: 152, boxSizing: "border-box", display: "flex", flexDirection: "column", alignItems: "center", borderRadius: 10, padding: "12px 8px 14px", cursor: addable ? "pointer" : "default", textAlign: "center", background: cardBg, border: n ? "2px solid #ffd700" : "2px solid " + cardBorder, boxShadow: n ? "0 0 10px rgba(255,215,0,.3)" : "0 2px 5px rgba(0,0,0,.4)", opacity: addable || n ? 1 : buildClass ? 0.55 : 0.9 }}
                    >
                      <span style={{ position: "absolute", top: -9, left: -9, width: 28, height: 28, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%,#9fd6ff,#1f63c4 60%,#0b3a7e)", border: "2px solid #cfe6ff", color: "#fff", fontSize: 15, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {c.cost}
                      </span>
                      {n > 0 && (
                        <div style={{ position: "absolute", top: -9, right: -7, display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ background: "#ffd700", color: "#4a3508", borderRadius: 999, fontSize: 11, fontWeight: 900, padding: "1px 7px", border: "1px solid #fff3c4" }}>×{n}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); removeCard(c.id); }}
                            style={{ width: 22, height: 22, borderRadius: "50%", border: "1px solid #e08a7c", background: "#9c3328", color: "#fff", fontWeight: 900, fontSize: 14, cursor: "pointer", lineHeight: 1, fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center" }}
                          >
                            −
                          </button>
                        </div>
                      )}
                      <div style={{ fontSize: 26 }}>{c.emoji}</div>
                      <div style={{ color: c.rarity === "c" ? "#ffe9b0" : RARITY[c.rarity].color, fontWeight: 800, fontSize: 13, textShadow: "0 1px 2px #000" }}>{c.name}</div>
                      <div style={{ color: RARITY[c.rarity].color, fontSize: 10, fontWeight: 800 }}>◆ {RARITY[c.rarity].label}</div>
                      <div style={{ color: "#d8cdb2", fontSize: 10, marginTop: 3, lineHeight: 1.4 }}>{kw(c)}{c.desc}</div>
                      {c.type === "m" && (
                        <>
                          <Badge pos="bl" v={c.atk!} bg="#b8860b" size={34} />
                          <Badge pos="br" v={c.hp!} bg="#7f1d1d" size={34} />
                        </>
                      )}
                      {c.type === "w" && (
                        <>
                          <Badge pos="bl" v={c.atk} bg="#b8860b" size={34} />
                          <Badge pos="br" v={c.dur} bg="#2f6f9e" size={34} />
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            {/* 卡池翻页 */}
            <div style={{ flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, paddingTop: 2 }}>
              <button
                onClick={() => setPoolPage((p) => Math.max(0, p - 1))}
                disabled={page <= 0}
                style={{ ...subBtn, opacity: page <= 0 ? 0.4 : 1, cursor: page <= 0 ? "default" : "pointer" }}
              >
                ‹ 上一页
              </button>
              <span style={{ fontSize: 12, color: "#d8c89a", fontWeight: 700, minWidth: 84, textAlign: "center" }}>
                第 {page + 1} / {pageCount} 页
              </span>
              <button
                onClick={() => setPoolPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={page >= pageCount - 1}
                style={{ ...subBtn, opacity: page >= pageCount - 1 ? 0.4 : 1, cursor: page >= pageCount - 1 ? "default" : "pointer" }}
              >
                下一页 ›
              </button>
            </div>
          </div>

          {/* ---------- 右:牌组列表 / 当前牌组实时预览 ---------- */}
          <div style={{ position: "relative", width: 272, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8, background: "rgba(0,0,0,.28)", border: "2px solid #8a6d3b", borderRadius: 12, padding: "10px 10px" }}>
            {/* 预览时悬停卡牌行,在面板左侧显示卡牌详情 */}
            {rightMode === "preview" && hovPrevCard && (
              <div style={{ position: "absolute", right: "100%", top: 0, marginRight: 12, zIndex: 80, width: 156, borderRadius: 12, padding: "10px 8px", background: hovPrevCard.type === "m" ? "linear-gradient(170deg,#7a5c33,#3c2b12)" : "linear-gradient(170deg,#3d4f8a,#1d2244)", border: "2px solid #ffd700", boxShadow: "0 8px 24px rgba(0,0,0,.7)", textAlign: "center", pointerEvents: "none" }}>
                <div style={{ fontSize: 34 }}>{hovPrevCard.emoji}</div>
                <div style={{ color: hovPrevCard.rarity === "c" ? "#ffe9b0" : RARITY[hovPrevCard.rarity].color, fontWeight: 800, fontSize: 14, textShadow: "0 1px 2px #000" }}>{hovPrevCard.name}</div>
                <div style={{ color: RARITY[hovPrevCard.rarity].color, fontSize: 10, fontWeight: 800 }}>◆ {RARITY[hovPrevCard.rarity].label}</div>
                <div style={{ color: "#9fd6ff", fontSize: 11, fontWeight: 700 }}>
                  {hovPrevCard.cost} 费{hovPrevCard.type === "m" ? ` · ${hovPrevCard.atk} 攻 / ${hovPrevCard.hp} 血` : hovPrevCard.type === "w" ? ` · ${hovPrevCard.atk} 攻 / ${hovPrevCard.dur} 耐久` : ` · ${spSummary(hovPrevCard.sp)}`}
                </div>
                <div style={{ color: "#e8dcc0", fontSize: 11, marginTop: 3, lineHeight: 1.4 }}>{kw(hovPrevCard)}{hovPrevCard.desc}</div>
              </div>
            )}
            {rightMode === "list" ? (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 15, fontWeight: 900, color: "#ffd700" }}>📚 我的牌组</span>
                  <span style={{ fontSize: 12, color: decks.length >= MAX_DECKS ? "#e0a85c" : "#cdbf9a" }}>{decks.length}/{MAX_DECKS}</span>
                </div>
                <button
                  onClick={beginNewDeck}
                  disabled={decks.length >= MAX_DECKS}
                  title={decks.length >= MAX_DECKS ? `最多 ${MAX_DECKS} 个牌组` : "选择职业并新建一副牌组"}
                  style={{ ...subBtn, width: "100%", fontWeight: 800, opacity: decks.length >= MAX_DECKS ? 0.5 : 1, cursor: decks.length >= MAX_DECKS ? "default" : "pointer" }}
                >
                  ✚ 新建牌组
                </button>
                <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                  {decks.length === 0 && (
                    <div style={{ color: "#8f8568", fontSize: 12, textAlign: "center", padding: "20px 6px", lineHeight: 1.8 }}>
                      还没有保存的牌组。<br />点击「新建牌组」后在左侧选满 30 张并保存。
                    </div>
                  )}
                  {decks.map((d) => {
                    const isActive = d.id === activeId;
                    const isEditing = d.id === editingId;
                    const complete = d.cards.length === 30;
                    return (
                      <div
                        key={d.id}
                        style={{ borderRadius: 10, padding: "8px 9px", background: isEditing ? "rgba(255,215,0,.12)" : "rgba(0,0,0,.3)", border: "1px solid " + (isActive ? "#ffd700" : "#6b5a36"), boxShadow: isActive ? "0 0 8px rgba(255,215,0,.25)" : "none" }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                          {renamingId === d.id ? (
                            <input
                              autoFocus
                              value={renameText}
                              maxLength={12}
                              onChange={(e) => setRenameText(e.target.value)}
                              onBlur={commitRename}
                              onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenamingId(null); }}
                              style={{ ...nameInput, width: "100%", padding: "3px 7px", fontSize: 12 }}
                            />
                          ) : (
                            <span style={{ fontSize: 13, fontWeight: 800, color: "#f4e6c1", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {isActive && <span title="对战牌组" style={{ color: "#ffd700", marginRight: 3 }}>★</span>}
                              {d.name}
                            </span>
                          )}
                          <span style={{ fontSize: 11, fontWeight: 700, color: complete ? "#7fd89a" : "#e0a85c", whiteSpace: "nowrap" }}>
                            {d.cards.length}/30
                          </span>
                        </div>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "#cdbf9a", marginTop: 2 }}>
                          {CLASS_META[d.classId].emoji} {CLASS_META[d.classId].name}
                        </div>
                        {!complete && renamingId !== d.id && (
                          <div style={{ fontSize: 10, color: "#e0a85c", marginTop: 2 }}>⚠️ 未完成,无法用于对战</div>
                        )}
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 7 }}>
                          <button onClick={() => editDeck(d)} style={{ ...miniBtn, ...(isEditing ? { borderColor: "#ffd700", color: "#ffe9b0" } : {}) }}>✏️ 编辑</button>
                          <button onClick={() => startRename(d)} style={miniBtn}>🏷 重命名</button>
                          <button onClick={() => setConfirmDel(d.id)} style={{ ...miniBtn, borderColor: "#a85040", color: "#e6a89c" }}>🗑 删除</button>
                          <button
                            onClick={() => complete && setActive(d.id)}
                            disabled={!complete || isActive}
                            title={complete ? "设为对战牌组" : "需满 30 张"}
                            style={{ ...miniBtn, width: "100%", fontWeight: 800, ...(isActive ? { borderColor: "#ffd700", color: "#ffd700", background: "rgba(255,215,0,.12)" } : {}), opacity: !complete ? 0.45 : 1, cursor: !complete || isActive ? "default" : "pointer" }}
                          >
                            {isActive ? "★ 当前对战牌组" : "设为对战牌组"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button onClick={() => setGame({ phase: "menu" })} style={{ ...subBtn, width: "100%" }}>返回主菜单</button>
              </>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                  <button onClick={() => { exitBuild(); setHovPrevCid(null); }} style={{ ...miniBtn, whiteSpace: "nowrap" }}>← 牌组列表</button>
                  <span style={{ fontSize: 12, fontWeight: 800, color: full ? "#7fd89a" : "#e0a85c", whiteSpace: "nowrap" }}>{deckSel.length}/30</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 900, color: "#ffd700", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  👁 {deckName.trim() || (editingId ? "" : "新建牌组")}
                </div>
                {buildClass && <div style={{ fontSize: 11, fontWeight: 700, color: "#cdbf9a" }}>{CLASS_META[buildClass].emoji} {CLASS_META[buildClass].name}</div>}
                <div style={{ fontSize: 11, color: "#bfae84" }}>悬停查看详情 · 点击移除一张</div>
                <div
                  onMouseLeave={() => setHovPrevCid(null)}
                  style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}
                >
                  {deckSel.length === 0 && (
                    <div style={{ color: "#8f8568", fontSize: 12, textAlign: "center", padding: "20px 6px", lineHeight: 1.8 }}>牌组为空,<br />点击左侧卡牌加入。</div>
                  )}
                  {(() => {
                    const pc: Record<number, number> = {};
                    deckSel.forEach((id) => (pc[id] = (pc[id] || 0) + 1));
                    return Object.keys(pc)
                      .map(Number)
                      .map((id) => ({ c: byId[id], n: pc[id] }))
                      .sort((a, b) => a.c.cost - b.c.cost || a.c.id - b.c.id)
                      .map(({ c, n }) => (
                        <div
                          key={c.id}
                          onMouseEnter={() => setHovPrevCid(c.id)}
                          onClick={() => removeCard(c.id)}
                          title="点击移除一张"
                          style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 8, cursor: "pointer", background: hovPrevCid === c.id ? "rgba(255,80,60,.18)" : "rgba(0,0,0,.32)", border: "1px solid " + (hovPrevCid === c.id ? "#e08a7c" : "#5a5030") }}
                        >
                          <span style={{ width: 18, height: 18, flexShrink: 0, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%,#9fd6ff,#1f63c4 60%,#0b3a7e)", border: "1px solid #cfe6ff", color: "#fff", fontSize: 10, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>{c.cost}</span>
                          <span style={{ fontSize: 18, flexShrink: 0 }}>{c.emoji}</span>
                          <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: nameColor(c), overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textShadow: "0 1px 2px #000" }}>{c.name}</span>
                          {n > 1 && <span style={{ fontSize: 12, fontWeight: 900, color: "#ffd700", flexShrink: 0 }}>×{n}</span>}
                          <span style={{ fontSize: 14, fontWeight: 900, color: "#e08a7c", flexShrink: 0 }}>−</span>
                        </div>
                      ));
                  })()}
                </div>
                <button
                  onClick={saveDeck}
                  disabled={!full}
                  style={{ ...subBtn, width: "100%", fontWeight: 800, border: "2px solid " + (full ? "#f0d98c" : "#6b6452"), background: full ? "linear-gradient(180deg,#ffe08a,#c79a2e)" : "#4d4738", color: full ? "#4a3508" : "#9a937e", cursor: full ? "pointer" : "default" }}
                >
                  {editingId ? "更新牌组" : "保存牌组"}
                </button>
              </>
            )}
          </div>
        </div>

        {/* ---------- 新建牌组:选择职业 ---------- */}
        {choosingClass && (
          <div onClick={() => setChoosingClass(false)} style={{ position: "absolute", inset: 0, background: "rgba(8,6,2,.78)", zIndex: 72, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, padding: 20 }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#ffd700", textShadow: "0 0 14px rgba(255,200,0,.6)", letterSpacing: 2 }}>选择职业</div>
            <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
              {CLASS_IDS.map((cls) => {
                const m = CLASS_META[cls];
                return (
                  <div
                    key={cls}
                    onClick={() => chooseClass(cls)}
                    style={{ width: 190, borderRadius: 14, padding: "20px 16px", cursor: "pointer", textAlign: "center", background: "linear-gradient(170deg,#3a3050,#221a30)", border: "2px solid #8a6d3b", boxShadow: "0 6px 20px rgba(0,0,0,.6)" }}
                  >
                    <div style={{ fontSize: 44 }}>{m.emoji}</div>
                    <div style={{ color: "#ffe9b0", fontWeight: 900, fontSize: 18, margin: "6px 0" }}>{m.name}</div>
                    <div style={{ color: "#9fd6ff", fontSize: 12, fontWeight: 700 }}>英雄技能 · {m.power.name}</div>
                    <div style={{ color: "#d8cdb2", fontSize: 11, marginTop: 4, lineHeight: 1.5 }}>{m.power.desc}</div>
                  </div>
                );
              })}
            </div>
            <button onClick={() => setChoosingClass(false)} style={{ padding: "8px 22px", borderRadius: 999, fontWeight: 700, fontSize: 13, cursor: "pointer", border: "1px solid #8a6d3b", background: "rgba(0,0,0,.45)", color: "#cdbf9a", fontFamily: "inherit" }}>
              ↩ 取消
            </button>
          </div>
        )}

        {/* ---------- 删除确认 ---------- */}
        {confirmDel && (
          <div onClick={() => setConfirmDel(null)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div onClick={(e) => e.stopPropagation()} style={{ background: "linear-gradient(170deg,#3a2a14,#241a0a)", border: "2px solid #8a6d3b", borderRadius: 14, padding: "20px 26px", textAlign: "center", maxWidth: 280, boxShadow: "0 8px 24px rgba(0,0,0,.7)" }}>
              <div style={{ fontSize: 32 }}>🗑</div>
              <div style={{ color: "#f4e6c1", fontSize: 15, fontWeight: 800, margin: "8px 0 4px" }}>
                删除「{decks.find((d) => d.id === confirmDel)?.name}」?
              </div>
              <div style={{ color: "#bfae84", fontSize: 12, marginBottom: 16 }}>此操作无法撤销</div>
              <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
                <button onClick={() => deleteDeck(confirmDel)} style={{ padding: "8px 20px", borderRadius: 999, fontWeight: 800, fontSize: 13, cursor: "pointer", border: "2px solid #e08a7c", background: "linear-gradient(180deg,#d96a58,#9c3328)", color: "#fff", fontFamily: "inherit" }}>
                  删除
                </button>
                <button onClick={() => setConfirmDel(null)} style={{ padding: "8px 20px", borderRadius: 999, fontWeight: 800, fontSize: 13, cursor: "pointer", border: "1px solid #8a6d3b", background: "none", color: "#cdbf9a", fontFamily: "inherit" }}>
                  取消
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------- 渲染辅助(此处起 game 已收窄为 GameState) ----------
  // menu / deck 两个 phase 已在上方提前 return,这里显式收窄让 TS 消除 LobbyState 分支
  if (game.phase !== "play" && game.phase !== "over") return null;
  const floats = (key: string) =>
    (game.fx || [])
      .filter((f) => f.key === key)
      .map((f) => (
        <span key={f.id} style={{ position: "absolute", left: "50%", top: -4, transform: "translateX(-50%)", color: f.color, fontWeight: 900, fontSize: 18, textShadow: "0 1px 3px #000", animation: "fUp 1s ease-out forwards", pointerEvents: "none", zIndex: 60, whiteSpace: "nowrap" }}>
          {f.text}
        </span>
      ));

  const selCard = selHand != null && game.p.hand[selHand] ? effCard(game, "p", game.p.hand[selHand]) : null;
  const hovCard = hovHand != null && game.p.hand[hovHand] ? effCard(game, "p", game.p.hand[hovHand]) : null;
  const previewCard = hovCard || selCard;
  const inspectM = !previewCard && inspect ? game[inspect.side].board.find((m) => m.uid === inspect.uid) : null;
  const selTargetKind = selCard ? spTarget(selCard.sp) : undefined;
  const spellTargeting = !!(selCard && selTargetKind && effCost(game, "p", selCard) <= game.p.mana);
  const enemyTaunts = game.a.board.filter((m) => m.taunt);
  const selAtkM = selAtk != null ? game.p.board.find((m) => m.uid === selAtk) : null;
  const isT = (side: Side, uid: number | null) => {
    if (!myTurn) return false;
    if (spellTargeting) {
      if (selTargetKind === "any") return true;
      return side === "p" && !!uid;
    }
    if (selAtk || selHeroAtk) {
      if (side !== "a") return false;
      if (enemyTaunts.length) return !!uid && !!game.a.board.find((m) => m.uid === uid && m.taunt);
      if (!uid && selAtk && selAtkM && selAtkM.sick && selAtkM.rush) return false; // 突袭随从本回合不能打英雄(英雄攻击不受此限)
      return true;
    }
    return false;
  };
  const pending = game.pending;
  const heroCanAtk = myTurn && heroAtkVal(game.p) > 0 && !game.p.heroAttacked; // 英雄本回合可攻击
  const canUseHeroPower = myTurn && !game.p.heroPowerUsed && game.p.mana >= HERO_POWER_COST;
  // 是否还有可行动项(可打出的牌、可攻击的随从、英雄可攻击、可用英雄技能):用于"结束回合"按钮的状态提示
  const canAct =
    myTurn &&
    (game.p.hand.some((en) => effCost(game, "p", effCard(game, "p", en), en) <= game.p.mana) ||
      game.p.board.some((m) => !m.attacked && !m.frozen && (!m.sick || m.rush)) ||
      heroCanAtk || canUseHeroPower);

  // ---------- 对战界面 ----------
  return (
    <div style={outer}>
      <style>{CSS}</style>

      {/* 顶栏:敌方 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 14px", background: "linear-gradient(180deg,#523c20,#3a2a14)", borderBottom: "2px solid #8a6d3b", gap: 8 }}>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <HeroEl side="a" h={game.a} isT={isT} clickEntity={clickEntity} floats={floats} heroPowerCost={HERO_POWER_COST} />
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
          <div style={{ display: "flex" }}>
            {Array.from({ length: Math.min(game.a.hand.length, HAND_LIMIT) }).map((_, i) => (
              <div key={i} style={{ width: 24, height: 34, marginLeft: i ? -9 : 0, borderRadius: 4, background: "linear-gradient(160deg,#5b3fa0,#2c1d52)", border: "1px solid #9d86d9" }} />
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "#7cc4ff", fontWeight: 800, fontSize: 16 }}>{game.a.mana}/{game.a.maxMana}</span>
            <div style={{ display: "flex", gap: 2 }}>
              {Array.from({ length: game.a.maxMana }).map((_, i) => (
                <span key={i} style={{ width: 14, height: 14, borderRadius: "50%", background: i < game.a.mana ? "radial-gradient(circle at 35% 30%,#9fd6ff,#1d6fd1 65%,#0c3e85)" : "#16314f", border: "1px solid #5c83ad", boxShadow: i < game.a.mana ? "0 0 5px #4da3ff" : "none" }} />
              ))}
            </div>
          </div>
          <span style={{ fontSize: 14, color: "#cdbf9a" }}>手牌 {game.a.hand.length} · 牌库 {game.a.deck.length}</span>
        </div>
      </div>

      {/* 战场 */}
      <div onClick={() => { setSelHand(null); setSelAtk(null); setSelHeroAtk(false); setInspect(null); setHovHand(null); setShowLog(false); }} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-evenly", padding: "6px 4px", minHeight: 290 }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 16, minHeight: 112, alignItems: "center", overflowX: "auto", padding: "12px 4px" }}>
          {game.a.board.length ? game.a.board.map((m) => <MinionEl key={m.uid} side="a" m={m} myTurn={myTurn} selAtk={selAtk} isT={isT} clickEntity={clickEntity} floats={floats} />) : <span style={{ color: "rgba(230,220,180,.25)", fontSize: 14, letterSpacing: 3 }}>— 敌 方 空 场 —</span>}
        </div>

        {/* 中线 */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "2px 8px" }}>
          <span style={{ fontSize: 13, color: "#bfae84", whiteSpace: "nowrap" }}>回合 {Math.max(1, game.turnNum)}</span>
          <button
            onClick={(e) => { e.stopPropagation(); setShowLog((v) => !v); }}
            title="战斗记录"
            style={{ background: showLog ? "rgba(255,215,0,.18)" : "none", border: "1px solid #8a6d3b", borderRadius: 7, color: "#d8c89a", fontSize: 14, cursor: "pointer", padding: "4px 9px", fontFamily: "inherit", lineHeight: 1.4 }}
          >
            📜
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); if (!game.winner) setConfirmSurrender(true); }}
            title="认输"
            style={{ background: "none", border: "1px solid #8a6d3b", borderRadius: 7, color: "#d8c89a", fontSize: 14, cursor: "pointer", padding: "4px 9px", fontFamily: "inherit", lineHeight: 1.4 }}
          >
            🏳️
          </button>
          <span style={{ flex: 1, fontSize: 15, color: hint ? "#ffd966" : "#d8c89a", fontStyle: "italic", textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {hint ? hint.t : game.lastLog}
          </span>
          {myTurn ? (
            // 无可行动项时变绿发光提示"可以结束了",仍有行动项时保持普通金色
            <button
              onClick={endTurn}
              style={{ padding: "10px 18px", borderRadius: 999, fontWeight: 800, fontSize: 16, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "inherit",
                border: "2px solid " + (canAct ? "#f0d98c" : "#9be29b"),
                background: canAct ? "linear-gradient(180deg,#ffe08a,#c79a2e)" : "linear-gradient(180deg,#7bd87b,#2f9e46)",
                color: canAct ? "#4a3508" : "#0d3318",
                boxShadow: canAct ? "0 0 10px rgba(255,215,0,.4)" : "0 0 12px rgba(90,220,110,.7)" }}
            >
              {canAct ? "结束回合" : "结束回合 ✓"}
            </button>
          ) : (
            // 对手回合:点击可跳过 AI 出牌动画
            <button
              onClick={skipAi}
              disabled={!aiBusy}
              style={{ padding: "10px 18px", borderRadius: 999, fontWeight: 800, fontSize: 16, cursor: aiBusy ? "pointer" : "default", whiteSpace: "nowrap", fontFamily: "inherit",
                border: "2px solid " + (aiBusy ? "#c9a85a" : "#6b6452"),
                background: aiBusy ? "rgba(0,0,0,.35)" : "#4d4738",
                color: aiBusy ? "#f4e6c1" : "#9a937e", boxShadow: "none" }}
            >
              {aiBusy ? "⏩ 跳过" : "对手回合…"}
            </button>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: 16, minHeight: 112, alignItems: "center", overflowX: "auto", padding: "12px 4px" }}>
          {game.p.board.length ? game.p.board.map((m) => <MinionEl key={m.uid} side="p" m={m} myTurn={myTurn} selAtk={selAtk} isT={isT} clickEntity={clickEntity} floats={floats} />) : <span style={{ color: "rgba(230,220,180,.25)", fontSize: 14, letterSpacing: 3 }}>— 我 方 空 场 —</span>}
        </div>
      </div>

      {/* 卡牌 / 随从详情预览(选中、悬停或点击查看) */}
      {previewCard && (
        // 悬停手牌:在右侧中部显示详情;选目标时(攻击 / 指向性法术)改靠左下角并半透明,避免遮挡居中的随从区
        <div style={{ position: "absolute", ...(hovCard ? { right: 200, top: "40%" } : { bottom: 138, left: 8 }), zIndex: 70, pointerEvents: "none", width: 156, borderRadius: 12, padding: "10px 8px", background: previewCard.type === "m" ? "linear-gradient(170deg,#7a5c33,#3c2b12)" : "linear-gradient(170deg,#3d4f8a,#1d2244)", border: "2px solid #ffd700", boxShadow: "0 8px 24px rgba(0,0,0,.7)", textAlign: "center", opacity: !hovCard && (selAtk != null || selHeroAtk || spellTargeting) ? 0.55 : 1, transition: "opacity .15s" }}>
          <div style={{ fontSize: 34 }}>{previewCard.emoji}</div>
          <div style={{ color: previewCard.rarity === "c" ? "#ffe9b0" : RARITY[previewCard.rarity].color, fontWeight: 800, fontSize: 14, textShadow: "0 1px 2px #000" }}>{previewCard.name}</div>
          <div style={{ color: RARITY[previewCard.rarity].color, fontSize: 11, fontWeight: 800 }}>◆ {RARITY[previewCard.rarity].label}</div>
          <div style={{ color: "#9fd6ff", fontSize: 12, fontWeight: 700 }}>
            {effCost(game, "p", previewCard)} 费{previewCard.type === "m" ? ` · ${previewCard.atk} 攻 / ${previewCard.hp} 血` : previewCard.type === "w" ? ` · ${previewCard.atk} 攻 / ${previewCard.dur} 耐久` : ` · ${spSummary(previewCard.sp, game.p.spellDmg || 0)}`}
          </div>
          <div style={{ color: "#e8dcc0", fontSize: 12, marginTop: 3, lineHeight: 1.45 }}>
            {kw(previewCard)}{cardDesc(previewCard, game.p.spellDmg || 0)}
          </div>
          <div style={{ color: "#ffd700", fontSize: 11, marginTop: 5, fontStyle: "italic" }}>
            {previewCard !== selCard
              ? "点击卡牌选中"
              : previewCard.type === "m" || !spTarget(previewCard.sp)
              ? "再次点击卡牌打出"
              : "点击目标施放"}
          </div>
        </div>
      )}
      {inspectM && inspect && (
        <div style={{ position: "absolute", bottom: 138, left: 8, zIndex: 70, pointerEvents: "none", width: 156, borderRadius: 12, padding: "10px 8px", background: inspect.side === "p" ? "linear-gradient(170deg,#7a5c33,#3c2b12)" : "linear-gradient(170deg,#4a3354,#241a2c)", border: "2px solid " + (inspect.side === "p" ? "#c9a85a" : "#a06bc4"), boxShadow: "0 8px 24px rgba(0,0,0,.7)", textAlign: "center", opacity: selAtk != null || selHeroAtk || spellTargeting ? 0.55 : 1, transition: "opacity .15s" }}>
          <div style={{ fontSize: 34 }}>{inspectM.emoji}</div>
          <div style={{ color: byId[inspectM.cid] && byId[inspectM.cid].rarity !== "c" ? RARITY[byId[inspectM.cid].rarity].color : "#ffe9b0", fontWeight: 800, fontSize: 14, textShadow: "0 1px 2px #000" }}>{inspectM.name}</div>
          {byId[inspectM.cid] && (
            <div style={{ color: RARITY[byId[inspectM.cid].rarity].color, fontSize: 11, fontWeight: 800 }}>◆ {RARITY[byId[inspectM.cid].rarity].label}</div>
          )}
          <div style={{ color: "#9fd6ff", fontSize: 12, fontWeight: 700 }}>
            {inspectM.atk} 攻 / {inspectM.hp}{inspectM.hp < inspectM.maxHp ? `/${inspectM.maxHp}` : ""} 血
          </div>
          <div style={{ color: "#e8dcc0", fontSize: 12, marginTop: 3, lineHeight: 1.45 }}>
            {inspectM.frozen && <span style={{ color: "#bfe9ff", fontWeight: 700 }}>❄️ 已冻结 </span>}
            {kw(inspectM)}{byId[inspectM.cid] ? byId[inspectM.cid].desc : ""}
          </div>
          <div style={{ color: inspect.side === "p" ? "#c9a85a" : "#cf9aef", fontSize: 11, marginTop: 5, fontStyle: "italic" }}>
            {inspect.side === "p" ? "我方随从" : "敌方随从"} · 点击空白处关闭
          </div>
        </div>
      )}

      {/* 瞄准箭头:从选中的攻击者 / 法术源指向光标(按意图着色:攻击红、治疗绿、增益金) */}
      {pointer && aimFrom.current && (selAtk != null || selHeroAtk || spellTargeting) && (() => {
        const color = selAtk != null || selHeroAtk ? "#f85050"
          : selCard && selCard.sp ? (selCard.sp.k === "heal" ? "#5ef08a" : selCard.sp.k === "buff" ? "#ffd700" : "#f85050")
          : "#f85050";
        return (
          <svg style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none", zIndex: 79 }}>
            <defs>
              <marker id="aimHead" markerWidth="8" markerHeight="8" refX="5" refY="3" orient="auto">
                <path d="M0,0 L6,3 L0,6 Z" fill={color} />
              </marker>
            </defs>
            <line x1={aimFrom.current.x} y1={aimFrom.current.y} x2={pointer.x} y2={pointer.y} stroke={color} strokeWidth={4} strokeLinecap="round" strokeDasharray="2 9" markerEnd="url(#aimHead)" opacity={0.92} />
            <circle cx={aimFrom.current.x} cy={aimFrom.current.y} r={5} fill={color} opacity={0.92} />
          </svg>
        );
      })()}

      {/* 手牌 */}
      <div onMouseLeave={() => setHovHand(null)} style={{ display: "flex", justifyContent: "center", alignItems: "flex-end", padding: "22px 6px 10px", minHeight: 142 }}>
        {game.p.hand.length ? game.p.hand.map((en, i) => {
          const ec = effCard(game, "p", en); // 殒命暗影:手牌中即显示为上一张法术
          const transformed = byId[en.cid].sp?.k === "shadow" && ec.sp?.k !== "shadow";
          return <HandCard key={en.uid} c={ec} transformed={transformed} i={i} selHand={selHand} mana={game.p.mana} myTurn={myTurn} handleHand={handleHand} setHovHand={setHovHand} cost={effCost(game, "p", ec, en)} bonus={game.p.spellDmg || 0} />;
        }) : <span style={{ color: "#8a8468", fontSize: 15 }}>(手牌为空)</span>}
      </div>

      {/* 底栏:我方 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 14px", background: "linear-gradient(0deg,#523c20,#3a2a14)", borderTop: "2px solid #8a6d3b", gap: 8 }}>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <HeroEl side="p" h={game.p} isT={isT} clickEntity={clickEntity} floats={floats} canAtk={heroCanAtk} sel={selHeroAtk} onHeroPower={doHeroPower} canUseHeroPower={canUseHeroPower} heroPowerCost={HERO_POWER_COST} />
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "#7cc4ff", fontWeight: 800, fontSize: 16 }}>{game.p.mana}/{game.p.maxMana}</span>
            <div style={{ display: "flex", gap: 2 }}>
              {Array.from({ length: game.p.maxMana }).map((_, i) => (
                <span key={i} style={{ width: 14, height: 14, borderRadius: "50%", background: i < game.p.mana ? "radial-gradient(circle at 35% 30%,#9fd6ff,#1d6fd1 65%,#0c3e85)" : "#16314f", border: "1px solid #5c83ad", boxShadow: i < game.p.mana ? "0 0 5px #4da3ff" : "none" }} />
              ))}
            </div>
          </div>
          <span style={{ fontSize: 14, color: "#cdbf9a" }}>牌库 {game.p.deck.length}</span>
        </div>
      </div>

      {/* 战斗记录面板 */}
      {showLog && (
        <div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", left: 8, bottom: 150, width: "min(320px,80vw)", maxHeight: "42vh", display: "flex", flexDirection: "column", zIndex: 85, background: "rgba(20,15,7,.95)", border: "2px solid #8a6d3b", borderRadius: 12, padding: "8px 12px 10px", boxShadow: "0 8px 24px rgba(0,0,0,.7)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4, flexShrink: 0 }}>
            <span style={{ color: "#ffd700", fontSize: 12, fontWeight: 800 }}>📜 战斗记录</span>
            <button onClick={() => setShowLog(false)} style={{ background: "none", border: "none", color: "#cdbf9a", fontSize: 14, cursor: "pointer", padding: "0 2px", fontFamily: "inherit" }}>✕</button>
          </div>
          <div style={{ overflowY: "auto" }}>
            {(game.logs || []).slice().reverse().map((l) => (
              <div key={l.id} style={{ fontSize: 12, lineHeight: 1.7, color: l.important ? "#ffb04d" : "#d8c89a", borderBottom: "1px solid rgba(138,109,59,.25)" }}>
                <span style={{ color: "#8f8568", marginRight: 6 }}>回合{l.turn}</span>
                {l.text}
              </div>
            ))}
            {!(game.logs || []).length && <div style={{ color: "#8f8568", fontSize: 11 }}>暂无记录</div>}
          </div>
        </div>
      )}

      {/* 烧牌 / 疲劳等重要事件提示 */}
      {game.notice && (
        <div key={game.notice.id} style={{ position: "absolute", top: "34%", left: 0, right: 0, display: "flex", justifyContent: "center", pointerEvents: "none", zIndex: 82 }}>
          <span style={{ background: "rgba(112,32,12,.92)", border: "1px solid #ff9a5c", color: "#ffe2c4", padding: "7px 18px", borderRadius: 999, fontSize: 13, fontWeight: 700, boxShadow: "0 4px 14px rgba(0,0,0,.6)", animation: "noticeFx 2.6s ease forwards", maxWidth: "88vw", textAlign: "center" }}>
            {game.notice.text}
          </span>
        </div>
      )}

      {/* 抉择弹窗 */}
      {pending && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(8,6,2,.78)", zIndex: 86, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 20 }}>
          <div style={{ fontSize: 19, fontWeight: 900, color: "#ffd700", textShadow: "0 0 14px rgba(255,200,0,.6)", letterSpacing: 2, textAlign: "center" }}>
            {pending.k === "camp"
              ? `🏕️ 星夜露宿 — 抉择(剩余 ${pending.remaining} 次)`
              : pending.k === "bloomMode"
              ? "🌺 夜影花蕾 — 抉择"
              : pending.k === "choose"
              ? `${pending.emoji} ${pending.name} — 抉择`
              : pending.k === "moonPick"
              ? "🌙 月光指引 — 发现一张牌,获得其复制"
              : pending.k === "dredge"
              ? `🎣 探底 — 选一张置于牌库顶${pending.draw ? "并抽取(连击)" : ""}`
              : pending.k === "mapDiscover"
              ? "🗺️ 异教地图 — 发现一张牌并抽取"
              : pending.k === "mapPick"
              ? "🗺️ 异教地图 — 从剩余选项再抽一张"
              : `🌺 夜影花蕾 — ${pending.mode === "m" ? "选择一个随从召唤" : "选择一个法术施放"}`}
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
            {pending.k === "bloomMode" &&
              (() => {
                const mOk = game.p.board.length < 6 && game.p.deck.some((cid) => byId[cid].type === "m");
                const sOk = game.p.deck.some((cid) => byId[cid].type === "s");
                const modes: { id: BloomMode; ok: boolean; emoji: string; title: string; desc: string; off: string | false }[] = [
                  { id: "m", ok: mOk, emoji: "⚔️", title: "召唤随从", desc: "从牌库随机 3 张随从牌中选 1 张召唤", off: !mOk && (game.p.board.length >= 6 ? "随从区已满" : "牌库中没有随从牌") },
                  { id: "s", ok: sOk, emoji: "📜", title: "释放法术", desc: "从牌库随机 3 张法术牌中选 1 张施放", off: !sOk && "牌库中没有可施放的法术牌" },
                ];
                return modes.map((o) => (
                  <div
                    key={o.id}
                    onClick={() => { if (o.ok) pickBloomMode(o.id); }}
                    style={{ width: 160, borderRadius: 12, padding: "16px 12px", cursor: o.ok ? "pointer" : "default", textAlign: "center", background: "linear-gradient(170deg,#4a3354,#241a2c)", border: "2px solid " + (o.ok ? "#ffd700" : "#5a5248"), boxShadow: o.ok ? "0 0 14px rgba(255,215,0,.35)" : "none", opacity: o.ok ? 1 : 0.5 }}
                  >
                    <div style={{ fontSize: 32 }}>{o.emoji}</div>
                    <div style={{ color: "#ffe9b0", fontWeight: 800, fontSize: 14, margin: "4px 0" }}>{o.title}</div>
                    <div style={{ color: "#d8cdb2", fontSize: 11, lineHeight: 1.5 }}>{o.ok ? o.desc : o.off}</div>
                  </div>
                ));
              })()}
            {(pending.k === "bloomPick" || pending.k === "moonPick" || pending.k === "dredge" || pending.k === "mapDiscover" || pending.k === "mapPick") &&
              pending.opts.map((cid, idx) => {
                const c = byId[cid];
                const pick =
                  pending.k === "moonPick" ? pickMoon
                  : pending.k === "bloomPick" ? pickBloomCard
                  : pending.k === "dredge" ? pickDredge
                  : pending.k === "mapDiscover" ? pickMapDiscover
                  : pickMapLeft;
                return (
                  <div
                    key={idx}
                    onClick={() => pick(idx)}
                    style={{ position: "relative", width: 148, borderRadius: 12, padding: "14px 10px", cursor: "pointer", textAlign: "center", background: c.type === "m" ? "linear-gradient(170deg,#7a5c33,#3c2b12)" : "linear-gradient(170deg,#3d4f8a,#1d2244)", border: "2px solid #ffd700", boxShadow: "0 0 14px rgba(255,215,0,.35)" }}
                  >
                    <span style={{ position: "absolute", top: -8, left: -8, width: 24, height: 24, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%,#9fd6ff,#1f63c4 60%,#0b3a7e)", border: "2px solid #cfe6ff", color: "#fff", fontSize: 12, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {c.cost}
                    </span>
                    <div style={{ fontSize: 32 }}>{c.emoji}</div>
                    <div style={{ color: "#ffe9b0", fontWeight: 800, fontSize: 14 }}>{c.name}</div>
                    <div style={{ color: "#9fd6ff", fontSize: 11, fontWeight: 700 }}>{c.type === "m" ? `${c.atk} 攻 / ${c.hp} 血` : c.type === "w" ? `${c.atk} 攻 / ${c.dur} 耐久` : spSummary(c.sp, game.p.spellDmg || 0)}</div>
                    <div style={{ color: "#d8cdb2", fontSize: 10, marginTop: 3, lineHeight: 1.4 }}>{kw(c)}{cardDesc(c, game.p.spellDmg || 0)}</div>
                  </div>
                );
              })}
            {pending.k === "choose" &&
              pending.opts.map((o, idx) => (
                <div
                  key={idx}
                  onClick={() => pickChoose(idx)}
                  style={{ width: 150, borderRadius: 12, padding: "16px 12px", cursor: "pointer", textAlign: "center", background: "linear-gradient(170deg,#33475a,#1a2630)", border: "2px solid #ffd700", boxShadow: "0 0 14px rgba(255,215,0,.35)" }}
                >
                  <div style={{ fontSize: 32 }}>{o.emoji}</div>
                  <div style={{ color: "#ffe9b0", fontWeight: 800, fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>{o.label}</div>
                </div>
              ))}
            {pending.k === "camp" &&
              (
                [
                  { o: "mana", emoji: "💎", title: "回复法力", desc: "回复 3 个法力水晶" },
                  { o: "draw", emoji: "🃏", title: "抽牌", desc: "抽两张牌" },
                  { o: "armor", emoji: "🛡️", title: "护甲", desc: "获得 5 点护甲" },
                ] as { o: CampOpt; emoji: string; title: string; desc: string }[]
              ).map((x) => (
                <div
                  key={x.o}
                  onClick={() => pickCamp(x.o)}
                  style={{ width: 130, borderRadius: 12, padding: "16px 12px", cursor: "pointer", textAlign: "center", background: "linear-gradient(170deg,#33475a,#1a2630)", border: "2px solid #ffd700", boxShadow: "0 0 14px rgba(255,215,0,.35)" }}
                >
                  <div style={{ fontSize: 32 }}>{x.emoji}</div>
                  <div style={{ color: "#ffe9b0", fontWeight: 800, fontSize: 14, margin: "4px 0" }}>{x.title}</div>
                  <div style={{ color: "#d8cdb2", fontSize: 11 }}>{x.desc}</div>
                </div>
              ))}
          </div>
          {pending.k === "choose" || pending.k === "bloomMode" ? (
            <button onClick={cancelPending} style={{ padding: "8px 22px", borderRadius: 999, fontWeight: 700, fontSize: 13, cursor: "pointer", border: "1px solid #8a6d3b", background: "rgba(0,0,0,.45)", color: "#cdbf9a", fontFamily: "inherit" }}>
              ↩ 取消(不消耗费用)
            </button>
          ) : (
            <div style={{ color: "#bfae84", fontSize: 11 }}>必须完成抉择才能继续</div>
          )}
        </div>
      )}


      {/* 认输确认 */}
      {confirmSurrender && game.phase === "play" && !game.winner && (
        <div onClick={() => setConfirmSurrender(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 88, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "linear-gradient(170deg,#3a2a14,#241a0a)", border: "2px solid #8a6d3b", borderRadius: 14, padding: "20px 26px", textAlign: "center", maxWidth: 280, boxShadow: "0 8px 24px rgba(0,0,0,.7)" }}>
            <div style={{ fontSize: 32 }}>🏳️</div>
            <div style={{ color: "#f4e6c1", fontSize: 15, fontWeight: 800, margin: "8px 0 4px" }}>确定要认输吗?</div>
            <div style={{ color: "#bfae84", fontSize: 12, marginBottom: 16 }}>本局将立即判负并结束对战</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={surrender} style={{ padding: "8px 20px", borderRadius: 999, fontWeight: 800, fontSize: 13, cursor: "pointer", border: "2px solid #e08a7c", background: "linear-gradient(180deg,#d96a58,#9c3328)", color: "#fff", fontFamily: "inherit" }}>
                认输
              </button>
              <button onClick={() => setConfirmSurrender(false)} style={{ padding: "8px 20px", borderRadius: 999, fontWeight: 800, fontSize: 13, cursor: "pointer", border: "1px solid #8a6d3b", background: "none", color: "#cdbf9a", fontFamily: "inherit" }}>
                继续对战
              </button>
            </div>
          </div>
        </div>
      )}

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
          <span style={{ fontSize: 60 }}>{game.winner === "p" ? "🏆" : game.surrendered ? "🏳️" : "💀"}</span>
          <span style={{ fontSize: 36, fontWeight: 900, color: game.winner === "p" ? "#ffd700" : "#b9b9c9", textShadow: "0 2px 8px #000", letterSpacing: 10 }}>
            {game.winner === "p" ? "胜 利" : "战 败"}
          </span>
          <span style={{ color: "#cbbd96", fontSize: 13, textAlign: "center" }}>
            {game.winner === "p" ? "获胜！你的对手被击败了!" : game.surrendered ? "你选择了认输……重整旗鼓,下次再战!" : "你倒下了……下次再战!"}
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
