import * as React from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Textarea } from "@/components/ui/textarea"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { ArrowDown01Icon, Loading03Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"

const MAX_CONTEXT_LENGTH = 2000

interface ActionTriggerWithContextProps {
  label: string
  loadingLabel: string
  ariaLabel: string
  isLoading?: boolean
  disabled?: boolean
  icon: IconSvgElement
  loadingIcon?: IconSvgElement
  onRun: (additionalContext?: string) => Promise<boolean> | boolean
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
}: ActionTriggerWithContextProps) {
  const [context, setContext] = React.useState("")
  const [isPopoverOpen, setIsPopoverOpen] = React.useState(false)
  const [isSubmittingWithContext, setIsSubmittingWithContext] = React.useState(false)

  const handleMainRun = React.useCallback(async () => {
    await onRun()
  }, [onRun])

  const handleRunWithContext = React.useCallback(async () => {
    const trimmed = context.trim()

    setIsSubmittingWithContext(true)
    try {
      const success = await onRun(trimmed || undefined)
      if (success) {
        setContext("")
        setIsPopoverOpen(false)
      }
    } finally {
      setIsSubmittingWithContext(false)
    }
  }, [context, onRun])

  const isActionDisabled = isLoading || disabled

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
          className="w-80 p-3"
        >
          <div className="flex flex-col gap-3">
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
                disabled={isSubmittingWithContext}
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
