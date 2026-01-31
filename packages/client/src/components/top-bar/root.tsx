import { cn } from "@/lib/utils"

export type TopBarRootProps = React.ComponentProps<"header">

export function Root({ className, ...props }: TopBarRootProps) {
  return (
    <header
      role="banner"
      data-slot="top-bar"
      className={cn(
        "flex w-full items-center justify-between border-b border-border bg-card px-4 py-2",
        className
      )}
      {...props}
    />
  )
}
