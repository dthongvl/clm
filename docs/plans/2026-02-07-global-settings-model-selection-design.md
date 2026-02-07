# Global Settings & Per-Action Model Selection

## Overview

Add a global settings file (TOML) that allows users to configure the AI model for each action independently. The frontend displays a settings button (gear icon) next to each action's trigger button, opening a popover with a model selector.

## Settings File

**Location:** `~/.config/codereview/settings.toml`

**Schema:**
```toml
[grouping]
model = "google/gemini-3-flash-preview"

[ai-review]
model = "anthropic/claude-sonnet-4-20250514"

[pattern-verification]
model = "google/gemini-3-flash-preview"

[related-files]
model = "google/gemini-3-flash-preview"
```

Each action is its own TOML section, extensible with more keys in the future.

## Action Keys

| Key                    | Component               | Trigger Button           |
|------------------------|-------------------------|--------------------------|
| `grouping`             | IntelligentGrouping     | Generate AI Groupings    |
| `ai-review`            | AIReviewSummary         | Generate AI Review       |
| `pattern-verification` | PatternVerificationPanel| Verify Patterns          |
| `related-files`        | RelatedFiles            | Find Related Files       |

## Server Changes

### New: `packages/server/src/services/settings.ts`

- Reads/writes `~/.config/codereview/settings.toml` using `smol-toml`
- Creates file with defaults if it doesn't exist
- Exports `getSettings()`, `updateSettings(partial)` functions
- Default model for all actions: `google/gemini-3-flash-preview`

### New: `packages/server/src/routes/settings.ts`

- `GET /api/settings` — returns current settings
- `PUT /api/settings` — partial merge update of settings

### New: `packages/server/src/routes/models.ts`

- `GET /api/models` — calls opencode SDK `provider.list()`, filters to connected providers only, returns flat list of model options

### Modified: AI service files

Each service reads its model from settings instead of the `AI_MODEL` env var:
- `packages/server/src/services/grouping.ts`
- `packages/server/src/services/ai-review.ts`
- `packages/server/src/services/pattern-verification.ts`
- `packages/server/src/services/related-files.ts`

## Frontend Changes

### Types

```typescript
type ActionKey = "grouping" | "ai-review" | "pattern-verification" | "related-files"

interface ModelOption {
  id: string        // "google/gemini-3-flash-preview"
  name: string      // "Gemini 3 Flash Preview"
  provider: string  // "Google"
}

interface Settings {
  [key in ActionKey]?: {
    model?: string
  }
}
```

### New: `packages/client/src/hooks/use-models.ts`

- Fetches `GET /api/models` once on mount
- Returns `{ models: ModelOption[], isLoading: boolean }`

### New: `packages/client/src/hooks/use-settings.ts`

- Fetches `GET /api/settings` on mount
- Returns `{ settings, updateSetting(action, key, value) }`
- `updateSetting` calls `PUT /api/settings` and optimistically updates local state

### New: `packages/client/src/components/side-panel/action-settings-popover.tsx`

Reusable popover component:
```tsx
<ActionSettingsPopover
  actionKey="grouping"
  models={models}
  currentModel={settings?.grouping?.model}
  onModelChange={(model) => updateSetting("grouping", "model", model)}
/>
```

- Renders a small gear icon button
- Opens a shadcn/ui `Popover` containing a `Select` for model selection
- Models grouped by provider in the dropdown

### Integration

Each action's trigger area becomes a flex row:
```tsx
<div className="flex gap-2">
  <Button className="flex-1" ...>Generate AI Groupings</Button>
  <ActionSettingsPopover actionKey="grouping" ... />
</div>
```

Applied to:
- `intelligent-grouping.tsx` — next to "Generate AI Groupings"
- `App.tsx` — next to "Generate AI Review"
- `pattern-verification.tsx` — next to "Verify Patterns"
- `related-files.tsx` — next to "Find Related Files"

Data flows from `App.tsx` (where `useSettings` and `useModels` are called) down as props — consistent with existing patterns.

## Dependencies

- `smol-toml` — lightweight TOML parser/serializer (server)
- Existing: `@radix-ui/react-popover`, `@radix-ui/react-select` (shadcn/ui, client)
