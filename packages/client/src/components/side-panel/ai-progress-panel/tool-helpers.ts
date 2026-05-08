import { asRecord, truncate } from "./utils"
import type { StreamActivity } from "@/hooks/use-ai-review"

export function filenameBadge(toolName: string, input: unknown): string | null {
  const obj = asRecord(input)
  if (!obj) return null
  const filePath =
    typeof obj.file_path === "string"
      ? obj.file_path
      : typeof obj.path === "string"
        ? obj.path
        : null
  if (!filePath) return null
  // Only show filename badge for file-y tools.
  const isFileTool =
    toolName === "Read" ||
    toolName === "Edit" ||
    toolName === "Write" ||
    toolName === "Glob" ||
    toolName === "MultiEdit"
  if (!isFileTool) return null
  return filePath.split("/").pop() ?? null
}

export function formatToolInput(toolName: string, input: unknown): string {
  let obj = asRecord(input)

  // If input is a JSON string, try to parse it first.
  if (obj == null && typeof input === "string") {
    try {
      const parsed = JSON.parse(input)
      obj = asRecord(parsed)
    } catch {
      // Not valid JSON — return the raw string (e.g., a plain text command)
      return truncate(input, 120)
    }
  }

  if (obj == null) return ""

  const candidate =
    obj.command ??
    obj.query ??
    obj.pattern ??
    obj.url ??
    obj.description ??
    obj.file_path ??
    obj.path
  if (typeof candidate === "string") return truncate(candidate, 120)

  // Suppress JSON dump for file tools — filename is already shown as a badge.
  if (toolName === "Edit" || toolName === "Write" || toolName === "Read") {
    return ""
  }

  // For all other tools, don't dump raw JSON in the collapsed row.
  // The user can expand to see the full structured input.
  return ""
}

export function hasExpandableToolDetail(
  activity: Extract<StreamActivity, { kind: "tool" }>,
): boolean {
  if (activity.preview && activity.preview.length > 0) return true
  const obj = asRecord(activity.input)
  if (!obj)
    return typeof activity.input === "string" && activity.input.length > 0
  return Object.keys(obj).length > 0
}

export function formatInputAsJson(input: unknown): string {
  if (input == null) return ""
  if (typeof input === "string") return input
  try {
    return JSON.stringify(input, null, 2)
  } catch {
    return ""
  }
}

export interface DiffStats {
  additions: number
  deletions: number
}

/**
 * Compute line-based diff stats for Edit and Write tools.
 * For Edit: counts lines in new_string vs old_string.
 * For Write: counts lines in content (all additions).
 * Supports both Claude Code format and Codex format (changes array).
 */
export function computeDiffStats(
  toolName: string,
  input: unknown,
): DiffStats | null {
  const obj = asRecord(input)
  if (!obj) return null

  if (toolName === "Edit") {
    // Codex format: { changes: Array<{ path, kind, diff }> }
    if (Array.isArray(obj.changes)) {
      let additions = 0
      let deletions = 0
      for (const change of obj.changes as Array<{
        diff?: string
        old_string?: string
        new_string?: string
      }>) {
        if (change.diff) {
          const { add, del } = countDiffLines(change.diff)
          additions += add
          deletions += del
        } else if (typeof change.old_string === "string" && typeof change.new_string === "string") {
          additions += countLines(change.new_string)
          deletions += countLines(change.old_string)
        }
      }
      if (additions === 0 && deletions === 0) return null
      return { additions, deletions }
    }

    // Claude Code format: { old_string, new_string }
    const oldString = String(obj.old_string ?? "")
    const newString = String(obj.new_string ?? "")
    if (!oldString && !newString) return null
    return {
      additions: countLines(newString),
      deletions: countLines(oldString),
    }
  }

  if (toolName === "Write") {
    const content = String(obj.content ?? "")
    if (!content) return null
    return { additions: countLines(content), deletions: 0 }
  }

  return null
}

function countLines(text: string): number {
  if (!text) return 0
  // Count actual line breaks; if the text doesn't end with a newline,
  // the last line still counts.
  const newlineCount = (text.match(/\n/g) || []).length
  return newlineCount + 1
}

function countDiffLines(diff: string): { add: number; del: number } {
  const lines = diff.split("\n")
  let add = 0
  let del = 0
  for (const line of lines) {
    if (line.startsWith("+")) add++
    else if (line.startsWith("-")) del++
  }
  return { add, del }
}

// ============================================================================
// Rich Input / Output Formatting (inspired by craft-agents-oss)
// ============================================================================

/**
 * Format tool input for display in the expanded detail view.
 * Prefer CLI-style command preview when applicable, fall back to pretty JSON.
 */
export function formatToolInputDisplay(input: unknown): { type: 'cli' | 'json'; value: string } {
  const obj = asRecord(input)

  // If there's a command string, show it as a CLI command
  if (obj && typeof obj.command === "string" && obj.command.trim()) {
    return { type: 'cli', value: `$ ${obj.command.trim()}` }
  }

  // If there's a URL, show it directly
  if (obj && typeof obj.url === "string" && obj.url.trim()) {
    return { type: 'cli', value: obj.url.trim() }
  }

  // Pretty-print JSON input
  const json = formatInputAsJson(input)
  return { type: 'json', value: json }
}

/**
 * Unwrap MCP-style content wrapper:
 * {"content":[{"type":"text","text":"..."}]}
 * Returns the inner text content, or null if not an MCP wrapper.
 */
function unwrapMcpContent(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw)
    if (parsed.content && Array.isArray(parsed.content)) {
      const textParts = parsed.content
        .filter((c: { type?: string; text?: string }) => c.type === "text")
        .map((c: { text?: string }) => c.text)
        .join("")
      return textParts || null
    }
    // Also handle { "result": "..." } wrappers
    if (typeof parsed.result === "string") {
      return parsed.result
    }
  } catch {
    // not JSON
  }
  return null
}

/**
 * Check if text looks like markdown.
 */
export function looksLikeMarkdown(text: string): boolean {
  return (
    /^\s*#{1,6}\s/m.test(text) ||
    /\*\*|__|`{1,3}|\[.*?\]\(.*\)/.test(text) ||
    /^\s*[-*+]\s/m.test(text) ||
    /^\s*```/m.test(text) ||
    /^\s*\d+\.\s/m.test(text)
  )
}

/**
 * Format tool preview/output for display.
 * Unwraps MCP wrappers, pretty-prints JSON, detects markdown.
 */
export function formatToolPreview(raw: string): {
  value: string
  type: 'markdown' | 'json' | 'text'
} {
  if (!raw || !raw.trim()) {
    return { value: "", type: "text" }
  }

  // Try to unwrap MCP content wrapper
  const unwrapped = unwrapMcpContent(raw)
  const content = unwrapped ?? raw

  // Try to parse as JSON for pretty-printing
  const trimmed = content.trim()
  const maybeJson =
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))

  if (maybeJson) {
    try {
      const parsed = JSON.parse(trimmed)
      // If it parsed and looks like markdown inside, prefer markdown
      const pretty = JSON.stringify(parsed, null, 2)
      if (looksLikeMarkdown(pretty)) {
        return { value: pretty, type: "markdown" }
      }
      return { value: pretty, type: "json" }
    } catch {
      // Not valid JSON, continue
    }
  }

  // Check for markdown
  if (looksLikeMarkdown(content)) {
    return { value: content, type: "markdown" }
  }

  return { value: content, type: "text" }
}
