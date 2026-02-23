import { useRef, useCallback, useState } from 'react'
import type { DiffViewerRef } from '@/components/diff-panel'

export function useDiffNavigation() {
  const diffContainerRef = useRef<HTMLDivElement>(null)
  const diffViewerRef = useRef<DiffViewerRef>(null)
  const [selectedFilePath, setSelectedFilePath] = useState<string>()

  const scrollToFile = useCallback((filePath: string) => {
    const container = diffContainerRef.current
    if (!container) return

    const normalizedPath = filePath.replace(/^\/+/, "")
    const fileElement = container.querySelector(`[data-file-path="${CSS.escape(normalizedPath)}"]`)
    if (fileElement) {
      fileElement.scrollIntoView({ behavior: "instant", block: "start" })
    }
  }, [])

  const scrollToAnnotation = useCallback((filePath: string, lineNumber: number) => {
    const container = diffContainerRef.current
    if (!container) return

    const normalizedPath = filePath.replace(/^\/+/, "")
    diffViewerRef.current?.expandFile(normalizedPath)

    requestAnimationFrame(() => {
      const annotationElement = container.querySelector(
        `[data-file-path="${CSS.escape(normalizedPath)}"] [data-annotation-line="${lineNumber}"]`
      )
      if (annotationElement) {
        annotationElement.scrollIntoView({ behavior: "instant", block: "center" })
      } else {
        scrollToFile(normalizedPath)
      }
    })
  }, [scrollToFile])

  const handleFileTreeSelect = useCallback((filePath: string) => {
    setSelectedFilePath(filePath)
    scrollToFile(filePath)
  }, [scrollToFile])

  return {
    diffContainerRef,
    diffViewerRef,
    selectedFilePath,
    scrollToFile,
    scrollToAnnotation,
    handleFileTreeSelect,
  }
}
