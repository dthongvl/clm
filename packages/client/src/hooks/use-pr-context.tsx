import { useEffect, useState, type ReactNode } from "react"
import { PRContext } from "./pr-context"

export function PRContextProvider({ children }: { children: ReactNode }) {
  const [prNumber, setPrNumber] = useState<number>(0)
  const [repo, setRepo] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    fetch("/api/context")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch app context")
        return res.json()
      })
      .then((data: { prNumber: number; repo: string }) => {
        setPrNumber(data.prNumber)
        setRepo(data.repo)
      })
      .catch((err) => setError(err instanceof Error ? err : new Error(String(err))))
      .finally(() => setIsLoading(false))
  }, [])

  return (
    <PRContext.Provider value={{ prNumber, repo, isLoading, error }}>
      {children}
    </PRContext.Provider>
  )
}
