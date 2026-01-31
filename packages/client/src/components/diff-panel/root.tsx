import { forwardRef } from "react"
import { cn } from "@/lib/utils"

export type DiffPanelRootProps = React.ComponentProps<"div">

const Root = forwardRef<HTMLDivElement, DiffPanelRootProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        data-slot="diff-panel"
        className={cn("flex h-full flex-col overflow-hidden", className)}
        {...props}
      />
    )
  }
)

Root.displayName = "DiffPanelRoot"

export { Root }
