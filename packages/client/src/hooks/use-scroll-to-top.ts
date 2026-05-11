import { useState, useCallback, useEffect, type RefObject } from "react"

/** Minimum scroll distance in pixels before showing scroll-to-top button */
const SCROLL_THRESHOLD = 300

/**
 * Find the scrollable viewport inside a container.
 * Supports ScrollArea (data-slot="scroll-area-viewport") and generic
 * scrollable elements (e.g. Virtualizer from @pierre/diffs).
 */
function findScrollViewport(container: HTMLElement): HTMLElement | null {
  // ScrollArea viewport (shadcn/ui)
  const scrollAreaViewport = container.querySelector<HTMLElement>(
    '[data-slot="scroll-area-viewport"]'
  )
  if (scrollAreaViewport) return scrollAreaViewport

  // Container itself may be the scrollable element
  const containerStyle = getComputedStyle(container)
  if (/(auto|scroll)/.test(containerStyle.overflowY)) return container

  // Look for a child with vertical scrolling (Virtualizer, etc.)
  for (const child of Array.from(container.children)) {
    const style = getComputedStyle(child)
    if (/(auto|scroll)/.test(style.overflowY)) return child as HTMLElement
  }

  return null
}

/**
 * Hook to track scroll position and provide scroll-to-top functionality.
 * Shows the scroll-to-top button when scrolled past the threshold.
 *
 * Works with both shadcn/ui ScrollArea and generic scroll containers
 * such as @pierre/diffs Virtualizer.
 *
 * @param containerRef - Ref to the container element that holds the scrollable viewport
 * @returns Object with showScrollTop state and scrollToTop function
 */
export function useScrollToTop(containerRef: RefObject<HTMLElement | null>) {
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const viewport = findScrollViewport(container)
    if (!viewport) return

    const handleScroll = () => {
      setShowScrollTop(viewport.scrollTop >= SCROLL_THRESHOLD)
      setIsScrolled(viewport.scrollTop > 4)
    }

    viewport.addEventListener("scroll", handleScroll, { passive: true })
    handleScroll()

    return () => viewport.removeEventListener("scroll", handleScroll)
  }, [containerRef])

  const scrollToTop = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const viewport = findScrollViewport(container)
    if (!viewport) return

    viewport.scrollTo({ top: 0, behavior: "smooth" })
  }, [containerRef])

  return { showScrollTop, isScrolled, scrollToTop }
}
