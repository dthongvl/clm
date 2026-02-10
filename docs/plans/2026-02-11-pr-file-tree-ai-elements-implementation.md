# AI Elements PR File Tree Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a left-side PR file tree using AI Elements `FileTree` so reviewers can quickly navigate changed files and toggle the tree show/hide.

**Architecture:** Keep the existing top-level two-panel layout (`MainLayout`) unchanged. Inside the current diff panel area, introduce an inner horizontal split: a new file-tree panel on the left and diff viewer on the right. The file tree is built from PR diff paths (`files`) via a deterministic path-to-folder transform, and file selection calls existing `scrollToFile` to jump the diff list.

**Tech Stack:** React 19, TypeScript, AI Elements, shadcn/ui, react-resizable-panels, Tailwind v4

---

## Task 1: Install AI Elements File Tree Component

**Files:**
- Create (via CLI): `packages/client/src/components/ai-elements/file-tree.tsx`
- Modify (if CLI updates registries): `packages/client/components.json`
- Modify (if CLI adds deps): `packages/client/package.json`

**Step 1: Install the component in the client package**

Run in `packages/client`:

```bash
pnpm dlx ai-elements@latest add file-tree
```

Expected: AI Elements `file-tree` component files are generated under `src/components/ai-elements/`.

**Step 2: Verify generated exports and dependencies**

Confirm generated file exports:
- `FileTree`
- `FileTreeFolder`
- `FileTreeFile`
- optional subcomponents (`FileTreeIcon`, `FileTreeName`, `FileTreeActions`)

**Step 3: Run client typecheck baseline**

Run:

```bash
pnpm --filter @codereview/client check-types
```

Expected: passes.

**Step 4: Commit**

```bash
git add packages/client/src/components/ai-elements/file-tree.tsx packages/client/components.json packages/client/package.json
git commit -m "feat: add AI Elements file tree component"
```

---

## Task 2: Add PR File Tree Data Transformer

**Files:**
- Create: `packages/client/src/lib/pr-file-tree.ts`
- Modify: `packages/client/src/types/diff.ts` (only if helper types are shared)

**Step 1: Add file tree node types and builder function**

Implement a pure transformer that converts flat diff file paths into hierarchical folders:

```ts
import type { DiffFileData } from "@/types/diff"

export interface PRFileTreeFolderNode {
  type: "folder"
  path: string
  name: string
  children: PRFileTreeNode[]
}

export interface PRFileTreeFileNode {
  type: "file"
  path: string
  name: string
  file: DiffFileData
}

export type PRFileTreeNode = PRFileTreeFolderNode | PRFileTreeFileNode

export function buildPRFileTree(files: DiffFileData[]): PRFileTreeNode[] {
  // deterministic tree build from file.path segments
}
```

Rules:
- split by `/`
- create stable folder `path` keys (`src/components`)
- leaf file nodes preserve original `DiffFileData`
- sort folders before files, then alphabetical by `name`

**Step 2: Add helper for default expanded folders**

Add:

```ts
export function getDefaultExpandedFolders(nodes: PRFileTreeNode[]): Set<string>
```

Behavior:
- return root folders expanded by default (first level)
- keep result deterministic for stable UI

**Step 3: Verify via typecheck**

Run:

```bash
pnpm --filter @codereview/client check-types
```

Expected: passes.

**Step 4: Commit**

```bash
git add packages/client/src/lib/pr-file-tree.ts packages/client/src/types/diff.ts
git commit -m "feat: add diff path to hierarchical tree transformer"
```

---

## Task 3: Build PR-Specific File Tree Wrapper Using AI Elements

**Files:**
- Create: `packages/client/src/components/diff-panel/pr-file-tree.tsx`
- Modify: `packages/client/src/components/diff-panel/index.tsx`

**Step 1: Create wrapper component API**

Create:

```ts
export interface PRFileTreeProps {
  files: DiffFileData[]
  selectedPath?: string
  onSelectFile: (path: string) => void
  className?: string
}
```

**Step 2: Render AI Elements tree recursively**

Use:

```tsx
import { FileTree, FileTreeFolder, FileTreeFile } from "@/components/ai-elements/file-tree"
import { buildPRFileTree, getDefaultExpandedFolders } from "@/lib/pr-file-tree"
```

Render folders/files recursively and map `onSelect` to `onSelectFile`.

**Step 3: Keep PR context in file labels**

For file leaves, include compact change badges in label text (or trailing metadata):
- additions: `+N`
- deletions: `-N`

Do not block initial implementation on custom icon polish.

**Step 4: Export from diff-panel index**

Expose `PRFileTree` from `packages/client/src/components/diff-panel/index.tsx`.

**Step 5: Run typecheck**

Run:

```bash
pnpm --filter @codereview/client check-types
```

Expected: passes.

**Step 6: Commit**

```bash
git add packages/client/src/components/diff-panel/pr-file-tree.tsx packages/client/src/components/diff-panel/index.tsx
git commit -m "feat: add PR file tree wrapper based on AI Elements"
```

---

## Task 4: Integrate File Tree Into Left Side Of Main UI

**Files:**
- Modify: `packages/client/src/App.tsx`
- Modify: `packages/client/src/lib/storage.ts`

**Step 1: Add visibility and selection state in `App`**

Add state:

```ts
const [isFileTreeVisible, setIsFileTreeVisible] = usePersistedState("pr-file-tree-visible", true)
const [selectedFilePath, setSelectedFilePath] = useState<string>()
```

Add `StorageKeys.PR_FILE_TREE_VISIBLE` in `lib/storage.ts` if you want a typed key constant.

**Step 2: Wire selection to existing scroll behavior**

When tree file is selected:
- set `selectedFilePath`
- call existing `scrollToFile(filePath)`

**Step 3: Add nested split layout in diff area**

Inside the existing `leftPanel` render path, replace single `DiffPanel.Viewer` body with:
- left inner panel: `DiffPanel.PRFileTree`
- right inner panel: existing `DiffPanel.Viewer`

Use `ResizablePanelGroup` (`horizontal`) with sensible defaults, for example:
- tree width: 24-30%
- viewer width: remaining area

**Step 4: Support show/hide toggle**

If `isFileTreeVisible` is false:
- render only viewer panel (no tree panel or handle)

If true:
- render tree + handle + viewer

Expected: no dead space remains when hidden.

**Step 5: Add top bar toggle control**

Add a button in `TopBar.Actions`:
- label: `Show Files` / `Hide Files`
- `aria-pressed={isFileTreeVisible}`
- toggles `setIsFileTreeVisible((prev) => !prev)`

**Step 6: Run typecheck**

Run:

```bash
pnpm --filter @codereview/client check-types
```

Expected: passes.

**Step 7: Commit**

```bash
git add packages/client/src/App.tsx packages/client/src/lib/storage.ts
git commit -m "feat: integrate toggleable PR file tree into diff workspace"
```

---

## Task 5: Remove Legacy Flat File Tree (Optional Cleanup)

**Files:**
- Delete: `packages/client/src/components/diff-panel/file-tree.tsx`
- Modify: `packages/client/src/components/diff-panel/index.tsx`

**Step 1: Confirm no imports depend on old file tree**

Search for old symbol usage before deleting.

**Step 2: Remove old exports/imports from index**

Remove `FileTree` and `DiffPanelFileTreeProps` exports tied to old component.

**Step 3: Delete old component file**

Delete `components/diff-panel/file-tree.tsx` once references are gone.

**Step 4: Run typecheck**

Run:

```bash
pnpm --filter @codereview/client check-types
```

Expected: passes.

**Step 5: Commit**

```bash
git add packages/client/src/components/diff-panel/index.tsx packages/client/src/components/diff-panel/file-tree.tsx
git commit -m "refactor: remove legacy diff file list component"
```

---

## Task 6: Verification And UX QA

**Files:**
- None required unless fixes are found

**Step 1: Run static checks and build**

Run:

```bash
pnpm --filter @codereview/client lint
pnpm --filter @codereview/client check-types
pnpm --filter @codereview/client build
```

Expected: all pass.

**Step 2: Manual behavior validation**

Verify in the UI:
1. File tree appears on left side of diff workspace.
2. Clicking a file scrolls to matching diff card.
3. Tree can be hidden and shown from top bar toggle.
4. Hidden state persists on refresh (if persisted state is enabled).
5. Nested folders expand/collapse correctly.
6. Viewer remains usable at narrow and wide panel sizes.

**Step 3: Accessibility spot check**

Validate:
- toggle button has clear text and `aria-pressed`
- keyboard navigation works in tree (arrow keys / enter)
- visible focus styles are present

**Step 4: Commit follow-up fixes**

```bash
git add -A
git commit -m "fix: polish PR file tree navigation and toggle behavior"
```

---

## Implementation Notes

- Keep first version intentionally small: tree navigation + toggle + scrolling, no extra batch actions.
- Reuse existing `scrollToFile` from `App.tsx` to avoid introducing new scroll sync logic.
- Do not couple tree state to diff collapse/viewed state in this iteration.
- If AI Elements API changes, keep the PR wrapper (`pr-file-tree.tsx`) as compatibility boundary.

## Definition Of Done

- AI Elements `FileTree` is installed and used in the client.
- PR files render as a hierarchical left-side tree in the diff workspace.
- Tree selection scrolls the diff viewer to the selected file.
- User can toggle tree show/hide without breaking diff layout.
- Client lint, typecheck, and build succeed.
