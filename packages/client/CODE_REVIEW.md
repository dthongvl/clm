# Code Review: @codereview/client

**Date:** 2026-02-01  
**Reviewer:** AI Assistant  
**Package:** `packages/client`

---

## Summary

The client package is well-structured with clean React patterns (compound components, custom hooks, separation of concerns). However, there are opportunities to improve reliability, performance, and consistency.

**12 improvement areas identified across 4 severity levels.**

---

## Findings

### HIGH Severity

#### #1 - Race Condition in Data Fetching Hooks

**Location:** `src/hooks/*.ts`

**Problem:** No request cancellation - rapid `prNumber` changes can cause stale data to overwrite newer responses.

**Why it matters:** When a user quickly switches between PRs, older API responses may resolve after newer ones and incorrectly update the state.

**Fix:**
```typescript
// Add AbortController + requestId pattern
const fetchData = useCallback(async () => {
  const controller = new AbortController();
  const currentRequestId = ++requestIdRef.current;
  
  try {
    const data = await fetchApi(endpoint, { signal: controller.signal });
    if (currentRequestId !== requestIdRef.current) return; // Ignore stale
    setData(data);
  } catch (err) {
    if (err.name === 'AbortError') return;
    setError(err);
  }
  
  return () => controller.abort();
}, [deps]);
```

---

#### #2 - URL Params Not Reactive

**Location:** `src/App.tsx#L26-34`

**Problem:** `getPRParams()` reads `window.location.search` directly during render. URL changes (back/forward navigation) won't trigger re-renders.

**Why it matters:** Users navigating via browser history won't see updated PR data.

**Fix:** Create a `usePRParams()` hook that subscribes to `popstate` events, or adopt a router like `react-router` with `useSearchParams()`.

```typescript
function usePRParams() {
  const [params, setParams] = useState(getPRParams);
  
  useEffect(() => {
    const handler = () => setParams(getPRParams());
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);
  
  return params;
}
```

---

### MEDIUM Severity

#### #3 - Missing PR Number Treated as Error

**Location:** `src/hooks/use-pr.ts#L25`, `src/hooks/use-diff.ts#L25`

**Problem:** When `prNumber` is undefined, hooks set an error state ("PR number is required"). This is not a failure—it's an "idle" state.

**Why it matters:** Conflates missing parameters with actual API failures, making error handling inconsistent.

**Fix:** Return `{ status: 'idle', data: null }` when no `prNumber` is provided. Only set error on actual request failures.

---

#### #4 - Mock Data Fallback Masks Production Failures

**Location:** `src/App.tsx#L52-54`, `#L96-98`

**Problem:** Mock data is silently used as fallback when real data is empty or fails, potentially hiding production issues.

**Why it matters:** Bugs in API integration or data fetching may go unnoticed during development/testing.

**Fix:** Make demo mode explicit:
```typescript
const isDemo = !prNumber;
const displayPR = isDemo ? mockPR : pr;
const displayFiles = isDemo ? mockFiles : files;
```

---

#### #5 - Arrays Recreated on Every Render

**Location:** `src/App.tsx#L195-198`

**Problem:** The `annotations` array is created inline on every render:
```tsx
annotations={[
  ...(comments.length > 0 ? comments : mockComments),
  ...draftComments,
]}
```

**Why it matters:** This defeats React memoization in child components, causing unnecessary re-renders.

**Fix:**
```typescript
const annotations = useMemo(
  () => [...(isDemo ? mockComments : comments), ...draftComments],
  [isDemo, comments, draftComments]
);
```

Also apply to `displayGroups` and `displayAIReviewItems`.

---

#### #6 - ErrorBoundary Doesn't Reset on Navigation

**Location:** `src/components/error-boundary.tsx`

**Problem:** No `resetKeys` prop - error state persists when `prNumber` changes.

**Why it matters:** Users see stale error screens after navigating to a different PR.

**Fix:** Add `resetKeys` support (similar to `react-error-boundary`):
```typescript
componentDidUpdate(prevProps: ErrorBoundaryProps) {
  if (this.state.hasError && this.props.resetKeys !== prevProps.resetKeys) {
    this.setState({ hasError: false, error: null });
  }
}
```

---

#### #7 - Inconsistent Loading State Naming

**Location:** `src/hooks/*.ts`, `src/App.tsx`

**Problem:** Different naming conventions across hooks:
- `isLoading` (use-pr, use-diff)
- `isGeneratingGroups` (use-ai-review)
- `isReviewLoading` (derived in App.tsx)

**Why it matters:** Hard to track combined loading state; confusing for maintainers.

**Fix:** Standardize with a status enum:
```typescript
type QueryStatus = 'idle' | 'loading' | 'success' | 'error';

interface UseQueryReturn<T> {
  data: T | null;
  status: QueryStatus;
  error: Error | null;
  refetch: () => Promise<void>;
}
```

---

### LOW Severity

#### #8 - Inline Type Transformations

**Location:** `src/hooks/use-ai-review.ts#L47-54`, `#L79-86`

**Problem:** Type transformations are done inline in hooks instead of using `transforms.ts`.

**Why it matters:** Inconsistent transform location makes code harder to maintain and test.

**Fix:** Move to `src/lib/transforms.ts`:
```typescript
export function transformAIReviewItem(item: ServerAIReviewItem): AIReviewItem { ... }
export function transformChangeGroup(group: ServerChangeGroup): ChangeGroup { ... }
```

---

#### #9 - DOM Queries May Be Slow for Large Diffs

**Location:** `src/App.tsx#L100-122`

**Problem:** `scrollToFile` and `scrollToAnnotation` use `querySelector` with attribute selectors on the entire diff container.

**Why it matters:** For large PRs with many files, repeated DOM scanning can be expensive.

**Fix:** Use a refs Map or deterministic element IDs:
```typescript
const fileRefs = useRef(new Map<string, HTMLElement>());
// In child: ref={el => el && fileRefs.current.set(path, el)}
// To scroll: fileRefs.current.get(path)?.scrollIntoView(...)
```

---

#### #10 - Console Log in Production Code

**Location:** `src/App.tsx#L201-202`

**Problem:** Debug `console.log` in `onLineClick` handler.

**Why it matters:** Unnecessary console output in production.

**Fix:**
```typescript
onLineClick={(path, line, side) => {
  if (import.meta.env.DEV) {
    console.log(`Clicked line ${line} (${side}) in ${path}`);
  }
}}
```
Or remove entirely.

---

#### #11 - Comment Transform Loses Type Distinction

**Location:** `src/lib/transforms.ts#L74-75`

**Problem:** `filePath: serverComment.path || ''` and `lineNumber: ... || 0` doesn't distinguish PR-level comments from line comments.

**Why it matters:** Can cause "scroll to line 0 in empty file path" bugs.

**Fix:** Use a union type:
```typescript
type ReviewComment = LineComment | PRLevelComment;

interface LineComment {
  type: 'line';
  filePath: string;
  lineNumber: number;
  // ...
}

interface PRLevelComment {
  type: 'pr-level';
  // no filePath or lineNumber
}
```

---

### INFO

#### #12 - Consider TanStack Query for Data Fetching

**Location:** `src/hooks/`

**Problem:** Manual data fetching hooks reimplement caching, retries, deduplication, and background refetch.

**Why it matters:** Significant code duplication; missing features like cache invalidation, retry logic, and refetch-on-focus.

**Recommendation:** Consider adopting [TanStack Query](https://tanstack.com/query) to reduce 60-70% of custom hook code and eliminate race conditions automatically.

---

## Priority Action Items

1. **🔴 Fix race conditions** - Add `AbortController` to all fetch hooks
2. **🔴 Make URL params reactive** - Create `usePRParams()` hook
3. **🟡 Explicit demo mode** - Separate mock data path from real data
4. **🟡 Add `useMemo`** - For derived arrays passed to children
5. **🟡 ErrorBoundary reset** - Add `resetKeys` prop support
6. **🟢 Remove console.log** - Clean up debug code

---

## Positive Observations

- ✅ Clean compound component pattern (TopBar, ChatPopup, DiffPanel)
- ✅ Good separation of concerns (hooks, lib, components, types)
- ✅ Consistent use of TypeScript with proper typing
- ✅ ErrorBoundary implementation with fallback UI
- ✅ Storage utilities with proper error handling
- ✅ Transform layer separating server/client types
