import { useCallback, useEffect, useMemo, useState } from 'react'
import { Car, ListMusic, Moon, Sun, Brain, Ear, Headphones, Play, Zap } from 'lucide-react'
import './App.css'
import { WordCard } from '@/components/WordCard'
import { PlayerControls } from '@/components/PlayerControls'
import { SettingsPanel } from '@/components/SettingsPanel'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { wordbooks, getWordbookById } from '@/data/wordbooks'
import { useWordPlayer } from '@/hooks/useWordPlayer'
import { useWakeLock } from '@/hooks/useWakeLock'
import type { LearnMode } from '@/types/word'

const MODE_LABELS: Record<LearnMode, { label: string; icon: typeof Brain }> = {
  srs: { label: '间隔重复', icon: Zap },
  memory: { label: '记忆模式', icon: Brain },
  recall: { label: '回忆模式', icon: Ear },
  blind: { label: '盲听模式', icon: Headphones },
  sequential: { label: '顺序模式', icon: Play },
}

export default function App() {
  // 恢复上次选中的词库（持久化到 localStorage）
  const [bookId, setBookId] = useState<string>(() => {
    try {
      const raw = localStorage.getItem('driveword-lastbook')
      if (raw && getWordbookById(raw)) return raw
    } catch {
      // ignore
    }
    return wordbooks[0].id
  })
  const wordbook = useMemo(() => getWordbookById(bookId)!, [bookId])

  const {
    currentWord,
    currentIndex,
    isPlaying,
    hasStarted,
    settings,
    phaseInfo,
    total,
    supported,
    togglePlay,
    next,
    prev,
    nextGroup,
    jumpTo,
    speakCurrent,
    updateSettings,
    resetProgress,
    getMnemonic,
  } = useWordPlayer(wordbook)

  // 屏幕常亮：播放时保持屏幕不休眠 + 静音音频保持音频会话活跃（修复 iOS 屏幕变暗后停止播放）
  useWakeLock(isPlaying)

  // 持久化选中的词库
  useEffect(() => {
    try {
      localStorage.setItem('driveword-lastbook', bookId)
    } catch {
      // ignore
    }
  }, [bookId])

  // 深色模式：默认开启（开车护眼），记忆用户选择
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem('driveword-darkmode')
      if (raw !== null) return raw === '1'
    } catch {
      // ignore
    }
    return true
  })
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    try {
      localStorage.setItem('driveword-darkmode', darkMode ? '1' : '0')
    } catch {
      // ignore
    }
  }, [darkMode])

  // 键盘快捷键
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return

      switch (e.code) {
        case 'Space':
          e.preventDefault()
          togglePlay()
          break
        case 'ArrowRight':
          e.preventDefault()
          next()
          break
        case 'ArrowLeft':
          e.preventDefault()
          prev()
          break
        default:
          break
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [togglePlay, next, prev])

  const handleSelectBook = useCallback((id: string) => {
    setBookId(id)
  }, [])

  const progress = total > 0 ? ((currentIndex + 1) / total) * 100 : 0
  const modeInfo = MODE_LABELS[settings.learnMode]
  const ModeIcon = modeInfo.icon

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <Car className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-base font-bold leading-tight sm:text-lg">DriveWord</h1>
              <p className="hidden text-xs text-muted-foreground sm:block">开车背单词</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="hidden gap-1 max-w-[180px] truncate sm:inline-flex">
              <ModeIcon className="h-3 w-3" />
              {wordbook.name}
            </Badge>

            {/* 单词列表 */}
            <Drawer>
              <DrawerTrigger asChild>
                <Button variant="outline" size="icon" className="h-11 w-11" aria-label="单词列表">
                  <ListMusic className="h-5 w-5" />
                </Button>
              </DrawerTrigger>
              <DrawerContent className="max-h-[75vh]">
                <DrawerHeader className="pb-2">
                  <DrawerTitle className="text-lg">{wordbook.name}</DrawerTitle>
                  <DrawerDescription>
                    共 {total} 个单词 · 点击跳转到任意单词
                  </DrawerDescription>
                </DrawerHeader>
                <div className="scrollbar-hide max-h-[55vh] overflow-y-auto px-4 pb-6">
                  <div className="grid gap-1">
                    {wordbook.words.map((w, i) => (
                      <button
                        key={i}
                        onClick={() => jumpTo(i)}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                          i === currentIndex
                            ? 'bg-emerald-500/10 ring-1 ring-emerald-500/40'
                            : 'hover:bg-muted',
                        )}
                      >
                        <span
                          className={cn(
                            'w-8 shrink-0 text-center text-xs tabular-nums',
                            i === currentIndex
                              ? 'font-bold text-emerald-600 dark:text-emerald-400'
                              : 'text-muted-foreground',
                          )}
                        >
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <span className="font-medium">{w.word}</span>
                          {w.phonetic && (
                            <span className="ml-2 text-xs text-muted-foreground">{w.phonetic}</span>
                          )}
                        </div>
                        <span className="shrink-0 truncate text-sm text-muted-foreground">
                          {w.translation}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </DrawerContent>
            </Drawer>

            {/* 深色模式切换 */}
            <Button
              variant="outline"
              size="icon"
              className="h-11 w-11"
              onClick={() => setDarkMode(!darkMode)}
              aria-label="切换深色模式"
            >
              {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>

            {/* 设置 */}
            <SettingsPanel
              wordbooks={wordbooks}
              currentBookId={bookId}
              onSelectBook={handleSelectBook}
              settings={settings}
              onUpdateSettings={updateSettings}
              onResetProgress={resetProgress}
            />
          </div>
        </div>
      </header>

      {/* 主体 */}
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        {/* 浏览器不支持提示 */}
        {!supported && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            当前浏览器不支持语音合成功能，请使用 Chrome、Edge 或 Safari 浏览器。
          </div>
        )}

        {/* 进度条 + 学习阶段信息 */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1 text-xs">
                <ModeIcon className="h-3 w-3" />
                {modeInfo.label}
              </Badge>
              {phaseInfo.sessionStats ? (
                <span>
                  已学 {phaseInfo.sessionStats.learned} · 复习中 {phaseInfo.sessionStats.reviewing} · 已掌握 {phaseInfo.sessionStats.mastered}
                </span>
              ) : phaseInfo.totalGroups > 0 && isPlaying ? (
                <span>
                  第 {phaseInfo.group} 组 · 第 {phaseInfo.round}/{phaseInfo.totalRounds} 轮
                </span>
              ) : (
                <span>
                  第 {currentIndex + 1} 个 / 共 {total} 个
                </span>
              )}
            </span>
            <span>
              {phaseInfo.sessionStats
                ? `${Math.round((phaseInfo.sessionStats.mastered / phaseInfo.sessionStats.total) * 100)}%`
                : `${Math.round(progress)}%`}
            </span>
          </div>
          <Progress
            value={phaseInfo.sessionStats
              ? (phaseInfo.sessionStats.learned / phaseInfo.sessionStats.total) * 100
              : progress}
            className="h-1.5"
          />
        </div>

        {/* 单词卡片 */}
        <WordCard
          word={currentWord}
          index={currentIndex}
          total={total}
          isPlaying={isPlaying}
          showExample={settings.speakExample}
          phaseInfo={phaseInfo}
          mnemonic={currentWord ? getMnemonic(currentWord) : undefined}
          onSpeak={speakCurrent}
        />

        {/* 播放控制 */}
        <PlayerControls
          isPlaying={isPlaying}
          onTogglePlay={togglePlay}
          onNext={next}
          onPrev={prev}
          onSpeakCurrent={speakCurrent}
          showNextGroup={settings.learnMode === 'memory'}
          onNextGroup={nextGroup}
        />

        {/* 开始提示 */}
        {!hasStarted && supported && (
          <div className="text-center text-sm text-muted-foreground">
            <p>
              点击 <span className="font-semibold text-emerald-600 dark:text-emerald-400">播放</span> 按钮，或按 <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs">空格</kbd> 键开始
            </p>
            <p className="mt-1 text-xs">
              当前模式：{modeInfo.label} · 出发后无需操作手机
            </p>
          </div>
        )}

        {/* 快捷键提示 */}
        <div className="hidden items-center justify-center gap-4 text-xs text-muted-foreground sm:flex">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5">Space</kbd> 播放/暂停
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5">←</kbd> 上一个
          </span>
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5">→</kbd> 下一个
          </span>
        </div>
      </main>

      {/* 底部信息 */}
      <footer className="mx-auto max-w-3xl px-4 pb-8 text-center sm:px-6">
        <p className="text-xs text-muted-foreground">
          DriveWord · 开车通勤背单词 · {wordbooks.reduce((sum, b) => sum + b.words.length, 0)}+ 词汇量
        </p>
      </footer>
    </div>
  )
}
