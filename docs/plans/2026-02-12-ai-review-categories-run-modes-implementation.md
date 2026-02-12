# AI Review Categories and Run Modes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let users choose fixed AI review categories and run mode (`combined` or `separate`) from the AI Review context popover, then generate category-tagged findings with stronger prompt focus.

**Architecture:** Add explicit AI review options to the client/server request contract, validate them server-side, and build category-aware prompts in `ai-review.ts`. In `separate` mode, run one prompt per category and merge/dedupe findings deterministically. Keep backward compatibility by defaulting to all 8 categories and `combined` mode when options are omitted.

**Tech Stack:** React 19, TypeScript, Base UI Popover, Hono, Bun test runner, opencode SDK.

---

### Task 1: Add AI review option normalization and server type primitives

**Files:**
- Modify: `packages/server/src/utils/request.ts`
- Modify: `packages/server/src/utils/request.test.ts`
- Modify: `packages/server/src/types/index.ts`

**Step 1: Write failing tests for category and run-mode normalization**

In `packages/server/src/utils/request.test.ts`, add test cases for:
- missing `reviewCategories` -> defaults to all 8 categories
- unknown category -> invalid
- duplicates + whitespace -> deduped normalized list
- empty array -> invalid
- missing `runMode` -> defaults to `combined`
- invalid `runMode` -> invalid

```ts
import {
  normalizeAdditionalContext,
  normalizeReviewCategories,
  normalizeReviewRunMode,
  REVIEW_CATEGORIES,
} from "./request.js"

it("defaults to all categories when missing", () => {
  const result = normalizeReviewCategories(undefined)
  expect(result).toEqual({ ok: true, value: REVIEW_CATEGORIES })
})

it("rejects invalid run mode", () => {
  const result = normalizeReviewRunMode("fast")
  expect(result.ok).toBe(false)
})
```

**Step 2: Run tests to verify failure first**

Run: `bun test packages/server/src/utils/request.test.ts`

Expected: FAIL because normalization helpers/constants do not exist yet.

**Step 3: Implement normalization helpers in `request.ts`**

Add fixed category constants and validators:

```ts
export const REVIEW_CATEGORIES = [
  "code-quality",
  "coding-convention",
  "security",
  "accessibility",
  "architecture",
  "api-design",
  "performance",
  "testing",
] as const

export type ReviewCategory = (typeof REVIEW_CATEGORIES)[number]
export type ReviewRunMode = "combined" | "separate"

export function normalizeReviewCategories(
  value: unknown,
): { ok: true; value: ReviewCategory[] } | { ok: false; error: string } {
  if (value == null) return { ok: true, value: [...REVIEW_CATEGORIES] }
  if (!Array.isArray(value)) {
    return { ok: false, error: "reviewCategories must be an array of strings" }
  }

  const normalized = [...new Set(value
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
  )]

  if (normalized.length === 0) {
    return { ok: false, error: "reviewCategories must include at least one category" }
  }

  const invalid = normalized.find((v) => !REVIEW_CATEGORIES.includes(v as ReviewCategory))
  if (invalid) {
    return { ok: false, error: `Unknown review category: ${invalid}` }
  }

  return { ok: true, value: normalized as ReviewCategory[] }
}

export function normalizeReviewRunMode(
  value: unknown,
): { ok: true; value: ReviewRunMode } | { ok: false; error: string } {
  if (value == null) return { ok: true, value: "combined" }
  if (value !== "combined" && value !== "separate") {
    return { ok: false, error: "runMode must be 'combined' or 'separate'" }
  }
  return { ok: true, value }
}
```

**Step 4: Extend AI review types in `types/index.ts`**

Add:

```ts
export type AIReviewCategory =
  | "code-quality"
  | "coding-convention"
  | "security"
  | "accessibility"
  | "architecture"
  | "api-design"
  | "performance"
  | "testing"

export type AIReviewRunMode = "combined" | "separate"
```

And extend `AIReviewItem`:

```ts
categories: AIReviewCategory[]
```

**Step 5: Run tests and typecheck**

Run:
- `bun test packages/server/src/utils/request.test.ts`
- `pnpm --filter @codereview/server check-types`

Expected: both PASS.

**Step 6: Commit**

```bash
git add packages/server/src/utils/request.ts packages/server/src/utils/request.test.ts packages/server/src/types/index.ts
git commit -m "feat(server): normalize ai review categories and run mode"
```

### Task 2: Accept structured AI review options in the PR review route

**Files:**
- Modify: `packages/server/src/routes/ai-review.ts`

**Step 1: Add structured request body fields**

Update request type in `routes/ai-review.ts`:

```ts
interface AIActionBody {
  additionalContext?: unknown
  reviewCategories?: unknown
  runMode?: unknown
}
```

**Step 2: Parse and validate options**

Use new normalizers:

```ts
const contextResult = normalizeAdditionalContext(result.data.additionalContext)
const categoriesResult = normalizeReviewCategories(result.data.reviewCategories)
const runModeResult = normalizeReviewRunMode(result.data.runMode)
```

Return `400` on any invalid result with clear error message.

**Step 3: Pass validated options to service**

Call:

```ts
const reviewResult = await generatePRReview(prLink, {
  additionalContext: contextResult.value,
  reviewCategories: categoriesResult.value,
  runMode: runModeResult.value,
})
```

**Step 4: Run server typecheck**

Run: `pnpm --filter @codereview/server check-types`

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/server/src/routes/ai-review.ts
git commit -m "feat(server): parse ai review category options in route"
```

### Task 3: Extract category prompt templates with unit tests

**Files:**
- Create: `packages/server/src/services/ai-review-prompt.ts`
- Create: `packages/server/src/services/ai-review-prompt.test.ts`

**Step 1: Write failing tests for prompt composition**

Cover:
- includes selected category guidance blocks
- includes additional context block when present
- omits unrelated category blocks
- keeps JSON output schema instructions

```ts
import { describe, expect, it } from "bun:test"
import { buildReviewPrompt } from "./ai-review-prompt.js"

it("includes only selected categories", () => {
  const prompt = buildReviewPrompt({
    prLink: "https://github.com/acme/repo/pull/12",
    categories: ["security", "performance"],
  })
  expect(prompt).toContain("Security focus")
  expect(prompt).toContain("Performance focus")
  expect(prompt).not.toContain("Accessibility focus")
})
```

**Step 2: Run test to verify it fails**

Run: `bun test packages/server/src/services/ai-review-prompt.test.ts`

Expected: FAIL because module/function does not exist yet.

**Step 3: Implement prompt builder module**

In `ai-review-prompt.ts`, add:
- `CATEGORY_INSTRUCTIONS` map for all 8 categories
- `buildReviewPrompt({ prLink, categories, additionalContext, categoryScopeLabel? })`
- shared scaffold text + selected category sections

Include schema requirement for category attribution in each item:

```json
{"summary":"...","items":[{"severity":"warning","filePath":"...","lineNumber":42,"categories":["security"],"message":"...","suggestion":"..."}]}
```

**Step 4: Run test to verify it passes**

Run: `bun test packages/server/src/services/ai-review-prompt.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/server/src/services/ai-review-prompt.ts packages/server/src/services/ai-review-prompt.test.ts
git commit -m "test(server): cover ai review prompt category composition"
```

### Task 4: Add deterministic merge/dedupe helper with tests for separate mode

**Files:**
- Create: `packages/server/src/services/ai-review-merge.ts`
- Create: `packages/server/src/services/ai-review-merge.test.ts`

**Step 1: Write failing tests for merge behavior**

Cover:
- dedupe by `filePath + lineNumber + normalized message`
- severity escalation (`critical > warning > info`)
- category union across duplicates
- preserves non-empty suggestion

```ts
import { mergeReviewItems } from "./ai-review-merge.js"

it("merges duplicate findings and unions categories", () => {
  const merged = mergeReviewItems([
    { id: "a", filePath: "src/a.ts", lineNumber: 10, severity: "warning", categories: ["security"], message: "Missing input validation" },
    { id: "b", filePath: "src/a.ts", lineNumber: 10, severity: "critical", categories: ["api-design"], message: "missing input validation" },
  ])

  expect(merged).toHaveLength(1)
  expect(merged[0]?.severity).toBe("critical")
  expect(merged[0]?.categories.sort()).toEqual(["api-design", "security"])
})
```

**Step 2: Run test to verify it fails**

Run: `bun test packages/server/src/services/ai-review-merge.test.ts`

Expected: FAIL because helper does not exist.

**Step 3: Implement merge helper**

Add functions:

```ts
export function buildFindingKey(item: Pick<AIReviewItem, "filePath" | "lineNumber" | "message">): string
export function mergeReviewItems(items: AIReviewItem[]): AIReviewItem[]
```

Implementation details:
- normalize `filePath` and `message` to lowercase trimmed single-space for key
- keep deterministic output ordering (first-seen key order)
- generate stable IDs after merge (`ai-review-1`, `ai-review-2`, ...)

**Step 4: Run test to verify it passes**

Run: `bun test packages/server/src/services/ai-review-merge.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/server/src/services/ai-review-merge.ts packages/server/src/services/ai-review-merge.test.ts
git commit -m "test(server): add deterministic merge and dedupe for ai findings"
```

### Task 5: Refactor `generatePRReview` for combined/separate execution

**Files:**
- Modify: `packages/server/src/services/ai-review.ts`

**Step 1: Update service API to accept structured options**

Change signature to:

```ts
export interface GeneratePRReviewOptions {
  additionalContext?: string
  reviewCategories: AIReviewCategory[]
  runMode: AIReviewRunMode
}

export async function generatePRReview(prLink: string, options: GeneratePRReviewOptions): Promise<AIReviewPRResult>
```

**Step 2: Wire `combined` mode using extracted prompt builder**

Build one prompt with all selected categories and parse response into items with category arrays.

**Step 3: Wire `separate` mode with bounded concurrency**

For each category:
- build category-scoped prompt
- call `opencodeClient.prompt`
- parse items, forcing category fallback to that category when model omits `categories`

Use chunked execution (2-3 concurrent prompts max) to limit provider burst.

**Step 4: Merge and dedupe separate-mode findings**

Use `mergeReviewItems` helper and construct summary:
- if all category calls succeed: normal merged summary
- if partial failures: include failed category names in summary suffix

**Step 5: Run service tests and typecheck**

Run:
- `bun test packages/server/src/services/ai-review-prompt.test.ts`
- `bun test packages/server/src/services/ai-review-merge.test.ts`
- `pnpm --filter @codereview/server check-types`

Expected: all PASS.

**Step 6: Commit**

```bash
git add packages/server/src/services/ai-review.ts
git commit -m "feat(server): support category scoped ai review execution modes"
```

### Task 6: Extend client types, API payload, transforms, and hook signatures

**Files:**
- Modify: `packages/client/src/types/review.ts`
- Modify: `packages/client/src/lib/api.ts`
- Modify: `packages/client/src/lib/transforms.ts`
- Modify: `packages/client/src/hooks/use-ai-review.ts`
- Modify: `packages/client/src/lib/mock-data.ts`

**Step 1: Introduce client-side category/run-mode types**

In `types/review.ts`, add:

```ts
export type AIReviewCategory =
  | "code-quality"
  | "coding-convention"
  | "security"
  | "accessibility"
  | "architecture"
  | "api-design"
  | "performance"
  | "testing"

export type AIReviewRunMode = "combined" | "separate"
```

Extend `AIReviewItem` with `categories: AIReviewCategory[]`.

**Step 2: Update AI review API request body shape**

In `lib/api.ts`, update AI review only:

```ts
interface AIReviewRequestBody {
  additionalContext?: string
  reviewCategories?: AIReviewCategory[]
  runMode?: AIReviewRunMode
}

export async function generateAIReview(body: AIReviewRequestBody = {})
```

Keep other actions (`grouping`, `related-files`, `pattern-verification`) unchanged.

**Step 3: Thread new item field through transforms**

In `transformAIReviewItem`, map `categories` with fallback to `["code-quality"]` if missing.

**Step 4: Update hook signatures**

In `use-ai-review.ts`:

```ts
triggerReview: (
  additionalContext?: string,
  options?: { reviewCategories?: AIReviewCategory[]; runMode?: AIReviewRunMode }
) => Promise<boolean>
```

Call `generateAIReview({ additionalContext, ...options })`.

**Step 5: Update mock data for compile stability**

Add `categories` arrays to each item in `lib/mock-data.ts`.

**Step 6: Run client typecheck**

Run: `pnpm --filter @codereview/client check-types`

Expected: PASS.

**Step 7: Commit**

```bash
git add packages/client/src/types/review.ts packages/client/src/lib/api.ts packages/client/src/lib/transforms.ts packages/client/src/hooks/use-ai-review.ts packages/client/src/lib/mock-data.ts
git commit -m "feat(client): send ai review category options and map category tags"
```

### Task 7: Add AI review category controls to context popover

**Files:**
- Modify: `packages/client/src/components/side-panel/action-trigger-with-context.tsx`
- Modify: `packages/client/src/App.tsx`

**Step 1: Extend trigger props for optional AI review options**

In `action-trigger-with-context.tsx`, add:

```ts
interface AIReviewOptions {
  reviewCategories: AIReviewCategory[]
  runMode: AIReviewRunMode
}

interface ActionTriggerWithContextProps {
  // existing props
  onRun: (additionalContext?: string, options?: AIReviewOptions) => Promise<boolean> | boolean
  enableAIReviewOptions?: boolean
}
```

**Step 2: Add fixed category checkboxes and mode toggle UI**

Inside the popover, when `enableAIReviewOptions` is true:
- render 8 checkboxes
- render `Select all` and `Clear` buttons
- render `Run each category separately` checkbox/toggle
- show helper text: `Separate mode is slower but may catch more issues.`

**Step 3: Enforce safe defaults and validation in component state**

Defaults:
- all 8 categories selected
- `runMode = "combined"`

Disable run buttons if no categories selected.

**Step 4: Pass options to `onRun` for both main and context submissions**

Main button:

```ts
await onRun(undefined, { reviewCategories: selectedCategories, runMode })
```

Context button:

```ts
await onRun(trimmedContext, { reviewCategories: selectedCategories, runMode })
```

**Step 5: Enable this mode only for AI review action in `App.tsx`**

Set:

```tsx
<ActionTriggerWithContext
  enableAIReviewOptions
  onRun={triggerReview}
  ...
/>
```

Do not enable for grouping, related-files, or pattern-verification.

**Step 6: Run client typecheck**

Run: `pnpm --filter @codereview/client check-types`

Expected: PASS.

**Step 7: Commit**

```bash
git add packages/client/src/components/side-panel/action-trigger-with-context.tsx packages/client/src/App.tsx
git commit -m "feat(client): add ai review category and execution mode controls"
```

### Task 8: Show category tags in AI findings UI

**Files:**
- Modify: `packages/client/src/components/side-panel/review-item-card.tsx`
- Modify: `packages/client/src/types/review.ts`
- Modify: `packages/client/src/components/diff-panel/annotation-renderer.tsx`
- Modify: `packages/client/src/components/comment-thread/inline-comment-thread.tsx`

**Step 1: Add optional category metadata on rendered comments**

In `types/review.ts`, extend `ReviewComment`:

```ts
aiCategories?: AIReviewCategory[]
```

**Step 2: Render compact category badges in review cards**

In `review-item-card.tsx`:
- show severity badge first
- show up to 2 category badges
- if >2 categories, add `+N` badge

Use existing `Badge` component (`variant="outline"`) for category tags.

**Step 3: Preserve category metadata when mapping to inline comment thread**

In `annotation-renderer.tsx`, set:

```ts
aiCategories: meta.item.categories
```

**Step 4: Render category badges in inline AI comment header**

In `inline-comment-thread.tsx`, when `comment.aiCategories?.length`:
- render compact tags next to AI/severity badges.

**Step 5: Run client typecheck**

Run: `pnpm --filter @codereview/client check-types`

Expected: PASS.

**Step 6: Commit**

```bash
git add packages/client/src/components/side-panel/review-item-card.tsx packages/client/src/types/review.ts packages/client/src/components/diff-panel/annotation-renderer.tsx packages/client/src/components/comment-thread/inline-comment-thread.tsx
git commit -m "feat(client): display ai review category tags in summary and inline threads"
```

### Task 9: End-to-end verification and QA

**Files:**
- Verify only (no planned file edits)

**Step 1: Run server tests**

Run:
- `bun test packages/server/src/utils/request.test.ts`
- `bun test packages/server/src/services/ai-review-prompt.test.ts`
- `bun test packages/server/src/services/ai-review-merge.test.ts`

Expected: all PASS.

**Step 2: Run typechecks**

Run:
- `pnpm --filter @codereview/server check-types`
- `pnpm --filter @codereview/client check-types`

Expected: both PASS.

**Step 3: Run client production build**

Run: `pnpm --filter @codereview/client build`

Expected: PASS.

**Step 4: Manual QA matrix**

1. AI Review defaults to all 8 categories, combined mode.
2. Clearing all categories disables run button.
3. Combined mode with subset (e.g., `security` + `api-design`) returns tagged findings.
4. Separate mode runs slower and still returns merged/deduped tagged findings.
5. Existing actions (grouping, related-files, pattern-verification) still work unchanged.
6. Sending `{}` to `/api/ai/review/pr` still works (backward compatibility).
7. Invalid payloads (`runMode: "fast"`, unknown category) return HTTP 400.

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: support category scoped ai review with optional separate execution"
```

### Notes / Constraints

- Keep DRY: category list and labels should be sourced from one constant per layer (server/client), not repeated literals across files.
- Keep YAGNI: do not add persistent settings storage for categories in V1.
- Keep behavior compatibility: omitted options must behave as all-categories + combined mode.
- Before marking work complete, run @verification-before-completion.
- If any test or runtime behavior is surprising, use @systematic-debugging before editing further.
- Recommended execution path: use a dedicated worktree, then implement task-by-task with @executing-plans.
