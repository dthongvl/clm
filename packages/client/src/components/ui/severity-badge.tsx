/* eslint-disable react-refresh/only-export-components */
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const severityBadgeVariants = cva(
  "inline-flex items-center justify-center rounded-md px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      severity: {
        critical: "bg-destructive/10 text-destructive",
        warning: "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-500",
        info: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-500",
      },
    },
    defaultVariants: {
      severity: "info",
    },
  }
)

function SeverityBadge({
  className,
  severity,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof severityBadgeVariants>) {
  return (
    <span
      data-slot="severity-badge"
      className={cn(severityBadgeVariants({ severity }), className)}
      {...props}
    />
  )
}

export { SeverityBadge, severityBadgeVariants }
