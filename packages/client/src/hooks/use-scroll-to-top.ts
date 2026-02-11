import { useState, useCallback, useEffect, type RefObject } from "react"

/** Minimum scroll distance in pixels before showing scroll-to-top button */
const SCROLL_THRESHOLD = 300

/**
 * Hook to track scroll position and provide scroll-to-top functionality.
 * Shows the scroll-to-top button when scrolled past the threshold.
 *
 * @param containerRef - Ref to the container element that contains the ScrollArea
 * @returns Object with showScrollTop state and scrollToTop function
 */
export function useScrollToTop(containerRef: RefObject<HTMLDivElement | null>) {
  const [showScrollTop, setShowScrollTop] = useState(false)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Find the scroll viewport inside the container
    const viewport = container.querySelector('[data-slot="scroll-area-viewport"]')
    if (!viewport) return

    const handleScroll = () => {
      setShowScrollTop(viewport.scrollTop >= SCROLL_THRESHOLD)
    }

    viewport.addEventListener("scroll", handleScroll, { passive: true })
    return () => viewport.removeEventListener("scroll", handleScroll)
  }, [containerRef])

  const scrollToTop = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const viewport = container.querySelector('[data-slot="scroll-area-viewport"]')
    if (!viewport) return

    viewport.scrollTo({ top: 0, behavior: "smooth" })
  }, [containerRef])

  return { showScrollTop, scrollToTop }
}
