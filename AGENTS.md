# AGENTS.md - Agentic Coding Guide

Guide for AI agents working in the `codereview` monorepo - a CLI tool providing a web UI for GitHub PR review with AI assistance.

## Stack & Structure

- **Frontend:** React 19 + Vite (rolldown-vite) + Tailwind CSS v4 + shadcn/ui
- **Backend:** Hono (Bun runtime)
- **CLI:** Commander.js (Bun runtime)
- **Package Manager:** pnpm v10.28.2 with Turborepo

```
apps/cli/           # CLI wrapper (@codereview/cli)
packages/client/    # React frontend (@codereview/client)
packages/server/    # Hono API server (@codereview/server)
```

## Commands

### Root (from repository root)
```bash
pnpm install              # Install dependencies
pnpm build                # Build all packages
pnpm dev                  # Start all dev servers
pnpm lint                 # Lint all packages
```

### Package-Specific
```bash
# Client
pnpm --filter @codereview/client dev          # Vite dev server
pnpm --filter @codereview/client build        # Production build
pnpm --filter @codereview/client lint         # ESLint
pnpm --filter @codereview/client check-types  # TypeScript check

# Server
pnpm --filter @codereview/server dev          # Hot reload dev
pnpm --filter @codereview/server build        # Bun build
pnpm --filter @codereview/server check-types  # TypeScript check

# CLI
pnpm cli:dev              # Run CLI in dev mode
pnpm cli:build            # Build CLI
pnpm cli:typecheck        # TypeScript check
```

### Tests
Tests not yet configured. When added:
```bash
pnpm test                              # All tests
pnpm --filter @codereview/client test  # Single package
```

## TypeScript Configuration

- **Target:** ES2022, **Strict mode:** Enabled
- **No unused locals/parameters:** Enforced
- **Path aliases:** `@/*` maps to `./src/*` (client only)
- **Server imports:** Use `.js` extension for local imports (ESM requirement)

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

```typescript
// 1. External dependencies
import { useState } from 'react';
import { Hono } from 'hono';

// 2. Internal imports (use @/ alias in client)
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { PRInfo } from '@/types/pr';
```

**Server imports require .js extension:**
```typescript
import { getPRInfo } from '../services/gh.js';
```

## Component Patterns

### Compound Components
```typescript
// index.tsx - Export as object with sub-components
import { Root } from "./root"
import { PRInfo } from "./pr-info"
export const TopBar = { Root, PRInfo }
export type { TopBarRootProps } from "./root"

// Usage
<TopBar.Root>
  <TopBar.PRInfo pr={pr} />
</TopBar.Root>
```

### Styling with CVA
```typescript
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva("base-classes", {
  variants: {
    variant: { default: "...", outline: "..." },
    size: { default: "h-8", sm: "h-7" },
  },
  defaultVariants: { variant: "default", size: "default" },
})

function Button({ className, variant, size, ...props }: Props) {
  return <ButtonPrimitive className={cn(buttonVariants({ variant, size, className }))} {...props} />
}
```

## API Routes (Hono)

```typescript
import { Hono } from 'hono';

const app = new Hono();

app.get('/', async (c) => {
  const param = c.req.query('param');
  if (!param) {
    return c.json({ error: 'Param required' }, 400);
  }
  try {
    const data = await fetchData(param);
    return c.json(data);
  } catch (error) {
    console.error('Failed:', error);
    return c.json({ error: 'Failed', details: (error as Error).message }, 500);
  }
});

export default app;
```

## Error Handling

**Client:**
```typescript
try {
  const data = await fetchApi('/endpoint');
} catch (err) {
  setError(err instanceof Error ? err : new Error('Default message'));
}
```

**Server:**
```typescript
try {
  return c.json(await operation());
} catch (error) {
  console.error('Operation failed:', error);
  return c.json({ error: 'Failed', details: (error as Error).message }, 500);
}
```

## Type Definitions

- Client types: `packages/client/src/types/*.ts`
- Server types: `packages/server/src/types/index.ts`
- Use explicit return types for exported functions

## UI Components

Uses shadcn/ui with "base-lyra" style and hugeicons.

```bash
cd packages/client && npx shadcn@latest add button
```

## Key Dependencies

- `@base-ui/react` - Base UI primitives
- `class-variance-authority` - Variant styling
- `hono` - HTTP framework
- `commander` - CLI framework

## Environment

- Runtime: Bun (server/CLI), Browser (client)
- GitHub CLI (`gh`): Required for PR operations
