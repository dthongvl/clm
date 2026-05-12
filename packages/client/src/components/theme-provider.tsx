/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchSettings, updateSettings } from "@/api/settings"
import type { Settings, Theme } from "@/types/settings"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  /**
   * Optional localStorage key used purely as a first-paint cache to avoid
   * a flash of the wrong theme. The source of truth is the server-side
   * settings file (~/.config/clm/settings.toml), since localStorage is
   * scoped per origin and the dev/CLI server uses a random port.
   */
  cacheKey?: string
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeProviderContext = createContext<ThemeProviderState | null>(null)

function readCachedTheme(cacheKey: string, fallback: Theme): Theme {
  if (typeof window === "undefined") return fallback
  const raw = window.localStorage.getItem(cacheKey)
  if (raw === "light" || raw === "dark" || raw === "system") return raw
  return fallback
}

function writeCachedTheme(cacheKey: string, theme: Theme): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(cacheKey, theme)
  } catch {
    // ignore quota / privacy mode errors
  }
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  cacheKey = "clm-ui-theme",
}: ThemeProviderProps) {
  const queryClient = useQueryClient()
  const [theme, setThemeState] = useState<Theme>(() =>
    readCachedTheme(cacheKey, defaultTheme),
  )
  const hasUserOverride = useRef(false)

  // Load persisted theme from the server settings file.
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: () => fetchSettings(),
  })

  // When server settings arrive, adopt the persisted theme unless the user
  // already changed it locally during this session.
  useEffect(() => {
    if (hasUserOverride.current) return
    const serverTheme = data?.theme
    if (!serverTheme) return
    if (serverTheme === theme) return
    setThemeState(serverTheme)
    writeCachedTheme(cacheKey, serverTheme)
  }, [data?.theme, cacheKey, theme])

  // Apply the active theme to <html>.
  useEffect(() => {
    const root = window.document.documentElement

    const applyTheme = (t: Theme) => {
      root.classList.remove("light", "dark")
      if (t === "system") {
        const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
          .matches
          ? "dark"
          : "light"
        root.classList.add(systemTheme)
      } else {
        root.classList.add(t)
      }
    }

    applyTheme(theme)

    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
      const handleChange = () => applyTheme("system")
      mediaQuery.addEventListener("change", handleChange)
      return () => mediaQuery.removeEventListener("change", handleChange)
    }
  }, [theme])

  const value: ThemeProviderState = {
    theme,
    setTheme: (next: Theme) => {
      hasUserOverride.current = true
      setThemeState(next)
      writeCachedTheme(cacheKey, next)

      // Optimistically update the cached settings query so other consumers
      // (e.g. useSettings) see the new theme immediately.
      queryClient.setQueryData<Settings>(["settings"], (prev) => ({
        ...(prev ?? {}),
        theme: next,
      }))

      void updateSettings({ theme: next })
        .then((updated) => {
          queryClient.setQueryData(["settings"], updated)
        })
        .catch((err) => {
          console.error("Failed to persist theme:", err)
          void queryClient.invalidateQueries({ queryKey: ["settings"] })
        })
    },
  }

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext)

  if (context === null)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
}
