# Local Git Diff Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace slow GitHub API calls with local git operations for fetching PR diffs and file content.

**Architecture:** CLI fetches remote branches, passes refs to server via env vars. Server uses `git diff` and `git show` for all diff/content operations. Keep `gh pr view` for PR metadata only.

**Tech Stack:** Bun, TypeScript, Git CLI

---

## Task 1: Create Git Service

**Files:**
- Create: `packages/server/src/services/git.ts`

**Step 1: Create the git service file with runGit helper**

```typescript
// packages/server/src/services/git.ts
import type { FileDiff } from '../types/index.js';

/**
 * Run git command safely using Bun.spawn (no shell injection)
 */
async function runGit(args: string[], opts?: { timeoutMs?: number }): Promise<{ stdout: string; exitCode: number }> {
  const proc = Bun.spawn(['git', ...args], {
    cwd: process.cwd(),
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: opts?.timeoutMs ?? 30_000,
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (exitCode !== 0 && !args.includes('show')) {
    // show can fail for deleted files, that's expected
    throw new Error(stderr || stdout || `git exited with code ${exitCode}`);
  }

  return { stdout, exitCode };
}
```

**Step 2: Add parseDiff function**

Add after `runGit`:

```typescript
/**
 * Parse unified diff output into FileDiff array
 * Reuses logic from gh.ts but extracted for reuse
 */
function parseDiff(diffOutput: string): FileDiff[] {
  const files: FileDiff[] = [];
  const diffSections = diffOutput.split('diff --git');

  for (const section of diffSections.slice(1)) {
    const lines = section.trim().split('\n');
    const fileLine = lines[0];
    const match = fileLine.match(/a\/(.+) b\/(.+)/);

    if (match) {
      const oldFilename = match[1];
      const newFilename = match[2];
      let status: FileDiff['status'] = 'modified';

      if (section.includes('new file mode')) {
        status = 'added';
      } else if (section.includes('deleted file mode')) {
        status = 'removed';
      } else if (section.includes('rename from')) {
        status = 'renamed';
      }

      const patch = 'diff --git' + section;
      const additions = (section.match(/^\+[^+]/gm) || []).length;
      const deletions = (section.match(/^-[^-]/gm) || []).length;

      files.push({
        filename: newFilename,
        oldFilename: status === 'renamed' ? oldFilename : undefined,
        status,
        additions,
        deletions,
        patch,
      });
    }
  }

  return files;
}
```

**Step 3: Add getDiff function**

Add after `parseDiff`:

```typescript
/**
 * Get diff between two refs using local git
 */
export async function getDiff(baseRef: string, headRef: string): Promise<FileDiff[]> {
  const { stdout } = await runGit([
    'diff',
    '--no-color',
    '-M',  // Detect renames
    `${baseRef}...${headRef}`,
  ]);

  return parseDiff(stdout);
}
```

**Step 4: Add getFileContent function**

Add after `getDiff`:

```typescript
/**
 * Get file content at a specific ref using local git
 * Returns null if file doesn't exist at that ref (new/deleted files)
 */
export async function getFileContent(ref: string, filepath: string): Promise<string | null> {
  const { stdout, exitCode } = await runGit(['show', `${ref}:${filepath}`]);

  if (exitCode !== 0) {
    return null;  // File doesn't exist at this ref
  }

  return stdout;
}
```

**Step 5: Add checkGitRepo function**

Add after `getFileContent`:

```typescript
/**
 * Check if current directory is a git repository
 */
export async function checkGitRepo(): Promise<boolean> {
  try {
    const { exitCode } = await runGit(['rev-parse', '--git-dir']);
    return exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Verify a ref exists locally
 */
export async function verifyRef(ref: string): Promise<boolean> {
  try {
    const { exitCode } = await runGit(['rev-parse', '--verify', ref]);
    return exitCode === 0;
  } catch {
    return false;
  }
}
```

**Step 6: Verify the file compiles**

Run: `cd /home/dthongvl/workspace/code-review && bun build packages/server/src/services/git.ts --outdir /tmp`

Expected: Build succeeds with no errors

**Step 7: Commit**

```bash
git add packages/server/src/services/git.ts
git commit -m "feat: add local git service for diff and file content"
```

---

## Task 2: Update FileDiff Type for Renamed Files

**Files:**
- Modify: `packages/server/src/types/index.ts:11-19`

**Step 1: Add oldFilename field to FileDiff interface**

In `packages/server/src/types/index.ts`, update the `FileDiff` interface:

```typescript
export interface FileDiff {
  filename: string;
  oldFilename?: string;  // For renamed files, the original filename
  status: 'added' | 'removed' | 'modified' | 'renamed';
  additions: number;
  deletions: number;
  patch: string;
  baseContent?: string;
  headContent?: string;
}
```

**Step 2: Commit**

```bash
git add packages/server/src/types/index.ts
git commit -m "feat: add oldFilename field to FileDiff for renamed files"
```

---

## Task 3: Add fetchBranches to CLI

**Files:**
- Modify: `apps/cli/src/index.ts`

**Step 1: Add fetchBranches function**

Add after the `getCurrentRepo` function (around line 32):

```typescript
async function fetchBranches(base: string, head: string): Promise<void> {
  console.log(`Fetching branches: ${base}, ${head}...`);

  const result = await Bun.$`git fetch origin ${base} ${head}`.quiet();

  if (result.exitCode !== 0) {
    throw new Error(`Failed to fetch branches: ${result.stderr.toString()}`);
  }
}
```

**Step 2: Add getPRInfo function to CLI**

Add after `fetchBranches`:

```typescript
interface PRInfoResult {
  baseBranch: string;
  headBranch: string;
}

async function getPRInfo(prNumber: string, repo: string): Promise<PRInfoResult> {
  const result = await Bun.$`gh pr view ${prNumber} --repo ${repo} --json baseRefName,headRefName`.quiet();

  if (result.exitCode !== 0) {
    throw new Error(`Failed to get PR info: ${result.stderr.toString()}`);
  }

  const data = JSON.parse(result.text());
  return {
    baseBranch: data.baseRefName,
    headBranch: data.headRefName,
  };
}
```

**Step 3: Add checkGitRepo function**

Add after `getPRInfo`:

```typescript
async function checkGitRepo(): Promise<boolean> {
  try {
    const result = await Bun.$`git rev-parse --git-dir`.quiet();
    return result.exitCode === 0;
  } catch {
    return false;
  }
}
```

**Step 4: Commit**

```bash
git add apps/cli/src/index.ts
git commit -m "feat: add branch fetching functions to CLI"
```

---

## Task 4: Update CLI Action to Fetch Branches and Pass Refs

**Files:**
- Modify: `apps/cli/src/index.ts`

**Step 1: Add git repo check in action handler**

In the `.action()` callback, after the gh CLI check (after line 119), add:

```typescript
      // Check we're in a git repo
      const isGitRepo = await checkGitRepo();
      if (!isGitRepo) {
        console.error('Error: Not a git repository');
        console.error('Please run from within a git repository');
        process.exit(1);
      }

      console.log('✓ Git repository found');
```

**Step 2: Add PR info fetch and branch fetch**

After getting the repo (after line 129 `console.log(`✓ Repository: ${repo}`);`), add:

```typescript
      // Get PR branch info
      let prInfo: PRInfoResult;
      try {
        prInfo = await getPRInfo(prNumber, repo);
        console.log(`✓ PR branches: ${prInfo.baseBranch} <- ${prInfo.headBranch}`);
      } catch (error) {
        console.error('Error fetching PR info:', (error as Error).message);
        process.exit(1);
      }

      // Fetch branches locally
      try {
        await fetchBranches(prInfo.baseBranch, prInfo.headBranch);
        console.log('✓ Branches fetched');
      } catch (error) {
        console.error('Error fetching branches:', (error as Error).message);
        process.exit(1);
      }
```

**Step 3: Update startServer call to pass refs**

Modify the `startServer` function signature and call. First, update the function (around line 34):

```typescript
interface ServerEnv {
  prNumber: string;
  opencodeUrl: string;
  repo: string;
  baseRef: string;
  headRef: string;
}

async function startServer(env: ServerEnv): Promise<Subprocess> {
  const serverPath = resolve(import.meta.dir, '../../../packages/server/src/index.ts');

  const server = Bun.spawn(['bun', 'run', serverPath], {
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
    env: {
      ...process.env,
      PR_NUMBER: env.prNumber,
      OPENCODE_URL: env.opencodeUrl,
      REPO: env.repo,
      BASE_REF: `origin/${env.baseRef}`,
      HEAD_REF: `origin/${env.headRef}`,
    },
  });

  // Wait for server to be ready
  await waitForServerHealth();

  return server;
}
```

**Step 4: Update startServer invocation**

Replace the `startServer` call in the action (around line 143):

```typescript
      // Start the server
      try {
        serverProcess = await startServer({
          prNumber,
          opencodeUrl: opencodeLauncher.baseUrl,
          repo,
          baseRef: prInfo.baseBranch,
          headRef: prInfo.headBranch,
        });
        console.log('✓ Server started on http://localhost:3000');
      } catch (error) {
        console.error('Error starting server:', error);
        await shutdown();
        process.exit(1);
      }
```

**Step 5: Verify CLI compiles**

Run: `cd /home/dthongvl/workspace/code-review && bun build apps/cli/src/index.ts --outdir /tmp`

Expected: Build succeeds

**Step 6: Commit**

```bash
git add apps/cli/src/index.ts
git commit -m "feat: fetch branches and pass refs to server via env vars"
```

---

## Task 5: Update Diff Route to Use Git Service

**Files:**
- Modify: `packages/server/src/routes/diff.ts`

**Step 1: Update imports**

Replace the imports at the top of the file:

```typescript
import { Hono } from 'hono';
import { getDiff, getFileContent } from '../services/git.js';
import { getCurrentRepo, getPRInfo } from '../services/gh.js';
import { parsePositiveInt } from '../utils/request.js';
import type { FileDiff } from '../types/index.js';
```

**Step 2: Add helper to get refs from env**

Add after the imports:

```typescript
function getRefs(): { baseRef: string; headRef: string } | null {
  const baseRef = process.env.BASE_REF;
  const headRef = process.env.HEAD_REF;

  if (!baseRef || !headRef) {
    return null;
  }

  return { baseRef, headRef };
}
```

**Step 3: Update the main GET / handler**

Replace the handler (starting around line 51):

```typescript
// GET /api/diff?pr={number}&repo={owner/repo}&includeContent={true|false}
app.get('/', async (c) => {
  const prNumberStr = c.req.query('pr');
  const repo = c.req.query('repo') || process.env.REPO || await getCurrentRepo();
  const includeContent = c.req.query('includeContent') === 'true';

  const prNumber = parsePositiveInt(prNumberStr);
  if (!prNumber) {
    return c.json({ error: 'PR number must be a positive integer' }, 400);
  }

  if (!repo) {
    return c.json({ error: 'Repository not found. Please specify repo parameter or run from a git repository.' }, 400);
  }

  const refs = getRefs();
  if (!refs) {
    return c.json({ error: 'BASE_REF and HEAD_REF environment variables are required' }, 500);
  }

  try {
    // Use local git for diff
    const files = await getDiff(refs.baseRef, refs.headRef);

    // Fetch full file content using local git (no rate limits, fully parallel)
    if (includeContent) {
      console.log(`Fetching content for PR #${prNumber}, base: ${refs.baseRef}, head: ${refs.headRef}`);

      await Promise.all(files.map(async (file) => {
        // For renamed files, use oldFilename for base content
        const baseFilename = file.oldFilename || file.filename;

        const [baseContent, headContent] = await Promise.all([
          file.status !== 'added' ? getFileContent(refs.baseRef, baseFilename) : Promise.resolve(null),
          file.status !== 'removed' ? getFileContent(refs.headRef, file.filename) : Promise.resolve(null),
        ]);

        file.baseContent = baseContent ?? undefined;
        file.headContent = headContent ?? undefined;
      }));
    }

    return c.json({ files });
  } catch (error) {
    console.error('Failed to fetch diff:', error);
    return c.json({ error: 'Failed to fetch PR diff', details: (error as Error).message }, 500);
  }
});
```

**Step 4: Update the GET /file handler**

Replace the `/file` handler:

```typescript
// GET /api/diff/file?filename={path}
app.get('/file', async (c) => {
  const filename = c.req.query('filename');

  if (!filename) {
    return c.json({ error: 'filename is required' }, 400);
  }

  const refs = getRefs();
  if (!refs) {
    return c.json({ error: 'BASE_REF and HEAD_REF environment variables are required' }, 500);
  }

  try {
    const [baseContent, headContent] = await Promise.all([
      getFileContent(refs.baseRef, filename),
      getFileContent(refs.headRef, filename),
    ]);

    return c.json({
      filename,
      base: { ref: refs.baseRef, content: baseContent },
      head: { ref: refs.headRef, content: headContent },
    });
  } catch (error) {
    console.error('Failed to fetch file:', error);
    return c.json({ error: 'Failed to fetch file content', details: (error as Error).message }, 500);
  }
});
```

**Step 5: Remove processWithConcurrency function**

Delete the `processWithConcurrency` function and `MAX_CONCURRENT_FETCHES` constant (lines 8-48) as they're no longer needed.

**Step 6: Verify route compiles**

Run: `cd /home/dthongvl/workspace/code-review && bun build packages/server/src/routes/diff.ts --outdir /tmp`

Expected: Build succeeds

**Step 7: Commit**

```bash
git add packages/server/src/routes/diff.ts
git commit -m "feat: switch diff route from gh CLI to local git"
```

---

## Task 6: Clean Up gh.ts

**Files:**
- Modify: `packages/server/src/services/gh.ts`

**Step 1: Remove getPRDiff function**

Delete the entire `getPRDiff` function (lines 56-100).

**Step 2: Remove getFileContent function**

Delete the entire `getFileContent` function (lines 102-133).

**Step 3: Verify gh.ts still compiles**

Run: `cd /home/dthongvl/workspace/code-review && bun build packages/server/src/services/gh.ts --outdir /tmp`

Expected: Build succeeds

**Step 4: Commit**

```bash
git add packages/server/src/services/gh.ts
git commit -m "refactor: remove unused getPRDiff and getFileContent from gh service"
```

---

## Task 7: Integration Test

**Step 1: Build the entire project**

Run: `cd /home/dthongvl/workspace/code-review && bun run build`

Expected: Build succeeds with no errors

**Step 2: Manual test with a real PR**

Run: `cd /home/dthongvl/workspace/code-review && bun run apps/cli/src/index.ts <pr-number>`

Expected:
- CLI outputs "✓ Git repository found"
- CLI outputs "✓ PR branches: main <- feature-branch"
- CLI outputs "✓ Branches fetched"
- Server starts and opens browser
- Diff loads in the UI

**Step 3: Commit final changes if any fixes needed**

```bash
git add -A
git commit -m "fix: integration fixes for local git diff"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Create git service | `packages/server/src/services/git.ts` (new) |
| 2 | Update FileDiff type | `packages/server/src/types/index.ts` |
| 3 | Add fetchBranches to CLI | `apps/cli/src/index.ts` |
| 4 | Update CLI to pass refs | `apps/cli/src/index.ts` |
| 5 | Update diff route | `packages/server/src/routes/diff.ts` |
| 6 | Clean up gh.ts | `packages/server/src/services/gh.ts` |
| 7 | Integration test | - |
