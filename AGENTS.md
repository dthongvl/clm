# AGENTS.md — Agentic Coding Guide

Guide for AI agents working in the `clm` monorepo — a CLI tool providing a web UI for GitHub PR review with AI assistance.

## Stack & Structure

- **Frontend:** React 19 + Vite (rolldown-vite) + Tailwind CSS v4 + shadcn/ui
- **Backend:** Hono (Bun runtime)
- **CLI:** Commander.js (Bun runtime)
- **Package Manager:** pnpm workspaces + Turborepo

```
apps/cli/           # CLI entrypoint (@clm/cli)
packages/client/    # React SPA (@clm/client)
packages/server/    # Hono API server (@clm/server)
```

## Commands

### Root (from repository root)
```bash
pnpm install              # Install dependencies
pnpm build                # Build all packages in dependency order
pnpm dev                  # Start all dev servers (client + server hot reload)
pnpm lint                 # Lint all packages (client only has ESLint currently)
```

### Package-Specific
```bash
# Client
pnpm --filter @clm/client dev          # Vite dev server
pnpm --filter @clm/client build        # tsc -b && vite build
pnpm --filter @clm/client lint         # ESLint
pnpm --filter @clm/client check-types  # TypeScript (noEmit)

# Server
pnpm --filter @clm/server dev          # bun run --hot
pnpm --filter @clm/server build        # Bun single-file build → dist/
pnpm --filter @clm/server check-types  # TypeScript (noEmit)

# CLI
pnpm cli:dev              # bun run src/index.ts (from apps/cli/)
pnpm cli:build            # Bun single-file build → dist/
pnpm cli:typecheck        # tsc --noEmit (from apps/cli/)
```

### Tests
Tests are not yet configured. The root `test` script exits with an error.

## TypeScript & Build Quirks

- **Client path alias:** `@/*` maps to `./src/*`. Also configured in `vite.config.ts`.
- **Server imports:** Local imports MUST use `.js` extension (ESM requirement). Example: `import { x } from '../lib/utils.js'`.
- **No unused locals/parameters:** Enforced in client (`tsconfig.app.json`), but NOT in CLI (`noUnusedLocals: false`).
- **Turbo dependency chain:** `check-types` depends on `^check-types`, so type-checking respects package dependency order.
- **Catalog dependencies:** `pnpm-workspace.yaml` pins shared versions (e.g., `typescript: ~5.9.3`). Packages reference these with `"catalog:"` in `package.json`.

## Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | kebab-case | `top-bar.tsx`, `use-pr.ts` |
| Components | PascalCase | `TopBar`, `PRInfo` |
| Hooks | camelCase with `use` | `usePR`, `useDiff` |
| Functions | camelCase | `fetchPRInfo` |
| Types/Interfaces | PascalCase | `PRInfo`, `FileDiff` |
| Constants | UPPER_SNAKE_CASE | `API_BASE` |

## Import Order

1. External dependencies
2. Internal imports (use `@/` alias in client; use relative paths with `.js` in server)

## Component Patterns

### Compound Components
Export as an object with sub-components from `index.tsx`:
```typescript
import { Root } from "./root"
import { PRInfo } from "./pr-info"
export const TopBar = { Root, PRInfo }
```

### Styling
Uses `class-variance-authority` + `cn()` from `@/lib/utils` for variant styling. shadcn/ui uses the `base-lyra` style.

Add a new shadcn component:
```bash
cd packages/client && npx shadcn@latest add button
```

## Key Dependencies

- `@base-ui/react` — Base UI primitives
- `@pierre/diffs` — Diff viewer
- `@tanstack/react-query` — Data fetching
- `babel-plugin-react-compiler` — React Compiler is enabled in Vite build
- `hono` — HTTP framework
- `commander` — CLI framework
- `@opencode-ai/sdk` — AI backend SDK (server)

## Environment

- **Runtime:** Bun (server/CLI), Browser (client)
- **GitHub CLI (`gh`):** Required for PR operations; must be authenticated
- **OpenCode:** AI backend used for review features

## Settings & Config

- User settings persisted to `~/.config/clm/settings.toml`
- Default AI model: `google/gemini-3-flash-preview`
