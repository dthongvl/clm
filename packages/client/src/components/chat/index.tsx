/* eslint-disable react-refresh/only-export-components */
"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Cancel01Icon,
  Add01Icon,
  ArrowUp01Icon,
  File01Icon,
  Settings02Icon,
  SparklesIcon,
} from "@hugeicons/core-free-icons"

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
  extends Omit<React.ComponentProps<"button">, "children"> {
  children?: React.ReactNode
  placeholder?: string
}

function Trigger({
  className,
  children,
  placeholder = "Ask Lily anything about this PR",
  ...props
}: ChatPopupTriggerProps) {
  return (
    <DialogPrimitive.Trigger
      data-slot="chat-popup-trigger"
      render={
        <button
          className={cn(
            "fixed bottom-6 left-1/2 z-40 flex h-12 w-[36rem] -translate-x-1/2 items-center justify-between gap-3 rounded-full border border-neutral-700 bg-neutral-800/90 px-5 shadow-lg backdrop-blur-sm transition-colors hover:border-neutral-600 hover:bg-neutral-800",
            className
          )}
          aria-label="Open chat"
          {...props}
        />
      }
    >
      {children ?? (
        <>
          <span className="text-sm text-neutral-400">{placeholder}</span>
          <span className="flex size-8 items-center justify-center rounded-full border border-neutral-600 text-neutral-400">
            <HugeiconsIcon icon={ArrowUp01Icon} strokeWidth={2} size={16} />
          </span>
        </>
      )}
    </DialogPrimitive.Trigger>
  )
}

export interface ChatPopupContentProps extends DialogPrimitive.Popup.Props {
  children: React.ReactNode
  showCloseButton?: boolean
  title?: string
  icon?: React.ReactNode
}

function Content({
  className,
  children,
  showCloseButton = true,
  title = "Lily",
  icon,
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
          "bg-[#1a1a1a] ring-neutral-700/50 data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:slide-out-to-bottom-4 data-open:slide-in-from-bottom-4 fixed bottom-6 left-1/2 z-50 flex h-[32rem] w-[36rem] -translate-x-1/2 flex-col overflow-hidden rounded-lg ring-1 shadow-2xl duration-200 outline-none",
          className
        )}
        {...props}
      >
        <div
          data-slot="chat-popup-header"
          className="border-neutral-700/50 flex items-center justify-between border-b px-4 py-3"
        >
          <div className="flex items-center gap-2">
            {icon ?? (
              <div className="flex size-6 items-center justify-center">
                <HugeiconsIcon
                  icon={SparklesIcon}
                  strokeWidth={2}
                  className="size-5 text-cyan-400"
                />
              </div>
            )}
            <DialogPrimitive.Title
              data-slot="chat-popup-title"
              className="text-sm font-medium text-white"
            >
              {title}
            </DialogPrimitive.Title>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="New chat"
              className="text-neutral-400 hover:text-white"
            >
              <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
            </Button>
            {showCloseButton && (
              <DialogPrimitive.Close
                data-slot="chat-popup-close"
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Close chat"
                    className="text-neutral-400 hover:text-white"
                  />
                }
              >
                <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
              </DialogPrimitive.Close>
            )}
          </div>
        </div>
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  )
}

export interface ChatPopupMessagesProps extends React.ComponentProps<"div"> {
  children: React.ReactNode
}

function Messages({ className, children, ...props }: ChatPopupMessagesProps) {
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
      className={cn(
        "flex flex-1 flex-col gap-2 overflow-y-auto p-4",
        className
      )}
      {...props}
    >
      {children}
      <div ref={messagesEndRef} />
    </div>
  )
}

export interface ChatPopupWelcomeProps extends React.ComponentProps<"div"> {
  title?: string
  message?: string
}

function Welcome({
  className,
  message = "Hey! I'm Lily. I've reviewed this PR and I'm ready to help. Ask me anything about the changes, potential issues, or how the code works.",
  ...props
}: ChatPopupWelcomeProps) {
  return (
    <div
      data-slot="chat-popup-welcome"
      className={cn("px-6 py-4 text-sm text-neutral-300", className)}
      {...props}
    >
      {message}
    </div>
  )
}

export interface SuggestedPromptProps extends React.ComponentProps<"button"> {
  icon?: React.ReactNode
  label: string
}

function SuggestedPrompt({
  className,
  icon,
  label,
  ...props
}: SuggestedPromptProps) {
  return (
    <button
      data-slot="chat-suggested-prompt"
      className={cn(
        "flex w-full items-center gap-3 rounded px-3 py-2 text-left text-sm text-neutral-300 transition-colors hover:bg-neutral-800",
        className
      )}
      {...props}
    >
      {icon && (
        <span className="text-neutral-500">
          {icon}
        </span>
      )}
      <span>{label}</span>
    </button>
  )
}

export interface ChatPopupSuggestionsProps extends React.ComponentProps<"div"> {
  title?: string
  prompts?: Array<{
    icon?: React.ReactNode
    label: string
    onClick?: () => void
  }>
}

function Suggestions({
  className,
  title = "Suggested prompts",
  prompts = [
    {
      icon: <HugeiconsIcon icon={File01Icon} strokeWidth={2} size={16} />,
      label: "Summarize changes",
    },
    {
      icon: <HugeiconsIcon icon={Settings02Icon} strokeWidth={2} size={16} />,
      label: "Find potential issues",
    },
    {
      icon: <HugeiconsIcon icon={SparklesIcon} strokeWidth={2} size={16} />,
      label: "Explain architecture",
    },
  ],
  ...props
}: ChatPopupSuggestionsProps) {
  return (
    <div
      data-slot="chat-popup-suggestions"
      className={cn("flex flex-col gap-1 px-3 py-4", className)}
      {...props}
    >
      <span className="px-3 pb-2 text-xs font-medium text-neutral-500">
        {title}
      </span>
      {prompts.map((prompt, index) => (
        <SuggestedPrompt
          key={index}
          icon={prompt.icon}
          label={prompt.label}
          onClick={prompt.onClick}
        />
      ))}
    </div>
  )
}

export type ChatPopupInputProps = ChatInputProps

function Input({ className, ...props }: ChatPopupInputProps) {
  return (
    <div
      data-slot="chat-popup-input-container"
      className={cn("border-neutral-700/50 border-t p-4", className)}
    >
      <ChatInput {...props} />
    </div>
  )
}

export interface ChatPopupInputFieldProps
  extends React.ComponentProps<"input"> {
  onSend?: (message: string) => void
}

function InputField({
  className,
  placeholder = "Ask Lily anything about this PR",
  onSend,
  ...props
}: ChatPopupInputFieldProps) {
  const [value, setValue] = React.useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = value.trim()
    if (trimmed && onSend) {
      onSend(trimmed)
      setValue("")
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <form
      data-slot="chat-popup-input-field"
      className="border-neutral-700/50 border-t p-4"
      onSubmit={handleSubmit}
    >
      <div className="flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            "flex-1 bg-transparent text-sm text-white placeholder:text-neutral-500 focus:outline-none",
            className
          )}
          {...props}
        />
        <button
          type="submit"
          disabled={!value.trim()}
          className="flex size-7 items-center justify-center rounded-full border border-neutral-600 text-neutral-400 transition-colors hover:border-neutral-500 hover:text-white disabled:opacity-50"
          aria-label="Send message"
        >
          <HugeiconsIcon icon={ArrowUp01Icon} strokeWidth={2} size={16} />
        </button>
      </div>
    </form>
  )
}

export const ChatPopup = {
  Root,
  Trigger,
  Content,
  Messages,
  Welcome,
  Suggestions,
  Input,
  InputField,
  Message: ChatMessage,
}

export type { ChatMessageProps, ChatInputProps }
