import { useState, useCallback, useRef } from "react"
import type { AnnotationSide } from "@pierre/diffs/react"

/**
 * Draft annotation for showing comment form.
 */
export interface DraftAnnotation {
  /** Unique identifier for the draft */
  id: string
  /** The file path the draft belongs to */
  filePath: string
  /** Which side of the diff the draft is on */
  side: AnnotationSide
  /** The line number of the draft */
  lineNumber: number
}

/**
 * Filters a draft out of the draft annotations array.
 * Used internally by both cancel and submit flows to keep the filter logic DRY.
 */
function filterOutDraft(filePath: string, side: AnnotationSide, lineNumber: number) {
  return (prev: DraftAnnotation[]) =>
    prev.filter(
      (d) =>
        !(d.filePath === filePath && d.side === side && d.lineNumber === lineNumber)
    )
}

interface UseDraftAnnotationsOptions {
  /** Callback invoked when a draft comment is submitted. */
  onCommentSubmit?: (
    filePath: string,
    lineNumber: number,
    side: AnnotationSide,
    content: string
  ) => Promise<void>
}

/**
 * Manages the draft annotation lifecycle: add, cancel, and submit.
 *
 * A "draft" is an in-progress comment form shown inline on a diff line.
 * This hook tracks which drafts are open, manages their submit/cancel flow,
 * and handles the async submission lifecycle (loading state, error handling).
 *
 * All returned callbacks have stable references.
 */
export function useDraftAnnotations({ onCommentSubmit }: UseDraftAnnotationsOptions) {
  const [draftAnnotations, setDraftAnnotations] = useState<DraftAnnotation[]>([])
  const [submittingDrafts, setSubmittingDrafts] = useState<Set<string>>(new Set())

  // Keep onCommentSubmit in a ref so submitDraft stays stable across renders
  const onCommentSubmitRef = useRef(onCommentSubmit)
  onCommentSubmitRef.current = onCommentSubmit

  const cancelDraft = useCallback(
    (filePath: string, side: AnnotationSide, lineNumber: number) => {
      setDraftAnnotations(filterOutDraft(filePath, side, lineNumber))
    },
    []
  )

  const addDraft = useCallback(
    (filePath: string, side: AnnotationSide, lineNumber: number) => {
      const id = `draft-${filePath}-${side}-${lineNumber}`
      setDraftAnnotations((prev) => {
        const exists = prev.some(
          (d) =>
            d.filePath === filePath && d.side === side && d.lineNumber === lineNumber
        )
        if (exists) return prev
        return [...prev, { id, filePath, side, lineNumber }]
      })
    },
    []
  )

  const submitDraft = useCallback(
    async (
      filePath: string,
      side: AnnotationSide,
      lineNumber: number,
      content: string
    ) => {
      const draftId = `draft-${filePath}-${side}-${lineNumber}`
      const submit = onCommentSubmitRef.current

      if (!submit) {
        // No submit handler — just remove the draft
        setDraftAnnotations(filterOutDraft(filePath, side, lineNumber))
        return
      }

      setSubmittingDrafts((prev) => new Set(prev).add(draftId))

      try {
        await submit(filePath, lineNumber, side, content)
        // Remove draft after successful submission
        setDraftAnnotations(filterOutDraft(filePath, side, lineNumber))
      } catch (error) {
        console.error("Failed to submit comment:", error)
      } finally {
        setSubmittingDrafts((prev) => {
          const next = new Set(prev)
          next.delete(draftId)
          return next
        })
      }
    },
    [] // stable — uses ref for onCommentSubmit; state setters are stable
  )

  return {
    /** Array of currently open draft annotations */
    draftAnnotations,
    /** Set of draft IDs currently being submitted */
    submittingDrafts,
    /** Add a new draft comment form at the given location */
    addDraft,
    /** Cancel (remove) a draft comment form without submitting */
    cancelDraft,
    /** Submit a draft comment; handles loading state and error logging */
    submitDraft,
  }
}
