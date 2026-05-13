---
date: 2026-05-13
topic: single-binary-cli
---

# Single-Binary CLI with Embedded Server and Frontend

## Summary

Refactor CLM so that `apps/cli` produces a standalone Bun-compiled binary that embeds both the server runtime (from `@clm/server`) and the pre-built frontend assets (from `@clm/client`), running as a single process. The binary directly starts a Hono HTTP server with the embedded web UI; dev mode proxies frontend requests to the Vite dev server.

---

## Problem Frame

CLM currently runs as a three-process architecture: the Commander.js CLI spawns a Hono server subprocess via `Bun.spawn`, which in turn serves a separately-built React SPA from a relative filesystem path. This has several drawbacks: the binary is not self-contained (requires the monorepo layout at runtime), the subprocess model adds IPC complexity (port discovery via stdout parsing, manual health checks), and deployment requires either `bun run` on source or a multi-file build output. Distributing to users means they need Bun installed, the repo cloned, and dependencies installed — none of which are reasonable for a CLI tool. A single self-contained binary solves all of these.

---

## Actors

- A1. **CLI user**: Runs `clm` to review a GitHub PR. Expects a single command, no setup.
- A2. **Developer**: Builds CLM from source. Needs dev mode for iteration.
- A3. **Release pipeline**: Produces the distributable binary.

---

## Key Flows

### F1. Build the binary

- **Trigger:** Developer runs the build script
- **Actors:** A2
- **Steps:**
  1. Build the React SPA via Vite (`packages/client/`)
  2. Scan the output `dist/` directory for all assets
  3. Generate `clm-web-ui.gen.ts` — one `import ... with { type: "file" }` per asset, exported as a path-to-file map
  4. Run `Bun.build({ compile: { target: "bun-linux-x64" }, files: { "clm-web-ui.gen.ts": generatedCode } })` with the CLI entry point
  5. Output a single standalone binary
- **Outcome:** A standalone executable at `apps/cli/dist/clm`
- **Covered by:** R1, R2, R3

### F2. Run the binary

- **Trigger:** User runs `./clm <pr>` in a git repo
- **Actors:** A1
- **Steps:**
  1. CLI inspects environment (gh CLI, git repo, PR info)
  2. CLI calls `createServer()` from `@clm/server`
  3. Server starts Hono HTTP server in-process on a random port
  4. Server serves API routes from the embedded server code
  5. Server serves frontend assets from the embedded `clm-web-ui.gen.ts` file map
  6. CLI opens browser to `http://localhost:<port>`
- **Outcome:** PR review UI loads in the browser
- **Covered by:** R4, R5, R6

### F3. Run in dev mode

- **Trigger:** Developer runs `bun run apps/cli/src/index.ts` (or through Turborepo)
- **Actors:** A2
- **Steps:**
  1. Developer also has the Vite dev server running (`pnpm --filter @clm/client dev`)
  2. CLI imports `@clm/server` and calls `createServer({ devUpstream: "http://localhost:5173" })`
  3. `import("clm-web-ui.gen.ts")` fails (no such file in dev) → catch → proxy mode
  4. All non-API GET requests are proxied to `http://localhost:5173`
- **Outcome:** Hot-reloaded frontend served through the local server
- **Covered by:** R7, R8

---

## Requirements

**Build process**
- R1. The build script must build the client SPA via Vite before generating the embedded file map
- R2. The generated `clm-web-ui.gen.ts` must use `import ... with { type: "file" }` for every asset (excluding `.map` files) and export a record mapping URL paths to file references
- R3. The final output must be a standalone binary via `Bun.build({ compile: true })` — no external file dependencies at runtime

**Server architecture**
- R4. `@clm/server` must export a `createServer(options)` function that starts an in-process Hono HTTP server and returns `{ port, url, stop }`
- R5. `@clm/server` must export a `createApp(options)` function that returns a configured Hono app without starting a server (for testing or custom wiring)
- R6. The static file serving must follow OpenCode's two-mode pattern: try embedded → catch → proxy. There must be no filesystem-serve fallback

**Dev mode**
- R7. In dev mode (no embedded UI available), non-API GET requests must proxy to a configurable upstream URL (default: `http://localhost:5173`)
- R8. The server must remain independently runnable in dev mode via `bun run src/index.ts` (auto-start only when `Bun.main === import.meta.path`)

**CLI changes**
- R9. The CLI must import `@clm/server` directly and call `createServer()` — no `Bun.spawn` subprocess
- R10. The CLI must pass `prNumber`, `repo`, `baseRef`, `headRef` as direct arguments (not env vars) to `createServer()`
- R11. The shutdown handler must call the server's `stop()` function instead of killing a subprocess

---

## Success Criteria

- `apps/cli/script/build.ts` produces a single standalone binary that runs without any monorepo files, `node_modules`, or Bun source present
- Running the binary in a git repo with a valid PR opens the PR review UI in a browser
- `pnpm dev` (Turborepo) continues to work with Vite dev server + server hot reload — the proxy fallback serves the frontend
- The server package's unit-testability is preserved or improved (exported `createApp`, no top-level side effects unless entry point)

---

## Scope Boundaries

- No multi-platform cross-compilation in v1 (only the current OS/arch via `--target`)
- No Electron desktop build
- No npm distribution packaging (shim scripts, platform-specific npm packages)
- No CI/CD pipeline for the build
- No changes to the client's Vite config or development tooling
- No Docker packaging
- No CSP headers or security hardening beyond what exists today
- No changes to the OpenCode launcher subprocess (it remains a `Bun.spawn` of the external `opencode` binary)

---

## Key Decisions

- **Two-mode serving (embedded/proxy) over filesystem fallback:** Matching OpenCode's pattern exactly. No `import.meta.resolve`-based dev dist path. The proxy is simpler and avoids fragile monorepo path assumptions in the compiled binary.
- **Server as library (exported functions) over standalone script:** The server package exports `createServer`/`createApp` that the CLI imports. This enables single-process operation and preserves testability.
- **`import("clm-web-ui.gen.ts")` as bare specifier:** Relies on Bun's `files` option in `Bun.build()` to make the virtual module resolvable. Same approach as OpenCode.

---

## Dependencies / Assumptions

- Bun >= 1.0 is required for both building and running (unchanged from today)
- `Bun.build({ compile: true, files: { "clm-web-ui.gen.ts": ... } })` resolves bare-specifier imports of `"clm-web-ui.gen.ts"` from any depth in the dependency tree
- `import ... with { type: "file" }` works correctly in compiled binaries (embedded files are accessible via `/$bunfs/root/...`)
- The Vite dev server defaults to port 5173 (Vite's default)
- The GitHub CLI (`gh`) is required at runtime (unchanged from today)

---

## Outstanding Questions

### Deferred to Planning

- [Technical] How should the server package declare its exports (`main`, `exports` in `package.json`) so both Bun and TypeScript resolve `@clm/server` correctly?
- [Technical] Does `import("clm-web-ui.gen.ts")` need to be listed as an entrypoint in `Bun.build()` in addition to the `files` option?
- [Technical] How does the existing standalone-server dev mode (`bun run packages/server/src/index.ts`) work with the refactored exports and the proxy-based UI serving? It needs env var → option mapping for `CLIENT_DIST` → `devUpstream`.
