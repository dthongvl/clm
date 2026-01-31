import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const messageVariants = cva(
  "flex w-max max-w-[80%] flex-col gap-1 px-3 py-2 text-xs",
  {
    variants: {
      role: {
        user: "ml-auto bg-primary text-primary-foreground",
        assistant: "bg-muted text-foreground",
      },
    },
    defaultVariants: {
      role: "user",
    },
  }
)

export interface ChatMessageProps
  extends Omit<React.ComponentProps<"div">, "role">,
    VariantProps<typeof messageVariants> {
  content?: string
  children?: React.ReactNode
}

function ChatMessage({
  className,
  role = "user",
  content,
  children,
  ...props
}: ChatMessageProps) {
  return (
    <div
      data-slot="chat-message"
      data-role={role}
      className={cn(messageVariants({ role, className }))}
      {...props}
    >
      {children ?? content}
    </div>
  )
}

export { ChatMessage }
