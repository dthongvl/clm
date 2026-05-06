# CLM — Code Looks Good To Me

A local CLI tool that provides a web UI to review GitHub PRs with AI assistance. It runs entirely on your machine — your code and diffs never leave your local environment.

## Prerequisites

- [Bun](https://bun.sh/) runtime
- [pnpm](https://pnpm.io/) v10.28.2+
- [GitHub CLI (`gh`)](https://cli.github.com/) — authenticated with your GitHub account
- [OpenCode](https://opencode.ai/) — AI backend used for review, grouping, and chat features

## Installation

```bash
# Clone the repository
git clone https://github.com/dthongvl/clm.git
cd clm

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

### Running the CLI

After building, run the CLI directly from any Git repository with a GitHub remote:

```bash
bun <path-to-clm>/apps/cli/bin/clm [PR_NUMBER_OR_URL]
```

### Adding to PATH (optional)

To run `clm` from anywhere, create a symlink in a directory that's in your PATH:

```bash
ln -s <path-to-clm>/apps/cli/bin/clm ~/.local/bin/clm
```

Then from any Git repository:

```bash
clm [PR_NUMBER_OR_URL]
```

## Usage

Navigate to a Git repository with a GitHub remote and run:

```bash
# Interactive PR selection (shows PRs requesting your review)
clm

# Review a specific PR by number
clm 123

# Review a specific PR by URL
clm https://github.com/owner/repo/pull/123
```

This will:

1. Detect the current GitHub repository
2. Fetch the PR diff and metadata using `gh` CLI
3. Start the OpenCode AI backend
4. Start a local web server on port 3000
5. Open your browser to the review UI

Press `Ctrl+C` to stop all processes.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  $ clm 123                                                       │
│                                                                  │
│  CLI (@clm/cli)                                                  │
│  ├── Detect repo & PR info ──────────► gh CLI ──► GitHub API     │
│  ├── Fetch branches ─────────────────► git CLI                   │
│  ├── Start OpenCode server                                       │
│  ├── Start CLM server (port 3000)                                │
│  └── Open browser                                                │
└──────────────┬───────────────────────────┬───────────────────────┘
               │                           │
               ▼                           ▼
┌──────────────────────────┐ ┌──────────────────────────────────┐
│  Server (@clm/server)    │ │  OpenCode Server                 │
│  Hono on port 3000       │ │  AI backend                      │
│                          │ └──────────────┬───────────────────┘
│  Git features:           │                │
│  ├── /api/diff       ────┼──► git diff    │
│  ├── /api/comments   ────┼──► gh api      │
│  ├── /api/reviews    ────┼──► gh api      │
│  └── /api/pr-info    ────┼──► gh api      │
│                          │                │
│  AI features:            │                │
│  ├── /api/ai/review  ────┼────────────────┘
│  └── /api/ai/grouping ───┼────────────────►  OpenCode API
│                          │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│  Client (@clm/client)    │
│  React + Vite SPA        │
│                          │
│  Served as static files  │
│  from the CLM server     │
└──────────────────────────┘
```

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

- Per-action model selection (grouping, AI review)
- Settings persisted to `~/.config/clm/settings.toml`
- Default model: `google/gemini-3-flash-preview`

## Development

```bash
# Start all dev servers (client + server with hot reload)
pnpm dev

# Lint all packages
pnpm lint

# Type-check individual packages
pnpm --filter @clm/client check-types
pnpm --filter @clm/server check-types
pnpm cli:typecheck

# Run CLI in dev mode (from a git repo directory)
pnpm cli:dev
```

## Project Structure

```
apps/
└── cli/              # CLI entry point (@clm/cli)
    ├── bin/           # Executable entry
    └── src/           # CLI logic (git, github, server launcher)
packages/
├── client/           # React + Vite frontend (@clm/client)
│   └── src/
│       ├── components/  # UI components (diff panel, side panel, top bar, comments)
│       ├── hooks/       # React hooks (diff, comments, AI review, settings)
│       ├── api/         # API client functions
│       └── types/       # TypeScript type definitions
└── server/           # Hono API server (@clm/server)
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
