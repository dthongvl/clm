import { useState } from "react"
import { TopBar } from "@/components/top-bar"
import { MainLayout } from "@/components/main-layout"
import { DiffPanel, type DiffFileData } from "@/components/diff-panel"
import { Button } from "@/components/ui/button"
import type { PRInfo } from "@/types/pr"
import type { DiffFile } from "@/types/diff"

const mockPR: PRInfo = {
  number: 42,
  title: "feat: Add AI-powered code review",
  author: { login: "octocat", avatarUrl: "https://github.com/octocat.png" },
  description: "This PR adds AI-powered code review functionality",
  baseBranch: "main",
  headBranch: "feature/ai-review",
  state: "open",
}

const mockFileTree: DiffFile[] = [
  {
    path: "src/components/review-panel.tsx",
    status: "added",
    additions: 142,
    deletions: 0,
    hunks: [],
  },
  {
    path: "src/lib/ai-client.ts",
    status: "added",
    additions: 89,
    deletions: 0,
    hunks: [],
  },
  {
    path: "src/hooks/use-review.ts",
    status: "modified",
    additions: 23,
    deletions: 8,
    hunks: [],
  },
  {
    path: "src/types/review.ts",
    status: "modified",
    additions: 15,
    deletions: 3,
    hunks: [],
  },
  {
    path: "src/legacy/old-review.ts",
    status: "deleted",
    additions: 0,
    deletions: 156,
    hunks: [],
  },
  {
    path: "src/utils/helpers.ts",
    oldPath: "src/lib/helpers.ts",
    status: "renamed",
    additions: 2,
    deletions: 1,
    hunks: [],
  },
]

const mockDiffFiles: DiffFileData[] = [
  {
    path: "src/components/review-panel.tsx",
    status: "added",
    additions: 5,
    deletions: 0,
    oldContent: "",
    newContent: `import React from 'react';

export function ReviewPanel() {
  return <div className="review-panel">Review Panel</div>;
}`,
  },
  {
    path: "src/hooks/use-review.ts",
    status: "modified",
    additions: 3,
    deletions: 2,
    oldContent: `import { useState } from 'react';

export function useReview() {
  const [reviews, setReviews] = useState([]);
  return { reviews };
}`,
    newContent: `import { useState, useCallback } from 'react';
import type { Review } from '../types';

export function useReview() {
  const [reviews, setReviews] = useState<Review[]>([]);
  
  const addReview = useCallback((review: Review) => {
    setReviews((prev) => [...prev, review]);
  }, []);

  return { reviews, addReview };
}`,
  },
  {
    path: "src/legacy/old-review.ts",
    status: "deleted",
    additions: 0,
    deletions: 3,
    oldContent: `// Legacy review module
export const legacyReview = () => {};
export default legacyReview;`,
    newContent: "",
  },
]

export function App() {
  const [selectedFile, setSelectedFile] = useState<string | undefined>()

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <TopBar.Root>
        <TopBar.PRInfo pr={mockPR} />
        <TopBar.Actions>
          <Button variant="outline" size="sm">
            Refresh
          </Button>
          <Button variant="outline" size="sm">
            Settings
          </Button>
        </TopBar.Actions>
      </TopBar.Root>

      <MainLayout
        leftPanel={
          <DiffPanel.Root>
            <DiffPanel.FileTree
              files={mockFileTree}
              selectedPath={selectedFile}
              onSelectFile={setSelectedFile}
            />
            <DiffPanel.Viewer
              files={mockDiffFiles}
              onLineClick={(path, line, side) => {
                console.log(`Clicked line ${line} (${side}) in ${path}`)
              }}
            />
          </DiffPanel.Root>
        }
        rightPanel={
          <div className="flex h-full flex-col gap-4 p-4">
            <h2 className="text-sm font-medium text-foreground">Side Panel</h2>
            <p className="text-xs text-muted-foreground">
              Phase 2 will add: AI Review Summary, Intelligent Grouping, and
              Comment Threads.
            </p>
          </div>
        }
      />
    </div>
  )
}

export default App
