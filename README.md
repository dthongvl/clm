# Code Review Tool

A local CLI tool that provides a web UI to review GitHub PRs with AI assistance. It runs entirely on your machine — your code and diffs never leave your local environment.

## Prerequisites

- [Bun](https://bun.sh/) runtime
- [pnpm](https://pnpm.io/) v10.28.2+
- [GitHub CLI (`gh`)](https://cli.github.com/) — authenticated with your GitHub account
- [OpenCode](https://opencode.ai/) — AI backend used for review, grouping, and chat features

## Installation

```bash
# Clone the repository
git clone https://github.com/dthongvl/code-review.git
cd code-review

# Install dependencies
pnpm install
```

## Production Build

```bash
# Build all packages (client, server, CLI)
pnpm build
```

This runs Turborepo to build everything in the correct order:

- **Client** — `tsc` type-check + Vite production bundle → `packages/client/dist/`
- **Server** — Bun single-file build → `packages/server/dist/`
- **CLI** — Bun single-file build → `apps/cli/dist/`

### Global Installation (recommended)

After building, link the CLI globally so you can run `codereview` from any repository:

```bash
cd apps/cli
bun link
```

Then from any Git repository with a GitHub remote:

```bash
codereview [PR_NUMBER_OR_URL]
```

### Without Global Install

You can also run it directly without linking:

```bash
bun <path-to-repo>/apps/cli/bin/codereview [PR_NUMBER_OR_URL]
```

## Usage

Navigate to a Git repository with a GitHub remote and run:

```bash
# Interactive PR selection (shows PRs requesting your review)
codereview

# Review a specific PR by number
codereview 123

# Review a specific PR by URL
codereview https://github.com/owner/repo/pull/123
```

This will:

1. Detect the current GitHub repository
2. Fetch the PR diff and metadata using `gh` CLI
3. Start the OpenCode AI backend
4. Start a local web server on port 3000
5. Open your browser to the review UI

Press `Ctrl+C` to stop all processes.

## Features

### Diff Viewer

- GitHub-style split/unified diff visualization powered by `@pierre/diffs`
- Syntax highlighting for all major languages
- Collapsible file sections with a navigable file tree
- View full file source for any changed file
- Track viewed files across your review session

### AI Code Review

- AI-powered code review that analyzes the entire PR diff
- Configurable review categories (e.g., bugs, security, performance)
- Two run modes: **combined** (single pass) or **separate** (per-category) analysis
- Results grouped by severity with inline annotations on the diff
- Additional context prompt to guide the AI focus

### Intelligent Grouping

- AI groups related file changes into logical change sets
- Helps understand large PRs by breaking them into reviewable chunks
- Each group includes a summary describing the purpose of the changes

### Pattern Verification

- Detects cross-file patterns (e.g., added an API route but missing tests)
- Verifies consistency of changes across the codebase
- Surfaces locations where updates may be incomplete

### Related Files Discovery

- AI identifies files not in the diff that may be affected by the changes
- Helps catch missing updates in related code

### Comments & Reviews

- Post inline comments on specific lines directly to GitHub
- Reply to, edit, and delete existing comments
- Draft review workflow: accumulate comments, then submit as a batch
- Submit reviews with **Approve**, **Request Changes**, or **Comment** events

### AI Chat

- Chat with AI about the PR in a side panel
- Context-aware responses based on the full diff content
- Powered by OpenCode with configurable model selection

### Settings & Configuration

- Per-action model selection (grouping, AI review, pattern verification, related files)
- Settings persisted to `~/.config/codereview/settings.toml`
- Default model: `google/gemini-3-flash-preview`

## Development

```bash
# Start all dev servers (client + server with hot reload)
pnpm dev

# Lint all packages
pnpm lint

# Type-check individual packages
pnpm --filter @codereview/client check-types
pnpm --filter @codereview/server check-types
pnpm cli:typecheck

# Run CLI in dev mode (from a git repo directory)
pnpm cli:dev
```

## Project Structure

```
apps/
└── cli/              # CLI entry point (@codereview/cli)
    ├── bin/           # Executable entry
    └── src/           # CLI logic (git, github, server launcher)
packages/
├── client/           # React + Vite frontend (@codereview/client)
│   └── src/
│       ├── components/  # UI components (diff panel, side panel, top bar, comments)
│       ├── hooks/       # React hooks (diff, comments, AI review, settings)
│       ├── api/         # API client functions
│       └── types/       # TypeScript type definitions
└── server/           # Hono API server (@codereview/server)
    └── src/
        ├── routes/      # API endpoints (diff, comments, reviews, AI review, settings)
        ├── services/    # Business logic (gh CLI, git, AI review, grouping)
        ├── lib/         # Shared utilities (logger, errors, app context)
        └── types/       # TypeScript type definitions
```

## Tech Stack

- **Runtime**: Bun (server & CLI), Browser (client)
- **Backend**: Hono
- **Frontend**: React 19 + Vite (rolldown-vite) + Tailwind CSS v4
- **UI Components**: shadcn/ui + Base UI + Hugeicons
- **Diff UI**: @pierre/diffs
- **Data Fetching**: TanStack React Query
- **AI Backend**: OpenCode SDK
- **Build**: Turborepo + pnpm workspaces
- **CLI**: Commander.js

## License

MIT
