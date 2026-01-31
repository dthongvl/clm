import * as React from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { HugeiconsIcon } from "@hugeicons/react"
import { Loading03Icon } from "@hugeicons/core-free-icons"

export interface CommentFormProps extends Omit<React.ComponentProps<"form">, "onSubmit"> {
  onSubmit: (content: string) => void
  onAskAI?: (content: string) => void
  isLoading?: boolean
  isAILoading?: boolean
  placeholder?: string
}

function CommentForm({
  onSubmit,
  onAskAI,
  isLoading = false,
  isAILoading = false,
  placeholder = "Write a comment...",
  className,
  ...props
}: CommentFormProps) {
  const [content, setContent] = React.useState("")
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const isDisabled = isLoading || isAILoading

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (content.trim() && !isLoading) {
      onSubmit(content.trim())
      setContent("")
    }
  }

  const handleAskAI = () => {
    if (onAskAI && !isDisabled) {
      onAskAI(content)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      if (event.shiftKey) {
        handleAskAI()
      } else if (content.trim() && !isDisabled) {
        onSubmit(content.trim())
        setContent("")
      }
    }
  }

  return (
    <form
      data-slot="comment-form"
      aria-busy={isDisabled}
      aria-label="Comment form"
      onSubmit={handleSubmit}
      className={cn("flex flex-col gap-2", className)}
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
        rows={3}
      />
      <div data-slot="comment-form-actions" className="flex items-center gap-2">
        <Button
          type="submit"
          disabled={!content.trim() || isDisabled}
          aria-label="Submit comment"
        >
          {isLoading ? "Submitting..." : "Comment"}
        </Button>
        {onAskAI && (
          <Button
            type="button"
            variant="outline"
            onClick={handleAskAI}
            disabled={isDisabled}
            aria-label="Ask AI for suggestions"
          >
            {isAILoading ? (
              <>
                <HugeiconsIcon icon={Loading03Icon} className="size-4 animate-spin" />
                Thinking...
              </>
            ) : (
              "Ask AI"
            )}
          </Button>
        )}
      </div>
    </form>
  )
}

export { CommentForm }
