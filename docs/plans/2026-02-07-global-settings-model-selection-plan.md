# Global Settings & Per-Action Model Selection — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a global TOML settings file at `~/.config/codereview/settings.toml` allowing per-action AI model configuration, with a gear-icon popover + model select in the side panel UI.

**Architecture:** Server reads/writes TOML settings via a new settings service, exposes REST endpoints for settings CRUD and model listing (via opencode SDK `provider.list()`). Frontend adds `useSettings` and `useModels` hooks, and an `ActionSettingsPopover` component rendered next to each action trigger button.

**Tech Stack:** smol-toml (server), @base-ui/react Popover + existing Select component (client), Hono routes (server)

---

### Task 1: Install `smol-toml` dependency

**Files:**
- Modify: `packages/server/package.json`

**Step 1: Install the dependency**

Run:
```bash
cd /home/dthongvl/workspace/code-review && pnpm --filter @codereview/server add smol-toml
```

**Step 2: Verify installation**

Run:
```bash
cd /home/dthongvl/workspace/code-review && pnpm --filter @codereview/server check-types
```
Expected: No new errors

---

### Task 2: Create the settings service

**Files:**
- Create: `packages/server/src/services/settings.ts`

**Step 1: Create the settings service**

```typescript
import { parse, stringify } from 'smol-toml';
import { homedir } from 'os';
import { join } from 'path';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { logger } from '../lib/logger.js';

const CONFIG_DIR = join(homedir(), '.config', 'codereview');
const CONFIG_FILE = join(CONFIG_DIR, 'settings.toml');

export type ActionKey = 'grouping' | 'ai-review' | 'pattern-verification' | 'related-files';

export const ACTION_KEYS: ActionKey[] = ['grouping', 'ai-review', 'pattern-verification', 'related-files'];

const DEFAULT_MODEL = 'google/gemini-3-flash-preview';

export interface ActionSettings {
  model?: string;
}

export interface Settings {
  grouping?: ActionSettings;
  'ai-review'?: ActionSettings;
  'pattern-verification'?: ActionSettings;
  'related-files'?: ActionSettings;
}

function getDefaults(): Settings {
  return {
    grouping: { model: DEFAULT_MODEL },
    'ai-review': { model: DEFAULT_MODEL },
    'pattern-verification': { model: DEFAULT_MODEL },
    'related-files': { model: DEFAULT_MODEL },
  };
}

export async function getSettings(): Promise<Settings> {
  try {
    const content = await readFile(CONFIG_FILE, 'utf-8');
    const parsed = parse(content) as Settings;
    // Merge with defaults so missing keys are filled
    const defaults = getDefaults();
    for (const key of ACTION_KEYS) {
      if (!parsed[key]) {
        parsed[key] = defaults[key];
      } else if (!parsed[key]!.model) {
        parsed[key]!.model = defaults[key]!.model;
      }
    }
    return parsed;
  } catch {
    // File doesn't exist or is invalid — return defaults
    return getDefaults();
  }
}

export async function updateSettings(partial: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();

  for (const key of ACTION_KEYS) {
    if (partial[key]) {
      current[key] = { ...current[key], ...partial[key] };
    }
  }

  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_FILE, stringify(current as Record<string, unknown>), 'utf-8');
  logger.info(`Settings saved to ${CONFIG_FILE}`);

  return current;
}

export async function getModelForAction(action: ActionKey): Promise<string> {
  const settings = await getSettings();
  return settings[action]?.model || DEFAULT_MODEL;
}
```

**Step 2: Verify types**

Run:
```bash
cd /home/dthongvl/workspace/code-review && pnpm --filter @codereview/server check-types
```
Expected: No errors

---

### Task 3: Create the settings API route

**Files:**
- Create: `packages/server/src/routes/settings.ts`
- Modify: `packages/server/src/index.ts` (register route)

**Step 1: Create the route file**

```typescript
import { Hono } from 'hono';
import { getSettings, updateSettings } from '../services/settings.js';
import { safeJson } from '../utils/request.js';
import { logger } from '../lib/logger.js';
import type { Settings } from '../services/settings.js';

const app = new Hono();

// GET /api/settings - Get current settings
app.get('/', async (c) => {
  try {
    const settings = await getSettings();
    return c.json(settings);
  } catch (error) {
    logger.error('Failed to get settings', error);
    return c.json({ error: 'Failed to get settings', details: (error as Error).message }, 500);
  }
});

// PUT /api/settings - Update settings (partial merge)
app.put('/', async (c) => {
  const result = await safeJson<Partial<Settings>>(c);
  if (!result.ok) return result.response;

  try {
    const updated = await updateSettings(result.data);
    return c.json(updated);
  } catch (error) {
    logger.error('Failed to update settings', error);
    return c.json({ error: 'Failed to update settings', details: (error as Error).message }, 500);
  }
});

export default app;
```

**Step 2: Register in index.ts**

In `packages/server/src/index.ts`, add:
- Import: `import settingsRoutes from './routes/settings.js';`
- Route: `app.route('/api/settings', settingsRoutes);`

**Step 3: Verify types**

Run:
```bash
cd /home/dthongvl/workspace/code-review && pnpm --filter @codereview/server check-types
```
Expected: No errors

---

### Task 4: Create the models API route

**Files:**
- Create: `packages/server/src/routes/models.ts`
- Modify: `packages/server/src/index.ts` (register route)

**Step 1: Create the route file**

```typescript
import { Hono } from 'hono';
import { opencodeClient } from '../services/opencode-client.js';
import { logger } from '../lib/logger.js';

const app = new Hono();

interface ModelOption {
  id: string;
  name: string;
  provider: string;
}

// GET /api/models - List available models from connected providers
app.get('/', async (c) => {
  try {
    const client = opencodeClient.getClient();
    const result = await client.provider.list({});

    if (result.error || !result.data) {
      return c.json({ error: 'Failed to fetch providers' }, 500);
    }

    const { all, connected } = result.data;
    const connectedSet = new Set(connected);

    const models: ModelOption[] = [];

    for (const provider of all) {
      if (!connectedSet.has(provider.id)) continue;

      for (const [modelId, model] of Object.entries(provider.models)) {
        models.push({
          id: `${provider.id}/${modelId}`,
          name: model.name,
          provider: provider.name,
        });
      }
    }

    return c.json({ models });
  } catch (error) {
    logger.error('Failed to fetch models', error);
    return c.json({ error: 'Failed to fetch models', details: (error as Error).message }, 500);
  }
});

export default app;
```

**Step 2: Register in index.ts**

In `packages/server/src/index.ts`, add:
- Import: `import modelsRoutes from './routes/models.js';`
- Route: `app.route('/api/models', modelsRoutes);`

**Step 3: Verify types**

Run:
```bash
cd /home/dthongvl/workspace/code-review && pnpm --filter @codereview/server check-types
```
Expected: No errors

---

### Task 5: Update AI services to read model from settings

**Files:**
- Modify: `packages/server/src/services/grouping.ts`
- Modify: `packages/server/src/services/ai-review.ts`
- Modify: `packages/server/src/services/pattern-verification.ts`
- Modify: `packages/server/src/services/related-files.ts`

**Step 1: Update each service**

For each service file, replace the static `AI_MODEL` constant with a dynamic read from settings.

**grouping.ts:**
- Remove: `const AI_MODEL = process.env.AI_MODEL || 'google/gemini-3-flash-preview';`
- Add import: `import { getModelForAction } from './settings.js';`
- In `generateGrouping()`, replace `{ model: AI_MODEL }` with `{ model: await getModelForAction('grouping') }`

**ai-review.ts:**
- Same pattern, use `getModelForAction('ai-review')`

**pattern-verification.ts:**
- Same pattern, use `getModelForAction('pattern-verification')`

**related-files.ts:**
- Same pattern, use `getModelForAction('related-files')`

**Step 2: Verify types**

Run:
```bash
cd /home/dthongvl/workspace/code-review && pnpm --filter @codereview/server check-types
```
Expected: No errors

---

### Task 6: Add client types and API functions

**Files:**
- Modify: `packages/client/src/lib/api.ts`
- Create: `packages/client/src/types/settings.ts`

**Step 1: Create types file**

Create `packages/client/src/types/settings.ts`:
```typescript
export type ActionKey = "grouping" | "ai-review" | "pattern-verification" | "related-files"

export interface ActionSettings {
  model?: string
}

export interface Settings {
  grouping?: ActionSettings
  "ai-review"?: ActionSettings
  "pattern-verification"?: ActionSettings
  "related-files"?: ActionSettings
}

export interface ModelOption {
  id: string
  name: string
  provider: string
}
```

**Step 2: Add API functions to `packages/client/src/lib/api.ts`**

Add at the end of the file:
```typescript
import type { Settings, ModelOption } from '@/types/settings'

// Settings API
export async function fetchSettings(): Promise<Settings> {
  return fetchApi<Settings>('/settings');
}

export async function updateSettings(settings: Partial<Settings>): Promise<Settings> {
  return fetchApi<Settings>('/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

// Models API
interface ModelsResponse {
  models: ModelOption[];
}

export async function fetchModels(): Promise<ModelOption[]> {
  const response = await fetchApi<ModelsResponse>('/models');
  return response.models;
}
```

**Step 3: Verify types**

Run:
```bash
cd /home/dthongvl/workspace/code-review && pnpm --filter @codereview/client check-types
```
Expected: No errors

---

### Task 7: Create `useModels` and `useSettings` hooks

**Files:**
- Create: `packages/client/src/hooks/use-models.ts`
- Create: `packages/client/src/hooks/use-settings.ts`
- Modify: `packages/client/src/hooks/index.ts` (export new hooks)

**Step 1: Create use-models hook**

```typescript
import { useState, useEffect } from 'react'
import { fetchModels } from '@/lib/api'
import type { ModelOption } from '@/types/settings'

interface UseModelsReturn {
  models: ModelOption[]
  isLoading: boolean
}

export function useModels(): UseModelsReturn {
  const [models, setModels] = useState<ModelOption[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    fetchModels()
      .then((data) => {
        if (!cancelled) setModels(data)
      })
      .catch((err) => {
        console.error('Failed to fetch models:', err)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  return { models, isLoading }
}
```

**Step 2: Create use-settings hook**

```typescript
import { useState, useEffect, useCallback } from 'react'
import { fetchSettings, updateSettings as updateSettingsApi } from '@/lib/api'
import type { Settings, ActionKey } from '@/types/settings'

interface UseSettingsReturn {
  settings: Settings | null
  isLoading: boolean
  updateActionModel: (action: ActionKey, model: string) => Promise<void>
}

export function useSettings(): UseSettingsReturn {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    fetchSettings()
      .then((data) => {
        if (!cancelled) setSettings(data)
      })
      .catch((err) => {
        console.error('Failed to fetch settings:', err)
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  const updateActionModel = useCallback(async (action: ActionKey, model: string) => {
    // Optimistic update
    setSettings((prev) => {
      if (!prev) return prev
      return { ...prev, [action]: { ...prev[action], model } }
    })

    try {
      const updated = await updateSettingsApi({ [action]: { model } })
      setSettings(updated)
    } catch (err) {
      console.error('Failed to update settings:', err)
      // Revert on failure
      const reverted = await fetchSettings()
      setSettings(reverted)
    }
  }, [])

  return { settings, isLoading, updateActionModel }
}
```

**Step 3: Export from hooks/index.ts**

Add to `packages/client/src/hooks/index.ts`:
```typescript
export { useModels } from './use-models'
export { useSettings } from './use-settings'
```

**Step 4: Verify types**

Run:
```bash
cd /home/dthongvl/workspace/code-review && pnpm --filter @codereview/client check-types
```
Expected: No errors

---

### Task 8: Create `ActionSettingsPopover` component

**Files:**
- Create: `packages/client/src/components/side-panel/action-settings-popover.tsx`

**Step 1: Create the component**

This component renders a gear icon button. When clicked, it opens a popover (using base-ui Popover) containing a Select dropdown for model selection. Models are grouped by provider.

```tsx
import * as React from "react"
import { Popover } from "@base-ui/react/popover"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { HugeiconsIcon } from "@hugeicons/react"
import { Settings02Icon } from "@hugeicons/core-free-icons"
import type { ActionKey, ModelOption } from "@/types/settings"

interface ActionSettingsPopoverProps {
  actionKey: ActionKey
  models: ModelOption[]
  currentModel?: string
  onModelChange: (model: string) => void
  isLoading?: boolean
}

function ActionSettingsPopover({
  actionKey,
  models,
  currentModel,
  onModelChange,
  isLoading,
}: ActionSettingsPopoverProps) {
  const grouped = React.useMemo(() => {
    const map = new Map<string, ModelOption[]>()
    for (const model of models) {
      const list = map.get(model.provider) || []
      list.push(model)
      map.set(model.provider, list)
    }
    return map
  }, [models])

  return (
    <Popover.Root>
      <Popover.Trigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-8 shrink-0 p-0"
            aria-label={`Settings for ${actionKey}`}
          />
        }
      >
        <HugeiconsIcon icon={Settings02Icon} className="h-4 w-4" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={4}>
          <Popover.Popup className="z-50 w-64 rounded-none border border-border bg-popover p-3 shadow-md">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground">
                Model
              </label>
              <Select
                value={currentModel}
                onValueChange={onModelChange}
                disabled={isLoading}
              >
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from(grouped.entries()).map(([provider, providerModels]) => (
                    <SelectGroup key={provider}>
                      <SelectLabel>{provider}</SelectLabel>
                      {providerModels.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

export { ActionSettingsPopover }
```

**Step 2: Verify types**

Run:
```bash
cd /home/dthongvl/workspace/code-review && pnpm --filter @codereview/client check-types
```
Expected: No errors

---

### Task 9: Integrate into side-panel action components and App.tsx

**Files:**
- Modify: `packages/client/src/components/side-panel/intelligent-grouping.tsx`
- Modify: `packages/client/src/components/side-panel/pattern-verification.tsx`
- Modify: `packages/client/src/components/side-panel/related-files.tsx`
- Modify: `packages/client/src/App.tsx`

**Step 1: Add settings props to each component**

Each component gets three new optional props: `models`, `currentModel`, `onModelChange`. When provided, an `ActionSettingsPopover` is rendered next to the trigger button.

**intelligent-grouping.tsx** — Wrap the existing Button in a flex row:
```tsx
// Add imports:
import { ActionSettingsPopover } from "./action-settings-popover"
import type { ModelOption } from "@/types/settings"

// Add to IntelligentGroupingProps:
models?: ModelOption[]
currentModel?: string
onModelChange?: (model: string) => void

// In render, replace the Button block with:
{onGenerateGroups && (
  <div className="flex gap-2">
    <Button
      variant="outline"
      size="sm"
      onClick={onGenerateGroups}
      disabled={isGenerating}
      className="flex-1"
      aria-label={isGenerating ? "Generating groups..." : "Generate AI groupings"}
    >
      <HugeiconsIcon
        icon={isGenerating ? Loading03Icon : AiGenerativeIcon}
        className={cn(isGenerating && "animate-spin")}
        data-icon="inline-start"
      />
      {isGenerating ? "Generating..." : groups.length > 0 ? "Regenerate Groupings" : "Generate AI Groupings"}
    </Button>
    {models && onModelChange && (
      <ActionSettingsPopover
        actionKey="grouping"
        models={models}
        currentModel={currentModel}
        onModelChange={onModelChange}
      />
    )}
  </div>
)}
```

**pattern-verification.tsx** — Same pattern with `actionKey="pattern-verification"`.

**related-files.tsx** — Same pattern with `actionKey="related-files"`.

**Step 2: Update App.tsx**

Add hooks and pass props down:
```tsx
// Add imports:
import { useModels, useSettings } from "@/hooks"

// In App component, add:
const { models, isLoading: isModelsLoading } = useModels()
const { settings, updateActionModel } = useSettings()

// Pass to IntelligentGrouping:
<IntelligentGrouping
  groups={displayGroups}
  onFileClick={scrollToFile}
  onGenerateGroups={prNumber ? generateGroups : undefined}
  isGenerating={isGeneratingGroups}
  error={groupingError}
  models={models}
  currentModel={settings?.grouping?.model}
  onModelChange={(model) => updateActionModel("grouping", model)}
/>

// For AI Review button area, add ActionSettingsPopover next to the button:
<div className="flex gap-2">
  <Button variant="outline" size="sm" onClick={triggerReview} disabled={isReviewLoading} className="flex-1">
    {isReviewLoading ? "Generating AI Review..." : "Generate AI Review"}
  </Button>
  <ActionSettingsPopover
    actionKey="ai-review"
    models={models}
    currentModel={settings?.["ai-review"]?.model}
    onModelChange={(model) => updateActionModel("ai-review", model)}
  />
</div>

// Pass to PatternVerificationPanel:
<PatternVerificationPanel
  ...existing props...
  models={models}
  currentModel={settings?.["pattern-verification"]?.model}
  onModelChange={(model) => updateActionModel("pattern-verification", model)}
/>

// Pass to RelatedFiles:
<RelatedFiles
  ...existing props...
  models={models}
  currentModel={settings?.["related-files"]?.model}
  onModelChange={(model) => updateActionModel("related-files", model)}
/>
```

**Step 3: Verify types and build**

Run:
```bash
cd /home/dthongvl/workspace/code-review && pnpm --filter @codereview/client check-types
cd /home/dthongvl/workspace/code-review && pnpm build
```
Expected: No errors
