import { usePR, useAnnotations } from '@/hooks'
import { useRefresh } from '@/hooks/use-refresh'
import { TopBar } from '@/components/top-bar'
import { Button } from '@/components/ui/button'
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
      {isPRLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="animate-pulse">Loading PR info...</span>
        </div>
      ) : prError && !pr ? (
        <div className="flex items-center gap-2 text-destructive">
          <span>Failed to load PR: {prError.message}</span>
        </div>
      ) : pr ? (
        <TopBar.PRInfo pr={pr} />
      ) : null}
      <TopBar.Actions>
        <TopBar.SubmitReviewDialog
          draftCount={draftCount}
          onSubmit={submitReview}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing || isPRLoading}
        >
          {isRefreshing ? "Fetching branches..." : isPRLoading ? "Loading..." : "Refresh"}
        </Button>
        <Button variant="outline" size="sm">
          Settings
        </Button>
        <ModeToggle />
      </TopBar.Actions>
    </TopBar.Root>
  )
}
