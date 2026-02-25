import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { useDraftComments } from './use-draft-comments'
import { replyToComment, deleteCommentById, editCommentById } from '@/api/comments'

export function useDraftActions() {
  const queryClient = useQueryClient()
  const {
    draftComments,
    addDraftComment,
    updateDraftComment,
    removeDraftComment,
    submitDraftReview: handleSubmitDraftReview,
    draftCount,
  } = useDraftComments()

  const [isDraftActionLoading, setIsDraftActionLoading] = useState(false)

  const handleCommentSubmit = useCallback(
    async (
      filePath: string,
      lineNumber: number,
      side: "additions" | "deletions",
      content: string
    ) => {
      await addDraftComment(filePath, lineNumber, side, content)
    },
    [addDraftComment]
  )

  const handleEditDraft = useCallback(async (commentId: string, content: string) => {
    setIsDraftActionLoading(true)
    try {
      await updateDraftComment(commentId, content)
    } finally {
      setIsDraftActionLoading(false)
    }
  }, [updateDraftComment])

  const handleDeleteDraft = useCallback(async (commentId: string) => {
    setIsDraftActionLoading(true)
    try {
      await removeDraftComment(commentId)
    } finally {
      setIsDraftActionLoading(false)
    }
  }, [removeDraftComment])

  const handleSubmitReview = useCallback(async (
    event: 'COMMENT' | 'REQUEST_CHANGES' | 'APPROVE',
    body?: string
  ) => {
    try {
      await handleSubmitDraftReview(event, body)
      toast.success("Review submitted successfully")
      await queryClient.invalidateQueries({ queryKey: ['pr-comments'] })
    } catch (error) {
      toast.error("Failed to submit review", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
      throw error
    }
  }, [handleSubmitDraftReview, queryClient])

  const handleEditReply = useCallback(async (commentId: string, content: string) => {
    try {
      await editCommentById(commentId, content)
      await queryClient.invalidateQueries({ queryKey: ['pr-comments'] })
    } catch (error) {
      toast.error("Failed to edit comment", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
      throw error
    }
  }, [queryClient])

  const handleDeleteReply = useCallback(async (commentId: string) => {
    try {
      await deleteCommentById(commentId)
      await queryClient.invalidateQueries({ queryKey: ['pr-comments'] })
    } catch (error) {
      toast.error("Failed to delete comment", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
      throw error
    }
  }, [queryClient])

  const handleReplySubmit = useCallback(async (commentId: string, content: string) => {
    try {
      await replyToComment(commentId, content)
      await queryClient.invalidateQueries({ queryKey: ['pr-comments'] })
    } catch (error) {
      toast.error("Failed to reply", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
      throw error
    }
  }, [queryClient])

  return {
    draftComments,
    draftCount,
    isDraftActionLoading,
    addDraftComment,
    handleCommentSubmit,
    handleEditDraft,
    handleDeleteDraft,
    handleSubmitReview,
    handleReplySubmit,
    handleEditReply,
    handleDeleteReply,
  }
}
