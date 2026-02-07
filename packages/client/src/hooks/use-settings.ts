import { useState, useEffect, useCallback } from 'react'
import { fetchSettings, updateSettings as updateSettingsApi } from '@/lib/api'
import type { Settings, ActionKey } from '@/types/settings'

interface UseSettingsReturn {
  settings: Settings | null
  isLoading: boolean
  updateActionModel: (action: ActionKey, model: string) => Promise<void>
}

export function useSettings(): UseSettingsReturn {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    fetchSettings()
      .then((data) => {
        if (!cancelled) setSettings(data)
      })
      .catch((err) => {
        console.error('Failed to fetch settings:', err)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  const updateActionModel = useCallback(async (action: ActionKey, model: string) => {
    // Optimistic update
    setSettings((prev) => {
      if (!prev) return prev
      return { ...prev, [action]: { ...prev[action], model } }
    })

    try {
      const updated = await updateSettingsApi({ [action]: { model } })
      setSettings(updated)
    } catch (err) {
      console.error('Failed to update settings:', err)
      // Revert on failure
      const reverted = await fetchSettings()
      setSettings(reverted)
    }
  }, [])

  return { settings, isLoading, updateActionModel }
}
