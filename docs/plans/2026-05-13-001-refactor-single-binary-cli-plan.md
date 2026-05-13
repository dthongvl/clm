---
title: refactor: Single-binary CLI with embedded server and frontend
type: refactor
status: active
date: 2026-05-13
origin: docs/brainstorms/2026-05-13-single-binary-cli-requirements.md
---

# refactor: Single-binary CLI with embedded server and frontend

## Overview

Refactor CLM from a three-process architecture (CLI → Bun.spawn → Hono server → filesystem-served SPA) into a single standalone Bun-compiled binary that embeds both the server runtime (from `@clm/server`) and the pre-built frontend assets (from `@clm/client`). The binary starts an in-process Hono HTTP server with the embedded web UI; dev mode proxies frontend requests to the Vite dev server.

**Target:** `apps/cli/dist/clm` — a standalone executable with no runtime dependency on the monorepo layout, `node_modules`, or Bun source.

---

## Problem Frame

The current three-process model (see origin: `docs/brainstorms/2026-05-13-single-binary-cli-requirements.md`) requires the full monorepo tree at runtime, adds IPC complexity via stdout port parsing and manual health checks, and makes distribution impractical (users need Bun installed, repo cloned, and dependencies installed). A single self-contained binary solves all of these.

**Key pain points addressed:**
- Binary depends on monorepo-relative path `import.meta.resolve('../../client/dist')` for static files
- Server operates as a script with module-level side effects, not an importable library
- CLI communicates with server via env vars and `Bun.spawn` stdout parsing
- No distributable artifact exists

---

## Requirements Trace

| ID | Description | Implemented in |
|----|------------|----------------|
| R1 | Build client SPA via Vite before generating embedded file map | U4 |
| R2 | Generate `clm-web-ui.gen.ts` with `import ... with { type: "file" }` per asset, export URL-path-to-file record | U4 |
| R3 | Standalone binary via `Bun.build({ compile: true })` — no runtime file deps | U4 |
| R4 | `@clm/server` exports `createServer(options)` → `{ port, url, stop }` | U1 |
| R5 | `@clm/server` exports `createApp(options)` → configured Hono app (no server start) | U1 |
| R6 | Static serving: try embedded → catch → proxy; no filesystem-serve fallback | U2 |
| R7 | Dev mode: proxy non-API GETs to configurable upstream (default `http://localhost:5173`) | U2 |
| R8 | Server independently runnable in dev mode via `bun run src/index.ts` (guard on `Bun.main`) | U1, U7 |
| R9 | CLI imports `@clm/server` directly, calls `createServer()` — no `Bun.spawn` subprocess | U5 |
| R10 | CLI passes `prNumber`, `repo`, `baseRef`, `headRef` as direct arguments (not env vars) | U5, U6 |
| R11 | Shutdown handler calls `server.stop()` instead of killing subprocess | U5 |

**Origin actors:** A1 CLI user, A2 Developer, A3 Release pipeline
**Origin flows:** F1 Build the binary, F2 Run the binary, F3 Run in dev mode

---

## Scope Boundaries

- No multi-platform cross-compilation in v1 (only `bun-linux-x64` via `--target`; extend per-OS as needed)
- No Electron desktop build
- No npm distribution packaging
- No CI/CD pipeline for the build
- No changes to the client's Vite config or development tooling
- No CSP headers or security hardening
- No changes to the OpenCode launcher subprocess (it remains a `Bun.spawn` of the external `opencode` binary)
- The existing CORS config (`localhost:5173`, `localhost:3000`) stays as-is; the proxy port in dev mode is already allowed

### Deferred to Follow-Up Work

- `process.env` mutation race in `diff.ts` (`getEnvRefs()` fallback) — tracked in server-architecture-review but out of scope for this refactor
- Refactoring duplicated utilities (buildPRLink, YAML extraction, SSE streaming) — separate hardening project
- Server architecture review P1/P2 fixes not directly blocking the single-binary migration

---

## System-Wide Impact

| Package | Nature of Change | Impact |
|---------|-----------------|--------|
| `@clm/server` | From script to library | Exports `createApp`/`createServer`; top-level side effects move into factory functions; package.json gains `exports` field |
| `@clm/cli` | Server lifecycle rewrite | `Bun.spawn` replaced with direct in-process call; shutdown uses `stop()`; `server.ts` substantially rewritten |
| `@clm/client` | No code changes | Only the build output (Vite `dist/`) is consumed; no source changes |
| Build pipeline | New build.ts script | Introduces first programmatic `Bun.build()` call with `compile: true` and `files` option; generates virtual TypeScript module |
| Turborepo | Task dependency chain | CLI build must depend on client build; turbo.json updates needed |

---

## Key Technical Decisions

1. **Server as importable library (R4, R5):** `@clm/server` exports `createServer(options)` and `createApp(options)`. Module-level side effects (`initAppContext`, `loadGhToken`, `initOctokit`) move into these functions, accepting parameters instead of reading `process.env`. The existing `packages/server/src/index.ts` becomes the library entry point.

2. **Two-mode UI serving, not filesystem fallback (R6):** Matches OpenCode's pattern. Production: assets served from embedded `clm-web-ui.gen.ts` file map. Dev: `import("clm-web-ui.gen.ts")` fails → catch → proxy non-API GETs to `http://localhost:5173`. No `import.meta.resolve`-based fallback.

3. **Bare-specifier `"clm-web-ui.gen.ts"` via Bun's `files` option:** The build script passes the generated source as `files: { "clm-web-ui.gen.ts": generatedCode }` to `Bun.build()`. The server imports it as a bare specifier `import("clm-web-ui.gen.ts")`, which Bun resolves from the `files` map during compilation. This requires listing `"clm-web-ui.gen.ts"` as an entrypoint in `Bun.build()` in addition to the `files` option.

4. **Package exports for `@clm/server`:** Use `"exports": { ".": { "import": "./src/index.ts", "types": "./src/types/index.ts" } }` in `packages/server/package.json`. The CLI imports `@clm/server` and Bun resolves TypeScript source directly. No separate declaration build needed.

5. **Standalone dev mode backward compatibility (R8):** When `bun run src/index.ts` is invoked standalone (not compiled), map `process.env.CLIENT_DIST` to `devUpstream`. Default to `http://localhost:5173` when neither embedded UI nor env var is set.

---

## Implementation Units

### U1. Server: Extract `createApp()` and `createServer()` factory functions

- **Goal:** Convert `@clm/server` from a standalone script into an importable library with well-defined factory functions.
- **Requirements:** R4, R5, R8
- **Dependencies:** None (first unit)
- **Files:**
  - `packages/server/src/index.ts` — rewrite as library entry point
  - `packages/server/src/lib/app-context.ts` — refactor to accept params instead of reading `process.env`
  - `packages/server/src/lib/github-auth.ts` — refactor `loadGhToken`/`initOctokit` into parameterized functions
  - `packages/server/package.json` — add `exports` and `types` fields
  - `packages/server/src/types/index.ts` — add `CreateAppOptions` and `CreateServerOptions` type exports
- **Approach:**
  - Define `CreateServerOptions` interface: `{ prNumber: string; repo: string; baseRef: string; headRef: string; devUpstream?: string; ghToken?: string; opencodeUrl?: string }`
  - Define `CreateAppOptions` as a subset (everything except `devUpstream` which is server-level, or include it as a no-op in `createApp`)
  - `createServer(opts)` → calls `createApp(opts)` with the Hono app, then `Bun.serve({ fetch: app.fetch, port: opts.port || 0 })` → returns `{ port, url, stop }`
  - `createApp(opts)` → instantiates Hono `new Hono()`, configures CORS, logging, routes, error handlers, static serving — returns the configured app without starting it
  - Move `initAppContext({ prNumber, repo })`, `loadGhToken(token)`, `initOctokit()` into `createApp()` so they're called at construction time, not import time
  - Preserve `if (Bun.main === import.meta.path)` guard at the bottom for standalone dev mode — reads `process.env` and calls `createServer()` with defaults
  - Add `"exports": { ".": { "import": "./src/index.ts", "types": "./src/types/index.ts" } }` to `package.json`
- **Patterns to follow:** Existing `AppContext` singleton pattern, but parameterized; existing route registration pattern (unchanged)
- **Test scenarios:**
  - **Happy path:** `createApp()` with valid options returns a configured Hono app that responds to `GET /api/health` with 200
  - **Happy path:** `createServer()` returns `{ port, url, stop }` where `stop()` gracefully terminates the server
  - **Happy path:** `createServer()` without `port` option binds to a random port (port > 0)
  - **Edge case:** `createApp()` called without `prNumber` or `repo` — may throw or set partial context; behavior should be documented
  - **Integration:** Routes registered via `createApp()` properly dispatch to their handlers (test one route per category: AI, git, settings)
- **Verification:** `bun run packages/server/src/index.ts` starts the server standalone and serves API routes; `bun --filter @clm/server check-types` passes

---

### U2. Server: Add two-mode static file serving (embedded / proxy)

- **Goal:** Replace the filesystem-based `serveStatic` with a two-mode strategy: serve from embedded asset map (production) or proxy to Vite dev server (development).
- **Requirements:** R6, R7
- **Dependencies:** U1 (createServer/createApp must exist)
- **Files:**
  - `packages/server/src/index.ts` — add embedded/proxy logic in `createApp()`
  - `packages/server/src/lib/static-serve.ts` — new file: two-mode static file serving middleware
  - `packages/server/src/types/index.ts` — add `UiMode` type and update `CreateAppOptions`
- **Approach:**
  - Create `static-serve.ts` with:
    - `async function getUiMode(devUpstream?: string): Promise<UiMode>` — tries `import("clm-web-ui.gen.ts")`, if succeeds → `{ mode: "embedded", assets: fileMap }`, if fails → `{ mode: "proxy", upstream: devUpstream || "http://localhost:5173" }`
    - In `createApp()`, call `getUiMode()` and store the result
    - **Embedded mode:** For each asset in the file map, register a `GET /<urlPath>` handler that returns the file contents with correct MIME type. Serve `index.html` as SPA fallback for non-API, non-asset GET requests.
    - **Proxy mode:** Register a catch-all `GET *` handler (non-API, non-asset) that proxies to the upstream dev server using `fetch()`. Return the proxied response with headers forwarded.
    - Keep existing API route handlers unchanged — only the static file serving / SPA fallback portion changes.
  - Remove the old `serveStatic` import from `hono/bun` and the `import.meta.resolve('../../client/dist')` path
  - The `index.html` SPA fallback in embedded mode reads from the file map instead of the filesystem
- **Patterns to follow:** OpenCode's two-mode pattern as described in the origin doc; existing route registration patterns
- **Test scenarios:**
  - **Happy path (embedded):** `createApp()` with embedded mode serves asset files (JS, CSS, HTML) with correct content types
  - **Happy path (embedded):** SPA fallback returns `index.html` content for non-API GET requests
  - **Happy path (proxy):** `createApp()` with `devUpstream` set proxies a GET request and returns the upstream response
  - **Edge case:** Proxy upstream is unreachable — handler returns 502 with clear error message
  - **Error path:** `clm-web-ui.gen.ts` imports but file map is empty — graceful degradation (serve fallback page or 404 with explanation)
  - **Integration:** API routes still work in both modes (`GET /api/health` returns 200 in embedded and proxy mode)
- **Verification:** Unit test with mock file map serves assets correctly; integration test with proxy mode returns upstream responses

---

### U3. Server: Update standalone dev mode entry point

- **Goal:** Ensure `bun run packages/server/src/index.ts` continues to work standalone (not compiled) with sensible defaults.
- **Requirements:** R8
- **Dependencies:** U1, U2
- **Files:**
  - `packages/server/src/index.ts` — update the `Bun.main === import.meta.path` guard block
- **Approach:**
  - The standalone guard block (at bottom of `index.ts`) currently reads `process.env` and calls `Bun.serve()`. Refactor it to call `createServer()` with options derived from env vars:
    - `prNumber` from `process.env.PR_NUMBER`
    - `repo` from `process.env.REPO`
    - `baseRef` from `process.env.BASE_REF`
    - `headRef` from `process.env.HEAD_REF`
    - `devUpstream` from `process.env.CLIENT_DIST` (if set, maps to dev proxy; default: `http://localhost:5173`)
    - `ghToken` from `process.env.GITHUB_TOKEN` or `gh auth token`
  - This replaces the current inline `initAppContext()`, `loadGhToken()`, `initOctokit()`, `Bun.serve()` sequence
  - The `__CLM_PORT__:PORT` stdout line should still be emitted for backward compatibility (it's harmless)
- **Patterns to follow:** U1's `createServer()`; the old env-var reading pattern but routed through the new factory
- **Test scenarios:**
  - **Happy path:** Running `CLIENT_DIST=http://localhost:5173 bun run packages/server/src/index.ts` starts server in proxy mode
  - **Happy path:** Running without env vars starts but UI requests proxy to `http://localhost:5173` (default)
  - **Regression:** The process still outputs `__CLM_PORT__:PORT` to stdout (for any scripts depending on this output)
- **Verification:** `bun run packages/server/src/index.ts` starts and `curl http://localhost:PORT/api/health` returns 200

---

### U4. CLI: Create build script for standalone binary

- **Goal:** Produce a standalone executable (`apps/cli/dist/clm`) via a build script that orchestrates the full pipeline.
- **Requirements:** R1, R2, R3
- **Dependencies:** U1, U2 (server package as importable library)
- **Files:**
  - `apps/cli/scripts/build.ts` — new file: build orchestration script
  - `apps/cli/package.json` — add `"build": "bun run scripts/build.ts"` script
  - `apps/cli/tsconfig.json` — ensure scripts directory is included
- **Approach:**
  - Script steps:
    1. **Build client:** `Bun.spawnSync(["pnpm", "--filter", "@clm/client", "build"], { stdio: "inherit" })` — builds the Vite SPA into `packages/client/dist/`
    2. **Scan dist:** Walk `packages/client/dist/` recursively, collect all files excluding `.map` files and `.DS_Store`
    3. **Generate `clm-web-ui.gen.ts`:** Build a string with one `import assetPath from "./relative/path" with { type: "file" }` per asset, then export a `Record<string, string>` mapping URL paths to the imported values:
       ```typescript
       // Generated — do not edit
       import _index_html from "./packages/client/dist/index.html" with { type: "file" };
       import _assets_index_js from "./packages/client/dist/assets/index-abc123.js" with { type: "file" };
       export const uiAssets: Record<string, string> = {
         "/": _index_html,
         "/index.html": _index_html,
         "/assets/index-abc123.js": _assets_index_js,
       };
       ```
    4. **Build binary:** `Bun.build({ entrypoints: ["./src/index.ts"], outdir: "./dist", target: "bun", compile: true, files: { "clm-web-ui.gen.ts": generatedCode }, naming: "clm" })`
    5. Output to `apps/cli/dist/clm`
  - The `files` option makes `"clm-web-ui.gen.ts"` resolvable as a bare specifier. The server's `import("clm-web-ui.gen.ts")` resolves during compilation.
  - Also list `"clm-web-ui.gen.ts"` as an entrypoint to ensure Bun includes it in the module graph
  - The generated paths in `import` statements should be relative to the monorepo root (since Bun's `files` option maps module names, not filesystem locations) — the actual files referenced by `import ... with { type: "file" }` must be real files on disk that Bun embeds. The import paths point to the built asset files on disk.
  - After compilation, verify the output binary exists and is executable
  - No CI/CD integration in this unit (out of scope per scope boundaries)
- **Patterns to follow:** This is a new pattern in the repo — no existing `build.ts` scripts to mirror
- **Test scenarios:**
  - **Happy path:** `bun run scripts/build.ts` produces `apps/cli/dist/clm` as an executable binary
  - **Happy path:** Generated `clm-web-ui.gen.ts` source includes all asset files from `packages/client/dist/` (verify by running the gen step in isolation)
  - **Edge case:** Client dist is empty or missing — build fails with clear error message
  - **Edge case:** Client dist contains subdirectory assets (nested paths) — generated map includes correct relative paths
  - **Verification:** After build, `file apps/cli/dist/clm` identifies it as an executable; binary is > 10MB (bundles server code + client assets)
- **Verification:** `bun run scripts/build.ts` exits 0; `apps/cli/dist/clm` exists and is executable

---

### U5. CLI: Refactor server lifecycle — replace subprocess with in-process server

- **Goal:** Replace `Bun.spawn` of the server subprocess with a direct in-process call to `createServer()` from `@clm/server`.
- **Requirements:** R9, R10, R11
- **Dependencies:** U1 (createServer must exist), U4 (binary build needs the whole chain, but dev mode needs this too)
- **Files:**
  - `apps/cli/src/server.ts` — rewrite: remove `Bun.spawn`, import `createServer` directly
  - `apps/cli/src/types.ts` — update or remove `ServerEnv` and `ServerResult` types (replaced by `createServer` return)
  - `apps/cli/src/index.ts` — update server startup call
  - `apps/cli/src/shutdown.ts` — replace `serverProcess.kill()` with `server.stop()`
- **Approach:**
  - In `server.ts`, replace the entire `startServer(env)` function:
    ```typescript
    import { createServer } from "@clm/server";
    
    export async function startServer(params: {
      prNumber: string;
      repo: string;
      baseRef: string;
      headRef: string;
      opencodeUrl?: string;
    }): Promise<{ port: number; url: string; stop: () => Promise<void> }> {
      const server = await createServer({
        ...params,
        port: 0, // random port
      });
      console.log(`__CLM_PORT__:${server.port}`);
      return server;
    }
    ```
  - Remove `waitForServerPort()` (no stdout parsing needed — `server.port` is synchronous)
  - Keep `waitForServerHealth()` as a startup readiness check (the server may need a moment to init, though `createServer` is async and returns only when ready — consider whether polling is still needed)
  - In `shutdown.ts`, replace `serverProcess.kill()` with `server.stop()`:
    ```typescript
    export async function shutdown(server: { stop: () => Promise<void> }, opencodeLauncher: OpencodeLauncher) {
      await server.stop();
      opencodeLauncher.shutdown();
      process.exit(0);
    }
    ```
  - In `index.ts`, pass PR args as direct object:
    ```typescript
    const server = await startServer({
      prNumber, repo, baseRef, headRef, opencodeUrl
    });
    ```
    Instead of building an env object and passing it to `Bun.spawn`
- **Patterns to follow:** The existing `ServerEnv` type shape is preserved as the params object shape; the existing shutdown timeout pattern is preserved but applies to the async `stop()` call instead of `kill()`
- **Test scenarios:**
  - **Happy path:** `startServer()` returns `{ port, url, stop }` and the server responds to health checks at `http://localhost:PORT/api/health`
  - **Happy path:** `stop()` gracefully terminates the server, subsequent health checks fail
  - **Edge case:** `createServer()` throws (e.g., invalid params) — `startServer()` propagates the error
  - **Regression:** The `__CLM_PORT__:PORT` stdout line is still emitted (consumed by any external scripts watching the CLI output)
- **Verification:** `bun run apps/cli/src/index.ts 123` (in a git repo) starts the server in-process and opens the browser

---

### U6. CLI: Update entry point to pass args directly

- **Goal:** Clean up `apps/cli/src/index.ts` to pass PR information as direct arguments to `createServer()` instead of setting env vars for subprocess consumption.
- **Requirements:** R10
- **Dependencies:** U5 (new server import must exist)
- **Files:**
  - `apps/cli/src/index.ts` — remove env var setup code, pass args directly to `startServer()`
- **Approach:**
  - Currently `index.ts` builds an env object with `PR_NUMBER`, `REPO`, `BASE_REF`, `HEAD_REF`, `OPENCODE_URL` and passes it to `startServer(env)` which spawns a subprocess. After U5, `startServer` accepts these as direct params.
  - Remove the `env` object construction and env-related code paths
  - The existing PR selection logic (gh CLI checks, PR number parsing, fetch PR info, fetch branches) stays unchanged — only the server invocation changes
  - The `opencodeUrl` is still needed for the OpenCode launcher (separate subprocess), so it stays as a parameter to both `startServer` and the launcher
- **Patterns to follow:** Existing parameter-passing patterns in `index.ts`
- **Test scenarios:**
  - **Happy path:** CLI flow with valid PR argument passes correct params to `startServer()`
  - **Regression:** All existing CLI flows (no-arg interactive, arg-based, error cases) still work
- **Verification:** `bun run apps/cli/src/index.ts` (with valid PR) starts the server; server logs show correct PR info

---

### U7. Build chain: Update Turborepo and package.json scripts

- **Goal:** Wire the new build pipeline into Turborepo's task dependency graph so `pnpm build` produces the standalone binary.
- **Requirements:** R1, R3
- **Dependencies:** U4 (build script must exist)
- **Files:**
  - `turbo.json` — add CLI build task with dependsOn for client build
  - `apps/cli/package.json` — update build script to `bun run scripts/build.ts`
  - `package.json` (root) — verify `build` pipeline still works
- **Approach:**
  - In `turbo.json`, add dependency:
    ```json
    {
      "pipeline": {
        "build": {
          "dependsOn": ["^build"],
          "outputs": ["dist/**"]
        },
        "@clm/cli#build": {
          "dependsOn": ["@clm/client#build", "@clm/server#build"],
          "outputs": ["dist/**"]
        }
      }
    }
    ```
  - Update `apps/cli/package.json` scripts to align with the turbo task name
  - The `@clm/server#build` produces `packages/server/dist/index.js` — the CLI binary embeds the server source (not the built bundle), but the turbo dependency ensures the server build completes first to validate no type errors
  - The client build (`@clm/client#build`) must complete before the CLI build script runs (it produces the assets the script embeds)
- **Patterns to follow:** Existing turbo.json patterns from the repo
- **Test scenarios:**
  - **Happy path:** `pnpm build` (from root) builds client, then server, then CLI binary
  - **Edge case:** Client build fails — CLI build is skipped (turbo cascade)
- **Verification:** `pnpm build` exits 0; `apps/cli/dist/clm` exists

---

### U8. Dev mode: Update Turborepo dev scripts

- **Goal:** Ensure `pnpm dev` continues to work with Vite dev server + server hot reload + CLI in dev mode (proxy serving).
- **Requirements:** R7, R8
- **Dependencies:** U1, U2, U5
- **Files:**
  - `turbo.json` — add or verify dev task dependency chain
  - `package.json` — verify dev scripts
  - `apps/cli/package.json` — add dev-mode CLI script if needed
- **Approach:**
  - In dev mode (`pnpm dev`), Turborepo runs all three packages in parallel:
    - Client: `vite dev` (port 5173)
    - Server: `bun --hot run src/index.ts`
    - CLI: currently not run in dev mode (only client and server)
  - The server's `createApp()` detects no `clm-web-ui.gen.ts` → falls into proxy mode → proxies non-API GETs to `http://localhost:5173`
  - No changes needed to the existing dev workflow — the proxy fallback is the default behavior when the generated module doesn't exist
  - Verify that the dev server task (`packages/server`) runs independently and its `Bun.main === import.meta.path` guard auto-starts in proxy mode
- **Test scenarios:**
  - **Happy path:** `pnpm dev` starts both client (Vite) and server (Hono with proxy mode)
  - **Happy path:** Server proxy serves the Vite dev server frontend correctly (open `http://localhost:<server-port>` in browser)
  - **Regression:** API endpoints work in dev mode via the server, not proxied
- **Verification:** `pnpm dev` starts without errors; opening the server's URL shows the app UI (served through proxy)

---

## Dependencies / Prerequisites

- Bun >= 1.0 (unchanged from today)
- `Bun.build({ compile: true, files: { "clm-web-ui.gen.ts": ... } })` resolves bare-specifier imports of `"clm-web-ui.gen.ts"` from any depth in the dependency tree — verified during U4 implementation
- `import ... with { type: "file" }` works correctly in compiled binaries (embedded files accessible via `/$bunfs/root/...`)
- Vite dev server defaults to port 5173
- GitHub CLI (`gh`) required at runtime (unchanged)

---

## Sequencing

```
U1 (server factory) ──┬── U2 (two-mode serving) ──┬── U3 (standalone dev)
                       │                           │
                       │                           └── (no dependency on others)
                       │
U4 (build script) ─────┴──── requires U1, U2 for contract
                       │
U5 (CLI lifecycle) ────┴──── requires U1, U2
     │
     ├── U6 (CLI entry) ──── requires U5
     │
     └── U7 (turbo chain) ── requires U4
     
U8 (dev mode) ────────────── requires U1, U2, U5 (can run in parallel with U4/U7)
```

**Recommended execution order:** U1 → U2 → U3 → U4 → U5 → U6 → U7 → U8

---

## Verification Strategy

1. **Per-unit:** Each unit has specific test scenarios in its section above
2. **Integration:** After U4 + U5 are complete, run `pnpm build` then test the binary in a real git repo with a valid PR
3. **Dev mode:** After U8, run `pnpm dev` and verify the UI loads through proxy
4. **Regression:** The full test is: binary opens PR review UI in browser; `pnpm dev` produces hot-reloadable dev environment; `bun run packages/server/src/index.ts` starts standalone

---

## Deferred Implementation Notes

- **Bare specifier verification:** Whether `"clm-web-ui.gen.ts"` must be listed as an explicit entrypoint in `Bun.build()` in addition to the `files` option needs runtime verification during U4. The plan assumes both are needed; adjust if Bun resolves `files` entries without explicit entrypoint listing.
- **MIME types:** The exact MIME type mapping for embedded assets may need expansion as new asset types are added to the client build. Start with standard JS, CSS, HTML, SVG, PNG, WOFF2, JSON.
- **Asset path normalization:** The generated path-to-file map should strip the `packages/client/dist/` prefix from URL paths (served as `/` and `/assets/...`). Implementation may reveal edge cases with nested paths.
