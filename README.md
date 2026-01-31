# Code Review Tool

A local CLI tool that provides a web UI to review GitHub PRs with AI assistance.

## Prerequisites

- [Bun](https://bun.sh/) runtime
- [GitHub CLI (`gh`)](https://cli.github.com/) - authenticated with your GitHub account
- An AI CLI tool (`amp` or `claude`) available in your PATH

## Installation

```bash
pnpm install
pnpm build
```

## Usage

Navigate to a Git repository with a GitHub remote and run:

```bash
bunx codereview <PR_NUMBER>
```

This will:
1. Fetch the PR diff and metadata using `gh` CLI
2. Start a local web server on port 3000
3. Open your browser to the review UI

## Features

### Diff Viewer
- GitHub-style diff visualization using `@pierre/diffs`
- Syntax highlighting for all major languages

### AI Review
- Click "Run Review" to get AI-powered code review suggestions
- Suggestions are grouped by severity: Critical, Warning, Info
- Click on a suggestion to navigate to the relevant code

### AI Chat
- Global chat popup for asking questions about the PR
- Context-aware responses based on the diff content

### Comment Submission
- Submit comments directly to GitHub via the `gh` CLI

## Development

```bash
# Start development server
pnpm dev

# Typecheck
pnpm typecheck

# Build
pnpm build
```

## Project Structure

```
packages/
├── cli/        # CLI wrapper (codereview command)
├── server/     # Hono API server
└── client/     # React + Vite frontend
```

## Tech Stack

- **Runtime**: Bun
- **Backend**: Hono
- **Frontend**: React + Vite + Tailwind CSS
- **Diff UI**: @pierre/diffs
