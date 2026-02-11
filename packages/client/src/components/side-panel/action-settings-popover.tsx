import * as React from "react"
import { Popover } from "@base-ui/react/popover"
import { Button } from "@/components/ui/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxGroup,
  ComboboxLabel,
  ComboboxList,
  ComboboxCollection,
} from "@/components/ui/combobox"
import { HugeiconsIcon } from "@hugeicons/react"
import { Settings02Icon } from "@hugeicons/core-free-icons"
import type { ActionKey, ModelOption } from "@/types/settings"

interface ModelGroup {
  value: string
  items: ModelOption[]
}

interface VariantOption {
  value: string
  label: string
}

interface ActionSettingsPopoverProps {
  actionKey: ActionKey
  models: ModelOption[]
  currentModel?: string
  currentVariant?: string
  onModelChange: (model: string, variant?: string) => void
  isLoading?: boolean
}

function ActionSettingsPopover({
  actionKey,
  models,
  currentModel,
  currentVariant,
  onModelChange,
  isLoading,
}: ActionSettingsPopoverProps) {
  const groups = React.useMemo<ModelGroup[]>(() => {
    const map = new Map<string, ModelOption[]>()
    for (const model of models) {
      const list = map.get(model.provider) || []
      list.push(model)
      map.set(model.provider, list)
    }
    return Array.from(map.entries()).map(([provider, items]) => ({
      value: provider,
      items,
    }))
  }, [models])

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

  return (
    <Popover.Root>
      <Popover.Trigger
        render={
          <Button
            variant="outline"
            size="icon-sm"
            aria-label={`Settings for ${actionKey}`}
          />
        }
      >
        <HugeiconsIcon icon={Settings02Icon} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={4}>
          <Popover.Popup className="z-50 w-64 rounded-none border border-border bg-popover p-3 shadow-md">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-muted-foreground">
                Model
              </label>
              <Combobox
                items={groups}
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
                <ComboboxContent sideOffset={6}>
                  <ComboboxEmpty>No models found</ComboboxEmpty>
                  <ComboboxList>
                    {(group: ModelGroup) => (
                      <ComboboxGroup key={group.value} items={group.items}>
                        <ComboboxLabel>{group.value}</ComboboxLabel>
                        <ComboboxCollection>
                          {(item: ModelOption) => (
                            <ComboboxItem key={item.id} value={item}>
                              {item.name}
                            </ComboboxItem>
                          )}
                        </ComboboxCollection>
                      </ComboboxGroup>
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
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}

export { ActionSettingsPopover }
