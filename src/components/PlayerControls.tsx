import { Pause, Play, SkipBack, SkipForward, Volume2, ChevronsRight, ChevronsLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface PlayerControlsProps {
  isPlaying: boolean
  onTogglePlay: () => void
  onNext: () => void
  onPrev: () => void
  onSpeakCurrent: () => void
  showNextGroup?: boolean
  onNextGroup?: () => void
  onPrevGroup?: () => void
}

export function PlayerControls({
  isPlaying,
  onTogglePlay,
  onNext,
  onPrev,
  onSpeakCurrent,
  showNextGroup = false,
  onNextGroup,
  onPrevGroup,
}: PlayerControlsProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center justify-center gap-3 sm:gap-6">
        {/* 上一个 */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onPrev}
          className="h-14 w-14 rounded-full sm:h-16 sm:w-16"
          aria-label="上一个单词"
        >
          <SkipBack className="h-6 w-6 sm:h-7 sm:w-7" />
        </Button>

        {/* 播放/暂停 */}
        <Button
          onClick={onTogglePlay}
          className={cn(
            'h-20 w-20 rounded-full sm:h-24 sm:w-24',
            'bg-emerald-600 text-white hover:bg-emerald-700',
            'shadow-lg shadow-emerald-600/25',
          )}
          aria-label={isPlaying ? '暂停' : '播放'}
        >
          {isPlaying ? (
            <Pause className="h-9 w-9 sm:h-10 sm:w-10" />
          ) : (
            <Play className="h-9 w-9 translate-x-0.5 sm:h-10 sm:w-10" />
          )}
        </Button>

        {/* 下一个 */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onNext}
          className="h-14 w-14 rounded-full sm:h-16 sm:w-16"
          aria-label="下一个单词"
        >
          <SkipForward className="h-6 w-6 sm:h-7 sm:w-7" />
        </Button>

        {/* 朗读当前 */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onSpeakCurrent}
          className="h-14 w-14 rounded-full sm:h-16 sm:w-16"
          aria-label="朗读当前单词"
        >
          <Volume2 className="h-5 w-5 sm:h-6 sm:w-6" />
        </Button>
      </div>

      {/* 上一组 / 下一组（仅记忆模式显示） */}
      {showNextGroup && (onPrevGroup || onNextGroup) && (
        <div className="flex items-center gap-3">
          {onPrevGroup && (
            <Button
              variant="outline"
              size="sm"
              onClick={onPrevGroup}
              className="h-12 gap-1.5 rounded-full border-emerald-500/50 px-5 text-emerald-600 hover:bg-emerald-500/10 sm:h-14 dark:text-emerald-400"
              aria-label="切换到上一组"
            >
              <ChevronsLeft className="h-5 w-5" />
              上一组
            </Button>
          )}
          {onNextGroup && (
            <Button
              variant="outline"
              size="sm"
              onClick={onNextGroup}
              className="h-12 gap-1.5 rounded-full border-emerald-500/50 px-5 text-emerald-600 hover:bg-emerald-500/10 sm:h-14 dark:text-emerald-400"
              aria-label="切换到下一组"
            >
              <ChevronsRight className="h-5 w-5" />
              下一组
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
