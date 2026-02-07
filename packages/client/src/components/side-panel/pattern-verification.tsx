import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { VerificationBadge } from "@/components/ui/verification-badge"
import { HugeiconsIcon } from "@hugeicons/react"
import { 
  CheckmarkSquare01Icon, 
  Loading03Icon, 
  AlertCircleIcon,
  ArrowRight01Icon
} from "@hugeicons/core-free-icons"
import type { PatternVerification, PatternVerificationResult } from "@/types/verification"
import { ActionSettingsPopover } from "./action-settings-popover"
import type { ModelOption } from "@/types/settings"

interface PatternVerificationPanelProps extends React.ComponentProps<"div"> {
  result: PatternVerificationResult | null;
  isLoading: boolean;
  error: Error | null;
  onVerify: () => void;
  onLocationClick?: (filePath: string, lineNumber: number) => void;
  models?: ModelOption[];
  currentModel?: string;
  onModelChange?: (model: string) => void;
}

function PatternVerificationPanel({
  className,
  result,
  isLoading,
  error,
  onVerify,
  onLocationClick,
  models,
  currentModel,
  onModelChange,
  ...props
}: PatternVerificationPanelProps) {
  const incompleteCount = result?.verifications.filter(v => v.status === 'incomplete').length || 0;

  return (
    <div
      data-slot="pattern-verification"
      className={cn("flex flex-col gap-3", className)}
      {...props}
    >
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onVerify}
          disabled={isLoading}
          className="flex-1"
        >
          <HugeiconsIcon
            icon={isLoading ? Loading03Icon : CheckmarkSquare01Icon}
            className={cn(isLoading && "animate-spin")}
            data-icon="inline-start"
          />
          {isLoading ? "Verifying..." : result ? "Re-verify Patterns" : "Verify Patterns"}
        </Button>
        {models && onModelChange && (
          <ActionSettingsPopover
            actionKey="pattern-verification"
            models={models}
            currentModel={currentModel}
            onModelChange={onModelChange}
          />
        )}
      </div>

      {error && (
        <div className="flex flex-col gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3">
          <div className="flex items-center gap-2 text-destructive">
            <HugeiconsIcon icon={AlertCircleIcon} className="h-4 w-4" />
            <span className="text-sm font-medium">Verification failed</span>
          </div>
          <p className="text-xs text-muted-foreground">{error.message}</p>
        </div>
      )}

      {isLoading && (
        <div className="flex flex-col gap-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-md border border-border bg-muted/50"
            />
          ))}
          <p className="text-center text-xs text-muted-foreground">
            AI is verifying pattern completeness...
          </p>
        </div>
      )}

      {!isLoading && result && (
        <>
          {result.summary && (
            <p className="text-xs text-muted-foreground">{result.summary}</p>
          )}

          {incompleteCount > 0 && (
            <div className="rounded-md border border-red-500/50 bg-red-500/10 p-2 text-xs text-red-600 dark:text-red-400">
              ⚠️ {incompleteCount} pattern{incompleteCount > 1 ? 's' : ''} may have missed updates
            </div>
          )}

          {result.verifications.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No patterns requiring verification were found.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {result.verifications.map((verification) => (
                <VerificationCard
                  key={verification.id}
                  verification={verification}
                  onLocationClick={onLocationClick}
                />
              ))}
            </div>
          )}
        </>
      )}

      {!isLoading && !result && !error && (
        <p className="text-sm text-muted-foreground">
          Click "Verify Patterns" to check if all related code locations were updated.
        </p>
      )}
    </div>
  )
}

interface VerificationCardProps {
  verification: PatternVerification;
  onLocationClick?: (filePath: string, lineNumber: number) => void;
}

function VerificationCard({ verification, onLocationClick }: VerificationCardProps) {
  const missingLocations = verification.locations.filter(l => l.status === 'missing');
  
  return (
    <Card size="sm">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm">{verification.pattern}</CardTitle>
          <VerificationBadge status={verification.status} />
        </div>
        {verification.description && (
          <p className="text-xs text-muted-foreground">{verification.description}</p>
        )}
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-2">{verification.details}</p>
        
        {missingLocations.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-red-600 dark:text-red-400">
              Missing updates:
            </p>
            <ul className="space-y-1">
              {missingLocations.map((loc, idx) => (
                <li key={idx} className="flex items-center gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => onLocationClick?.(loc.filePath, loc.lineNumber)}
                    className="flex items-center gap-1 font-mono text-muted-foreground hover:text-foreground hover:underline"
                  >
                    {loc.filePath}:{loc.lineNumber}
                    <HugeiconsIcon icon={ArrowRight01Icon} className="h-3 w-3" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export { PatternVerificationPanel }
