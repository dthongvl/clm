---
title: feat: Rebuild Review Guide as AI PR Review Notebook
type: feat
status: active
date: 2026-05-12
origin: docs/brainstorms/2026-05-12-ai-pr-review-notebook.md
---

# feat: Rebuild Review Guide as AI PR Review Notebook

## Overview

Replace the current Review Guide stepper with a center-panel **Notebook**: a self-contained, chaptered AI narrative for guided deep PR review. The Notebook streams an outline first, then chapter cells, renders inline diffs with shared draft/comment/thread annotation chrome, tracks deterministic completion, and supports per-chapter and full-notebook regeneration without coupling navigation to the File Changes tab.

This plan intentionally treats the existing stepper implementation as replaceable scaffolding. Reuse the proven seams where they still fit — SSE streaming, model settings, TanStack Query cache state, `ActionTriggerWithContext`, `AIProgressPanel`, `useAnnotations`, and `@pierre/diffs` rendering — but retire stepper concepts such as `steps`, `reviewedStepIds`, `currentStepId`, `focusFileGroup`, and off-route detection.

---

## Problem Frame

The origin document reframes the AI review surface from “navigation hints over the diff panel” into a sibling review mode with its own reading order and completion model (see origin: `docs/brainstorms/2026-05-12-ai-pr-review-notebook.md`). File Changes remains the canonical linear file-tree surface; Notebook becomes the AI-curated story surface. Both surfaces must share draft comments and thread state so a reviewer can author and resolve review conversations without switching tabs.

---

## Requirements Trace

- R1. Rename the center-panel “Review Guide” tab to “Notebook”; keep Notebook and File Changes as sibling center-panel tabs, never split or navigation-coupled. *(origin R1, R16)*
- R2. Replace the stepper data model with `Notebook → Chapter[] → Cell[]`, where chapters have stable ids, titles, and one-line intents. *(origin R2, R16)*
- R3. Support cell types `markdown`, `diff`, `note`, and `checklist`; render judgment threads inline within `diff` cells via annotation chrome, not as standalone cells. *(origin R3, R6, R8, R9)*
- R4. Stream notebook generation manually: outline first, then cells chapter-by-chapter, with partial output retained and labeled on failure. *(origin R12, R13, F1)*
- R5. Render diff cells as one-file diff readers that start in AI-highlighted hunk mode and can expand to full-file diff. *(origin R5, R6, F2)*
- R6. Track completion deterministically: auto-read markdown/diff/`info` notes by viewport, explicit ticking for checklist items, and explicit acknowledgment for `attention`, `security`, `performance`, and `risk` notes. *(origin R7, R10, R11, F2)*
- R7. Share draft comments and review threads across Notebook and File Changes; line-click in Notebook opens the same draft-comment composer and submitted draft appears in File Changes. *(origin R8, R9, F3)*
- R8. Provide sticky chapter rail with per-chapter progress, hidden for one-chapter notebooks, and click-to-jump within Notebook only. *(origin R4, F2)*
- R9. Support per-chapter regeneration as the primary refresh path and full-notebook regeneration as the escape hatch, preserving reviewer-authored threads via existing preservation semantics extended to notebook chapters. *(origin R14, R15, F4, F5)*
- R10. Remove old Stepper UI/types and do not migrate in-flight stepper state. *(origin R16)*

**Origin actors:** A1 Guided reviewer, A2 Notebook-generation AI
**Origin flows:** F1 Generate notebook, F2 Read chapter, F3 Comment/interact with threads, F4 Per-chapter regenerate, F5 Full-notebook regenerate

---

## Scope Boundaries

- Do not keep a “switch back to stepper” mode; old generated stepper state becomes irrelevant and opening Notebook shows the empty CTA until generation.
- Do not add Notebook export/share/persist-to-disk in v1.
- Do not add private margin notes or scratchpad primitives in v1.
- Do not auto-generate on PR open or first tab visit; generation remains reviewer-triggered.
- Do not replace the AI Review tab or fold AI Review issues into Notebook.
- Do not add nested chapter levels; the rail is single-level.
- Do not re-anchor orphaned threads with fuzzy matching in v1; use exact file/line/side anchoring and collect unresolved misses in a flat orphan archive.

### Deferred to Follow-Up Work

- Notebook confidence survey or calibrated rubric instrumentation: product analytics work after the v1 interaction surface exists.
- Sharing/exporting a generated Notebook: separate product iteration.
- Fuzzy orphan re-anchoring after large PR rewrites: separate hardening project if exact anchors prove too limiting.

---

## Context & Research

### Relevant Code and Patterns

- `packages/client/src/components/center-panel/index.tsx` already mounts the current `ReviewGuide.Root` as a center-panel tab and persists the selected center tab with `StorageKeys.CENTER_PANEL_TAB`.
- `packages/client/src/components/side-panel/index.tsx` and `packages/client/src/components/side-panel/side-panel-container.tsx` still expose a side-panel Review Guide tab; the Notebook plan should remove this duplicate surface.
- `packages/client/src/components/side-panel/review-guide/` contains the current stepper UI (`Stepper`, `StepCard`, `JudgmentThreadList`, `RegenerateModal`, `AiSourceBadge`) and can either be replaced in place or moved to a `notebook` component directory during cleanup.
- `packages/client/src/hooks/use-review-guide.ts` owns current stepper streaming state, `['review-guide']` cache state, pinned-thread preservation, and off-route detection. Its streaming/activity reducer is reusable; its stepper state model is not.
- `packages/server/src/services/review-guide.ts`, `packages/server/src/services/review-guide-prompt.ts`, `packages/server/src/types/review-guide.ts`, and `packages/server/src/routes/review-guide.ts` are the existing server-side AI action seams to adapt for Notebook generation.
- `packages/client/src/components/diff-panel/diff-viewer.tsx`, `packages/client/src/components/diff-panel/file-diff-card.tsx`, `packages/client/src/components/diff-panel/annotation-renderer.tsx`, and `packages/client/src/components/diff-panel/use-draft-annotations.ts` show how `@pierre/diffs` renders one file, creates inline draft forms, merges annotations, and delegates comment operations.
- `packages/client/src/hooks/use-annotations.ts` is the shared comments/drafts/AI-review operation seam that Notebook should reuse instead of implementing a parallel draft store.
- `packages/client/src/types/settings.ts` and `packages/server/src/services/settings.ts` define the existing `review-guide` action key. Keep this key for model settings compatibility unless implementation reveals an easy non-breaking alias.

### Institutional Learnings

- No `docs/solutions/` learnings were present in this repository at planning time.

### External References

- External research skipped: the work is primarily a repo-local migration using existing React, Hono, SSE, TanStack Query, and `@pierre/diffs` patterns already established in this codebase.

---

## Key Technical Decisions

- **Model Notebook as a new domain type, not as renamed steps.** `NotebookChapter` and `NotebookCell` should replace `ReviewGuideStep`; stepper fields (`fileGroup`, `rationale`, `lookFor`, `currentStepId`, `reviewedStepIds`) do not map cleanly to cell completion or chapter progress.
- **Keep the existing model-settings action key initially.** Continue using `review-guide` for server/client settings to avoid silently dropping user-selected models in `~/.config/clm/settings.toml`; expose user-facing copy as “Notebook”.
- **Use multi-phase generation on the server.** Generate and emit the chapter outline first, then generate chapter cells sequentially. This best satisfies outline-first rendering, per-chapter regeneration, and partial failure retention. If implementation cost is too high, a single prompt may be kept only if it can still emit a parseable outline event before cells.
- **Prove the diff-cell annotation seam before broad rewrites.** The highest-risk dependency is embedding a one-file diff cell with the same draft composer and shared thread state as File Changes. Start with that validation so the UI and stream contract are not built around an impossible renderer assumption.
- **Represent diff highlights as stable line-range descriptors, not raw hunk indices.** Use `filePath`, `side`, and old/new line ranges so AI output and regeneration can be matched against diff data without depending on `@pierre/diffs` internal hunk indexing.
- **Reuse the shared annotation operation seam.** Notebook diff cells should call the same draft/comment operations as File Changes through `useAnnotations`; do not create a notebook-only draft-comment implementation.
- **Introduce one shared annotation adapter.** Extend `useAnnotations` or add an adjacent hook so both File Changes and Notebook consume the same merged annotation metadata plus the same draft/comment/judgment-thread operations. `DiffPanelViewerContainer` must be wired through this seam, not left on an older comments-only path.
- **Render AI judgment threads through the diff annotation layer.** Existing `JudgmentThread` concepts may remain as cache entities, but rendering belongs in the same gutter/inline annotation path as comments and drafts so both surfaces observe the same thread state.
- **Lock completion semantics by cell type and note severity.** Markdown, diff, and `info` note cells complete by auto-read; `attention`, `security`, `performance`, and `risk` note cells require explicit acknowledgment; checklist items require explicit ticking. Orphan archive entries are archival only and never affect chapter or notebook completion in v1.
- **Completion state is client-local TanStack Query state for v1.** The origin explicitly excludes disk persistence/export; local cache state is sufficient and mirrors the current guide implementation.
- **Retire off-route detection completely.** Notebook chapter navigation scrolls inside Notebook; it never calls `focusFileGroup` or depends on `selectedFilePath` from File Changes.

---

## Open Questions

### Resolved During Planning

- **Can Notebook reuse existing comment/draft infrastructure?** Yes, with a refactor. `useAnnotations` already merges submitted comments and GitHub draft comments and exposes add/edit/delete/reply operations. The missing piece is making the annotation index and renderer accept notebook judgment-thread metadata in addition to comments/drafts/AI-review items.
- **Should the public UI remain “Review Guide”?** No. The center-panel tab, empty state, CTA, and copy should say “Notebook”; internal action key compatibility can remain `review-guide`.
- **Should Notebook live in the side panel?** No. The side-panel Review Guide tab is leftover from the prior plan and should be removed for v1.
- **Should diff cells use hunk indices?** No. Use line-range descriptors to avoid binding the AI contract to parser internals.

### Deferred to Implementation

- **Exact `@pierre/diffs` API for highlighted-only rendering:** determine while extracting/reusing `FileDiffCard`; if no native line filtering exists, implement highlighted mode as full diff with non-highlighted unchanged regions collapsed before adding a custom slicer.
- **Viewport threshold tuning:** start with a conservative threshold and delay, then tune during UI verification.
- **Final file/directory names:** prefer `notebook` names for new code, but allow minimal in-place replacement when it reduces churn without leaking stepper concepts into public types.

---

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```diagram
╭────────────────────╮       manual generate        ╭────────────────────────╮
│ Center tab:        │─────────────────────────────▶│ Notebook stream route  │
│ Notebook.Root      │                              │ /api/ai/review-guide   │
╰─────────┬──────────╯                              ╰───────────┬────────────╯
          │                  outline event                      │
          │◀─────────────────────────────────────────────────────╯
          │                  chapter/cell events
          │◀─────────────────────────────────────────────────────╮
          ▼                                                       │
╭────────────────────╮        cache writes        ╭──────────────┴───────────╮
│ useNotebookState   │◀──────────────────────────▶│ generateNotebookStream   │
│ chapters/cells     │                            │ outline + chapter passes │
│ completion/thread  │                            ╰──────────────────────────╯
╰─────────┬──────────╯
          │
          │ renders cells + shared annotations
          ▼
╭────────────────────╮       same operations       ╭──────────────────────────╮
│ NotebookDiffCell   │────────────────────────────▶│ useAnnotations / drafts  │
│ @pierre/diffs      │                             │ comments / replies       │
╰─────────┬──────────╯                             ╰────────────┬─────────────╯
          │                                                       │
          ╰──────────────── shared query caches ─────────────────╯
                          File Changes sees same drafts/comments
```

---

## Implementation Units

- [ ] U8. **Validate the reusable Notebook diff-cell annotation seam**

**Goal:** Prove that a single Notebook diff cell can reuse the existing one-file diff renderer, inline draft composer, and shared judgment-thread controls before the implementation commits to the full Notebook stream/state rewrite.

**Requirements:** R3, R5, R7

**Dependencies:** None

**Files:**
- Modify or spike within: `packages/client/src/components/diff-panel/file-diff-card.tsx`
- Modify or spike within: `packages/client/src/components/diff-panel/annotation-renderer.tsx`
- Modify or spike within: `packages/client/src/hooks/use-annotations.ts`
- Modify or spike within: `packages/client/src/components/diff-panel/diff-panel-viewer-container.tsx`

**Approach:**
- Build the smallest vertical slice that renders one chosen `DiffFileData` as a Notebook-style cell and feeds it comments, drafts, and one synthetic notebook judgment thread through the same annotation renderer.
- Validate that line selection opens the inline draft form and submits through the GitHub draft-comment path, not a Notebook-local placeholder.
- Validate that a notebook judgment thread can render and mutate through the same metadata path that File Changes can consume.
- Keep any spike code only if it is production-shaped; otherwise fold the finding into U3 and remove throwaway code before continuing.

**Execution note:** Treat this as a characterization-first spike: verify the existing renderer seam before expanding the Notebook contract.

**Patterns to follow:**
- `packages/client/src/components/diff-panel/diff-viewer.tsx` for how `FileDiffCard` is currently driven.
- `packages/client/src/hooks/use-annotations.ts` for draft/comment operations.

**Test scenarios:**
- Happy path: rendering one Notebook diff cell with a real `DiffFileData` displays the same inline annotation chrome as File Changes.
- Happy path: selecting a line in the spike cell opens and submits a draft through `useDraftComments`.
- Happy path: a synthetic notebook judgment thread renders with reply/resolve/pin controls through the shared annotation renderer.
- Error path: if `@pierre/diffs` cannot render the one-file cell outside `DiffViewer`, document the required renderer extraction before U1/U3 proceed.

**Verification:**
- Client typecheck still passes after any retained seam changes.
- The implementation path for U3 is either validated or explicitly revised before broader stream/state work begins.

---

- [ ] U1. **Define the Notebook wire contract and server parser**

**Goal:** Replace the stepper-shaped server contract with a notebook-shaped contract that supports outline-first streaming, chapter cells, diff highlights, notes, checklists, and inline judgment-thread anchors.

**Requirements:** R2, R3, R4, R5, R9, R10

**Dependencies:** U8

**Files:**
- Modify: `packages/server/src/types/review-guide.ts`
- Modify: `packages/server/src/services/review-guide.ts`
- Modify: `packages/server/src/services/review-guide-prompt.ts`
- Modify: `packages/server/src/services/review-guide.test.ts`
- Modify: `packages/server/src/services/review-guide-prompt.test.ts`
- Modify: `packages/client/src/api/ai.ts`
- Modify: `packages/client/src/api/ai-stream.ts`

**Approach:**
- Introduce notebook DTOs: `Notebook`, `NotebookChapter`, `NotebookCell` union, `NotebookOutlineEvent`, chapter/cell stream events, and terminal events.
- Keep the existing route/action setting key unless implementation chooses a compatibility alias; the payload should become Notebook-shaped even if the endpoint path remains `/api/ai/review-guide/stream`.
- Define per-chapter regeneration at the wire level: request includes `chapterId`, the current chapter `title` and `intent`, optional reviewer hint, and enough notebook outline context for narrative consistency; response preserves the same `chapterId` even if title, intent, and cells change.
- Parse AI JSON defensively: invalid cells are skipped or downgraded to safe markdown/note cells; invalid whole responses produce an inline error event without erasing already-emitted outline/chapter state.
- Use line-range descriptors for `diff` cell highlights: file path plus old/new side-aware ranges.
- Ensure generated chapter ids are stable across the notebook lifetime and across scoped chapter regeneration; generated cell ids are stable within the generated chapter payload when AI omits ids (`chapter-1`, `cell-1-1`, etc.).

**Execution note:** Start with server parser tests before changing client consumers; the wire contract is the riskiest shared seam.

**Patterns to follow:**
- `packages/server/src/services/review-guide.ts` for SSE event forwarding and JSON parsing structure.
- `packages/server/src/services/grouping.ts` for parsed result events.
- `packages/server/src/utils/json-extract.ts` for safe JSON extraction.

**Test scenarios:**
- Happy path: outline JSON with two chapters parses into stable chapter ids, titles, and intents.
- Happy path: chapter-cell JSON parses markdown, diff, info note, risk note, and checklist cells into a `NotebookCell[]` union.
- Edge case: a diff cell with an unknown file path is retained but flagged so the client can render a missing-diff warning instead of crashing.
- Edge case: omitted ids receive deterministic fallback ids without collisions across chapters and cells.
- Edge case: chapter regeneration response for `chapter-2` preserves `chapter-2` even when the regenerated title/intent changes.
- Error path: malformed AI output returns a safe empty/partial structure and logs a warning without throwing out of the stream generator.
- Error path: invalid note severity downgrades to `info`; invalid checklist item ids get deterministic fallbacks.
- Integration: generated stream emits outline before any cell-bearing event and emits exactly one terminal event on success or failure.

**Verification:**
- Server tests cover parser/prompt contract changes.
- Server typecheck accepts the new stream event union and route return types.

---

- [ ] U2. **Implement Notebook streaming and cache state on the client**

**Goal:** Replace `useStreamingReviewGuide` / `useReviewGuideState` stepper state with Notebook streaming, partial state retention, completion state, chapter regeneration, and orphan archive state.

**Requirements:** R2, R4, R6, R8, R9, R10

**Dependencies:** U8, U1

**Files:**
- Modify or replace: `packages/client/src/hooks/use-review-guide.ts`
- Modify: `packages/client/src/hooks/index.ts`
- Modify: `packages/client/src/types/review-guide.ts`
- Modify: `packages/client/src/lib/transforms.ts`
- Modify: `packages/client/src/api/ai-stream.ts`

**Approach:**
- Replace `ReviewGuideState` with `NotebookState`: `notebook`, generation status by chapter, `cellCompletion`, `expandedDiffCellIds`, `acknowledgedNoteIds`, `checkedChecklistItemIds`, judgment threads, and orphan thread archive.
- Reducer handles incremental events: outline creates chapter shells; cell events append to chapter shells; chapter completion clears generating state; terminal errors mark incomplete chapters partial while preserving completed cells.
- Provide mutators for read/unread, note acknowledge/unacknowledge, checklist tick/untick, diff expand/collapse, per-chapter regeneration prep/apply, full regeneration prep/apply, and thread lifecycle actions.
- Remove `useOffRoute`; remove state derived from `selectedFilePath`.
- Keep the empty state behavior after old stepper cache: no migration from previous `guide`/`steps` cache.

**Patterns to follow:**
- Current `packages/client/src/hooks/use-review-guide.ts` reducer and TanStack Query cache writes.
- `packages/client/src/hooks/use-ai-review.ts` streaming reducer shape for activities/status.

**Test scenarios:**
- Happy path: outline event creates chapter shells before cell events arrive.
- Happy path: cell events append to the correct chapter and update chapter progress from 0% toward 100% as completion mutators run.
- Happy path: markdown/diff/info note read mutators mark cells complete; checklist items and `attention`, `security`, `performance`, and `risk` notes remain incomplete until explicit user action.
- Edge case: a cell event for an unknown chapter creates a partial/error marker or is ignored with no crash.
- Error path: terminal stream error after one complete chapter retains that chapter and marks later chapters partial.
- Integration: full regeneration resets read/check/ack state, preserves authored threads per policy, and creates orphans for preserved thread anchors absent from the new notebook.
- Integration: per-chapter regeneration discards only that chapter's cells and completion state while preserving other chapters unchanged.

**Verification:**
- Client typecheck accepts the new Notebook hook exports and no consumer imports `useOffRoute`.
- Manual reducer exercise in the browser shows partial generation state instead of blanking the Notebook on failure.

---

- [ ] U3. **Create shared annotation support for Notebook diff cells**

**Goal:** Let Notebook diff cells render the same draft-comment composer, submitted comments, AI review annotations where appropriate, and notebook judgment-thread bubbles as File Changes.

**Requirements:** R3, R5, R7, R9

**Dependencies:** U8, U2

**Files:**
- Modify: `packages/client/src/hooks/use-annotations.ts`
- Modify: `packages/client/src/components/diff-panel/diff-panel-viewer-container.tsx`
- Modify: `packages/client/src/components/diff-panel/diff-viewer.tsx`
- Modify: `packages/client/src/components/diff-panel/file-diff-card.tsx`
- Modify: `packages/client/src/components/diff-panel/annotation-renderer.tsx`
- Modify: `packages/client/src/components/comment-thread/inline-comment-thread.tsx`
- Modify: `packages/client/src/types/review-guide.ts`

**Approach:**
- Generalize annotation metadata to include `notebook-judgment-thread` entries alongside comments, drafts, and AI review items.
- Expose a single shared annotation adapter so File Changes and Notebook diff cells receive merged annotation metadata plus draft/comment/judgment-thread operations from one source of truth.
- Update `DiffPanelViewerContainer` to consume the shared adapter and pass notebook judgment-thread annotations into File Changes, rather than leaving File Changes on a comments/drafts-only path.
- Render notebook judgment threads with full reply / resolve / pin / unpin / unresolve controls and an AI-source badge, but keep them out of the `NotebookCell` union as standalone cells.
- Ensure draft comments created from Notebook diff cells write through `useDraftComments` so File Changes observes them through the existing `['draft-comments']` query.
- Ensure File Changes can render relevant notebook judgment threads if those anchors are present in the file diff, satisfying shared thread state rather than hiding AI judgment in Notebook only.

**Patterns to follow:**
- `packages/client/src/components/diff-panel/use-draft-annotations.ts` for inline draft lifecycle.
- `packages/client/src/components/diff-panel/annotation-renderer.tsx` for metadata-based rendering.
- `packages/client/src/components/side-panel/review-guide/judgment-thread-list.tsx` for existing judgment-thread actions, adapted away from side-panel cards.

**Test scenarios:**
- Happy path: selecting a line in a Notebook diff cell opens the inline draft form and submitting it creates a draft that appears in File Changes.
- Happy path: an existing GitHub draft comment anchored to the same file/line appears inside Notebook diff cells.
- Happy path: a notebook judgment thread renders with AI-source treatment and supports reply, resolve, pin, unpin, and unresolve.
- Edge case: comments, drafts, AI review items, and notebook judgment threads on the same file merge without dropping any annotation type.
- Error path: failed draft submission leaves the draft form visible and does not mark the cell complete by side effect.
- Integration: resolving or replying to a judgment thread in File Changes is reflected in Notebook without a refresh, and vice versa.
- Integration: `DiffPanelViewerContainer` renders notebook judgment threads anchored to visible File Changes lines through the same adapter Notebook uses.

**Verification:**
- Client typecheck covers shared metadata types and renderer exhaustiveness.
- Browser verification confirms one draft/comment store is shared by Notebook and File Changes.

---

- [ ] U4. **Build the Notebook center-panel UI and completion model**

**Goal:** Replace the stepper UI with a polished Notebook reader: empty CTA, outline/chapter shells, sticky chapter rail, chapter content, cell completion controls, diff highlight/full expansion, and progress counters.

**Requirements:** R1, R2, R3, R5, R6, R8, R10

**Dependencies:** U2, U3

**Files:**
- Modify: `packages/client/src/components/center-panel/index.tsx`
- Replace or create within: `packages/client/src/components/side-panel/review-guide/`
- Potentially create: `packages/client/src/components/notebook/`
- Modify: `packages/client/src/components/ui/markdown.tsx`
- Modify: `packages/client/src/lib/storage.ts` if tab values need compatibility handling

**Approach:**
- Rename the center nav item label to “Notebook” while preserving old stored tab value compatibility if `review-guide` is already in localStorage.
- Render the empty state from the origin decision: notebook-style icon, “Start a guided review”, value proposition, and primary “Generate Notebook” button.
- Render chapter shells immediately after outline, including generating/partial/error status per chapter.
- Hide chapter rail when there is one chapter; otherwise keep a sticky rail with title, intent tooltip or subtitle, and progress percentage.
- Use `IntersectionObserver`-based auto-read for markdown, diff, and info note cells; expose manual uncheck for auto-read cells.
- Render `attention`, `security`, `performance`, and `risk` notes with explicit acknowledgment controls; render `info` notes with the auto-read rule; render checklists with item-level checkboxes.
- Diff cells start in highlighted mode and include a “Show full diff” / collapse affordance.

**Patterns to follow:**
- Existing shadcn/base UI primitives in `packages/client/src/components/ui/`.
- `packages/client/src/components/side-panel/action-trigger-with-context.tsx` and `packages/client/src/components/side-panel/ai-progress-panel/` for generation controls.
- Current `packages/client/src/components/center-panel/index.tsx` tab persistence pattern.

**Test scenarios:**
- Happy path: a reviewer opens Notebook, sees the empty CTA, clicks Generate, then sees chapter shells before all cells arrive.
- Happy path: a two-chapter notebook shows a rail with progress; clicking a rail item scrolls within Notebook without changing File Changes selection.
- Happy path: a one-chapter notebook hides the rail.
- Happy path: markdown and diff cells auto-mark read after meeting viewport threshold, and manual uncheck returns them to incomplete.
- Happy path: `attention`, `security`, `performance`, and `risk` note cells plus checklist cells remain incomplete until explicit ack/tick, while `info` notes complete through auto-read.
- Edge case: chapter with zero cells renders a partial/empty chapter state and does not divide progress by zero.
- Error path: missing diff file in a diff cell renders a clear inline warning and does not crash the Notebook.
- Integration: notebook-level progress shows chapters complete / total chapters plus required items still needing acknowledgment.

**Verification:**
- Client typecheck passes.
- Browser verification covers empty, streaming, complete, partial error, one-chapter, multi-chapter, and missing-diff states.

---

- [ ] U5. **Implement per-chapter and full-notebook regeneration with orphan preservation**

**Goal:** Add regeneration controls and preservation behavior matching the chaptered Notebook model.

**Requirements:** R4, R7, R9

**Dependencies:** U1, U2, U3, U4

**Files:**
- Modify: `packages/client/src/hooks/use-review-guide.ts`
- Modify: `packages/client/src/components/side-panel/review-guide/regenerate-modal.tsx` or Notebook replacement modal
- Modify: `packages/client/src/components/side-panel/review-guide/index.tsx` or Notebook replacement root
- Modify: `packages/server/src/routes/review-guide.ts`
- Modify: `packages/server/src/services/review-guide.ts`
- Modify: `packages/server/src/services/review-guide-prompt.ts`

**Approach:**
- Add a per-chapter regenerate action with optional reviewer hint; only the target chapter's cells and completion state are reset.
- Send per-chapter regeneration requests with the stable `chapterId`, current `title`, current `intent`, optional reviewer hint, and surrounding outline context; require the response to preserve `chapterId`.
- Add full-notebook regenerate confirmation that warns read/check/ack state resets.
- Preserve pinned threads always and unresolved threads according to the confirmation policy; discard resolved unpinned threads when regenerating the affected scope.
- Reattach preserved threads by exact `filePath`, `side`, and `lineNumber` against the new chapter/cell diff anchors.
- Put preserved threads whose anchors are no longer present into a flat orphan archive below the last AI-generated chapter, retaining file path and line metadata.
- Treat orphan archive entries as archival only; they never affect chapter or notebook completion in v1.
- Notify reviewer when a chapter regeneration creates new orphans.

**Patterns to follow:**
- Current `prepareRegeneration` shape in `packages/client/src/hooks/use-review-guide.ts`.
- Current `RegenerateModal` confirmation pattern.

**Test scenarios:**
- Happy path: regenerating chapter 2 clears only chapter 2 cells and completion state; chapter 1 and 3 content/progress remain unchanged.
- Happy path: a per-chapter hint is sent to the server and affects only that chapter request payload.
- Happy path: regenerated chapter 2 preserves the same chapter id and rail target even if the AI changes the title or intent.
- Happy path: full regeneration clears all cells/read/check/ack state and streams a fresh outline.
- Edge case: a pinned thread in a regenerated chapter with the same anchor reappears inline after new cells arrive.
- Edge case: a pinned or unresolved thread whose anchor no longer appears is moved to the orphan archive with file path, side, and line number.
- Error path: failed chapter regeneration leaves the chapter marked partial/error and does not erase other chapters.
- Integration: orphan archive entries remain reviewer-visible and never block chapter or notebook completion in v1.

**Verification:**
- Server typecheck covers regeneration request payloads.
- Browser verification demonstrates scoped regeneration, full regeneration, preservation, and orphan rendering.

---

- [ ] U6. **Retire stepper surfaces and clean up duplicated Review Guide wiring**

**Goal:** Remove the old Stepper UI/types and the duplicate side-panel Review Guide tab so Notebook is the only guided review surface.

**Requirements:** R1, R10

**Dependencies:** U4, U5

**Files:**
- Modify: `packages/client/src/components/side-panel/index.tsx`
- Modify: `packages/client/src/components/side-panel/side-panel-container.tsx`
- Delete or replace: `packages/client/src/components/side-panel/review-guide/stepper.tsx`
- Delete or replace: `packages/client/src/components/side-panel/review-guide/step-card.tsx`
- Delete or replace: `packages/client/src/components/side-panel/review-guide/judgment-thread-list.tsx` if superseded by inline annotations
- Modify: `packages/client/src/hooks/index.ts`
- Modify: `packages/client/src/App.tsx` comments if they still mention “Review Guide”
- Modify: `packages/client/src/types/index.ts` if notebook types need export changes

**Approach:**
- Remove `review-guide` from side-panel tab values, triggers, content components, and side-panel container imports.
- Ensure center-panel Notebook still mounts inside `DiffPanelProvider` so it can access diff data and shared annotation operations.
- Remove stepper-only components once Notebook equivalents compile.
- Update comments/copy to avoid describing Notebook as a route through File Changes.
- Keep storage compatibility safe: if an old side-panel tab value is `review-guide`, fall back to `description`; if an old center tab value is `review-guide`, treat it as Notebook.

**Patterns to follow:**
- Current storage fallback pattern in `packages/client/src/components/center-panel/index.tsx` and `packages/client/src/components/side-panel/index.tsx`.

**Test scenarios:**
- Happy path: side panel only offers Description, Grouping, and AI Review.
- Happy path: center panel offers Description, Notebook, and File Changes.
- Edge case: localStorage with `side-panel-tab = review-guide` falls back to Description without rendering an invalid tab.
- Edge case: localStorage with `center-panel-tab = review-guide` opens Notebook.
- Integration: no imports or exports reference `Stepper`, `StepCard`, `useOffRoute`, `ReviewGuideStep`, or `reviewedStepIds` after cleanup.

**Verification:**
- `rg` confirms removed stepper symbols are gone or intentionally retained only in compatibility comments/tests.
- Client typecheck and lint pass with no unused imports.

---

- [ ] U7. **End-to-end verification, accessibility, and prompt quality pass**

**Goal:** Verify Notebook behavior across the full user journey and tighten accessibility/prompt details discovered during implementation.

**Requirements:** R1–R10

**Dependencies:** U8, U1–U6

**Files:**
- Modify: `packages/server/src/services/review-guide-prompt.ts`
- Modify: `packages/server/src/services/review-guide-prompt.test.ts`
- Modify: Notebook UI files from U4/U5 as needed
- Modify: `docs/brainstorms/2026-05-12-ai-pr-review-notebook.md` only if implementation uncovers a source requirement ambiguity that should be captured upstream

**Approach:**
- Run a manual browser path against a real or fixture PR: generate, read, comment, regenerate one chapter, regenerate full notebook.
- Verify keyboard navigation for chapter rail, diff expand/collapse, ack buttons, checklist items, and inline comment forms.
- Ensure streaming status announcements and partial/error states have usable labels for screen readers.
- Tune prompt instructions so output uses the agreed notebook schema and avoids standalone thread cells.
- Confirm File Changes behavior remains unchanged except that shared notebook judgment threads may also appear when anchored to visible lines.

**Patterns to follow:**
- Existing UI accessibility conventions in `packages/client/src/components/ui/`.
- Existing server prompt tests for schema constraints.

**Test scenarios:**
- Happy path: first-time reviewer can generate a notebook, see outline quickly, read chapter 1 while later chapters generate, and reach 100% completion.
- Happy path: reviewer creates a draft comment in Notebook and then sees/edits/deletes it in File Changes.
- Happy path: reviewer replies to or resolves a judgment thread in either surface and sees the same state in the other.
- Edge case: canceling an active stream preserves already-arrived outline/cells as partial rather than clearing the Notebook.
- Edge case: keyboard-only reviewer can use the chapter rail, expand a diff cell, acknowledge a risk note, tick a checklist item, and submit/cancel a draft form.
- Error path: server stream failure after outline and some cells shows inline failure state and a retry affordance.
- Regression: File Changes still loads, scrolls, comments, viewed-file toggles, and AI Review annotations behave as before.

**Verification:**
- Server and client typechecks pass.
- Client lint passes.
- Manual browser verification covers the scenarios above.

---

## System-Wide Impact

- **Interaction graph:** Notebook becomes a center-panel peer of Description and File Changes. It consumes diff data from `DiffPanelContext`, draft/comment operations from `useAnnotations`, and AI streaming from the existing review-guide endpoint/service seam.
- **Error propagation:** Server generation errors become terminal stream errors; the client must preserve already-written notebook state and mark affected chapters partial/error instead of replacing state with `null`.
- **State lifecycle risks:** Completion, expansion, and generation status are local cache state. Regeneration must carefully scope resets to a chapter or whole notebook without mutating unrelated chapters or authored threads.
- **API surface parity:** The server/client stream event union changes from single final `result` to incremental outline/chapter/cell events. All consumers of `ReviewGuideStreamEvent` must be updated together.
- **Integration coverage:** Shared annotation behavior crosses Notebook, File Changes, GitHub draft comments, submitted comments, and notebook judgment threads; manual cross-surface verification is required because the client has no configured test runner.
- **Unchanged invariants:** File Changes remains the canonical linear file tree; AI Review remains a separate surface; generation remains manual; GitHub draft review APIs and submitted review payloads are unchanged by this plan.

---

## Risk Analysis & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| `@pierre/diffs` does not support exact highlighted-hunk-only rendering | Medium | Medium | Start with full-file diff rendering plus collapsed unchanged regions; only add custom highlight filtering if needed. |
| Shared annotation refactor regresses File Changes comments | Medium | High | Keep `useAnnotations` as the operation source of truth; verify File Changes comment/draft/reply flows after U3 and U7. |
| Multi-phase AI generation increases latency/cost | Medium | Medium | Emit outline quickly, stream chapters sequentially, and keep per-chapter regeneration to avoid full reruns for small fixes. |
| Notebook prompt emits malformed cells | High | Medium | Parser is defensive, prompt tests enforce schema constraints, UI renders safe partial/error cells. |
| Regeneration preservation rules confuse reviewers | Medium | Medium | Modal copy must explicitly state what resets, what is preserved, and where orphans appear. |
| Old side-panel Review Guide remains reachable | Medium | Medium | U6 removes duplicate side-panel tab and validates old localStorage fallback. |
| Client lacks automated component tests | High | Medium | Use typecheck/lint plus enumerated manual browser verification; keep state logic pure where practical for future tests. |

---

## Documentation / Operational Notes

- Update user-facing copy from “Review Guide” to “Notebook” in the center panel and empty state.
- Keep internal `review-guide` settings key unless a compatibility alias is implemented; this avoids silently dropping model preferences.
- No data migration is required for old stepper cache state; stale in-memory state disappears on reload and old generated guides show the empty Notebook CTA.
- If the endpoint path remains `/api/ai/review-guide/stream`, document in code comments that it backs the Notebook UI for compatibility.

---

## Sources & References

- **Origin document:** [docs/brainstorms/2026-05-12-ai-pr-review-notebook.md](../brainstorms/2026-05-12-ai-pr-review-notebook.md)
- Prior plan being superseded: `docs/plans/2026-05-09-001-feat-ai-pr-review-stepper-guide-plan.md`
- Related code: `packages/client/src/components/center-panel/index.tsx`
- Related code: `packages/client/src/components/side-panel/review-guide/`
- Related code: `packages/client/src/hooks/use-review-guide.ts`
- Related code: `packages/client/src/hooks/use-annotations.ts`
- Related code: `packages/client/src/components/diff-panel/`
- Related code: `packages/server/src/services/review-guide.ts`
- Related code: `packages/server/src/services/review-guide-prompt.ts`
- Related code: `packages/server/src/routes/review-guide.ts`
