# Fix Verified Code Review Issues (CR-003 through CR-012)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 8 confirmed code quality issues spanning refresh orchestration, error UX, type architecture, render performance, theme behavior, and lint compliance.

**Architecture:** Work bottom-up — start with the shared type extraction (CR-005) since other tasks depend on `DiffFileData`. Then fix independent hooks (CR-003, CR-004), then component-level issues (CR-006, CR-007, CR-008, CR-011), and finally lint cleanup (CR-012) which touches many files.

**Tech Stack:** React 19, TanStack Query, sonner (toast), CSS `content-visibility`, ESLint react-refresh plugin

---

### Task 1: CR-005 — Move `DiffFileData` out of UI layer into `types/`

**Why:** `DiffFileData` is a domain type defined in the UI component `diff-viewer.tsx`. Hooks (`use-diff.ts`) and lib (`transforms.ts`) import it from the UI layer, creating an inverted dependency.

**Files:**
- Modify: `packages/client/src/types/diff.ts` — add `DiffFileData` interface
- Modify: `packages/client/src/components/diff-panel/diff-viewer.tsx` — remove `DiffFileData` definition, import from `@/types/diff`
- Modify: `packages/client/src/components/diff-panel/index.tsx` — re-export `DiffFileData` from `@/types/diff` instead of `./diff-viewer`
- Modify: `packages/client/src/hooks/use-diff.ts` — import from `@/types/diff` instead of `@/components/diff-panel`
- Modify: `packages/client/src/lib/transforms.ts` — import from `@/types/diff` instead of `@/components/diff-panel`

**Step 1: Add `DiffFileData` to `types/diff.ts`**

Append to the end of `packages/client/src/types/diff.ts`:

```ts
/**
 * Data structure representing a file diff with full content.
 * Used by the diff viewer and data-fetching hooks.
 */
export interface DiffFileData {
  /** The file path */
  path: string
  /** The old file path (for renamed files) */
  oldPath?: string
  /** The status of the file change */
  status: 'added' | 'modified' | 'deleted' | 'renamed'
  /** Number of lines added */
  additions: number
  /** Number of lines deleted */
  deletions: number
  /** The old file content */
  oldContent: string
  /** The new file content */
  newContent: string
}
```

**Step 2: Update `diff-viewer.tsx` — remove definition, add import**

At the top of `packages/client/src/components/diff-panel/diff-viewer.tsx`:
- Add `import type { DiffFileData } from "@/types/diff"` alongside existing imports.
- Remove the entire `export interface DiffFileData { ... }` block (lines 22–37) and its JSDoc comment (lines 19–21).
- Keep the re-export so internal consumers of `diff-viewer` still work. Add below the other imports:

```ts
export type { DiffFileData } from "@/types/diff"
```

**Step 3: Update `diff-panel/index.tsx` barrel**

In `packages/client/src/components/diff-panel/index.tsx`, change line 10 from:
```ts
export type { DiffViewerProps, DiffViewerProps as DiffPanelViewerProps, DiffFileData, DraftAnnotation } from "./diff-viewer"
```
to:
```ts
export type { DiffViewerProps, DiffViewerProps as DiffPanelViewerProps, DraftAnnotation } from "./diff-viewer"
export type { DiffFileData } from "@/types/diff"
```

**Step 4: Update `use-diff.ts` import**

In `packages/client/src/hooks/use-diff.ts`, change line 2:
```ts
import type { DiffFileData } from '@/components/diff-panel';
```
to:
```ts
import type { DiffFileData } from '@/types/diff';
```

**Step 5: Update `transforms.ts` import**

In `packages/client/src/lib/transforms.ts`, change line 4:
```ts
import type { DiffFileData } from '@/components/diff-panel';
```
to:
```ts
import type { DiffFileData } from '@/types/diff';
```

**Step 6: Verify**

Run: `pnpm --filter @codereview/client build`
Expected: Build succeeds with zero errors.

**Step 7: Commit**

```bash
git add packages/client/src/types/diff.ts packages/client/src/components/diff-panel/diff-viewer.tsx packages/client/src/components/diff-panel/index.tsx packages/client/src/hooks/use-diff.ts packages/client/src/lib/transforms.ts
git commit -m "refactor: move DiffFileData from UI layer to types/diff (CR-005)"
```

---

### Task 2: CR-003 — Fix refresh orchestration to await all refetches

**Why:** In `App.tsx:45`, after `await refreshPR()`, four `refetch*()` calls are fire-and-forget. `setIsRefreshing(false)` runs before data is actually updated, making the button misleading.

**Files:**
- Modify: `packages/client/src/App.tsx:45-57`

**Step 1: Await all refetches with `Promise.all`**

In `packages/client/src/App.tsx`, replace lines 45–57:

```ts
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await refreshPR()
      refetchPR()
      refetchDiff()
      refetchComments()
      refetchDraftComments()
    } catch (error) {
      console.error('Failed to refresh:', error)
    } finally {
      setIsRefreshing(false)
    }
  }, [refetchPR, refetchDiff, refetchComments, refetchDraftComments])
```

with:

```ts
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await refreshPR()
      await Promise.all([
        refetchPR(),
        refetchDiff(),
        refetchComments(),
        refetchDraftComments(),
      ])
    } catch (error) {
      console.error('Failed to refresh:', error)
    } finally {
      setIsRefreshing(false)
    }
  }, [refetchPR, refetchDiff, refetchComments, refetchDraftComments])
```

**Step 2: Verify**

Run: `pnpm --filter @codereview/client build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add packages/client/src/App.tsx
git commit -m "fix: await all refetches in refresh handler (CR-003)"
```

---

### Task 3: CR-004 — Expose settings/models errors with sonner toast UX

**Why:** `useSettings` and `useModels` swallow fetch errors into `console.error` with no user-visible feedback. Users have no idea something failed and no way to retry.

Sonner is already installed (`sonner@^2.0.7`), the `<Toaster>` is already mounted in `main.tsx`, so we just need to call `toast.error()`.

**Files:**
- Modify: `packages/client/src/hooks/use-settings.ts` — add `error` state, expose it in return
- Modify: `packages/client/src/hooks/use-models.ts` — add `error` state, expose it in return
- Modify: `packages/client/src/App.tsx` — destructure errors, show toast via `useEffect`

**Step 1: Add error state to `useSettings`**

In `packages/client/src/hooks/use-settings.ts`:

1. Add `error` to the interface (line 8, insert before `updateActionModel`):
```ts
  error: Error | null
```

2. Add state declaration after `isLoading` state (after line 13):
```ts
  const [error, setError] = useState<Error | null>(null)
```

3. Update the `.catch` block (line 22–24) to also set error state:
```ts
      .catch((err) => {
        console.error('Failed to fetch settings:', err)
        if (!cancelled) setError(err instanceof Error ? err : new Error('Failed to fetch settings'))
      })
```

4. Update the return (line 50) to include `error`:
```ts
  return { settings, isLoading, error, updateActionModel }
```

**Step 2: Add error state to `useModels`**

In `packages/client/src/hooks/use-models.ts`:

1. Add `error` to the interface (line 8, insert before closing brace):
```ts
  error: Error | null
```

2. Add state declaration after `isLoading` state (after line 12):
```ts
  const [error, setError] = useState<Error | null>(null)

```

3. Update the `.catch` block (line 21–23) to also set error state:
```ts
      .catch((err) => {
        console.error('Failed to fetch models:', err)
        if (!cancelled) setError(err instanceof Error ? err : new Error('Failed to fetch models'))
      })
```

4. Update the return (line 31) to include `error`:
```ts
  return { models, isLoading, error }
```

**Step 3: Show toast in `App.tsx` on errors**

In `packages/client/src/App.tsx`:

1. Add `useEffect` to the React import (line 1):
```ts
import { useRef, useCallback, useState, useMemo, useEffect } from "react"
```

2. Add sonner import after the React import:
```ts
import { toast } from "sonner"
```

3. Destructure `error` from both hooks (lines 101–102). Change:
```ts
  const { models } = useModels()
  const { settings, updateActionModel } = useSettings()
```
to:
```ts
  const { models, error: modelsError } = useModels()
  const { settings, updateActionModel, error: settingsError } = useSettings()
```

4. Add two `useEffect` blocks right after those hook calls (after line 102):
```ts
  useEffect(() => {
    if (settingsError) {
      toast.error("Failed to load settings", {
        description: settingsError.message,
      })
    }
  }, [settingsError])

  useEffect(() => {
    if (modelsError) {
      toast.error("Failed to load models", {
        description: modelsError.message,
      })
    }
  }, [modelsError])
```

**Step 4: Verify**

Run: `pnpm --filter @codereview/client build`
Expected: Build succeeds.

**Step 5: Commit**

```bash
git add packages/client/src/hooks/use-settings.ts packages/client/src/hooks/use-models.ts packages/client/src/App.tsx
git commit -m "fix: expose settings/models errors with toast notifications (CR-004)"
```

---

### Task 4: CR-006 — Pre-index annotations by file path

**Why:** `toLineAnnotations()` is called per-file in the render loop with `.filter()` across all annotations each time — O(N×M). Pre-indexing into a `Map` reduces to O(N+M).

**Files:**
- Modify: `packages/client/src/components/diff-panel/diff-viewer.tsx`

**Step 1: Replace per-file filtering with a pre-indexed lookup**

In `packages/client/src/components/diff-panel/diff-viewer.tsx`:

1. **Remove** the `pathsMatch` function (lines 126–134).

2. **Remove** the `toLineAnnotations` function (lines 139–170).

3. **Add** the following `useAnnotationIndex` function in its place (above the `DiffViewer` function):

```ts
/**
 * Pre-indexes annotations, drafts, and AI review items by file path.
 * Returns a lookup function: (filePath) => annotations[].
 */
function useAnnotationIndex(
  comments: ReviewComment[],
  drafts: DraftAnnotation[],
  aiReviewItems: AIReviewItem[],
) {
  return useMemo(() => {
    const commentsByFile = new Map<string, DiffLineAnnotation<AnnotationMetadata>[]>()
    for (const c of comments) {
      const arr = commentsByFile.get(c.filePath) ?? []
      arr.push({
        side: c.side,
        lineNumber: c.lineNumber,
        metadata: { type: "comment" as const, comment: c },
      })
      commentsByFile.set(c.filePath, arr)
    }

    const draftsByFile = new Map<string, DiffLineAnnotation<AnnotationMetadata>[]>()
    for (const d of drafts) {
      const arr = draftsByFile.get(d.filePath) ?? []
      arr.push({
        side: d.side,
        lineNumber: d.lineNumber,
        metadata: { type: "draft" as const, draft: d },
      })
      draftsByFile.set(d.filePath, arr)
    }

    // AI review items use normalized paths (strip leading slashes)
    const aiByFile = new Map<string, DiffLineAnnotation<AnnotationMetadata>[]>()
    for (const item of aiReviewItems) {
      const normalizedPath = item.filePath.replace(/^\/+/, "")
      const arr = aiByFile.get(normalizedPath) ?? []
      arr.push({
        side: "additions" as const,
        lineNumber: item.lineNumber,
        metadata: { type: "ai-review" as const, item },
      })
      aiByFile.set(normalizedPath, arr)
    }

    return (filePath: string): DiffLineAnnotation<AnnotationMetadata>[] => {
      const normalizedPath = filePath.replace(/^\/+/, "")
      return [
        ...(commentsByFile.get(filePath) ?? []),
        ...(draftsByFile.get(filePath) ?? []),
        ...(aiByFile.get(normalizedPath) ?? []),
      ]
    }
  }, [comments, drafts, aiReviewItems])
}
```

4. Inside the `DiffViewer` component body, add after the `submittingReplies` state declaration:
```ts
  const getAnnotationsForFile = useAnnotationIndex(annotations, draftAnnotations, aiReviewItems)
```

5. In the render loop, replace lines 469–474:
```ts
          const lineAnnotations = toLineAnnotations(
            annotations,
            draftAnnotations,
            aiReviewItems,
            file.path
          )
```
with:
```ts
          const lineAnnotations = getAnnotationsForFile(file.path)
```

**Step 2: Verify**

Run: `pnpm --filter @codereview/client build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add packages/client/src/components/diff-panel/diff-viewer.tsx
git commit -m "perf: pre-index annotations by file path (CR-006)"
```

---

### Task 5: CR-007 — Split DiffViewer into smaller memoized subcomponents

**Why:** `DiffViewer` is a ~400-line monolith. Any state change re-renders the entire file list. Extracting memoized subcomponents lowers the rerender surface.

**Files:**
- Create: `packages/client/src/components/diff-panel/annotation-renderer.tsx`
- Create: `packages/client/src/components/diff-panel/file-diff-card.tsx`
- Modify: `packages/client/src/components/diff-panel/diff-viewer.tsx` — slim to orchestrator
- Modify: `packages/client/src/components/diff-panel/index.tsx` — no changes needed (already exports `DiffViewer`)

**Step 1: Export `AnnotationMetadata` type from `diff-viewer.tsx`**

The `AnnotationMetadata` type (currently on line 117–120 of `diff-viewer.tsx`) needs to be accessible to subcomponents. Add an export:

```ts
export type AnnotationMetadata =
  | { type: "comment"; comment: ReviewComment }
  | { type: "draft"; draft: DraftAnnotation }
  | { type: "ai-review"; item: AIReviewItem }
```

(Just add `export` keyword to the existing type declaration.)

**Step 2: Create `annotation-renderer.tsx`**

Create `packages/client/src/components/diff-panel/annotation-renderer.tsx`:

```tsx
import { memo } from "react"
import type { DiffLineAnnotation, AnnotationSide } from "@pierre/diffs/react"
import type { ReviewComment } from "@/types/review"
import { CommentThread } from "@/components/comment-thread"
import { CommentForm } from "@/components/comment-thread/comment-form"
import type { AnnotationMetadata } from "./diff-viewer"

interface AnnotationRendererProps {
  annotation: DiffLineAnnotation<AnnotationMetadata>
  submittingDrafts: Set<string>
  submittingReplies: Set<string>
  onSubmitDraft: (
    filePath: string,
    side: AnnotationSide,
    lineNumber: number,
    content: string
  ) => Promise<void>
  onCancelDraft: (
    filePath: string,
    side: AnnotationSide,
    lineNumber: number
  ) => void
  onSubmitReply?: (commentId: string, content: string) => Promise<void>
}

export const AnnotationRenderer = memo(function AnnotationRenderer({
  annotation,
  submittingDrafts,
  submittingReplies,
  onSubmitDraft,
  onCancelDraft,
  onSubmitReply,
}: AnnotationRendererProps) {
  const meta = annotation.metadata
  if (!meta) return null

  if (meta.type === "draft") {
    const draftId = `draft-${meta.draft.filePath}-${meta.draft.side}-${meta.draft.lineNumber}`
    const isSubmitting = submittingDrafts.has(draftId)

    return (
      <CommentForm
        variant="inline"
        size="sm"
        autoFocus
        showKeyboardHints
        placeholder="Leave a comment..."
        onSubmit={(content) =>
          onSubmitDraft(
            meta.draft.filePath,
            meta.draft.side,
            meta.draft.lineNumber,
            content
          )
        }
        onCancel={() =>
          onCancelDraft(
            meta.draft.filePath,
            meta.draft.side,
            meta.draft.lineNumber
          )
        }
        isLoading={isSubmitting}
      />
    )
  }

  if (meta.type === "ai-review") {
    const aiComment: ReviewComment = {
      id: meta.item.id,
      filePath: meta.item.filePath,
      lineNumber: meta.item.lineNumber,
      side: "additions",
      content: meta.item.suggestion
        ? `${meta.item.message}\n\n**Suggestion:** ${meta.item.suggestion}`
        : meta.item.message,
      author: { type: "ai", name: "AI Review" },
      severity: meta.item.severity,
      createdAt: new Date(),
      replies: [],
    }

    return (
      <CommentThread.Inline
        comment={aiComment}
        lineNumber={annotation.lineNumber}
      />
    )
  }

  return (
    <CommentThread.Inline
      comment={meta.comment}
      lineNumber={annotation.lineNumber}
      onReplySubmit={onSubmitReply}
      isSubmittingReply={submittingReplies.has(meta.comment.id)}
    />
  )
})
```

**Step 3: Create `file-diff-card.tsx`**

Create `packages/client/src/components/diff-panel/file-diff-card.tsx`:

```tsx
import { memo, useCallback, useMemo } from "react"
import {
  MultiFileDiff,
  type DiffLineAnnotation,
  type FileContents,
  type AnnotationSide,
} from "@pierre/diffs/react"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { Add01Icon } from "@hugeicons/core-free-icons"
import { CollapsibleFileHeader } from "./collapsible-file-header"
import { AnnotationRenderer } from "./annotation-renderer"
import type { DiffFileData } from "@/types/diff"
import type { AnnotationMetadata } from "./diff-viewer"

function toFileContents(path: string, content: string): FileContents {
  return { name: path, contents: content }
}

interface FileDiffCardProps {
  file: DiffFileData
  lineAnnotations: DiffLineAnnotation<AnnotationMetadata>[]
  isCollapsed: boolean
  isViewed: boolean
  resolvedTheme: "dark" | "light"
  hasOpenCommentForm: boolean
  submittingDrafts: Set<string>
  submittingReplies: Set<string>
  onToggleCollapse: (filePath: string) => void
  onToggleViewed: (filePath: string) => void
  onAddDraft: (filePath: string, side: AnnotationSide, lineNumber: number) => void
  onSubmitDraft: (
    filePath: string,
    side: AnnotationSide,
    lineNumber: number,
    content: string
  ) => Promise<void>
  onCancelDraft: (
    filePath: string,
    side: AnnotationSide,
    lineNumber: number
  ) => void
  onSubmitReply?: (commentId: string, content: string) => Promise<void>
  onLineClick?: (
    filePath: string,
    line: number,
    side: "additions" | "deletions"
  ) => void
}

export const FileDiffCard = memo(function FileDiffCard({
  file,
  lineAnnotations,
  isCollapsed,
  isViewed,
  resolvedTheme,
  hasOpenCommentForm,
  submittingDrafts,
  submittingReplies,
  onToggleCollapse,
  onToggleViewed,
  onAddDraft,
  onSubmitDraft,
  onCancelDraft,
  onSubmitReply,
  onLineClick,
}: FileDiffCardProps) {
  const oldFile = useMemo(
    () => toFileContents(file.oldPath ?? file.path, file.oldContent),
    [file.oldPath, file.path, file.oldContent]
  )
  const newFile = useMemo(
    () => toFileContents(file.path, file.newContent),
    [file.path, file.newContent]
  )

  const options = useMemo(() => ({
    diffStyle: "split" as const,
    expandUnchanged: false,
    expansionLineCount: 20,
    lineDiffType: "word" as const,
    hunkSeparators: "line-info" as const,
    disableFileHeader: true,
    enableHoverUtility: !hasOpenCommentForm,
    themeType: resolvedTheme,
    onLineClick: onLineClick
      ? (lineProps: { lineNumber: number; annotationSide: "additions" | "deletions" }) => {
          onLineClick(file.path, lineProps.lineNumber, lineProps.annotationSide)
        }
      : undefined,
  }), [hasOpenCommentForm, resolvedTheme, onLineClick, file.path])

  const handleToggleCollapse = useCallback(
    () => onToggleCollapse(file.path),
    [onToggleCollapse, file.path]
  )

  const handleToggleViewed = useCallback(
    () => onToggleViewed(file.path),
    [onToggleViewed, file.path]
  )

  return (
    <div
      role="listitem"
      data-file-path={file.path}
      data-state={isCollapsed ? "collapsed" : "expanded"}
      data-viewed={isViewed}
      className="overflow-hidden rounded-lg border border-border"
      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 500px" }}
    >
      <CollapsibleFileHeader
        filePath={file.path}
        status={file.status}
        additions={file.additions}
        deletions={file.deletions}
        isCollapsed={isCollapsed}
        isViewed={isViewed}
        onToggleCollapse={handleToggleCollapse}
        onToggleViewed={handleToggleViewed}
      />

      {!isCollapsed && (
        <MultiFileDiff<AnnotationMetadata>
          oldFile={oldFile}
          newFile={newFile}
          options={options}
          lineAnnotations={lineAnnotations}
          renderHoverUtility={(getHoveredLine) => (
            <Button
              size="icon-xs"
              variant="default"
              className="cursor-pointer bg-primary hover:bg-primary/90"
              aria-label="Add comment to this line"
              onClick={(event) => {
                const hoveredLine = getHoveredLine()
                if (hoveredLine == null) return
                event.stopPropagation()
                onAddDraft(file.path, hoveredLine.side, hoveredLine.lineNumber)
              }}
            >
              <HugeiconsIcon icon={Add01Icon} className="size-3" aria-hidden="true" />
            </Button>
          )}
          renderAnnotation={(annotation) => (
            <AnnotationRenderer
              annotation={annotation}
              submittingDrafts={submittingDrafts}
              submittingReplies={submittingReplies}
              onSubmitDraft={onSubmitDraft}
              onCancelDraft={onCancelDraft}
              onSubmitReply={onSubmitReply}
            />
          )}
        />
      )}
    </div>
  )
})
```

> **Note:** The `style={{ contentVisibility: "auto", containIntrinsicSize: "auto 500px" }}` on the outer `<div>` also covers **CR-008** — see Task 6 below.

**Step 4: Slim down `diff-viewer.tsx` to orchestrator**

Rewrite `packages/client/src/components/diff-panel/diff-viewer.tsx`. The component keeps all state management but delegates rendering to `FileDiffCard`:

- **Remove** these imports (now only used in subcomponents):
  - `MultiFileDiff`, `FileContents` from `@pierre/diffs/react`
  - `Button` from `@/components/ui/button`
  - `CollapsibleFileHeader` from `./collapsible-file-header`
  - `CommentThread` from `@/components/comment-thread`
  - `CommentForm` from `@/components/comment-thread/comment-form`
  - `HugeiconsIcon` from `@hugeicons/react`
  - `Add01Icon` from `@hugeicons/core-free-icons`

- **Remove** the `toFileContents` function (moved to `file-diff-card.tsx`).
- **Remove** the `createDiffOptions` callback (moved into `FileDiffCard`).
- **Remove** the `hasOpenCommentForm` callback (inlined in render loop as `draftAnnotations.some()`).

- **Add** import for `FileDiffCard`:
```ts
import { FileDiffCard } from "./file-diff-card"
```

- **Replace** the entire `files.map(...)` render block (lines 463–605) with:

```tsx
          {files.map((file) => (
            <FileDiffCard
              key={file.path}
              file={file}
              lineAnnotations={getAnnotationsForFile(file.path)}
              isCollapsed={collapsedFiles.has(file.path)}
              isViewed={viewedFiles.has(file.path)}
              resolvedTheme={resolvedTheme}
              hasOpenCommentForm={draftAnnotations.some((d) => d.filePath === file.path)}
              submittingDrafts={submittingDrafts}
              submittingReplies={submittingReplies}
              onToggleCollapse={handleToggleCollapse}
              onToggleViewed={handleToggleViewed}
              onAddDraft={addDraftAnnotation}
              onSubmitDraft={submitDraftAnnotation}
              onCancelDraft={cancelDraftAnnotation}
              onSubmitReply={onReplySubmit ? submitReply : undefined}
              onLineClick={onLineClick}
            />
          ))}
```

**Step 5: Verify**

Run: `pnpm --filter @codereview/client build`
Expected: Build succeeds.

**Step 6: Commit**

```bash
git add packages/client/src/components/diff-panel/annotation-renderer.tsx packages/client/src/components/diff-panel/file-diff-card.tsx packages/client/src/components/diff-panel/diff-viewer.tsx
git commit -m "refactor: split DiffViewer into FileDiffCard + AnnotationRenderer (CR-007)"
```

---

### Task 6: CR-008 — CSS `content-visibility: auto` for diff file cards

**Why:** For very large PRs, all file diffs render at once. `content-visibility: auto` lets the browser skip layout/paint for off-screen cards while preserving DOM nodes for `Ctrl+F` search — unlike JS virtualization which removes DOM nodes.

**Implementation:** Already included in Task 5 — the `style` prop on `FileDiffCard`'s outer `<div>`:

```tsx
style={{ contentVisibility: "auto", containIntrinsicSize: "auto 500px" }}
```

- `containIntrinsicSize: "auto 500px"` gives the browser an estimated height for off-screen cards so scrollbar stays stable
- The `auto` keyword tells the browser to remember the actual rendered size once computed, preventing layout jumps

**If Task 5 has already been applied:** CR-008 is done. No additional work.

**If Task 5 has NOT been applied yet (standalone fix):** Add the `style` prop to the outer `<div>` in the render loop of `diff-viewer.tsx`, on the `<div key={file.path}>` element at line 481:

```tsx
<div
  key={file.path}
  role="listitem"
  data-file-path={file.path}
  data-state={isCollapsed ? "collapsed" : "expanded"}
  data-viewed={isViewed}
  className="overflow-hidden rounded-lg border border-border"
  style={{ contentVisibility: "auto", containIntrinsicSize: "auto 500px" }}
>
```

**Verify:**

Run: `pnpm --filter @codereview/client build`
Expected: Build succeeds.

**Commit (only if standalone):**

```bash
git add packages/client/src/components/diff-panel/diff-viewer.tsx
git commit -m "perf: add content-visibility auto to file diff cards (CR-008)"
```

---

### Task 7: CR-011 — Fix ThemeProvider context guard and system theme listener

**Why:** Two bugs: (1) `useTheme` context guard never fires because `createContext` has a default value — using `useTheme` outside provider silently returns a noop. (2) When theme is "system", the app reads OS preference once but never listens for changes.

**Files:**
- Modify: `packages/client/src/components/theme-provider.tsx`

**Step 1: Rewrite `theme-provider.tsx`**

Replace the entire contents of `packages/client/src/components/theme-provider.tsx` with:

```tsx
import { createContext, useContext, useEffect, useState } from "react"

type Theme = "dark" | "light" | "system"

type ThemeProviderProps = {
  children: React.ReactNode
  defaultTheme?: Theme
  storageKey?: string
}

type ThemeProviderState = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

const ThemeProviderContext = createContext<ThemeProviderState | null>(null)

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "codereview-ui-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  )

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

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      localStorage.setItem(storageKey, theme)
      setTheme(theme)
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
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
```

Key changes:
- `createContext<ThemeProviderState | null>(null)` — default is `null`, so `useContext` returns `null` outside provider
- Guard checks `=== null` instead of `=== undefined`
- `useEffect` subscribes to `matchMedia` `"change"` events when `theme === "system"`, cleans up on unmount/theme change

**Step 2: Verify**

Run: `pnpm --filter @codereview/client build`
Expected: Build succeeds.

**Step 3: Commit**

```bash
git add packages/client/src/components/theme-provider.tsx
git commit -m "fix: ThemeProvider context guard + dynamic system theme listener (CR-011)"
```

---

### Task 8: CR-012 — Fix ESLint react-refresh/only-export-components across files

**Why:** `pnpm --filter @codereview/client lint` fails with 20 errors. The `react-refresh/only-export-components` rule requires each file to export only components or only non-components for Vite HMR.

**Files to modify (11 files):**
- `packages/client/src/components/chat/index.tsx`
- `packages/client/src/components/diff-panel/index.tsx`
- `packages/client/src/components/theme-provider.tsx`
- `packages/client/src/components/ui/badge.tsx`
- `packages/client/src/components/ui/button.tsx`
- `packages/client/src/components/ui/combobox.tsx`
- `packages/client/src/components/ui/risk-badge.tsx`
- `packages/client/src/components/ui/severity-badge.tsx`
- `packages/client/src/components/ui/tabs.tsx`
- `packages/client/src/components/ui/verification-badge.tsx`
- `packages/client/src/hooks/use-pr-context.tsx`

**Strategy per file type:**

| Pattern | Files | Fix |
|---------|-------|-----|
| Barrel/namespace object exports | `chat/index.tsx`, `diff-panel/index.tsx` | `/* eslint-disable react-refresh/only-export-components */` at top |
| shadcn variant configs co-exported | `badge.tsx`, `button.tsx`, `risk-badge.tsx`, `severity-badge.tsx`, `tabs.tsx`, `verification-badge.tsx` | `/* eslint-disable react-refresh/only-export-components */` at top |
| Hook co-exported with component internals | `combobox.tsx` | `/* eslint-disable react-refresh/only-export-components */` at top |
| Hook co-exported with provider | `theme-provider.tsx` | `/* eslint-disable react-refresh/only-export-components */` at top |
| Hook + Provider co-export | `use-pr-context.tsx` | Split into two files |

**Step 1: Fix `chat/index.tsx`**

In `packages/client/src/components/chat/index.tsx`:

1. Add at line 1 (before `"use client"`):
```ts
/* eslint-disable react-refresh/only-export-components */
```

2. Fix unused `title` variable. Change line 186–191 from:
```ts
function Welcome({
  className,
  title = "Lily",
  message = "Hey! I'm Lily. I've reviewed this PR and I'm ready to help. Ask me anything about the changes, potential issues, or how the code works.",
  ...props
}: ChatPopupWelcomeProps) {
```
to:
```ts
function Welcome({
  className,
  message = "Hey! I'm Lily. I've reviewed this PR and I'm ready to help. Ask me anything about the changes, potential issues, or how the code works.",
  ...props
}: ChatPopupWelcomeProps) {
```

**Step 2: Fix `diff-panel/index.tsx`**

Add at line 1 of `packages/client/src/components/diff-panel/index.tsx`:
```ts
/* eslint-disable react-refresh/only-export-components */
```

**Step 3: Fix `theme-provider.tsx`**

Add at line 1 of `packages/client/src/components/theme-provider.tsx`:
```ts
/* eslint-disable react-refresh/only-export-components */
```

> If Task 7 was already applied, just prepend this one line.

**Step 4: Fix `use-pr-context.tsx` — split hook from provider**

Create `packages/client/src/hooks/pr-context.ts`:

```ts
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
```

Rewrite `packages/client/src/hooks/use-pr-context.tsx`:

```tsx
import { useEffect, useState, type ReactNode } from "react"
import { PRContext } from "./pr-context"

export { usePRContext } from "./pr-context"

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
```

No changes to `packages/client/src/hooks/index.ts` — it re-exports `{ usePRContext, PRContextProvider }` from `./use-pr-context`, and the re-export in `use-pr-context.tsx` preserves this contract.

**Step 5: Fix shadcn UI files — add eslint-disable**

For each of these files, add `/* eslint-disable react-refresh/only-export-components */` as line 1:

- `packages/client/src/components/ui/badge.tsx`
- `packages/client/src/components/ui/button.tsx`
- `packages/client/src/components/ui/combobox.tsx`
- `packages/client/src/components/ui/risk-badge.tsx`
- `packages/client/src/components/ui/severity-badge.tsx`
- `packages/client/src/components/ui/tabs.tsx`
- `packages/client/src/components/ui/verification-badge.tsx`

These are all shadcn/ui-style files that intentionally co-export variant configs (e.g. `badgeVariants`, `buttonVariants`) with their components. This is the standard shadcn pattern.

**Step 6: Verify**

Run: `pnpm --filter @codereview/client lint`
Expected: 0 errors, 0 warnings, exit code 0.

**Step 7: Commit**

```bash
git add packages/client/src/components/chat/index.tsx packages/client/src/components/diff-panel/index.tsx packages/client/src/components/theme-provider.tsx packages/client/src/hooks/use-pr-context.tsx packages/client/src/hooks/pr-context.ts packages/client/src/components/ui/badge.tsx packages/client/src/components/ui/button.tsx packages/client/src/components/ui/combobox.tsx packages/client/src/components/ui/risk-badge.tsx packages/client/src/components/ui/severity-badge.tsx packages/client/src/components/ui/tabs.tsx packages/client/src/components/ui/verification-badge.tsx
git commit -m "fix: resolve all ESLint react-refresh/only-export-components errors (CR-012)"
```

---

## Final Verification

After all 8 tasks are complete, run:

```bash
pnpm --filter @codereview/client build && pnpm --filter @codereview/client lint
```

Both must pass with 0 errors.

---

## Execution Order Summary

| Order | Task | CR | Priority | Description |
|-------|------|----|----------|-------------|
| 1 | Task 1 | CR-005 | P1 | Move DiffFileData to types/ |
| 2 | Task 2 | CR-003 | P0 | Await all refetches in refresh |
| 3 | Task 3 | CR-004 | P0 | Expose errors with sonner toasts |
| 4 | Task 4 | CR-006 | P1 | Pre-index annotations by file path |
| 5 | Task 5 | CR-007 | P1 | Split DiffViewer into subcomponents |
| 6 | Task 6 | CR-008 | P1 | content-visibility: auto (included in Task 5) |
| 7 | Task 7 | CR-011 | P1 | Fix ThemeProvider guard + system listener |
| 8 | Task 8 | CR-012 | P1 | Fix ESLint react-refresh errors |
