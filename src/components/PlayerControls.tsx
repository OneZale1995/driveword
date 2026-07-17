import { Pause, Play, SkipBack, SkipForward, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface PlayerControlsProps {
  isPlaying: boolean
  onTogglePlay: () => void
  onNext: () => void
  onPrev: () => void
  onSpeakCurrent: () => void
}

export function PlayerControls({
  isPlaying,
  onTogglePlay,
  onNext,
  onPrev,
  onSpeakCurrent,
}: PlayerControlsProps) {
  return (
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
  )
}
