import { Volume2, Brain, RefreshCw, HelpCircle, Ear, Play } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { WordEntry, PlayPhase, PlayPhaseInfo } from '@/types/word'

interface WordCardProps {
  word: WordEntry | undefined
  index: number
  total: number
  isPlaying: boolean
  showExample: boolean
  phaseInfo: PlayPhaseInfo
  onSpeak?: () => void
}

const PHASE_CONFIG: Record<PlayPhase, { label: string; icon: typeof Brain; color: string }> = {
  learn: { label: '学习中', icon: Brain, color: 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border-blue-500/30' },
  review: { label: '复习中', icon: RefreshCw, color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  test: { label: '测试中', icon: HelpCircle, color: 'text-purple-600 dark:text-purple-400 bg-purple-500/10 border-purple-500/30' },
  recall: { label: '回忆中', icon: Ear, color: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30' },
  normal: { label: '播放中', icon: Play, color: 'text-muted-foreground bg-muted/50 border-border' },
}

export function WordCard({ word, index, total, isPlaying, showExample, phaseInfo, onSpeak }: WordCardProps) {
  if (!word) {
    return (
      <Card className="flex min-h-[280px] items-center justify-center p-8 sm:min-h-[340px]">
        <p className="text-muted-foreground">暂无单词</p>
      </Card>
    )
  }

  const phaseCfg = PHASE_CONFIG[phaseInfo.phase] || PHASE_CONFIG.normal
  const PhaseIcon = phaseCfg.icon
  const showGroupInfo = phaseInfo.totalGroups > 0

  return (
    <Card
      className={cn(
        'relative flex min-h-[280px] flex-col justify-between overflow-hidden p-6 sm:min-h-[340px] sm:p-10',
        'border-2 transition-colors duration-500',
        isPlaying ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-border',
      )}
    >
      {/* 顶部：进度 + 阶段标识 */}
      <div className="flex items-center justify-between">
        <Badge variant="secondary" className="text-sm font-medium tabular-nums">
          {index + 1} / {total}
        </Badge>
        <div className="flex items-center gap-2">
          {word.pos && (
            <Badge variant="outline" className="text-sm">
              {word.pos}
            </Badge>
          )}
          {isPlaying && (
            <Badge className={cn('gap-1 border', phaseCfg.color)}>
              <PhaseIcon className="h-3 w-3" />
              {phaseCfg.label}
            </Badge>
          )}
        </div>
      </div>

      {/* 组/轮信息 */}
      {showGroupInfo && isPlaying && (
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span>第 {phaseInfo.group} 组 / 共 {phaseInfo.totalGroups} 组</span>
          <span>·</span>
          <span>第 {phaseInfo.round} 轮 / 共 {phaseInfo.totalRounds} 轮</span>
        </div>
      )}

      {/* 回忆模式提示 */}
      {phaseInfo.phase === 'recall' && isPlaying && (
        <div className="mt-2 rounded-lg bg-amber-500/10 px-3 py-1.5 text-center text-xs text-amber-600 dark:text-amber-400">
          听到中文后，在沉默时间回忆英文单词 ↻
        </div>
      )}

      {/* 单词主体 */}
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-6 text-center sm:gap-5">
        <div className="flex items-center gap-3">
          <h2 className="text-4xl font-bold tracking-tight break-all sm:text-6xl lg:text-7xl">
            {word.word}
          </h2>
          <button
            onClick={onSpeak}
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="朗读单词"
          >
            <Volume2 className="h-6 w-6 sm:h-8 sm:w-8" />
          </button>
        </div>

        {word.phonetic && (
          <p className="text-lg text-muted-foreground sm:text-2xl">{word.phonetic}</p>
        )}

        <p className="text-2xl font-medium text-emerald-600 dark:text-emerald-400 sm:text-3xl lg:text-4xl">
          {word.translation}
        </p>

        {showExample && word.example && (
          <div className="mt-2 max-w-2xl space-y-1 border-t border-border pt-4">
            <p className="text-base text-foreground/80 sm:text-lg">{word.example}</p>
            {word.exampleCn && (
              <p className="text-sm text-muted-foreground sm:text-base">{word.exampleCn}</p>
            )}
          </div>
        )}
      </div>

      {/* 播放脉冲指示器 */}
      {isPlaying && (
        <div className="absolute bottom-0 left-0 right-0 h-1 overflow-hidden">
          <div className="h-full animate-pulse bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-500" />
        </div>
      )}
    </Card>
  )
}
