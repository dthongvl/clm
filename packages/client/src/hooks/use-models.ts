import { useState, useEffect } from 'react'
import { fetchModels } from '@/lib/api'
import type { ModelOption } from '@/types/settings'

interface UseModelsReturn {
  models: ModelOption[]
  isLoading: boolean
  error: Error | null
}

export function useModels(): UseModelsReturn {
  const [models, setModels] = useState<ModelOption[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false

    fetchModels()
      .then((data) => {
        if (!cancelled) setModels(data)
      })
      .catch((err) => {
        console.error('Failed to fetch models:', err)
        if (!cancelled) setError(err instanceof Error ? err : new Error('Failed to fetch models'))
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  return { models, isLoading, error }
}
