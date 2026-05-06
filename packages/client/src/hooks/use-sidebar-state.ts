import { usePersistedState } from './use-persisted-state'
import { StorageKeys } from '@/lib/storage'

/**
 * Persistent open/close state for the left and right sidebars.
 * Persistence lives behind this seam — consumers don't need to know
 * about storage keys or the persistence mechanism.
 */
export function useSidebarState() {
  const [leftOpen, setLeftOpen] = usePersistedState(
    StorageKeys.LEFT_SIDEBAR_OPEN,
    true
  )
  const [rightOpen, setRightOpen] = usePersistedState(
    StorageKeys.RIGHT_SIDEBAR_OPEN,
    true
  )

  return { leftOpen, rightOpen, setLeftOpen, setRightOpen }
}
