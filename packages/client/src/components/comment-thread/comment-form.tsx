import * as React from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { HugeiconsIcon } from "@hugeicons/react"
import { Loading03Icon, SparklesIcon, UserIcon } from "@hugeicons/core-free-icons"

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
   * - "inline": Clean card-style wrapper with avatar (for inline diff comments)
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

    const textarea = textareaRef.current
    if (!textarea || document.activeElement === textarea) return

    const frame = requestAnimationFrame(() => {
      if (!textarea.isConnected || document.activeElement === textarea) return

      try {
        textarea.focus({ preventScroll: true })
      } catch {
        textarea.focus()
      }
    })

    return () => cancelAnimationFrame(frame)
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
          "border-transparent bg-muted/50 focus-visible:border-input focus-visible:bg-transparent",
          variant === "inline" && "min-h-[60px] resize-none"
        )}
      />
      <div
        data-slot="comment-form-actions"
        className={cn(
          "flex items-center gap-2",
          variant === "inline" ? "mt-3" : "mt-2"
        )}
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
              <span>Submitting...</span>
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
                <span>Thinking...</span>
              </>
            ) : (
              <>
                <HugeiconsIcon
                  icon={SparklesIcon}
                  className={cn(size === "sm" ? "size-3" : "size-4")}
                  data-icon="inline-start"
                  aria-hidden="true"
                />
                <span>Ask AI</span>
              </>
            )}
          </Button>
        )}
        <div className="flex-1" />
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
          className="mt-3 text-xs text-muted-foreground"
        >
          <kbd className="border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">⌘+Enter</kbd>
          <span className="ml-1 mr-3">submit</span>
          {onAskAI && (
            <>
              <kbd className="border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">⌘+Shift+Enter</kbd>
              <span className="ml-1 mr-3">ask AI</span>
            </>
          )}
          {onCancel && (
            <>
              <kbd className="border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">Esc</kbd>
              <span className="ml-1">cancel</span>
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
        style={{ display: "flex", flexDirection: "row", gap: 1 }}
        role="form"
        aria-label="Add a comment"
      >
        <div className="w-full">
          <div className="m-5 max-w-[95%] whitespace-normal sm:max-w-[90%]">
            <div className="bg-card rounded-lg border p-5 shadow-sm">
              <div className="flex gap-2">
                <div className="relative -mt-0.5 flex-shrink-0">
                  <div className="flex size-6 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <HugeiconsIcon
                      icon={UserIcon}
                      className="size-3.5"
                      aria-hidden="true"
                    />
                  </div>
                </div>
                <div className="flex-1">
                  <form
                    data-slot="comment-form"
                    aria-busy={isDisabled}
                    onSubmit={handleSubmit}
                    {...props}
                  >
                    <Textarea
                      ref={textareaRef}
                      data-slot="comment-input"
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={placeholder}
                      disabled={isDisabled}
                      aria-label="Comment text"
                      aria-describedby={
                        showKeyboardHints ? "comment-form-hint" : undefined
                      }
                      rows={3}
                      className="min-h-[60px] w-full resize-none rounded-md border bg-background p-2 text-sm text-foreground focus:ring-2 focus:ring-ring focus:outline-none"
                    />
                    <div
                      data-slot="comment-form-actions"
                      className="mt-3 flex items-center gap-2"
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
                              className={cn(
                                size === "sm" ? "size-3" : "size-4",
                                "animate-spin"
                              )}
                              aria-hidden="true"
                            />
                            <span>Submitting...</span>
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
                                className={cn(
                                  size === "sm" ? "size-3" : "size-4",
                                  "animate-spin"
                                )}
                                aria-hidden="true"
                              />
                              <span>Thinking...</span>
                            </>
                          ) : (
                            <>
                              <HugeiconsIcon
                                icon={SparklesIcon}
                                className={cn(
                                  size === "sm" ? "size-3" : "size-4"
                                )}
                                data-icon="inline-start"
                                aria-hidden="true"
                              />
                              <span>Ask AI</span>
                            </>
                          )}
                        </Button>
                      )}
                      <div className="flex-1" />
                      {onCancel && (
                        <button
                          type="button"
                          onClick={onCancel}
                          disabled={isDisabled}
                          className="text-muted-foreground hover:text-foreground cursor-pointer px-3 py-1 text-sm transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                    {showKeyboardHints && (
                      <p
                        id="comment-form-hint"
                        className="mt-3 text-xs text-muted-foreground"
                      >
                        <kbd className="border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                          ⌘+Enter
                        </kbd>
                        <span className="ml-1 mr-3">submit</span>
                        {onAskAI && (
                          <>
                            <kbd className="border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                              ⌘+Shift+Enter
                            </kbd>
                            <span className="ml-1 mr-3">ask AI</span>
                          </>
                        )}
                        {onCancel && (
                          <>
                            <kbd className="border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">
                              Esc
                            </kbd>
                            <span className="ml-1">cancel</span>
                          </>
                        )}
                      </p>
                    )}
                  </form>
                </div>
              </div>
            </div>
          </div>
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
