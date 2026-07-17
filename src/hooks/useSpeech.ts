import { useCallback, useEffect, useRef, useState } from 'react'

interface SpeakOptions {
  /** 语速 0.5 - 2.0 */
  rate?: number
  /** 音调 0 - 2 */
  pitch?: number
  /** 音量 0 - 1 */
  volume?: number
}

type VoiceMap = {
  en: SpeechSynthesisVoice | null
  zh: SpeechSynthesisVoice | null
}

/**
 * Web Speech API 语音合成封装
 * - 自动加载系统语音，分别挑选中英文最佳语音
 * - speak() 返回 Promise，结束后 resolve
 * - 支持取消
 */
export function useSpeech() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [supported] = useState(() => typeof window !== 'undefined' && 'speechSynthesis' in window)
  const voiceMapRef = useRef<VoiceMap>({ en: null, zh: null })

  // 加载语音列表
  useEffect(() => {
    if (!supported) return

    const loadVoices = () => {
      const list = window.speechSynthesis.getVoices()
      if (list.length === 0) return

      setVoices(list)

      // 挑选最佳英文语音：优先 en-US，其次任意 en
      const enVoice =
        list.find((v) => v.lang === 'en-US' && /Google|Samantha|Daniel|Alex/i.test(v.name)) ||
        list.find((v) => v.lang === 'en-US') ||
        list.find((v) => v.lang.startsWith('en')) ||
        null

      // 挑选最佳中文语音：优先 zh-CN
      const zhVoice =
        list.find((v) => v.lang === 'zh-CN' && /Google|Tingting|Kangkang/i.test(v.name)) ||
        list.find((v) => v.lang === 'zh-CN') ||
        list.find((v) => v.lang.startsWith('zh')) ||
        null

      voiceMapRef.current = { en: enVoice, zh: zhVoice }
    }

    loadVoices()
    // 部分浏览器异步加载语音
    window.speechSynthesis.onvoiceschanged = loadVoices

    return () => {
      window.speechSynthesis.onvoiceschanged = null
    }
  }, [supported])

  /** 朗读文本，返回 Promise，朗读结束 resolve */
  const speak = useCallback(
    (text: string, lang: 'en' | 'zh', options: SpeakOptions = {}): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (!supported) {
          reject(new Error('Speech synthesis not supported'))
          return
        }

        // 取消正在进行的朗读
        window.speechSynthesis.cancel()

        const utterance = new SpeechSynthesisUtterance(text)
        const voice = lang === 'en' ? voiceMapRef.current.en : voiceMapRef.current.zh
        if (voice) {
          utterance.voice = voice
          utterance.lang = voice.lang
        } else {
          utterance.lang = lang === 'en' ? 'en-US' : 'zh-CN'
        }
        utterance.rate = options.rate ?? 1
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

  return { speak, cancel, pause, resume, supported, voices }
}
