/* eslint-disable react-refresh/only-export-components */
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { Badge } from "./badge"

const severityBadgeVariants = cva("", {
  variants: {
    severity: {
      critical: "text-destructive",
      warning: "text-amber-700 dark:text-amber-500",
      info: "text-blue-700 dark:text-blue-500",
    },
    style: {
      filled: "",
      outline: "",
    },
  },
  compoundVariants: [
    { severity: "critical", style: "filled", className: "bg-destructive/10 border-transparent" },
    { severity: "warning", style: "filled", className: "bg-amber-100 dark:bg-amber-900/20 border-transparent" },
    { severity: "info", style: "filled", className: "bg-blue-100 dark:bg-blue-900/20 border-transparent" },
    { severity: "critical", style: "outline", className: "border-destructive/30" },
    { severity: "warning", style: "outline", className: "border-amber-500/30" },
    { severity: "info", style: "outline", className: "border-blue-500/30" },
  ],
  defaultVariants: {
    severity: "info",
    style: "filled",
  },
})

const dotVariants = cva("size-1.5 rounded-full", {
  variants: {
    severity: {
      critical: "bg-destructive",
      warning: "bg-amber-500",
      info: "bg-blue-500",
    },
  },
  defaultVariants: {
    severity: "info",
  },
})

function SeverityBadge({
  className,
  severity,
  style,
  children,
  ...props
}: Omit<React.ComponentProps<typeof Badge>, "variant"> &
  VariantProps<typeof severityBadgeVariants>) {
  const isOutline = style === "outline"
  return (
    <Badge
      data-slot="severity-badge"
      variant={isOutline ? "outline" : "default"}
      className={cn(severityBadgeVariants({ severity, style }), className)}
      {...props}
    >
      {isOutline && <span className={cn(dotVariants({ severity }))} />}
      {children}
    </Badge>
  )
}

export { SeverityBadge, severityBadgeVariants }
