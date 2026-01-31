# AGENTS.md - Agentic Coding Guide

This document provides guidance for AI coding agents working in the `codereview` monorepo.

## Project Overview

A local CLI tool that provides a web UI to review GitHub PRs with AI assistance. Built as a pnpm monorepo with Turborepo orchestration.

**Stack:**
- **Frontend:** React 19 + Vite (rolldown-vite) + Tailwind CSS v4
- **Backend:** Hono (Bun runtime)
- **CLI:** Commander.js (Bun runtime)
- **Package Manager:** pnpm v10.28.2

## Repository Structure

```
/
├── apps/cli/           # CLI wrapper (@codereview/cli)
├── packages/client/    # React frontend (@codereview/client)
├── packages/server/    # Hono API server (@codereview/server)
└── design-system/      # Design assets
```

## Build/Lint/Test Commands

### Root Commands (run from repository root)
```bash
pnpm install          # Install all dependencies
pnpm build            # Build all packages (via Turborepo)
pnpm dev              # Start all dev servers
pnpm lint             # Run linting (client only currently)
```

### Package-Specific Commands

**Client (@codereview/client):**
```bash
pnpm --filter @codereview/client dev          # Start Vite dev server
pnpm --filter @codereview/client build        # Build for production
pnpm --filter @codereview/client lint         # Run ESLint
pnpm --filter @codereview/client check-types  # TypeScript type checking
```

**Server (@codereview/server):**
```bash
pnpm --filter @codereview/server dev          # Start with hot reload
pnpm --filter @codereview/server build        # Build with Bun
pnpm --filter @codereview/server check-types  # TypeScript type checking
```

**CLI (@codereview/cli):**
```bash
pnpm cli:dev          # Run CLI in dev mode
pnpm cli:build        # Build CLI
pnpm cli:typecheck    # TypeScript type checking
```

### Running Tests
Tests are not yet configured in this project. When tests are added:
```bash
# Expected future commands:
pnpm test                              # Run all tests
pnpm --filter @codereview/client test  # Run client tests
```

## Code Style Guidelines

### TypeScript Configuration
- **Target:** ES2022
- **Strict mode:** Enabled (`strict: true`)
- **No unused locals/parameters:** Enforced
- **Module resolution:** Bundler mode
- **Path aliases:** Use `@/*` for client imports (maps to `./src/*`)

### Import Conventions

**Client (React):**
```typescript
// External dependencies first
import { useState, useCallback } from 'react';
import { Hono } from 'hono';

// Internal imports with @/ alias
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { PRInfo } from '@/types/pr';
```

**Server (Hono):**
```typescript
// Use .js extension for local imports (required for ESM)
import { getPRInfo } from '../services/gh.js';
import type { PRInfo } from '../types/index.js';
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files (components) | kebab-case | `top-bar.tsx`, `use-pr.ts` |
| Files (types) | kebab-case | `pr.ts`, `index.ts` |
| Components | PascalCase | `TopBar`, `PRInfo` |
| Hooks | camelCase with `use` prefix | `usePR`, `useDiff` |
| Functions | camelCase | `fetchPRInfo`, `transformPRInfo` |
| Types/Interfaces | PascalCase | `PRInfo`, `FileDiff` |
| Constants | UPPER_SNAKE_CASE | `API_BASE` |

### Component Patterns

**Compound Components:**
```typescript
// Export as object with sub-components
export const TopBar = { Root, PRInfo, Actions }
export type { TopBarRootProps } from "./root"

// Usage
<TopBar.Root>
  <TopBar.PRInfo pr={pr} />
  <TopBar.Actions />
</TopBar.Root>
```

**Function Components with Props:**
```typescript
function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}
```

### Styling (Tailwind + CVA)

Use `class-variance-authority` for component variants:
```typescript
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "base-classes-here",
  {
    variants: {
      variant: { default: "...", outline: "..." },
      size: { default: "h-8", sm: "h-7" },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)
```

Use the `cn()` utility for conditional class merging:
```typescript
className={cn(buttonVariants({ variant, size }), className)}
```

### React Hooks Pattern

```typescript
interface UsePROptions {
  prNumber?: number;
  repo?: string;
}

interface UsePRReturn {
  pr: PRInfo | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function usePR({ prNumber, repo }: UsePROptions = {}): UsePRReturn {
  const [pr, setPR] = useState<PRInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  // ...
}
```

### API Routes (Hono)

```typescript
import { Hono } from 'hono';

const app = new Hono();

// GET /api/pr-info?pr={number}&repo={owner/repo}
app.get('/', async (c) => {
  const prNumber = c.req.query('pr');
  
  if (!prNumber) {
    return c.json({ error: 'PR number is required' }, 400);
  }

  try {
    const data = await fetchData(prNumber);
    return c.json(data);
  } catch (error) {
    console.error('Failed:', error);
    return c.json({ error: 'Failed', details: (error as Error).message }, 500);
  }
});

export default app;
```

### Error Handling

**Client-side:**
```typescript
try {
  const data = await fetchApi('/endpoint');
} catch (err) {
  setError(err instanceof Error ? err : new Error('Default message'));
}
```

**Server-side:**
```typescript
try {
  const result = await operation();
  return c.json(result);
} catch (error) {
  console.error('Operation failed:', error);
  return c.json({ error: 'Operation failed', details: (error as Error).message }, 500);
}
```

### Type Definitions

Keep types in dedicated files:
- Client: `packages/client/src/types/*.ts`
- Server: `packages/server/src/types/index.ts`

Use explicit return types for exported functions:
```typescript
export async function getPRInfo(prNumber: number, repo?: string): Promise<PRInfo> {
  // ...
}
```

## UI Components

This project uses shadcn/ui with the "base-lyra" style and hugeicons icon library.

**Adding components:**
```bash
cd packages/client
npx shadcn@latest add button
```

## Key Dependencies

- **@base-ui/react:** Base UI primitives
- **class-variance-authority:** Variant styling
- **hono:** HTTP framework
- **commander:** CLI framework

## Environment

- Runtime: Bun (server/CLI), Browser (client)
- Node compatibility: Required for CLI
- GitHub CLI (`gh`): Required for PR operations
