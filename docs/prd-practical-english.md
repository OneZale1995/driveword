# DriveWord 实用英语内容策略 PRD

> **版本**: v1.0  
> **日期**: 2025-07-17  
> **作者**: 产品经理 许清楚  
> **状态**: 待评审

---

## 1. 项目信息

| 项目 | 内容 |
|------|------|
| **应用名称** | DriveWord（开车背单词） |
| **技术栈** | Vite + React 19 + TypeScript + Tailwind + shadcn/ui |
| **原始需求** | 用户目标从"过四级"变更为"能看英语文章、日常沟通、看YouTube科技视频"，需要重构词库内容并增加听力训练能力 |
| **当前水平** | 初中英语（词汇量约1500-2000，听力较弱） |
| **核心场景** | 每天开车通勤来回40分钟，纯音频学习，无法看屏幕 |
| **优先级** | 听力 > 阅读 > 口语 |

---

## 2. 问题分析

### 2.1 现有词库与用户需求的错位

| 现有词库 | 词量 | 问题 |
|----------|------|------|
| CET4 核心词汇 | 1223 | 考试导向，偏书面语（abandon, academic, agriculture），YouTube/口语中频率低 |
| CET6 核心词汇 | 277 | 更偏学术书面（abnormal, aesthetic, aggregate），与日常听力几乎无关 |
| 日常短语 | 60 | 方向正确但量太少，缺少口语填充词和反应语 |
| 商务英语 | 89 | 与用户当前需求（YouTube/日常沟通）关联度低 |

### 2.2 关键缺口

1. **口语高频词缺失**：actually, basically, literally, obviously, definitely 等在 YouTube/日常对话中出现频率极高的词完全没有覆盖
2. **科技领域词汇缺失**：algorithm, framework, deploy, interface, model 等科技 YouTube 核心词为零
3. **连读/弱读训练缺失**：gonna, wanna, gotta, kinda 等真实口语中的缩减形式没有覆盖，这是听力最大的障碍
4. **听力导向不足**：现有 SRS 的 freeRecall 阶段是"中文→沉默→英文"（训练产出），而非"英文→沉默→中文"（训练听力理解）

---

## 3. 词库重构方案

### 3.1 总览

| 新词库 | 替代 | 词量 | 难度 | 定位 |
|--------|------|------|------|------|
| 口语高频词 (`spoken-essential`) | 替代 CET4 | ~600 | beginner→intermediate | YouTube/日常对话中出现频率最高的核心词 |
| 科技英语词汇 (`tech-english`) | 替代 CET6 | ~400 | intermediate→advanced | 编程/AI/数码评测领域高频术语 |
| 日常口语表达 (`daily-expressions`) | 扩展原"日常短语" | ~150 | phrase | 口语填充词、反应语、连读缩减形式 |
| 商务英语 (`business`) | 保留 | 89 | advanced | 暂不改动，作为可选词库 |

### 3.2 各词库详细设计

#### 3.2.1 口语高频词 (`spoken-essential`)

**定位**：覆盖 YouTube 视频、播客、日常对话中出现频率最高的 600 个英文单词。这些词在 CET4 中部分存在（如 actually, available），但 CET4 混入了大量考试专用词。

**词汇来源**：
- COCA（美国当代英语语料库）口语子库高频词
- YouTube 科技频道字幕库高频词（提取自 MKBHD、Linus Tech Tips、Fireship 等频道）
- Oxford 3000 口语子集

**词汇梯度**：

| 梯度 | 词量 | 难度 | 示例 |
|------|------|------|------|
| L1 基础口语 | 200 | 初中可学 | actually, basically, obviously, definitely, probably, anyway, whatever, seriously, literally, honestly |
| L2 常用动词 | 200 | 初中→高中 | figure out, point out, come up with, end up, turn out, look into, get along, catch up |
| L3 进阶表达 | 200 | 高中→大学 | sophisticated, inevitable, straightforward, compromise, perspective, essentially, fundamentally |

**数据结构**：复用现有 `WordEntry` 接口，每个词必须包含 `example`（取自真实口语场景的短句）。

#### 3.2.2 科技英语词汇 (`tech-english`)

**定位**：覆盖科技类 YouTube 视频（编程教程、AI 新闻、数码评测）中出现的高频术语。

**词汇来源**：
- 编程教程字幕高频词（Fireship、Traversy Media、ThePrimeagen 等频道）
- AI/ML 领域常用词（Andrej Karpathy、Two Minute Papers 等频道）
- 数码评测常用词（MKBHD、Linus Tech Tips 等频道）

**词汇梯度**：

| 梯度 | 词量 | 难度 | 示例 |
|------|------|------|------|
| T1 编程基础 | 150 | 初级 | algorithm, function, variable, loop, array, debug, compile, syntax, parameter, framework |
| T2 AI/数据 | 150 | 中级 | model, neural, dataset, inference, prompt, token, embedding, fine-tune, gradient, optimize |
| T3 数码/通用科技 | 100 | 中高级 | benchmark, processor, battery, display, performance, upgrade, flagship, reviewer, durability, compatibility |

**数据结构**：复用 `WordEntry`，`example` 取自科技视频真实语境（如 "Let's deploy this to production."）。

#### 3.2.3 日常口语表达 (`daily-expressions`)

**定位**：从现有 60 条扩展到 150 条，增加三类内容：口语填充词、反应语、连读缩减形式。

**新增类别**：

| 类别 | 词量 | 示例 |
|------|------|------|
| 口语填充词/过渡语 | 40 | "You know what", "I mean", "At the end of the day", "Long story short", "To be honest", "By the way", "Make sense" |
| 反应语/互动语 | 30 | "No way!", "That's insane", "Fair enough", "Make sense", "I get it", "Sounds good", "Good point" |
| 连读缩减形式 | 20 | gonna, wanna, gotta, kinda, sorta, lemme, gimme, dunno, outta, coulda |

**连读缩减形式特别说明**：这类词是听力最大障碍之一。YouTube 博主几乎每句话都有缩减形式。需要：
- `word` 字段存缩减形式（如 "gonna"）
- `translation` 存中文含义（如 "将要；打算（= going to）"）
- `example` 存包含该形式的完整句子（如 "I'm gonna show you how to do this."）
- `exampleCn` 存翻译（如 "我要给你展示怎么做。"）

---

## 4. 听力训练方案

### 4.1 新增"盲听模式"（Blind Listening Mode）

**核心思路**：模拟真实听力场景——只播放英文，不读中文翻译，逼迫大脑从纯音频中提取含义。

**与现有模式对比**：

| 模式 | 朗读序列 | 训练目标 | 适合场景 |
|------|----------|----------|----------|
| SRS 间隔重复 | 拼读→英文→中文→例句 | 综合记忆 | 学习新词 |
| 回忆模式 | 中文→沉默→英文 | 产出（中→英） | 拼写训练 |
| **盲听模式（新增）** | **英文→沉默→英文重复→中文** | **听力理解（英→中）** | **听力训练** |

**盲听模式播放序列设计**：

```
1. 播放英文单词/短语（正常语速）
2. 沉默 3-4 秒（逼迫大脑回忆含义）
3. 再次播放英文（可稍慢，确认发音细节）
4. 播放中文翻译（确认/纠偏）
5. [可选] 播放例句英文 → 例句中文
```

**实现方式**：
- 新增 `LearnMode` 类型值 `'blind'`
- 新增 `blindPlayLoop` 函数（参照现有 `recallPlayLoop` 结构）
- 新增 `playBlindSequence` 函数（英文→沉默→英文→中文→例句）
- 设置面板新增模式选项

### 4.2 SRS 系统听力优化

现有 SRS 5 级掌握度的复习序列中，freeRecall（3→4）是"中文→沉默→英文"，训练的是**产出能力**。对于听力优先的用户，这不够。

**调整方案**：不修改 SRS 核心算法，而是调整 `freeRecall` 阶段的播放序列：

| 阶段 | 现有序列 | 调整后序列 | 说明 |
|------|----------|------------|------|
| learn (0→1) | 拼读→英文→中文→口诀→例句 | 不变 | 完整学习，建立初始记忆 |
| recognize (1→2) | 英文→短停顿→中文 | 不变 | 快速辨认 |
| cueRecall (2→3) | 英文→3秒沉默→中文 | 不变 | 听力回忆（已是听力导向） |
| freeRecall (3→4) | 中文→4秒沉默→拼读→英文 | **英文→4秒沉默→中文→英文重复** | 改为听力导向：先听英文，回忆中文含义 |
| master (4→5) | 英文→中文（快速） | 不变 | 最终确认 |

**实现方式**：修改 `playSrsFreeRecallSequence` 函数，将"中文先行"改为"英文先行"。这是一个小改动，不影响 SRS 算法逻辑。

### 4.3 连读/弱读训练

**不单独做模式**，而是通过词库内容覆盖：

1. `daily-expressions` 词库中的"连读缩减形式"类别（gonna, wanna 等）直接作为学习内容
2. 在 `spoken-essential` 的 `example` 例句中，刻意选用包含连读的句子（如 "What are you gonna do?"）
3. 盲听模式天然适合训练连读辨识——因为用户只听不看，必须靠耳朵分辨

**后续可选增强**（P2，非本次必须）：
- 在 WordEntry 中新增 `note` 字段，标注连读提示（如 "going to 在口语中常读作 gonna"）
- 盲听模式中增加"快速模式"，用 1.2x 语速播放例句，模拟 YouTube 博主的正常语速

---

## 5. 学习路径规划

### 5.1 从初中水平到听懂科技 YouTube 的路径

```
Phase 1: 口语筑基        Phase 2: 表达扩展        Phase 3: 科技入门        Phase 4: 持续提升
(Week 1-4)               (Week 5-8)               (Week 9-12)              (Week 13+)
   │                        │                        │                        │
   ├─ spoken-essential      ├─ spoken-essential      ├─ tech-english          ├─ 全部词库混合复习
   │  L1 (200词)            │  L2+L3 (400词)         │  T1+T2 (300词)         │
   │                        ├─ daily-expressions     ├─ daily-expressions     ├─ tech-english T3
   │                        │  (150条)               │  连读缩减形式           │
   │                        │                        │                        │
   ├─ 模式: SRS             ├─ 模式: SRS + 盲听      ├─ 模式: SRS + 盲听      ├─ 模式: 盲听为主
   └─ 目标: 听懂200核心词   └─ 目标: 600词+150表达   └─ 目标: 300科技词       └─ 目标: 看科技YouTube
```

### 5.2 各阶段详细规划

| 阶段 | 周期 | 词库 | 模式 | 每日节奏 | 阶段目标 |
|------|------|------|------|----------|----------|
| **Phase 1** 口语筑基 | 4 周 | spoken-essential L1 (200词) | SRS | 20min新词 + 20min复习 | 听音能辨200个口语核心词 |
| **Phase 2** 表达扩展 | 4 周 | spoken-essential L2+L3 (400词) + daily-expressions (150条) | SRS + 盲听 | 15min新词 + 15min复习 + 10min盲听短语 | 600词+150表达，开始听懂简单YouTube |
| **Phase 3** 科技入门 | 4 周 | tech-english T1+T2 (300词) + 持续复习口语词 | SRS + 盲听 | 20min科技新词 + 20min混合复习 | 掌握300科技词，能跟住科技视频大意 |
| **Phase 4** 持续提升 | 持续 | 全部词库 + tech-english T3 (100词) | 盲听为主 + SRS复习 | 40min混合复习 | 舒适观看科技YouTube（配字幕） |

### 5.3 每日40分钟通勤学习节奏建议

**单程20分钟的推荐节奏**（SRS 模式下）：

| 时间 | 内容 | 说明 |
|------|------|------|
| 0-3 min | 到期复习词 | SRS 自动优先播放到期复习词 |
| 3-15 min | 新词学习 | 每天约 5-8 个新词（`newWordsPerRound` = 5） |
| 15-20 min | 新词+复习交错 | SRS 自动交错新词和复习词 |

**建议设置**：

| 设置项 | 推荐值 | 说明 |
|--------|--------|------|
| `learnMode` | `srs` | 默认使用 SRS |
| `rate` | `0.9` | 稍慢语速，便于辨识 |
| `newWordsPerRound` | `5` | 每天 5 个新词，4 周约 140 词（含周末复习缓冲） |
| `speakSpelling` | `true`（Phase 1-2）→ `false`（Phase 3+） | 前期拼读帮助记忆，后期关闭以接近真实听力 |
| `speakExample` | `true` | 例句是听力训练的关键 |
| `wordRepeat` | `2` | 英文重复2遍加深听音印象 |

---

## 6. 需求优先级

### P0 — Must Have（本次必须实现）

| # | 需求 | 说明 |
|---|------|------|
| 1 | 新建 `spoken-essential` 词库 | ~600词，3个难度梯度，替代 CET4 |
| 2 | 新建 `tech-english` 词库 | ~400词，3个难度梯度，替代 CET6 |
| 3 | 扩展 `daily-expressions` 词库 | 从60条扩展到~150条，增加填充词/反应语/连读缩减形式 |
| 4 | 新增"盲听模式" | `LearnMode` 新增 `'blind'`，实现 blindPlayLoop + playBlindSequence |
| 5 | 修改 SRS freeRecall 序列 | 将 `playSrsFreeRecallSequence` 从"中文先行"改为"英文先行" |

### P1 — Should Have（建议本次实现）

| # | 需求 | 说明 |
|---|------|------|
| 6 | 词库内分梯度学习 | `WordBook` 增加 `levels` 或 `tags` 字段，支持按梯度筛选 |
| 7 | 盲听模式语速调节 | 盲听模式下 `rate` 默认 1.0，并支持单独调快到 1.2x 模拟真实语速 |
| 8 | 保留旧词库作为可选 | CET4/CET6 不删除，标记为"考试向（可选）"，默认不展示 |

### P2 — Nice to Have（后续迭代）

| # | 需求 | 说明 |
|---|------|------|
| 9 | WordEntry 增加 `note` 字段 | 标注连读提示、发音注意事项 |
| 10 | 盲听模式"快速例句" | 例句用 1.2x 语速播放，模拟 YouTube 真实语速 |
| 11 | 学习路径引导 | 首页展示当前阶段、进度条、下一阶段解锁提示 |
| 12 | 听力测试模式 | 从 YouTube 真实字幕中截取短句，让用户听后选择含义 |

---

## 7. 技术影响评估

### 7.1 数据结构变更

```typescript
// types/word.ts — 无破坏性变更

// WordEntry 新增可选字段（P2）
export interface WordEntry {
  word: string
  phonetic?: string
  translation: string
  pos?: string
  example?: string
  exampleCn?: string
  mnemonic?: string
  note?: string  // [P2新增] 连读提示、发音注意
}

// WordBook 新增可选字段（P1）
export interface WordBook {
  id: string
  name: string
  description: string
  level: 'beginner' | 'intermediate' | 'advanced' | 'phrase'
  words: WordEntry[]
  tags?: string[]  // [P1新增] 如 ['L1', 'L2', 'L3'] 或 ['T1', 'T2']
  category?: 'spoken' | 'tech' | 'expression' | 'business' | 'exam'  // [P1新增]
}

// LearnMode 新增盲听模式
export type LearnMode = 'srs' | 'memory' | 'recall' | 'sequential' | 'blind'
//                                                              ^^^^^^ 新增
```

### 7.2 代码变更范围

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `src/data/wordbooks.ts` | 重写 | 新建 spoken-essential、tech-english 词库数据；扩展 daily-expressions |
| `src/types/word.ts` | 小改 | `LearnMode` 增加 `'blind'`；`WordEntry`/`WordBook` 增加可选字段 |
| `src/hooks/useWordPlayer.ts` | 中改 | 新增 `playBlindSequence` + `blindPlayLoop`；修改 `playSrsFreeRecallSequence` |
| `src/components/SettingsPanel.tsx` | 小改 | 学习模式选择增加"盲听模式"选项 |
| `src/App.tsx` | 小改 | `MODE_LABELS` 增加盲听模式 |

### 7.3 兼容性

- 现有 localStorage 进度数据（`driveword-progress-*`）不受影响——词库 ID 变更后旧进度自然失效，新词库从零开始
- 现有 4 种学习模式（SRS/Memory/Recall/Sequential）全部保留，盲听模式是新增
- `playSrsFreeRecallSequence` 的修改对现有 SRS 流程无破坏——只是改变了 3→4 阶段的播放序列

---

## 8. 待确认问题

| # | 问题 | 影响范围 | 建议 |
|---|------|----------|------|
| 1 | spoken-essential 词库的具体 600 词列表是否需要用户确认？ | 词库内容 | 建议由产品经理提供词表初稿，工程师直接录入。词表来源：COCA口语高频 + YouTube科技频道字幕高频取交集 |
| 2 | tech-english 词库是否需要细分编程/AI/数码三个子词库，还是一个词库内打标签？ | 数据结构 | 建议**一个词库内打标签**（T1/T2/T3），避免词库过多导致选择困难 |
| 3 | 旧 CET4/CET6 词库是否保留？ | 词库管理 | 建议保留但标记为"考试向（可选）"，默认折叠不展示。用户当前目标不涉及考试 |
| 4 | 盲听模式是否需要独立于 SRS 的进度追踪？ | SRS 系统 | 建议**复用 SRS 进度**——盲听模式播放的词也走 SRS 的 familiarity 升级逻辑，这样学习和听力训练的进度统一 |
| 5 | 用户是否希望加入 YouTube 真实字幕片段作为听力材料？ | 产品方向 | 本次不做（P2），但建议后续考虑——直接从科技 YouTube 频道截取 5-10 秒片段作为听力测试 |

---

## 9. 验收标准

1. **词库**：新建 `spoken-essential`（≥500词）、`tech-english`（≥300词），扩展 `daily-expressions`（≥120条），每个词/短语必须有 `example` 和 `exampleCn`
2. **盲听模式**：选择盲听模式后，播放序列为"英文→沉默3-4秒→英文重复→中文→例句英文→例句中文"，且进度走 SRS familiarity 升级
3. **SRS freeRecall**：Phase 3→4 的复习序列从"中文→沉默→英文"变为"英文→沉默→中文→英文重复"
4. **学习模式选择**：设置面板中学习模式选项新增"盲听模式"，图标用 `Ear`
5. **兼容性**：现有 4 种模式功能不受影响，旧词库可选择保留
