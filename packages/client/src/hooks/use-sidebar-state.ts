import { usePersistedState } from './use-persisted-state'
import { StorageKeys } from '@/lib/storage'

/**
 * Persistent open/close state for the right sidebar.
 * Persistence lives behind this seam — consumers don't need to know
 * about storage keys or the persistence mechanism.
 */
export function useSidebarState() {
  const [rightOpen, setRightOpen] = usePersistedState(
    StorageKeys.RIGHT_SIDEBAR_OPEN,
    true
  )

  return { rightOpen, setRightOpen }
}
