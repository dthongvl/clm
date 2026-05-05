import { useMemo, type ReactNode } from "react"
import { WorkerPoolContextProvider } from "@pierre/diffs/react"
// Vite worker import: produces a constructor that spawns the bundled worker.
// See: https://vite.dev/guide/features.html#web-workers
import DiffsWorker from "@pierre/diffs/worker/worker.js?worker"

/**
 * Provides a shared `@pierre/diffs` Web Worker pool to the React tree.
 *
 * Why:
 * - Syntax highlighting (Shiki) and AST construction are CPU-heavy. Doing it
 *   on the main thread blocks scrolling, layout, and React rendering.
 * - The worker pool offloads that work to background threads and keeps an
 *   LRU cache of rendered file/diff ASTs that is shared across every
 *   `MultiFileDiff` / `FileDiff` / `File` instance.
 * - Both light/dark themes are pre-loaded so theme toggles don't trigger a
 *   re-tokenization round trip on the main thread.
 *
 * Pool size:
 * - Default in the library is 8. We cap at `navigator.hardwareConcurrency`
 *   (minus one for the main thread) and clamp to a sensible range so we
 *   don't oversubscribe on very high-core machines.
 */
const DEFAULT_POOL_SIZE = 4

function pickPoolSize(): number {
  if (typeof navigator === "undefined") return DEFAULT_POOL_SIZE
  const hw = navigator.hardwareConcurrency ?? DEFAULT_POOL_SIZE
  return Math.min(8, Math.max(2, hw - 1))
}

export interface DiffsWorkerPoolProviderProps {
  children: ReactNode
}

export function DiffsWorkerPoolProvider({ children }: DiffsWorkerPoolProviderProps) {
  const poolOptions = useMemo(
    () => ({
      workerFactory: () => new DiffsWorker(),
      poolSize: pickPoolSize(),
    }),
    [],
  )

  const highlighterOptions = useMemo(
    () => ({
      // Pre-load both themes so toggling light/dark stays on the worker.
      theme: { dark: "pierre-dark", light: "pierre-light" } as const,
      // Match the per-card setting in `file-diff-card.tsx` so the worker
      // produces results compatible with how cards render.
      lineDiffType: "word" as const,
    }),
    [],
  )

  return (
    <WorkerPoolContextProvider
      poolOptions={poolOptions}
      highlighterOptions={highlighterOptions}
    >
      {children}
    </WorkerPoolContextProvider>
  )
}
