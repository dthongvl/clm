---
date: 2026-05-12
topic: ai-pr-review-notebook
supersedes: docs/brainstorms/2026-05-09-ai-pr-review-stepper-guide.md
---

# AI PR Review Notebook

## Problem Frame

The current Review Guide is a stepper coupled to the diff panel: each step focuses the diff viewer on a file group, marks the reviewer as "off-route" when they navigate elsewhere, and treats the AI's contribution as navigation hints over a single linear file-by-file diff. This conflates two reading modes — *linear file-tree review* (what the File Changes tab does well) and *guided narrative review* (what the AI is uniquely good at) — into one surface, and asks the reviewer to keep both mental models in their head at once.

We want to split them. **File Changes** stays the canonical linear, file-tree-driven review surface. The Review Guide is reborn as a **Notebook**: a self-contained, Jupyter-style narrative the reviewer reads top-to-bottom, with prose, inline diffs, attention notes, and checklists composed by the AI in a story order it chooses. The notebook never drives the File Changes tab and never depends on it — they are two sibling ways to review the same PR, sharing state (threads and draft comments) but not navigation.

The reader job we are optimizing for is **guided deep review**: the reviewer wants to read the code, line by line, in an order the AI has curated, with prose framing each chunk and explicit prompts for the things requiring active human judgment.

---

## Actors

- A1. **Guided reviewer** — opens a PR they did not write. Wants to read the code in a meaningful order, understand each chunk in context, and finish with confidence that they actively considered everything the AI flagged for human judgment.
- A2. **Notebook-generation AI** — produces the chapter outline (fast first pass), then streams cells (markdown / diff / note / checklist / thread) per chapter. Re-runnable per-chapter or for the whole notebook.

---

## Key Flows

- F1. **Generate notebook (manual trigger)**
  - **Trigger:** Reviewer opens the Notebook tab in the center panel and clicks "Generate Notebook."
  - **Actors:** A1, A2.
  - **Steps:**
    1. AI emits the chapter outline first (title + 1-line intent per chapter); chapter rail and chapter shells render immediately.
    2. AI streams cells into each chapter in order. Reviewer can begin reading Chapter 1 while later chapters are still generating.
    3. On completion, all chapters are filled; "Generate" turns into "Regenerate."
    4. **On failure:** error surfaces inline; partial output for completed chapters is retained and labeled "partial"; reviewer can retry or regenerate.
  - **Outcome:** Notebook is browsable; chapter rail shows progress placeholders for any in-flight chapters.
  - **Covered by:** R1, R2, R3, R4, R12.

- F2. **Read a chapter end-to-end**
  - **Trigger:** Reviewer scrolls or jumps to a chapter via the rail.
  - **Actors:** A1.
  - **Steps:**
    1. Reviewer reads markdown framing, then inline diff cells (full file diffs, with AI attention guidance via adjacent markdown cells), then notes and checklist cells in the order the AI chose.
    2. Markdown and diff cells auto-mark as "read" when sufficiently in viewport; reviewer can manually uncheck.
    3. Checklist items must be explicitly ticked; attention/security/risk notes must be explicitly acknowledged.
    4. For any diff cell, the reviewer may click "Show full diff" to expand the cell from AI-highlighted hunks to the complete file diff, or collapse back to the AI-curated view.
  - **Outcome:** Chapter % advances; chapter completes when all cells satisfy their completion rule.
  - **Covered by:** R5, R6, R7, R10, R11.

- F3. **Comment / interact with threads inside the notebook**
  - **Trigger:** Reviewer clicks a line in a diff cell, or interacts with a judgment thread inline.
  - **Actors:** A1.
  - **Steps:**
    1. Clicking a line opens the same draft-comment composer used in File Changes; new draft comments are written to the shared store and become visible in File Changes too.
    2. Existing judgment threads anchored to lines in the cell render inline (reply, resolve, pin, unpin, unresolve), using the same store as File Changes.
    3. Reviewer never has to switch to the File Changes tab to read or write a comment.
  - **Outcome:** Comment/thread state is the union of both surfaces; either tab is a complete authoring surface.
  - **Covered by:** R8, R9.

- F4. **Per-chapter regenerate (primary regen affordance)**
  - **Trigger:** Reviewer clicks "Regenerate this chapter" on a chapter (optionally with a hint, e.g. "split this into two chapters" or "go deeper on the auth changes").
  - **Actors:** A1, A2.
  - **Steps:**
    1. Only that chapter's cells are discarded; all other chapters retain their content and the reviewer's read/ack/check state.
    2. Threads anchored inside the regenerated chapter follow F5 preservation rules.
    3. New cells stream into the chapter shell.
  - **Outcome:** Surgical refresh; the rest of the notebook is undisturbed.
  - **Note:** Per-chapter regeneration may create narrative inconsistencies if later chapters reference intents from the pre-regen chapter. For major rewrites, prefer full-notebook regeneration.
  - **Covered by:** R14.

- F5. **Full-notebook regenerate (escape hatch)**
  - **Trigger:** Reviewer clicks "Regenerate full notebook" (e.g., after large new commits).
  - **Actors:** A1, A2.
  - **Steps:**
    1. Confirmation modal warns that read-state, checks, and acknowledgments will be reset; pinned and unresolved threads will be preserved (existing `prepareRegeneration` flow extended).
    2. Outline streams, then cells stream (per F1).
    3. Preserved threads attach to whichever cells contain their anchor lines; threads whose lines are no longer present are collected into a flat archived orphan section below the last AI-generated chapter.
  - **Outcome:** Fresh notebook; nothing the reviewer authored (drafts, threads) is lost.
  - **Covered by:** R15.

---

## Requirements

**Notebook surface and structure**
- R1. The Notebook lives in the existing center-panel tab currently named "Review Guide" (rename to "Notebook"). It does not move to the side panel and does not split with File Changes. Only one center-panel tab is visible at a time.
- R2. The Notebook is structured as `Chapter[] → Cell[]`. Each chapter has a stable id, a title, and a one-line intent ("Why read this chapter").
- R3. Cell types are: `markdown`, `diff`, `note`, `checklist`. Threads render inline within `diff` cells via gutter bubbles, not as standalone cells.
- R4. A sticky chapter rail renders chapter titles and per-chapter progress %, and supports click-to-jump. When the notebook has only one chapter, the rail is hidden.

**AI editorial control over diffs**
- R5. `diff` cells reference one file each and render the diff starting with AI-highlighted hunks visible and the full file collapsed by default. The reviewer may expand the cell to display the full file diff using the same diff viewer used in File Changes. This balances the guided reading goal (reviewer sees the AI's focus areas first) with auditability (full diff is one click away).
- R6. Every `diff` cell supports the same annotation chrome (line-click → draft composer, gutter thread bubbles) as File Changes, since the cell shows the complete diff.

**Reading and completion model**
- R7. `markdown` and `diff` cells auto-mark as "read" when in viewport above a configurable visibility threshold; reviewer may manually uncheck. Inline thread content within `diff` cells is considered "read" when the parent diff cell is read. Checklist items require explicit ticking. `note` cells with severity `attention`, `security`, `performance`, or `risk` require explicit acknowledgment. Notes with severity `info` follow the auto-read rule.
- R8. The notebook shares its threads and draft-comment store with File Changes. New draft comments created inside a notebook diff cell appear in File Changes; thread replies / resolves / pins made in either surface are reflected in the other immediately.
- R9. Inside diff cells, line-click opens the same draft-comment composer as File Changes. Existing judgment threads anchored to visible lines render inline within the cell with full reply / resolve / pin / unpin / unresolve controls.

**Progress reporting**
- R10. Chapter progress % = (cells satisfying their completion rule) / (total cells in chapter).
- R11. Notebook-level progress is shown as `chapters complete / total chapters` plus a flat "X items still need acknowledgment" counter when any unsatisfied required item exists.

**Generation, streaming, regeneration**
- R12. Notebook generation is **manually triggered** by the reviewer in the Notebook tab. There is no auto-generation on PR open or tab visit.
- R13. Generation streams the chapter outline first (titles + intents), then streams cells per chapter in order. Cells appear in their chapter shells as they arrive; chapter shells display a "Generating..." state until their cells are complete. Reviewer may begin reading any completed cell at any time.
- R14. Per-chapter regeneration is a first-class affordance on every chapter. It discards only that chapter's cells, preserves all other chapters' content and reviewer state, and reuses thread-preservation behavior from R15 scoped to that chapter. Note: per-chapter regeneration may add orphan archive entries to the notebook-level orphan section; the reviewer is notified of new orphans after regeneration.
- R15. Full-notebook regeneration discards the existing notebook structure and resets read-state / checks / acknowledgments. It preserves threads using the existing `prepareRegeneration` flow (extended): pinned threads are always preserved; unresolved threads are preserved with a confirmation showing what would be discarded; orphan threads (whose anchor lines no longer exist in the new notebook) are collected into a flat archived orphan section below the last AI-generated chapter. Each orphan entry retains its file path and line number metadata for manual navigation. No re-anchoring or synthetic chapter rendering in v1.

**State migration from the current Stepper**
- R16. The current `ReviewGuide` data model (overview + ordered steps + reviewedStepIds + currentStepId) is replaced wholesale by the `Notebook` data model. There is no migration of in-flight stepper state for users — opening the Notebook on a PR that previously had a generated stepper shows the empty CTA. The Stepper UI and its types are removed.

---

## Success Criteria

- A reviewer who has never seen a PR can open the Notebook, click Generate, and within a few seconds see a chapter outline that gives them a mental map of the PR before any cells finish streaming.
- The reviewer can read every line of code worth reading without leaving the Notebook tab, including writing draft comments and replying to threads.
- "Did I actively consider everything risky?" has a deterministic answer: chapter % = 100 across all chapters and the "items still need acknowledgment" counter = 0.
- The File Changes tab continues to work as before, unchanged in behavior, and shows the same threads / drafts the Notebook produces.
- A downstream `ce-plan` agent can implement this without inventing which cell types exist, what counts as "complete", or how regeneration preserves state.
- Notebook users report confidence in their review outcomes at least as high as non-Notebook users (measured via periodic survey or calibrated rubric post-review). This is the primary outcome-oriented criterion; the UX criteria above are enabling conditions, not substitutes. Note: survey-based measurement should account for selection bias (respondents may skew toward power users) and define the comparison group before data collection to ensure results are actionable.

---

## Scope Boundaries

- The current Stepper UI and its data types are removed in v1; we are not maintaining a "switch back to stepper" mode.
- The Notebook is not exported, shared, or persisted to disk in v1 (no "copy as markdown" / "share to PR author").
- The Notebook does not introduce a private "margin notes" / scratchpad primitive in v1, even though it was discussed.
- The Notebook does not auto-generate on PR open or on first tab visit; cost gating stays user-driven.
- The Notebook does not replace the AI Review tab. Inline AI review issues remain a separate surface.
- The chapter rail is single-level; no nested chapters / acts.
- Diff cells render the full file diff, starting collapsed to AI-highlighted hunks with a "Show full diff" expand affordance. The AI guides attention to specific hunks via the collapsed view and surrounding markdown cells.

---

## Key Decisions

- **Reader job is "guided deep review."** Notebook is optimized for in-depth code reading in a curated order, not for executive-summary-style "approve in 5 min" review.
- **Notebook and File Changes are independent siblings.** Same store for threads/drafts; no navigation coupling. The "off-route" concept disappears with the Stepper.
- **Collapsible diff cells with AI guidance.** AI highlights which hunks to focus on; diff cells start collapsed showing only those hunks. The reviewer can expand to the full file diff or collapse back. This balances guided reading (reviewer sees the AI's focus first) with auditability (full diff is one click away).
- **Chapters → cells with a sticky rail.** Flat ordered cells lose navigational structure on long PRs; two-level (acts → chapters → cells) is over-structured.
- **Tiered completion.** Auto-mark cells on viewport for low friction; explicit ack required for checklists and high-severity notes so "complete" means "actively considered the risky parts."
- **Outline-first streaming.** Reviewer gets the AI's chosen story arc within seconds; can decide to regenerate before sinking time into reading.
- **Per-chapter regen primary, full regen escape hatch.** Avoids destroying reviewer state on every refresh; aligns with the chaptered streaming model.
- **Full draft-comment parity inside notebook diff cells.** "Self-contained reading" is the principle behind independence; forcing tab-switches to comment would undermine it.
- **Manual generation only.** Cost gating stays user-driven; no auto-generate on PR open.
- **Alternatives considered: single-narrative MVP.** A simpler approach — single scrolling AI narrative with inline diff excerpts, section headers, no cell types, no progress tracking — was considered. Rejected because the chapter→cell model provides: (a) deterministic completion (cells with explicit rules), (b) auditable AI editorial choices through cell-level progress, and (c) granular regeneration (per-chapter vs. full). The simpler model would re-create the current Stepper's problems in a different form — no clear "done" state and no way to surgically refresh stale content.
- **Empty state CTA.** The initial Notebook tab state (no generated notebook) shows: a notebook-style icon, the headline "Start a guided review," a short value-proposition paragraph ("The Notebook arranges this PR's changes into chapters with inline diffs, notes, and checklists — click Generate to begin"), and the primary "Generate Notebook" button.

---

## Dependencies / Assumptions

- The shared diff viewer (`@pierre/diffs`) renders full file diffs and can be embedded as notebook diff cells, with collapsible hunk highlighting. The draft-composer annotation chrome (`useDraftAnnotations`) must be embeddable inside diff cells for inline comment authoring. *(Needs confirmation during planning — the three-store integration (comments, drafts, AI judgment threads) needs to be reconciled for the inline composer to work.)*
- The existing thread store (`JudgmentThread`, `ReviewComment`, `useDiffPanelContext`) serves as the render-time merge surface for threads from multiple backends in File Changes. The notebook cells will read from the same merged annotation layer at render time — this is feasible for v1 because the existing `AnnotationRenderer` already merges comment sources inside `FileDiffCard`. The draft-composer component writes to the GitHub draft store (`useDraftAnnotations` / `useDraftComments`) which the notebook cells must embed.
- The streaming AI infrastructure (`useStreamingReviewGuide`, `ai-stream.ts`) can be adapted to a two-pass output (outline first, then cells per chapter) and to per-chapter regeneration. *(Both the two-pass and fallback paths require new infrastructure: new server-side event types and prompt structure, new client-side event handlers for incremental notebook state, and per-chapter cache write granularity. The fallback single-pass narrative stream with client-side chapter extraction also needs a markdown-to-cell parser that does not currently exist.)*

---

## Outstanding Questions

### Resolve Before Planning

- [Affects R8, R9][Technical] Can the draft-composer and three-store integration be embedded inside notebook diff cells for inline comment authoring? Spike required before planning. This is the highest-risk technical dependency.

### Deferred to Planning

- [Affects R5, R6][Technical] What is the exact wire format for `diff` cells — hunk indices into the existing parsed diff, or a self-contained hunk descriptor (path + oldStart/oldLines/newStart/newLines)? Drives the AI prompt and the renderer.
- [Affects R8, R9][Technical] Can the draft-composer annotation chrome be embedded inside notebook diff cells to enable inline comment authoring? Requires reconciling the three-store system (comments, drafts, AI judgment threads).
- [Affects all interactive components][Accessibility] What are the minimum accessibility expectations for keyboard navigation, focus management, ARIA semantics, and screen-reader support for the chapter rail, streaming cells, diff-cell controls, and acknowledgment toggles?
- [Affects R7][Technical] Visibility threshold for auto-mark-as-read (e.g., 50% of cell visible for 1.5s). Tune during implementation.
- [Affects R13][Technical] AI prompt structure for outline-first streaming — single multi-stage prompt vs. two prompts (outline, then a per-chapter prompt fanned out)? Cost and latency tradeoff to evaluate.
- [Affects R14, R15][Technical] How are thread anchors re-attached after per-chapter regen and full regen, given the AI may pick different hunks the second time? Likely keyed on `(filePath, lineNumber)` lookup against the new cell set.
- [Affects R16][Technical] Cleanup plan for the existing Stepper code — files to delete, types to retire, and any indirect consumers (e.g., the duplicate "Review Guide" tab still rendered in `side-panel/index.tsx`).

---

## Next Steps

-> `/ce-plan` for structured implementation planning.
