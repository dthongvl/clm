# GitHub-Native Review Comment Feature Design

## Overview

Implement inline review comments as a true GitHub pending review workflow.

When a user comments in the diff:

1. The server creates or reuses the current user's pending review draft on the PR.
2. The new inline comment is attached to that pending review on GitHub.
3. The user can later submit the review with one of three events:
   - `COMMENT`
   - `REQUEST_CHANGES`
   - `APPROVE`

Draft comments are editable/removable only while the review is pending.

## Product Decisions (Validated)

- Source of truth: GitHub pending review state (not local memory store).
- Edit/delete scope: draft-only (pending review comments only).
- Session behavior: resume an existing pending review for the current user if one exists.

## Goals

- Match GitHub review semantics for draft and submit.
- Preserve draft comments across app refresh/restart.
- Support inline draft comment create, update, and delete.
- Support review submit actions: comment, request changes, approve.
- Keep existing diff UI architecture with minimal disruptive changes.

## Non-Goals

- Offline queueing and background retry engine.
- Editing or deleting comments after review submission.
- Supporting multiple concurrent pending reviews per user in the app UI.

## Current State

- `packages/server/src/routes/draft-comments.ts` stores drafts in memory (`BoundedArrayStore`) and has a placeholder `/submit`.
- `packages/client/src/hooks/use-draft-comments.ts` loads/saves local draft comments through `/api/draft-comments`.
- `packages/client/src/App.tsx` merges GitHub comments and local draft comments for diff annotations.

## Target Architecture

### Core Idea

Replace the in-memory draft comments backend with a GitHub-backed pending review manager.

- Server resolves current PR context from `getAppContext()`.
- Server resolves current GitHub user login.
- Server finds that user's pending review on the PR (state `PENDING`) or creates one when needed.
- Inline draft comment operations act directly on GitHub draft comments tied to that pending review.
- Review submission finalizes the pending review with the chosen event.

### Ownership and State Rules

- Only comments in the current user's pending review are editable/removable.
- Submitted review comments are immutable in this app.
- If no pending review exists, create one lazily on first draft comment create.

## API Design

Introduce a dedicated reviews route:

- Mount: `app.route('/api/reviews', reviewRoutes)` in `packages/server/src/index.ts`.

### `GET /api/reviews/draft`

Returns the current user's pending review and all draft comments on that review.

Response:

```json
{
  "review": {
    "id": 123456,
    "state": "PENDING"
  },
  "comments": [
    {
      "id": 987654,
      "reviewId": 123456,
      "filePath": "packages/client/src/App.tsx",
      "lineNumber": 58,
      "side": "additions",
      "content": "Consider extracting this callback.",
      "authorName": "your-login",
      "createdAt": "2026-02-10T09:12:00.000Z"
    }
  ]
}
```

If no draft exists:

```json
{ "review": null, "comments": [] }
```

### `POST /api/reviews/draft/comments`

Body:

```json
{
  "filePath": "packages/client/src/App.tsx",
  "lineNumber": 58,
  "side": "additions",
  "content": "Consider extracting this callback."
}
```

Behavior:

- Validate payload.
- Resolve/create pending review.
- Resolve PR head commit SHA.
- Create draft review comment in GitHub tied to that review.
- Return created comment.

### `PATCH /api/reviews/draft/comments/:commentId`

Body:

```json
{ "content": "Updated comment body" }
```

Behavior:

- Verify comment belongs to current user's pending review.
- Update comment body.

### `DELETE /api/reviews/draft/comments/:commentId`

Behavior:

- Verify comment belongs to current user's pending review.
- Delete pending draft comment.

### `POST /api/reviews/draft/submit`

Body:

```json
{
  "event": "REQUEST_CHANGES",
  "body": "Please address the thread comments before merge."
}
```

Rules:

- `event` must be one of `COMMENT | REQUEST_CHANGES | APPROVE`.
- If pending review has no comments, require non-empty `body`.

Result:

- Submits pending review to GitHub.
- Returns submitted review metadata.

## Server Implementation Plan

### 1) Extend GitHub Service

Add functions in `packages/server/src/services/gh.ts`:

- `getCurrentUserLogin()`
- `findPendingReview(prNumber, repo, login)`
- `createPendingReview(prNumber, repo)`
- `listReviewComments(prNumber, repo, reviewId)`
- `createPendingReviewComment(...)`
- `updatePendingReviewComment(...)`
- `deletePendingReviewComment(...)`
- `submitReview(prNumber, repo, reviewId, event, body?)`
- `getPRHeadSha(prNumber, repo)`

Notes:

- Continue using `runGh()` wrapper (`Bun.spawn`) for safety.
- Keep endpoint construction and response parsing centralized.
- Normalize GitHub side mapping:
  - `additions` -> `RIGHT`
  - `deletions` -> `LEFT`

### 2) Add Reviews Route

Create `packages/server/src/routes/reviews.ts` and mount in server index.

Responsibilities:

- Request validation (`safeJson`, numeric checks).
- Pending review ownership checks.
- Error mapping to stable error codes/messages.

### 3) Remove In-Memory Draft Semantics

After migration is complete:

- Remove draft comment in-memory storage behavior from `draft-comments.ts`.
- Update client to call new `/api/reviews/...` endpoints.

## Client Changes

### API Client

Add review draft API methods in `packages/client/src/lib/api.ts`:

- `fetchDraftReview()`
- `createDraftReviewComment(...)`
- `updateDraftReviewComment(commentId, content)`
- `deleteDraftReviewComment(commentId)`
- `submitDraftReview(event, body?)`

### Hook Migration

Replace internals of `use-draft-comments.ts` (or rename to `use-draft-review.ts`):

- Load pending review + comments from GitHub-backed endpoint.
- Preserve current `ReviewComment` rendering shape.
- Add methods for update/delete/submit.

### UI/UX

- Inline draft comments show edit/delete controls.
- Add "Submit Review" UI with three options:
  - Comment
  - Request changes
  - Approve
- Optional review summary textarea in submit modal/popover.
- Disable actions while pending requests are in flight.
- On submit success:
  - toast success
  - refetch GitHub comments
  - refetch draft review state (should be empty or null)

## Error Handling

Return typed errors from server for reliable UX messaging:

- `COMMENT_LOCATION_STALE` (line no longer valid on current head)
- `REVIEW_NOT_PENDING`
- `REVIEW_NOT_OWNED`
- `COMMENT_NOT_EDITABLE`
- `DRAFT_REVIEW_NOT_FOUND`
- `EMPTY_REVIEW_SUBMISSION`

Recommended client behavior:

- `COMMENT_LOCATION_STALE`: prompt user to refresh PR diff and retry.
- Ownership/state errors: refetch draft review and disable local stale controls.
- Submission conflict/double-click: keep submit idempotent in UI via disabled button state.

## Data Model Updates

### Server Types (`packages/server/src/types/index.ts`)

Add/extend:

- `DraftReview`
- `DraftReviewComment`
- `SubmitReviewEvent = 'COMMENT' | 'REQUEST_CHANGES' | 'APPROVE'`

### Client Types

Update `packages/client/src/types/review.ts`:

- Extend `ReviewComment` with draft metadata:
  - `isDraft?: boolean`
  - `reviewId?: string`
  - `editable?: boolean`

This keeps diff annotation rendering consistent while enabling draft-only controls.

## Verification Plan

Manual verification scenarios:

1. Add first inline comment -> pending review created and comment appears as draft.
2. Add second comment -> attached to same pending review.
3. Refresh app -> same pending review and comments are loaded.
4. Edit draft comment -> updated body rendered and persisted.
5. Delete draft comment -> removed from UI and GitHub draft.
6. Submit with `COMMENT` -> review submitted, draft cleared.
7. Submit with `REQUEST_CHANGES` -> submitted with correct event.
8. Submit with `APPROVE` -> submitted with correct event.
9. Force-update branch / stale line -> typed stale-location error shown.
10. Attempt edit/delete after submit -> blocked with not-editable behavior.

Suggested commands:

- `pnpm --filter @codereview/server check-types`
- `pnpm --filter @codereview/client check-types`
- `pnpm lint`

## Rollout Strategy

- Implement server primitives first.
- Ship behind existing UI flow with minimal visual changes.
- Add submit-review controls once create/edit/delete are stable.
- Remove deprecated in-memory draft endpoints only after client migration.

## Risks and Mitigations

- Risk: line mapping mismatch on evolving PR head.
  - Mitigation: strict validation + typed stale error + refresh prompt.
- Risk: pending review ownership confusion with multiple accounts.
  - Mitigation: explicit current-user login matching on pending review lookup.
- Risk: duplicated submissions from rapid clicks.
  - Mitigation: client button locking + server state validation before submit.

## Open Questions

No unresolved product questions remain for this design revision.
