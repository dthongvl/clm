# Server Architecture Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix race conditions, deduplicate shared logic, add concurrency limits, cache settings, and normalize API design in `packages/server`.

**Architecture:** Extract shared utilities (`buildPRLink`, YAML extraction, SSE streaming, concurrency limiter, validation), replace `process.env` mutation with a per-PR context store, filter SSE events by session, cache settings with TTL, and normalize AI endpoint conventions.

**Tech Stack:** Hono, TypeScript, BoundedStore (existing utility), yaml (existing dep)

---

## Task 1: Extract `buildPRLink` to shared utility

**Files:**
- Create: `packages/server/src/utils/github.ts`
- Modify: `packages/server/src/services/ai-review.ts`
- Modify: `packages/server/src/services/grouping.ts`
- Modify: `packages/server/src/routes/related-files.ts`
- Modify: `packages/server/src/routes/pattern-verification.ts`
- Modify: `packages/server/src/routes/ai-review.ts`
- Modify: `packages/server/src/routes/grouping.ts`

**Step 1: Create `utils/github.ts`**

```typescript
// packages/server/src/utils/github.ts
export function buildPRLink(repo: string, prNumber: number): string {
  if (repo.startsWith('http')) {
    return `${repo}/pull/${prNumber}`;
  }
  return `https://github.com/${repo}/pull/${prNumber}`;
}

export function parsePRLink(prLink: string): { repo: string; prNumber: string } | null {
  const match = prLink.match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
  if (!match) return null;
  return { repo: match[1], prNumber: match[2] };
}
```

**Step 2: Update all consumers**

Remove the local `buildPRLink` function from:
- `packages/server/src/services/ai-review.ts` (L146-151) — remove export, import from `../utils/github.js`
- `packages/server/src/services/grouping.ts` (L161-166) — remove export, import from `../utils/github.js`
- `packages/server/src/routes/related-files.ts` (L54-59) — remove local function, import from `../utils/github.js`
- `packages/server/src/routes/pattern-verification.ts` (L15) — replace inline link construction with imported `buildPRLink`

Update imports in route files that re-export from services:
- `packages/server/src/routes/ai-review.ts` (L3) — change import of `buildPRLink` from `../services/ai-review.js` to `../utils/github.js`
- `packages/server/src/routes/grouping.ts` (L2) — change import of `buildPRLink` from `../services/grouping.js` to `../utils/github.js`

**Step 3: Verify**

Run: `pnpm --filter @codereview/server check-types`
Expected: No type errors

**Step 4: Commit**

```bash
git add packages/server/src/utils/github.ts packages/server/src/services/ai-review.ts packages/server/src/services/grouping.ts packages/server/src/routes/related-files.ts packages/server/src/routes/pattern-verification.ts packages/server/src/routes/ai-review.ts packages/server/src/routes/grouping.ts
git commit -m "refactor(server): extract buildPRLink to shared utility"
```

---

## Task 2: Extract YAML parsing to shared utility

**Files:**
- Create: `packages/server/src/utils/yaml-extract.ts`
- Modify: `packages/server/src/services/ai-review.ts`
- Modify: `packages/server/src/services/grouping.ts`
- Modify: `packages/server/src/services/pattern-verification.ts`
- Modify: `packages/server/src/services/related-files.ts`

**Step 1: Create `utils/yaml-extract.ts`**

```typescript
// packages/server/src/utils/yaml-extract.ts
import { parse as parseYaml } from 'yaml';

export function extractYamlBlock(output: string, fallbackKeys: string[] = []): string | null {
  const fenceMatch = output.match(/```ya?ml\n([\s\S]*?)```/);
  if (fenceMatch?.[1]) return fenceMatch[1];

  for (const key of fallbackKeys) {
    const rawMatch = output.match(new RegExp(`^(${key}:[\\s\\S]*)`, 'm'));
    if (rawMatch?.[1]) return rawMatch[1];
  }

  return null;
}

export function parseYamlSafe<T>(yamlContent: string): T | null {
  try {
    return parseYaml(yamlContent) as T;
  } catch {
    return null;
  }
}
```

**Step 2: Update `services/ai-review.ts`**

Replace lines 82-95 in `parseReviewOutput`:

```typescript
import { extractYamlBlock, parseYamlSafe } from '../utils/yaml-extract.js';

// In parseReviewOutput:
const yamlContent = extractYamlBlock(output, ['summary', 'items']);
if (!yamlContent) {
  logger.warn('No YAML review found in AI output');
  logger.debug(`Output preview: ${output.slice(0, 200)}...`);
  return { items: [], summary: '' };
}
const parsed = parseYamlSafe<YamlReviewResult>(yamlContent);
if (!parsed) {
  logger.error('Failed to parse review YAML');
  return { items: [], summary: '' };
}
```

Remove direct `import { parse as parseYaml } from 'yaml'` since it's no longer needed directly (only used via util).

**Step 3: Update `services/grouping.ts`**

Replace lines 93-106 in `parseGroupingOutput` with the same pattern:

```typescript
import { extractYamlBlock, parseYamlSafe } from '../utils/yaml-extract.js';

// In parseGroupingOutput:
const yamlContent = extractYamlBlock(output, ['groups']);
if (!yamlContent) {
  logger.warn('No YAML grouping found in AI output');
  logger.debug(`Output preview: ${output.slice(0, 200)}...`);
  return { groups: [] };
}
const parsed = parseYamlSafe<YamlGroupingResult>(yamlContent);
if (!parsed?.groups || !Array.isArray(parsed.groups)) {
  logger.warn('Invalid YAML structure in grouping response');
  return { groups: [] };
}
```

Remove direct `import { parse as parseYaml } from 'yaml'`.

**Step 4: Update `services/pattern-verification.ts`**

Replace lines 91-104 in `parseVerificationOutput`:

```typescript
import { extractYamlBlock, parseYamlSafe } from '../utils/yaml-extract.js';

// In parseVerificationOutput:
const yamlContent = extractYamlBlock(output, ['summary', 'verifications']);
if (!yamlContent) {
  logger.warn('No YAML found in verification output');
  logger.debug(`Output preview: ${output.slice(0, 200)}...`);
  return { verifications: [], summary: '' };
}
const parsed = parseYamlSafe<YamlVerificationResult>(yamlContent);
if (!parsed) {
  logger.error('Failed to parse verification YAML');
  return { verifications: [], summary: '' };
}
```

Remove direct `import { parse as parseYaml } from 'yaml'`.

**Step 5: Update `services/related-files.ts`**

Replace lines 84-96 in `parseRelatedFilesOutput`:

```typescript
import { extractYamlBlock, parseYamlSafe } from '../utils/yaml-extract.js';

// In parseRelatedFilesOutput:
const yamlContent = extractYamlBlock(output, ['files']);
if (!yamlContent) {
  logger.warn('No YAML found in related files output');
  logger.debug(`Output preview: ${output.slice(0, 200)}...`);
  return { files: [] };
}
const parsed = parseYamlSafe<YamlRelatedFilesResult>(yamlContent);
if (!parsed?.files || !Array.isArray(parsed.files)) {
  logger.warn('Invalid YAML structure in related files response');
  return { files: [] };
}
```

Remove direct `import { parse as parseYaml } from 'yaml'`.

**Step 6: Verify**

Run: `pnpm --filter @codereview/server check-types`
Expected: No type errors

**Step 7: Commit**

```bash
git add packages/server/src/utils/yaml-extract.ts packages/server/src/services/ai-review.ts packages/server/src/services/grouping.ts packages/server/src/services/pattern-verification.ts packages/server/src/services/related-files.ts
git commit -m "refactor(server): extract YAML parsing to shared utility"
```

---

## Task 3: Deduplicate SSE streaming logic in chat routes

**Files:**
- Create: `packages/server/src/utils/sse.ts`
- Modify: `packages/server/src/routes/chat.ts`

**Step 1: Create `utils/sse.ts`**

```typescript
// packages/server/src/utils/sse.ts
import { streamSSE } from 'hono/streaming';
import { opencodeClient } from '../services/opencode-client.js';
import { logger } from '../lib/logger.js';
import type { Context } from 'hono';

export function streamOpencodeResponse(c: Context, message: string) {
  return streamSSE(c, async (stream) => {
    try {
      for await (const event of opencodeClient.promptStream(message)) {
        if (event.type === 'text' && event.content) {
          await stream.writeSSE({
            event: 'message',
            data: JSON.stringify({ text: event.content }),
          });
        } else if (event.type === 'done') {
          await stream.writeSSE({ event: 'done', data: '' });
          break;
        } else if (event.type === 'error') {
          await stream.writeSSE({
            event: 'error',
            data: JSON.stringify({ error: event.error }),
          });
          break;
        }
      }
    } catch (error) {
      logger.error('Stream error', error);
      await stream.writeSSE({
        event: 'error',
        data: JSON.stringify({ error: (error as Error).message }),
      });
    }
  });
}
```

**Step 2: Update `routes/chat.ts`**

Replace the SSE logic in both POST `/stream` (L129-155) and GET `/stream` (L183-209) handlers with:

```typescript
import { streamOpencodeResponse } from '../utils/sse.js';

// POST /stream handler ending:
return streamOpencodeResponse(c, fullMessage);

// GET /stream handler ending:
return streamOpencodeResponse(c, fullMessage);
```

Remove imports no longer needed directly: `streamSSE` from `hono/streaming`, `opencodeClient` from `../services/opencode-client.js`.

**Step 3: Verify**

Run: `pnpm --filter @codereview/server check-types`
Expected: No type errors

**Step 4: Commit**

```bash
git add packages/server/src/utils/sse.ts packages/server/src/routes/chat.ts
git commit -m "refactor(server): extract SSE streaming to shared utility"
```

---

## Task 4: Deduplicate `PRComment` type

**Files:**
- Modify: `packages/server/src/types/index.ts`
- Modify: `packages/server/src/services/gh.ts`

**Step 1: Consolidate type**

In `packages/server/src/types/index.ts`, rename `PRCommentResponse` to `PRComment` (or keep `PRCommentResponse` as an alias if the client uses that name).

Check if `PRCommentResponse` is imported anywhere in the client:
- Search for `PRCommentResponse` in `packages/client/src/` — if used, keep it as a type alias.

In `packages/server/src/services/gh.ts`, remove the local `PRComment` interface (L170-185) and import from types:

```typescript
import type { PRComment } from '../types/index.js';
```

If `PRCommentResponse` is used elsewhere, alias it in `types/index.ts`:

```typescript
export type PRCommentResponse = PRComment;
```

Otherwise, just rename `PRCommentResponse` to `PRComment` in `types/index.ts`.

**Step 2: Verify**

Run: `pnpm --filter @codereview/server check-types`
Expected: No type errors

**Step 3: Commit**

```bash
git add packages/server/src/types/index.ts packages/server/src/services/gh.ts
git commit -m "refactor(server): consolidate duplicate PRComment type"
```

---

## Task 5: Fix race condition — replace `process.env` with PR context store

**Files:**
- Create: `packages/server/src/services/pr-context.ts`
- Modify: `packages/server/src/routes/refresh.ts`
- Modify: `packages/server/src/routes/diff.ts`

**Step 1: Create `services/pr-context.ts`**

```typescript
// packages/server/src/services/pr-context.ts
import { BoundedStore } from '../utils/bounded-store.js';

interface PRContext {
  baseRef: string;
  headRef: string;
  updatedAt: string;
}

const prContextStore = new BoundedStore<string, PRContext>({
  maxSize: 200,
  ttlMs: 60 * 60 * 1000, // 1 hour
});

function buildKey(repo: string, prNumber: number): string {
  return `${repo}:${prNumber}`;
}

export function setPRContext(repo: string, prNumber: number, baseRef: string, headRef: string): void {
  prContextStore.set(buildKey(repo, prNumber), {
    baseRef,
    headRef,
    updatedAt: new Date().toISOString(),
  });
}

export function getPRContext(repo: string, prNumber: number): PRContext | undefined {
  return prContextStore.get(buildKey(repo, prNumber));
}
```

**Step 2: Update `routes/refresh.ts`**

Replace `process.env` mutation (L34-35) with:

```typescript
import { setPRContext } from '../services/pr-context.js';

// Replace:
//   process.env.BASE_REF = `origin/${prInfo.baseBranch}`;
//   process.env.HEAD_REF = `origin/${prInfo.headBranch}`;
// With:
const baseRef = `origin/${prInfo.baseBranch}`;
const headRef = `origin/${prInfo.headBranch}`;
setPRContext(repo, prNumber, baseRef, headRef);
```

Update the response to use local variables instead of `process.env`:

```typescript
return c.json({
  success: true,
  prInfo,
  refs: { baseRef, headRef },
});
```

**Step 3: Update `routes/diff.ts`**

Replace `getRefs()` function (L10-19) to accept `repo` and `prNumber` params and look up from context store. Also accept explicit query params as override:

```typescript
import { getPRContext } from '../services/pr-context.js';

// In GET '/' handler:
const refs = getPRContext(repo, prNumber);
if (!refs) {
  return c.json({ error: 'PR refs not found. Please refresh the PR first.' }, 400);
}

// In GET '/file' handler:
// Add repo and pr query params:
const prNumberStr = c.req.query('pr');
const repo = c.req.query('repo') || process.env.REPO || await getCurrentRepo();
```

Remove the old `getRefs()` function entirely.

The `/file` endpoint also needs `repo` and `prNumber` to look up context. Add those query params.

**Step 4: Verify**

Run: `pnpm --filter @codereview/server check-types`
Expected: No type errors

**Step 5: Commit**

```bash
git add packages/server/src/services/pr-context.ts packages/server/src/routes/refresh.ts packages/server/src/routes/diff.ts
git commit -m "fix(server): replace process.env mutation with per-PR context store"
```

---

## Task 6: Fix OpenCode streaming cross-talk

**Files:**
- Modify: `packages/server/src/services/opencode-client.ts`

**Step 1: Add session-scoped event filtering**

In `promptStream()`, filter incoming SSE events by `sessionId` so that events from other sessions are ignored:

```typescript
// After parsing each event (L139-155), add session filter:
const event = JSON.parse(data);

// Filter: only process events for this session
const eventSessionId = event.properties?.sessionID || event.properties?.sessionId;
if (eventSessionId && eventSessionId !== sessionId) continue;

// ... rest of event handling
```

**Step 2: Verify**

Run: `pnpm --filter @codereview/server check-types`
Expected: No type errors

**Step 3: Commit**

```bash
git add packages/server/src/services/opencode-client.ts
git commit -m "fix(server): filter SSE events by sessionId to prevent cross-talk"
```

---

## Task 7: Add concurrency limiter for `git show`

**Files:**
- Create: `packages/server/src/utils/concurrency.ts`
- Modify: `packages/server/src/routes/diff.ts`

**Step 1: Create `utils/concurrency.ts`**

```typescript
// packages/server/src/utils/concurrency.ts
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}
```

**Step 2: Update `routes/diff.ts`**

Replace the unbounded `Promise.all` (L49-60) with:

```typescript
import { mapWithConcurrency } from '../utils/concurrency.js';

// Replace Promise.all(files.map(...)) with:
await mapWithConcurrency(files, 8, async (file) => {
  const baseFilename = file.oldFilename || file.filename;
  const [baseContent, headContent] = await Promise.all([
    file.status !== 'added' ? getFileContent(refs.baseRef, baseFilename) : Promise.resolve(null),
    file.status !== 'removed' ? getFileContent(refs.headRef, file.filename) : Promise.resolve(null),
  ]);
  file.baseContent = baseContent ?? undefined;
  file.headContent = headContent ?? undefined;
});
```

**Step 3: Verify**

Run: `pnpm --filter @codereview/server check-types`
Expected: No type errors

**Step 4: Commit**

```bash
git add packages/server/src/utils/concurrency.ts packages/server/src/routes/diff.ts
git commit -m "perf(server): limit git show concurrency to 8 parallel processes"
```

---

## Task 8: Cache settings with TTL

**Files:**
- Modify: `packages/server/src/services/settings.ts`

**Step 1: Add in-memory cache**

```typescript
let settingsCache: { settings: Settings; expiresAt: number } | null = null;
const SETTINGS_CACHE_TTL_MS = 30_000; // 30 seconds

export async function getSettings(): Promise<Settings> {
  if (settingsCache && Date.now() < settingsCache.expiresAt) {
    return settingsCache.settings;
  }

  try {
    const content = await readFile(CONFIG_FILE, 'utf-8');
    const parsed = parse(content) as Settings;
    const defaults = getDefaults();
    for (const key of ACTION_KEYS) {
      if (!parsed[key]) {
        parsed[key] = defaults[key];
      } else if (!parsed[key]!.model) {
        parsed[key]!.model = defaults[key]!.model;
      }
    }
    settingsCache = { settings: parsed, expiresAt: Date.now() + SETTINGS_CACHE_TTL_MS };
    return parsed;
  } catch {
    const defaults = getDefaults();
    settingsCache = { settings: defaults, expiresAt: Date.now() + SETTINGS_CACHE_TTL_MS };
    return defaults;
  }
}
```

**Step 2: Invalidate cache on write**

In `updateSettings()`, add cache invalidation after writing:

```typescript
export async function updateSettings(partial: Partial<Settings>): Promise<Settings> {
  // ... existing merge logic ...
  await writeFile(CONFIG_FILE, stringify(current as Record<string, unknown>), 'utf-8');
  settingsCache = null; // invalidate
  logger.info(`Settings saved to ${CONFIG_FILE}`);
  return current;
}
```

**Step 3: Verify**

Run: `pnpm --filter @codereview/server check-types`
Expected: No type errors

**Step 4: Commit**

```bash
git add packages/server/src/services/settings.ts
git commit -m "perf(server): cache settings with 30s TTL"
```

---

## Task 9: Normalize API endpoint conventions

**Files:**
- Modify: `packages/server/src/routes/pattern-verification.ts`
- Modify: `packages/server/src/routes/grouping.ts`
- Modify: `packages/server/src/routes/related-files.ts`
- Modify: `packages/client/src/hooks/use-pattern-verification.ts`
- Modify: `packages/client/src/lib/api.ts`

This task changes endpoint methods/paths. We add new routes and keep old ones as aliases for backward compatibility.

**Step 1: Change `pattern-verification` from GET to POST**

In `packages/server/src/routes/pattern-verification.ts`, add a POST handler at `/` that accepts `{ prNumber, repo }` JSON body (matching the convention of the other AI routes). Keep the GET as a deprecated alias.

```typescript
import { safeJson, isPositiveInt } from '../utils/request.js';
import { getCurrentRepo } from '../services/gh.js';
import { buildPRLink } from '../utils/github.js';

interface PatternVerificationBody {
  prNumber: number;
  repo?: string;
}

// POST /api/pattern-verification (new canonical endpoint)
app.post('/', async (c) => {
  const result = await safeJson<PatternVerificationBody>(c);
  if (!result.ok) return result.response;

  const { prNumber, repo } = result.data;

  if (!isPositiveInt(prNumber)) {
    return c.json({ error: 'prNumber must be a positive integer' }, 400);
  }

  let targetRepo = repo;
  if (!targetRepo) {
    targetRepo = await getCurrentRepo() ?? undefined;
  }
  if (!targetRepo) {
    return c.json({ error: 'Repository is required.' }, 400);
  }

  const prLink = buildPRLink(targetRepo, prNumber);

  try {
    logger.ai(`Verifying patterns for PR #${prNumber}`);
    const result = await verifyPatterns(prLink);
    return c.json(result);
  } catch (error) {
    logger.error('Pattern verification failed', error);
    return c.json({ error: 'Failed to verify patterns', details: (error as Error).message }, 500);
  }
});
```

**Step 2: Add root POST aliases for grouping and related-files**

In `packages/server/src/routes/grouping.ts`, duplicate the `/generate` handler at `/` (POST):

```typescript
// POST /api/grouping (canonical)
app.post('/', /* same handler as /generate */);
// POST /api/grouping/generate (backward compat — keep existing)
```

In `packages/server/src/routes/related-files.ts`, duplicate the `/analyze` handler at `/` (POST):

```typescript
// POST /api/related-files (canonical)
app.post('/', /* same handler as /analyze */);
// POST /api/related-files/analyze (backward compat — keep existing)
```

To avoid code duplication, extract the handler into a named function and reuse it.

**Step 3: Update client**

In `packages/client/src/hooks/use-pattern-verification.ts` (L32), change from GET to POST:

```typescript
const response = await fetch(`${API_BASE}/api/pattern-verification`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prNumber, repo }),
});
```

In `packages/client/src/lib/api.ts`:
- L204: change `/grouping/generate` to `/grouping`
- L227: change `/ai-review/pr` to `/ai-review/pr` (keep — this one is already fine at a sub-path since `ai-review` has multiple endpoints)
- L245: change `/related-files/analyze` to `/related-files`

**Step 4: Verify**

Run: `pnpm --filter @codereview/server check-types && pnpm --filter @codereview/client check-types`
Expected: No type errors

**Step 5: Commit**

```bash
git add packages/server/src/routes/pattern-verification.ts packages/server/src/routes/grouping.ts packages/server/src/routes/related-files.ts packages/client/src/hooks/use-pattern-verification.ts packages/client/src/lib/api.ts
git commit -m "refactor: normalize AI endpoint conventions to POST with JSON body"
```

---

## Task 10: Clean up unused `isValidRepo` and wire up validation

**Files:**
- Modify: `packages/server/src/utils/request.ts`

**Step 1: Decide**

`isValidRepo()` exists in `utils/request.ts` but is never called. Two options:
1. Remove it (YAGNI).
2. Wire it into routes that accept `repo`.

Since the review suggests centralized validation, keep it and add it to relevant routes that accept repo params (e.g., `refresh.ts`, `comments.ts`). However, this is low priority — for now, just leave a `TODO` or remove it.

Recommendation: remove the unused function to keep the codebase clean. Routes already validate repo presence; format validation can be added later if needed.

```typescript
// Remove isValidRepo from utils/request.ts
```

**Step 2: Verify**

Run: `pnpm --filter @codereview/server check-types`
Expected: No type errors

**Step 3: Commit**

```bash
git add packages/server/src/utils/request.ts
git commit -m "chore(server): remove unused isValidRepo function"
```

---

## Execution Order & Dependencies

Tasks 1-4 (deduplication) and Tasks 6, 8, 10 are independent — can run in parallel.

Task 5 (PR context store) should run before Task 7 (concurrency limiter) since both modify `diff.ts`.

Task 9 (API normalization) should run last since it touches routes and client.

```
Independent group A: Task 1, 2, 3, 4, 6, 8, 10
Sequential group B: Task 5 → Task 7
After A+B: Task 9
```

## Final Verification

After all tasks:

```bash
pnpm --filter @codereview/server check-types
pnpm --filter @codereview/client check-types
pnpm build
```
