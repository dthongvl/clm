import * as React from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { HugeiconsIcon } from "@hugeicons/react"
import { CheckmarkCircle02Icon, Add01Icon } from "@hugeicons/core-free-icons"
import type { ThreadVariant, ThreadMessage as ThreadMessageType } from "@/types/thread"

import { CommentItem, type CommentItemProps } from "./comment-item"
import { CommentForm, type CommentFormProps } from "./comment-form"
import { ThreadMessage, type ThreadMessageProps } from "./thread-message"

// ============================================================================
// Context
// ============================================================================

interface CommentThreadContextValue {
  /** Thread variant */
  variant: ThreadVariant
  /** Whether the thread is resolved */
  resolved: boolean
  /** Toggle resolved state */
  onResolve?: () => void
  /** Submit a new message */
  onMessageSubmit: (content: string) => void
  /** Ask AI about the thread */
  onAskAI?: (content: string) => void
  /** Whether submission is in progress */
  isSubmitting: boolean
  /** Whether AI is processing */
  isAILoading: boolean
}

const CommentThreadContext = React.createContext<CommentThreadContextValue | null>(null)

function useCommentThread() {
  const context = React.useContext(CommentThreadContext)
  if (!context) {
    throw new Error("CommentThread components must be used within CommentThread.Root")
  }
  return context
}

// ============================================================================
// Root Component
// ============================================================================

const variantLabels: Record<ThreadVariant, string> = {
  github: "GitHub Comment",
  "ai-discussion": "AI Discussion",
  "ai-review": "AI Review",
}

/**
 * Props for the CommentThread.Root component.
 */
export interface CommentThreadRootProps extends React.ComponentProps<"article"> {
  /** Thread variant type */
  variant?: ThreadVariant
  /** Whether the thread is resolved */
  resolved?: boolean
  /** Callback to toggle resolved state */
  onResolve?: () => void
  /** Callback when submitting a new message */
  onMessageSubmit: (content: string) => void
  /** Callback when asking AI */
  onAskAI?: (content: string) => void
  /** Whether submission is in progress */
  isSubmitting?: boolean
  /** Whether AI is processing */
  isAILoading?: boolean
  /** Whether to show variant badge */
  showVariantBadge?: boolean
  children: React.ReactNode
}

/**
 * Root container for a comment thread.
 * Provides context for child components and handles thread-level state.
 *
 * @example
 * ```tsx
 * <CommentThread.Root
 *   variant="ai-review"
 *   onMessageSubmit={handleSubmit}
 *   onAskAI={handleAskAI}
 *   onResolve={() => setResolved(!resolved)}
 *   resolved={resolved}
 * >
 *   <CommentThread.Messages messages={messages} />
 *   <CommentThread.Form />
 * </CommentThread.Root>
 * ```
 */
function Root({
  variant = "github",
  resolved = false,
  onResolve,
  onMessageSubmit,
  onAskAI,
  isSubmitting = false,
  isAILoading = false,
  showVariantBadge = false,
  className,
  children,
  ...props
}: CommentThreadRootProps) {
  const contextValue = React.useMemo<CommentThreadContextValue>(
    () => ({
      variant,
      resolved,
      onResolve,
      onMessageSubmit,
      onAskAI,
      isSubmitting,
      isAILoading,
    }),
    [variant, resolved, onResolve, onMessageSubmit, onAskAI, isSubmitting, isAILoading]
  )

  return (
    <CommentThreadContext.Provider value={contextValue}>
      <article
        data-slot="comment-thread"
        data-variant={variant}
        data-resolved={resolved || undefined}
        aria-label={`${variantLabels[variant]} thread`}
        className={cn(
          "flex flex-col gap-3 rounded-lg border bg-card p-4",
          resolved && "opacity-75",
          className
        )}
        {...props}
      >
        {/* Header with variant badge and resolve button */}
        {(showVariantBadge || onResolve) && (
          <div
            data-slot="thread-header"
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              {showVariantBadge && (
                <Badge variant="outline" className="text-xs">
                  {variantLabels[variant]}
                </Badge>
              )}
              {resolved && (
                <Badge variant="secondary" className="text-xs">
                  <HugeiconsIcon
                    icon={CheckmarkCircle02Icon}
                    className="mr-1 size-3"
                    aria-hidden="true"
                  />
                  Resolved
                </Badge>
              )}
            </div>
            {onResolve && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onResolve}
                aria-pressed={resolved}
              >
                {resolved ? "Unresolve" : "Resolve"}
              </Button>
            )}
          </div>
        )}
        {children}
      </article>
    </CommentThreadContext.Provider>
  )
}

// ============================================================================
// Messages Component
// ============================================================================

export interface CommentThreadMessagesProps extends React.ComponentProps<"div"> {
  /** Messages to display */
  messages: ThreadMessageType[]
  /** Whether to use compact display */
  compact?: boolean
}

/**
 * Displays a list of messages in the thread.
 *
 * @example
 * ```tsx
 * <CommentThread.Messages
 *   messages={thread.messages}
 *   compact
 * />
 * ```
 */
function Messages({
  messages,
  compact = false,
  className,
  ...props
}: CommentThreadMessagesProps) {
  if (messages.length === 0) {
    return null
  }

  return (
    <div
      data-slot="thread-messages"
      className={cn("flex flex-col gap-3", className)}
      role="log"
      aria-label="Thread messages"
      {...props}
    >
      {messages.map((message) => (
        <ThreadMessage key={message.id} message={message} compact={compact} />
      ))}
    </div>
  )
}

// ============================================================================
// Form Component (Context-aware wrapper)
// ============================================================================

export interface CommentThreadFormProps extends Omit<CommentFormProps, "onSubmit" | "onAskAI" | "isLoading" | "isAILoading"> {
  /** Override the context's onSubmit */
  onSubmit?: (content: string) => void
}

/**
 * Comment form that automatically connects to thread context.
 * Can override handlers if needed.
 *
 * @example
 * ```tsx
 * // Uses context handlers
 * <CommentThread.Form placeholder="Reply..." />
 *
 * // Override handler
 * <CommentThread.Form onSubmit={customHandler} />
 * ```
 */
function Form({
  onSubmit: overrideSubmit,
  ...props
}: CommentThreadFormProps) {
  const { onMessageSubmit, onAskAI, isSubmitting, isAILoading, resolved } = useCommentThread()

  if (resolved) {
    return null
  }

  return (
    <CommentForm
      onSubmit={overrideSubmit ?? onMessageSubmit}
      onAskAI={onAskAI}
      isLoading={isSubmitting}
      isAILoading={isAILoading}
      {...props}
    />
  )
}

// ============================================================================
// NewThread Component (for starting new threads)
// ============================================================================

export interface NewThreadButtonProps extends React.ComponentProps<typeof Button> {
  /** Label text */
  label?: string
}

/**
 * Button to start a new thread.
 *
 * @example
 * ```tsx
 * <CommentThread.NewThreadButton onClick={() => setShowForm(true)} />
 * ```
 */
function NewThreadButton({
  label = "Start discussion",
  className,
  ...props
}: NewThreadButtonProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("gap-1", className)}
      {...props}
    >
      <HugeiconsIcon icon={Add01Icon} className="size-4" aria-hidden="true" />
      {label}
    </Button>
  )
}

// ============================================================================
// Exports
// ============================================================================

export const CommentThread = {
  Root,
  Messages,
  Message: ThreadMessage,
  Form,
  NewThreadButton,
  // Legacy exports for backward compatibility
  Item: CommentItem,
}

// Re-export types
export type {
  CommentItemProps,
  CommentFormProps,
  ThreadMessageProps,
}

// Export context hook for advanced usage
export { useCommentThread }
