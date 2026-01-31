import * as React from "react"
import { getStorageItem, setStorageItem } from "@/lib/storage"

export function usePersistedState<T>(
  key: string,
  defaultValue: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = React.useState<T>(() =>
    getStorageItem(key, defaultValue)
  )

  const setPersistedState = React.useCallback(
    (value: React.SetStateAction<T>) => {
      setState((prevState) => {
        const newState =
          typeof value === "function"
            ? (value as (prev: T) => T)(prevState)
            : value
        setStorageItem(key, newState)
        return newState
      })
    },
    [key]
  )

  return [state, setPersistedState]
}
