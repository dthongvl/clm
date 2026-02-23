import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { refreshPR } from '@/api/pr'

export function useRefresh() {
  const queryClient = useQueryClient()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await refreshPR()
      await queryClient.invalidateQueries({
        queryKey: ['pr-info'],
      })
      await queryClient.invalidateQueries({
        queryKey: ['pr-diff'],
      })
      await queryClient.invalidateQueries({
        queryKey: ['pr-comments'],
      })
      await queryClient.invalidateQueries({
        queryKey: ['draft-comments'],
      })
      await queryClient.invalidateQueries({
        queryKey: ['pr-viewed-files'],
      })
    } catch (error) {
      console.error('Failed to refresh:', error)
    } finally {
      setIsRefreshing(false)
    }
  }, [queryClient])

  return { isRefreshing, handleRefresh }
}
