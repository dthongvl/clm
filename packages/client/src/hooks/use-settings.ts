import { useState, useEffect, useCallback } from 'react'
import { fetchSettings, updateSettings as updateSettingsApi } from '@/lib/api'
import type { Settings, ActionKey } from '@/types/settings'

interface UseSettingsReturn {
  settings: Settings | null
  isLoading: boolean
  error: Error | null
  updateActionModel: (action: ActionKey, model: string, variant?: string) => Promise<void>
}

export function useSettings(): UseSettingsReturn {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false

    fetchSettings()
      .then((data) => {
        if (!cancelled) setSettings(data)
      })
      .catch((err) => {
        console.error('Failed to fetch settings:', err)
        if (!cancelled) setError(err instanceof Error ? err : new Error('Failed to fetch settings'))
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  const updateActionModel = useCallback(async (action: ActionKey, model: string, variant?: string) => {
    // Optimistic update
    setSettings((prev) => {
      if (!prev) return prev
      return { ...prev, [action]: { ...prev[action], model, variant } }
    })

    try {
      const updated = await updateSettingsApi({ [action]: { model, variant } })
      setSettings(updated)
    } catch (err) {
      console.error('Failed to update settings:', err)
      // Revert on failure
      const reverted = await fetchSettings()
      setSettings(reverted)
    }
  }, [])

  return { settings, isLoading, error, updateActionModel }
}
