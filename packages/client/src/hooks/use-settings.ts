import { useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchSettings, updateSettings as updateSettingsApi } from '@/api/settings'
import type { Settings, ActionKey, ThinkingLevel } from '@/types/settings'

interface UseSettingsReturn {
  settings: Settings | null
  isLoading: boolean
  error: Error | null
  updateActionModel: (action: ActionKey, model: string, variant?: string) => Promise<void>
  updateActionThinkingLevel: (action: ActionKey, thinkingLevel: ThinkingLevel | undefined) => Promise<void>
}

export function useSettings(): UseSettingsReturn {
  const queryClient = useQueryClient()

  const { data, isLoading, error } = useQuery({
    queryKey: ['settings'],
    queryFn: () => fetchSettings(),
  })

  const updateActionModel = useCallback(async (action: ActionKey, model: string, variant?: string) => {
    // Optimistic update
    queryClient.setQueryData<Settings>(['settings'], (prev) => {
      if (!prev) return prev
      return { ...prev, [action]: { ...prev[action], model, variant } }
    })

    try {
      const updated = await updateSettingsApi({ [action]: { model, variant } })
      queryClient.setQueryData(['settings'], updated)
    } catch (err) {
      console.error('Failed to update settings:', err)
      // Revert by refetching
      await queryClient.invalidateQueries({ queryKey: ['settings'] })
    }
  }, [queryClient])

  const updateActionThinkingLevel = useCallback(
    async (action: ActionKey, thinkingLevel: ThinkingLevel | undefined) => {
      // Optimistic update
      queryClient.setQueryData<Settings>(['settings'], (prev) => {
        if (!prev) return prev
        return { ...prev, [action]: { ...prev[action], thinkingLevel } }
      })

      try {
        const updated = await updateSettingsApi({ [action]: { thinkingLevel } })
        queryClient.setQueryData(['settings'], updated)
      } catch (err) {
        console.error('Failed to update settings:', err)
        await queryClient.invalidateQueries({ queryKey: ['settings'] })
      }
    },
    [queryClient],
  )

  return {
    settings: data ?? null,
    isLoading,
    error: error ?? null,
    updateActionModel,
    updateActionThinkingLevel,
  }
}
