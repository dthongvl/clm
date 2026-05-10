import { useMemo } from "react"
import { Streamdown, type StreamdownProps } from "streamdown"
import { code } from "@streamdown/code"
import { mermaid } from "@streamdown/mermaid"
import { cjk } from "@streamdown/cjk"
import { cn } from "@/lib/utils"

export interface MarkdownProps extends Omit<StreamdownProps, "plugins"> {
  className?: string
}

/**
 * Custom img component that:
 * 1. Strips the Referer header (prevents GitHub avatar blocking)
 * 2. Proxies GitHub user-attachment URLs through the server so private-repo
 *    images load from localhost (where cross-origin cookies are blocked).
 */
function MarkdownImg({
  node: _node,
  src,
  ...rest
}: React.ImgHTMLAttributes<HTMLImageElement> & { node?: unknown }) {
  const proxiedSrc = useMemo(() => {
    if (src?.startsWith("https://github.com/user-attachments/assets/")) {
      return `/api/proxy-image?url=${encodeURIComponent(src)}`
    }
    return src
  }, [src])

  return <img {...rest} src={proxiedSrc} referrerPolicy="no-referrer" />
}

/**
 * Pre-configured Markdown component using Streamdown with plugins:
 * - Code syntax highlighting (Shiki)
 * - Mermaid diagram support
 * - CJK language support
 */
export function Markdown({ children, className, ...props }: MarkdownProps) {
  return (
    <div className={cn("prose prose-sm dark:prose-invert max-w-none", className)}>
      <Streamdown
        plugins={{
          code,
          mermaid,
          cjk,
        }}
        components={{ img: MarkdownImg }}
        {...props}
      >
        {children}
      </Streamdown>
    </div>
  )
}
