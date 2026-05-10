import { HugeiconsIcon } from '@hugeicons/react'
import {
  AlertCircleIcon,
  Refresh01Icon,
  Settings02Icon,
} from '@hugeicons/core-free-icons'

import { usePR, useAnnotations } from '@/hooks'
import { useRefresh } from '@/hooks/use-refresh'
import { TopBar } from '@/components/top-bar'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ModeToggle } from '@/components/mode-toggle'

/**
 * Container for the top bar — owns PR info, refresh, and draft review submission.
 *
 * Draft count and submit come from useAnnotations (TanStack Query cache,
 * safe to co-instantiate with DiffPanelViewer).
 */
export function TopBarContainer() {
  const { data: pr, isLoading: isPRLoading, error: prError } = usePR()
  const { isRefreshing, handleRefresh } = useRefresh()
  const { draftCount, submitReview } = useAnnotations()

  return (
    <TopBar.Root>
      {/* Left: PR identity. min-w-0 lets the title truncate instead of pushing actions offscreen. */}
      <div className="flex min-w-0 flex-1 items-center">
        {isPRLoading ? (
          <PRInfoSkeleton />
        ) : prError && !pr ? (
          <PRInfoError
            message={prError.message}
            onRetry={handleRefresh}
            isRetrying={isRefreshing}
          />
        ) : pr ? (
          <TopBar.PRInfo pr={pr} className="min-w-0" />
        ) : null}
      </div>

      {/* Right: actions, ordered primary → utility → preference. */}
      <TopBar.Actions>
        <TopBar.SubmitReviewDialog
          draftCount={draftCount}
          onSubmit={submitReview}
          disabled={isPRLoading || !!prError}
        />

        <Separator orientation="vertical" className="mx-1 !h-5" />

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="outline"
                size="icon-sm"
                onClick={handleRefresh}
                disabled={isRefreshing || isPRLoading}
                aria-label="Refresh PR"
              >
                {isRefreshing ? (
                  <Spinner className="size-3" />
                ) : (
                  <HugeiconsIcon icon={Refresh01Icon} />
                )}
              </Button>
            }
          />
          <TooltipContent>
            {isRefreshing ? 'Fetching branches…' : 'Refresh PR'}
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Settings"
                disabled
              >
                <HugeiconsIcon icon={Settings02Icon} />
              </Button>
            }
          />
          <TooltipContent>Settings (coming soon)</TooltipContent>
        </Tooltip>

        <ModeToggle />
      </TopBar.Actions>
    </TopBar.Root>
  )
}

/**
 * Shape-matched skeleton for `<TopBar.PRInfo>` so the bar doesn't visibly
 * reflow when PR data lands.
 */
function PRInfoSkeleton() {
  return (
    <div
      className="flex items-center gap-3"
      role="status"
      aria-label="Loading PR info"
    >
      <Skeleton className="h-4 w-10" />
      <Skeleton className="h-4 w-56" />
      <Skeleton className="h-5 w-12 rounded-full" />
      <Skeleton className="size-5 rounded-full" />
      <Skeleton className="h-4 w-20" />
    </div>
  )
}

function PRInfoError({
  message,
  onRetry,
  isRetrying,
}: {
  message: string
  onRetry: () => void
  isRetrying: boolean
}) {
  return (
    <div
      className="flex min-w-0 items-center gap-2"
      role="alert"
    >
      <HugeiconsIcon
        icon={AlertCircleIcon}
        className="size-4 shrink-0 text-destructive"
      />
      <span className="shrink-0 text-sm font-medium text-destructive">
        Failed to load PR
      </span>
      <span
        className="min-w-0 truncate text-xs text-muted-foreground"
        title={message}
      >
        {message}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={onRetry}
        disabled={isRetrying}
        className="shrink-0"
      >
        {isRetrying ? <Spinner className="size-3" /> : 'Retry'}
      </Button>
    </div>
  )
}
