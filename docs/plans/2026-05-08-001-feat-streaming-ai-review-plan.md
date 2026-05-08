---
title: "feat: Stream AI backend responses with thinking/tool-call progress"
type: feat
status: active
date: 2026-05-08
---

# feat: Stream AI backend responses with thinking/tool-call progress

## Overview

Today the AI review flow is request/response: the client POSTs to `/api/ai/review/pr`, blocks for 30–120s while the Pi or Opencode agent runs locally, and finally receives a parsed JSON review. Users see only a spinner.

This plan replaces that with a **streaming pipeline** that surfaces the agent's *thinking*, *tool calls*, and *intermediate text* as Server-Sent Events, then ends with the structured review result. The same machinery will be reused by the grouping action.

The change is additive: the existing JSON endpoints stay so we can ship the streaming endpoint behind a UI toggle and validate it before deleting the legacy path.

---

## Problem Frame

- Long-running AI actions (PR review, grouping) feel opaque. A 90-second spinner gives the user no signal that work is happening, no ETA, no way to know *what* the agent is doing.
- The Pi backend already emits rich events through `session.subscribe(...)` (`tool_use`, `tool_result`, message deltas, agent lifecycle), but [`PiBackend.promptStream`](packages/server/src/services/ai-backend/pi.ts#L187-L197) discards them and yields the final text once.
- The Opencode backend already streams via SSE, but [`OpencodeBackend.promptStream`](packages/server/src/services/ai-backend/opencode.ts#L62-L144) only forwards `text` events — reasoning and tool events are dropped.
- The route layer never calls `promptStream` for AI review. [`generatePRReview`](packages/server/src/services/ai-review.ts#L19-L34) calls `prompt()` (non-streaming).
- The frontend ([`useAIReview`](packages/client/src/hooks/use-ai-review.ts)) is a single mutation with no streaming state to render.

We want users to see, in real time:
1. **Status phase** — "fetching PR…", "analyzing…", "finalizing…"
2. **Tool activity** — "📖 Reading src/foo.ts", "🔎 grep …" (collapsible list)
3. **Reasoning / thinking** — streamed deltas in a dimmed scratchpad panel
4. **Final review** — structured items + summary, identical to today's payload

---

## Requirements Trace

- **R1.** The `AiBackend.promptStream` contract emits a richer set of events covering status, thinking, tool use, tool result, text, and completion — without breaking existing callers that only know `text|done|error`.
- **R2.** `PiBackend.promptStream` forwards real intermediate events from `session.subscribe(...)` instead of waiting for the final result.
- **R3.** `OpencodeBackend.promptStream` maps reasoning and tool events from the Opencode SSE feed into the new event taxonomy.
- **R4.** A new SSE endpoint exists for AI review that yields events as they happen and ends with a structured `result` event carrying `{ items, summary }`.
- **R5.** The grouping action gets the same treatment with the same machinery (no parallel implementations).
- **R6.** The existing non-streaming endpoints continue to work unchanged so we can roll out behind a UI choice.
- **R7.** A new client hook `useStreamingReview` exposes `status`, `phase`, `thinking`, `toolCalls`, `result`, `error`, `cancel()` and integrates with TanStack Query so the final result lands in the same `['ai-review']` cache as today.
- **R8.** The side panel renders a live "AI is working" surface with a thinking panel and a tool-call list while streaming, then collapses to today's review UI when `result` arrives.
- **R9.** Streaming is cancellable from the client (closes the SSE stream and disposes the agent session server-side).
- **R10.** The wire protocol survives reverse-proxy idle timeouts via SSE heartbeats.

---

## Scope Boundaries

- **Not** changing the prompt content or the review JSON schema. The `parseReviewOutput` parser stays as-is.
- **Not** persisting thinking/tool traces to disk in this plan — they are transient UI state. (See deferred follow-up.)
- **Not** introducing per-item NDJSON streaming of review items in this plan — items still arrive together inside the terminal `result` event. (See deferred follow-up.)
- **Not** changing model selection, settings, or the backend selection logic in `ai-backend/index.ts`.
- **Not** touching the comments, diff, or PR-info routes.

### Deferred to Follow-Up Work

- **Persist agent traces** with each review run so users can re-open a past review and inspect what the agent did. Requires schema changes in `reviews.ts`; out of scope here.
- **Per-item streaming via NDJSON prompt** so review items pop in one-by-one. Requires changing the prompt contract and parser; ship after the basic streaming pipeline is validated.
- **Delete the non-streaming `/api/ai/review/pr` and `/api/ai/grouping` endpoints** once the streaming UI is the default and stable.

---

## Context & Research

### Relevant Code and Patterns

- [`packages/server/src/services/ai-backend/types.ts`](packages/server/src/services/ai-backend/types.ts) — `StreamEvent` union to expand.
- [`packages/server/src/services/ai-backend/pi.ts`](packages/server/src/services/ai-backend/pi.ts) — `subscribe()` already yields the events we need; `promptStream` discards them.
- [`packages/server/src/services/ai-backend/opencode.ts`](packages/server/src/services/ai-backend/opencode.ts) — SSE consumer to enrich.
- [`packages/server/src/utils/sse.ts`](packages/server/src/utils/sse.ts) — `streamOpencodeResponse` shows the `streamSSE` (Hono) pattern; we'll generalize and reuse it.
- [`packages/server/src/routes/ai-review.ts`](packages/server/src/routes/ai-review.ts) — sibling SSE route lives here.
- [`packages/server/src/services/ai-review.ts`](packages/server/src/services/ai-review.ts) — `generatePRReview` to clone into a generator variant.
- [`packages/server/src/services/grouping.ts`](packages/server/src/services/grouping.ts) — same treatment for symmetry.
- [`packages/client/src/api/client.ts`](packages/client/src/api/client.ts) — request/error pattern; add a sibling `streamApi` that returns an `AsyncGenerator`.
- [`packages/client/src/hooks/use-ai-review.ts`](packages/client/src/hooks/use-ai-review.ts) — hook to extend; preserves `['ai-review']` cache shape.
- [`packages/client/src/components/side-panel/side-panel-container.tsx`](packages/client/src/components/side-panel/side-panel-container.tsx) — surface for the new live panel.

### Institutional Learnings

- AGENTS.md note: server local imports MUST use `.js` extension. New files (`stream-events.ts`, `sse-stream.ts`) must follow this.
- Pi SDK is loaded lazily — the queue bridge must not break that.

### External References

- [MDN SSE / `EventSource`](https://developer.mozilla.org/docs/Web/API/Server-sent_events/Using_server-sent_events) — auto-reconnect on a `GET` SSE feed will *replay* the agent run. We deliberately use `fetch` + `ReadableStream` so we control reconnection and can POST `additionalContext`.
- Hono `streamSSE` writes `event:` + `data:` frames and supports `await stream.writeSSE({...})`.

---

## Key Technical Decisions

- **Wire protocol: SSE over `POST` with `fetch` + `ReadableStream` reader.** Not `EventSource` (GET-only, no headers, auto-reconnect would re-run the agent). The `fetch` reader gives us POST body for `additionalContext`, headers, and `AbortController.abort()` for cancel.
- **Event taxonomy: discriminated union** in `types.ts` shared by all backends, all services, all routes, and the client. Single source of truth.
- **Server `promptStream` returns events; service layer wraps them.** `generatePRReviewStream` accumulates the assistant `text` events to build the buffer, parses JSON at `done`, and emits a final `result` event. This keeps backends dumb about review semantics.
- **Heartbeats every 15s** via SSE comment frames (`:keepalive\n\n`) so reverse proxies / Cloudflare don't drop idle connections during long thinking phases.
- **Cancellation:** server detects client disconnect via `c.req.raw.signal` (Hono passes the request signal), aborts the iterator, calls `session.dispose()` for Pi.
- **Cache integration:** the new hook still writes the final structured result to `queryClient.setQueryData(['ai-review'], …)` so the rest of the UI keeps working unchanged after streaming completes.
- **Backwards compatibility:** old `text|done|error` events stay valid members of the union. Existing `streamOpencodeResponse` keeps working.

---

## Open Questions

### Resolved During Planning

- **GET vs POST for SSE?** → POST + `fetch` reader (need request body and cancellation).
- **Persist traces?** → No, transient UI only in this plan. Deferred.
- **NDJSON per-item streaming?** → No, deferred. Final `result` event in this plan.
- **Reuse `streamOpencodeResponse`?** → Generalize and rename it to `streamAiResponse(c, generator)`; the route owns the generator (review/grouping), the helper owns SSE framing + heartbeat + cancellation.

### Deferred to Implementation

- **Exact Pi SDK event names.** The brainstorm assumed `tool_use` / `tool_result` / `text_delta` etc. The implementer should `console.log` events from `session.subscribe(...)` once during U2 to confirm names, then map. Listed as a known unknown rather than a research blocker because it's a 5-minute investigation and the mapping logic stays the same regardless of names.
- **Tool input previews.** How aggressively to truncate tool inputs and outputs in `tool_use`/`tool_result` events to keep SSE payloads small. Decide during U2/U3 with a sensible default (e.g., 500 chars).
- **Visual treatment of the thinking panel** (font, color, max-height, auto-scroll behavior). Defer to UI implementation in U7.

---

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```diagram
╭──────────────────────╮
│ Side panel UI        │
│  ├ Status banner     │
│  ├ Thinking panel    │   useStreamingReview()
│  └ Tool-call list    │   ── status / phase / thinking / toolCalls / result / error / cancel
╰──────────┬───────────╯
           │ fetch POST /api/ai/review/pr/stream  (Accept: text/event-stream)
           ▼
╭───────────────────────────────────────────────╮
│ routes/ai-review.ts  (sibling SSE route)      │
│   streamAiResponse(c, generatePRReviewStream) │
╰────────────────┬──────────────────────────────╯
                 │ for await (event of …) → SSE frame
                 ▼
╭───────────────────────────────────────────────╮
│ services/ai-review.ts                         │
│   async *generatePRReviewStream(...)          │
│     yield {type:'status',phase:'starting'}    │
│     for await (ev of backend.promptStream())  │
│       if text → buffer += content; yield ev   │
│       else yield ev                           │
│     yield {type:'result', result: parsed}     │
╰────────────────┬──────────────────────────────╯
                 ▼
╭───────────────────────────────────────────────╮
│ AiBackend.promptStream  → AsyncGenerator<StreamEvent> │
├───────────────────────────────────────────────╮
│ PiBackend            │ OpencodeBackend         │
│  subscribe→queue     │  /event SSE → translate │
│  emit thinking/tool  │  emit reasoning/tool    │
│  /text/done/error    │  /text/done/error       │
╰──────────────────────┴─────────────────────────╯
```

Event union sketch (directional, not literal):

```ts
type StreamEvent =
  | { type: 'status'; phase: 'starting' | 'fetching_pr' | 'analyzing' | 'finalizing'; message?: string }
  | { type: 'thinking'; content: string; delta?: boolean }
  | { type: 'tool_use'; toolName: string; input?: unknown; callId: string }
  | { type: 'tool_result'; callId: string; ok: boolean; preview?: string }
  | { type: 'text'; content: string; delta?: boolean }
  | { type: 'token_usage'; inputTokens?: number; outputTokens?: number }
  | { type: 'done' }
  | { type: 'error'; error: string };

// Service-layer addition (wrapped by route, not part of backend contract):
type ReviewStreamEvent = StreamEvent | { type: 'result'; result: AIReviewPRResult };
```

---

## Implementation Units

- [x] U1. **Expand `StreamEvent` taxonomy in ai-backend types**

**Goal:** Establish a single richer event union shared by backends, services, routes, and the client.

**Requirements:** R1.

**Dependencies:** None.

**Files:**
- Modify: `packages/server/src/services/ai-backend/types.ts`

**Approach:**
- Replace the current 3-shape `StreamEvent` with a discriminated union covering `status | thinking | tool_use | tool_result | text | token_usage | done | error`.
- Keep the previously valid shapes (`text`, `done`, `error`) as-is so existing `streamOpencodeResponse` callers and `OpencodeBackend.promptStream` keep compiling without changes.
- Re-export the type from `ai-backend/index.ts` (already does — verify).

**Patterns to follow:**
- Existing union exports in `types.ts`.

**Test scenarios:**
- Test expectation: none — pure type definition with no behavior. Type-check via `pnpm --filter @clm/server check-types` is the validation.

**Verification:**
- `pnpm --filter @clm/server check-types` passes.
- `import type { StreamEvent }` in a scratch file shows the new variants in tooling.

---

- [x] U2. **Make `PiBackend.promptStream` actually stream via subscribe → queue bridge**

**Goal:** Convert Pi's "wait for final, yield once" implementation into a real async generator that forwards intermediate `thinking`, `tool_use`, `tool_result`, and `text` events from `session.subscribe(...)`.

**Requirements:** R1, R2.

**Dependencies:** U1.

**Files:**
- Modify: `packages/server/src/services/ai-backend/pi.ts`

**Approach:**
- Build a small queue + promise bridge so subscribe-callback pushes can be `yield`ed by the generator.
- Spike once with a `console.log` inside `subscribe(...)` to confirm Pi SDK event names; map them to the new union.
- Treat `agent_end` (or equivalent) as the natural terminator that yields `{ type: 'done' }`.
- On generator return / throw / external abort, call `unsub()` and `session.dispose()` in a `try/finally` so cancellation reliably tears down the agent.
- Truncate tool input/output previews to ≤500 chars to keep payloads small.
- Refactor `prompt()` to wrap `promptStream()` (drains it, accumulates `text`, returns final string), eliminating the duplicated subscribe wiring.

**Execution note:** Do the 5-minute spike first — log every event from `subscribe(...)` for a single review run so the mapping is grounded in real names, not assumed ones.

**Patterns to follow:**
- Existing `subscribe`/`message_end`/`agent_end` handling in `pi.ts`.
- Keep the lazy `loadPiSdk()` cache untouched.

**Test scenarios:**
- Happy path — running `promptStream` with a simple message yields at least one `status` or `text`/`thinking` event before `done`, and `done` is the last event.
- Tool-using path — when the prompt triggers a `Read`/`Bash` tool, the iterator emits a `tool_use` followed by a `tool_result` with matching `callId`.
- Error path — when the SDK reports an error, the iterator yields `{ type: 'error', error }` and terminates without throwing.
- Cleanup — calling `iterator.return()` mid-stream calls `session.dispose()` (verify with a spy or by observing no further log lines after cancel).
- Equivalence — `prompt()` (now a wrapper) returns the same final text as the old implementation for the same input.

**Verification:**
- A small integration script under `apps/cli/` or a manual `bun run` invokes `getAiBackend().promptStream("review this small repo")` and prints events; tool calls and message text appear progressively, not in one burst.

---

- [ ] U3. **Enrich `OpencodeBackend.promptStream` event mapping**

**Goal:** Map Opencode's reasoning and tool events into the same union, so the route layer is backend-agnostic.

**Requirements:** R1, R3.

**Dependencies:** U1.

**Files:**
- Modify: `packages/server/src/services/ai-backend/opencode.ts`

**Approach:**
- Extend the SSE event switch beyond `message.part.updated` / `assistant.message.part`:
  - Reasoning parts (`message.part.reasoning`, `assistant.message.part.reasoning`, or whichever Opencode emits) → `thinking`.
  - Tool input events → `tool_use` with `toolName`, `input`, `callId`.
  - Tool output events → `tool_result` with `ok`, `preview`.
- Preserve the existing `text`, `done`, `error` mapping unchanged.
- Add the same ≤500-char preview truncation rule.

**Patterns to follow:**
- The existing `event.type === '…'` switch in `opencode.ts`.

**Test scenarios:**
- Happy path — given a recorded fixture stream containing reasoning + tool events, the generator yields `thinking`, `tool_use`, `tool_result`, `text`, `done` in order.
- Unknown event types are silently ignored (today's behavior preserved).
- Bad JSON in an event line does not abort the stream; logged at debug.

**Verification:**
- Manual: with `AI_BACKEND=opencode` against a running `opencode serve`, observe the new event types stream through `streamAiResponse` to a curl client.

---

- [x] U4. **Add `generatePRReviewStream` and `generateGroupingStream` services**

**Goal:** Service-layer generators that wrap the backend stream, accumulate assistant text, parse the final JSON, and emit a terminal `result` event.

**Requirements:** R4, R5.

**Dependencies:** U1, U2, U3.

**Files:**
- Modify: `packages/server/src/services/ai-review.ts`
- Modify: `packages/server/src/services/grouping.ts`

**Approach:**
- Add `export async function* generatePRReviewStream(prLink, opts): AsyncGenerator<ReviewStreamEvent>`:
  - Yield a `status: starting` event.
  - Build the prompt and resolve model/variant exactly like `generatePRReview`.
  - Iterate `getAiBackend().promptStream(prompt, …)`; accumulate `text` content into a buffer; re-yield every event.
  - On `done`, parse the buffer with `parseReviewOutput` and yield `{ type: 'result', result }`, then a final `done`.
  - On `error`, yield it and stop.
- Mirror in `grouping.ts` with `generateGroupingStream` returning a `result` event of `GroupingResult`.
- Define `ReviewStreamEvent` and `GroupingStreamEvent` types in the same files (or a shared `ai-stream-events.ts`) — they extend `StreamEvent` with a `result` variant.

**Patterns to follow:**
- Existing `generatePRReview` / `generateGrouping` for prompt building, model resolution, and error wrapping.

**Test scenarios:**
- Happy path — given a stub backend that emits a few `text` events containing a valid JSON block, the generator yields the streamed events and finishes with a `result` containing parsed `items` + `summary`.
- Empty/invalid JSON — the generator still yields `result` with `{ items: [], summary: '' }` (matches today's `parseReviewOutput` behavior); a warning is logged.
- Backend error — when the backend yields `error`, the service re-yields it and does not yield `result`.

**Verification:**
- Unit tests run via the existing test setup (mirror `ai-review-prompt.test.ts` location/pattern).

---

- [x] U5. **Add SSE routes alongside existing JSON routes**

**Goal:** Expose `/api/ai/review/pr/stream` and `/api/ai/grouping/stream` as POST SSE endpoints that drive the new service generators. Keep the existing JSON endpoints intact.

**Requirements:** R4, R5, R6, R9, R10.

**Files:**
- Modify: `packages/server/src/routes/ai-review.ts`
- Modify: `packages/server/src/routes/grouping.ts`
- Modify: `packages/server/src/utils/sse.ts` (generalize)

**Approach:**
- Generalize `streamOpencodeResponse` into `streamAiResponse(c, () => AsyncGenerator<E>)`:
  - Iterate the generator, write each event as `event: <type>` + `data: <json>` frames.
  - Send a `:keepalive\n\n` comment every 15s while idle.
  - Wire `c.req.raw.signal` so client disconnect aborts the iterator (calls `iterator.return()`), which propagates to `session.dispose()` from U2.
- Add `app.post('/pr/stream', …)` in `ai-review.ts`:
  - Reuse the existing `safeJson` + `normalizeAdditionalContext` request validation.
  - Call `streamAiResponse(c, () => generatePRReviewStream(prLink, { additionalContext }))`.
- Add `app.post('/stream', …)` in `grouping.ts` symmetrically.
- Keep the existing POST `/pr` and grouping JSON routes unchanged.

**Patterns to follow:**
- Existing `streamSSE` pattern in `streamOpencodeResponse`.
- Existing route style in `ai-review.ts` (request validation, `wrapError`).

**Test scenarios:**
- Happy path — `curl -N -X POST .../pr/stream -d '{}'` shows multiple `event:` frames culminating in `event: result` then `event: done`.
- Cancel — closing the curl connection mid-stream causes the server to log `session.dispose()` and stop emitting events.
- Validation — invalid `additionalContext` returns a 400 JSON response (no SSE opened), matching the JSON endpoint's behavior.
- Heartbeat — during a 30s+ thinking phase, `:keepalive` frames keep the connection alive (visible in curl with `-v`).
- Backwards compat — the existing `POST /pr` JSON endpoint still returns the same shape as before.

**Verification:**
- `curl -N -X POST http://localhost:<port>/api/ai/review/pr/stream -H 'Content-Type: application/json' -d '{}'` against a running dev server, observed in a real PR context, prints progressive events.
- The existing client (untouched) still works against `POST /pr`.

---

- [ ] U6. **Frontend: streaming SSE client + `useStreamingReview` hook**

**Goal:** Provide a React hook that consumes the SSE endpoint, exposes live state, and writes the terminal result into the existing `['ai-review']` query cache so the rest of the UI keeps working.

**Requirements:** R7, R9.

**Files:**
- Create: `packages/client/src/api/ai-stream.ts`
- Modify: `packages/client/src/api/ai.ts` (re-export streaming API)
- Modify: `packages/client/src/hooks/use-ai-review.ts`

**Approach:**
- In `ai-stream.ts`: implement `streamAiReview(body, signal): AsyncGenerator<ReviewStreamEvent>`:
  - `fetch('/api/ai/review/pr/stream', { method: 'POST', headers: {...}, body, signal })`.
  - Read `response.body` with a reader, decode chunks, split on `\n\n`, parse `event:` + `data:` lines.
  - Yield typed events; close on `done` or `error`.
- In `use-ai-review.ts`: add a `useStreamingReview()` mode (or extend the existing hook) that:
  - Owns local `useState` for `phase`, `thinking` (string), `toolCalls` (array), `text` (optional accumulator).
  - Drives the generator inside an `useEffect`-managed `AbortController`.
  - On `result`, calls `queryClient.setQueryData(['ai-review'], { items: transformAIReviewItems(result.items), summary: result.summary })` exactly like the current mutation.
  - Exposes `cancel()` that calls `controller.abort()`.
- Mirror for `useStreamingGrouping`.
- Keep the existing `triggerReview` non-streaming path available behind a feature flag (a constant in `use-ai-review.ts` for now) so we can A/B in dev.

**Patterns to follow:**
- Existing `fetchApi` request/error handling in `client.ts` (reuse `API_BASE`, error shape).
- Existing `transformAIReviewItems` in `lib/transforms`.
- Existing `['ai-review']` cache key contract.

**Test scenarios:**
- Happy path — given a mocked SSE response, the hook reports `status: 'streaming'`, accumulates thinking text, lists tool calls, and on `result` flips to `done` and writes the cache entry that `useAIReview` already reads.
- Cancel — calling `cancel()` aborts the fetch and leaves the hook in `idle`/`done` without throwing.
- Error event — `event: error` from server transitions the hook to `error` state with the message exposed.
- Cache integration — after a successful run, the existing review-display components render items without any other changes.

**Verification:**
- `pnpm --filter @clm/client check-types` and `pnpm --filter @clm/client lint` pass.
- Manual run in dev with the side panel open shows live updates.

---

- [ ] U7. **Frontend: live "AI is working" surface in the side panel**

**Goal:** Render a live progress surface while a stream is in flight: a status banner, a collapsible thinking panel, and a tool-call list. Collapse to today's review UI when `result` arrives.

**Requirements:** R8.

**Files:**
- Create: `packages/client/src/components/side-panel/ai-progress-panel.tsx`
- Modify: `packages/client/src/components/side-panel/side-panel-container.tsx`

**Approach:**
- New `<AIProgressPanel />` consumes the `useStreamingReview` state and renders three subsections:
  - Status banner driven by `phase` (e.g., "Analyzing PR…").
  - Thinking panel — collapsible, dimmed monospace, auto-scrolls to bottom as `thinking` grows; collapsed by default once long.
  - Tool-call list — one row per call with an icon by tool name, the truncated input, and a check/cross when `tool_result` arrives.
- Wire a "Cancel" button that calls `cancel()`.
- In `side-panel-container.tsx`, render `<AIProgressPanel />` when `status === 'streaming'`, fall back to today's results UI when `result` is set.
- Trigger button now invokes the streaming path (when the feature flag from U6 is on) instead of `triggerReview`.

**Patterns to follow:**
- Existing component structure in `side-panel/` (compound exports if applicable).
- Tailwind v4 + shadcn/ui conventions; `cn()` helper from `@/lib/utils`.

**Test scenarios:**
- Render — when `useStreamingReview` reports `status: 'streaming'` with thinking + tool calls, all three subsections render with expected content.
- Collapse — when `result` arrives, the progress panel hides and the existing review list renders.
- Cancel — clicking Cancel transitions the panel to a "Cancelled" empty state.
- Empty stream — if no thinking/tool events arrive (e.g., a fast Opencode response), the panel just shows the status banner without empty boxes.

**Verification:**
- Manual: trigger an AI review on a small PR; thinking and tool-call rows appear progressively, collapse on completion, and Cancel works mid-stream.
- `pnpm --filter @clm/client check-types` and `lint` pass.

---

## System-Wide Impact

- **Interaction graph:** New SSE routes share `streamAiResponse` (utils/sse.ts). Both `ai-review.ts` and `grouping.ts` route files depend on it. The client `useStreamingReview` integrates with the existing TanStack Query cache (`['ai-review']`, `['ai-grouping']`) so downstream components are unaffected.
- **Error propagation:** Backend errors flow through `StreamEvent { type: 'error' }` instead of throwing through Hono's `app.onError`. The route helper must still set non-200 status when no events have been written yet (e.g., validation failure), but once the SSE stream is open errors are in-band.
- **State lifecycle risks:** Cancellation must reliably call `session.dispose()` in `PiBackend` to avoid orphaned agent sessions consuming Pi SDK memory. Verify in U2 tests.
- **API surface parity:** New SSE endpoints are *additive*. Existing `POST /pr` and `POST /grouping` keep working until the deferred follow-up removes them. Both response shapes (final `result.result` and the JSON body) carry the same `AIReviewPRResult` / `GroupingResult`.
- **Integration coverage:** The cache-write contract in `useStreamingReview` (writes the same shape under the same key) is the integration seam that makes the change invisible to the rest of the UI. Cover it explicitly in U6 tests.
- **Unchanged invariants:** Prompt content, JSON parser (`parseReviewOutput`), settings/model selection, and the `AiBackend` selection in `ai-backend/index.ts` are all untouched.

---

## Risks & Dependencies

| Risk | Mitigation |
|---|---|
| Pi SDK event names differ from the brainstorm's assumed names. | U2 explicitly starts with a 5-minute logging spike to ground the mapping in reality. |
| Reverse proxies / Cloudflare drop idle SSE connections during long thinking phases. | 15s `:keepalive` heartbeats in `streamAiResponse`. |
| Client cancel does not actually abort the agent, leaving Pi sessions alive. | Wire `c.req.raw.signal` into the route helper; rely on generator `try/finally` to call `session.dispose()`. Cover with U2 cleanup test. |
| Tool input/output payloads bloat SSE traffic. | Truncate to ≤500 chars by default in U2/U3. |
| The new event union breaks `streamOpencodeResponse` callers. | The union is additive — `text|done|error` remain valid variants. Verify with `check-types` after U1. |
| `EventSource`-style auto-reconnect would re-trigger the agent on a transient drop. | Use `fetch` + `ReadableStream` reader (not `EventSource`); reconnection is a manual user action via the trigger button. |
| The Pi backend's lazy SDK load could break under the queue bridge. | Keep `loadPiSdk()` cache; only the per-call session changes. |

---

## Documentation / Operational Notes

- Update `packages/server/README.md` (if it documents endpoints) with the new `/stream` routes.
- Add a one-paragraph note to `AGENTS.md` under "Key Dependencies" if a new SSE pattern is introduced for client consumption.
- No env-var changes. No DB changes. No new third-party deps required (Hono `streamSSE` already imported).

---

## Sources & References

- Brainstorm transcript above this plan in the same Amp thread (no `docs/brainstorms/` doc was created; the user requested planning directly).
- Related code: `packages/server/src/services/ai-backend/`, `packages/server/src/utils/sse.ts`, `packages/client/src/hooks/use-ai-review.ts`.
- External: [Hono streaming docs](https://hono.dev/docs/helpers/streaming), [MDN SSE](https://developer.mozilla.org/docs/Web/API/Server-sent_events/Using_server-sent_events).
