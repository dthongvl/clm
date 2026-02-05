# Update AI Prompts to Use Local Git Diff

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Speed up AI services by updating prompts to use local `git diff` between base and head branches instead of `gh pr diff` (which fetches from GitHub API).

**Architecture:** Update the prompt templates in grouping.ts, ai-review.ts, and related-files.ts to instruct the AI to:
1. Use `gh pr view` to get PR info including base/head branch names
2. Use local `git fetch` + `git diff origin/base...origin/head` for faster diff retrieval

**Tech Stack:** gh CLI, git CLI

---

## Task 1: Update grouping.ts prompt

**Files:**
- Modify: `packages/server/src/services/grouping.ts`

**Step 1: Update buildGroupingPrompt**

Replace the current prompt with one that uses local git:

```typescript
function buildGroupingPrompt(prLink: string): string {
  const match = prLink.match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
  const repo = match ? match[1] : '';
  const prNumber = match ? match[2] : '';

  return `Analyze GitHub PR #${prNumber} in ${repo} and group files for code review.

Step 1: Get PR information and branch names:
gh pr view ${prNumber} --repo ${repo} --json title,body,baseRefName,headRefName,files

Step 2: Fetch the latest branches and get the diff locally (faster than gh pr diff):
git fetch origin <baseRefName> <headRefName>
git diff origin/<baseRefName>...origin/<headRefName>

Step 3: Read the PR description to understand the intent and context of the changes. Then analyze the diff and group logically connected changes. Order groups so reviewers can understand the PR from top to bottom.

Step 4: For each group, assess the risk level:
- HIGH: Core business logic, payment/billing, authentication, security, database migrations, data processing pipelines
- MEDIUM: API endpoints, shared utilities, configuration, non-critical features
- LOW: Tests, documentation, comments, formatting, dev tooling, experimental features

Step 5: Return ONLY a YAML code block in this exact format (no other text):

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

**Step 2: Verify types compile**

Run: `pnpm --filter @codereview/server check-types`
Expected: PASS

---

## Task 2: Update ai-review.ts prompt

**Files:**
- Modify: `packages/server/src/services/ai-review.ts`

**Step 1: Update buildReviewPrompt**

```typescript
function buildReviewPrompt(prLink: string): string {
  const match = prLink.match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
  const repo = match ? match[1] : '';
  const prNumber = match ? match[2] : '';

  return `You are a code reviewer. Analyze GitHub PR #${prNumber} in ${repo} and provide detailed code review feedback.

Step 1: Get PR information and branch names:
gh pr view ${prNumber} --repo ${repo} --json title,body,baseRefName,headRefName

Step 2: Fetch the latest branches and get the diff locally (faster than gh pr diff):
git fetch origin <baseRefName> <headRefName>
git diff origin/<baseRefName>...origin/<headRefName>

Step 3: Read and analyze the diff carefully. Look for:
- Critical issues: bugs, security vulnerabilities, performance problems, data loss risks
- Warnings: code smells, potential improvements, best practice violations, error handling issues
- Info: suggestions, style improvements, documentation needs, minor optimizations

Step 4: Return ONLY a YAML code block in this exact format (no other text):

\`\`\`yaml
summary: Brief overall summary of the PR and key findings
items:
  - severity: critical  # must be: critical, warning, or info
    file_path: path/to/file.ts
    line_number: 42
    message: Clear description of the issue or suggestion
    suggestion: Optional suggested code fix or improvement
\`\`\`

Rules:
- severity must be one of: critical, warning, info
- line_number must reference the actual line in the changed file (use the new line numbers from the diff)
- message should be actionable and explain why this is important
- suggestion is optional but helpful when applicable
- Focus on meaningful issues, not trivial style preferences
- Include context about why something is problematic
- Return ONLY the YAML code block, nothing else`;
}
```

**Step 2: Verify types compile**

Run: `pnpm --filter @codereview/server check-types`
Expected: PASS

---

## Task 3: Update related-files.ts prompt

**Files:**
- Modify: `packages/server/src/services/related-files.ts`

**Step 1: Update buildRelatedFilesPrompt**

```typescript
function buildRelatedFilesPrompt(prLink: string): string {
  const match = prLink.match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
  const repo = match ? match[1] : '';
  const prNumber = match ? match[2] : '';

  return `Analyze GitHub PR #${prNumber} in ${repo} and find related files that are NOT part of this PR but might be relevant for reviewers.

Step 1: Get PR information and branch names:
gh pr view ${prNumber} --repo ${repo} --json title,body,baseRefName,headRefName,files

Step 2: Fetch the latest branches and get the diff locally (faster than gh pr diff):
git fetch origin <baseRefName> <headRefName>
git diff origin/<baseRefName>...origin/<headRefName>

Step 3: Read the PR description and analyze the changed files to understand:
- What features or functionality is being modified
- What APIs, interfaces, or contracts are being changed
- What dependencies exist between the changed files and other parts of the codebase

Step 4: Search the codebase to find files that:
- Import from or are imported by the changed files
- Use the same APIs, functions, or components being modified
- Could be affected by the changes (downstream dependencies)
- Provide context about how the changed code is used
- Contain related tests or documentation
- Define types/interfaces used by the changed files

Step 5: For each related file found, explain the code flow and why it's relevant.

Step 6: Return ONLY a YAML code block in this exact format (no other text):

\`\`\`yaml
files:
  - filePath: path/to/related/file.ts
    explanation: |
      Brief explanation of why this file is related:
      - How it connects to the changed files
      - What code flow or dependency exists
      - What the reviewer should look for
\`\`\`

Rules:
- Only include files that are NOT in the PR's changed files list
- Prioritize files that are most likely to be affected by the changes
- Focus on files that help reviewers understand the impact and context
- Order files by relevance (most important first)
- Limit to 10 most relevant files
- Return ONLY the YAML code block, nothing else`;
}
```

**Step 2: Verify types compile**

Run: `pnpm --filter @codereview/server check-types`
Expected: PASS

---

## Task 4: Verify build and commit

**Step 1: Build**

Run: `pnpm --filter @codereview/server build`
Expected: PASS

**Step 2: Commit**

```bash
git add packages/server/src/services/grouping.ts packages/server/src/services/ai-review.ts packages/server/src/services/related-files.ts
git commit -m "perf: update AI prompts to use local git diff

Instruct AI to use local git fetch + git diff instead of gh pr diff.
Local git operations are faster than GitHub API calls when the
repo is already cloned."
```
