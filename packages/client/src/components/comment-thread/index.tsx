import * as React from "react"

import { cn } from "@/lib/utils"

import { CommentItem, type CommentItemProps } from "./comment-item"
import { CommentForm, type CommentFormProps } from "./comment-form"

export interface CommentThreadRootProps extends React.ComponentProps<"article"> {
  children: React.ReactNode
}

function Root({ className, children, ...props }: CommentThreadRootProps) {
  return (
    <article
      data-slot="comment-thread"
      aria-label="Comment thread"
      className={cn("flex flex-col gap-4", className)}
      {...props}
    >
      {children}
    </article>
  )
}

export const CommentThread = {
  Root,
  Item: CommentItem,
  Form: CommentForm,
}

export type { CommentItemProps, CommentFormProps }
