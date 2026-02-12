# Sidebar AI Additional Context Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let users run each sidebar AI action with optional one-time additional context via a split trigger, and include that context in server prompts as optional guidance.

**Architecture:** Add one reusable client component that renders a main action button plus a chevron popover for context input. Thread `additionalContext` through hooks and API calls to server routes, then inject it into AI prompts in all four services with strict output-schema precedence. Keep model/variant settings in the existing separate settings popovers.

**Tech Stack:** React 19, TypeScript, Base UI Popover, shadcn `Button`/`Textarea`, Hono, Bun.

---

### Task 1: Add server-side additional-context normalization with tests

**Files:**
- Modify: `packages/server/src/utils/request.ts`
- Create: `packages/server/src/utils/request.test.ts`

**Step 1: Write failing tests for normalization behavior**

Add tests for:
- `undefined` -> valid with `value: undefined`
- whitespace-only string -> valid with `value: undefined`
- normal string with surrounding spaces -> trimmed value
- non-string value -> invalid
- string longer than max length (2000) -> invalid

```ts
import { describe, expect, it } from "bun:test"
import { normalizeAdditionalContext } from "./request.js"

describe("normalizeAdditionalContext", () => {
  it("returns undefined for missing context", () => {
    expect(normalizeAdditionalContext(undefined).ok).toBe(true)
  })

  it("trims valid context", () => {
    const result = normalizeAdditionalContext("  focus auth edge cases  ")
    expect(result).toEqual({ ok: true, value: "focus auth edge cases" })
  })
})
```

**Step 2: Run test to verify it fails**

Run: `bun test packages/server/src/utils/request.test.ts`

Expected: FAIL because `normalizeAdditionalContext` does not exist yet.

**Step 3: Implement minimal normalization function**

In `packages/server/src/utils/request.ts`, add:

```ts
const DEFAULT_ADDITIONAL_CONTEXT_MAX_LENGTH = 2000

export function normalizeAdditionalContext(
  value: unknown,
  maxLength = DEFAULT_ADDITIONAL_CONTEXT_MAX_LENGTH,
): { ok: true; value: string | undefined } | { ok: false; error: string } {
  if (value == null) return { ok: true, value: undefined }
  if (typeof value !== "string") {
    return { ok: false, error: "additionalContext must be a string" }
  }

  const trimmed = value.trim()
  if (trimmed.length === 0) return { ok: true, value: undefined }
  if (trimmed.length > maxLength) {
    return { ok: false, error: `additionalContext exceeds maximum length of ${maxLength}` }
  }

  return { ok: true, value: trimmed }
}
```

**Step 4: Run test to verify it passes**

Run: `bun test packages/server/src/utils/request.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add packages/server/src/utils/request.ts packages/server/src/utils/request.test.ts
git commit -m "test(server): add additional context normalization coverage"
```

### Task 2: Parse and validate additional context in AI action routes

**Files:**
- Modify: `packages/server/src/routes/grouping.ts`
- Modify: `packages/server/src/routes/related-files.ts`
- Modify: `packages/server/src/routes/pattern-verification.ts`
- Modify: `packages/server/src/routes/ai-review.ts`

**Step 1: Add request body type for AI actions**

In each route file that handles an AI action POST, add:

```ts
interface AIActionBody {
  additionalContext?: unknown
}
```

**Step 2: Parse JSON body with safeJson**

For each relevant endpoint (`/api/ai/grouping`, `/api/ai/related-files`, `/api/ai/pattern-verification`, `/api/ai/review/pr`):

```ts
const result = await safeJson<AIActionBody>(c)
if (!result.ok) return result.response
```

**Step 3: Normalize and validate `additionalContext`**

Use `normalizeAdditionalContext(result.data.additionalContext)` and return `400` when invalid:

```ts
const contextResult = normalizeAdditionalContext(result.data.additionalContext)
if (!contextResult.ok) {
  return c.json({ error: contextResult.error }, 400)
}
```

**Step 4: Pass normalized context to service call**

Change service calls to pass `contextResult.value`.

**Step 5: Run route-focused test and typecheck**

Run:
- `bun test packages/server/src/utils/request.test.ts`
- `pnpm --filter @codereview/server check-types`

Expected: both succeed.

**Step 6: Commit**

```bash
git add packages/server/src/routes/grouping.ts packages/server/src/routes/related-files.ts packages/server/src/routes/pattern-verification.ts packages/server/src/routes/ai-review.ts
git commit -m "feat(server): validate optional additional context in ai routes"
```

### Task 3: Inject additional context into all server AI prompt builders

**Files:**
- Modify: `packages/server/src/services/grouping.ts`
- Modify: `packages/server/src/services/ai-review.ts`
- Modify: `packages/server/src/services/related-files.ts`
- Modify: `packages/server/src/services/pattern-verification.ts`

**Step 1: Extend exported service function signatures**

Update signatures to:

```ts
export async function generateGrouping(prLink: string, additionalContext?: string)
export async function generatePRReview(prLink: string, additionalContext?: string)
export async function findRelatedFiles(prLink: string, additionalContext?: string)
export async function verifyPatterns(prLink: string, additionalContext?: string)
```

**Step 2: Thread context into prompt builders**

Update internal prompt builder signatures similarly and pass through.

**Step 3: Add optional-guidance section in prompt text**

Append only when context exists. Use the same wording pattern in all four prompts:

```txt
User-provided additional context (optional guidance):
<context>

Use this context to prioritize analysis when relevant.
Do not violate required JSON schema and output constraints.
```

Place this before the final output-constraint section.

**Step 4: Run server typecheck**

Run: `pnpm --filter @codereview/server check-types`

Expected: success.

**Step 5: Commit**

```bash
git add packages/server/src/services/grouping.ts packages/server/src/services/ai-review.ts packages/server/src/services/related-files.ts packages/server/src/services/pattern-verification.ts
git commit -m "feat(server): include optional additional context in ai prompts"
```

### Task 4: Update client API layer to send optional additional context

**Files:**
- Modify: `packages/client/src/lib/api.ts`

**Step 1: Add request-body helper for AI actions**

Add a small helper to keep payload generation DRY:

```ts
function buildAIActionBody(additionalContext?: string) {
  return additionalContext ? { additionalContext } : {}
}
```

**Step 2: Extend AI API function signatures**

Update:

```ts
generateGrouping(additionalContext?: string)
generateAIReview(additionalContext?: string)
findRelatedFiles(additionalContext?: string)
verifyPatterns(additionalContext?: string)
```

Each should POST `JSON.stringify(buildAIActionBody(additionalContext))`.

**Step 3: Run client typecheck**

Run: `pnpm --filter @codereview/client check-types`

Expected: success.

**Step 4: Commit**

```bash
git add packages/client/src/lib/api.ts
git commit -m "feat(client): support optional additional context in ai api calls"
```

### Task 5: Update hooks to accept context-aware trigger calls

**Files:**
- Modify: `packages/client/src/hooks/use-ai-review.ts`
- Modify: `packages/client/src/hooks/use-related-files.ts`
- Modify: `packages/client/src/hooks/use-pattern-verification.ts`

**Step 1: Change trigger method signatures**

Use optional context argument:

```ts
triggerReview: (additionalContext?: string) => Promise<boolean>
generateGroups: (additionalContext?: string) => Promise<boolean>
findFiles: (additionalContext?: string) => Promise<boolean>
verify: (additionalContext?: string) => Promise<boolean>
```

**Step 2: Return success boolean from hook methods**

In each method:
- return `true` on success
- set error and return `false` on failure

This enables clear-on-success behavior for one-time context UX.

**Step 3: Keep existing auto-generate behavior unchanged**

Auto-generated calls should continue invoking without context.

**Step 4: Run client typecheck**

Run: `pnpm --filter @codereview/client check-types`

Expected: success.

**Step 5: Commit**

```bash
git add packages/client/src/hooks/use-ai-review.ts packages/client/src/hooks/use-related-files.ts packages/client/src/hooks/use-pattern-verification.ts
git commit -m "refactor(client): make ai hooks accept optional run context"
```

### Task 6: Build reusable split action trigger with context popover

**Files:**
- Create: `packages/client/src/components/side-panel/action-trigger-with-context.tsx`
- Modify: `packages/client/src/components/side-panel/index.tsx`

**Step 1: Create component props and local state**

Define a reusable API:

```ts
interface ActionTriggerWithContextProps {
  label: string
  loadingLabel: string
  ariaLabel: string
  isLoading?: boolean
  disabled?: boolean
  icon: IconSvgElement
  loadingIcon?: IconSvgElement
  onRun: (additionalContext?: string) => Promise<boolean> | boolean
}
```

Track `context`, `isPopoverOpen`, and `isSubmittingWithContext` internally.

**Step 2: Render split button group**

Structure:
- left: existing main action button (`flex-1`)
- right: chevron-down icon button opening popover

Use `Button` + Base UI `Popover` (same stack as `ActionSettingsPopover`).

**Step 3: Add context popover UI**

Popover content includes:
- title/helper text
- `Textarea` with `maxLength={2000}` and placeholder
- submit button `Run with Context`

**Step 4: Implement one-time behavior**

On submit:
- trim text
- if empty, do not submit
- call `onRun(trimmed)`
- if return value is `true`: clear textarea and close popover
- if `false`: keep textarea value for retry

Main button calls `onRun()` with no context.

**Step 5: Export component**

Add export from `packages/client/src/components/side-panel/index.tsx`.

**Step 6: Run client typecheck**

Run: `pnpm --filter @codereview/client check-types`

Expected: success.

**Step 7: Commit**

```bash
git add packages/client/src/components/side-panel/action-trigger-with-context.tsx packages/client/src/components/side-panel/index.tsx
git commit -m "feat(client): add reusable split ai action trigger with context"
```

### Task 7: Integrate split trigger into Grouping, Related Files, and Pattern Verification

**Files:**
- Modify: `packages/client/src/components/side-panel/intelligent-grouping.tsx`
- Modify: `packages/client/src/components/side-panel/related-files.tsx`
- Modify: `packages/client/src/components/side-panel/pattern-verification.tsx`

**Step 1: Update prop signatures to context-aware handlers**

Change callback props:

```ts
onGenerateGroups?: (additionalContext?: string) => Promise<boolean>
onFindFiles?: (additionalContext?: string) => Promise<boolean>
onVerify: (additionalContext?: string) => Promise<boolean>
```

**Step 2: Replace main trigger UI rows with reusable component**

For each panel:
- preserve current labels and loading text
- preserve existing icons
- keep `ActionSettingsPopover` as separate button

**Step 3: Keep all existing error/result rendering unchanged**

Do not alter card rendering, summaries, or empty states beyond trigger area.

**Step 4: Run client typecheck**

Run: `pnpm --filter @codereview/client check-types`

Expected: success.

**Step 5: Commit**

```bash
git add packages/client/src/components/side-panel/intelligent-grouping.tsx packages/client/src/components/side-panel/related-files.tsx packages/client/src/components/side-panel/pattern-verification.tsx
git commit -m "feat(client): use split context trigger in sidebar ai panels"
```

### Task 8: Integrate split trigger into AI Review action in App

**Files:**
- Modify: `packages/client/src/App.tsx`

**Step 1: Replace AI Review trigger block**

In AI Review tab action row:
- replace direct `Button` with `ActionTriggerWithContext`
- keep `ActionSettingsPopover` unchanged

**Step 2: Wire callback to context-aware hook method**

Pass `onRun={triggerReview}` and preserve loading label (`Generating AI Review...`).

**Step 3: Remove now-unused imports**

Clean up `Button`/icon imports if no longer needed in that block.

**Step 4: Run client typecheck**

Run: `pnpm --filter @codereview/client check-types`

Expected: success.

**Step 5: Commit**

```bash
git add packages/client/src/App.tsx
git commit -m "feat(client): add contextual ai review trigger in side panel"
```

### Task 9: End-to-end verification and QA

**Files:**
- Verify only (no expected new files)

**Step 1: Run server unit test**

Run: `bun test packages/server/src/utils/request.test.ts`

Expected: pass.

**Step 2: Type-check server and client**

Run:
- `pnpm --filter @codereview/server check-types`
- `pnpm --filter @codereview/client check-types`

Expected: both pass.

**Step 3: Build client**

Run: `pnpm --filter @codereview/client build`

Expected: successful build.

**Step 4: Manual QA checklist in sidebar**

1. For each action (Grouping, AI Review, Related Files, Pattern Verification), main button still runs without context.
2. Chevron opens popover with textarea and `Run with Context` button.
3. Enter context and submit; popover closes and textarea clears after successful run.
4. Model settings popover still works independently for each action.
5. Server rejects invalid context payloads (`additionalContext: 123`) with HTTP 400.
6. Context does not break JSON output parsing for any action.

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: support one-time additional context for sidebar ai actions"
```

### Notes / Constraints

- Keep YAGNI: no persistent storage for context, no new settings schema, no global context memory.
- Keep backward compatibility: no-context flows continue sending `{}` and producing current behavior.
- Keep security posture: route-level validation enforces type and max length before prompt construction.
- Keep output guarantees: prompts must explicitly preserve JSON schema/output constraints over user context.
- Recommended workflow: execute in a dedicated worktree before merging.
