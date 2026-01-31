import { Streamdown, type StreamdownProps } from "streamdown"
import { code } from "@streamdown/code"
import { mermaid } from "@streamdown/mermaid"
import { cjk } from "@streamdown/cjk"
import { cn } from "@/lib/utils"

export interface MarkdownProps extends Omit<StreamdownProps, "plugins"> {
  className?: string
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
        {...props}
      >
        {children}
      </Streamdown>
    </div>
  )
}
