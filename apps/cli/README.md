# @clm/cli

CLM (Code Looks Good To Me) — a CLI tool that spins up a web UI to review GitHub PRs using the `gh` CLI and provides intelligent AI-powered feedback.

## Installation

```bash
# Install dependencies
bun install

# Or from the monorepo root
bun install --cwd apps/cli
```

## Usage

```bash
# Review a specific PR
clm <PR_NUMBER>

# Example
clm 123
```

## How It Works

1. **Validate Environment**: Checks that `gh` CLI is installed and available in PATH
2. **Start Server**: Spins up the Hono backend server on port 3000
3. **Open Browser**: Automatically opens your default browser to the review UI
4. **Review PR**: Provides a web interface to:
   - View diffs using `@pierre/diffs`
   - Add comments via `gh pr comment`
   - Get AI-powered code review suggestions
   - Chat with AI about specific lines

## Development

```bash
# Run in development mode
bun run dev

# Build for production
bun run build

# Type check
bun run typecheck

# Run the built version
bun run start
```

## CLI Arguments

- `<PR_NUMBER>` (required): The GitHub PR number to review

## Environment Requirements

- **Bun**: >= 1.0.0
- **GitHub CLI (gh)**: Must be installed and authenticated
- **AI Binary**: Local AI CLI (e.g., `claude`, `opencode`) must be available in PATH for AI features

## Architecture

The CLI acts as a wrapper that:
- Orchestrates the server startup
- Validates prerequisites
- Opens the browser
- Passes the PR number to the server via environment variables

## Scripts

| Script | Description |
|--------|-------------|
| `bun run dev` | Run CLI in development mode |
| `bun run build` | Bundle CLI for production |
| `bun run start` | Run the built CLI |
| `bun run typecheck` | Run TypeScript type checking |

## License

MIT
