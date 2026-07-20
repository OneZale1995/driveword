import {
  BookOpen,
  Settings,
  Shuffle,
  Repeat1,
  ListOrdered,
  Brain,
  Ear,
  Headphones,
  Play,
  Zap,
  RotateCcw,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type { PlayerSettings, PlayMode, LearnMode, WordBook } from '@/types/word'

interface SettingsPanelProps {
  wordbooks: WordBook[]
  currentBookId: string
  onSelectBook: (id: string) => void
  settings: PlayerSettings
  onUpdateSettings: (partial: Partial<PlayerSettings>) => void
  onResetProgress?: () => void
  triggerClassName?: string
}

const LEARN_MODES: { value: LearnMode; label: string; desc: string; icon: typeof Brain }[] = [
  {
    value: 'srs',
    label: '间隔重复(SRS)',
    desc: '科学间隔重复+主动回忆+进度记忆',
    icon: Zap,
  },
  {
    value: 'memory',
    label: '记忆模式',
    desc: '分组循环 + 多轮重复 + 间隔复习',
    icon: Brain,
  },
  {
    value: 'recall',
    label: '回忆模式',
    desc: '先读中文 → 沉默回忆 → 公布英文',
    icon: Ear,
  },
  {
    value: 'blind',
    label: '盲听模式',
    desc: '英文→沉默→中文，纯听觉训练听力',
    icon: Headphones,
  },
  {
    value: 'sequential',
    label: '顺序模式',
    desc: '逐个播放，简单过一遍',
    icon: Play,
  },
]

const PLAY_MODES: { value: PlayMode; label: string; icon: typeof Shuffle }[] = [
  { value: 'order', label: '顺序', icon: ListOrdered },
  { value: 'shuffle', label: '随机', icon: Shuffle },
  { value: 'single', label: '单曲', icon: Repeat1 },
]

export function SettingsPanel({
  wordbooks,
  currentBookId,
  onSelectBook,
  settings,
  onUpdateSettings,
  onResetProgress,
  triggerClassName,
}: SettingsPanelProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className={cn('h-11 w-11', triggerClassName)} aria-label="设置">
          <Settings className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-xl">播放设置</SheetTitle>
          <SheetDescription>选择学习模式，调整参数找到最适合你的节奏</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6 px-1">
          {/* 词库选择 */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">词库选择</h3>
            </div>
            <div className="grid gap-2">
              {wordbooks.map((book) => (
                <button
                  key={book.id}
                  onClick={() => onSelectBook(book.id)}
                  className={cn(
                    'flex flex-col items-start gap-1 rounded-lg border-2 p-3 text-left transition-colors',
                    currentBookId === book.id
                      ? 'border-emerald-500 bg-emerald-500/5'
                      : 'border-border hover:border-muted-foreground/40',
                  )}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="font-medium">{book.name}</span>
                    <Badge variant="secondary" className="text-xs">
                      {book.words.length} 词
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">{book.description}</span>
                </button>
              ))}
            </div>
          </section>

          <Separator />

          {/* 学习模式选择 */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">学习模式</h3>
            <div className="grid gap-2">
              {LEARN_MODES.map((mode) => {
                const Icon = mode.icon
                const active = settings.learnMode === mode.value
                return (
                  <button
                    key={mode.value}
                    onClick={() => onUpdateSettings({ learnMode: mode.value })}
                    className={cn(
                      'flex items-start gap-3 rounded-lg border-2 p-3 text-left transition-colors',
                      active
                        ? 'border-emerald-500 bg-emerald-500/5'
                        : 'border-border hover:border-muted-foreground/40',
                    )}
                  >
                    <Icon
                      className={cn(
                        'mt-0.5 h-5 w-5 shrink-0',
                        active
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-muted-foreground',
                      )}
                    />
                    <div className="space-y-0.5">
                      <span className="text-sm font-semibold">{mode.label}</span>
                      <p className="text-xs text-muted-foreground">{mode.desc}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </section>

          {/* SRS 模式专属设置 */}
          {settings.learnMode === 'srs' && (
            <>
              <Separator />
              <section className="space-y-4">
                <h3 className="text-sm font-semibold">SRS 间隔重复参数</h3>

                {/* 每轮新词数 */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">每轮新词数</Label>
                    <Badge variant="secondary" className="tabular-nums">
                      {settings.newWordsPerRound} 个/轮
                    </Badge>
                  </div>
                  <Slider
                    value={[settings.newWordsPerRound]}
                    min={1}
                    max={5}
                    step={1}
                    onValueChange={(v) => onUpdateSettings({ newWordsPerRound: v[0] })}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>少 1 个</span>
                    <span>推荐 3 个</span>
                    <span>多 5 个</span>
                  </div>
                  <p className="rounded-lg bg-emerald-500/10 p-2 text-xs text-emerald-600 dark:text-emerald-400">
                    每轮学习 N 个新词，与到期复习词交错播放。进度自动保存，跨会话恢复。
                  </p>
                </div>

                {/* 重置进度 */}
                {onResetProgress && (
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-semibold">重置进度</Label>
                      <p className="text-xs text-muted-foreground">清除所有单词的掌握度记录</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-destructive hover:text-destructive"
                      onClick={() => {
                        if (window.confirm('确定要重置所有学习进度吗？此操作不可撤销。')) {
                          onResetProgress()
                        }
                      }}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      重置
                    </Button>
                  </div>
                )}
              </section>
            </>
          )}

          {/* 记忆模式专属设置 */}
          {settings.learnMode === 'memory' && (
            <>
              <Separator />
              <section className="space-y-4">
                <h3 className="text-sm font-semibold">记忆模式参数</h3>

                {/* 分组大小 */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">每组单词数</Label>
                    <Badge variant="secondary" className="tabular-nums">
                      {settings.groupSize} 个/组
                    </Badge>
                  </div>
                  <Slider
                    value={[settings.groupSize]}
                    min={3}
                    max={10}
                    step={1}
                    onValueChange={(v) => onUpdateSettings({ groupSize: v[0] })}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>少 3 个</span>
                    <span>推荐 5 个</span>
                    <span>多 10 个</span>
                  </div>
                </div>

                {/* 重复轮数 */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">每组重复轮数</Label>
                    <Badge variant="secondary" className="tabular-nums">
                      {settings.groupRepeat} 轮
                    </Badge>
                  </div>
                  <Slider
                    value={[settings.groupRepeat]}
                    min={1}
                    max={5}
                    step={1}
                    onValueChange={(v) => onUpdateSettings({ groupRepeat: v[0] })}
                  />
                  <p className="text-xs text-muted-foreground">
                    第 1 轮学习（音节拆解+释义），第 2 轮复习，第 3 轮+测试回忆
                  </p>
                </div>

                {/* 间隔复习开关 */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-semibold">间隔复习</Label>
                    <p className="text-xs text-muted-foreground">每组结束后随机复习之前的词</p>
                  </div>
                  <Switch
                    checked={settings.reviewEnabled}
                    onCheckedChange={(v) => onUpdateSettings({ reviewEnabled: v })}
                  />
                </div>
              </section>
            </>
          )}

          {/* 回忆模式专属设置 */}
          {settings.learnMode === 'recall' && (
            <>
              <Separator />
              <section className="space-y-4">
                <h3 className="text-sm font-semibold">回忆模式参数</h3>

                {/* 回忆间隔 */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">回忆沉默时间</Label>
                    <Badge variant="secondary" className="tabular-nums">
                      {settings.recallPause.toFixed(1)}s
                    </Badge>
                  </div>
                  <Slider
                    value={[settings.recallPause]}
                    min={2}
                    max={10}
                    step={0.5}
                    onValueChange={(v) => onUpdateSettings({ recallPause: v[0] })}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>快 2s</span>
                    <span>推荐 4s</span>
                    <span>慢 10s</span>
                  </div>
                  <p className="rounded-lg bg-amber-500/10 p-2 text-xs text-amber-600 dark:text-amber-400">
                    听到中文后，利用沉默时间在脑中回忆英文单词和拼写，然后听答案对照
                  </p>
                </div>
              </section>
            </>
          )}

          {/* 盲听模式专属设置 */}
          {settings.learnMode === 'blind' && (
            <>
              <Separator />
              <section className="space-y-4">
                <h3 className="text-sm font-semibold">盲听模式参数</h3>

                {/* 沉默时间（复用 recallPause） */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">听后沉默时间</Label>
                    <Badge variant="secondary" className="tabular-nums">
                      {settings.recallPause.toFixed(1)}s
                    </Badge>
                  </div>
                  <Slider
                    value={[settings.recallPause]}
                    min={2}
                    max={10}
                    step={0.5}
                    onValueChange={(v) => onUpdateSettings({ recallPause: v[0] })}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>快 2s</span>
                    <span>推荐 4s</span>
                    <span>慢 10s</span>
                  </div>
                  <p className="rounded-lg bg-blue-500/10 p-2 text-xs text-blue-600 dark:text-blue-400">
                    先听英文正常语速，利用沉默时间理解含义，再听慢速英文和中文翻译确认。不拼读字母，专注听力。
                  </p>
                </div>
              </section>
            </>
          )}

          {/* 顺序模式专属设置 */}
          {settings.learnMode === 'sequential' && (
            <>
              <Separator />
              <section className="space-y-3">
                <h3 className="text-sm font-semibold">顺序模式</h3>
                <div className="grid grid-cols-3 gap-2">
                  {PLAY_MODES.map((mode) => {
                    const Icon = mode.icon
                    const active = settings.playMode === mode.value
                    return (
                      <button
                        key={mode.value}
                        onClick={() => onUpdateSettings({ playMode: mode.value })}
                        className={cn(
                          'flex flex-col items-center gap-1.5 rounded-lg border-2 py-3 transition-colors',
                          active
                            ? 'border-emerald-500 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400'
                            : 'border-border hover:border-muted-foreground/40',
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="text-xs font-medium">{mode.label}</span>
                      </button>
                    )
                  })}
                </div>
              </section>
            </>
          )}

          <Separator />

          {/* 通用参数 */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold">朗读参数</h3>

            {/* 语速 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">朗读语速</Label>
                <Badge variant="secondary" className="tabular-nums">
                  {settings.rate.toFixed(1)}x
                </Badge>
              </div>
              <Slider
                value={[settings.rate]}
                min={0.5}
                max={2.0}
                step={0.1}
                onValueChange={(v) => onUpdateSettings({ rate: v[0] })}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>慢速 0.5x</span>
                <span>常速 1.0x</span>
                <span>快速 2.0x</span>
              </div>
            </div>

            {/* 停顿时间 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">单词间停顿</Label>
                <Badge variant="secondary" className="tabular-nums">
                  {settings.pauseBetween.toFixed(1)}s
                </Badge>
              </div>
              <Slider
                value={[settings.pauseBetween]}
                min={0.5}
                max={5.0}
                step={0.5}
                onValueChange={(v) => onUpdateSettings({ pauseBetween: v[0] })}
              />
            </div>

            {/* 重复次数（仅顺序模式） */}
            {settings.learnMode === 'sequential' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">单词重复朗读</Label>
                  <Badge variant="secondary" className="tabular-nums">
                    {settings.repeat} 次
                  </Badge>
                </div>
                <Slider
                  value={[settings.repeat]}
                  min={1}
                  max={5}
                  step={1}
                  onValueChange={(v) => onUpdateSettings({ repeat: v[0] })}
                />
              </div>
            )}

            {/* 单词重复次数（SRS 模式） */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">单词重复次数</Label>
                <Badge variant="secondary" className="tabular-nums">
                  {settings.wordRepeat} 次
                </Badge>
              </div>
              <Slider
                value={[settings.wordRepeat]}
                min={1}
                max={5}
                step={1}
                onValueChange={(v) => onUpdateSettings({ wordRepeat: v[0] })}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1 次</span>
                <span>推荐 2 次</span>
                <span>5 次</span>
              </div>
              <p className="text-xs text-muted-foreground">
                SRS 学习与复习序列中，单词英文重复朗读的次数
              </p>
            </div>

            {/* 例句重复次数 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm">例句重复次数</Label>
                <Badge variant="secondary" className="tabular-nums">
                  {settings.exampleRepeat} 次
                </Badge>
              </div>
              <Slider
                value={[settings.exampleRepeat]}
                min={1}
                max={3}
                step={1}
                onValueChange={(v) => onUpdateSettings({ exampleRepeat: v[0] })}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1 次</span>
                <span>推荐 1 次</span>
                <span>3 次</span>
              </div>
            </div>
          </section>

          <Separator />

          {/* 开关项 */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-semibold">音节拆解</Label>
                <p className="text-xs text-muted-foreground">按音节朗读 + 发音规则提示（元音/辅音/连读）</p>
              </div>
              <Switch
                checked={settings.speakSpelling}
                onCheckedChange={(v) => onUpdateSettings({ speakSpelling: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-semibold">字母拼读</Label>
                <p className="text-xs text-muted-foreground">逐字母朗读 A-B-C-D（拼写记忆）</p>
              </div>
              <Switch
                checked={settings.speakLetters}
                onCheckedChange={(v) => onUpdateSettings({ speakLetters: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-semibold">朗读中文翻译</Label>
                <p className="text-xs text-muted-foreground">英文读完后朗读中文释义</p>
              </div>
              <Switch
                checked={settings.speakTranslation}
                onCheckedChange={(v) => onUpdateSettings({ speakTranslation: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-semibold">朗读例句</Label>
                <p className="text-xs text-muted-foreground">朗读单词例句及翻译</p>
              </div>
              <Switch
                checked={settings.speakExample}
                onCheckedChange={(v) => onUpdateSettings({ speakExample: v })}
              />
            </div>
          </section>

          <Separator />

          {/* 提示 */}
          <section className="rounded-lg bg-muted/50 p-4 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">学习建议</p>
            <ul className="mt-2 space-y-1">
              <li>· SRS 间隔重复效果最好：科学间隔+主动回忆+进度记忆</li>
              <li>· 盲听模式练听力：先听英文理解，再听中文确认</li>
              <li>· 记忆模式：5词一组，3轮重复，自动复习</li>
              <li>· 回忆模式练主动回忆：听到中文先想英文，再听答案</li>
              <li>· 语速建议 0.8-1.0x，停顿 1.5-2.0s</li>
              <li>· 空格键暂停/继续，方向键切换单词</li>
            </ul>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  )
}
