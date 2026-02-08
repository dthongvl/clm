/* eslint-disable react-refresh/only-export-components */
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import type { RiskLevel } from "@/types/grouping"

const riskBadgeVariants = cva(
  "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-medium",
  {
    variants: {
      level: {
        high: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
        medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
        low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
      },
    },
    defaultVariants: {
      level: "medium",
    },
  }
)

interface RiskBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof riskBadgeVariants> {
  level: RiskLevel
}

const RISK_LABELS: Record<RiskLevel, string> = {
  high: "High Risk",
  medium: "Medium Risk", 
  low: "Low Risk",
}

function RiskBadge({ className, level, ...props }: RiskBadgeProps) {
  return (
    <span
      className={cn(riskBadgeVariants({ level }), className)}
      {...props}
    >
      {RISK_LABELS[level]}
    </span>
  )
}

export { RiskBadge, riskBadgeVariants }
