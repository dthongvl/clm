import * as React from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { HugeiconsIcon } from "@hugeicons/react"
import { Loading03Icon } from "@hugeicons/core-free-icons"

/**
 * Props for the CommentForm component.
 *
 * @example
 * // Basic usage
 * <CommentForm
 *   onSubmit={(content) => console.log('Comment:', content)}
 *   placeholder="Write a comment..."
 * />
 *
 * @example
 * // With AI and cancel support (inline mode)
 * <CommentForm
 *   onSubmit={handleSubmit}
 *   onAskAI={handleAskAI}
 *   onCancel={() => setShowForm(false)}
 *   autoFocus
 *   variant="inline"
 * />
 */
export interface CommentFormProps
  extends Omit<React.ComponentProps<"form">, "onSubmit"> {
  /** Callback fired when the comment is submitted */
  onSubmit: (content: string) => void
  /** Callback fired when asking AI for suggestions */
  onAskAI?: (content: string) => void
  /** Callback fired when the form is cancelled (shows cancel button when provided) */
  onCancel?: () => void
  /** Whether the submit action is loading */
  isLoading?: boolean
  /** Whether the AI action is loading */
  isAILoading?: boolean
  /** Placeholder text for the textarea */
  placeholder?: string
  /** Auto-focus the textarea on mount @default false */
  autoFocus?: boolean
  /** Button size variant @default "default" */
  size?: "sm" | "default"
  /** Whether to show keyboard hints @default false */
  showKeyboardHints?: boolean
  /**
   * Form variant affecting styling
   * - "default": Basic form without wrapper
   * - "inline": Card wrapper with shadow (for inline diff comments)
   * @default "default"
   */
  variant?: "default" | "inline"
}

/**
 * A unified comment form supporting multiple use cases:
 * - Basic comment submission
 * - AI assistance requests
 * - Inline diff commenting with cancel support
 *
 * Keyboard shortcuts:
 * - `Cmd+Enter` / `Ctrl+Enter` to submit
 * - `Cmd+Shift+Enter` / `Ctrl+Shift+Enter` to ask AI
 * - `Escape` to cancel (when onCancel is provided)
 *
 * @example
 * ```tsx
 * // Thread comment form
 * <CommentForm
 *   onSubmit={async (content) => {
 *     await postComment(content)
 *   }}
 *   onAskAI={(content) => askAI(content)}
 *   isLoading={isSubmitting}
 *   isAILoading={isAIThinking}
 * />
 *
 * // Inline diff comment form
 * <CommentForm
 *   onSubmit={handleSubmit}
 *   onCancel={() => setDraft(null)}
 *   autoFocus
 *   variant="inline"
 *   size="sm"
 *   showKeyboardHints
 * />
 * ```
 */
function CommentForm({
  onSubmit,
  onAskAI,
  onCancel,
  isLoading = false,
  isAILoading = false,
  placeholder = "Write a comment...",
  autoFocus = false,
  size = "default",
  showKeyboardHints = false,
  variant = "default",
  className,
  ...props
}: CommentFormProps) {
  const [content, setContent] = React.useState("")
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const isDisabled = isLoading || isAILoading

  // Auto-focus textarea on mount
  React.useEffect(() => {
    if (!autoFocus) return
    const timer = setTimeout(() => {
      textareaRef.current?.focus()
    }, 0)
    return () => clearTimeout(timer)
  }, [autoFocus])

  const handleSubmit = React.useCallback(
    (event?: React.FormEvent<HTMLFormElement>) => {
      event?.preventDefault()
      if (content.trim() && !isDisabled) {
        onSubmit(content.trim())
        setContent("")
      }
    },
    [content, isDisabled, onSubmit]
  )

  const handleAskAI = React.useCallback(() => {
    if (onAskAI && !isDisabled) {
      onAskAI(content)
    }
  }, [content, isDisabled, onAskAI])

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        if (event.shiftKey && onAskAI) {
          handleAskAI()
        } else {
          handleSubmit()
        }
      } else if (event.key === "Escape" && onCancel) {
        event.preventDefault()
        onCancel()
      }
    },
    [handleSubmit, handleAskAI, onAskAI, onCancel]
  )

  const formContent = (
    <>
      <Textarea
        ref={textareaRef}
        data-slot="comment-input"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={isDisabled}
        aria-label="Comment text"
        aria-describedby={showKeyboardHints ? "comment-form-hint" : undefined}
        rows={3}
        className={cn(
          variant === "inline" && "min-h-[60px] resize-none"
        )}
      />
      <div
        data-slot="comment-form-actions"
        className={cn("flex items-center gap-2", variant === "inline" && "mt-3")}
      >
        <Button
          type="submit"
          size={size}
          disabled={!content.trim() || isDisabled}
          aria-label="Submit comment"
          aria-busy={isLoading}
        >
          {isLoading ? (
            <>
              <HugeiconsIcon
                icon={Loading03Icon}
                className={cn(size === "sm" ? "size-3" : "size-4", "animate-spin")}
                aria-hidden="true"
              />
              Submitting...
            </>
          ) : (
            "Comment"
          )}
        </Button>
        {onAskAI && (
          <Button
            type="button"
            variant="outline"
            size={size}
            onClick={handleAskAI}
            disabled={isDisabled}
            aria-label="Ask AI for suggestions"
          >
            {isAILoading ? (
              <>
                <HugeiconsIcon
                  icon={Loading03Icon}
                  className={cn(size === "sm" ? "size-3" : "size-4", "animate-spin")}
                  aria-hidden="true"
                />
                Thinking...
              </>
            ) : (
              "Ask AI"
            )}
          </Button>
        )}
        {onCancel && (
          <Button
            type="button"
            variant="ghost"
            size={size}
            onClick={onCancel}
            disabled={isDisabled}
          >
            Cancel
          </Button>
        )}
      </div>
      {showKeyboardHints && (
        <p
          id="comment-form-hint"
          className="mt-2 text-xs text-muted-foreground"
        >
          Press <kbd className="rounded bg-muted px-1">Cmd+Enter</kbd> to submit
          {onAskAI && (
            <>
              , <kbd className="rounded bg-muted px-1">Cmd+Shift+Enter</kbd> to ask AI
            </>
          )}
          {onCancel && (
            <>
              , <kbd className="rounded bg-muted px-1">Esc</kbd> to cancel
            </>
          )}
        </p>
      )}
    </>
  )

  // Inline variant wraps content in a card
  if (variant === "inline") {
    return (
      <div
        data-slot="inline-comment-form"
        className="w-full overflow-hidden"
        role="form"
        aria-label="Add a comment"
      >
        <div className="m-4 max-w-[95%] sm:max-w-[70%]">
          <form
            data-slot="comment-form"
            aria-busy={isDisabled}
            onSubmit={handleSubmit}
            className="rounded-lg border bg-card p-4 shadow-sm"
            {...props}
          >
            {formContent}
          </form>
        </div>
      </div>
    )
  }

  // Default variant
  return (
    <form
      data-slot="comment-form"
      aria-busy={isDisabled}
      aria-label="Comment form"
      onSubmit={handleSubmit}
      className={cn("flex flex-col gap-2", className)}
      {...props}
    >
      {formContent}
    </form>
  )
}

export { CommentForm }
