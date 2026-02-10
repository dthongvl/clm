# GitHub-Native Review Comment Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace local in-memory draft comments with a GitHub-backed pending review workflow that supports inline create/update/delete and final submit as comment/request-changes/approve.

**Architecture:** The server owns the pending-review lifecycle using GitHub APIs (`gh api`) and exposes a dedicated `/api/reviews/draft` contract. The client renders pending review comments as draft annotations in diff, allows draft-only edit/delete, and submits the pending review with one of three events.

**Tech Stack:** TypeScript, Bun runtime, Hono, React 19, shadcn/ui, GitHub CLI (`gh`)

---

## Task 1: Add Server Review Types And Shared Contracts

**Files:**
- Modify: `packages/server/src/types/index.ts`
- Modify: `packages/client/src/types/review.ts`

**Step 1: Add server draft review types**

Add new types near existing `DraftComment` types:

```ts
export type SubmitReviewEvent = 'COMMENT' | 'REQUEST_CHANGES' | 'APPROVE';

export interface DraftReview {
  id: number;
  state: 'PENDING';
}

export interface DraftReviewComment {
  id: number;
  reviewId: number;
  filePath: string;
  lineNumber: number;
  side: 'additions' | 'deletions';
  content: string;
  authorName: string;
  createdAt: string;
}
```

**Step 2: Add client draft metadata fields**

Extend `ReviewComment` in `packages/client/src/types/review.ts`:

```ts
isDraft?: boolean;
reviewId?: string;
editable?: boolean;
```

**Step 3: Run typecheck (baseline)**

Run: `pnpm --filter @codereview/server check-types && pnpm --filter @codereview/client check-types`

Expected: passes with no new type errors.

**Step 4: Commit**

```bash
git add packages/server/src/types/index.ts packages/client/src/types/review.ts
git commit -m "feat: add shared types for draft review workflow"
```

---

## Task 2: Extend GitHub Service With Pending Review Operations

**Files:**
- Modify: `packages/server/src/services/gh.ts`

**Step 1: Add GitHub response interfaces used by review endpoints**

Add minimal internal types for reviews/comments returned by `gh api`.

**Step 2: Add helper methods for pending review lifecycle**

Implement:

```ts
export async function getCurrentUserLogin(): Promise<string>
export async function findPendingReview(prNumber: number, repo: string, login: string): Promise<{ id: number; state: 'PENDING' } | null>
export async function createPendingReview(prNumber: number, repo: string): Promise<{ id: number; state: 'PENDING' }>
export async function getPRHeadSha(prNumber: number, repo: string): Promise<string>
```

**Step 3: Add draft comment mutation methods**

Implement:

```ts
export async function listPendingReviewComments(prNumber: number, repo: string, reviewId: number): Promise<...>
export async function createPendingReviewComment(...): Promise<...>
export async function updatePendingReviewComment(commentId: number, repo: string, body: string): Promise<...>
export async function deletePendingReviewComment(commentId: number, repo: string): Promise<void>
export async function submitPendingReview(...): Promise<...>
```

Use side mapping:
- `additions` -> `RIGHT`
- `deletions` -> `LEFT`

**Step 4: Add strict error wrapping for route-level mapping**

Wrap gh failures with explicit error prefixes/codes so routes can map to stable API errors.

**Step 5: Run server typecheck**

Run: `pnpm --filter @codereview/server check-types`

Expected: passes.

**Step 6: Commit**

```bash
git add packages/server/src/services/gh.ts
git commit -m "feat: add GitHub pending review service operations"
```

---

## Task 3: Implement Reviews Route (`/api/reviews/draft`)

**Files:**
- Create: `packages/server/src/routes/reviews.ts`
- Modify: `packages/server/src/index.ts`

**Step 1: Create route skeleton and endpoint handlers**

Add endpoints:
- `GET /draft`
- `POST /draft/comments`
- `PATCH /draft/comments/:commentId`
- `DELETE /draft/comments/:commentId`
- `POST /draft/submit`

**Step 2: Add request validation and ownership checks**

Use `safeJson`, `isPositiveInt`, and `getAppContext()`.
Before edit/delete/submit, verify pending review exists and comment belongs to that review.

**Step 3: Add typed API errors**

Return stable error payloads for:
- `COMMENT_LOCATION_STALE`
- `REVIEW_NOT_PENDING`
- `COMMENT_NOT_EDITABLE`
- `DRAFT_REVIEW_NOT_FOUND`
- `EMPTY_REVIEW_SUBMISSION`

**Step 4: Mount reviews route in server index**

In `packages/server/src/index.ts`:

```ts
import reviewRoutes from './routes/reviews.js';
app.route('/api/reviews', reviewRoutes);
```

**Step 5: Run server typecheck**

Run: `pnpm --filter @codereview/server check-types`

Expected: passes.

**Step 6: Commit**

```bash
git add packages/server/src/routes/reviews.ts packages/server/src/index.ts
git commit -m "feat: add reviews draft API routes"
```

---

## Task 4: Add Client Review API Methods

**Files:**
- Modify: `packages/client/src/lib/api.ts`

**Step 1: Add server response interfaces for draft review endpoints**

Add interfaces for `DraftReview`, `DraftReviewComment`, submit payload/response.

**Step 2: Add API methods**

Implement:

```ts
export async function fetchDraftReview(): Promise<{ review: ...; comments: ...[] }>;
export async function createDraftReviewComment(...): Promise<...>;
export async function updateDraftReviewComment(commentId: string, content: string): Promise<...>;
export async function deleteDraftReviewComment(commentId: string): Promise<void>;
export async function submitDraftReview(event: 'COMMENT' | 'REQUEST_CHANGES' | 'APPROVE', body?: string): Promise<...>;
```

**Step 3: Keep backward compatibility temporarily**

Do not remove old draft comment exports yet; migrate hook first.

**Step 4: Run client typecheck**

Run: `pnpm --filter @codereview/client check-types`

Expected: passes.

**Step 5: Commit**

```bash
git add packages/client/src/lib/api.ts
git commit -m "feat: add client API for GitHub draft reviews"
```

---

## Task 5: Migrate Draft Hook To GitHub-Backed Review State

**Files:**
- Modify: `packages/client/src/hooks/use-draft-comments.ts`
- Modify: `packages/client/src/hooks/index.ts`

**Step 1: Replace local draft list loading with `fetchDraftReview()`**

Maintain existing public hook name (`useDraftComments`) to minimize churn.

**Step 2: Add methods for update/delete/submit**

Expose:

```ts
updateDraftComment(commentId: string, content: string): Promise<void>
removeDraftComment(commentId: string): Promise<void>
submitDraftReview(event: ..., body?: string): Promise<void>
```

**Step 3: Transform server draft comment into `ReviewComment`**

Set:
- `isDraft: true`
- `editable: true`
- `reviewId`

**Step 4: Preserve existing `addDraftComment` behavior for diff integration**

Internally call new review-comment create API.

**Step 5: Run client typecheck**

Run: `pnpm --filter @codereview/client check-types`

Expected: passes.

**Step 6: Commit**

```bash
git add packages/client/src/hooks/use-draft-comments.ts packages/client/src/hooks/index.ts
git commit -m "refactor: back draft comment hook with GitHub pending review"
```

---

## Task 6: Add Draft Edit/Delete Controls In Inline Comment Thread

**Files:**
- Modify: `packages/client/src/components/comment-thread/inline-comment-thread.tsx`
- Modify: `packages/client/src/components/diff-panel/annotation-renderer.tsx`
- Modify: `packages/client/src/components/diff-panel/diff-viewer.tsx`
- Modify: `packages/client/src/components/diff-panel/file-diff-card.tsx`

**Step 1: Extend thread props for draft actions**

Add optional callbacks:

```ts
onEditDraft?: (commentId: string, content: string) => Promise<void>
onDeleteDraft?: (commentId: string) => Promise<void>
isDraftActionLoading?: boolean
```

**Step 2: Render draft-only action buttons**

If `comment.isDraft && comment.editable`, show `Edit` and `Delete` controls in thread footer.

**Step 3: Implement inline edit state**

Reuse `CommentForm` for editing with prefilled content and save/cancel.

**Step 4: Thread callback plumbing from diff viewer**

Plumb edit/delete handlers from `DiffViewer` -> `FileDiffCard` -> `AnnotationRenderer` -> `InlineCommentThread`.

**Step 5: Run client typecheck**

Run: `pnpm --filter @codereview/client check-types`

Expected: passes.

**Step 6: Commit**

```bash
git add packages/client/src/components/comment-thread/inline-comment-thread.tsx packages/client/src/components/diff-panel/annotation-renderer.tsx packages/client/src/components/diff-panel/diff-viewer.tsx packages/client/src/components/diff-panel/file-diff-card.tsx
git commit -m "feat: support draft comment edit and delete in diff threads"
```

---

## Task 7: Add Submit Review UX (Comment / Request Changes / Approve)

**Files:**
- Create: `packages/client/src/components/top-bar/submit-review-dialog.tsx`
- Modify: `packages/client/src/components/top-bar/index.tsx`
- Modify: `packages/client/src/App.tsx`

**Step 1: Build submit review dialog component**

Use existing `Dialog`, `Textarea`, `Button` components.

Dialog fields:
- Event select/radio (`COMMENT`, `REQUEST_CHANGES`, `APPROVE`)
- Optional summary body textarea

**Step 2: Wire submit handler to hook**

On submit:
- call `submitDraftReview(event, body)`
- show success/error toast
- close dialog on success

**Step 3: Place action in top bar**

In `App.tsx`, add `Submit review` button in `TopBar.Actions`, disabled when no draft comments exist or submit is in progress.

**Step 4: Refresh view after successful submit**

Refetch:
- draft review state
- PR comments

**Step 5: Run client typecheck**

Run: `pnpm --filter @codereview/client check-types`

Expected: passes.

**Step 6: Commit**

```bash
git add packages/client/src/components/top-bar/submit-review-dialog.tsx packages/client/src/components/top-bar/index.tsx packages/client/src/App.tsx
git commit -m "feat: add submit review flow with GitHub review events"
```

---

## Task 8: Migrate App Wiring And Remove Legacy Draft Route Usage

**Files:**
- Modify: `packages/client/src/App.tsx`
- Modify: `packages/server/src/routes/draft-comments.ts`
- Modify: `packages/server/src/index.ts`

**Step 1: Ensure App only uses GitHub-backed draft hook methods**

Confirm no UI path calls legacy `/api/draft-comments` endpoints.

**Step 2: Deprecate old draft-comments route**

Replace route implementation with explicit deprecation response (or remove mount entirely if no references remain).

**Step 3: Remove route mount if safe**

In `packages/server/src/index.ts`, remove:

```ts
app.route('/api/draft-comments', draftCommentRoutes);
```

only after confirming no client calls remain.

**Step 4: Run full typechecks**

Run:

```bash
pnpm --filter @codereview/server check-types
pnpm --filter @codereview/client check-types
```

Expected: both pass.

**Step 5: Commit**

```bash
git add packages/client/src/App.tsx packages/server/src/routes/draft-comments.ts packages/server/src/index.ts
git commit -m "refactor: remove legacy in-memory draft comments route"
```

---

## Task 9: End-To-End Verification On A Real PR

**Files:**
- None (runtime verification)

**Step 1: Run app locally against a real PR**

Run: `pnpm dev` (or existing CLI entry workflow) and open the review UI.

Expected: app loads PR diff and comments normally.

**Step 2: Verify pending review lifecycle**

Manual checks:
1. Add first inline comment -> creates pending review.
2. Add second inline comment -> same pending review id.
3. Refresh page -> same draft comments still present.

**Step 3: Verify draft edit/delete**

Manual checks:
1. Edit draft comment -> updated content appears.
2. Delete draft comment -> removed immediately and after refresh.

**Step 4: Verify submit events**

Manual checks:
1. Submit with `COMMENT`.
2. Submit with `REQUEST_CHANGES`.
3. Submit with `APPROVE`.

Expected: each produces matching GitHub review state; draft list clears after submit.

**Step 5: Verify stale-location failure UX**

Change head branch (or refresh refs) to invalidate old position, then try adding a comment to stale line.

Expected: user sees actionable refresh-required error.

**Step 6: Commit follow-up fixes if needed**

```bash
git add -A
git commit -m "fix: stabilize GitHub draft review edge cases"
```

---

## Task 10: Final Quality Pass

**Files:**
- Modify: any files required by lint/typecheck fixes

**Step 1: Run lint and package builds**

Run:

```bash
pnpm lint
pnpm --filter @codereview/client build
pnpm --filter @codereview/server build
```

Expected: all commands pass.

**Step 2: Review diffs for API consistency and naming**

Check naming conventions:
- kebab-case files
- server local imports with `.js`
- explicit error payload structure

**Step 3: Commit polish**

```bash
git add -A
git commit -m "chore: finalize GitHub native review comment workflow"
```

---

## Implementation Notes

- Keep server error responses deterministic (`error`, `code`, optional `details`) so client handling remains stable.
- Do not silently convert stale line comments into top-level PR comments.
- Keep old route removal late in the plan to reduce migration risk.
- Favor small PR-safe commits after each task block.

## Definition Of Done

- Draft comments are persisted as GitHub pending review comments.
- Existing pending review is resumed for current user after reload.
- Draft comment update/delete works before submit only.
- User can submit review as comment/request changes/approve.
- Legacy in-memory draft storage is removed or fully deprecated.
- Typecheck, lint, and build pass.
