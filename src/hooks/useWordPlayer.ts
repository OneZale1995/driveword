import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  PlayerSettings,
  PlayPhase,
  PlayPhaseInfo,
  WordBook,
  WordEntry,
} from '@/types/word'
import { useSpeech } from './useSpeech'

const DEFAULT_SETTINGS: PlayerSettings = {
  rate: 0.9,
  pauseBetween: 1.5,
  speakTranslation: true,
  speakExample: false,
  speakSpelling: true,
  learnMode: 'memory',
  playMode: 'order',
  repeat: 1,
  groupSize: 5,
  groupRepeat: 3,
  recallPause: 4,
  reviewEnabled: true,
}

/**
 * 单词播放器 —— 记忆驱动版
 *
 * 三种学习模式：
 *
 * 1. 记忆模式（memory）：
 *    将词库分成 N 个一组，每组重复 R 轮：
 *    - 第 0 轮（学习）：拼读 → 英文 → 中文（完整流程）
 *    - 第 1 轮（复习）：英文 → 中文（快速过一遍）
 *    - 第 2+ 轮（测试）：英文 → 长停顿 → 中文（逼你回忆）
 *    每组结束后，随机抽 2-3 个之前学过的词进行间隔复习
 *
 * 2. 回忆模式（recall）：
 *    先读中文 → 沉默 N 秒（你回忆英文）→ 公布英文 + 拼读
 *    纯听觉主动回忆，不开屏幕也能练
 *
 * 3. 顺序模式（sequential）：
 *    逐个播放，支持顺序/随机/单曲（旧版行为）
 */
export function useWordPlayer(wordbook: WordBook) {
  const { speak, cancel, supported } = useSpeech()
  const [settings, setSettings] = useState<PlayerSettings>(DEFAULT_SETTINGS)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)

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

  /** 完整学习序列：拼读 → 英文 → 中文 → 例句 */
  const playLearnSequence = useCallback(
    async (entry: WordEntry) => {
      if (stopFlagRef.current) return

      // 拼读字母
      if (settings.speakSpelling && !entry.word.includes(' ')) {
        const spelled = entry.word.toUpperCase().split('').join(', ')
        try {
          await speak(spelled, 'en', { rate: Math.max(0.5, settings.rate * 0.8) })
        } catch {
          return
        }
        if (stopFlagRef.current) return
        await delay(settings.pauseBetween * 800)
      }

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
      await delay(settings.pauseBetween * 1000)

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
    [settings, speak],
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

  /** 回忆序列：中文 → 沉默 N 秒 → 拼读 + 英文 */
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

      // 3. 公布答案：拼读
      if (settings.speakSpelling && !entry.word.includes(' ')) {
        const spelled = entry.word.toUpperCase().split('').join(', ')
        try {
          await speak(spelled, 'en', { rate: Math.max(0.5, settings.rate * 0.8) })
        } catch {
          return
        }
        if (stopFlagRef.current) return
        await delay(500)
      }

      // 4. 读英文单词
      try {
        await speak(entry.word, 'en', { rate: settings.rate })
      } catch {
        return
      }
      if (stopFlagRef.current) return
      await delay(settings.pauseBetween * 1000)
    },
    [settings, speak],
  )

  // ──────────────────────────────────────────────
  // 三种模式的播放循环
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
        case 'memory':
          return memoryPlayLoop(startIndex)
        case 'recall':
          return recallPlayLoop(startIndex)
        case 'sequential':
        default:
          return sequentialPlayLoop(startIndex)
      }
    },
    [settings.learnMode, memoryPlayLoop, recallPlayLoop, sequentialPlayLoop],
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
      if (settings.speakSpelling && !currentWord.word.includes(' ')) {
        const spelled = currentWord.word.toUpperCase().split('').join(', ')
        await speak(spelled, 'en', { rate: Math.max(0.5, settings.rate * 0.8) })
        await delay(settings.pauseBetween * 800)
      }
      await speak(currentWord.word, 'en', { rate: settings.rate })
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

  // 切换词库时重置
  useEffect(() => {
    pause()
    setCurrentIndex(0)
    shuffleOrderRef.current = []
    learnedWordsRef.current.clear()
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
  }
}
