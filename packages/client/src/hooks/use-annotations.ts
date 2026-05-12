import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { useComments } from './use-comments'
import { useDraftComments } from './use-draft-comments'
import { useReviewGuideState } from './use-review-guide'
import { replyToComment, deleteCommentById, editCommentById } from '@/api/comments'
import type { ReviewComment, AIReviewItem } from '@/types/review'
import type { NotebookJudgmentThread } from '@/types/review-guide'
import type { NotebookJudgmentThreadOps } from '@/components/diff-panel/diff-viewer'

interface UseAnnotationsOptions {
  /** Full list of AI review items (unfiltered). Only needed for AI conversion. */
  aiReviewItems?: AIReviewItem[]
}

interface UseAnnotationsReturn {
  /** Unified annotation list for the diff viewer (comments + drafts) */
  annotations: ReviewComment[]

  /** AI review items filtered to exclude converted ones */
  visibleAIReviewItems: AIReviewItem[]

  /** Notebook judgment threads from the `['review-guide']` cache. */
  notebookJudgmentThreads: NotebookJudgmentThread[]

  /** Notebook thread operations (pin/resolve/reply). */
  notebookJudgmentThreadOps: NotebookJudgmentThreadOps

  /** Draft count for the submit button */
  draftCount: number

  /** Whether any annotation action is in progress */
  isActionLoading: boolean

  /** Set of AI item IDs currently being converted */
  convertingAIItemIds: Set<string>

  // --- Draft operations ---
  addDraft: (filePath: string, lineNumber: number, side: 'additions' | 'deletions', content: string) => Promise<void>
  editDraft: (commentId: string, content: string) => Promise<void>
  deleteDraft: (commentId: string) => Promise<void>

  // --- Submitted comment operations ---
  replyTo: (commentId: string, content: string) => Promise<void>
  editComment: (commentId: string, content: string) => Promise<void>
  deleteComment: (commentId: string) => Promise<void>

  // --- AI conversion ---
  convertAIToDraft: (itemId: string) => Promise<void>

  // --- Review submission ---
  submitReview: (event: 'COMMENT' | 'REQUEST_CHANGES' | 'APPROVE', body?: string) => Promise<void>

  // --- Loading states ---
  isCommentsLoading: boolean
  isDraftsLoading: boolean
}

/**
 * Unified annotation module — composes comments, draft comments,
 * AI-to-draft conversion, and notebook judgment threads behind a single
 * interface. Both File Changes and Notebook diff cells consume this hook so
 * line-anchored state stays consistent across surfaces.
 *
 * What sits behind the seam:
 * - Merging human comments with draft comments into one annotation list
 * - AI item conversion state machine (loading → converted tracking)
 * - Notebook judgment-thread cache reads + lifecycle operations
 * - Toast notifications for all operations
 * - TanStack Query cache invalidation
 */
export function useAnnotations({ aiReviewItems = [] }: UseAnnotationsOptions = {}): UseAnnotationsReturn {
  const queryClient = useQueryClient()

  // --- Data sources ---
  const { data: comments = [], isLoading: isCommentsLoading } = useComments()
  const {
    draftComments,
    isLoading: isDraftsLoading,
    addDraftComment,
    updateDraftComment,
    removeDraftComment,
    submitDraftReview,
    draftCount,
  } = useDraftComments()
  const notebook = useReviewGuideState()

  // --- Local state ---
  const [isActionLoading, setIsActionLoading] = useState(false)
  const [convertingAIItemIds, setConvertingAIItemIds] = useState<Set<string>>(new Set())
  const [convertedAIItemIds, setConvertedAIItemIds] = useState<Set<string>>(new Set())

  // --- Derived ---
  const annotations = useMemo(
    () => [...comments, ...draftComments],
    [comments, draftComments],
  )

  const visibleAIReviewItems = useMemo(
    () => aiReviewItems.filter((item) => !convertedAIItemIds.has(item.id)),
    [aiReviewItems, convertedAIItemIds],
  )

  // --- Draft operations ---
  const addDraft = useCallback(
    async (filePath: string, lineNumber: number, side: 'additions' | 'deletions', content: string) => {
      await addDraftComment(filePath, lineNumber, side, content)
    },
    [addDraftComment],
  )

  const editDraft = useCallback(
    async (commentId: string, content: string) => {
      setIsActionLoading(true)
      try {
        await updateDraftComment(commentId, content)
      } finally {
        setIsActionLoading(false)
      }
    },
    [updateDraftComment],
  )

  const deleteDraft = useCallback(
    async (commentId: string) => {
      setIsActionLoading(true)
      try {
        await removeDraftComment(commentId)
      } finally {
        setIsActionLoading(false)
      }
    },
    [removeDraftComment],
  )

  // --- Submitted comment operations ---
  const replyTo = useCallback(
    async (commentId: string, content: string) => {
      try {
        await replyToComment(commentId, content)
        await queryClient.invalidateQueries({ queryKey: ['pr-comments'] })
      } catch (error) {
        toast.error('Failed to reply', {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
        throw error
      }
    },
    [queryClient],
  )

  const editComment = useCallback(
    async (commentId: string, content: string) => {
      try {
        await editCommentById(commentId, content)
        await queryClient.invalidateQueries({ queryKey: ['pr-comments'] })
      } catch (error) {
        toast.error('Failed to edit comment', {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
        throw error
      }
    },
    [queryClient],
  )

  const deleteComment = useCallback(
    async (commentId: string) => {
      try {
        await deleteCommentById(commentId)
        await queryClient.invalidateQueries({ queryKey: ['pr-comments'] })
      } catch (error) {
        toast.error('Failed to delete comment', {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
        throw error
      }
    },
    [queryClient],
  )

  // --- AI conversion ---
  const convertAIToDraft = useCallback(
    async (itemId: string) => {
      const item = aiReviewItems.find((i) => i.id === itemId)
      if (!item) return

      const content = item.suggestion
        ? `${item.message}\n\n**Suggestion:** ${item.suggestion}`
        : item.message

      setConvertingAIItemIds((prev) => new Set(prev).add(itemId))

      try {
        await addDraftComment(item.filePath, item.lineNumber, 'additions', content)
        setConvertedAIItemIds((prev) => new Set(prev).add(itemId))
        toast.success('Added to draft review')
      } catch (error) {
        toast.error('Failed to add to draft', {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
      } finally {
        setConvertingAIItemIds((prev) => {
          const next = new Set(prev)
          next.delete(itemId)
          return next
        })
      }
    },
    [aiReviewItems, addDraftComment],
  )

  // --- Review submission ---
  const submitReview = useCallback(
    async (event: 'COMMENT' | 'REQUEST_CHANGES' | 'APPROVE', body?: string) => {
      try {
        await submitDraftReview(event, body)
        toast.success('Review submitted successfully')
        await queryClient.invalidateQueries({ queryKey: ['pr-comments'] })
      } catch (error) {
        toast.error('Failed to submit review', {
          description: error instanceof Error ? error.message : 'Unknown error',
        })
        throw error
      }
    },
    [submitDraftReview, queryClient],
  )

  // --- Notebook judgment thread operations ---
  const notebookJudgmentThreadOps = useMemo<NotebookJudgmentThreadOps>(
    () => ({
      pin: notebook.pinThread,
      unpin: notebook.unpinThread,
      resolve: notebook.resolveThread,
      unresolve: notebook.unresolveThread,
      reply: async (threadId, content) => {
        const reply: ReviewComment = {
          id: `${threadId}-reply-${Date.now()}`,
          filePath: '',
          lineNumber: 0,
          side: 'additions',
          content,
          author: { type: 'human', name: 'You' },
          createdAt: new Date(),
          replies: [],
        }
        // Re-anchor reply to the host thread's file/line so any future
        // surfacing of this reply outside the parent thread keeps anchor data.
        const host = notebook.threads.find((t) => t.id === threadId)
        if (host) {
          reply.filePath = host.filePath
          reply.lineNumber = host.lineNumber
          reply.side = host.side
        }
        notebook.replyToThread(threadId, reply)
      },
    }),
    [notebook],
  )

  return {
    annotations,
    visibleAIReviewItems,
    notebookJudgmentThreads: notebook.threads,
    notebookJudgmentThreadOps,
    draftCount,
    isActionLoading,
    convertingAIItemIds,
    addDraft,
    editDraft,
    deleteDraft,
    replyTo,
    editComment,
    deleteComment,
    convertAIToDraft,
    submitReview,
    isCommentsLoading,
    isDraftsLoading,
  }
}
