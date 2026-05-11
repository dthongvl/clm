import { useState, useCallback } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Route01Icon, Folder02Icon } from "@hugeicons/core-free-icons"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { getStorageItem, setStorageItem, StorageKeys } from "@/lib/storage"
import { ReviewGuide } from "@/components/side-panel/review-guide"
import { DiffPanelFileTree } from "@/components/diff-panel"

type LeftTabValue = "review-guide" | "file-tree"

export function LeftPanelContainer() {
  const [tab, setTab] = useState<LeftTabValue>(() =>
    getStorageItem<LeftTabValue>(StorageKeys.LEFT_PANEL_TAB, "review-guide")
  )

  const handleTabChange = useCallback((value: string) => {
    const newTab = value as LeftTabValue
    setTab(newTab)
    setStorageItem(StorageKeys.LEFT_PANEL_TAB, newTab)
  }, [])

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Tabs
        value={tab}
        onValueChange={handleTabChange}
        className="flex min-h-0 flex-1 flex-col"
      >
        <TabsList className="mx-2 mt-2 w-[calc(100%-1rem)]">
          <TabsTrigger value="review-guide">
            <HugeiconsIcon icon={Route01Icon} />
            Review Guide
          </TabsTrigger>
          <TabsTrigger value="file-tree">
            <HugeiconsIcon icon={Folder02Icon} />
            File Tree
          </TabsTrigger>
        </TabsList>
        <TabsContent
          value="review-guide"
          className="min-h-0 flex-1 overflow-hidden"
        >
          <ScrollArea className="h-full">
            <div className="p-4">
              <ReviewGuide.Root />
            </div>
          </ScrollArea>
        </TabsContent>
        <TabsContent
          value="file-tree"
          className="min-h-0 flex-1 overflow-hidden"
        >
          <DiffPanelFileTree className="h-full" />
        </TabsContent>
      </Tabs>
    </div>
  )
}
