import { useState, useEffect } from 'react'
import { fetchModels } from '@/lib/api'
import type { ModelOption } from '@/types/settings'

interface UseModelsReturn {
  models: ModelOption[]
  isLoading: boolean
}

export function useModels(): UseModelsReturn {
  const [models, setModels] = useState<ModelOption[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    fetchModels()
      .then((data) => {
        if (!cancelled) setModels(data)
      })
      .catch((err) => {
        console.error('Failed to fetch models:', err)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  return { models, isLoading }
}
