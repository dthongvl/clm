import { useMemo } from "react"

interface PRParams {
  prNumber: number | undefined
  repo: string | undefined
}

export function usePRParams(): PRParams {
  return useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    const prNumber = params.get("pr")
    const repo = params.get("repo") || undefined
    return {
      prNumber: prNumber ? parseInt(prNumber, 10) : undefined,
      repo,
    }
  }, [])
}
