import { useState, useCallback, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { HugeiconsIcon } from "@hugeicons/react"
import { Loading03Icon } from "@hugeicons/core-free-icons"

/**
 * Props for the InlineCommentForm component.
 * 
 * @example
 * <InlineCommentForm
 *   onSubmit={(content) => console.log('Comment:', content)}
 *   onCancel={() => console.log('Cancelled')}
 *   isSubmitting={false}
 * />
 */
export interface InlineCommentFormProps {
  /** Callback fired when the comment is submitted with content */
  onSubmit: (content: string) => void
  /** Callback fired when the form is cancelled */
  onCancel: () => void
  /** Whether the form is currently submitting */
  isSubmitting?: boolean
  /** Auto-focus the textarea on mount @default true */
  autoFocus?: boolean
}

/**
 * An inline comment form for adding comments to code diffs.
 * 
 * Supports keyboard shortcuts:
 * - `Cmd+Enter` / `Ctrl+Enter` to submit
 * - `Escape` to cancel
 * 
 * @example
 * ```tsx
 * <InlineCommentForm
 *   onSubmit={async (content) => {
 *     await saveComment(content)
 *   }}
 *   onCancel={() => setShowForm(false)}
 *   isSubmitting={isSaving}
 * />
 * ```
 * 
 * @remarks
 * - Supports keyboard navigation (Cmd+Enter to submit, Escape to cancel)
 * - Accessible by default with proper focus management
 */
function InlineCommentForm({
  onSubmit,
  onCancel,
  isSubmitting = false,
  autoFocus = true,
}: InlineCommentFormProps) {
  const [content, setContent] = useState("")
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-focus textarea on mount
  useEffect(() => {
    if (!autoFocus) return
    const timer = setTimeout(() => {
      textareaRef.current?.focus()
    }, 0)
    return () => clearTimeout(timer)
  }, [autoFocus])

  const handleSubmit = useCallback(() => {
    if (content.trim() && !isSubmitting) {
      onSubmit(content.trim())
    }
  }, [content, isSubmitting, onSubmit])

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        handleSubmit()
      } else if (event.key === "Escape") {
        event.preventDefault()
        onCancel()
      }
    },
    [handleSubmit, onCancel]
  )

  return (
    <div
      data-slot="inline-comment-form"
      className="w-full overflow-hidden"
      role="form"
      aria-label="Add a comment"
    >
      <div className="m-4 max-w-[95%] sm:max-w-[70%]">
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Leave a comment..."
            disabled={isSubmitting}
            rows={3}
            className="min-h-[60px] resize-none"
            aria-label="Comment content"
            aria-describedby="comment-form-hint"
          />
          <div className="mt-3 flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={handleSubmit}
              disabled={!content.trim() || isSubmitting}
              aria-busy={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <HugeiconsIcon
                    icon={Loading03Icon}
                    className="size-3 animate-spin"
                    aria-hidden="true"
                  />
                  Submitting...
                </>
              ) : (
                "Comment"
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          </div>
          <p
            id="comment-form-hint"
            className="mt-2 text-xs text-muted-foreground"
          >
            Press{" "}
            <kbd className="rounded bg-muted px-1">Cmd+Enter</kbd> to
            submit,{" "}
            <kbd className="rounded bg-muted px-1">Esc</kbd> to cancel
          </p>
        </div>
      </div>
    </div>
  )
}

export { InlineCommentForm }
