import { cn } from "@/lib/utils"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { ChangeGroup } from "@/types/grouping"

interface ChangeGroupCardProps extends React.ComponentProps<"button"> {
  group: ChangeGroup
}

function ChangeGroupCard({ className, group, ...props }: ChangeGroupCardProps) {
  return (
    <button
      data-slot="change-group-card"
      type="button"
      className={cn("w-full text-left", className)}
      aria-label={`View ${group.title} group with ${group.files.length} files`}
      {...props}
    >
      <Card size="sm" className="transition-colors hover:bg-muted/50">
        <CardHeader>
          <CardTitle>{group.title}</CardTitle>
          <CardDescription>{group.summary}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{group.files.length} {group.files.length === 1 ? "file" : "files"}</span>
            <div className="flex gap-2">
              <span className="text-green-600 dark:text-green-500">+{group.totalAdditions}</span>
              <span className="text-red-600 dark:text-red-500">-{group.totalDeletions}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </button>
  )
}

export { ChangeGroupCard }
