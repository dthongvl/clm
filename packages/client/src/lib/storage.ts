const STORAGE_PREFIX = "clm:"
const STORAGE_VERSION = 1

interface StorageWrapper<T> {
  v: number
  data: T
}

export function getStorageItem<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback

  try {
    const item = localStorage.getItem(`${STORAGE_PREFIX}${key}`)
    if (item === null) return fallback
    const parsed = JSON.parse(item) as unknown
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "v" in parsed &&
      "data" in parsed &&
      (parsed as StorageWrapper<T>).v === STORAGE_VERSION
    ) {
      return (parsed as StorageWrapper<T>).data
    }
    // Legacy or version mismatch — remove stale entry
    localStorage.removeItem(`${STORAGE_PREFIX}${key}`)
    return fallback
  } catch {
    return fallback
  }
}

export function setStorageItem<T>(key: string, value: T): void {
  if (typeof window === "undefined") return

  try {
    const wrapper: StorageWrapper<T> = { v: STORAGE_VERSION, data: value }
    localStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(wrapper))
  } catch {
    // Storage quota exceeded or other error - silently fail
  }
}

export function removeStorageItem(key: string): void {
  if (typeof window === "undefined") return

  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${key}`)
  } catch {
    // Silently fail
  }
}

export const StorageKeys = {
  SIDE_PANEL_TAB: "side-panel-tab",
  DIFF_VIEW_MODE: "diff-view-mode",
  LEFT_SIDEBAR_OPEN: "left-sidebar-open",
  RIGHT_SIDEBAR_OPEN: "right-sidebar-open",
} as const
