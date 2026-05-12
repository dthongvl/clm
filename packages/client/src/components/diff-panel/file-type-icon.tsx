import { useEffect, useMemo } from "react"
import {
  createFileTreeIconResolver,
  getBuiltInFileIconColor,
  getBuiltInSpriteSheet,
} from "@pierre/trees"
import { cn } from "@/lib/utils"

const ICON_SET = "complete" as const
const SPRITE_ELEMENT_ID = "pierre-trees-file-icon-sprite"

const iconResolver = createFileTreeIconResolver({
  set: ICON_SET,
  colored: true,
})

/**
 * Inject Pierre's built-in file-icon sprite sheet into <body> exactly once.
 * The sprite contains <symbol id="file-tree-builtin-{token}"> definitions
 * that are referenced via <use href="#..."/> by FileTypeIcon.
 */
function ensureSpriteInjected() {
  if (typeof document === "undefined") return
  if (document.getElementById(SPRITE_ELEMENT_ID)) return
  const sheet = getBuiltInSpriteSheet(ICON_SET)
  const container = document.createElement("div")
  container.id = SPRITE_ELEMENT_ID
  container.style.position = "absolute"
  container.style.width = "0"
  container.style.height = "0"
  container.style.overflow = "hidden"
  container.setAttribute("aria-hidden", "true")
  container.innerHTML = sheet
  document.body.appendChild(container)
}

export interface FileTypeIconProps {
  filePath: string
  className?: string
}

/**
 * Render a colored file-type icon for `filePath`, using Pierre's built-in
 * icon set (the same icons shown in PRFileTree).
 */
export function FileTypeIcon({ filePath, className }: FileTypeIconProps) {
  useEffect(() => {
    ensureSpriteInjected()
  }, [])

  const { symbolId, color } = useMemo(() => {
    const resolved = iconResolver.resolveIcon("file-tree-icon-file", filePath)
    return {
      symbolId: resolved.name,
      color: resolved.token
        ? getBuiltInFileIconColor(resolved.token)
        : undefined,
    }
  }, [filePath])

  return (
    <svg
      aria-hidden="true"
      className={cn("size-4", className)}
      style={{ color, colorScheme: "light dark" }}
    >
      <use href={`#${symbolId}`} />
    </svg>
  )
}
