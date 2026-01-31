import { cn } from "@/lib/utils"

export type DiffPanelRootProps = React.ComponentProps<"section">

function Root({ className, ...props }: DiffPanelRootProps) {
  return (
    <section
      data-slot="diff-panel"
      className={cn("flex h-full flex-col overflow-hidden", className)}
      {...props}
    />
  )
}

export { Root }
