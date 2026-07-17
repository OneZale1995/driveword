import { useCallback, useEffect, useRef, useState } from 'react'
import type { Familiarity, ReviewItem, SessionStats } from '@/types/word'

/**
 * SRS 间隔重复间隔表（毫秒）
 *
 * familiarity 跃迁 → 下次复习间隔：
 * - 0→1: +30秒（新词学习后很快复习）
 * - 1→2: +2分钟（辨认复习）
 * - 2→3: +5分钟（线索回忆）
 * - 3→4: +10分钟（自由回忆）
 * - 4→5: 本课锁定（已掌握）
 */
const SRS_INTERVALS: Record<Familiarity, number> = {
  0: 0,
  1: 30 * 1000,
  2: 2 * 60 * 1000,
  3: 5 * 60 * 1000,
  4: 10 * 60 * 1000,
  5: Number.MAX_SAFE_INTEGER,
}

/** 默认复习项 */
function createDefaultReviewItem(wordIndex: number): ReviewItem {
  return {
    wordIndex,
    familiarity: 0,
    nextReviewAt: 0,
    lastReviewAt: 0,
    reviewCount: 0,
  }
}

/**
 * 进度持久化 Hook —— 基于 localStorage 存储每个单词的 SRS 复习状态
 *
 * 存储格式:
 *   key: driveword-progress-${wordbookId}
 *   value: Record<number, ReviewItem>  (key = wordIndex)
 *
 * 跨会话恢复：组件重新挂载或刷新页面后，进度自动从 localStorage 读取。
 */
export function useProgress(wordbookId: string, totalWords: number) {
  const storageKey = `driveword-progress-${wordbookId}`
  const progressRef = useRef<Record<number, ReviewItem>>({})
  const [version, setVersion] = useState(0)

  // 初始化：从 localStorage 读取
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const parsed = JSON.parse(raw) as Record<number, ReviewItem>
        progressRef.current = parsed
      } else {
        progressRef.current = {}
      }
    } catch {
      progressRef.current = {}
    }
    setVersion((v) => v + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wordbookId])

  /** 持久化到 localStorage */
  const persist = useCallback(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(progressRef.current))
    } catch {
      // localStorage 不可用时静默失败
    }
  }, [storageKey])

  /** 获取某个单词的复习状态（不存在则返回默认值） */
  const getWordState = useCallback(
    (wordIndex: number): ReviewItem => {
      const existing = progressRef.current[wordIndex]
      if (existing) return existing
      return createDefaultReviewItem(wordIndex)
    },
    [],
  )

  /** 更新某个单词的复习状态 */
  const updateWordState = useCallback(
    (wordIndex: number, updates: Partial<ReviewItem>): ReviewItem => {
      const current = progressRef.current[wordIndex] ?? createDefaultReviewItem(wordIndex)
      const updated: ReviewItem = { ...current, ...updates, wordIndex }
      progressRef.current[wordIndex] = updated
      persist()
      setVersion((v) => v + 1)
      return updated
    },
    [persist],
  )

  /**
   * 将某个单词升级到下一掌握度等级，并设置下次复习时间
   * 返回更新后的 ReviewItem
   */
  const advanceFamiliarity = useCallback(
    (wordIndex: number): ReviewItem => {
      const current = progressRef.current[wordIndex] ?? createDefaultReviewItem(wordIndex)
      const currentLevel = current.familiarity
      const nextLevel = Math.min(5, currentLevel + 1) as Familiarity
      const now = Date.now()
      const interval = SRS_INTERVALS[nextLevel]
      const updated: ReviewItem = {
        ...current,
        wordIndex,
        familiarity: nextLevel,
        nextReviewAt: now + interval,
        lastReviewAt: now,
        reviewCount: current.reviewCount + 1,
      }
      progressRef.current[wordIndex] = updated
      persist()
      setVersion((v) => v + 1)
      return updated
    },
    [persist],
  )

  /**
   * 获取所有到期需要复习的单词索引
   * 条件: familiarity > 0 且 familiarity < 5 且 Date.now() >= nextReviewAt
   */
  const getDueReviews = useCallback((): number[] => {
    const now = Date.now()
    const due: number[] = []
    for (let i = 0; i < totalWords; i++) {
      const state = progressRef.current[i]
      if (state && state.familiarity > 0 && state.familiarity < 5 && now >= state.nextReviewAt) {
        due.push(i)
      }
    }
    return due
  }, [totalWords])

  /**
   * 从 fromIndex 开始找第一个 familiarity=0 的新词
   * 如果找不到（全部学过），返回 -1
   */
  const getNextNewWord = useCallback(
    (fromIndex: number): number => {
      for (let i = 0; i < totalWords; i++) {
        const idx = (fromIndex + i) % totalWords
        const state = progressRef.current[idx]
        if (!state || state.familiarity === 0) {
          return idx
        }
      }
      return -1
    },
    [totalWords],
  )

  /** 获取所有单词的掌握度（用于 UI 显示，如列表标记） */
  const getAllFamiliarity = useCallback((): Map<number, Familiarity> => {
    const map = new Map<number, Familiarity>()
    for (let i = 0; i < totalWords; i++) {
      const state = progressRef.current[i]
      map.set(i, state ? state.familiarity : 0)
    }
    return map
  }, [totalWords])

  /** 统计会话进度 */
  const getStats = useCallback((): SessionStats => {
    let learned = 0
    let reviewing = 0
    let mastered = 0
    for (let i = 0; i < totalWords; i++) {
      const state = progressRef.current[i]
      const fam = state ? state.familiarity : 0
      if (fam >= 1) learned++
      if (fam >= 1 && fam <= 4) reviewing++
      if (fam === 5) mastered++
    }
    return { learned, reviewing, mastered, total: totalWords }
  }, [totalWords])

  /**
   * 重置所有进度（清空 localStorage 和内存）
   * 用于 SRS 模式的"重置进度"按钮
   */
  const reset = useCallback(() => {
    progressRef.current = {}
    try {
      localStorage.removeItem(storageKey)
    } catch {
      // ignore
    }
    setVersion((v) => v + 1)
  }, [storageKey])

  /**
   * 当所有单词都掌握后，将所有 familiarity=5 的词降级为 2
   * 这样可以继续循环复习保持记忆
   */
  const resetMasteredToReviewing = useCallback(() => {
    const now = Date.now()
    let changed = false
    for (let i = 0; i < totalWords; i++) {
      const state = progressRef.current[i]
      if (state && state.familiarity === 5) {
        progressRef.current[i] = {
          ...state,
          familiarity: 2,
          nextReviewAt: now,
          lastReviewAt: now,
          reviewCount: state.reviewCount + 1,
        }
        changed = true
      }
    }
    if (changed) {
      persist()
      setVersion((v) => v + 1)
    }
  }, [totalWords, persist])

  // version 用于触发依赖此 hook 的组件重渲染
  // eslint-disable-next-line @typescript-eslint/no-unused-expressions
  version

  return {
    getWordState,
    updateWordState,
    advanceFamiliarity,
    getDueReviews,
    getNextNewWord,
    getAllFamiliarity,
    getStats,
    reset,
    resetMasteredToReviewing,
  }
}
