import { useMemo, useState, useSyncExternalStore } from "react"
import type { DiffFileData } from "@/types/diff"
import { useAnnotations } from "@/hooks"
import { useTheme } from "@/components/theme-provider"
import { FileDiffCard } from "@/components/diff-panel/file-diff-card"
import { useDraftAnnotations } from "@/components/diff-panel/use-draft-annotations"
import type { DiffLineAnnotation } from "@pierre/diffs/react"
import type { AnnotationMetadata } from "@/components/diff-panel/diff-viewer"

interface NotebookDiffCellRendererProps {
  file: DiffFileData
}

const getMediaQuery = () =>
  typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)") : null

const subscribeSystemTheme = (cb: () => void) => {
  const mq = getMediaQuery()
  if (!mq) return () => {}
  mq.addEventListener("change", cb)
  return () => mq.removeEventListener("change", cb)
}

const getSystemThemeSnapshot = (): "dark" | "light" =>
  getMediaQuery()?.matches ? "dark" : "light"

/**
 * Renders a one-file diff cell within a Notebook chapter using the same
 * `FileDiffCard` chrome as the File Changes tab. Shares draft/comment/AI/
 * judgment-thread annotations through the shared `useAnnotations` seam, so a
 * draft started here appears in File Changes and vice versa.
 */
export function NotebookDiffCellRenderer({ file }: NotebookDiffCellRendererProps) {
  const { theme } = useTheme()
  const systemTheme = useSyncExternalStore(subscribeSystemTheme, getSystemThemeSnapshot)
  const resolvedTheme = theme === "system" ? systemTheme : theme

  const {
    annotations,
    notebookJudgmentThreads,
    notebookJudgmentThreadOps,
    isActionLoading,
    addDraft,
    editDraft,
    deleteDraft,
    replyTo,
    editComment,
    deleteComment,
  } = useAnnotations()

  const {
    draftAnnotations,
    submittingDrafts,
    addDraft: addLocalDraft,
    cancelDraft,
    submitDraft,
  } = useDraftAnnotations({
    onCommentSubmit: async (filePath, lineNumber, side, content) => {
      await addDraft(filePath, lineNumber, side, content)
    },
  })

  const [submittingReplies, setSubmittingReplies] = useState<Set<string>>(new Set())

  const lineAnnotations = useMemo<DiffLineAnnotation<AnnotationMetadata>[]>(() => {
    const filePath = file.path.replace(/^\/+/, "")
    const out: DiffLineAnnotation<AnnotationMetadata>[] = []

    for (const c of annotations) {
      if (c.filePath.replace(/^\/+/, "") !== filePath) continue
      out.push({
        side: c.side,
        lineNumber: c.lineNumber,
        metadata: { type: "comment", comment: c },
      })
    }
    for (const d of draftAnnotations) {
      if (d.filePath.replace(/^\/+/, "") !== filePath) continue
      out.push({
        side: d.side,
        lineNumber: d.lineNumber,
        metadata: { type: "draft", draft: d },
      })
    }
    for (const t of notebookJudgmentThreads) {
      if (t.filePath.replace(/^\/+/, "") !== filePath) continue
      out.push({
        side: t.side,
        lineNumber: t.lineNumber,
        metadata: { type: "notebook-judgment-thread", thread: t },
      })
    }
    return out
  }, [file.path, annotations, draftAnnotations, notebookJudgmentThreads])

  const submitReply = async (commentId: string, content: string) => {
    setSubmittingReplies((prev) => new Set(prev).add(commentId))
    try {
      await replyTo(commentId, content)
    } finally {
      setSubmittingReplies((prev) => {
        const next = new Set(prev)
        next.delete(commentId)
        return next
      })
    }
  }

  // Diff cells default to collapsed (just the file header) so chapter reading
  // stays compact. Clicking the file header toggles between collapsed and
  // expanded.
  const [isCollapsedLocal, setIsCollapsedLocal] = useState<boolean>(true)

  return (
    <FileDiffCard
      file={file}
      lineAnnotations={lineAnnotations}
      isCollapsed={isCollapsedLocal}
      isViewed={false}
      resolvedTheme={resolvedTheme}
      hasOpenCommentForm={draftAnnotations.length > 0}
      submittingDrafts={submittingDrafts}
      submittingReplies={submittingReplies}
      onToggleCollapse={() => setIsCollapsedLocal((v) => !v)}
      onToggleViewed={() => {}}
      onAddDraft={addLocalDraft}
      onSubmitDraft={submitDraft}
      onCancelDraft={cancelDraft}
      onSubmitReply={submitReply}
      onEditDraft={editDraft}
      onDeleteDraft={deleteDraft}
      onEditReply={editComment}
      onDeleteReply={deleteComment}
      isDraftActionLoading={isActionLoading}
      notebookJudgmentThreadOps={notebookJudgmentThreadOps}
    />
  )
}
