export interface WordEntry {
  /** 英文单词或短语 */
  word: string
  /** 音标 */
  phonetic?: string
  /** 中文释义 */
  translation: string
  /** 词性标记，如 n. / v. / adj. */
  pos?: string
  /** 例句（可选） */
  example?: string
  /** 例句翻译（可选） */
  exampleCn?: string
  /** 记忆口诀（可选，SRS 模式使用） */
  mnemonic?: string
  /** 连读提示、发音注意事项（可选） */
  note?: string
}

export interface WordBook {
  id: string
  name: string
  description: string
  level: 'beginner' | 'intermediate' | 'advanced' | 'phrase'
  words: WordEntry[]
  /** 分类标签，用于UI分组 */
  category?: 'spoken' | 'tech' | 'expression' | 'business' | 'exam'
  /** 难度梯度标签，如 ['L1', 'L2', 'L3'] 或 ['T1', 'T2', 'T3'] */
  tags?: string[]
}

/** 旧版播放模式（顺序模式时使用） */
export type PlayMode = 'order' | 'shuffle' | 'single'

/**
 * 学习模式
 * - srs: 间隔重复模式 —— 基于记忆科学，5级掌握度，扩张间隔复习
 * - memory: 记忆模式 —— 分组学习，每组多轮重复 + 间隔复习
 * - recall: 回忆模式 —— 先读中文，沉默N秒让用户回忆英文，再公布答案
 * - sequential: 顺序模式 —— 逐个播放（旧版行为）
 * - blind: 盲听模式 —— 英文→沉默→英文重复→中文，纯听觉训练听力理解
 */
export type LearnMode = 'srs' | 'memory' | 'recall' | 'sequential' | 'blind'

/**
 * 掌握度等级（SRS 模式）
 * - 0: 新词（尚未学习）
 * - 1: 学过一次（+30秒后复习）
 * - 2: 辨认复习过（+2分钟后复习）
 * - 3: 线索回忆过（+5分钟后复习）
 * - 4: 自由回忆过（+10分钟后复习）
 * - 5: 已掌握（本课锁定）
 */
export type Familiarity = 0 | 1 | 2 | 3 | 4 | 5

/** 单个单词的复习状态（SRS 模式，存 localStorage） */
export interface ReviewItem {
  /** 单词在词库中的索引 */
  wordIndex: number
  /** 当前掌握度等级 0-5 */
  familiarity: Familiarity
  /** 下次复习的时间戳（毫秒） */
  nextReviewAt: number
  /** 上次复习的时间戳（毫秒） */
  lastReviewAt: number
  /** 已复习次数 */
  reviewCount: number
}

/** 会话统计信息 */
export interface SessionStats {
  /** 已学过（familiarity >= 1） */
  learned: number
  /** 复习中（1 <= familiarity <= 4） */
  reviewing: number
  /** 已掌握（familiarity === 5） */
  mastered: number
  /** 词库总数 */
  total: number
}

/** 当前播放阶段 */
export type PlayPhase = 'learn' | 'review' | 'test' | 'recall' | 'normal' | 'mastered' | 'blind'

export interface PlayerSettings {
  /** 语速 0.5 - 2.0 */
  rate: number
  /** 单词间停顿秒数 */
  pauseBetween: number
  /** 朗读中文翻译 */
  speakTranslation: boolean
  /** 朗读例句 */
  speakExample: boolean
  /** 音节拆解朗读（按音节读 + 发音规则提示） */
  speakSpelling: boolean
  /** 逐字母拼读（A-B-C-D 拆字母念） */
  speakLetters: boolean
  /** 学习模式 */
  learnMode: LearnMode
  /** 顺序模式下的播放方式 */
  playMode: PlayMode
  /** 重复朗读次数 */
  repeat: number
  /** 单词英文重复朗读次数（1-5，默认2） */
  wordRepeat: number
  /** 例句重复朗读次数（1-3，默认1） */
  exampleRepeat: number
  /** 分组大小（记忆模式）3 - 10 */
  groupSize: number
  /** 每组重复轮数（记忆模式）1 - 5 */
  groupRepeat: number
  /** 回忆间隔秒数（回忆模式）2 - 10 */
  recallPause: number
  /** 是否开启间隔复习（记忆模式） */
  reviewEnabled: boolean
  /** 每轮新词数（SRS 模式）1 - 5 */
  newWordsPerRound: number
}

/** 播放阶段信息（传给 UI 显示） */
export interface PlayPhaseInfo {
  phase: PlayPhase
  group: number
  round: number
  totalGroups: number
  totalRounds: number
  /** 当前单词掌握度（SRS 模式） */
  familiarity?: Familiarity
  /** 会话统计（SRS 模式） */
  sessionStats?: SessionStats
}
