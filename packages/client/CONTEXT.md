# Domain Glossary — @clm/client

Shared vocabulary for the PR review client. Use these terms exactly when naming modules, hooks, types, and components.

## Core Entities

- **PR** — A GitHub Pull Request, identified by number and repo. Has info (title, author, description, base/head branches) and state (open/merged/closed).
- **Diff** — The file-level changes in a PR. Each file has a path, status (added/modified/deleted/renamed), old/new content, and line counts.
- **Comment** — Human feedback on the diff, attached to a file and line. Can be a top-level comment or a reply to another comment. Has a side (additions or deletions).
- **Draft Comment** — A comment that hasn't been submitted yet, part of a Draft Review. Editable, deletable by its author. Distinct from submitted Comments.
- **Draft Review** — A pending GitHub review that bundles draft comments for submission. Submitted with an event: comment, approve, or request-changes.
- **AI Review Item** — AI-generated feedback on the diff. Has severity (critical/warning/info), categories (code-quality, security, etc.), and an optional code suggestion. Can be converted into a Draft Comment.
- **Change Group** — AI-generated logical grouping of changed files, each with a risk level (high/medium/low) and summary.
- **Related File** — AI-suggested file outside the diff that may need changes, with an explanation.


## UI Concepts

- **Annotation** — Any marker displayed on the diff viewer: human Comments, Draft Comments, or converted AI Review Items. The unified concept behind the diff overlay.
- **Action** — A user-triggered AI operation (grouping, ai-review). Each action has configurable model/variant settings.
- **Viewed File** — Per-file viewed/unviewed state on the diff. Synced with GitHub's PR file viewed state. Unviewed files can be visually distinct.
- **File Tree** — The left-panel hierarchical file browser for the PR diff.
- **Side Panel** — The right-panel tabbed container for Grouping and AI Review.
