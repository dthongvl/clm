import { useMemo } from "react"
import { cn } from "@/lib/utils"
import type { JudgmentThread, ReviewGuide } from "@/types/review-guide"
import type { ReviewComment } from "@/types/review"
import { StepCard } from "./step-card"

const OVERVIEW_STEP_ID = "__overview__"

interface StepperProps {
  guide: ReviewGuide
  reviewedStepIds: string[]
  currentStepId: string | null
  threads: JudgmentThread[]
  isOffRoute: boolean
  onSetCurrentStep: (stepId: string) => void
  onMarkReviewed: (stepId: string) => void
  onUnmarkReviewed: (stepId: string) => void
  onFocusFileGroup: (filePaths: string[]) => void
  onFileClick: (filePath: string) => void
  onJudgmentLineClick: (filePath: string, lineNumber: number) => void
  onPinThread: (threadId: string) => void
  onUnpinThread: (threadId: string) => void
  onResolveThread: (threadId: string) => void
  onUnresolveThread: (threadId: string) => void
  onReplyToThread: (threadId: string, reply: ReviewComment) => void
}

/**
 * Renders Step 0 (overview) plus the ordered group steps. When the guide has
 * at most 1 substantive step (R16), collapses progression UI and surfaces a
 * "trivial change" note.
 */
function Stepper({
  guide,
  reviewedStepIds,
  currentStepId,
  threads,
  isOffRoute,
  onSetCurrentStep,
  onMarkReviewed,
  onUnmarkReviewed,
  onFocusFileGroup,
  onFileClick,
  onJudgmentLineClick,
  onPinThread,
  onUnpinThread,
  onResolveThread,
  onUnresolveThread,
  onReplyToThread,
}: StepperProps) {
  const reviewedSet = useMemo(() => new Set(reviewedStepIds), [reviewedStepIds])
  const totalSteps = guide.steps.length + 1 // +1 for the overview
  const reviewedCount =
    (reviewedSet.has(OVERVIEW_STEP_ID) ? 1 : 0) +
    guide.steps.reduce((acc, s) => acc + (reviewedSet.has(s.id) ? 1 : 0), 0)

  const isTrivial = guide.steps.length <= 1

  const threadsByFile = useMemo(() => {
    const map = new Map<string, JudgmentThread[]>()
    for (const thread of threads) {
      const existing = map.get(thread.filePath)
      if (existing) existing.push(thread)
      else map.set(thread.filePath, [thread])
    }
    return map
  }, [threads])

  const threadsForGroup = (fileGroup: string[]): JudgmentThread[] =>
    fileGroup.flatMap((f) => threadsByFile.get(f) ?? [])

  const overviewActive = currentStepId === OVERVIEW_STEP_ID
  const overviewReviewed = reviewedSet.has(OVERVIEW_STEP_ID)

  const handleToggleOverview = () => {
    if (overviewReviewed) onUnmarkReviewed(OVERVIEW_STEP_ID)
    else onMarkReviewed(OVERVIEW_STEP_ID)
  }

  return (
    <div data-slot="review-guide-stepper" className="flex flex-col gap-3">
      {!isTrivial && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Review Guide</span>
          <span aria-live="polite">
            {reviewedCount} / {totalSteps} reviewed
          </span>
        </div>
      )}
      {isTrivial && (
        <p className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Small change: this PR is structurally trivial — read the overview, then
          review the single step below.
        </p>
      )}

      <StepCard
        index={0}
        total={totalSteps - 1}
        isOverview
        title="PR Overview"
        overviewBody={guide.overview}
        reviewed={overviewReviewed}
        active={overviewActive}
        onToggleReviewed={handleToggleOverview}
        onActivate={() => onSetCurrentStep(OVERVIEW_STEP_ID)}
      />

      {guide.steps.map((step, idx) => {
        const active = currentStepId === step.id
        const reviewed = reviewedSet.has(step.id)
        return (
          <StepCard
            key={step.id}
            index={idx + 1}
            total={guide.steps.length}
            title={step.title}
            rationale={step.rationale}
            lookFor={step.lookFor}
            fileGroup={step.fileGroup}
            reviewed={reviewed}
            active={active}
            isOffRoute={active && isOffRoute}
            threads={threadsForGroup(step.fileGroup)}
            onActivate={() => {
              onSetCurrentStep(step.id)
              if (step.fileGroup.length > 0) onFocusFileGroup(step.fileGroup)
            }}
            onToggleReviewed={() =>
              reviewed ? onUnmarkReviewed(step.id) : onMarkReviewed(step.id)
            }
            onReturnToRoute={() => onFocusFileGroup(step.fileGroup)}
            onFileClick={onFileClick}
            onPinThread={onPinThread}
            onUnpinThread={onUnpinThread}
            onResolveThread={onResolveThread}
            onUnresolveThread={onUnresolveThread}
            onReplyToThread={onReplyToThread}
            onJudgmentLineClick={onJudgmentLineClick}
          />
        )
      })}

      {/* Orphan threads — anchored to files outside any step's group. */}
      {(() => {
        const allStepFiles = new Set(
          guide.steps.flatMap((s) => s.fileGroup)
        )
        const orphaned = threads.filter((t) => !allStepFiles.has(t.filePath))
        if (orphaned.length === 0) return null
        return (
          <div className={cn("flex flex-col gap-2 pt-1")}>
            <span className="text-xs font-medium text-muted-foreground">
              Other judgment threads
            </span>
            <StepCard
              index={0}
              total={0}
              title="Unanchored"
              reviewed={false}
              active={false}
              threads={orphaned}
              onToggleReviewed={() => {}}
              onActivate={() => {}}
              onPinThread={onPinThread}
              onUnpinThread={onUnpinThread}
              onResolveThread={onResolveThread}
              onUnresolveThread={onUnresolveThread}
              onReplyToThread={onReplyToThread}
              onJudgmentLineClick={onJudgmentLineClick}
            />
          </div>
        )
      })()}
    </div>
  )
}

export { Stepper, OVERVIEW_STEP_ID }
