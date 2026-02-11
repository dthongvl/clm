# Head File Source Dialog Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "View file" action in each diff file header that opens a dialog showing the head-branch file content with syntax highlighting and without diff add/remove styling.

**Architecture:** Reuse already-fetched head content (`DiffFileData.newContent`) from the current diff payload and render it with the `File` component from `@pierre/diffs/react` in a single shared dialog managed by `DiffViewer`. Keep file cards lightweight by lifting dialog state to `DiffViewer` and passing an open handler down through `FileDiffCard` and `CollapsibleFileHeader`.

**Tech Stack:** React 19, TypeScript, `@pierre/diffs/react`, shadcn/Base UI dialog, Tailwind CSS.

---

### Task 1: Add a reusable source-view dialog component

**Files:**
- Create: `packages/client/src/components/diff-panel/file-source-dialog.tsx`
- Modify: `packages/client/src/components/diff-panel/index.tsx`

**Step 1: Create the dialog component scaffold**

Create `FileSourceDialog` with props:

```ts
type FileSourceDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  filePath: string
  content: string
  resolvedTheme: "dark" | "light"
  refLabel?: string
}
```

Use `Dialog`, `DialogContent`, `DialogHeader`, and `DialogTitle` from `@/components/ui/dialog`.

**Step 2: Render head file with diffs `File` component**

Inside dialog body, render:

```tsx
<File
  file={{ name: filePath, contents: content }}
  options={{
    themeType: resolvedTheme,
    overflow: "scroll",
    disableFileHeader: true,
    disableBackground: false,
  }}
/>
```

Wrap in `ScrollArea` and constrain dialog size for desktop + mobile (for example `w-[min(96vw,1200px)]` and `h-[80vh]`).

**Step 3: Handle empty content safely**

If `content === ""`, show a friendly fallback message instead of rendering `File`.

**Step 4: Export through diff-panel barrel**

Export `FileSourceDialog` from `packages/client/src/components/diff-panel/index.tsx`.

**Step 5: Commit**

```bash
git add packages/client/src/components/diff-panel/file-source-dialog.tsx packages/client/src/components/diff-panel/index.tsx
git commit -m "feat(client): add reusable head file source dialog"
```

### Task 2: Add "View file" action to the file header

**Files:**
- Modify: `packages/client/src/components/diff-panel/collapsible-file-header.tsx`

**Step 1: Extend header props**

Add props:

```ts
canViewSource?: boolean
onViewSource?: () => void
```

Default `canViewSource` to `true`.

**Step 2: Add a button in the right-side actions**

Add a compact ghost button labeled `View file` near diff stats / viewed checkbox.

Button behavior:
- `disabled={!canViewSource}`
- `onClick` stops propagation and calls `onViewSource?.()`
- `aria-label="View file source"`

**Step 3: Preserve collapse/viewed interactions**

Confirm the new button does not trigger collapse toggle or checkbox click side effects.

**Step 4: Commit**

```bash
git add packages/client/src/components/diff-panel/collapsible-file-header.tsx
git commit -m "feat(client): add view file action in diff header"
```

### Task 3: Wire header action from file card

**Files:**
- Modify: `packages/client/src/components/diff-panel/file-diff-card.tsx`

**Step 1: Extend file card props**

Add callback prop:

```ts
onViewHeadFile: (payload: { filePath: string; content: string }) => void
```

**Step 2: Build per-file open handler**

In `FileDiffCard`, create:

```ts
const handleViewSource = useCallback(() => {
  onViewHeadFile({ filePath: file.path, content: file.newContent })
}, [onViewHeadFile, file.path, file.newContent])
```

Pass this to `CollapsibleFileHeader` as `onViewSource`.

**Step 3: Disable for deleted files**

Set `canViewSource={file.status !== "deleted"}` so the UI matches head-branch availability.

**Step 4: Commit**

```bash
git add packages/client/src/components/diff-panel/file-diff-card.tsx
git commit -m "feat(client): connect file cards to head source view action"
```

### Task 4: Manage shared dialog state in DiffViewer

**Files:**
- Modify: `packages/client/src/components/diff-panel/diff-viewer.tsx`

**Step 1: Add source-view state**

Add local state:

```ts
const [sourceView, setSourceView] = useState<{ filePath: string; content: string } | null>(null)
```

**Step 2: Add open/close handlers**

Create:

```ts
const handleViewHeadFile = useCallback((payload: { filePath: string; content: string }) => {
  setSourceView(payload)
}, [])

const handleSourceDialogOpenChange = useCallback((open: boolean) => {
  if (!open) setSourceView(null)
}, [])
```

**Step 3: Pass handler to each file card**

Provide `onViewHeadFile={handleViewHeadFile}` when rendering `FileDiffCard`.

**Step 4: Render one shared dialog**

Render `FileSourceDialog` once near bottom of `DiffViewer`:

```tsx
<FileSourceDialog
  open={sourceView !== null}
  onOpenChange={handleSourceDialogOpenChange}
  filePath={sourceView?.filePath ?? ""}
  content={sourceView?.content ?? ""}
  resolvedTheme={resolvedTheme}
  refLabel="Head"
/>
```

**Step 5: Commit**

```bash
git add packages/client/src/components/diff-panel/diff-viewer.tsx
git commit -m "feat(client): add shared head file source dialog flow"
```

### Task 5: Verification and polish

**Files:**
- Verify only (no expected new files)

**Step 1: Type-check client**

Run: `pnpm --filter @codereview/client check-types`

Expected: success, no TypeScript errors.

**Step 2: Build client**

Run: `pnpm --filter @codereview/client build`

Expected: successful production build.

**Step 3: Manual QA checklist**

1. Open any modified file, click `View file`, confirm a dialog opens with syntax-highlighted source and no add/remove diff styling.
2. Confirm dialog follows current theme (`light`/`dark`) and supports vertical + horizontal scrolling.
3. Confirm deleted files show disabled `View file` action.
4. Confirm existing actions still work: collapse toggle, copy path, viewed checkbox, add comment.
5. Confirm mobile viewport usability (dialog size + scroll).

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(client): enable clean head-file source review dialog"
```

### Notes / Constraints

- No backend change is required for this implementation because head content is already included in `DiffFileData.newContent` from existing diff fetch flow.
- Keep YAGNI: do not add a new `/api/git/diff/file` fetch path for this feature unless we later need lazy-loading for very large PRs.
- Current repo has no established frontend test runner; verification relies on strict TypeScript/build checks plus manual QA.
