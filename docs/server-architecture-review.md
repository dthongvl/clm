# Server Architecture Review

Comprehensive architecture and system design review of `packages/server`.

## P0 - Critical (Correctness & Security)

### 1. Race condition: `process.env` mutation for PR refs

**Location:** `packages/server/src/routes/refresh.ts#L34-35`, `packages/server/src/routes/diff.ts#L10-19`

`refresh.ts` mutates global `process.env.BASE_REF` / `process.env.HEAD_REF`, and `diff.ts` reads them via `getRefs()`. This creates a hidden runtime contract between two routes through shared mutable global state.

**Why this is a real bug:**

- **Concurrency**: Two users (or two browser tabs) refreshing different PRs will race and overwrite each other's refs, producing wrong diffs.
- **Multi-tab usage**: Even a single user switching PRs breaks consistency because the last refresh wins globally.
- **Scaling**: Multiple server processes won't share env state.

**Proposed fix:**

Replace `process.env` with a per-PR context store using the existing `BoundedStore` utility:

```typescript
// services/pr-context.ts
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

Then `refresh.ts` calls `setPRContext(...)` and `diff.ts` looks up refs via `getPRContext(repo, prNumber)` (or accepts `baseRef`/`headRef` as explicit query params).

---

### 2. OpenCode streaming cross-talk

**Location:** `packages/server/src/services/opencode-client.ts#L93-94`

`promptStream()` subscribes to a **global** `/event` SSE endpoint that emits events for all sessions on the opencode server. Concurrent streaming requests will:

- Interleave response chunks across different clients.
- Leak content from one user's prompt into another user's stream.
- Cause premature `done` signals if another session completes first.

```typescript
// Current: subscribes to ALL events globally
const eventsResponse = await fetch(`${this.baseUrl}/event`, {
  headers: { 'Accept': 'text/event-stream' },
});
```

**Proposed fix options (in order of preference):**

1. Use a session-scoped event endpoint if the opencode server supports one (e.g., `/session/${sessionId}/event`).
2. Filter incoming events by `sessionId` before yielding them:

```typescript
// Filter events to only this session
for (const line of lines) {
  if (line.startsWith('data: ')) {
    const event = JSON.parse(line.slice(6));
    if (event.properties?.sessionId !== sessionId) continue;
    // ... handle event
  }
}
```

3. Add a mutex/queue so only one streaming request runs at a time (worst option, limits concurrency).

---

## P1 - High (Maintainability & Bugs)

### 5. `buildPRLink` duplicated in 4 files

**Locations:**

- `packages/server/src/services/ai-review.ts#L146-151`
- `packages/server/src/services/grouping.ts#L161-166`
- `packages/server/src/routes/related-files.ts#L54-59`
- `packages/server/src/routes/pattern-verification.ts#L15`

The same function is copy-pasted across 4 files. Any behavior change (e.g., supporting GitLab URLs) requires updating all copies.

**Proposed fix:**

Extract to a shared utility:

```typescript
// utils/github.ts
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

The `parsePRLink` helper also deduplicates the regex extraction repeated in every prompt builder.

---

### 6. YAML parsing duplicated & regex bug

**Locations:**

- `packages/server/src/services/ai-review.ts#L84-86`
- `packages/server/src/services/grouping.ts#L96-97`
- `packages/server/src/services/pattern-verification.ts#L93-95`
- `packages/server/src/services/related-files.ts#L86-87`

All four AI services duplicate YAML code-fence extraction with slightly varying fallback patterns. The fallback regexes may return `undefined` for `match[1]` when the capture group doesn't exist.

```typescript
// Current pattern (repeated 4 times with variations):
const yamlMatch = output.match(/```ya?ml\n([\s\S]*?)```/)
  || output.match(/^(summary:\n[\s\S]*)/m)     // fallback varies per service
  || output.match(/^(items:\n[\s\S]*)/m);

const yamlContent = yamlMatch[1]; // may be undefined if only match[0] exists
```

**Proposed fix:**

Create a shared utility:

```typescript
// utils/yaml-extract.ts
import { parse as parseYaml } from 'yaml';

export function extractYamlBlock(output: string, fallbackKeys: string[] = []): string | null {
  // Try code fence first
  const fenceMatch = output.match(/```ya?ml\n([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1];

  // Try raw YAML starting with known keys
  for (const key of fallbackKeys) {
    const rawMatch = output.match(new RegExp(`^(${key}:\\n[\\s\\S]*)`, 'm'));
    if (rawMatch) return rawMatch[1];
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

Then each service simplifies to:

```typescript
const yamlContent = extractYamlBlock(output, ['summary', 'items']);
if (!yamlContent) return { items: [], summary: '' };
const parsed = parseYamlSafe<YamlReviewResult>(yamlContent);
```

---

### 7. Duplicated SSE streaming logic

**Location:** `packages/server/src/routes/chat.ts#L129-155` (POST) and `#L183-209` (GET)

The POST and GET `/stream` handlers contain nearly identical SSE event loop logic: subscribe to `opencodeClient.promptStream()`, map events to SSE `writeSSE` calls, handle errors.

```typescript
// This block is copy-pasted between POST /stream and GET /stream:
return streamSSE(c, async (stream) => {
  try {
    for await (const event of opencodeClient.promptStream(fullMessage)) {
      if (event.type === 'text' && event.content) {
        await stream.writeSSE({ event: 'message', data: JSON.stringify({ text: event.content }) });
      } else if (event.type === 'done') {
        await stream.writeSSE({ event: 'done', data: '' });
        break;
      } else if (event.type === 'error') {
        await stream.writeSSE({ event: 'error', data: JSON.stringify({ error: event.error }) });
        break;
      }
    }
  } catch (error) { /* identical error handling */ }
});
```

**Proposed fix:**

Extract the streaming logic into a shared helper:

```typescript
// utils/sse.ts
import { streamSSE } from 'hono/streaming';
import { opencodeClient } from '../services/opencode-client.js';
import { logger } from '../lib/logger.js';
import type { Context } from 'hono';

export function streamOpencodeResponse(c: Context, message: string) {
  return streamSSE(c, async (stream) => {
    try {
      for await (const event of opencodeClient.promptStream(message)) {
        if (event.type === 'text' && event.content) {
          await stream.writeSSE({ event: 'message', data: JSON.stringify({ text: event.content }) });
        } else if (event.type === 'done') {
          await stream.writeSSE({ event: 'done', data: '' });
          break;
        } else if (event.type === 'error') {
          await stream.writeSSE({ event: 'error', data: JSON.stringify({ error: event.error }) });
          break;
        }
      }
    } catch (error) {
      logger.error('Stream error', error);
      await stream.writeSSE({ event: 'error', data: JSON.stringify({ error: (error as Error).message }) });
    }
  });
}
```

Both POST and GET handlers reduce to building `fullMessage` and calling `streamOpencodeResponse(c, fullMessage)`.

---

### 8. Duplicate `PRComment` type

**Locations:**

- `packages/server/src/types/index.ts#L33-47` (as `PRCommentResponse`)
- `packages/server/src/services/gh.ts#L170-185` (as `PRComment`)

Two nearly identical interfaces describe the same GitHub PR comment shape. They will diverge over time.

**Proposed fix:**

Keep a single `PRComment` type in `types/index.ts` and import it in `services/gh.ts`. Remove `PRCommentResponse` if unused, or alias it for backward compatibility.

---

### 9. No centralized request validation

**Locations:** All route files perform ad-hoc validation with slightly different patterns.

Each route manually validates inputs with inconsistent error messages and logic:

```typescript
// routes/ai-review.ts
if (!diff || typeof diff !== 'string') {
  return c.json({ error: 'diff is required and must be a string' }, 400);
}

// routes/comments.ts
if (!commentBody || typeof commentBody !== 'string') {
  return c.json({ error: 'body is required and must be a string' }, 400);
}

// routes/draft-comments.ts
if (!prNumber || typeof prNumber !== 'number' || prNumber < 1) {
  return c.json({ error: 'prNumber must be a positive integer' }, 400);
}
```

Meanwhile, `isValidRepo()` in `utils/request.ts` exists but is **never called** anywhere.

**Proposed fix:**

Create reusable validation helpers or use Hono's built-in validator middleware:

```typescript
// utils/validation.ts
import type { Context } from 'hono';

export function requireString(value: unknown, field: string, maxLength?: number):
  { ok: true; value: string } | { ok: false; error: string } {
  if (!value || typeof value !== 'string') {
    return { ok: false, error: `${field} is required and must be a string` };
  }
  if (maxLength && value.length > maxLength) {
    return { ok: false, error: `${field} exceeds maximum length of ${maxLength} characters` };
  }
  return { ok: true, value };
}

export function requirePositiveInt(value: unknown, field: string):
  { ok: true; value: number } | { ok: false; error: string } {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    return { ok: false, error: `${field} must be a positive integer` };
  }
  return { ok: true, value };
}

export function requireRepo(value: unknown, field: string):
  { ok: true; value: string } | { ok: false; error: string } {
  if (!value || typeof value !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(value)) {
    return { ok: false, error: `${field} must be a valid owner/repo string` };
  }
  return { ok: true, value };
}
```

Alternatively, define Hono validator middleware with Zod schemas per-route.

---

## P2 - Medium (Scalability & Performance)

### 10. Unbounded `git show` parallelism

**Location:** `packages/server/src/routes/diff.ts#L49`

When `includeContent=true`, the route spawns one `git show` subprocess per file with no concurrency limit:

```typescript
await Promise.all(files.map(async (file) => {
  const [baseContent, headContent] = await Promise.all([
    file.status !== 'added' ? getFileContent(refs.baseRef, baseFilename) : Promise.resolve(null),
    file.status !== 'removed' ? getFileContent(refs.headRef, file.filename) : Promise.resolve(null),
  ]);
  // ...
}));
```

A PR with 100+ changed files will spawn 200+ concurrent `git show` processes, potentially exhausting system resources.

**Proposed fix:**

Add a concurrency limiter (no new dependencies needed):

```typescript
// utils/concurrency.ts
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

Then in `diff.ts`:

```typescript
await mapWithConcurrency(files, 8, async (file) => {
  // fetch base + head content
});
```

---

### 11. Settings read from disk on every AI request

**Location:** `packages/server/src/services/settings.ts#L72-75`

`getModelForAction()` calls `getSettings()` which reads and parses the TOML config file from disk on every invocation. This function is called for every AI-powered endpoint (grouping, ai-review, pattern-verification, related-files).

```typescript
export async function getModelForAction(action: ActionKey): Promise<string> {
  const settings = await getSettings(); // reads + parses file every time
  return settings[action]?.model || DEFAULT_MODEL;
}
```

**Proposed fix:**

Cache settings in memory with a short TTL (similar to the binary check cache in `ai.ts`):

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
    // ... merge with defaults ...
    settingsCache = { settings: parsed, expiresAt: Date.now() + SETTINGS_CACHE_TTL_MS };
    return parsed;
  } catch {
    const defaults = getDefaults();
    settingsCache = { settings: defaults, expiresAt: Date.now() + SETTINGS_CACHE_TTL_MS };
    return defaults;
  }
}

export async function updateSettings(partial: Partial<Settings>): Promise<Settings> {
  // ... existing logic ...
  settingsCache = null; // invalidate cache on write
  return current;
}
```

---

### 13. API design inconsistency

**Locations:** All AI-powered route files.

PR-scoped AI endpoints use inconsistent HTTP methods, URL structures, and input conventions:

| Endpoint | Method | Input | Sub-path |
|----------|--------|-------|----------|
| `/api/ai-review/pr` | POST | JSON body `{ prNumber, repo }` | `/pr` |
| `/api/grouping/generate` | POST | JSON body `{ prNumber, repo }` | `/generate` |
| `/api/related-files/analyze` | POST | JSON body `{ prNumber, repo }` | `/analyze` |
| `/api/pattern-verification` | **GET** | Query params `?repo&prNumber` | `/` (root) |

**Issues:**

- `pattern-verification` is the only endpoint using GET + query params for what is an "action" (not a resource lookup).
- Sub-path naming varies: `/generate`, `/analyze`, `/pr`, or root `/`.
- All four operations are the same class of work: "run AI analysis on a PR".

**Proposed fix:**

Normalize all PR-scoped AI endpoints to follow a consistent pattern:

```
POST /api/ai-review      { prNumber, repo }
POST /api/grouping        { prNumber, repo }
POST /api/related-files   { prNumber, repo }
POST /api/pattern-verification  { prNumber, repo }
```

All use POST with JSON body. Drop the extra sub-paths (`/generate`, `/analyze`, `/pr`) by making the root handler the primary endpoint. If backward compatibility is needed, keep old paths as aliases temporarily.
