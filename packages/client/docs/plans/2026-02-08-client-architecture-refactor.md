# Client Architecture Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Modernize the `@codereview/client` architecture by introducing TanStack Query for robust server state management, modularizing the monolithic API layer, and decentralizing data fetching to improve maintainability and performance.

**Architecture:**
- **State Management:** TanStack Query v5 for server state (caching, deduping, background updates).
- **API Layer:** Split `api.ts` into domain-specific modules (`client.ts`, `pr.ts`, `diff.ts`, `reviews.ts`).
- **Data Flow:** Decentralized fetching pattern where feature components (e.g., `DiffPanel`, `SidePanel`) fetch their own data via custom hooks, removing the "God Component" anti-pattern in `App.tsx`.

**Tech Stack:** React 19, TanStack Query v5, TypeScript, Vite.

---

### Task 1: Setup TanStack Query

**Files:**
- Modify: `packages/client/package.json`
- Modify: `packages/client/src/main.tsx`
- Create: `packages/client/src/lib/query-client.ts`

**Step 1: Install Dependencies**
```bash
pnpm --filter @codereview/client add @tanstack/react-query
pnpm --filter @codereview/client add -D @tanstack/eslint-plugin-query
```

**Step 2: Create Query Client Configuration**
Create `packages/client/src/lib/query-client.ts`:
```typescript
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
```

**Step 3: Integrate Provider**
Modify `packages/client/src/main.tsx`:
```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/query-client'
import './style.css'
import App from './App.tsx'
import { ThemeProvider } from './components/theme-provider'
import { PRContextProvider } from './hooks'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="codereview-ui-theme">
        <PRContextProvider>
          <App />
        </PRContextProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </StrictMode>,
)
```

**Step 4: Verify Setup**
Run the app (`pnpm dev`) and check the console for any errors. The app should load normally.

---

### Task 2: Modularize API Layer - Base & PR

**Files:**
- Create: `packages/client/src/api/client.ts`
- Create: `packages/client/src/api/pr.ts`
- Modify: `packages/client/src/lib/api.ts` (Deprecate/Remove moved parts)

**Step 1: Create API Client Base**
Create `packages/client/src/api/client.ts`:
```typescript
// Base API client configuration and types
export const API_BASE = '/api';

export interface ApiError extends Error {
  status: number;
  details?: string;
}

export interface FetchApiOptions extends RequestInit {
  signal?: AbortSignal;
}

export async function fetchApi<T>(endpoint: string, options?: FetchApiOptions): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    signal: options?.signal,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const error = new Error(errorData.error || 'API request failed') as ApiError;
    error.status = response.status;
    error.details = errorData.details;
    throw error;
  }

  return response.json();
}
```

**Step 2: Create PR API Module**
Create `packages/client/src/api/pr.ts`:
```typescript
import { fetchApi } from './client';

export interface ServerPRInfo {
  number: number;
  title: string;
  author: string;
  description: string;
  baseBranch: string;
  headBranch: string;
  repo: string;
}

export interface RefreshResponse {
  prInfo: ServerPRInfo;
  refs: {
    baseRef: string;
    headRef: string;
  };
}

export async function fetchPRInfo(signal?: AbortSignal): Promise<ServerPRInfo> {
  return fetchApi<ServerPRInfo>('/git/pr-info', { signal });
}

export async function refreshPR(signal?: AbortSignal): Promise<RefreshResponse> {
  return fetchApi<RefreshResponse>('/git/refresh', {
    method: 'POST',
    signal,
  });
}
```

**Step 3: Update Exports**
Modify `packages/client/src/lib/api.ts` to export from new modules to maintain backward compatibility during migration (optional, or just update imports directly in next tasks). For now, we'll focus on creating the new structure.

---

### Task 3: Modularize API Layer - Diff & Reviews

**Files:**
- Create: `packages/client/src/api/diff.ts`
- Create: `packages/client/src/api/reviews.ts`
- Create: `packages/client/src/api/index.ts`

**Step 1: Create Diff API Module**
Create `packages/client/src/api/diff.ts`:
```typescript
import { fetchApi } from './client';

export interface ServerFileDiff {
  filename: string;
  status: 'added' | 'removed' | 'modified' | 'renamed';
  additions: number;
  deletions: number;
  patch: string;
  baseContent?: string;
  headContent?: string;
}

interface DiffResponse {
  files: ServerFileDiff[];
}

export async function fetchPRDiff(includeContent = true, signal?: AbortSignal): Promise<ServerFileDiff[]> {
  const params = new URLSearchParams();
  if (includeContent) params.set('includeContent', 'true');
  const query = params.toString();
  const response = await fetchApi<DiffResponse>(`/git/diff${query ? `?${query}` : ''}`, { signal });
  return response.files;
}
```

**Step 2: Create Reviews API Module**
Create `packages/client/src/api/reviews.ts`:
```typescript
import { fetchApi } from './client';

export interface ServerChangeGroup {
  id: string;
  title: string;
  summary: string;
  files: string[];
  totalAdditions: number;
  totalDeletions: number;
  riskLevel: 'high' | 'medium' | 'low';
  riskReason?: string;
}

export interface ServerAIReviewItem {
  id: string;
  filePath: string;
  lineNumber: number;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  suggestion?: string;
}

interface GroupingResponse {
  groups: ServerChangeGroup[];
}

interface AIReviewPRResponse {
  items: ServerAIReviewItem[];
  summary: string;
}

export async function generateGrouping(): Promise<ServerChangeGroup[]> {
  const response = await fetchApi<GroupingResponse>('/ai/grouping', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  return response.groups;
}

export async function generateAIReview(): Promise<AIReviewPRResponse> {
  const response = await fetchApi<AIReviewPRResponse>('/ai/review/pr', {
    method: 'POST',
    body: JSON.stringify({}),
  });
  return response;
}
```

**Step 3: Create Central Export**
Create `packages/client/src/api/index.ts`:
```typescript
export * from './client';
export * from './pr';
export * from './diff';
export * from './reviews';
```

---

### Task 4: Create PR Query Hook

**Files:**
- Create: `packages/client/src/hooks/queries/use-pr-query.ts`
- Modify: `packages/client/src/hooks/index.ts`

**Step 1: Create Hook**
Create `packages/client/src/hooks/queries/use-pr-query.ts`:
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchPRInfo, refreshPR } from '@/api/pr';
import { transformPRInfo } from '@/lib/transforms';

export const prKeys = {
  all: ['pr'] as const,
  info: () => [...prKeys.all, 'info'] as const,
};

export function usePRQuery() {
  return useQuery({
    queryKey: prKeys.info(),
    queryFn: async ({ signal }) => {
      const data = await fetchPRInfo(signal);
      return transformPRInfo(data);
    },
  });
}

export function useRefreshPRMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: refreshPR,
    onSuccess: () => {
      // Invalidate all PR related queries
      queryClient.invalidateQueries({ queryKey: prKeys.all });
    },
  });
}
```

**Step 2: Export Hook**
Add export to `packages/client/src/hooks/index.ts`.

---

### Task 5: Create Diff Query Hook

**Files:**
- Create: `packages/client/src/hooks/queries/use-diff-query.ts`
- Modify: `packages/client/src/hooks/index.ts`

**Step 1: Create Hook**
Create `packages/client/src/hooks/queries/use-diff-query.ts`:
```typescript
import { useQuery } from '@tanstack/react-query';
import { fetchPRDiff } from '@/api/diff';
import { transformFileDiffs } from '@/lib/transforms';
import { prKeys } from './use-pr-query';

export const diffKeys = {
  all: ['diff'] as const,
  files: () => [...diffKeys.all, 'files'] as const,
};

export function useDiffQuery() {
  return useQuery({
    queryKey: diffKeys.files(),
    queryFn: async ({ signal }) => {
      const data = await fetchPRDiff(true, signal);
      return transformFileDiffs(data);
    },
    // Diffs can be large, so we might want to keep them longer
    staleTime: 1000 * 60 * 10,
  });
}
```

---

### Task 6: Refactor DiffPanel Component

**Files:**
- Modify: `packages/client/src/components/diff-panel/index.tsx` (remove Props if needed)
- Modify: `packages/client/src/components/diff-panel/root.tsx` (to use context/hook if not already)
- Modify: `packages/client/src/components/diff-panel/diff-viewer.tsx`

**Step 1: Identify Changes**
The `DiffPanel.Viewer` currently accepts `files` as a prop. We should change this to accept `prNumber` (or get it from context) and fetch internally, OR keep it dumb and just have `App.tsx` pass data from the new hook.

*Decision:* To fully decentralize, `DiffPanel.Viewer` (or a container wrapper) should use `useDiffQuery()`.

**Step 2: Create Container Component**
Modify `packages/client/src/components/diff-panel/index.tsx` to export a `DiffPanelContainer` that uses the hook.

```typescript
import { useDiffQuery } from '@/hooks/queries/use-diff-query';
import { Viewer } from './diff-viewer';
// ... other imports

export function DiffPanelContainer() {
  const { data: files, isLoading, error } = useDiffQuery();
  
  // Handle loading/error states here or in parent with Suspense/ErrorBoundary
  if (isLoading) return <div>Loading diff...</div>;
  if (error) return <div>Error loading diff</div>;
  if (!files) return null;

  return <Viewer files={files} {...otherProps} />;
}
```

*Refinement:* Let's stick to modifying `App.tsx` to use the new hooks first, then pass data down, to verify the hooks work. Then we can push fetching down if needed. This plan focuses on **Architecture Refactor**, so we will replace the `useDiff` hook usage in `App.tsx` with `useDiffQuery`.

---

### Task 7: Refactor App.tsx to use Query Hooks

**Files:**
- Modify: `packages/client/src/App.tsx`

**Step 1: Replace Hooks**
Replace `usePR`, `useDiff`, `useAIReview` (old versions) with `usePRQuery`, `useDiffQuery`, etc.

```typescript
// Old
// const { pr, isLoading: isPRLoading, error: prError, refetch: refetchPR } = usePR()

// New
const { data: pr, isLoading: isPRLoading, error: prError, refetch: refetchPR } = usePRQuery()
```

**Step 2: Update Refresh Logic**
Update `handleRefresh` to use `queryClient.invalidateQueries` or the refetch functions from the queries.

**Step 3: Verify**
Run the application and ensure all features (PR info, Diff, Reviews) still work but are now powered by React Query.

---

### Task 8: Cleanup

**Files:**
- Delete: `packages/client/src/hooks/use-pr.ts`
- Delete: `packages/client/src/hooks/use-diff.ts`
- Delete: `packages/client/src/lib/api.ts` (if fully migrated)

**Step 1: Remove Old Code**
Once `App.tsx` and other consumers are updated, delete the legacy hooks and the monolithic API file.

**Step 2: Run Tests/Lint**
```bash
pnpm --filter @codereview/client lint
pnpm --filter @codereview/client check-types
```
