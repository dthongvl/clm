import { createContext, useContext } from "react"

export interface PRContextValue {
  prNumber: number
  repo: string
  isLoading: boolean
  error: Error | null
}

export const PRContext = createContext<PRContextValue | null>(null)

export function usePRContext(): PRContextValue {
  const ctx = useContext(PRContext)
  if (!ctx) {
    throw new Error("usePRContext must be used within PRContextProvider")
  }
  return ctx
}
