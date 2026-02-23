import { useQuery } from '@tanstack/react-query'
import { fetchModels } from '@/api/settings'
import type { ModelOption } from '@/types/settings'

interface UseModelsReturn {
  models: ModelOption[]
  isLoading: boolean
  error: Error | null
}

export function useModels(): UseModelsReturn {
  const { data, isLoading, error } = useQuery({
    queryKey: ['models'],
    queryFn: () => fetchModels(),
  })

  return {
    models: data ?? [],
    isLoading,
    error: error ?? null,
  }
}
