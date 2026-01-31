import * as React from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

export interface CommentFormProps extends Omit<React.ComponentProps<"form">, "onSubmit"> {
  onSubmit: (content: string) => void
  onAskAI?: () => void
  isLoading?: boolean
  placeholder?: string
}

function CommentForm({
  onSubmit,
  onAskAI,
  isLoading = false,
  placeholder = "Write a comment...",
  className,
  ...props
}: CommentFormProps) {
  const [content, setContent] = React.useState("")
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (content.trim() && !isLoading) {
      onSubmit(content.trim())
      setContent("")
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      if (content.trim() && !isLoading) {
        onSubmit(content.trim())
        setContent("")
      }
    }
  }

  return (
    <form
      data-slot="comment-form"
      aria-busy={isLoading}
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
        disabled={isLoading}
        aria-label="Comment text"
        rows={3}
      />
      <div data-slot="comment-form-actions" className="flex items-center gap-2">
        <Button
          type="submit"
          disabled={!content.trim() || isLoading}
          aria-label="Submit comment"
        >
          {isLoading ? "Submitting..." : "Comment"}
        </Button>
        {onAskAI && (
          <Button
            type="button"
            variant="outline"
            onClick={onAskAI}
            disabled={isLoading}
            aria-label="Ask AI for suggestions"
          >
            Ask AI
          </Button>
        )}
      </div>
    </form>
  )
}

export { CommentForm }
