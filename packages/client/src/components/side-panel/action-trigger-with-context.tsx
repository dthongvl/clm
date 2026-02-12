import * as React from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { ArrowDown01Icon, Loading03Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"
import type { AIReviewCategory, AIReviewRunMode } from "@/types/review"

const MAX_CONTEXT_LENGTH = 2000

const ALL_CATEGORIES: AIReviewCategory[] = [
  "code-quality",
  "coding-convention",
  "security",
  "accessibility",
  "architecture",
  "api-design",
  "performance",
  "testing",
]

const CATEGORY_LABELS: Record<AIReviewCategory, string> = {
  "code-quality": "Code Quality",
  "coding-convention": "Coding Convention",
  "security": "Security",
  "accessibility": "Accessibility",
  "architecture": "Architecture",
  "api-design": "API Design",
  "performance": "Performance",
  "testing": "Testing",
}

export interface AIReviewOptions {
  reviewCategories: AIReviewCategory[]
  runMode: AIReviewRunMode
}

interface ActionTriggerWithContextProps {
  label: string
  loadingLabel: string
  ariaLabel: string
  isLoading?: boolean
  disabled?: boolean
  icon: IconSvgElement
  loadingIcon?: IconSvgElement
  onRun: (additionalContext?: string, options?: AIReviewOptions) => Promise<boolean> | boolean
  enableAIReviewOptions?: boolean
}

function ActionTriggerWithContext({
  label,
  loadingLabel,
  ariaLabel,
  isLoading = false,
  disabled = false,
  icon,
  loadingIcon = Loading03Icon,
  onRun,
  enableAIReviewOptions = false,
}: ActionTriggerWithContextProps) {
  const [context, setContext] = React.useState("")
  const [isPopoverOpen, setIsPopoverOpen] = React.useState(false)
  const [isSubmittingWithContext, setIsSubmittingWithContext] = React.useState(false)
  
  // AI Review options state
  const [selectedCategories, setSelectedCategories] = React.useState<AIReviewCategory[]>([...ALL_CATEGORIES])
  const [runMode, setRunMode] = React.useState<AIReviewRunMode>("combined")

  const buildOptions = React.useCallback((): AIReviewOptions | undefined => {
    if (!enableAIReviewOptions) return undefined
    return {
      reviewCategories: selectedCategories,
      runMode,
    }
  }, [enableAIReviewOptions, selectedCategories, runMode])

  const handleMainRun = React.useCallback(async () => {
    await onRun(undefined, buildOptions())
  }, [onRun, buildOptions])

  const handleRunWithContext = React.useCallback(async () => {
    const trimmed = context.trim()

    setIsSubmittingWithContext(true)
    try {
      const success = await onRun(trimmed || undefined, buildOptions())
      if (success) {
        setContext("")
        setIsPopoverOpen(false)
      }
    } finally {
      setIsSubmittingWithContext(false)
    }
  }, [context, onRun, buildOptions])

  const handleCategoryToggle = React.useCallback((category: AIReviewCategory) => {
    setSelectedCategories((prev) => {
      if (prev.includes(category)) {
        return prev.filter((c) => c !== category)
      }
      return [...prev, category]
    })
  }, [])

  const handleSelectAll = React.useCallback(() => {
    setSelectedCategories([...ALL_CATEGORIES])
  }, [])

  const handleClearAll = React.useCallback(() => {
    setSelectedCategories([])
  }, [])

  const isActionDisabled = isLoading || disabled || (enableAIReviewOptions && selectedCategories.length === 0)
  const isContextSubmitDisabled = isSubmittingWithContext || (enableAIReviewOptions && selectedCategories.length === 0)

  return (
    <div className="flex flex-1">
      <Button
        variant="outline"
        size="sm"
        onClick={handleMainRun}
        disabled={isActionDisabled}
        className="flex-1 rounded-r-none border-r-0"
        aria-label={isLoading ? loadingLabel : ariaLabel}
      >
        <HugeiconsIcon
          icon={isLoading ? loadingIcon : icon}
          className={cn(isLoading && "animate-spin")}
          data-icon="inline-start"
        />
        {isLoading ? loadingLabel : label}
      </Button>
      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="outline"
              size="icon-sm"
              disabled={isActionDisabled}
              className="rounded-l-none"
              aria-label="Run with additional context"
            />
          }
        >
          <HugeiconsIcon icon={ArrowDown01Icon} strokeWidth={2} />
        </PopoverTrigger>
        <PopoverContent
          side="bottom"
          align="end"
          sideOffset={4}
          className={cn(
            "p-3",
            enableAIReviewOptions ? "w-96" : "w-80"
          )}
        >
              <div className="flex flex-col gap-3">
                {enableAIReviewOptions && (
                  <>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-foreground">
                          Review Categories
                        </label>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleSelectAll}
                            className="h-6 px-2 text-xs"
                          >
                            Select all
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleClearAll}
                            className="h-6 px-2 text-xs"
                          >
                            Clear
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                        {ALL_CATEGORIES.map((category) => (
                          <label
                            key={category}
                            className="flex items-center gap-2 text-xs cursor-pointer"
                          >
                            <Checkbox
                              checked={selectedCategories.includes(category)}
                              onCheckedChange={() => handleCategoryToggle(category)}
                            />
                            <span>{CATEGORY_LABELS[category]}</span>
                          </label>
                        ))}
                      </div>
                      {selectedCategories.length === 0 && (
                        <p className="text-xs text-destructive">
                          Select at least one category
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-2 text-xs cursor-pointer">
                        <Checkbox
                          checked={runMode === "separate"}
                          onCheckedChange={(checked) => setRunMode(checked ? "separate" : "combined")}
                        />
                        <span>Run each category separately</span>
                      </label>
                      <p className="text-xs text-muted-foreground pl-6">
                        Separate mode is slower but may catch more issues.
                      </p>
                    </div>
                    <div className="border-t border-border" />
                  </>
                )}
                <div className="space-y-1">
                  <label
                    htmlFor="additional-context"
                    className="text-xs font-medium text-foreground"
                  >
                    Additional Context
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Provide optional guidance for this action (e.g., areas to focus on, specific concerns)
                  </p>
                </div>
                <Textarea
                  id="additional-context"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="e.g., Focus on authentication edge cases..."
                  maxLength={MAX_CONTEXT_LENGTH}
                  className="min-h-20 resize-none"
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {context.length}/{MAX_CONTEXT_LENGTH}
                  </span>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleRunWithContext}
                    disabled={isContextSubmitDisabled}
                  >
                    {isSubmittingWithContext ? (
                      <>
                        <HugeiconsIcon
                          icon={Loading03Icon}
                          className="animate-spin"
                          data-icon="inline-start"
                        />
                        Running...
                      </>
                    ) : (
                      "Run"
                    )}
                  </Button>
                </div>
              </div>
            </PopoverContent>
      </Popover>
    </div>
  )
}

export { ActionTriggerWithContext }
export type { ActionTriggerWithContextProps }
