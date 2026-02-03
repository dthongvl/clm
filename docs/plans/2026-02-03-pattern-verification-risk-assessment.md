# Pattern Verification & Risk Assessment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add two new features to the code review app: (1) Pattern Verification to check if all related locations were updated, and (2) Risk Assessment to tag change groups by risk level.

**Architecture:** 
- Pattern Verification: New service that analyzes PR changes and verifies completeness (e.g., "renamed function X → all 8 call sites updated"). Results displayed alongside AI review items.
- Risk Assessment: Extend existing grouping service to add a `riskLevel` field (high/medium/low) based on the area of code being changed (core business logic = high, tests = low).

**Tech Stack:** TypeScript, Hono (server), React (client), OpenCode AI client

---

## Task 1: Add Risk Level to Grouping Types

**Files:**
- Modify: `packages/server/src/types/index.ts`
- Modify: `packages/client/src/types/grouping.ts`

**Step 1: Update server types**

Add `riskLevel` field to `ChangeGroup` interface in `packages/server/src/types/index.ts`:

```typescript
export type RiskLevel = 'high' | 'medium' | 'low';

export interface ChangeGroup {
  id: string;
  title: string;
  summary: string;
  files: string[];
  totalAdditions: number;
  totalDeletions: number;
  riskLevel: RiskLevel;
  riskReason?: string;
}
```

**Step 2: Update client types**

Update `packages/client/src/types/grouping.ts` to match:

```typescript
export type RiskLevel = 'high' | 'medium' | 'low';

export interface ChangeGroup {
  id: string;
  title: string;
  summary: string;
  files: string[];
  totalAdditions: number;
  totalDeletions: number;
  riskLevel: RiskLevel;
  riskReason?: string;
}
```

**Step 3: Verify types compile**

Run: `pnpm --filter @codereview/server check-types && pnpm --filter @codereview/client check-types`
Expected: Type errors in grouping service (we'll fix next)

**Step 4: Commit**

```bash
git add packages/server/src/types/index.ts packages/client/src/types/grouping.ts
git commit -m "feat: add riskLevel to ChangeGroup type"
```

---

## Task 2: Update Grouping Prompt for Risk Assessment

**Files:**
- Modify: `packages/server/src/services/grouping.ts`

**Step 1: Update the prompt to request risk assessment**

Modify `buildGroupingPrompt` function to include risk assessment instructions:

```typescript
function buildGroupingPrompt(prLink: string): string {
  const match = prLink.match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
  const repo = match ? match[1] : '';
  const prNumber = match ? match[2] : '';

  return `Analyze GitHub PR #${prNumber} in ${repo} and group files for code review.

Step 1: Use the \`gh\` CLI tool to fetch the PR information:
gh pr view ${prNumber} --repo ${repo} --json title,body,files

Step 2: Read the PR description to understand the intent and context of the changes. Then analyze the diff and group logically connected changes. Order groups so reviewers can understand the PR from top to bottom.

Step 3: For each group, assess the risk level:
- HIGH: Core business logic, payment/billing, authentication, security, database migrations, data processing pipelines
- MEDIUM: API endpoints, shared utilities, configuration, non-critical features
- LOW: Tests, documentation, comments, formatting, dev tooling, experimental features

Step 4: Return ONLY a YAML code block in this exact format (no other text):

\`\`\`yaml
groups:
  - id: group-1
    title: Short descriptive title
    riskLevel: high  # must be: high, medium, or low
    riskReason: Brief reason why this risk level was assigned
    explanation: |
      Quick explanation of this group:
      - Why these files are grouped together
      - What functionality or feature they implement/modify
      - Key changes in each file and how they relate
      - Any important context for reviewers (dependencies, side effects, etc.)
    files:
      - path: path/to/file.ts
        additions: 10
        deletions: 5
\`\`\`

Rules:
- Files can appear in multiple groups if they serve multiple purposes
- Order groups by risk level (high-risk first, then medium, then low)
- Provide detailed explanations that help reviewers understand the changes without reading all the code
- Use actual additions/deletions from the gh output for each file
- Return ONLY the YAML code block, nothing else`;
}
```

**Step 2: Update parsing to handle riskLevel**

Modify `YamlGroup` interface and `parseYamlGroups` function:

```typescript
interface YamlGroup {
  id?: string;
  title?: string;
  explanation?: string;
  riskLevel?: string;
  riskReason?: string;
  files?: (YamlFileEntry | string)[];
}

function parseYamlGroups(yamlGroups: YamlGroup[]): ChangeGroup[] {
  return yamlGroups.map((group, index) => {
    const files: string[] = [];
    let totalAdditions = 0;
    let totalDeletions = 0;
    
    if (Array.isArray(group.files)) {
      for (const file of group.files) {
        if (typeof file === 'string') {
          files.push(file);
        } else if (file && typeof file === 'object') {
          files.push(file.path);
          totalAdditions += file.additions || 0;
          totalDeletions += file.deletions || 0;
        }
      }
    }

    const riskLevelRaw = (group.riskLevel || 'medium').toLowerCase();
    const riskLevel = ['high', 'medium', 'low'].includes(riskLevelRaw)
      ? (riskLevelRaw as 'high' | 'medium' | 'low')
      : 'medium';
    
    return {
      id: group.id || `group-${index + 1}`,
      title: group.title || 'Unnamed Group',
      summary: group.explanation || '',
      files,
      totalAdditions,
      totalDeletions,
      riskLevel,
      riskReason: group.riskReason || undefined,
    };
  });
}
```

**Step 3: Verify types compile**

Run: `pnpm --filter @codereview/server check-types`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/server/src/services/grouping.ts
git commit -m "feat: add risk level assessment to grouping AI prompt"
```

---

## Task 3: Create Risk Badge UI Component

**Files:**
- Create: `packages/client/src/components/ui/risk-badge.tsx`

**Step 1: Create the risk badge component**

```typescript
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import type { RiskLevel } from "@/types/grouping"

const riskBadgeVariants = cva(
  "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-medium",
  {
    variants: {
      level: {
        high: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
        medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
        low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      },
    },
    defaultVariants: {
      level: "medium",
    },
  }
)

interface RiskBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof riskBadgeVariants> {
  level: RiskLevel
}

const RISK_LABELS: Record<RiskLevel, string> = {
  high: "High Risk",
  medium: "Medium Risk", 
  low: "Low Risk",
}

function RiskBadge({ className, level, ...props }: RiskBadgeProps) {
  return (
    <span
      className={cn(riskBadgeVariants({ level }), className)}
      {...props}
    >
      {RISK_LABELS[level]}
    </span>
  )
}

export { RiskBadge, riskBadgeVariants }
```

**Step 2: Verify component compiles**

Run: `pnpm --filter @codereview/client check-types`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/client/src/components/ui/risk-badge.tsx
git commit -m "feat: add RiskBadge component"
```

---

## Task 4: Update ChangeGroupCard to Display Risk Level

**Files:**
- Modify: `packages/client/src/components/side-panel/change-group-card.tsx`

**Step 1: Add RiskBadge to the card header**

```typescript
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Markdown } from "@/components/ui/markdown"
import { RiskBadge } from "@/components/ui/risk-badge"
import type { ChangeGroup } from "@/types/grouping"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface ChangeGroupCardProps extends React.ComponentProps<"div"> {
  group: ChangeGroup
  onFileClick?: (filePath: string) => void
}

function getFileName(filePath: string): string {
  return filePath.split('/').pop() || filePath
}

function ChangeGroupCard({ className, group, onFileClick, ...props }: ChangeGroupCardProps) {
  return (
    <div
      data-slot="change-group-card"
      className={cn("w-full text-left", className)}
      {...props}
    >
      <Card size="sm">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>{group.title}</CardTitle>
            {group.riskReason ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <RiskBadge level={group.riskLevel} />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-xs">
                  {group.riskReason}
                </TooltipContent>
              </Tooltip>
            ) : (
              <RiskBadge level={group.riskLevel} />
            )}
          </div>
          {group.summary && (
            <Markdown className="text-xs text-muted-foreground [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0">
              {group.summary}
            </Markdown>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          <ul className="space-y-1">
            {group.files.map((file) => (
              <li
                key={file}
                className="flex items-center gap-2 text-xs"
                title={file}
              >
                <span className="shrink-0 text-muted-foreground/60">•</span>
                <button
                  type="button"
                  onClick={() => onFileClick?.(file)}
                  className="truncate font-mono text-muted-foreground hover:text-foreground hover:underline transition-colors text-left"
                >
                  {getFileName(file)}
                </button>
              </li>
            ))}
          </ul>
          
          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/50">
            <span>{group.files.length} {group.files.length === 1 ? "file" : "files"}</span>
            <div className="flex gap-2">
              <span className="text-green-600 dark:text-green-500">+{group.totalAdditions}</span>
              <span className="text-red-600 dark:text-red-500">-{group.totalDeletions}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export { ChangeGroupCard }
```

**Step 2: Verify component compiles**

Run: `pnpm --filter @codereview/client check-types`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/client/src/components/side-panel/change-group-card.tsx
git commit -m "feat: display risk badge in ChangeGroupCard"
```

---

## Task 5: Add Pattern Verification Types

**Files:**
- Modify: `packages/server/src/types/index.ts`
- Create: `packages/client/src/types/verification.ts`

**Step 1: Add server types for pattern verification**

Add to `packages/server/src/types/index.ts`:

```typescript
export interface PatternVerification {
  id: string;
  pattern: string;
  description: string;
  status: 'verified' | 'incomplete' | 'warning';
  details: string;
  locations: PatternLocation[];
}

export interface PatternLocation {
  filePath: string;
  lineNumber: number;
  status: 'updated' | 'missing' | 'suspicious';
  snippet?: string;
}

export interface PatternVerificationResult {
  verifications: PatternVerification[];
  summary: string;
}
```

**Step 2: Create client types**

Create `packages/client/src/types/verification.ts`:

```typescript
export interface PatternLocation {
  filePath: string;
  lineNumber: number;
  status: 'updated' | 'missing' | 'suspicious';
  snippet?: string;
}

export interface PatternVerification {
  id: string;
  pattern: string;
  description: string;
  status: 'verified' | 'incomplete' | 'warning';
  details: string;
  locations: PatternLocation[];
}

export interface PatternVerificationResult {
  verifications: PatternVerification[];
  summary: string;
}
```

**Step 3: Verify types compile**

Run: `pnpm --filter @codereview/server check-types && pnpm --filter @codereview/client check-types`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/server/src/types/index.ts packages/client/src/types/verification.ts
git commit -m "feat: add PatternVerification types"
```

---

## Task 6: Create Pattern Verification Service

**Files:**
- Create: `packages/server/src/services/pattern-verification.ts`

**Step 1: Create the pattern verification service**

```typescript
import { parse as parseYaml } from 'yaml';
import type { PatternVerification, PatternVerificationResult, PatternLocation } from '../types/index.js';
import { opencodeClient } from './opencode-client.js';

const AI_MODEL = process.env.AI_MODEL || 'google/gemini-3-flash-preview';

export async function verifyPatterns(prLink: string): Promise<PatternVerificationResult> {
  const prompt = buildVerificationPrompt(prLink);
  
  try {
    const response = await opencodeClient.prompt(prompt, { model: AI_MODEL });
    return parseVerificationOutput(response);
  } catch (error) {
    console.error('Pattern verification failed:', error);
    throw new Error(`Failed to verify patterns: ${(error as Error).message}`);
  }
}

function buildVerificationPrompt(prLink: string): string {
  const match = prLink.match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
  const repo = match ? match[1] : '';
  const prNumber = match ? match[2] : '';

  return `Analyze GitHub PR #${prNumber} in ${repo} and verify that all related code locations were updated consistently.

Step 1: Use the \`gh\` CLI tool to fetch the PR diff:
gh pr diff ${prNumber} --repo ${repo}

Step 2: Identify patterns that require verification:
- Renamed functions/methods/classes: Were all call sites updated?
- Changed function signatures: Were all callers updated with new parameters?
- Modified API endpoints: Were all clients updated?
- Updated type/interface definitions: Were all usages updated?
- Changed constants/config values: Were all references updated?
- Renamed files: Were all imports updated?

Step 3: For each pattern found, search the codebase to verify completeness:
- Use grep or search to find all occurrences
- Check if each occurrence was properly updated in the PR
- Flag any locations that appear to be missed

Step 4: Return ONLY a YAML code block in this exact format (no other text):

\`\`\`yaml
summary: Brief summary of verification findings
verifications:
  - id: verify-1
    pattern: "functionName renamed to newFunctionName"
    description: What was changed and what needs to be verified
    status: verified  # must be: verified, incomplete, or warning
    details: "Found 8 call sites, all 8 were updated in this PR"
    locations:
      - filePath: path/to/file.ts
        lineNumber: 42
        status: updated  # must be: updated, missing, or suspicious
        snippet: "newFunctionName(args)"
\`\`\`

Rules:
- status "verified": All locations were properly updated
- status "incomplete": Some locations appear to be missed
- status "warning": Potential issues that need human review
- Only include verifications for patterns that actually need checking
- If no patterns need verification, return empty verifications array
- Focus on high-value verifications (renames, signature changes, API changes)
- Return ONLY the YAML code block, nothing else`;
}

interface YamlPatternLocation {
  filePath?: string;
  lineNumber?: number;
  status?: string;
  snippet?: string;
}

interface YamlPatternVerification {
  id?: string;
  pattern?: string;
  description?: string;
  status?: string;
  details?: string;
  locations?: YamlPatternLocation[];
}

interface YamlVerificationResult {
  summary?: string;
  verifications?: YamlPatternVerification[];
}

function parseVerificationOutput(output: string): PatternVerificationResult {
  try {
    const yamlMatch = output.match(/```ya?ml\n([\s\S]*?)```/)
      || output.match(/^(summary:\n[\s\S]*)/m)
      || output.match(/^(verifications:\n[\s\S]*)/m);
    
    if (!yamlMatch) {
      console.error('No YAML found in verification output:', output.slice(0, 500));
      return { verifications: [], summary: '' };
    }
    
    const yamlContent = yamlMatch[1];
    const parsed = parseYaml(yamlContent) as YamlVerificationResult;
    
    const summary = parsed?.summary || '';
    const verifications = parseYamlVerifications(parsed?.verifications || []);
    
    return { verifications, summary };
  } catch (error) {
    console.error('Failed to parse verification output:', error);
    console.error('Raw output:', output.slice(0, 1000));
    return { verifications: [], summary: '' };
  }
}

function parseYamlVerifications(yamlVerifications: YamlPatternVerification[]): PatternVerification[] {
  if (!Array.isArray(yamlVerifications)) {
    return [];
  }
  
  return yamlVerifications
    .filter((v): v is YamlPatternVerification => !!v && typeof v.pattern === 'string')
    .map((v, index) => {
      const statusRaw = (v.status || 'warning').toLowerCase();
      const status = ['verified', 'incomplete', 'warning'].includes(statusRaw)
        ? (statusRaw as PatternVerification['status'])
        : 'warning';

      const locations: PatternLocation[] = (v.locations || [])
        .filter((loc): loc is YamlPatternLocation => !!loc && typeof loc.filePath === 'string')
        .map(loc => {
          const locStatusRaw = (loc.status || 'suspicious').toLowerCase();
          const locStatus = ['updated', 'missing', 'suspicious'].includes(locStatusRaw)
            ? (locStatusRaw as PatternLocation['status'])
            : 'suspicious';

          return {
            filePath: loc.filePath!,
            lineNumber: loc.lineNumber || 1,
            status: locStatus,
            snippet: loc.snippet,
          };
        });

      return {
        id: v.id || `verify-${index + 1}`,
        pattern: v.pattern!,
        description: v.description || '',
        status,
        details: v.details || '',
        locations,
      };
    });
}
```

**Step 2: Verify service compiles**

Run: `pnpm --filter @codereview/server check-types`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/server/src/services/pattern-verification.ts
git commit -m "feat: add pattern verification service"
```

---

## Task 7: Create Pattern Verification API Route

**Files:**
- Create: `packages/server/src/routes/pattern-verification.ts`
- Modify: `packages/server/src/index.ts`

**Step 1: Create the route**

Create `packages/server/src/routes/pattern-verification.ts`:

```typescript
import { Hono } from 'hono';
import { verifyPatterns } from '../services/pattern-verification.js';

const app = new Hono();

app.get('/', async (c) => {
  const repo = c.req.query('repo');
  const prNumber = c.req.query('prNumber');

  if (!repo || !prNumber) {
    return c.json({ error: 'repo and prNumber are required' }, 400);
  }

  const prLink = `https://github.com/${repo}/pull/${prNumber}`;

  try {
    const result = await verifyPatterns(prLink);
    return c.json(result);
  } catch (error) {
    console.error('Pattern verification failed:', error);
    return c.json(
      { error: 'Failed to verify patterns', details: (error as Error).message },
      500
    );
  }
});

export default app;
```

**Step 2: Register route in main server**

Add to `packages/server/src/index.ts`:

```typescript
import patternVerification from './routes/pattern-verification.js';

// Add with other routes
app.route('/api/pattern-verification', patternVerification);
```

**Step 3: Verify server compiles**

Run: `pnpm --filter @codereview/server check-types`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/server/src/routes/pattern-verification.ts packages/server/src/index.ts
git commit -m "feat: add pattern verification API route"
```

---

## Task 8: Create Pattern Verification Hook

**Files:**
- Create: `packages/client/src/hooks/use-pattern-verification.ts`

**Step 1: Create the hook**

```typescript
import { useState, useCallback } from 'react';
import type { PatternVerificationResult } from '@/types/verification';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface UsePatternVerificationOptions {
  repo: string;
  prNumber: number;
}

interface UsePatternVerificationReturn {
  result: PatternVerificationResult | null;
  isLoading: boolean;
  error: Error | null;
  verify: () => Promise<void>;
}

export function usePatternVerification({
  repo,
  prNumber,
}: UsePatternVerificationOptions): UsePatternVerificationReturn {
  const [result, setResult] = useState<PatternVerificationResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const verify = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE}/api/pattern-verification?repo=${encodeURIComponent(repo)}&prNumber=${prNumber}`
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to verify patterns');
      }

      const data: PatternVerificationResult = await response.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Unknown error'));
    } finally {
      setIsLoading(false);
    }
  }, [repo, prNumber]);

  return { result, isLoading, error, verify };
}
```

**Step 2: Verify hook compiles**

Run: `pnpm --filter @codereview/client check-types`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/client/src/hooks/use-pattern-verification.ts
git commit -m "feat: add usePatternVerification hook"
```

---

## Task 9: Create Pattern Verification UI Components

**Files:**
- Create: `packages/client/src/components/side-panel/pattern-verification.tsx`
- Create: `packages/client/src/components/ui/verification-badge.tsx`

**Step 1: Create verification badge component**

Create `packages/client/src/components/ui/verification-badge.tsx`:

```typescript
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import { CheckmarkCircle01Icon, AlertCircleIcon, Cancel01Icon } from "@hugeicons/core-free-icons"

const verificationBadgeVariants = cva(
  "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-medium",
  {
    variants: {
      status: {
        verified: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
        incomplete: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
        warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
      },
    },
    defaultVariants: {
      status: "warning",
    },
  }
)

type VerificationStatus = 'verified' | 'incomplete' | 'warning';

interface VerificationBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof verificationBadgeVariants> {
  status: VerificationStatus;
}

const STATUS_CONFIG: Record<VerificationStatus, { label: string; icon: typeof CheckmarkCircle01Icon }> = {
  verified: { label: "Verified", icon: CheckmarkCircle01Icon },
  incomplete: { label: "Incomplete", icon: Cancel01Icon },
  warning: { label: "Needs Review", icon: AlertCircleIcon },
}

function VerificationBadge({ className, status, ...props }: VerificationBadgeProps) {
  const config = STATUS_CONFIG[status];
  
  return (
    <span
      className={cn(verificationBadgeVariants({ status }), className)}
      {...props}
    >
      <HugeiconsIcon icon={config.icon} className="h-3 w-3" />
      {config.label}
    </span>
  )
}

export { VerificationBadge, verificationBadgeVariants }
```

**Step 2: Create pattern verification panel component**

Create `packages/client/src/components/side-panel/pattern-verification.tsx`:

```typescript
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { VerificationBadge } from "@/components/ui/verification-badge"
import { HugeiconsIcon } from "@hugeicons/react"
import { 
  CheckmarkSquare01Icon, 
  Loading03Icon, 
  AlertCircleIcon,
  ArrowRight01Icon
} from "@hugeicons/core-free-icons"
import type { PatternVerification, PatternVerificationResult } from "@/types/verification"

interface PatternVerificationPanelProps extends React.ComponentProps<"div"> {
  result: PatternVerificationResult | null;
  isLoading: boolean;
  error: Error | null;
  onVerify: () => void;
  onLocationClick?: (filePath: string, lineNumber: number) => void;
}

function PatternVerificationPanel({
  className,
  result,
  isLoading,
  error,
  onVerify,
  onLocationClick,
  ...props
}: PatternVerificationPanelProps) {
  const incompleteCount = result?.verifications.filter(v => v.status === 'incomplete').length || 0;
  const warningCount = result?.verifications.filter(v => v.status === 'warning').length || 0;

  return (
    <div
      data-slot="pattern-verification"
      className={cn("flex flex-col gap-3", className)}
      {...props}
    >
      <Button
        variant="outline"
        size="sm"
        onClick={onVerify}
        disabled={isLoading}
        className="w-full"
      >
        <HugeiconsIcon
          icon={isLoading ? Loading03Icon : CheckmarkSquare01Icon}
          className={cn(isLoading && "animate-spin")}
          data-icon="inline-start"
        />
        {isLoading ? "Verifying..." : result ? "Re-verify Patterns" : "Verify Patterns"}
      </Button>

      {error && (
        <div className="flex flex-col gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3">
          <div className="flex items-center gap-2 text-destructive">
            <HugeiconsIcon icon={AlertCircleIcon} className="h-4 w-4" />
            <span className="text-sm font-medium">Verification failed</span>
          </div>
          <p className="text-xs text-muted-foreground">{error.message}</p>
        </div>
      )}

      {isLoading && (
        <div className="flex flex-col gap-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-md border border-border bg-muted/50"
            />
          ))}
          <p className="text-center text-xs text-muted-foreground">
            AI is verifying pattern completeness...
          </p>
        </div>
      )}

      {!isLoading && result && (
        <>
          {result.summary && (
            <p className="text-xs text-muted-foreground">{result.summary}</p>
          )}

          {incompleteCount > 0 && (
            <div className="rounded-md border border-red-500/50 bg-red-500/10 p-2 text-xs text-red-600 dark:text-red-400">
              ⚠️ {incompleteCount} pattern{incompleteCount > 1 ? 's' : ''} may have missed updates
            </div>
          )}

          {result.verifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No patterns requiring verification were found.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {result.verifications.map((verification) => (
                <VerificationCard
                  key={verification.id}
                  verification={verification}
                  onLocationClick={onLocationClick}
                />
              ))}
            </div>
          )}
        </>
      )}

      {!isLoading && !result && !error && (
        <p className="text-sm text-muted-foreground">
          Click "Verify Patterns" to check if all related code locations were updated.
        </p>
      )}
    </div>
  )
}

interface VerificationCardProps {
  verification: PatternVerification;
  onLocationClick?: (filePath: string, lineNumber: number) => void;
}

function VerificationCard({ verification, onLocationClick }: VerificationCardProps) {
  const missingLocations = verification.locations.filter(l => l.status === 'missing');
  
  return (
    <Card size="sm">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm">{verification.pattern}</CardTitle>
          <VerificationBadge status={verification.status} />
        </div>
        {verification.description && (
          <p className="text-xs text-muted-foreground">{verification.description}</p>
        )}
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-2">{verification.details}</p>
        
        {missingLocations.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-red-600 dark:text-red-400">
              Missing updates:
            </p>
            <ul className="space-y-1">
              {missingLocations.map((loc, idx) => (
                <li key={idx} className="flex items-center gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => onLocationClick?.(loc.filePath, loc.lineNumber)}
                    className="flex items-center gap-1 font-mono text-muted-foreground hover:text-foreground hover:underline"
                  >
                    {loc.filePath}:{loc.lineNumber}
                    <HugeiconsIcon icon={ArrowRight01Icon} className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export { PatternVerificationPanel }
```

**Step 3: Verify components compile**

Run: `pnpm --filter @codereview/client check-types`
Expected: PASS

**Step 4: Commit**

```bash
git add packages/client/src/components/ui/verification-badge.tsx packages/client/src/components/side-panel/pattern-verification.tsx
git commit -m "feat: add PatternVerificationPanel component"
```

---

## Task 10: Integrate Pattern Verification into Side Panel

**Files:**
- Modify: `packages/client/src/components/side-panel/index.tsx`

**Step 1: Read current side panel structure**

First, examine the current side panel index to understand how to add the new tab/section.

**Step 2: Add Pattern Verification as a new section or tab**

Add the PatternVerificationPanel alongside the AI Review Summary. The exact integration depends on the current structure, but typically:

```typescript
import { PatternVerificationPanel } from "./pattern-verification"
import { usePatternVerification } from "@/hooks/use-pattern-verification"

// Inside the component, add:
const { result: verificationResult, isLoading: isVerifying, error: verificationError, verify } = 
  usePatternVerification({ repo, prNumber });

// In the render, add a new section:
<PatternVerificationPanel
  result={verificationResult}
  isLoading={isVerifying}
  error={verificationError}
  onVerify={verify}
  onLocationClick={handleLocationClick}
/>
```

**Step 3: Verify integration compiles**

Run: `pnpm --filter @codereview/client check-types`
Expected: PASS

**Step 4: Manual test**

Run: `pnpm dev`
Test: Open a PR, click "Verify Patterns" button, verify results display correctly

**Step 5: Commit**

```bash
git add packages/client/src/components/side-panel/index.tsx
git commit -m "feat: integrate pattern verification into side panel"
```

---

## Task 11: End-to-End Testing

**Step 1: Start development servers**

Run: `pnpm dev`

**Step 2: Test Risk Assessment**

1. Open the app with a PR (e.g., `http://localhost:3000?repo=owner/repo&pr=123`)
2. Click "Generate AI Groupings"
3. Verify each group shows a risk badge (High/Medium/Low)
4. Hover over the badge to see the risk reason tooltip

**Step 3: Test Pattern Verification**

1. Click "Verify Patterns" in the side panel
2. Verify loading state shows
3. Verify results display with verification badges
4. Click on a missing location to navigate to the file

**Step 4: Commit final changes**

```bash
git add -A
git commit -m "feat: complete pattern verification and risk assessment features"
```

---

## Summary

| Task | Component | Effort |
|------|-----------|--------|
| 1 | Add RiskLevel types | 5 min |
| 2 | Update grouping prompt | 15 min |
| 3 | RiskBadge component | 10 min |
| 4 | Update ChangeGroupCard | 10 min |
| 5 | Pattern verification types | 5 min |
| 6 | Pattern verification service | 20 min |
| 7 | Pattern verification route | 10 min |
| 8 | usePatternVerification hook | 10 min |
| 9 | Verification UI components | 20 min |
| 10 | Side panel integration | 15 min |
| 11 | E2E testing | 15 min |

**Total estimated time: ~2.5 hours**
