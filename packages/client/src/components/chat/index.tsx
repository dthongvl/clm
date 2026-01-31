"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { Cancel01Icon, Message01Icon } from "@hugeicons/core-free-icons"

import { ChatMessage, type ChatMessageProps } from "./message"
import { ChatInput, type ChatInputProps } from "./input"

export interface ChatPopupRootProps extends DialogPrimitive.Root.Props {
  children: React.ReactNode
}

function Root({ children, ...props }: ChatPopupRootProps) {
  return (
    <DialogPrimitive.Root data-slot="chat-popup" {...props}>
      {children}
    </DialogPrimitive.Root>
  )
}

export interface ChatPopupTriggerProps
  extends Omit<React.ComponentProps<typeof Button>, "children"> {
  children?: React.ReactNode
}

function Trigger({ className, children, ...props }: ChatPopupTriggerProps) {
  return (
    <DialogPrimitive.Trigger
      data-slot="chat-popup-trigger"
      render={
        <Button
          variant="default"
          size="icon-lg"
          className={cn(
            "fixed right-6 bottom-6 z-40 rounded-full shadow-lg",
            className
          )}
          aria-label="Open chat"
          {...props}
        />
      }
    >
      {children ?? <HugeiconsIcon icon={Message01Icon} strokeWidth={2} />}
    </DialogPrimitive.Trigger>
  )
}

export interface ChatPopupContentProps extends DialogPrimitive.Popup.Props {
  children: React.ReactNode
  showCloseButton?: boolean
  title?: string
}

function Content({
  className,
  children,
  showCloseButton = true,
  title = "Chat",
  ...props
}: ChatPopupContentProps) {
  return (
    <DialogPrimitive.Portal data-slot="chat-popup-portal">
      <DialogPrimitive.Popup
        data-slot="chat-popup-content"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "bg-background ring-foreground/10 data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:slide-out-to-bottom-4 data-open:slide-in-from-bottom-4 fixed right-6 bottom-20 z-50 flex h-[28rem] w-80 flex-col overflow-hidden rounded-none ring-1 shadow-xl duration-200 outline-none",
          className
        )}
        {...props}
      >
        <div
          data-slot="chat-popup-header"
          className="border-border flex items-center justify-between border-b px-4 py-3"
        >
          <DialogPrimitive.Title
            data-slot="chat-popup-title"
            className="text-sm font-medium"
          >
            {title}
          </DialogPrimitive.Title>
          {showCloseButton && (
            <DialogPrimitive.Close
              data-slot="chat-popup-close"
              render={
                <Button variant="ghost" size="icon-sm" aria-label="Close chat" />
              }
            >
              <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
            </DialogPrimitive.Close>
          )}
        </div>
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  )
}

export interface ChatPopupMessagesProps extends React.ComponentProps<"div"> {
  children: React.ReactNode
}

function Messages({
  className,
  children,
  ...props
}: ChatPopupMessagesProps) {
  const messagesEndRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [children])

  return (
    <div
      data-slot="chat-popup-messages"
      role="log"
      aria-live="polite"
      aria-label="Chat messages"
      className={cn("flex flex-1 flex-col gap-2 overflow-y-auto p-4", className)}
      {...props}
    >
      {children}
      <div ref={messagesEndRef} />
    </div>
  )
}

export type ChatPopupInputProps = ChatInputProps

function Input({ className, ...props }: ChatPopupInputProps) {
  return (
    <div
      data-slot="chat-popup-input-container"
      className={cn("border-border border-t p-4", className)}
    >
      <ChatInput {...props} />
    </div>
  )
}

export const ChatPopup = {
  Root,
  Trigger,
  Content,
  Messages,
  Input,
  Message: ChatMessage,
}

export type { ChatMessageProps, ChatInputProps }
