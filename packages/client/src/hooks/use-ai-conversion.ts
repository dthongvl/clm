import { useState, useMemo, useCallback } from 'react'
import { toast } from 'sonner'
import type { AIReviewItem } from '@/types/review'

export function useAIConversion(
  aiReviewItems: AIReviewItem[],
  addDraftComment: (
    filePath: string,
    lineNumber: number,
    side: 'additions' | 'deletions',
    content: string
  ) => Promise<void>,
) {
  const [convertingAIItemIds, setConvertingAIItemIds] = useState<Set<string>>(new Set())
  const [convertedAIItemIds, setConvertedAIItemIds] = useState<Set<string>>(new Set())

  const visibleAIReviewItems = useMemo(
    () => aiReviewItems.filter((item) => !convertedAIItemIds.has(item.id)),
    [aiReviewItems, convertedAIItemIds]
  )

  const handleConvertAIToDraft = useCallback(async (itemId: string) => {
    const item = aiReviewItems.find((i) => i.id === itemId)
    if (!item) return

    const content = item.suggestion
      ? `${item.message}\n\n**Suggestion:** ${item.suggestion}`
      : item.message

    setConvertingAIItemIds((prev) => new Set(prev).add(itemId))

    try {
      await addDraftComment(item.filePath, item.lineNumber, "additions", content)
      setConvertedAIItemIds((prev) => new Set(prev).add(itemId))
      toast.success("Added to draft review")
    } catch (error) {
      toast.error("Failed to add to draft", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    } finally {
      setConvertingAIItemIds((prev) => {
        const next = new Set(prev)
        next.delete(itemId)
        return next
      })
    }
  }, [aiReviewItems, addDraftComment])

  return {
    visibleAIReviewItems,
    convertingAIItemIds,
    handleConvertAIToDraft,
  }
}
