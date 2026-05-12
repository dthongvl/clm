import * as React from "react"
import { Button } from "@/components/ui/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { HugeiconsIcon } from "@hugeicons/react"
import { Settings02Icon } from "@hugeicons/core-free-icons"
import type { ActionKey, ModelOption, ThinkingLevel } from "@/types/settings"

interface VariantOption {
  value: string
  label: string
}

interface ThinkingLevelOption {
  value: "" | ThinkingLevel
  label: string
}

const THINKING_LEVEL_OPTIONS: ThinkingLevelOption[] = [
  { value: "", label: "Default (SDK)" },
  { value: "off", label: "Off" },
  { value: "minimal", label: "Minimal" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "xhigh", label: "Extra high" },
]

interface ActionSettingsPopoverProps {
  actionKey: ActionKey
  models: ModelOption[]
  currentModel?: string
  currentVariant?: string
  currentThinkingLevel?: ThinkingLevel
  onModelChange: (model: string, variant?: string) => void
  onThinkingLevelChange?: (level: ThinkingLevel | undefined) => void
  isLoading?: boolean
}

function ActionSettingsPopover({
  actionKey,
  models,
  currentModel,
  currentVariant,
  currentThinkingLevel,
  onModelChange,
  onThinkingLevelChange,
  isLoading,
}: ActionSettingsPopoverProps) {
  const selectedModel = React.useMemo(
    () => models.find((m) => m.id === currentModel) ?? null,
    [models, currentModel],
  )

  const availableVariants = selectedModel?.variants ?? []
  const hasVariants = availableVariants.length > 0

  const variantOptions = React.useMemo<VariantOption[]>(() => {
    const options: VariantOption[] = [{ value: "", label: "Provider default" }]
    for (const variant of availableVariants) {
      options.push({ value: variant, label: variant })
    }
    return options
  }, [availableVariants])

  const selectedVariant = React.useMemo(
    () => variantOptions.find((v) => v.value === (currentVariant ?? "")) ?? variantOptions[0],
    [variantOptions, currentVariant],
  )

  const selectedThinkingLevel = React.useMemo(
    () =>
      THINKING_LEVEL_OPTIONS.find(
        (o) => o.value === (currentThinkingLevel ?? ""),
      ) ?? THINKING_LEVEL_OPTIONS[0],
    [currentThinkingLevel],
  )

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={`Settings for ${actionKey}`}
          />
        }
      >
        <HugeiconsIcon icon={Settings02Icon} />
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" sideOffset={4} className="w-64 p-3">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground">
                Model
              </label>
              <Combobox
                items={models}
                value={selectedModel}
                onValueChange={(value) => {
                  if (value) {
                    // Clear variant when model changes (variant may not be valid for new model)
                    onModelChange(value.id, undefined)
                  }
                }}
                disabled={isLoading}
                isItemEqualToValue={(a, b) => a.id === b.id}
                itemToStringLabel={(item) => item.name}
                itemToStringValue={(item) => item.id}
              >
                <ComboboxInput
                  placeholder="Search models..."
                  className="w-full"
                />
                <ComboboxContent
                  sideOffset={6}
                  align="end"
                  collisionAvoidance={{ side: "flip", align: "flip", fallbackAxisSide: "end" }}
                  collisionPadding={8}
                  className="w-auto min-w-[22rem] max-w-[min(28rem,var(--available-width))]"
                >
                  <ComboboxEmpty>No models found</ComboboxEmpty>
                  <ComboboxList>
                    {(item: ModelOption) => (
                      <ComboboxItem key={item.id} value={item}>
                        <div className="flex w-full items-center justify-between gap-2 pr-5">
                          <span className="truncate">{item.name}</span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {item.provider}
                          </span>
                        </div>
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
              {hasVariants && (
                <>
                  <label className="text-xs font-medium text-muted-foreground mt-2">
                    Variant
                  </label>
                  <Combobox
                    items={variantOptions}
                    value={selectedVariant}
                    onValueChange={(value) => {
                      if (currentModel) {
                        const variant = value?.value || undefined
                        onModelChange(currentModel, variant)
                      }
                    }}
                    disabled={isLoading}
                    isItemEqualToValue={(a, b) => a.value === b.value}
                    itemToStringLabel={(item) => item.label}
                    itemToStringValue={(item) => item.value}
                  >
                    <ComboboxInput
                      placeholder="Search variants..."
                      className="w-full"
                    />
                    <ComboboxContent sideOffset={6}>
                      <ComboboxEmpty>No variants found</ComboboxEmpty>
                      <ComboboxList>
                        {(item: VariantOption) => (
                          <ComboboxItem key={item.value} value={item}>
                            {item.label}
                          </ComboboxItem>
                        )}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                </>
              )}
              {onThinkingLevelChange && (
                <>
                  <label className="text-xs font-medium text-muted-foreground mt-2">
                    Thinking effort
                  </label>
                  <Combobox
                    items={THINKING_LEVEL_OPTIONS}
                    value={selectedThinkingLevel}
                    onValueChange={(value) => {
                      const next = value?.value
                      onThinkingLevelChange(next ? (next as ThinkingLevel) : undefined)
                    }}
                    disabled={isLoading}
                    isItemEqualToValue={(a, b) => a.value === b.value}
                    itemToStringLabel={(item) => item.label}
                    itemToStringValue={(item) => item.value}
                  >
                    <ComboboxInput
                      placeholder="Select effort..."
                      className="w-full"
                    />
                    <ComboboxContent sideOffset={6}>
                      <ComboboxEmpty>No options</ComboboxEmpty>
                      <ComboboxList>
                        {(item: ThinkingLevelOption) => (
                          <ComboboxItem key={item.value} value={item}>
                            {item.label}
                          </ComboboxItem>
                        )}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                </>
              )}
            </div>
          </PopoverContent>
    </Popover>
  )
}

export { ActionSettingsPopover }
