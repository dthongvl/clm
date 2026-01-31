import * as React from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { HugeiconsIcon } from "@hugeicons/react"
import { SentIcon } from "@hugeicons/core-free-icons"

export interface ChatInputProps extends React.ComponentProps<"form"> {
  onSend?: (message: string) => void
  placeholder?: string
  isLoading?: boolean
}

function ChatInput({
  className,
  onSend,
  placeholder = "Type a message...",
  isLoading = false,
  ...props
}: ChatInputProps) {
  const [value, setValue] = React.useState("")
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = value.trim()
    if (trimmed && onSend && !isLoading) {
      onSend(trimmed)
      setValue("")
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <form
      data-slot="chat-input"
      className={cn("flex items-end gap-2", className)}
      onSubmit={handleSubmit}
      {...props}
    >
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={isLoading}
        className="min-h-10 max-h-32 flex-1 resize-none"
        rows={1}
      />
      <Button
        type="submit"
        size="icon"
        disabled={isLoading || !value.trim()}
        aria-label="Send message"
      >
        <HugeiconsIcon icon={SentIcon} strokeWidth={2} />
      </Button>
    </form>
  )
}

export { ChatInput }
