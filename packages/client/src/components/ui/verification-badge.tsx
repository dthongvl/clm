/* eslint-disable react-refresh/only-export-components */
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { HugeiconsIcon } from "@hugeicons/react"
import { CheckmarkCircle01Icon, AlertCircleIcon, Cancel01Icon } from "@hugeicons/core-free-icons"

const verificationBadgeVariants = cva(
  "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-medium",
  {
    variants: {
      status: {
        verified: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
        incomplete: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
        warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
      },
    },
    defaultVariants: {
      status: "warning",
    },
  }
)

type VerificationStatus = 'verified' | 'incomplete' | 'warning';

interface VerificationBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof verificationBadgeVariants> {
  status: VerificationStatus;
}

const STATUS_CONFIG: Record<VerificationStatus, { label: string; icon: typeof CheckmarkCircle01Icon }> = {
  verified: { label: "Verified", icon: CheckmarkCircle01Icon },
  incomplete: { label: "Incomplete", icon: Cancel01Icon },
  warning: { label: "Needs Review", icon: AlertCircleIcon },
}

function VerificationBadge({ className, status, ...props }: VerificationBadgeProps) {
  const config = STATUS_CONFIG[status];
  
  return (
    <span
      className={cn(verificationBadgeVariants({ status }), className)}
      {...props}
    >
      <HugeiconsIcon icon={config.icon} className="h-3 w-3" />
      {config.label}
    </span>
  )
}

export { VerificationBadge, verificationBadgeVariants }
