import { useCallback, useEffect, useRef, useState } from 'react'

interface SpeakOptions {
  /** 语速 0.5 - 2.0 */
  rate?: number
  /** 音调 0 - 2 */
  pitch?: number
  /** 音量 0 - 1 */
  volume?: number
}

/** 按语言分组的可用声音列表 */
interface GroupedVoices {
  en: SpeechSynthesisVoice[]
  zh: SpeechSynthesisVoice[]
}

const STORAGE_KEY_EN = 'driveword-voice-en'
const STORAGE_KEY_ZH = 'driveword-voice-zh'

/** 判断声音名称是否标识为高质量自然语音 */
function isNaturalVoice(name: string): boolean {
  return /Natural|Neural|Premium/i.test(name)
}

/**
 * 按优先级挑选最佳英文声音：
 * a) 名字含 Natural/Neural/Premium 的 en-US 声音
 * b) Google US English
 * c) Microsoft 标记的 en-US 声音
 * d) 任意 en-US 声音
 * e) 任意 en 开头声音
 */
function pickBestEnVoice(list: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  let v: SpeechSynthesisVoice | undefined
  v = list.find((v) => v.lang === 'en-US' && isNaturalVoice(v.name))
  if (v) return v
  v = list.find((v) => v.lang === 'en-US' && /Google/i.test(v.name))
  if (v) return v
  v = list.find((v) => v.lang === 'en-US' && /Microsoft/i.test(v.name))
  if (v) return v
  v = list.find((v) => v.lang === 'en-US')
  if (v) return v
  v = list.find((v) => v.lang.startsWith('en'))
  if (v) return v
  return null
}

/**
 * 按优先级挑选最佳中文声音：
 * a) 名字含 Natural/Neural/Premium 的 zh-CN 声音
 * b) Google 普通话
 * c) Microsoft 标记的 zh-CN 声音
 * d) 任意 zh-CN 声音
 * e) 任意 zh 开头声音
 */
function pickBestZhVoice(list: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  let v: SpeechSynthesisVoice | undefined
  v = list.find((v) => v.lang === 'zh-CN' && isNaturalVoice(v.name))
  if (v) return v
  v = list.find((v) => v.lang === 'zh-CN' && /Google/i.test(v.name))
  if (v) return v
  v = list.find((v) => v.lang === 'zh-CN' && /Microsoft/i.test(v.name))
  if (v) return v
  v = list.find((v) => v.lang === 'zh-CN')
  if (v) return v
  v = list.find((v) => v.lang.startsWith('zh'))
  if (v) return v
  return null
}

/** 从 localStorage 读取已保存的声音 URI */
function loadSavedVoiceURI(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** 保存声音 URI 到 localStorage */
function saveVoiceURI(key: string, uri: string): void {
  try {
    localStorage.setItem(key, uri)
  } catch {
    // ignore storage errors (e.g. private browsing)
  }
}

/** 按 voiceURI 从列表中查找声音 */
function findVoiceByURI(list: SpeechSynthesisVoice[], uri: string): SpeechSynthesisVoice | undefined {
  return list.find((v) => v.voiceURI === uri)
}

/**
 * Web Speech API 语音合成封装
 *
 * 改进点：
 * - 按优先级算法挑选中英文最佳声音（支持 Natural/Neural/Premium、Google、Microsoft）
 * - speak() 不再自动 cancel()，避免连续朗读时断音
 * - 暴露可用声音列表和用户选择接口，支持 localStorage 持久化
 * - 英文默认语速 0.85，中文默认 1.0
 */
export function useSpeech() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [supported] = useState(() => typeof window !== 'undefined' && 'speechSynthesis' in window)

  // 使用 ref 存储当前选中的声音，避免 speak callback 频繁重建
  const enVoiceRef = useRef<SpeechSynthesisVoice | null>(null)
  const zhVoiceRef = useRef<SpeechSynthesisVoice | null>(null)

  // 暴露给 UI 的选中声音状态
  const [selectedEnVoice, setSelectedEnVoice] = useState<SpeechSynthesisVoice | null>(null)
  const [selectedZhVoice, setSelectedZhVoice] = useState<SpeechSynthesisVoice | null>(null)

  // 加载语音列表
  useEffect(() => {
    if (!supported) return

    const loadVoices = () => {
      const list = window.speechSynthesis.getVoices()
      if (list.length === 0) return

      setVoices(list)

      // 自动挑选最佳声音（作为 fallback）
      const bestEn = pickBestEnVoice(list)
      const bestZh = pickBestZhVoice(list)

      // 从 localStorage 恢复用户选择
      const savedEnURI = loadSavedVoiceURI(STORAGE_KEY_EN)
      const savedZhURI = loadSavedVoiceURI(STORAGE_KEY_ZH)

      // 英文声音
      if (savedEnURI) {
        const saved = findVoiceByURI(list, savedEnURI)
        if (saved) {
          enVoiceRef.current = saved
          setSelectedEnVoice(saved)
        } else if (bestEn) {
          enVoiceRef.current = bestEn
          setSelectedEnVoice(bestEn)
        }
      } else if (bestEn) {
        enVoiceRef.current = bestEn
        setSelectedEnVoice(bestEn)
      }

      // 中文声音
      if (savedZhURI) {
        const saved = findVoiceByURI(list, savedZhURI)
        if (saved) {
          zhVoiceRef.current = saved
          setSelectedZhVoice(saved)
        } else if (bestZh) {
          zhVoiceRef.current = bestZh
          setSelectedZhVoice(bestZh)
        }
      } else if (bestZh) {
        zhVoiceRef.current = bestZh
        setSelectedZhVoice(bestZh)
      }
    }

    loadVoices()
    // 部分浏览器异步加载语音
    window.speechSynthesis.onvoiceschanged = loadVoices

    return () => {
      window.speechSynthesis.onvoiceschanged = null
    }
  }, [supported])

  /**
   * 朗读文本，返回 Promise，朗读结束 resolve
   *
   * 不再自动 cancel() —— 调用方负责在需要时调用 cancel()。
   * 这样连续朗读（如音节拆解、重复单词）不会被中断。
   */
  const speak = useCallback(
    (text: string, lang: 'en' | 'zh', options: SpeakOptions = {}): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (!supported) {
          reject(new Error('Speech synthesis not supported'))
          return
        }

        const utterance = new SpeechSynthesisUtterance(text)

        // 使用 ref 中的当前声音（可能是自动挑选的或用户选择的）
        const voice = lang === 'en' ? enVoiceRef.current : zhVoiceRef.current
        if (voice) {
          utterance.voice = voice
          utterance.lang = voice.lang
        } else {
          utterance.lang = lang === 'en' ? 'en-US' : 'zh-CN'
        }

        // 默认语速：英文 0.85（学单词时慢一点更清楚），中文 1.0
        const defaultRate = lang === 'en' ? 0.85 : 1.0
        utterance.rate = options.rate ?? defaultRate
        utterance.pitch = options.pitch ?? 1
        utterance.volume = options.volume ?? 1

        utterance.onend = () => resolve()
        utterance.onerror = (e) => {
          // 'interrupted' 和 'canceled' 是正常取消，不算错误
          if (e.error === 'interrupted' || e.error === 'canceled') {
            resolve()
          } else {
            reject(new Error(`Speech error: ${e.error}`))
          }
        }

        window.speechSynthesis.speak(utterance)
      })
    },
    [supported],
  )

  /** 设置英文声音（持久化到 localStorage） */
  const setEnVoice = useCallback(
    (voiceURI: string) => {
      const voice = voices.find((v) => v.voiceURI === voiceURI)
      if (voice) {
        enVoiceRef.current = voice
        setSelectedEnVoice(voice)
        saveVoiceURI(STORAGE_KEY_EN, voiceURI)
      }
    },
    [voices],
  )

  /** 设置中文声音（持久化到 localStorage） */
  const setZhVoice = useCallback(
    (voiceURI: string) => {
      const voice = voices.find((v) => v.voiceURI === voiceURI)
      if (voice) {
        zhVoiceRef.current = voice
        setSelectedZhVoice(voice)
        saveVoiceURI(STORAGE_KEY_ZH, voiceURI)
      }
    },
    [voices],
  )

  /** 立即取消所有朗读 */
  const cancel = useCallback(() => {
    if (supported) {
      window.speechSynthesis.cancel()
    }
  }, [supported])

  /** 暂停 */
  const pause = useCallback(() => {
    if (supported) {
      window.speechSynthesis.pause()
    }
  }, [supported])

  /** 恢复 */
  const resume = useCallback(() => {
    if (supported) {
      window.speechSynthesis.resume()
    }
  }, [supported])

  // 按语言分组的可用声音列表
  const availableVoices: GroupedVoices = {
    en: voices.filter((v) => v.lang.startsWith('en')),
    zh: voices.filter((v) => v.lang.startsWith('zh')),
  }

  return {
    speak,
    cancel,
    pause,
    resume,
    supported,
    voices,
    availableVoices,
    selectedEnVoice,
    selectedZhVoice,
    setEnVoice,
    setZhVoice,
  }
}
