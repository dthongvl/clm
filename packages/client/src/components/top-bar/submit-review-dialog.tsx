import { useState } from "react"
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

type ReviewEvent = "COMMENT" | "REQUEST_CHANGES" | "APPROVE"

interface SubmitReviewDialogProps {
  draftCount: number
  onSubmit: (event: ReviewEvent, body?: string) => Promise<void>
  disabled?: boolean
}

const EVENT_OPTIONS: { value: ReviewEvent; label: string; description: string }[] = [
  { value: "COMMENT", label: "Comment", description: "Submit general feedback without explicit approval." },
  { value: "REQUEST_CHANGES", label: "Request changes", description: "Submit feedback that must be addressed before merging." },
  { value: "APPROVE", label: "Approve", description: "Submit feedback and approve merging these changes." },
]

function SubmitReviewDialog({ draftCount, onSubmit, disabled }: SubmitReviewDialogProps) {
  const [open, setOpen] = useState(false)
  const [event, setEvent] = useState<ReviewEvent>("COMMENT")
  const [body, setBody] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    setIsSubmitting(true)
    try {
      await onSubmit(event, body.trim() || undefined)
      setOpen(false)
      setBody("")
      setEvent("COMMENT")
    } catch {
      // Error handled by caller (toast)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="default"
            size="sm"
            disabled={disabled || draftCount === 0}
          />
        }
      >
        Submit review{draftCount > 0 ? ` (${draftCount})` : ""}
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <PopoverHeader>
          <PopoverTitle>Submit review</PopoverTitle>
          <PopoverDescription>
            {draftCount} pending {draftCount === 1 ? "comment" : "comments"} will be submitted.
          </PopoverDescription>
        </PopoverHeader>
        <div className="flex flex-col gap-3">
          <Textarea
            placeholder="Leave a comment on this pull request (optional)"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            className="border-transparent bg-muted/50 focus-visible:border-input focus-visible:bg-transparent"
          />
          <fieldset className="flex flex-col gap-2">
            {EVENT_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 transition-colors ${
                  event === option.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <input
                  type="radio"
                  name="review-event"
                  value={option.value}
                  checked={event === option.value}
                  onChange={() => setEvent(option.value)}
                  className="mt-0.5 accent-primary"
                />
                <div>
                  <div className="text-xs font-medium">{option.label}</div>
                  <div className="text-xs text-muted-foreground">{option.description}</div>
                </div>
              </label>
            ))}
          </fieldset>
        </div>
        <div className="flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            size="sm"
          >
            {isSubmitting ? "Submitting..." : "Submit review"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export { SubmitReviewDialog }
export type { SubmitReviewDialogProps }
