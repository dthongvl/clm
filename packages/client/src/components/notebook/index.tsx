/* eslint-disable react-refresh/only-export-components */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  AiGenerativeIcon,
  AlertCircleIcon,
  Loading03Icon,
  SecurityIcon,
  RocketIcon,
  Alert02Icon,
  Bug01Icon,
  InformationCircleIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Markdown } from "@/components/ui/markdown"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  useStreamingReviewGuide,
  useReviewGuideState,
  useModels,
  useSettings,
  type RegenerationPreview,
} from "@/hooks"
import { useDiffPanelContext } from "@/components/diff-panel/diff-panel-context"
import { ActionTriggerWithContext } from "@/components/side-panel/action-trigger-with-context"
import { ActionSettingsPopover } from "@/components/side-panel/action-settings-popover"
import { AIProgressPanel } from "@/components/side-panel/ai-progress-panel"
import { RegenerateModal } from "./regenerate-modal"
import type {
  NotebookChapterState,
  NotebookChecklistCell,
  NotebookDiffCell,
  NotebookMarkdownCell,
  NotebookNoteCell,
  NoteSeverity,
} from "@/types/review-guide"
import type { DiffFileData } from "@/types/diff"
import { NotebookDiffCellRenderer } from "./notebook-diff-cell"

// --- Helpers --------------------------------------------------------------

const NOTE_SEVERITY_META: Record<
  NoteSeverity,
  { label: string; icon: typeof InformationCircleIcon; tone: string }
> = {
  info: {
    label: "Info",
    icon: InformationCircleIcon,
    tone: "border-border bg-muted/30 text-foreground",
  },
  attention: {
    label: "Attention",
    icon: Alert02Icon,
    tone: "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300",
  },
  security: {
    label: "Security",
    icon: SecurityIcon,
    tone: "border-red-500/40 bg-red-500/5 text-red-700 dark:text-red-300",
  },
  performance: {
    label: "Performance",
    icon: RocketIcon,
    tone: "border-violet-500/40 bg-violet-500/5 text-violet-700 dark:text-violet-300",
  },
  risk: {
    label: "Risk",
    icon: Bug01Icon,
    tone: "border-orange-500/40 bg-orange-500/5 text-orange-700 dark:text-orange-300",
  },
}

function checklistKey(cellId: string, itemId: string): string {
  return `${cellId}::${itemId}`
}

interface CellCompletionContext {
  isNoteAcknowledged: (cellId: string) => boolean
  isChecklistItemChecked: (key: string) => boolean
}

/**
 * Returns the completion fraction (0–1) for a chapter based on actionable
 * cells only:
 *   - attention / security / performance / risk note: explicit acknowledgment
 *   - checklist: every item ticked
 * Markdown, diff, and info-note cells are reading material and do not
 * contribute to the progress denominator.
 */
function chapterProgress(
  chapter: NotebookChapterState,
  ctx: CellCompletionContext,
): { complete: number; total: number } {
  let total = 0
  let complete = 0
  for (const cell of chapter.cells) {
    if (cell.type === "checklist") {
      for (const item of cell.items) {
        total += 1
        if (ctx.isChecklistItemChecked(checklistKey(cell.id, item.id))) complete += 1
      }
      continue
    }
    if (cell.type === "note" && cell.severity !== "info") {
      total += 1
      if (ctx.isNoteAcknowledged(cell.id)) complete += 1
    }
  }
  return { complete, total }
}

// --- Cell renderers -------------------------------------------------------

interface MarkdownCellProps {
  cell: NotebookMarkdownCell
}

function MarkdownCellView({ cell }: MarkdownCellProps) {
  return (
    <div
      data-slot="notebook-cell"
      data-cell-type="markdown"
      data-cell-id={cell.id}
      className="text-sm"
    >
      <Markdown className="text-sm [&_p]:my-2 [&_ul]:my-2">{cell.content}</Markdown>
    </div>
  )
}

interface DiffCellProps {
  cell: NotebookDiffCell
  file: DiffFileData | undefined
}

function DiffCellView({ cell, file }: DiffCellProps) {
  if (!file) {
    return (
      <div
        data-slot="notebook-cell"
        data-cell-type="diff"
        data-cell-id={cell.id}
        data-state="missing-file"
        className="flex flex-col gap-2 rounded-md border border-dashed border-amber-500/40 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300"
      >
        <div className="flex items-center gap-2">
          <HugeiconsIcon icon={AlertCircleIcon} className="size-4" />
          <span className="font-medium">Diff cell skipped</span>
        </div>
        <p>
          File <code className="font-mono">{cell.filePath}</code> is not in this
          PR's changed files. The narrative around it remains useful but the
          diff cannot be rendered.
        </p>
        {cell.caption && <p className="text-amber-700/80">{cell.caption}</p>}
      </div>
    )
  }

  return (
    <div
      data-slot="notebook-cell"
      data-cell-type="diff"
      data-cell-id={cell.id}
      className="flex flex-col gap-2"
    >
      {cell.caption && (
        <div className="text-xs text-muted-foreground">{cell.caption}</div>
      )}
      <NotebookDiffCellRenderer file={file} />
    </div>
  )
}

interface NoteCellProps {
  cell: NotebookNoteCell
  isAcknowledged: boolean
  onAcknowledge: () => void
  onUnacknowledge: () => void
}

function NoteCellView({
  cell,
  isAcknowledged,
  onAcknowledge,
  onUnacknowledge,
}: NoteCellProps) {
  const meta = NOTE_SEVERITY_META[cell.severity]
  const isInfo = cell.severity === "info"

  return (
    <div
      data-slot="notebook-cell"
      data-cell-type="note"
      data-cell-id={cell.id}
      data-severity={cell.severity}
      data-complete={(isInfo || isAcknowledged) || undefined}
      className={cn("flex flex-col gap-2 rounded-md border p-3 text-sm", meta.tone)}
    >
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
        <HugeiconsIcon icon={meta.icon} className="size-4" />
        {meta.label}
      </div>
      <Markdown className="text-sm [&_p]:my-1">{cell.content}</Markdown>
      {!isInfo && (
        <div className="flex items-center gap-2">
          <Button
            size="xs"
            variant={isAcknowledged ? "outline" : "default"}
            onClick={isAcknowledged ? onUnacknowledge : onAcknowledge}
          >
            {isAcknowledged ? "✓ Acknowledged" : "Acknowledge"}
          </Button>
          <span className="text-[11px] text-muted-foreground">
            {isAcknowledged
              ? "Click to undo acknowledgment."
              : "Explicit acknowledgment required."}
          </span>
        </div>
      )}
    </div>
  )
}

interface ChecklistCellProps {
  cell: NotebookChecklistCell
  isItemChecked: (key: string) => boolean
  onToggleItem: (cellId: string, itemId: string) => void
}

function ChecklistCellView({ cell, isItemChecked, onToggleItem }: ChecklistCellProps) {
  return (
    <div
      data-slot="notebook-cell"
      data-cell-type="checklist"
      data-cell-id={cell.id}
      className="flex flex-col gap-2 rounded-md border bg-card p-3 text-sm"
    >
      <ul className="flex flex-col gap-1.5">
        {cell.items.map((item) => {
          const key = checklistKey(cell.id, item.id)
          const checked = isItemChecked(key)
          return (
            <li key={item.id} className="flex items-start gap-2">
              <Checkbox
                id={`${cell.id}-${item.id}`}
                checked={checked}
                onCheckedChange={() => onToggleItem(cell.id, item.id)}
                className="mt-0.5"
              />
              <label
                htmlFor={`${cell.id}-${item.id}`}
                className={cn(
                  "cursor-pointer text-sm leading-snug",
                  checked && "text-muted-foreground line-through",
                )}
              >
                {item.text}
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// --- Chapter section ------------------------------------------------------

interface ChapterSectionProps {
  index: number
  total: number
  chapter: NotebookChapterState
  filesByPath: Map<string, DiffFileData>
  ctx: CellCompletionContext
  mutators: {
    acknowledgeNote: (cellId: string) => void
    unacknowledgeNote: (cellId: string) => void
    toggleChecklistItem: (cellId: string, itemId: string) => void
  }
  onRegenerate?: (chapterId: string) => void
}

function ChapterSection({
  index,
  total,
  chapter,
  filesByPath,
  ctx,
  mutators,
  onRegenerate,
}: ChapterSectionProps) {
  const { complete, total: cellTotal } = chapterProgress(chapter, ctx)
  const percent = cellTotal === 0 ? 0 : Math.round((complete / cellTotal) * 100)
  const isGenerating = chapter.status === "generating"
  const isPartial = chapter.status === "partial"
  const isError = chapter.status === "error"

  return (
    <section
      id={`notebook-chapter-${chapter.chapter.id}`}
      data-slot="notebook-chapter"
      data-chapter-id={chapter.chapter.id}
      data-status={chapter.status}
      className="flex scroll-mt-4 flex-col gap-3 rounded-lg border bg-card p-4"
    >
      <header className="flex flex-col gap-1.5 border-b pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Chapter {index + 1} of {total}
            </span>
            <h2 className="truncate text-lg font-semibold leading-tight text-foreground">
              {chapter.chapter.title}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {(isGenerating || isPartial || isError || cellTotal > 0) && (
              <span
                data-state={chapter.status}
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-medium",
                  isGenerating && "bg-primary/10 text-primary",
                  isPartial && "bg-amber-500/10 text-amber-700 dark:text-amber-300",
                  isError && "bg-destructive/10 text-destructive",
                  !isGenerating && !isPartial && !isError && "bg-muted text-muted-foreground",
                )}
              >
                {isGenerating
                  ? "Generating…"
                  : isPartial
                    ? "Partial"
                    : isError
                      ? "Error"
                      : `${percent}% done`}
              </span>
            )}
            {onRegenerate && !isGenerating && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => onRegenerate(chapter.chapter.id)}
                aria-label={`Regenerate chapter ${chapter.chapter.title}`}
              >
                Regenerate
              </Button>
            )}
          </div>
        </div>
        {chapter.chapter.intent && (
          <p className="text-xs text-muted-foreground">{chapter.chapter.intent}</p>
        )}
        {isError && chapter.error && (
          <p className="text-xs text-destructive">{chapter.error}</p>
        )}
      </header>

      {chapter.cells.length === 0 && isGenerating && (
        <div className="flex items-center gap-2 rounded-md border border-dashed bg-muted/30 px-3 py-4 text-xs text-muted-foreground">
          <HugeiconsIcon icon={Loading03Icon} className="size-3 animate-spin" />
          Streaming chapter cells…
        </div>
      )}
      {chapter.cells.length === 0 && !isGenerating && (
        <div className="rounded-md border border-dashed bg-muted/30 px-3 py-4 text-xs text-muted-foreground">
          This chapter has no cells.
        </div>
      )}

      <div className="flex flex-col gap-3">
        {chapter.cells.map((cell) => {
          if (cell.type === "markdown") {
            return <MarkdownCellView key={cell.id} cell={cell} />
          }
          if (cell.type === "diff") {
            return (
              <DiffCellView
                key={cell.id}
                cell={cell}
                file={filesByPath.get(cell.filePath.replace(/^\/+/, ""))}
              />
            )
          }
          if (cell.type === "note") {
            return (
              <NoteCellView
                key={cell.id}
                cell={cell}
                isAcknowledged={ctx.isNoteAcknowledged(cell.id)}
                onAcknowledge={() => mutators.acknowledgeNote(cell.id)}
                onUnacknowledge={() => mutators.unacknowledgeNote(cell.id)}
              />
            )
          }
          // checklist
          return (
            <ChecklistCellView
              key={cell.id}
              cell={cell}
              isItemChecked={ctx.isChecklistItemChecked}
              onToggleItem={mutators.toggleChecklistItem}
            />
          )
        })}
      </div>
    </section>
  )
}

// --- Chapter rail ---------------------------------------------------------

interface ChapterRailProps {
  chapters: NotebookChapterState[]
  ctx: CellCompletionContext
  scrollContainer: React.RefObject<HTMLDivElement | null>
}

/**
 * Tracks which chapter section is currently in view to drive the rail's
 * active state. Uses the scroll container as the IntersectionObserver root so
 * only the visible chapter gets the highlight.
 */
function useActiveChapter(
  chapters: NotebookChapterState[],
  scrollContainer: React.RefObject<HTMLDivElement | null>,
): string | null {
  const [activeId, setActiveId] = useState<string | null>(
    chapters[0]?.chapter.id ?? null,
  )

  useEffect(() => {
    const root = scrollContainer.current
    if (!root || chapters.length === 0) return
    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the topmost intersecting section.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) {
          const id = (visible[0].target as HTMLElement).dataset.chapterId
          if (id) setActiveId(id)
        }
      },
      { root: root.parentElement, threshold: 0, rootMargin: "0px 0px -60% 0px" },
    )
    chapters.forEach((c) => {
      const el = root.querySelector(
        `#notebook-chapter-${CSS.escape(c.chapter.id)}`,
      )
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [chapters, scrollContainer])

  return activeId
}

function ChapterRail({ chapters, ctx, scrollContainer }: ChapterRailProps) {
  const activeId = useActiveChapter(chapters, scrollContainer)
  if (chapters.length <= 1) return null
  const handleJump = (chapterId: string) => {
    const root = scrollContainer.current
    if (!root) return
    const target = root.querySelector(
      `#notebook-chapter-${CSS.escape(chapterId)}`,
    ) as HTMLElement | null
    target?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <aside
      data-slot="notebook-chapter-rail"
      className="sticky top-0 flex w-40 shrink-0 flex-col gap-0.5 self-start border-r border-border/60 bg-background/80 px-2 py-3 text-xs backdrop-blur"
      aria-label="Chapter navigation"
    >
      <span className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Chapters
      </span>
      {chapters.map((chapter, index) => {
        const { complete, total } = chapterProgress(chapter, ctx)
        const percent = total === 0 ? null : Math.round((complete / total) * 100)
        const isActive = activeId === chapter.chapter.id
        const isComplete = total > 0 && complete === total
        return (
          <button
            key={chapter.chapter.id}
            type="button"
            onClick={() => handleJump(chapter.chapter.id)}
            title={chapter.chapter.intent}
            aria-current={isActive ? "true" : undefined}
            className={cn(
              "group/rail relative flex flex-col gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors",
              "hover:bg-muted/50",
              isActive && "bg-muted/70",
            )}
          >
            {isActive && (
              <span
                aria-hidden
                className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary"
              />
            )}
            <span className="flex items-center justify-between gap-2">
              <span
                className={cn(
                  "font-mono text-[10px]",
                  isActive ? "text-primary" : "text-muted-foreground",
                )}
              >
                C{index + 1}
              </span>
              {percent !== null && (
                <span
                  className={cn(
                    "text-[10px] tabular-nums",
                    isComplete
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-muted-foreground",
                  )}
                >
                  {isComplete ? "✓" : `${percent}%`}
                </span>
              )}
            </span>
            <span
              className={cn(
                "line-clamp-2 text-[12px] leading-snug",
                isActive ? "font-medium text-foreground" : "text-foreground/80",
              )}
            >
              {chapter.chapter.title}
            </span>
          </button>
        )
      })}
    </aside>
  )
}

// --- Progress stepper -----------------------------------------------------

interface ProgressStepperProps {
  chapters: NotebookChapterState[]
  ctx: CellCompletionContext
  scrollContainer: React.RefObject<HTMLDivElement | null>
}

/**
 * Compact horizontal stepper that visualises chapter completion at a glance
 * and doubles as a navigation aid. Each segment is a clickable rail to the
 * matching chapter.
 */
function ProgressStepper({ chapters, ctx, scrollContainer }: ProgressStepperProps) {
  if (chapters.length === 0) return null

  const handleJump = (chapterId: string) => {
    const root = scrollContainer.current
    if (!root) return
    const target = root.querySelector(
      `#notebook-chapter-${CSS.escape(chapterId)}`,
    ) as HTMLElement | null
    target?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div
      role="group"
      aria-label="Chapter progress"
      className="flex items-center gap-1"
    >
      {chapters.map((chapter, index) => {
        const { complete, total } = chapterProgress(chapter, ctx)
        const percent = total === 0 ? 0 : complete / total
        const isComplete = total > 0 && complete === total
        return (
          <button
            key={chapter.chapter.id}
            type="button"
            onClick={() => handleJump(chapter.chapter.id)}
            title={`Chapter ${index + 1}: ${chapter.chapter.title}`}
            aria-label={`Jump to chapter ${index + 1}: ${chapter.chapter.title}`}
            className="group/step relative h-1.5 w-8 overflow-hidden rounded-full bg-muted transition-colors hover:bg-muted-foreground/20"
          >
            <span
              aria-hidden
              className={cn(
                "absolute inset-y-0 left-0 rounded-full transition-all duration-300",
                isComplete
                  ? "bg-emerald-500 dark:bg-emerald-400"
                  : "bg-primary",
              )}
              style={{ width: `${Math.max(percent * 100, total === 0 ? 0 : 8)}%` }}
            />
          </button>
        )
      })}
    </div>
  )
}

// --- Notebook root --------------------------------------------------------

function Root() {
  const streaming = useStreamingReviewGuide()
  const guideState = useReviewGuideState()
  const { files } = useDiffPanelContext()
  const { data: models = [] } = useModels()
  const { settings, updateActionModel, updateActionThinkingLevel } = useSettings()

  const filesByPath = useMemo(() => {
    const map = new Map<string, DiffFileData>()
    for (const f of files) map.set(f.path.replace(/^\/+/, ""), f)
    return map
  }, [files])

  const ctx: CellCompletionContext = guideState.derived
  const mutators = {
    acknowledgeNote: guideState.acknowledgeNote,
    unacknowledgeNote: guideState.unacknowledgeNote,
    toggleChecklistItem: guideState.toggleChecklistItem,
  }

  const scrollRef = useRef<HTMLDivElement>(null)
  const [regenerationPreview, setRegenerationPreview] =
    useState<RegenerationPreview | null>(null)

  const isStreaming = streaming.status === "streaming"
  const hasNotebook = guideState.chapters.length > 0

  const handleStart = useCallback(
    async (additionalContext?: string) => streaming.start(additionalContext),
    [streaming],
  )

  const handleRequestRegenerate = useCallback(() => {
    setRegenerationPreview(guideState.prepareFullRegeneration())
  }, [guideState])

  const handleConfirmRegenerate = useCallback(async () => {
    setRegenerationPreview(null)
    await streaming.start()
  }, [streaming])

  const handleRegenerateChapter = useCallback(
    async (chapterId: string) => {
      const chapter = guideState.chapters.find((c) => c.chapter.id === chapterId)
      if (!chapter) return
      const outline = guideState.chapters.map((c) => c.chapter)
      await streaming.startChapter({
        chapterId,
        title: chapter.chapter.title,
        intent: chapter.chapter.intent,
        outlineContext: outline,
      })
    },
    [streaming, guideState.chapters],
  )

  // --- Notebook overall progress ---
  const notebookProgress = useMemo(() => {
    let total = 0
    let complete = 0
    for (const chapter of guideState.chapters) {
      const { total: t, complete: c } = chapterProgress(chapter, ctx)
      total += t
      complete += c
    }
    const completeChapters = guideState.chapters.filter(
      (c) => chapterProgress(c, ctx).total > 0 && chapterProgress(c, ctx).complete === chapterProgress(c, ctx).total,
    ).length
    return {
      cellsComplete: complete,
      cellsTotal: total,
      chaptersComplete: completeChapters,
      chaptersTotal: guideState.chapters.length,
    }
  }, [guideState.chapters, ctx])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-col gap-2 border-b bg-background px-4 py-3">
        <div className="flex items-center gap-2">
          <ActionTriggerWithContext
            label={hasNotebook ? "Regenerate Notebook" : "Generate Notebook"}
            loadingLabel="Generating Notebook..."
            ariaLabel="Generate notebook"
            isLoading={isStreaming}
            disabled={isStreaming}
            icon={AiGenerativeIcon}
            onRun={
              hasNotebook
                ? async () => {
                    handleRequestRegenerate()
                    return true
                  }
                : handleStart
            }
          />
          <ActionSettingsPopover
            actionKey="review-guide"
            models={models}
            currentModel={settings?.["review-guide"]?.model}
            currentVariant={settings?.["review-guide"]?.variant}
            currentThinkingLevel={settings?.["review-guide"]?.thinkingLevel}
            onModelChange={(model, variant) =>
              updateActionModel("review-guide", model, variant)
            }
            onThinkingLevelChange={(level) =>
              updateActionThinkingLevel("review-guide", level)
            }
          />
          {hasNotebook && (
            <div className="ml-auto flex items-center gap-3">
              <ProgressStepper
                chapters={guideState.chapters}
                ctx={ctx}
                scrollContainer={scrollRef}
              />
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {notebookProgress.chaptersComplete} of {notebookProgress.chaptersTotal}
              </span>
            </div>
          )}
        </div>
        {streaming.status !== "idle" && (
          <AIProgressPanel
            status={streaming.status}
            phase={streaming.phase}
            activities={streaming.activities}
            error={streaming.error}
            onCancel={streaming.cancel}
          />
        )}
        {streaming.status === "error" && streaming.error && (
          <div className="flex flex-col gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm">
            <span className="font-medium text-destructive">
              Notebook generation failed
            </span>
            <p className="text-xs text-muted-foreground">{streaming.error}</p>
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => handleStart()}
            >
              Try again
            </Button>
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        {hasNotebook && (
          <ChapterRail
            chapters={guideState.chapters}
            ctx={ctx}
            scrollContainer={scrollRef}
          />
        )}
        <div className="min-w-0 flex-1">
          <ScrollArea className="h-full">
            <div ref={scrollRef} className="flex flex-col gap-6 px-6 py-5">
              {!hasNotebook && streaming.status === "idle" && <NotebookEmptyState />}
              {guideState.overview && (
                <div data-slot="notebook-overview" className="flex flex-col gap-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Overview
                  </div>
                  <Markdown className="text-[15px] leading-relaxed [&_p]:my-1.5">
                    {guideState.overview}
                  </Markdown>
                </div>
              )}
              {guideState.chapters.map((chapter, index) => (
                <ChapterSection
                  key={chapter.chapter.id}
                  index={index}
                  total={guideState.chapters.length}
                  chapter={chapter}
                  filesByPath={filesByPath}
                  ctx={ctx}
                  mutators={mutators}
                  onRegenerate={handleRegenerateChapter}
                />
              ))}
              {guideState.orphans.length > 0 && (
                <NotebookOrphanArchive orphans={guideState.orphans} />
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      <RegenerateModal
        open={regenerationPreview !== null}
        onOpenChange={(open) => {
          if (!open) setRegenerationPreview(null)
        }}
        unresolvedDiscardedCount={
          regenerationPreview?.unresolvedDiscardedCount ?? 0
        }
        pinnedPreservedThreads={regenerationPreview?.pinnedPreservedThreads ?? []}
        onConfirm={handleConfirmRegenerate}
        isRegenerating={isStreaming}
      />
    </div>
  )
}

function NotebookEmptyState() {
  return (
    <div
      data-slot="notebook-empty"
      className="mx-auto mt-12 flex max-w-md flex-col items-center gap-3 rounded-md border border-dashed bg-card p-8 text-center"
    >
      <HugeiconsIcon
        icon={AiGenerativeIcon}
        className="size-10 text-primary"
        aria-hidden="true"
      />
      <h2 className="text-base font-semibold">Start a guided review</h2>
      <p className="text-sm text-muted-foreground">
        The Notebook synthesizes a chaptered narrative for this PR — overview,
        diff highlights, judgment threads, and per-chapter completion. Click
        <span className="px-1 font-medium text-foreground">Generate Notebook</span>
        above to begin.
      </p>
    </div>
  )
}

interface NotebookOrphanArchiveProps {
  orphans: { thread: { id: string; filePath: string; lineNumber: number; content: string } }[]
}

function NotebookOrphanArchive({ orphans }: NotebookOrphanArchiveProps) {
  return (
    <section
      data-slot="notebook-orphan-archive"
      className="flex flex-col gap-2 rounded-md border border-dashed bg-muted/30 p-4"
    >
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Orphaned threads
      </div>
      <p className="text-xs text-muted-foreground">
        These judgment threads were preserved across regeneration but their
        anchor lines are no longer present in the new notebook. They do not
        affect completion.
      </p>
      <ul className="flex flex-col gap-1 text-xs">
        {orphans.map((entry) => (
          <li key={entry.thread.id} className="rounded-md border bg-card p-2">
            <span className="font-mono text-[10px] text-muted-foreground">
              {entry.thread.filePath}:{entry.thread.lineNumber}
            </span>
            <p className="mt-1 line-clamp-2">{entry.thread.content}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

export const Notebook = { Root }
