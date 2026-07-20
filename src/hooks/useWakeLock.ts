/**
 * 屏幕常亮 Hook —— 防止 iOS/Android 屏幕自动休眠导致播放中断
 *
 * 原理：
 * 1. Wake Lock API：请求屏幕保持常亮，阻止系统自动休眠
 * 2. 静音音频循环：播放一段无声音频，保持音频会话活跃
 * 3. Media Session API：设置锁屏播放控制，帮助系统识别为"正在播放媒体"
 *
 * iOS Safari 限制：
 * - 屏幕自动休眠后，JavaScript 定时器和 speechSynthesis 都会被挂起
 * - Wake Lock API（iOS 16.4+）可以阻止自动休眠
 * - 静音音频循环作为备用方案，保持音频会话不中断
 * - 如果用户手动锁屏，仍会暂停（系统级限制，Web 无法完全绕过）
 */

import { useCallback, useEffect, useRef } from 'react'

// 1秒静音 WAV（base64），用于保持音频会话活跃
const SILENT_AUDIO_DATA_URI =
  'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA='

export function useWakeLock(active: boolean) {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // 请求 Wake Lock
  const acquireWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator) {
        // 释放旧的
        if (wakeLockRef.current) {
          await wakeLockRef.current.release()
          wakeLockRef.current = null
        }
        wakeLockRef.current = await navigator.wakeLock.request('screen')
      }
    } catch {
      // Wake Lock 请求失败 —— 可能是不支持的浏览器或用户拒绝
    }
  }, [])

  // 释放 Wake Lock
  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release()
      wakeLockRef.current = null
    }
  }, [])

  // 启动/停止静音音频
  const startSilentAudio = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio(SILENT_AUDIO_DATA_URI)
      audioRef.current.loop = true
      audioRef.current.volume = 0.01 // 极低音量（iOS 不允许 0）
    }
    audioRef.current.play().catch(() => {
      // 自动播放被阻止 —— 需要用户交互后才能播放
    })
  }, [])

  const stopSilentAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
    }
  }, [])

  // 设置 Media Session（锁屏播放控制）
  const setupMediaSession = useCallback(() => {
    if (!('mediaSession' in navigator)) return

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'DriveWord 英语学习',
        artist: '正在播放…',
        album: '开车背单词',
      })

      navigator.mediaSession.setActionHandler('play', () => {
        // 由 App 组件处理
      })
      navigator.mediaSession.setActionHandler('pause', () => {
        // 由 App 组件处理
      })
    } catch {
      // MediaSession 不支持某些操作
    }
  }, [])

  // 主效果：根据 active 状态启停
  useEffect(() => {
    if (active) {
      acquireWakeLock()
      startSilentAudio()
      setupMediaSession()
    } else {
      releaseWakeLock()
      stopSilentAudio()
    }

    return () => {
      releaseWakeLock()
      stopSilentAudio()
    }
  }, [active, acquireWakeLock, releaseWakeLock, startSilentAudio, stopSilentAudio, setupMediaSession])

  // 页面恢复可见时重新获取 Wake Lock（iOS 切后台会释放）
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && active) {
        acquireWakeLock()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [active, acquireWakeLock])
}
