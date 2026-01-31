import { cn } from "@/lib/utils"

export type TopBarActionsProps = React.ComponentProps<"div">

export function Actions({ className, ...props }: TopBarActionsProps) {
  return (
    <div
      data-slot="top-bar-actions"
      className={cn("flex items-center gap-2", className)}
      {...props}
    />
  )
}
