# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

奥术王座(fantasy-card-battle)——Vite + React 19 + TypeScript(strict)写的炉石风单机卡牌对战。无后端,牌组存 localStorage。

## 常用命令

```bash
npm run dev        # Vite 开发服务器
npm run build      # tsc --noEmit 类型检查 + vite build
npm run typecheck  # 仅类型检查(strict,noUnusedLocals/Parameters 都开)
npm run test       # vitest run(引擎单测)
```

- 跑单个测试:`npx vitest run -t "护甲先于生命抵挡"`(按 `it(...)` 标题过滤),或 `npx vitest run src/engine.test.ts`。
- 自对弈跑分(镜像基线 + 价值策略对打):`npx vitest run src/selfplay.test.ts`。
- CEM 权重训练(默认 `it.skip`,需显式开):`TRAIN=1 npx vitest run src/cem.train.test.ts --disable-console-intercept`。训完把打印的 `LEARNED_WEIGHTS` 粘进 `valuePolicy.ts` 的 `DEFAULT_WEIGHTS`。

## 架构

数据流单向:**`engine.ts`(纯函数规则引擎,不碰 React)→ AI 决策(`ai.ts` 启发式 / `valuePolicy.ts` 价值策略)→ `FantasyCardBattle.tsx`(React UI)**。引擎函数签名统一为 `fn(st, side, ...)`,直接 mutate 传入的 `st`,`side` 为 `"p"`(玩家)/`"a"`(AI)。

| 文件 | 职责 |
|---|---|
| `src/types.ts` | 全局类型。`SpellDef` 是 discriminated union;新增效果种类漏掉分发会编译报错 |
| `src/cards.ts` | 卡牌数据(`POOL`/token 卡/`byId`)、牌组持久化(`loadDecks`/`saveDecks`,localStorage)、纯展示辅助 |
| `src/engine.ts` | 规则引擎 + **效果注册表 `EFFECTS`** + 可复现 RNG |
| `src/ai.ts` | 启发式 AI(`aiPlay`/`aiAttack`/`computeAiTurn`)+ side 无关的交互法术 helper(`applyBloom`/`applyCamp`/`applyChoose`/`applyMoonlight`/`applyMap`/`applyDredge`) |
| `src/aiPlanner.ts` | 出牌阶段有界 DFS 规划器(`planPlayPhase`),发现跨多步的 combo 线;被 `computeAiTurn` 调用 |
| `src/valuePolicy.ts` | **当前 UI 实际使用的 AI**:可训练线性价值策略 + 整回合搜索 + `computeValueAiTurn` |
| `src/selfplay.ts` | Headless 自对弈台(`Policy` 接口 / `playOneGame` / `runSelfPlay`),训练与跑分的地基 |
| `src/cem.ts` | CEM(交叉熵法)用自对弈胜率训练价值策略权重 |
| `src/ui/components.tsx` | 顶层展示组件(`Badge`/`MinionEl`/`HeroEl`/`HandCard`)+ CSS keyframes |
| `src/FantasyCardBattle.tsx` | 主组件:menu/deck/play/over 四个 phase 的 UI 与交互 |

### 三个核心机制

**效果注册表 `EFFECTS`(engine.ts)** — 所有 `sp.k`(法术效果)的行为集中在这一处。每个效果定义 `summary`(卡面简述)、`cast`(从手牌打出)、`autoCast`(被夜影花蕾从牌库直接施放)。`castSpell`/`castDeckSpell`/`spSummary` 都只是它的薄分发层。`EffectRegistry` 是 mapped type 强制穷尽——给 `SpellDef` 新增 `k` 却忘了登记会**直接编译报错**。交互类法术(choose/camp/bloom/moonlight/map/dredge)省略 `cast`,改由 UI 的 pending 流程接管。

**pending 抉择弹窗(FantasyCardBattle.tsx)⭐ 最易改坏的部分** — `st.pending` 非空时弹全屏抉择层并**阻断其余全部交互**(`handleHand`/`clickEntity`/`endTurn` 开头都检查 `game.pending`)。可取消的两类(`choose`/`bloomMode`)用**延迟支付**:进弹窗时不扣费不离手,`pending` 只存手牌索引 `i`,确认时才扣费 splice。这成立的前提是 pending 期间手牌不变——加入"pending 期间也能触发的效果"前必须先重构。

**可复现 RNG** — 引擎所有随机走 `rand(st)`(mulberry32,状态即 `st.rngState` 这个 uint32,JSON 克隆安全)。`initGame(deck, seed?)` 可注入种子复现整局。新增引擎随机逻辑用 `rand/randInt/randPick`,**不要直接 `Math.random`**。

### AI 有两套,UI 用的是价值策略
项目里并存两套 AI,**都遵守同一"逐帧快照"契约**:克隆 state、跑完整个 AI 回合、产出**快照数组**;UI 以 ~750ms 间隔逐帧 `setGame` 回放成"AI 一步步出牌"。⚠️ AI 回合期间不要另行 `setGame`,会被后续快照覆盖。

- **价值策略(`valuePolicy.ts`,UI 现役)** — `FantasyCardBattle.tsx` 调 `computeValueAiTurn(base)`。决策 = 枚举所有合法原子动作(出牌/英雄技能/随从攻击/英雄攻击)→ 各自 clone 模拟一步 → 用线性价值 `V(s)=w·φ(s)` 打分 → 整回合有界 DFS 找最优线(出牌与攻击交织)→ 攻击阶段贪婪兜底。`φ` 是 9 维特征(`FEATURE_NAMES`),`w` 是 `DEFAULT_WEIGHTS`(由 CEM 自对弈训练得到)。**side 无关**:特征一切相对行动方计算,故同一套权重能驱动双方,是自对弈训练的载体。
- **启发式 AI(`ai.ts`,训练对手/历史实现)** — `computeAiTurn` 是一条优先级 if-return 链(`aiPlay`,有意不并入 `EFFECTS`),combo 牌组额外调 `aiPlanner.planPlayPhase` 做出牌阶段 DFS。现在主要作为自对弈台的基线对手(`heuristicPolicy`),不再直接驱动 UI。

### 自对弈 / 训练子系统(selfplay + valuePolicy + cem)
- `selfplay.ts` 的 `Policy = (st, side) => GameState` 把"打完整整一回合"抽象出来。`heuristicPolicy` 包装 `computeAiTurn`:它只驱动 `"a"` 方且自带 `startTurn`、不改入参,故让 `"p"` 行动时**交换 `st.a`/`st.p`**,打完换回并翻转 winner——同一套 AI 即可驱动双方,无需改 `ai.ts`。
- `runSelfPlay(p, a, pPol, aPol, n)` 批量跑对局,固定 seed 完整复现。
- `cem.ts` 维护权重分布 `N(mean, std²)`,每代采样一批 `w`、各自对打基线测胜率、取精英更新分布。降噪靠公共随机数(同代同 seed,只比策略不比运气)+ 精英主义(均值也作候选评估)。训练用小 `nodeCap` 换吞吐,验收用大 `nodeCap` + 大样本。

### UI 约定
状态更新统一走 `mutate(fn)`(深拷贝 → 引擎函数改 → setGame)。展示组件定义在**模块顶层**,避免每次渲染重挂载导致 CSS transition 失效——新增展示组件保持这个写法。

## 添加新卡 checklist
1. `cards.ts` 的 `POOL` 加条目(id 唯一);token 衍生牌不进 `POOL`,单独 `byId[X.id] = X`。
2. 复用现有 `sp.k` 则此步到此为止;新增 `sp.k` 要在 `types.ts` 的 `SpellDef` 加形状 + 在 `engine.ts` 的 `EFFECTS` 加条目(漏写即编译报错)。目标类型只设卡面 `sp.t`(`"any"`/`"fm"`/缺省=无目标),`isValidSpellTarget` 自动生效。
3. **启发式 AI**:必须在 `ai.ts` 的 `aiPlay` 加使用逻辑——AI 牌库随机生成,一定会抽到这张卡,否则 AI 卡手。
4. **价值策略**:普通随从/武器/有目标法术由 `valuePolicy.ts` 的枚举自动覆盖,通常无需改。但新增的**交互类 `sp.k`** 要同时在 `aiPlanner.ts` 与 `valuePolicy.ts` 的 `INTERACTIVE` 集合登记、在各自 `applyAct/applyAction` 的 `icast` 分支加 dispatch,并在 `ai.ts` 写对应的 side 无关 `applyX` helper(两条搜索路径共用)。
5. 需要玩家交互弹窗的:`handleHand` 加分支 + `pending` 新 k + 弹窗渲染 + 确认/取消函数。
6. 任何"从手牌打出"的新路径,结尾都要调 `moonTutor(st, side, en)`(月光指引定向抽本体),别漏。
7. 加引擎单测,手动测三条路径:玩家打出 / AI 打出 / 被夜影花蕾从牌库施放。

## 坑
- `clone` 用 `JSON.parse(JSON.stringify())`:state 里不能放函数、undefined、Date。
- `UID`/`FXID` 是模块级自增全局变量,HMR 后继续累加,别假设从 1 开始。
- `summonFromDeck` 名字有误导:它**不从牌库移除**,只按 cid 放随从上场;需移除时调用方自己 `removeFromDeck`。
- 战吼(`bc`)只在从手牌打出(`playMinion`)时触发,从牌库召唤不触发——有意为之。
- AI 抉择牌分支在 `aiPlay` 里手动扣费,与玩家的延迟支付实现不同,改抉择规则两边都要看。
- `DEFAULT_WEIGHTS` 的长度必须严格等于 `features` 的维度(改 `φ` 要同步改权重并重训)。当前权重是为**潜行者 combo 牌组**训练的;换牌组想要最优表现需重训(UI 对所有牌组用同一套权重)。
- `aiPlanner.ts`(启发式)和 `valuePolicy.ts`(价值策略)各有一套独立的动作枚举 / DFS / 状态指纹,逻辑相似但**不共享**;改其一注意另一处是否需要同改。

更详细的内部分区、机制说明与架构演进史见 `维护指南.md`(注:该文档尚未覆盖自对弈/价值策略子系统)。
