import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

export type LoadingOverlayProps = React.ComponentProps<"div"> & {
  isLoading?: boolean
  children: React.ReactNode
}

export function LoadingOverlay({
  isLoading,
  children,
  className,
  ...props
}: LoadingOverlayProps) {
  return (
    <div
      data-slot="loading-overlay"
      className={cn("relative", className)}
      {...props}
    >
      {children}
      {isLoading && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          aria-busy="true"
          aria-live="polite"
        >
          <Spinner className="size-8" />
        </div>
      )}
    </div>
  )
}

export type DiffPanelSkeletonProps = React.ComponentProps<"div">

export function DiffPanelSkeleton({ className, ...props }: DiffPanelSkeletonProps) {
  return (
    <div
      data-slot="diff-panel-skeleton"
      className={cn("flex flex-col gap-4 p-4", className)}
      aria-label="Loading diff content"
      role="status"
      {...props}
    >
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-5" />
        <Skeleton className="h-4 w-48" />
        <Skeleton className="ml-auto h-4 w-16" />
      </div>
      <Skeleton className="h-px w-full" />
      {[75, 60, 85, 50, 70, 90, 55, 80].map((width, i) => (
        <div key={i} className="flex gap-2">
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4" style={{ width: `${width}%` }} />
        </div>
      ))}
      <Skeleton className="h-px w-full" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-5" />
        <Skeleton className="h-4 w-36" />
        <Skeleton className="ml-auto h-4 w-16" />
      </div>
      {[65, 55, 80, 45, 70].map((width, i) => (
        <div key={i} className="flex gap-2">
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-4" style={{ width: `${width}%` }} />
        </div>
      ))}
    </div>
  )
}

export type SidePanelSkeletonProps = React.ComponentProps<"div">

export function SidePanelSkeleton({ className, ...props }: SidePanelSkeletonProps) {
  return (
    <div
      data-slot="side-panel-skeleton"
      className={cn("flex flex-col gap-4 p-4", className)}
      aria-label="Loading panel content"
      role="status"
      {...props}
    >
      <div className="flex gap-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-24" />
      </div>
      <Skeleton className="h-px w-full" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-2 rounded-lg border p-4">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-16" />
          </div>
        </div>
      ))}
    </div>
  )
}

export type ChatSkeletonProps = React.ComponentProps<"div">

export function ChatSkeleton({ className, ...props }: ChatSkeletonProps) {
  return (
    <div
      data-slot="chat-skeleton"
      className={cn("flex flex-col gap-4 p-4", className)}
      aria-label="Loading chat"
      role="status"
      {...props}
    >
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "flex gap-2",
            i % 2 === 0 ? "justify-end" : "justify-start"
          )}
        >
          <div
            className={cn(
              "max-w-[80%] space-y-2 rounded-lg p-3",
              i % 2 === 0 ? "bg-primary/10" : "bg-muted"
            )}
          >
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
      ))}
    </div>
  )
}

export type EmptyStateProps = React.ComponentProps<"div"> & {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-6 text-center",
        className
      )}
      {...props}
    >
      {icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  )
}
