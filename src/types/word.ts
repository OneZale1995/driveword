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
}

export interface WordBook {
  id: string
  name: string
  description: string
  level: 'beginner' | 'intermediate' | 'advanced' | 'phrase'
  words: WordEntry[]
}

/** 旧版播放模式（顺序模式时使用） */
export type PlayMode = 'order' | 'shuffle' | 'single'

/**
 * 学习模式
 * - memory: 记忆模式 —— 分组学习，每组多轮重复 + 间隔复习
 * - recall: 回忆模式 —— 先读中文，沉默N秒让用户回忆英文，再公布答案
 * - sequential: 顺序模式 —— 逐个播放（旧版行为）
 */
export type LearnMode = 'memory' | 'recall' | 'sequential'

/** 当前播放阶段 */
export type PlayPhase = 'learn' | 'review' | 'test' | 'recall' | 'normal'

export interface PlayerSettings {
  /** 语速 0.5 - 2.0 */
  rate: number
  /** 单词间停顿秒数 */
  pauseBetween: number
  /** 朗读中文翻译 */
  speakTranslation: boolean
  /** 朗读例句 */
  speakExample: boolean
  /** 逐字母拼读单词 */
  speakSpelling: boolean
  /** 学习模式 */
  learnMode: LearnMode
  /** 顺序模式下的播放方式 */
  playMode: PlayMode
  /** 重复朗读次数 */
  repeat: number
  /** 分组大小（记忆模式）3 - 10 */
  groupSize: number
  /** 每组重复轮数（记忆模式）1 - 5 */
  groupRepeat: number
  /** 回忆间隔秒数（回忆模式）2 - 10 */
  recallPause: number
  /** 是否开启间隔复习（记忆模式） */
  reviewEnabled: boolean
}

/** 播放阶段信息（传给 UI 显示） */
export interface PlayPhaseInfo {
  phase: PlayPhase
  group: number
  round: number
  totalGroups: number
  totalRounds: number
}
