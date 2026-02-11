# Collapsible Left & Right Sidebars Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current `ResizablePanelGroup`-based `MainLayout` with a `SidebarProvider`-based layout that supports collapsing both the left (file tree) and right (side panel) sidebars.

**Architecture:** Use the existing shadcn `Sidebar` component (`sidebar.tsx`) which already has `SidebarProvider`, `Sidebar`, `SidebarTrigger`, `SidebarInset`, and collapse/expand state management with `useSidebar`. We'll use two independent `SidebarProvider` contexts — one for the left sidebar (file tree) and one for the right sidebar (AI review/grouping panel). The file tree moves from being a nested resizable panel inside DiffPanel into the left `Sidebar`, and the `SidePanel` moves into the right `Sidebar`. Toggle buttons go in the `TopBar`.

**Tech Stack:** React 19, shadcn/ui Sidebar component, Tailwind CSS v4, localStorage persistence via existing `usePersistedState`

---

### Task 1: Create a Right Sidebar Context

The existing `SidebarProvider` uses a single React context, so two sidebars would conflict. We need a second, independent context for the right sidebar.

**Files:**
- Create: `packages/client/src/components/ui/sidebar-right.tsx`
- Modify: `packages/client/src/lib/storage.ts` (add storage keys)

**Step 1: Add storage keys**

In `packages/client/src/lib/storage.ts`, add two new keys to `StorageKeys`:

```typescript
export const StorageKeys = {
  MAIN_LAYOUT_SIZES: "main-layout-sizes",
  SIDE_PANEL_TAB: "side-panel-tab",
  DIFF_VIEW_MODE: "diff-view-mode",
  PR_FILE_TREE_VISIBLE: "pr-file-tree-visible",
  LEFT_SIDEBAR_OPEN: "left-sidebar-open",
  RIGHT_SIDEBAR_OPEN: "right-sidebar-open",
} as const
```

**Step 2: Create `sidebar-right.tsx`**

Create a minimal right sidebar provider and component that mirrors `SidebarProvider`/`Sidebar` but uses its own context and cookie name. Key differences:
- Uses `SIDEBAR_RIGHT_COOKIE_NAME = "sidebar_right_state"`
- Uses keyboard shortcut `]` (Ctrl+]) instead of `b`
- CSS variable `--sidebar-right-width` set to `30%` (or `420px`)
- `side` always `"right"`
- Separate context: `SidebarRightContext`

Export: `SidebarRightProvider`, `SidebarRight`, `SidebarRightTrigger`, `SidebarRightInset`, `useSidebarRight`

**Step 3: Verify**

Run: `pnpm --filter @codereview/client check-types`

---

### Task 2: Refactor MainLayout to Use Sidebar Components

Replace the `ResizablePanelGroup` in `MainLayout` with the sidebar-based layout.

**Files:**
- Modify: `packages/client/src/components/main-layout.tsx`

**Step 1: Rewrite `MainLayout`**

The new layout structure:

```tsx
<SidebarProvider defaultOpen={leftOpen} onOpenChange={setLeftOpen}>
  <SidebarRightProvider defaultOpen={rightOpen} onOpenChange={setRightOpen}>
    <div className="flex h-full w-full">
      {/* Left Sidebar - File Tree */}
      <Sidebar side="left" variant="sidebar" collapsible="offcanvas">
        <SidebarContent>{leftPanel}</SidebarContent>
      </Sidebar>

      {/* Main Content - Diff Viewer */}
      <main className="flex-1 min-w-0 overflow-hidden">
        {centerPanel}
      </main>

      {/* Right Sidebar - AI Review / Grouping */}
      <SidebarRight>
        <SidebarContent>{rightPanel}</SidebarContent>
      </SidebarRight>
    </div>
  </SidebarRightProvider>
</SidebarProvider>
```

Update `MainLayoutProps` to accept `leftPanel`, `centerPanel`, and `rightPanel` (three slots instead of two). Persist open/closed state using `usePersistedState` with `StorageKeys.LEFT_SIDEBAR_OPEN` and `StorageKeys.RIGHT_SIDEBAR_OPEN`.

Remove the old `ResizablePanelGroup` code and `getPersistedLayout`/`persistLayout` helpers.

**Step 2: Verify**

Run: `pnpm --filter @codereview/client check-types`

---

### Task 3: Update App.tsx to Use New Three-Panel Layout

**Files:**
- Modify: `packages/client/src/App.tsx`

**Step 1: Restructure panel content**

Currently `App.tsx` passes `leftPanel` (which contains both file tree + diff viewer) and `rightPanel` to `MainLayout`. After the refactor:

- `leftPanel` → file tree only (`DiffPanel.PRFileTree`)
- `centerPanel` → diff viewer only (`DiffPanel.Viewer`)
- `rightPanel` → `SidePanel` (unchanged)

Remove:
- The `isFileTreeVisible` state and its toggle button (now handled by `SidebarTrigger`)
- The nested `ResizablePanelGroup` that splits file tree and diff viewer
- The `PanelLeftIcon`/`PanelLeftCloseIcon` imports from lucide

**Step 2: Add sidebar toggle buttons in TopBar**

Replace the existing file tree toggle button with two `SidebarTrigger` buttons:

```tsx
<TopBar.Actions>
  <SidebarTrigger /> {/* Left sidebar toggle */}
  {/* ... existing buttons ... */}
  <SidebarRightTrigger /> {/* Right sidebar toggle */}
</TopBar.Actions>
```

Note: `SidebarTrigger` must be rendered inside `SidebarProvider`, and `SidebarRightTrigger` inside `SidebarRightProvider`. The `MainLayout` wraps everything in both providers, so the `TopBar` must be moved inside `MainLayout` or the providers must wrap the entire app. The simplest approach: move the providers to wrap the entire app content in `App.tsx` directly, and keep `MainLayout` as the layout for the three panels without the providers.

Alternative (simpler): Instead of using the shadcn `SidebarProvider` context, manage state directly in `App.tsx` with `usePersistedState` and pass `isOpen`/`onToggle` props down. Use the `Sidebar` component with `collapsible="offcanvas"` but control state externally via the `open`/`onOpenChange` controlled props on `SidebarProvider`.

**Step 3: Verify**

Run: `pnpm --filter @codereview/client check-types`

---

### Task 4: Wire Up Keyboard Shortcuts

**Files:**
- Modify: `packages/client/src/App.tsx` (or rely on built-in `SidebarProvider` shortcuts)

**Step 1: Keyboard shortcuts**

The shadcn `SidebarProvider` already registers `Ctrl+B` for its toggle. For the right sidebar, `SidebarRightProvider` should register `Ctrl+]` or another key.

Verify both shortcuts work by testing in the browser.

**Step 2: Verify build**

Run: `pnpm --filter @codereview/client build`

---

### Task 5: Polish Sidebar Styling

**Files:**
- Modify: `packages/client/src/components/ui/sidebar.tsx` (minor tweaks if needed)
- Modify: `packages/client/src/components/ui/sidebar-right.tsx`

**Step 1: Adjust sidebar widths**

- Left sidebar (file tree): `--sidebar-width: 280px`
- Right sidebar (side panel): `--sidebar-width: 420px` or `30%`

**Step 2: Ensure the sidebars don't use `min-h-svh`**

The current `SidebarProvider` sets `min-h-svh` on its wrapper. Since our layout is `h-full` inside a `h-screen` container, change this to `h-full` for both providers.

**Step 3: Verify**

Run: `pnpm --filter @codereview/client build`

---

### Task 6: Clean Up Unused Code

**Files:**
- Modify: `packages/client/src/components/main-layout.tsx` (remove old resizable imports)
- Possibly remove: `packages/client/src/components/ui/resizable.tsx` (if no longer used elsewhere)

**Step 1: Check if resizable is still used**

Search for imports of `ResizablePanel`, `ResizablePanelGroup`, `ResizableHandle` across the codebase. If only used in the old `MainLayout`, remove the file. If still used (e.g., in DiffPanel for file tree split), keep it.

**Step 2: Remove dead imports and unused storage keys**

Remove `MAIN_LAYOUT_SIZES` from `StorageKeys` if no longer needed.

**Step 3: Final build verification**

Run:
```bash
pnpm --filter @codereview/client build
pnpm --filter @codereview/client lint
pnpm --filter @codereview/client check-types
```
