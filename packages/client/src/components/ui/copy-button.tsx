import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Copy01Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { cn } from "@/lib/utils"

type CopyButtonSize = "xs" | "sm" | "default" | "lg"

const SIZE_MAP: Record<CopyButtonSize, { button: string; icon: string }> = {
  xs: { button: "size-6", icon: "size-3.5" },
  sm: { button: "size-8", icon: "size-4" },
  default: { button: "size-9", icon: "size-4" },
  lg: { button: "size-12", icon: "size-5" },
}

export interface CopyButtonProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    "children" | "disabled"
  > {
  /** Text to copy to the clipboard. */
  value: string
  /** Visual size of the button. */
  size?: CopyButtonSize
  /** Milliseconds the success state is shown. Defaults to 1500. */
  resetDelay?: number
  /** ARIA label when in idle state. Defaults to "Copy to clipboard". */
  label?: string
  /** ARIA label when in success state. Defaults to "Copied!". */
  copiedLabel?: string
}

/**
 * Animated copy-to-clipboard button.
 *
 * Cross-fades between the copy and tick icons using scale + opacity + blur,
 * so the two glyphs stay perfectly centered while one swaps for the other.
 */
const CopyButton = React.forwardRef<HTMLButtonElement, CopyButtonProps>(
  (
    {
      value,
      size = "xs",
      resetDelay = 1500,
      label = "Copy to clipboard",
      copiedLabel = "Copied!",
      className,
      onClick,
      ...props
    },
    ref
  ) => {
    const [copied, setCopied] = React.useState(false)
    const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

    React.useEffect(
      () => () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
      },
      []
    )

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation()
      navigator.clipboard.writeText(value).catch(() => {})
      setCopied(true)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => setCopied(false), resetDelay)
      onClick?.(event)
    }

    const { button: buttonSize, icon: iconSize } = SIZE_MAP[size]

    return (
      <button
        ref={ref}
        type="button"
        onClick={handleClick}
        aria-label={copied ? copiedLabel : label}
        title={copied ? copiedLabel : label}
        disabled={copied}
        className={cn(
          "relative inline-flex shrink-0 cursor-pointer items-center justify-center rounded-md transition-all duration-200 ease-out hover:bg-accent active:scale-[0.97] disabled:pointer-events-none disabled:opacity-100",
          buttonSize,
          className
        )}
        {...props}
      >
        {/* Tick: scales/blurs in when copied */}
        <span
          aria-hidden="true"
          className={cn(
            "absolute inline-flex transition-all duration-200 ease-out",
            copied
              ? "scale-100 opacity-100 blur-none"
              : "scale-75 opacity-0 blur-[2px]"
          )}
        >
          <HugeiconsIcon
            icon={Tick02Icon}
            className={cn(iconSize, "text-green-500")}
          />
        </span>
        {/* Copy: scales/blurs out when copied */}
        <span
          aria-hidden="true"
          className={cn(
            "absolute inline-flex transition-all duration-200 ease-out",
            copied
              ? "scale-0 opacity-0 blur-[2px]"
              : "scale-100 opacity-100 blur-none"
          )}
        >
          <HugeiconsIcon
            icon={Copy01Icon}
            className={cn(iconSize, "text-muted-foreground")}
          />
        </span>
      </button>
    )
  }
)

CopyButton.displayName = "CopyButton"

export { CopyButton }
