export interface RowProps {
  isExpanded: boolean
  onToggle: () => void
}

export function lastNonEmptyLine(text: string): string {
  if (!text) return ""
  const trimmed = text.replace(/\s+$/g, "")
  const idx = trimmed.lastIndexOf("\n")
  const line = (idx >= 0 ? trimmed.slice(idx + 1) : trimmed).trim()
  return truncate(line, 140)
}

export function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

export function asRecord(value: unknown): Record<string, unknown> | null {
  if (value == null || typeof value !== "object" || Array.isArray(value))
    return null
  return value as Record<string, unknown>
}
