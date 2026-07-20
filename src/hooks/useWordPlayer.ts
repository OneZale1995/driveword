import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  Familiarity,
  PlayerSettings,
  PlayPhase,
  PlayPhaseInfo,
  ReviewItem,
  SessionStats,
  WordBook,
  WordEntry,
} from '@/types/word'
import { mnemonics } from '@/data/mnemonics'
import { buildSyllableSpeech } from '@/utils/phonetics'
import { useSpeech } from './useSpeech'
import { useProgress } from './useProgress'

const DEFAULT_SETTINGS: PlayerSettings = {
  rate: 0.9,
  pauseBetween: 1.5,
  speakTranslation: true,
  speakExample: true,
  speakSpelling: true,
  speakLetters: true,
  learnMode: 'srs',
  playMode: 'order',
  repeat: 1,
  wordRepeat: 2,
  exampleRepeat: 1,
  groupSize: 5,
  groupRepeat: 3,
  recallPause: 4,
  reviewEnabled: true,
  newWordsPerRound: 5,
}

/**
 * 单词播放器 —— 记忆驱动版
 *
 * 五种学习模式：
 *
 * 1. SRS 间隔重复模式（srs）：
 *    基于记忆科学，5级掌握度（0=新词 → 5=已掌握）。
 *    新词与复习词交错播放：学1个新词 → 复习到期词 → 学1个新词 → ...
 *    每个等级跃迁对应不同的播放序列和扩张间隔。
 *    进度存 localStorage，跨会话恢复。
 *
 * 2. 记忆模式（memory）：
 *    将词库分成 N 个一组，每组重复 R 轮：
 *    - 第 0 轮（学习）：音节拆解 → 英文 → 中文（完整流程）
 *    - 第 1 轮（复习）：英文 → 中文（快速过一遍）
 *    - 第 2+ 轮（测试）：英文 → 长停顿 → 中文（逼你回忆）
 *    每组结束后，随机抽 2-3 个之前学过的词进行间隔复习
 *
 * 3. 回忆模式（recall）：
 *    先读中文 → 沉默 N 秒（你回忆英文）→ 公布英文 + 音节拆解
 *    纯听觉主动回忆，不开屏幕也能练
 *
 * 4. 顺序模式（sequential）：
 *    逐个播放，支持顺序/随机/单曲（旧版行为）
 *
 * 5. 盲听模式（blind）：
 *    英文(正常) → 沉默 → 英文(稍慢) → 中文 → [可选]例句
 *    纯听觉训练听力理解，不拼读字母
 */
export function useWordPlayer(wordbook: WordBook) {
  const {
    speak,
    cancel,
    supported,
    availableVoices,
    selectedEnVoice,
    selectedZhVoice,
    setEnVoice,
    setZhVoice,
  } = useSpeech()
  const [settings, setSettings] = useState<PlayerSettings>(DEFAULT_SETTINGS)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)

  // SRS 进度持久化
  const progress = useProgress(wordbook.id, wordbook.words.length)

  // 学习阶段状态
  const [phaseInfo, setPhaseInfo] = useState<PlayPhaseInfo>({
    phase: 'normal',
    group: 0,
    round: 0,
    totalGroups: 0,
    totalRounds: 0,
  })

  const stopFlagRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const shuffleOrderRef = useRef<number[]>([])
  // 已学过的单词索引（用于间隔复习）
  const learnedWordsRef = useRef<Set<number>>(new Set())
  // SRS: 追踪新词搜索起点
  const srsCursorRef = useRef(0)

  const words = wordbook.words
  const currentWord: WordEntry | undefined = words[currentIndex]

  /** 延迟工具 */
  const delay = (ms: number) =>
    new Promise<void>((resolve) => {
      timerRef.current = setTimeout(resolve, ms)
    })

  /** 生成洗牌顺序 */
  const getShuffledIndices = useCallback(() => {
    const indices = Array.from({ length: words.length }, (_, i) => i)
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[indices[i], indices[j]] = [indices[j], indices[i]]
    }
    return indices
  }, [words.length])

  /** 获取下一个索引（顺序模式用） */
  const getNextIndex = useCallback(
    (idx: number): number => {
      if (settings.playMode === 'single') return idx
      if (settings.playMode === 'shuffle') {
        const order = shuffleOrderRef.current
        const pos = order.indexOf(idx)
        const nextPos = (pos + 1) % order.length
        return order[nextPos]
      }
      return (idx + 1) % words.length
    },
    [settings.playMode, words.length],
  )

  // ──────────────────────────────────────────────
  // 朗读序列构建器
  // ──────────────────────────────────────────────

  /**
   * 音节拆解朗读：逐音节读 + 发音规则提示
   * 替代原来的逐字母拼读（A-B-C），改为按音节朗读
   * 例：abandon → "3个音节" → a → ban → don → "双写 N" → abandon
   */
  const speakSyllables = useCallback(
    async (word: string) => {
      if (stopFlagRef.current) return

      const speechParts = buildSyllableSpeech(word)

      for (const part of speechParts) {
        if (stopFlagRef.current) return

        const rate =
          part.lang === 'en'
            ? Math.max(0.5, settings.rate * 0.85) // 英文音节稍慢，听清细节
            : settings.rate // 中文提示正常语速

        try {
          await speak(part.text, part.lang, { rate })
        } catch {
          return
        }

        if (stopFlagRef.current) return

        // 音节间 / 提示后停顿
        await delay(part.lang === 'en' ? 500 : 400)
      }
    },
    [settings.rate, speak],
  )

  /**
   * 逐字母拼读：A-B-C-D 逐个字母朗读
   * 例：abandon → A, B, A, N, D, O, N
   */
  const speakLetterSpelling = useCallback(
    async (word: string) => {
      if (stopFlagRef.current) return
      if (word.includes(' ')) return // 短语不拼字母

      const spelled = word.toUpperCase().split('').join(', ')
      try {
        await speak(spelled, 'en', { rate: Math.max(0.5, settings.rate * 0.8) })
      } catch {
        return
      }
    },
    [settings.rate, speak],
  )

  /** 完整学习序列：英文 → 音节拆解 → 中文 → 例句 */
  const playLearnSequence = useCallback(
    async (entry: WordEntry) => {
      if (stopFlagRef.current) return

      // 英文单词
      const repeatCount = Math.max(1, settings.repeat)
      for (let i = 0; i < repeatCount; i++) {
        if (stopFlagRef.current) return
        try {
          await speak(entry.word, 'en', { rate: settings.rate })
        } catch {
          return
        }
        if (i < repeatCount - 1) await delay(500)
      }

      if (stopFlagRef.current) return
      await delay(settings.pauseBetween * 800)

      // 音节拆解朗读
      if (settings.speakSpelling && !entry.word.includes(' ')) {
        await speakSyllables(entry.word)
        if (stopFlagRef.current) return
        await delay(settings.pauseBetween * 800)
      }

      // 逐字母拼读
      if (settings.speakLetters && !entry.word.includes(' ')) {
        await speakLetterSpelling(entry.word)
        if (stopFlagRef.current) return
        await delay(settings.pauseBetween * 800)
      }

      // 英文单词强化朗读（拼读后巩固发音）
      const reinforceRepeat = Math.max(1, settings.repeat)
      for (let i = 0; i < reinforceRepeat; i++) {
        if (stopFlagRef.current) return
        try {
          await speak(entry.word, 'en', { rate: settings.rate })
        } catch {
          return
        }
        if (i < reinforceRepeat - 1) await delay(500)
      }
      if (stopFlagRef.current) return
      await delay(settings.pauseBetween * 800)

      // 中文翻译
      if (settings.speakTranslation && entry.translation) {
        try {
          await speak(entry.translation, 'zh', { rate: settings.rate })
        } catch {
          return
        }
        if (stopFlagRef.current) return
        await delay(settings.pauseBetween * 1000)
      }

      // 例句
      if (settings.speakExample && entry.example) {
        try {
          await speak(entry.example, 'en', { rate: settings.rate })
          if (stopFlagRef.current) return
          await delay(800)
          if (entry.exampleCn && !stopFlagRef.current) {
            await speak(entry.exampleCn, 'zh', { rate: settings.rate })
          }
        } catch {
          return
        }
        if (stopFlagRef.current) return
        await delay(settings.pauseBetween * 1000)
      }
    },
    [settings, speak, speakSyllables, speakLetterSpelling],
  )

  /** 快速复习序列：英文 → 中文（不拼读，短停顿） */
  const playReviewSequence = useCallback(
    async (entry: WordEntry) => {
      if (stopFlagRef.current) return

      try {
        await speak(entry.word, 'en', { rate: settings.rate })
      } catch {
        return
      }
      if (stopFlagRef.current) return
      await delay(600)

      if (settings.speakTranslation && entry.translation) {
        try {
          await speak(entry.translation, 'zh', { rate: settings.rate })
        } catch {
          return
        }
        if (stopFlagRef.current) return
        await delay(settings.pauseBetween * 800)
      }
    },
    [settings, speak],
  )

  /** 测试序列：英文 → 长停顿（逼回忆）→ 中文 */
  const playTestSequence = useCallback(
    async (entry: WordEntry) => {
      if (stopFlagRef.current) return

      try {
        await speak(entry.word, 'en', { rate: settings.rate })
      } catch {
        return
      }
      if (stopFlagRef.current) return
      // 长停顿 —— 给大脑回忆的时间
      await delay(Math.max(2500, settings.pauseBetween * 1500))

      if (settings.speakTranslation && entry.translation) {
        try {
          await speak(entry.translation, 'zh', { rate: settings.rate })
        } catch {
          return
        }
        if (stopFlagRef.current) return
        await delay(settings.pauseBetween * 800)
      }
    },
    [settings, speak],
  )

  /** 回忆序列：中文 → 沉默 N 秒 → 英文 → 音节拆解 */
  const playRecallSequence = useCallback(
    async (entry: WordEntry) => {
      if (stopFlagRef.current) return

      // 1. 先读中文
      if (entry.translation) {
        try {
          await speak(entry.translation, 'zh', { rate: settings.rate })
        } catch {
          return
        }
      }
      if (stopFlagRef.current) return

      // 2. 沉默 —— 核心回忆间隔
      await delay(settings.recallPause * 1000)
      if (stopFlagRef.current) return

      // 3. 公布答案：读英文单词
      try {
        await speak(entry.word, 'en', { rate: settings.rate })
      } catch {
        return
      }
      if (stopFlagRef.current) return

      // 4. 音节拆解朗读
      if (settings.speakSpelling && !entry.word.includes(' ')) {
        await delay(500)
        if (stopFlagRef.current) return
        await speakSyllables(entry.word)
        if (stopFlagRef.current) return
      }
      // 5. 逐字母拼读
      if (settings.speakLetters && !entry.word.includes(' ')) {
        if (stopFlagRef.current) return
        await speakLetterSpelling(entry.word)
        if (stopFlagRef.current) return
      }
      await delay(settings.pauseBetween * 1000)
    },
    [settings, speak, speakSyllables, speakLetterSpelling],
  )

  // ──────────────────────────────────────────────
  // SRS 间隔重复模式的播放序列
  // ──────────────────────────────────────────────

  /** 获取单词的记忆口诀（优先用数据文件中的，其次用 WordEntry 自带的） */
  const getMnemonic = useCallback(
    (entry: WordEntry): string | undefined => {
      if (entry.mnemonic) return entry.mnemonic
      return mnemonics[entry.word.toLowerCase()]
    },
    [],
  )

  /**
   * SRS 新词学习序列（0→1）：单词 → 音节拆解 → 翻译 → 记忆口诀
   * 完整学习流程，帮助建立初始记忆
   */
  const playSrsLearnSequence = useCallback(
    async (entry: WordEntry) => {
      if (stopFlagRef.current) return

      // 英文单词（重复 wordRepeat 遍，每遍间 500ms）
      const wordRepeatCount = Math.max(1, settings.wordRepeat)
      for (let i = 0; i < wordRepeatCount; i++) {
        if (stopFlagRef.current) return
        try {
          await speak(entry.word, 'en', { rate: settings.rate })
        } catch {
          return
        }
        if (i < wordRepeatCount - 1) await delay(500)
      }
      if (stopFlagRef.current) return
      await delay(settings.pauseBetween * 800)

      // 音节拆解朗读
      if (settings.speakSpelling && !entry.word.includes(' ')) {
        await speakSyllables(entry.word)
        if (stopFlagRef.current) return
        await delay(settings.pauseBetween * 800)
      }

      // 逐字母拼读
      if (settings.speakLetters && !entry.word.includes(' ')) {
        await speakLetterSpelling(entry.word)
        if (stopFlagRef.current) return
        await delay(settings.pauseBetween * 800)
      }

      // 英文单词强化朗读（拼读后巩固发音）
      const reinforceRepeat = Math.max(1, settings.wordRepeat)
      for (let i = 0; i < reinforceRepeat; i++) {
        if (stopFlagRef.current) return
        try {
          await speak(entry.word, 'en', { rate: settings.rate })
        } catch {
          return
        }
        if (i < reinforceRepeat - 1) await delay(500)
      }
      if (stopFlagRef.current) return
      await delay(settings.pauseBetween * 800)

      // 中文翻译
      if (entry.translation) {
        try {
          await speak(entry.translation, 'zh', { rate: settings.rate })
        } catch {
          return
        }
        if (stopFlagRef.current) return
        await delay(settings.pauseBetween * 1000)
      }

      // 记忆口诀（中文朗读）
      const mnemonic = getMnemonic(entry)
      if (mnemonic) {
        try {
          await speak(mnemonic, 'zh', { rate: Math.max(0.7, settings.rate * 0.9) })
        } catch {
          return
        }
        if (stopFlagRef.current) return
        await delay(settings.pauseBetween * 1200)
      }

      // 例句朗读（受 speakExample 开关控制）
      if (settings.speakExample && entry.example) {
        const exRepeatCount = Math.max(1, settings.exampleRepeat)
        for (let i = 0; i < exRepeatCount; i++) {
          if (stopFlagRef.current) return
          try {
            await speak(entry.example, 'en', { rate: settings.rate })
            if (stopFlagRef.current) return
            await delay(800)
            if (entry.exampleCn && !stopFlagRef.current) {
              await speak(entry.exampleCn, 'zh', { rate: settings.rate })
            }
          } catch {
            return
          }
          if (stopFlagRef.current) return
          if (i < exRepeatCount - 1) await delay(500)
        }
        if (stopFlagRef.current) return
        await delay(settings.pauseBetween * 1000)
      }
    },
    [settings, speak, getMnemonic, speakSyllables, speakLetterSpelling],
  )

  /**
   * SRS 辨认复习序列（1→2）：单词 → 600ms短停顿 → 翻译
   * 快速辨认，确认是否认识
   */
  const playSrsRecognizeSequence = useCallback(
    async (entry: WordEntry) => {
      if (stopFlagRef.current) return

      // 英文单词（重复 wordRepeat 遍，每遍间 500ms）
      const wordRepeatCount = Math.max(1, settings.wordRepeat)
      for (let i = 0; i < wordRepeatCount; i++) {
        if (stopFlagRef.current) return
        try {
          await speak(entry.word, 'en', { rate: settings.rate })
        } catch {
          return
        }
        if (i < wordRepeatCount - 1) await delay(500)
      }
      if (stopFlagRef.current) return
      await delay(600)

      if (entry.translation) {
        try {
          await speak(entry.translation, 'zh', { rate: settings.rate })
        } catch {
          return
        }
        if (stopFlagRef.current) return
        await delay(settings.pauseBetween * 800)
      }
    },
    [settings, speak],
  )

  /**
   * SRS 线索回忆序列（2→3）：单词 → 3秒沉默 → 翻译
   * 先听英文，趁沉默回忆中文含义
   */
  const playSrsCueRecallSequence = useCallback(
    async (entry: WordEntry) => {
      if (stopFlagRef.current) return

      try {
        await speak(entry.word, 'en', { rate: settings.rate })
      } catch {
        return
      }
      if (stopFlagRef.current) return
      // 3秒沉默 —— 让大脑回忆含义
      await delay(3000)

      if (entry.translation) {
        try {
          await speak(entry.translation, 'zh', { rate: settings.rate })
        } catch {
          return
        }
        if (stopFlagRef.current) return
        await delay(settings.pauseBetween * 800)
      }
    },
    [settings, speak],
  )

  /**
   * SRS 自由回忆序列（3→4）：英文 → 4秒沉默 → 翻译 → 英文确认
   * 听力导向：先听英文，趁沉默回忆中文含义，再听翻译确认
   */
  const playSrsFreeRecallSequence = useCallback(
    async (entry: WordEntry) => {
      if (stopFlagRef.current) return

      // 1. 先读英文单词（重复 wordRepeat 遍）—— 听力训练：先听
      const wordRepeatCount = Math.max(1, settings.wordRepeat)
      for (let i = 0; i < wordRepeatCount; i++) {
        if (stopFlagRef.current) return
        try {
          await speak(entry.word, 'en', { rate: settings.rate })
        } catch {
          return
        }
        if (i < wordRepeatCount - 1) await delay(500)
      }
      if (stopFlagRef.current) return

      // 2. 4秒沉默 —— 让大脑回忆中文含义
      await delay(4000)
      if (stopFlagRef.current) return

      // 3. 读中文翻译（确认/纠偏）
      if (entry.translation) {
        try {
          await speak(entry.translation, 'zh', { rate: settings.rate })
        } catch {
          return
        }
      }
      if (stopFlagRef.current) return

      // 4. 再读一遍英文（确认发音）
      try {
        await speak(entry.word, 'en', { rate: settings.rate })
      } catch {
        return
      }
      if (stopFlagRef.current) return

      // 5. [可选] 例句
      if (settings.speakExample && entry.example) {
        await delay(500)
        if (stopFlagRef.current) return
        try {
          await speak(entry.example, 'en', { rate: settings.rate })
        } catch {
          return
        }
        if (stopFlagRef.current) return
        if (entry.exampleCn) {
          await delay(300)
          try {
            await speak(entry.exampleCn, 'zh', { rate: settings.rate })
          } catch {
            return
          }
        }
      }

      if (stopFlagRef.current) return
      await delay(settings.pauseBetween * 1000)
    },
    [settings, speak],
  )

  /**
   * SRS 掌握确认序列（4→5）：单词 → 翻译（快速）
   * 最后确认，快速过一遍
   */
  const playSrsMasterSequence = useCallback(
    async (entry: WordEntry) => {
      if (stopFlagRef.current) return

      try {
        await speak(entry.word, 'en', { rate: settings.rate })
      } catch {
        return
      }
      if (stopFlagRef.current) return
      await delay(400)

      if (entry.translation) {
        try {
          await speak(entry.translation, 'zh', { rate: settings.rate })
        } catch {
          return
        }
        if (stopFlagRef.current) return
        await delay(settings.pauseBetween * 600)
      }
    },
    [settings, speak],
  )

  /** 根据当前 familiarity 选择对应的 SRS 复习序列 */
  const playSrsReviewByFamiliarity = useCallback(
    async (entry: WordEntry, familiarity: Familiarity) => {
      switch (familiarity) {
        case 0:
          // familiarity=0 不应出现在复习中，但作为兜底走学习序列
          await playSrsLearnSequence(entry)
          break
        case 1:
          await playSrsRecognizeSequence(entry)
          break
        case 2:
          await playSrsCueRecallSequence(entry)
          break
        case 3:
          await playSrsFreeRecallSequence(entry)
          break
        case 4:
          await playSrsMasterSequence(entry)
          break
        default:
          await playSrsRecognizeSequence(entry)
      }
    },
    [playSrsLearnSequence, playSrsRecognizeSequence, playSrsCueRecallSequence, playSrsFreeRecallSequence, playSrsMasterSequence],
  )

  /** 设置 SRS 阶段信息（带 familiarity 和 sessionStats） */
  const setSrsPhaseInfo = useCallback(
    (phase: PlayPhase, wordIndex: number) => {
      const wordState: ReviewItem = progress.getWordState(wordIndex)
      const stats: SessionStats = progress.getStats()
      setPhaseInfo({
        phase,
        group: 0,
        round: 0,
        totalGroups: 0,
        totalRounds: 0,
        familiarity: wordState.familiarity,
        sessionStats: stats,
      })
    },
    [progress],
  )

  /**
   * SRS 间隔重复播放循环
   *
   * 算法：
   * 1. 取到期复习词列表 + 下一个新词
   * 2. 交错播放：如果到期复习词 >= newWordsPerRound 个或没有新词了，播放复习词；否则播放新词
   * 3. 播放新词(0→1)：用 playSrsLearnSequence
   * 4. 播放复习词：根据当前 familiarity 选择播放序列
   * 5. 播完后 advanceFamiliarity
   * 6. 全部掌握后重置为 familiarity 2
   */
  const srsPlayLoop = useCallback(
    async (startIndex: number) => {
      srsCursorRef.current = startIndex

      while (!stopFlagRef.current) {
        const dueReviews = progress.getDueReviews()
        const nextNewWord = progress.getNextNewWord(srsCursorRef.current)
        const newWordsPerRound = Math.max(1, settings.newWordsPerRound)

        // 检查是否全部掌握
        const stats = progress.getStats()
        if (stats.mastered === stats.total && dueReviews.length === 0) {
          // 全部掌握，重置为 familiarity 2 继续循环复习
          setPhaseInfo({
            phase: 'mastered',
            group: 0,
            round: 0,
            totalGroups: 0,
            totalRounds: 0,
            familiarity: 5,
            sessionStats: stats,
          })
          try {
            await speak('全部单词已掌握！进入复习循环。', 'zh', { rate: settings.rate })
          } catch {
            // ignore
          }
          if (stopFlagRef.current) return
          await delay(1500)
          progress.resetMasteredToReviewing()
          continue
        }

        // 决定播放新词还是复习词
        // 策略：如果到期复习词 >= newWordsPerRound 个，优先复习；否则交错
        let playTarget: { index: number; isNew: boolean } | null = null

        if (dueReviews.length >= newWordsPerRound || nextNewWord === -1) {
          // 优先播放到期复习词
          if (dueReviews.length > 0) {
            // 从到期词中随机选一个
            const randomIdx = Math.floor(Math.random() * dueReviews.length)
            playTarget = { index: dueReviews[randomIdx], isNew: false }
          } else if (nextNewWord !== -1) {
            playTarget = { index: nextNewWord, isNew: true }
          }
        } else {
          // 交错：先学1个新词
          playTarget = { index: nextNewWord, isNew: true }
        }

        if (!playTarget) {
          // 没有新词也没有到期复习词 —— 等待最近的复习词到期
          if (stopFlagRef.current) return
          setPhaseInfo({
            phase: 'normal',
            group: 0,
            round: 0,
            totalGroups: 0,
            totalRounds: 0,
            familiarity: 0,
            sessionStats: stats,
          })
          try {
            await speak('复习词尚未到期，稍后继续。', 'zh', { rate: settings.rate })
          } catch {
            // ignore
          }
          if (stopFlagRef.current) return
          await delay(3000)
          continue
        }

        const { index: wordIdx, isNew } = playTarget
        const entry = words[wordIdx]
        if (!entry) continue

        setCurrentIndex(wordIdx)

        if (isNew) {
          // 新词学习（0→1）
          setSrsPhaseInfo('learn', wordIdx)
          if (stopFlagRef.current) return
          await playSrsLearnSequence(entry)
          srsCursorRef.current = wordIdx + 1
        } else {
          // 复习词 —— 根据当前 familiarity 选择序列
          const wordState = progress.getWordState(wordIdx)
          setSrsPhaseInfo('review', wordIdx)
          if (stopFlagRef.current) return
          await playSrsReviewByFamiliarity(entry, wordState.familiarity)
        }

        if (stopFlagRef.current) return

        // 升级掌握度
        progress.advanceFamiliarity(wordIdx)

        // 更新 UI 显示新等级
        setSrsPhaseInfo(isNew ? 'learn' : 'review', wordIdx)

        if (stopFlagRef.current) return
        await delay(500)
      }
    },
    [words, settings.newWordsPerRound, settings.rate, progress, speak, setSrsPhaseInfo, playSrsLearnSequence, playSrsReviewByFamiliarity],
  )

  // ──────────────────────────────────────────────
  // 三种旧模式的播放循环
  // ──────────────────────────────────────────────

  /** 从已学单词中随机抽取复习词 */
  const pickReviewWords = useCallback(
    (currentGroupStart: number, currentGroupEnd: number, count: number): number[] => {
      const pool = Array.from(learnedWordsRef.current).filter(
        (idx) => idx < currentGroupStart || idx >= currentGroupEnd,
      )
      if (pool.length === 0) return []
      const shuffled = [...pool].sort(() => Math.random() - 0.5)
      return shuffled.slice(0, Math.min(count, pool.length))
    },
    [],
  )

  /** 记忆模式播放循环 */
  const memoryPlayLoop = useCallback(
    async (startIndex: number) => {
      const groupSize = Math.max(1, settings.groupSize)
      const rounds = Math.max(1, settings.groupRepeat)
      const totalGroups = Math.ceil(words.length / groupSize)

      // 计算起始组
      let groupIndex = Math.floor(startIndex / groupSize)
      let groupStart = groupIndex * groupSize

      while (!stopFlagRef.current) {
        const groupEnd = Math.min(groupStart + groupSize, words.length)
        const groupWords: { entry: WordEntry; index: number }[] = []
        for (let i = groupStart; i < groupEnd; i++) {
          groupWords.push({ entry: words[i], index: i })
          learnedWordsRef.current.add(i)
        }

        // 每轮用不同的顺序（第 0 轮保持原序，后续轮打乱）
        let playOrder = groupWords
        if (rounds > 1) {
          playOrder = [...groupWords]
        }

        for (let round = 0; round < rounds; round++) {
          if (stopFlagRef.current) return

          // 后续轮次打乱顺序
          if (round > 0) {
            playOrder = [...groupWords].sort(() => Math.random() - 0.5)
          }

          const phase: PlayPhase = round === 0 ? 'learn' : round === 1 ? 'review' : 'test'
          setPhaseInfo({
            phase,
            group: groupIndex + 1,
            round: round + 1,
            totalGroups,
            totalRounds: rounds,
          })

          // 每轮开始时的提示音
          if (round > 0) {
            try {
              await speak(round === 1 ? 'Review' : 'Test', 'en', { rate: 0.8 })
              await delay(500)
            } catch {
              // ignore
            }
          }

          for (const { entry, index } of playOrder) {
            if (stopFlagRef.current) return
            setCurrentIndex(index)

            if (round === 0) {
              await playLearnSequence(entry)
            } else if (round === 1) {
              await playReviewSequence(entry)
            } else {
              await playTestSequence(entry)
            }

            if (stopFlagRef.current) return
            await delay(300)
          }

          if (stopFlagRef.current) return
          await delay(800)
        }

        // 间隔复习：从之前学过的词中随机抽 2-3 个
        if (settings.reviewEnabled && learnedWordsRef.current.size > groupSize) {
          setPhaseInfo({
            phase: 'review',
            group: groupIndex + 1,
            round: rounds,
            totalGroups,
            totalRounds: rounds,
          })

          try {
            await speak('Review time', 'en', { rate: 0.8 })
            await delay(500)
          } catch {
            // ignore
          }

          const reviewIndices = pickReviewWords(groupStart, groupEnd, 3)
          for (const idx of reviewIndices) {
            if (stopFlagRef.current) return
            setCurrentIndex(idx)
            await playReviewSequence(words[idx])
            if (stopFlagRef.current) return
            await delay(300)
          }
        }

        // 下一组
        groupStart = groupEnd
        groupIndex++

        if (groupStart >= words.length) {
          // 全部学完，从头再来
          try {
            await speak('All groups completed. Starting over.', 'en', { rate: 0.8 })
          } catch {
            // ignore
          }
          await delay(1000)
          groupStart = 0
          groupIndex = 0
          learnedWordsRef.current.clear()
        }

        if (!stopFlagRef.current) await delay(500)
      }
    },
    [words, settings, speak, playLearnSequence, playReviewSequence, playTestSequence, pickReviewWords],
  )

  /** 盲听序列：英文(正常) → 沉默 → 英文(稍慢) → 中文 → [可选]例句 */
  const playBlindSequence = useCallback(
    async (entry: WordEntry) => {
      if (stopFlagRef.current) return

      // 1. 英文单词（正常语速，重复 wordRepeat 遍）
      const wordRepeatCount = Math.max(1, settings.wordRepeat)
      for (let i = 0; i < wordRepeatCount; i++) {
        if (stopFlagRef.current) return
        try {
          await speak(entry.word, 'en', { rate: settings.rate })
        } catch {
          return
        }
        if (i < wordRepeatCount - 1) await delay(400)
      }
      if (stopFlagRef.current) return

      // 2. 沉默 —— 用 recallPause 设置，让大脑理解含义
      await delay(Math.max(2000, settings.recallPause * 1000))
      if (stopFlagRef.current) return

      // 3. 英文单词（稍慢，确认发音）—— rate * 0.85
      try {
        await speak(entry.word, 'en', { rate: Math.max(0.5, settings.rate * 0.85) })
      } catch {
        return
      }
      if (stopFlagRef.current) return
      await delay(400)

      // 4. 读中文翻译
      if (entry.translation) {
        try {
          await speak(entry.translation, 'zh', { rate: settings.rate })
        } catch {
          return
        }
      }
      if (stopFlagRef.current) return

      // 5. [可选] 例句英文 → 例句中文
      if (settings.speakExample && entry.example) {
        await delay(500)
        if (stopFlagRef.current) return
        try {
          await speak(entry.example, 'en', { rate: settings.rate })
        } catch {
          return
        }
        if (stopFlagRef.current) return
        if (entry.exampleCn) {
          await delay(300)
          try {
            await speak(entry.exampleCn, 'zh', { rate: settings.rate })
          } catch {
            return
          }
        }
      }

      if (stopFlagRef.current) return
      await delay(settings.pauseBetween * 1000)
    },
    [settings, speak],
  )

  /** 盲听模式播放循环 */
  const blindPlayLoop = useCallback(
    async (startIndex: number) => {
      let idx = startIndex
      while (!stopFlagRef.current) {
        const entry = words[idx]
        if (!entry) break

        setCurrentIndex(idx)
        setPhaseInfo({
          phase: 'blind',
          group: 0,
          round: 0,
          totalGroups: 0,
          totalRounds: 0,
        })

        await playBlindSequence(entry)

        if (stopFlagRef.current) break
        await delay(500)

        idx = (idx + 1) % words.length
      }
    },
    [words, playBlindSequence],
  )

  /** 回忆模式播放循环 */
  const recallPlayLoop = useCallback(
    async (startIndex: number) => {
      let idx = startIndex
      while (!stopFlagRef.current) {
        const entry = words[idx]
        if (!entry) break

        setCurrentIndex(idx)
        setPhaseInfo({
          phase: 'recall',
          group: 0,
          round: 0,
          totalGroups: 0,
          totalRounds: 0,
        })

        await playRecallSequence(entry)

        if (stopFlagRef.current) break
        await delay(500)

        idx = (idx + 1) % words.length
      }
    },
    [words, playRecallSequence],
  )

  /** 顺序模式播放循环（旧版行为） */
  const sequentialPlayLoop = useCallback(
    async (startIndex: number) => {
      let idx = startIndex
      while (!stopFlagRef.current) {
        const entry = words[idx]
        if (!entry) break

        setCurrentIndex(idx)
        setPhaseInfo({
          phase: 'normal',
          group: 0,
          round: 0,
          totalGroups: 0,
          totalRounds: 0,
        })

        await playLearnSequence(entry)

        if (stopFlagRef.current) break

        if (settings.playMode === 'single') {
          await delay(500)
          continue
        }

        idx = getNextIndex(idx)
        await delay(300)
      }
    },
    [words, playLearnSequence, getNextIndex, settings.playMode],
  )

  // ──────────────────────────────────────────────
  // 播放控制
  // ──────────────────────────────────────────────

  /** 根据当前模式选择播放循环 */
  const startPlayLoop = useCallback(
    (startIndex: number) => {
      switch (settings.learnMode) {
        case 'srs':
          return srsPlayLoop(startIndex)
        case 'memory':
          return memoryPlayLoop(startIndex)
        case 'recall':
          return recallPlayLoop(startIndex)
        case 'blind':
          return blindPlayLoop(startIndex)
        case 'sequential':
        default:
          return sequentialPlayLoop(startIndex)
      }
    },
    [settings.learnMode, srsPlayLoop, memoryPlayLoop, recallPlayLoop, blindPlayLoop, sequentialPlayLoop],
  )

  /** 开始/继续播放 */
  const play = useCallback(() => {
    if (!supported || words.length === 0) return

    if (settings.playMode === 'shuffle' && shuffleOrderRef.current.length === 0) {
      shuffleOrderRef.current = getShuffledIndices()
    }

    stopFlagRef.current = false
    setIsPlaying(true)
    setHasStarted(true)
    startPlayLoop(currentIndex)
  }, [supported, words.length, settings.playMode, getShuffledIndices, startPlayLoop, currentIndex])

  /** 暂停播放 */
  const pause = useCallback(() => {
    stopFlagRef.current = true
    setIsPlaying(false)
    cancel()
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [cancel])

  /** 切换播放/暂停 */
  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause()
    } else {
      play()
    }
  }, [isPlaying, pause, play])

  /** 跳转到下一个单词 */
  const next = useCallback(() => {
    const wasPlaying = isPlaying
    pause()
    const newIdx = getNextIndex(currentIndex)
    setCurrentIndex(newIdx)
    setTimeout(() => {
      if (wasPlaying) {
        stopFlagRef.current = false
        setIsPlaying(true)
        startPlayLoop(newIdx)
      }
    }, 150)
  }, [isPlaying, pause, getNextIndex, currentIndex, startPlayLoop])

  /** 跳转到上一个单词 */
  const prev = useCallback(() => {
    const wasPlaying = isPlaying
    pause()
    let newIdx: number
    if (settings.playMode === 'shuffle') {
      const order = shuffleOrderRef.current
      const pos = order.indexOf(currentIndex)
      const prevPos = pos <= 0 ? order.length - 1 : pos - 1
      newIdx = order[prevPos]
    } else if (settings.playMode === 'single') {
      newIdx = currentIndex
    } else {
      newIdx = currentIndex <= 0 ? words.length - 1 : currentIndex - 1
    }
    setCurrentIndex(newIdx)
    setTimeout(() => {
      if (wasPlaying) {
        stopFlagRef.current = false
        setIsPlaying(true)
        startPlayLoop(newIdx)
      }
    }, 150)
  }, [isPlaying, pause, settings.playMode, currentIndex, words.length, startPlayLoop])

  /** 手动朗读当前单词一次 */
  const speakCurrent = useCallback(async () => {
    if (!currentWord || !supported) return
    const wasPlaying = isPlaying
    if (wasPlaying) pause()
    try {
      await speak(currentWord.word, 'en', { rate: settings.rate })
      await delay(settings.pauseBetween * 800)
      if (settings.speakSpelling && !currentWord.word.includes(' ')) {
        const parts = buildSyllableSpeech(currentWord.word)
        for (const part of parts) {
          await speak(part.text, part.lang, {
            rate: part.lang === 'en'
              ? Math.max(0.5, settings.rate * 0.85)
              : settings.rate,
          })
          await delay(part.lang === 'en' ? 500 : 400)
        }
        await delay(settings.pauseBetween * 800)
      }
      if (settings.speakLetters && !currentWord.word.includes(' ')) {
        const spelled = currentWord.word.toUpperCase().split('').join(', ')
        await speak(spelled, 'en', { rate: Math.max(0.5, settings.rate * 0.8) })
        await delay(settings.pauseBetween * 800)
      }
      // 英文单词强化朗读（拼读后巩固发音）
      await speak(currentWord.word, 'en', { rate: settings.rate })
      await delay(settings.pauseBetween * 800)
      if (settings.speakTranslation && currentWord.translation) {
        await speak(currentWord.translation, 'zh', { rate: settings.rate })
      }
    } catch {
      // 忽略
    }
  }, [currentWord, supported, isPlaying, pause, speak, settings])

  /** 跳转到指定索引 */
  const jumpTo = useCallback(
    (index: number) => {
      const wasPlaying = isPlaying
      pause()
      setCurrentIndex(index)
      if (wasPlaying) {
        setTimeout(() => {
          stopFlagRef.current = false
          setIsPlaying(true)
          startPlayLoop(index)
        }, 150)
      }
    },
    [isPlaying, pause, startPlayLoop],
  )

  /** 更新设置 */
  const updateSettings = useCallback((partial: Partial<PlayerSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }))
  }, [])

  /** 重置 SRS 进度（委托给 useProgress） */
  const resetProgress = useCallback(() => {
    progress.reset()
  }, [progress])

  // 切换词库时重置
  useEffect(() => {
    pause()
    setCurrentIndex(0)
    shuffleOrderRef.current = []
    learnedWordsRef.current.clear()
    srsCursorRef.current = 0
    setHasStarted(false)
    setPhaseInfo({
      phase: 'normal',
      group: 0,
      round: 0,
      totalGroups: 0,
      totalRounds: 0,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wordbook.id])

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      stopFlagRef.current = true
      cancel()
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [cancel])

  return {
    currentWord,
    currentIndex,
    isPlaying,
    hasStarted,
    settings,
    phaseInfo,
    total: words.length,
    supported,
    play,
    pause,
    togglePlay,
    next,
    prev,
    jumpTo,
    speakCurrent,
    updateSettings,
    resetProgress,
    getMnemonic,
    availableVoices,
    selectedEnVoice,
    selectedZhVoice,
    setEnVoice,
    setZhVoice,
  }
}
