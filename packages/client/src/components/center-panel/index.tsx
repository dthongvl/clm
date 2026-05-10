import { useState, useCallback } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { InformationCircleIcon, GitCompareIcon } from "@hugeicons/core-free-icons"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { usePR, useAIReview, usePRContext } from "@/hooks"
import { PRDescriptionBody } from "@/components/side-panel/pr-description-body"
import { DiffPanelViewerContainer } from "@/components/diff-panel"
import { ErrorBoundary, ErrorFallback } from "@/components/error-boundary"
import { getStorageItem, setStorageItem, StorageKeys } from "@/lib/storage"

type CenterTabValue = "pr-info" | "diff-view"

export function CenterPanelContainer() {
  const { prNumber } = usePRContext()
  const { data: pr, isLoading: isPRLoading, error: prError } = usePR()
  const { items: aiReviewItems } = useAIReview()

  const [tab, setTab] = useState<CenterTabValue>(() =>
    getStorageItem<CenterTabValue>(StorageKeys.CENTER_PANEL_TAB, "diff-view")
  )

  const handleTabChange = useCallback((value: string) => {
    const newTab = value as CenterTabValue
    setTab(newTab)
    setStorageItem(StorageKeys.CENTER_PANEL_TAB, newTab)
  }, [])

  return (
    <ErrorBoundary
      resetKeys={[prNumber]}
      fallback={
        <ErrorFallback
          title="Failed to load content"
          description="There was an error loading the PR content."
          className="m-4"
        />
      }
    >
      <div className="flex h-full flex-col overflow-hidden pt-4">
        <Tabs
          value={tab}
          onValueChange={handleTabChange}
          className="flex min-h-0 flex-1 flex-col"
        >
          <TabsList className="ml-4">
            <TabsTrigger value="pr-info">
              <HugeiconsIcon icon={InformationCircleIcon} />
              Description
            </TabsTrigger>
            <TabsTrigger value="diff-view">
              <HugeiconsIcon icon={GitCompareIcon} />
              File changes
            </TabsTrigger>
          </TabsList>
          <TabsContent
            value="pr-info"
            className="min-h-0 flex-1 overflow-auto"
          >
            <div className="p-4">
              <PRDescriptionBody
                pr={pr}
                isLoading={isPRLoading}
                error={prError as Error | null}
              />
            </div>
          </TabsContent>
          <TabsContent
            value="diff-view"
            className="min-h-0 flex-1 overflow-hidden"
          >
            <DiffPanelViewerContainer aiReviewItems={aiReviewItems} />
          </TabsContent>
        </Tabs>
      </div>
    </ErrorBoundary>
  )
}
