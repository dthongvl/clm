# Implementation Plan - Local Code Review Tool

## Goal
Create a local CLI tool (`codereview`) that spins up a web UI to review GitHub PRs using `gh` CLI for data and a local AI binary for intelligent feedback.

## User Review Required
> [!IMPORTANT]
> **Component Source**: We assume `@pierre/diffs` is available via `bun i @pierre/diffs`. If not, we will need to adjust the plan to vendor the code.
> **AI Binary**: The tool relies on an external CLI command (e.g., `claude`) being available in the user's PATH.

## Proposed Changes

### Tech Stack
- **Runtime**: Bun
- **Package manager**: pnpm
- **Backend**: Hono (running on Bun)
- **Frontend**: React + Vite + Shadcn UI + Tailwind
- **Diff UI**: `@pierre/diffs`
- **External Dependencies**: `gh` CLI, Local AI CLI

### Project Structure
```
/
|
├── apps/
│   └── cli/         # CLI wrapper (bin/codereview)
├── packages/
│   ├── server/      # Hono API server + Static file serving
│   ├── client/      # React + Vite frontend
├── package.json     # Bun workspaces root
```

### [CLI]
- Create a bin script `codereview <PR_NUMBER>`
- Checks for `gh` CLI availability.
- Starts the Hono server on port 3000.
- Opens the system browser to `http://localhost:3000`.

### [Server] (Hono)
- **GET /api/diff**: Returns the content of changed files (fetched via `gh` or passed from CLI).
    - Get the file content of the base branch and the current branch of the PR
- **POST /api/comments**: Submits a review comment via `gh pr comment`.
- **POST /api/ai-review**: Executes the local AI binary.
    - Input: Diff chunk + Prompt.
    - Output: Parsed JSON suggestions (File, Line, Severity, Comment).
- **GET /api/pr-info**: Returns PR details (Title, Author, Description).
- **Static**: Serves the built React app.

### [Frontend] (React)
- **App Shell**: Layout with Top Bar (PR Info) and Two-Column View.
- **Left Panel (Diff View)**:
    - Renders diffs using `@pierre/diffs` MultiFileDiff.
    - Supports clicking line numbers to trigger comment form.
- **Right Panel (AI & Summary)**:
    - Lists AI findings (Critical, Warning, Info).
    - "Intelligent Grouping": Displays grouped changes (summary of related changes).
- **Chat**: Global chat popup for Q&A about the PR.

## Verification Plan

### Automated Tests
- **Unit Tests**: Test Hono endpoints (mocking `gh` execution).
- **Component Tests**: Render AI review cards and Diff viewer.

### Manual Verification
1.  Run `codereview 123` in a repo.
2.  Verify browser opens.
3.  Verify diff loads correctly.
4.  Trigger AI review and check if comments appear.
5.  Submit a comment and check GitHub (or dry-run output).
