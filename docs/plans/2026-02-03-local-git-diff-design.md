# Local Git Diff Performance Optimization

## Problem

Currently, PR diff fetching uses `gh` CLI which makes HTTP requests to GitHub API:
- `gh pr diff` - fetches unified diff
- `gh api repos/.../contents/...` - fetches file content (one request per file)

This is slow, especially for large PRs with many files.

## Solution

Use local git operations instead of GitHub API calls. Since users run the CLI locally with the repo already cloned, we can:
1. Fetch the base and head branches locally
2. Use `git diff` and `git show` for fast local operations

## Architecture

### Data Flow

```
CLI starts
    ↓
CLI calls `gh pr view` to get base/head branch names
    ↓
CLI runs `git fetch origin <base> <head>`
    ↓
CLI passes BASE_REF/HEAD_REF env vars to server
    ↓
Server uses local git for diff and file content
```

### Environment Variables

| Variable | Example | Description |
|----------|---------|-------------|
| `PR_NUMBER` | `123` | PR number (existing) |
| `REPO` | `owner/repo` | Repository (existing, optional) |
| `BASE_REF` | `origin/main` | Base branch ref (new) |
| `HEAD_REF` | `origin/feature-branch` | Head branch ref (new) |

## Implementation

### 1. New File: `packages/server/src/services/git.ts`

```typescript
// Get diff between refs
async function getDiff(baseRef: string, headRef: string): Promise<FileDiff[]> {
  const result = await Bun.spawn([
    'git', 'diff', '--no-color', `${baseRef}...${headRef}`
  ])

  const stdout = await new Response(result.stdout).text()
  return parseDiff(stdout)
}

// Get file content at a specific ref
async function getFileContent(ref: string, filepath: string): Promise<string | null> {
  const result = await Bun.spawn([
    'git', 'show', `${ref}:${filepath}`
  ])

  if (result.exitCode !== 0) {
    return null  // file doesn't exist at this ref
  }

  return await new Response(result.stdout).text()
}

// Get changed files with status
async function getChangedFiles(baseRef: string, headRef: string): Promise<FileStatus[]> {
  const result = await Bun.spawn([
    'git', 'diff', '--name-status', `${baseRef}...${headRef}`
  ])
  // Parses: A/M/D/R status lines
}
```

### 2. CLI Changes: `apps/cli/src/index.ts`

```typescript
// Get PR info for branch names
const prInfo = await getPRInfo(prNumber, repo)

// Fetch both branches
await fetchBranches(prInfo.baseBranch, prInfo.headBranch)

// Start server with refs
const server = spawn('bun', ['run', 'start'], {
  env: {
    ...process.env,
    PR_NUMBER: String(prNumber),
    REPO: repo,
    BASE_REF: `origin/${prInfo.baseBranch}`,
    HEAD_REF: `origin/${prInfo.headBranch}`,
  }
})

async function fetchBranches(base: string, head: string): Promise<void> {
  const result = await Bun.spawn(['git', 'fetch', 'origin', base, head])
  if (result.exitCode !== 0) {
    throw new Error(`Failed to fetch branches`)
  }
}
```

### 3. Route Changes: `packages/server/src/routes/diff.ts`

```typescript
import { getDiff, getFileContent } from '../services/git'

const baseRef = process.env.BASE_REF!
const headRef = process.env.HEAD_REF!

// Local git diff
const files = await getDiff(baseRef, headRef)

// Local git file content (parallel, no rate limit)
if (includeContent) {
  await Promise.all(files.map(async (file) => {
    const [baseContent, headContent] = await Promise.all([
      getFileContent(baseRef, file.filename),
      getFileContent(headRef, file.filename),
    ])
    file.baseContent = baseContent
    file.headContent = headContent
  }))
}
```

### 4. Cleanup: `packages/server/src/services/gh.ts`

Remove:
- `getPRDiff()` - replaced by `git.ts`
- `getFileContent()` - replaced by `git.ts`

Keep:
- `getPRInfo()` - still needed for PR metadata
- `runGh()` - used by `getPRInfo()`

## Edge Cases

| Case | Handling |
|------|----------|
| Binary files | Detect with `git diff --numstat` (shows `-`), skip content fetch |
| Renamed files | Use `-M` flag, fetch old path for base, new path for head |
| New files | `getFileContent(baseRef)` returns `null` |
| Deleted files | `getFileContent(headRef)` returns `null` |
| Large files | Check size with `git cat-file -s`, skip if >1MB |

## Error Handling

| Error | Handling |
|-------|----------|
| Ref doesn't exist | CLI fails with clear message |
| Git not installed | CLI checks on startup |
| Not a git repo | CLI fails with "must run from git repository" |

No fallback to `gh` approach - fail fast with clear errors.

## Constraints

- CLI can fetch branches and checkout (if needed)
- CLI should NOT create worktrees
- CLI does NOT need to restore original git state after operations
- Local development only (repo is already cloned)

## Expected Performance

| PR Size | Current (gh) | New (git) | Improvement |
|---------|--------------|-----------|-------------|
| Small (5 files) | ~3-5s | ~0.5-1s | 3-5x |
| Medium (20 files) | ~10-15s | ~1-2s | 5-10x |
| Large (100 files) | ~60-120s | ~2-5s | 20-50x |

## Files Changed

**New:**
- `packages/server/src/services/git.ts`

**Modified:**
- `apps/cli/src/index.ts`
- `packages/server/src/routes/diff.ts`
- `packages/server/src/services/gh.ts`

## Implementation Order

1. Create `git.ts` with core functions
2. Update CLI to fetch branches and set env vars
3. Update diff route to use git service
4. Clean up unused functions from `gh.ts`
5. Test with various PR types
