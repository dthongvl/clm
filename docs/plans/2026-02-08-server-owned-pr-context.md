# Server-Owned PR Context Refactor

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove PR number and repo from URL params and client-side routing; the server owns this state (set once from CLI env vars) and exposes it via a new `/api/context` endpoint.

**Architecture:** The CLI already passes `PR_NUMBER` and `REPO` as env vars to the server. The server will read these at startup into a singleton `appContext` and expose them via `GET /api/context`. Server routes stop accepting `prNumber`/`repo` from query params or request bodies — they read from `appContext` instead. The client fetches context once on boot, removes `usePRParams`, and all hooks/API calls stop passing `prNumber`/`repo`.

**Tech Stack:** Hono (server), React hooks (client), TypeScript

---

## Current Flow (to be removed)

```
CLI → passes PR_NUMBER/REPO as env vars to server
CLI → opens browser with ?pr=NUMBER&repo=OWNER/REPO URL params
Client → usePRParams() reads URL params
Client → every hook/API call passes prNumber/repo
Server → every route reads prNumber/repo from query/body (with env var fallback)
```

## Target Flow

```
CLI → passes PR_NUMBER/REPO as env vars to server
CLI → opens browser at http://localhost:3000 (no params)
Server → reads PR_NUMBER/REPO from env at startup into appContext singleton
Server → exposes GET /api/context → { prNumber, repo }
Server → all routes read from appContext (no query/body params for prNumber/repo)
Client → fetches /api/context once on mount → provides via React context
Client → all hooks read prNumber/repo from React context (no props threading)
```

---

### Task 1: Create server-side `appContext` singleton

**Files:**
- Create: `packages/server/src/lib/app-context.ts`

**Step 1: Create the app-context module**

```typescript
interface AppContext {
  prNumber: number;
  repo: string;
}

let context: AppContext | null = null;

export function initAppContext(): void {
  const prNumber = parseInt(process.env.PR_NUMBER || '', 10);
  const repo = process.env.REPO || '';

  if (!prNumber || isNaN(prNumber)) {
    throw new Error('PR_NUMBER environment variable is required');
  }

  if (!repo) {
    throw new Error('REPO environment variable is required');
  }

  context = { prNumber, repo };
}

export function getAppContext(): AppContext {
  if (!context) {
    throw new Error('App context not initialized. Call initAppContext() first.');
  }
  return context;
}
```

**Step 2: Commit**

```bash
git add packages/server/src/lib/app-context.ts
git commit -m "feat(server): add app-context singleton for PR_NUMBER/REPO"
```

---

### Task 2: Add `/api/context` route and initialize context at server startup

**Files:**
- Modify: `packages/server/src/index.ts`

**Step 1: Add context initialization and route**

In `packages/server/src/index.ts`:
- Import and call `initAppContext()` before creating the Hono app
- Import `getAppContext` and add a `GET /api/context` route that returns `{ prNumber, repo }`

```typescript
import { initAppContext, getAppContext } from './lib/app-context.js';

// Initialize app context from environment
initAppContext();

// ... existing app setup ...

// Context endpoint - returns the PR being reviewed
app.get('/api/context', (c) => {
  const ctx = getAppContext();
  return c.json(ctx);
});
```

**Step 2: Commit**

```bash
git add packages/server/src/index.ts
git commit -m "feat(server): expose /api/context endpoint and init at startup"
```

---

### Task 3: Refactor server routes to use `appContext` instead of query/body params

**Files:**
- Modify: `packages/server/src/routes/diff.ts`
- Modify: `packages/server/src/routes/pr-info.ts`
- Modify: `packages/server/src/routes/comments.ts`
- Modify: `packages/server/src/routes/refresh.ts`
- Modify: `packages/server/src/routes/ai-review.ts`
- Modify: `packages/server/src/routes/grouping.ts`
- Modify: `packages/server/src/routes/related-files.ts`
- Modify: `packages/server/src/routes/pattern-verification.ts`
- Modify: `packages/server/src/routes/draft-comments.ts`

**Step 1: Refactor each route**

For every route that currently reads `prNumber`/`repo` from `c.req.query()` or request body:
- Import `getAppContext` from `'../lib/app-context.js'`
- Replace `prNumber`/`repo` extraction with `const { prNumber, repo } = getAppContext()`
- Remove the `prNumber`/`repo` validation (already validated at startup)
- For POST routes that accept `prNumber`/`repo` in the body, remove those fields from the body interface

**Example — `diff.ts`:**

Before:
```typescript
const prNumberStr = c.req.query('prNumber');
const repo = c.req.query('repo') || process.env.REPO || await getCurrentRepo();
const prNumber = parsePositiveInt(prNumberStr);
if (!prNumber) { return c.json({ error: '...' }, 400); }
```

After:
```typescript
const { prNumber, repo } = getAppContext();
```

Apply the same pattern to all routes listed above. Key changes per file:

- **diff.ts**: Both `GET /` and `GET /file` — remove `prNumber` query param, remove `repo` query param, use `getAppContext()`
- **pr-info.ts**: `GET /` — remove `prNumber` query param, remove `repo` query param, use `getAppContext()`
- **comments.ts**: `GET /` and `POST /` — remove query/body `prNumber`/`repo`, use `getAppContext()`
- **refresh.ts**: `POST /` — remove body `prNumber`/`repo`, use `getAppContext()`
- **ai-review.ts**: `POST /pr` — remove body `prNumber`/`repo`, use `getAppContext()`
- **grouping.ts**: `POST /` — remove body `prNumber`/`repo`, use `getAppContext()`
- **related-files.ts**: `POST /` — remove body `prNumber`/`repo`, use `getAppContext()`
- **pattern-verification.ts**: `POST /` — remove body `prNumber`/`repo`, use `getAppContext()`
- **draft-comments.ts**: All routes — remove `prNumber`/`repo` from query/body, use `getAppContext()`. The `buildKey` helper now just uses `getAppContext()`. POST body no longer needs `prNumber`/`repo`.

**Step 2: Verify server builds**

```bash
pnpm --filter @codereview/server check-types
```

**Step 3: Commit**

```bash
git add packages/server/src/routes/
git commit -m "refactor(server): all routes use appContext instead of per-request prNumber/repo"
```

---

### Task 4: Create client-side `PRContext` React context

**Files:**
- Create: `packages/client/src/hooks/use-pr-context.ts`
- Delete: `packages/client/src/hooks/use-pr-params.ts`

**Step 1: Create the context provider and hook**

```typescript
import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

interface PRContextValue {
  prNumber: number
  repo: string
  isLoading: boolean
  error: Error | null
}

const PRContext = createContext<PRContextValue | null>(null)

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
    <PRContext value={{ prNumber, repo, isLoading, error }}>
      {children}
    </PRContext>
  )
}

export function usePRContext(): PRContextValue {
  const ctx = useContext(PRContext)
  if (!ctx) {
    throw new Error("usePRContext must be used within PRContextProvider")
  }
  return ctx
}
```

**Step 2: Delete `use-pr-params.ts`**

Remove the file entirely.

**Step 3: Commit**

```bash
git add packages/client/src/hooks/use-pr-context.ts
git rm packages/client/src/hooks/use-pr-params.ts
git commit -m "feat(client): add PRContextProvider, remove usePRParams"
```

---

### Task 5: Refactor client API functions to remove `prNumber`/`repo` params

**Files:**
- Modify: `packages/client/src/lib/api.ts`

**Step 1: Remove prNumber/repo from all API function signatures**

Every function that currently takes `prNumber`/`repo` as arguments should stop doing so. Since the server now owns the context, the client just calls the endpoint without those params.

Key changes:
- `fetchPRInfo()` — no params (just `signal?`)
- `fetchPRDiff(includeContent?, signal?)` — remove `prNumber`/`repo`
- `fetchPRComments(signal?)` — remove `prNumber`/`repo`
- `refreshPR(signal?)` — remove `prNumber`/`repo`, POST with empty body
- `fetchDraftComments()` — remove `prNumber`
- `createDraftComment(filePath, lineNumber, side, content, authorName?)` — remove `prNumber`
- `deleteDraftComment(commentId)` — remove `prNumber`
- `clearDraftComments()` — remove `prNumber`
- `generateGrouping()` — remove `prNumber`/`repo`, POST with empty body
- `generateAIReview()` — remove `prNumber`/`repo`, POST with empty body
- `findRelatedFiles()` — remove `prNumber`/`repo`, POST with empty body
- `verifyPatterns()` — remove `prNumber`/`repo`, POST with empty body

**Example:**

Before:
```typescript
export async function fetchPRInfo(prNumber: number, repo?: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ prNumber: String(prNumber) });
  if (repo) params.set('repo', repo);
  return fetchApi<ServerPRInfo>(`/git/pr-info?${params}`, { signal });
}
```

After:
```typescript
export async function fetchPRInfo(signal?: AbortSignal): Promise<ServerPRInfo> {
  return fetchApi<ServerPRInfo>('/git/pr-info', { signal });
}
```

**Step 2: Commit**

```bash
git add packages/client/src/lib/api.ts
git commit -m "refactor(client): remove prNumber/repo from all API functions"
```

---

### Task 6: Refactor all client hooks to use `usePRContext` and updated API

**Files:**
- Modify: `packages/client/src/hooks/use-pr.ts`
- Modify: `packages/client/src/hooks/use-diff.ts`
- Modify: `packages/client/src/hooks/use-comments.ts`
- Modify: `packages/client/src/hooks/use-draft-comments.ts`
- Modify: `packages/client/src/hooks/use-ai-review.ts`
- Modify: `packages/client/src/hooks/use-related-files.ts`
- Modify: `packages/client/src/hooks/use-pattern-verification.ts`
- Modify: `packages/client/src/hooks/index.ts`

**Step 1: Refactor each hook**

Remove `prNumber`/`repo` from options interfaces. Hooks no longer accept these as params — they call the updated API functions which don't need them either. Auto-fetch on mount without needing to check `if (prNumber)`.

**Example — `use-pr.ts`:**

Before:
```typescript
interface UsePROptions { prNumber?: number; repo?: string; }
export function usePR({ prNumber, repo }: UsePROptions = {}) {
  const fetchData = useCallback(async () => {
    if (!prNumber) return;
    const serverPR = await fetchPRInfo(prNumber, repo, ...);
  }, [prNumber, repo]);
}
```

After:
```typescript
export function usePR() {
  const fetchData = useCallback(async () => {
    const serverPR = await fetchPRInfo(abortControllerRef.current.signal);
    // ...
  }, []);
  useEffect(() => { fetchData(); ... }, [fetchData]);
}
```

Apply the same pattern to all hooks. Remove `prNumber`/`repo` from options and from calls to API functions.

**Step 2: Update `hooks/index.ts`**

- Remove `usePRParams` export
- Add `usePRContext` and `PRContextProvider` exports

```typescript
export { usePRContext, PRContextProvider } from './use-pr-context';
```

**Step 3: Commit**

```bash
git add packages/client/src/hooks/
git commit -m "refactor(client): hooks use server context, remove prNumber/repo threading"
```

---

### Task 7: Refactor `App.tsx` and `main.tsx` — wire up PRContextProvider

**Files:**
- Modify: `packages/client/src/App.tsx`
- Modify: `packages/client/src/main.tsx`

**Step 1: Wrap app in PRContextProvider in `main.tsx`**

```tsx
import { PRContextProvider } from "@/hooks"

// Wrap <App /> with <PRContextProvider>
<PRContextProvider>
  <App />
</PRContextProvider>
```

**Step 2: Refactor `App.tsx`**

- Remove `usePRParams` import and usage
- Remove `isDemo` logic (no more demo mode — app always has a PR)
- Remove all `prNumber`/`repo` props threading to hooks
- Remove mock data fallback logic (no demo mode)
- Remove the "Add `?pr=NUMBER` to the URL" messages
- All hooks are called with no args: `usePR()`, `useDiff()`, `useComments()`, etc.
- Use `usePRContext()` only where the component itself needs `prNumber` or `repo` (e.g., for display or as `resetKeys` in `ErrorBoundary`)

**Step 3: Verify client builds**

```bash
pnpm --filter @codereview/client check-types
```

**Step 4: Commit**

```bash
git add packages/client/src/App.tsx packages/client/src/main.tsx
git commit -m "refactor(client): App uses PRContextProvider, remove URL params and demo mode"
```

---

### Task 8: Update CLI — stop passing URL params

**Files:**
- Modify: `apps/cli/src/index.ts`

**Step 1: Remove URL params from browser URL**

Before:
```typescript
const params = new URLSearchParams({ pr: prNumber, repo });
const url = `http://localhost:3000?${params.toString()}`;
```

After:
```typescript
const url = 'http://localhost:3000';
```

**Step 2: Commit**

```bash
git add apps/cli/src/index.ts
git commit -m "refactor(cli): open browser without URL params"
```

---

### Task 9: Final verification

**Step 1: Typecheck all packages**

```bash
pnpm --filter @codereview/server check-types
pnpm --filter @codereview/client check-types
pnpm cli:typecheck
```

**Step 2: Build all**

```bash
pnpm build
```

**Step 3: Verify no remaining references to old patterns**

```bash
# Should return no results in client code
grep -r "usePRParams" packages/client/src/
grep -r "prNumber.*repo" packages/client/src/hooks/ | grep -v "use-pr-context"

# Should return no results for URL param parsing
grep -r "window.location.search" packages/client/src/
```

**Step 4: Commit any fixes**

---

## Files Changed Summary

| Layer | File | Action |
|-------|------|--------|
| Server | `packages/server/src/lib/app-context.ts` | Create |
| Server | `packages/server/src/index.ts` | Modify |
| Server | `packages/server/src/routes/diff.ts` | Modify |
| Server | `packages/server/src/routes/pr-info.ts` | Modify |
| Server | `packages/server/src/routes/comments.ts` | Modify |
| Server | `packages/server/src/routes/refresh.ts` | Modify |
| Server | `packages/server/src/routes/ai-review.ts` | Modify |
| Server | `packages/server/src/routes/grouping.ts` | Modify |
| Server | `packages/server/src/routes/related-files.ts` | Modify |
| Server | `packages/server/src/routes/pattern-verification.ts` | Modify |
| Server | `packages/server/src/routes/draft-comments.ts` | Modify |
| Client | `packages/client/src/hooks/use-pr-context.ts` | Create |
| Client | `packages/client/src/hooks/use-pr-params.ts` | Delete |
| Client | `packages/client/src/lib/api.ts` | Modify |
| Client | `packages/client/src/hooks/use-pr.ts` | Modify |
| Client | `packages/client/src/hooks/use-diff.ts` | Modify |
| Client | `packages/client/src/hooks/use-comments.ts` | Modify |
| Client | `packages/client/src/hooks/use-draft-comments.ts` | Modify |
| Client | `packages/client/src/hooks/use-ai-review.ts` | Modify |
| Client | `packages/client/src/hooks/use-related-files.ts` | Modify |
| Client | `packages/client/src/hooks/use-pattern-verification.ts` | Modify |
| Client | `packages/client/src/hooks/index.ts` | Modify |
| Client | `packages/client/src/App.tsx` | Modify |
| Client | `packages/client/src/main.tsx` | Modify |
| CLI | `apps/cli/src/index.ts` | Modify |
