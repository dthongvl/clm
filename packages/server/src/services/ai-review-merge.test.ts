import { describe, expect, it } from "bun:test"
import { buildFindingKey, mergeReviewItems } from "./ai-review-merge.js"
import type { AIReviewItem } from "../types/index.js"

describe("buildFindingKey", () => {
  it("normalizes file path to lowercase", () => {
    const key = buildFindingKey({
      filePath: "Src/Components/Button.tsx",
      lineNumber: 10,
      message: "Missing prop validation",
    })
    expect(key).toContain("src/components/button.tsx")
  })

  it("normalizes message to lowercase and trims whitespace", () => {
    const key1 = buildFindingKey({
      filePath: "src/a.ts",
      lineNumber: 10,
      message: "  Missing Input Validation  ",
    })
    const key2 = buildFindingKey({
      filePath: "src/a.ts",
      lineNumber: 10,
      message: "missing input validation",
    })
    expect(key1).toBe(key2)
  })

  it("collapses multiple spaces in message", () => {
    const key1 = buildFindingKey({
      filePath: "src/a.ts",
      lineNumber: 10,
      message: "Missing   input    validation",
    })
    const key2 = buildFindingKey({
      filePath: "src/a.ts",
      lineNumber: 10,
      message: "missing input validation",
    })
    expect(key1).toBe(key2)
  })

  it("includes line number in key", () => {
    const key1 = buildFindingKey({
      filePath: "src/a.ts",
      lineNumber: 10,
      message: "Issue",
    })
    const key2 = buildFindingKey({
      filePath: "src/a.ts",
      lineNumber: 20,
      message: "Issue",
    })
    expect(key1).not.toBe(key2)
  })
})

describe("mergeReviewItems", () => {
  it("merges duplicate findings and unions categories", () => {
    const items: AIReviewItem[] = [
      {
        id: "a",
        filePath: "src/a.ts",
        lineNumber: 10,
        severity: "warning",
        categories: ["security"],
        message: "Missing input validation",
      },
      {
        id: "b",
        filePath: "src/a.ts",
        lineNumber: 10,
        severity: "critical",
        categories: ["api-design"],
        message: "missing input validation",
      },
    ]

    const merged = mergeReviewItems(items)

    expect(merged).toHaveLength(1)
    expect(merged[0]?.severity).toBe("critical")
    expect(merged[0]?.categories.sort()).toEqual(["api-design", "security"])
  })

  it("escalates severity (critical > warning > info)", () => {
    const items: AIReviewItem[] = [
      {
        id: "1",
        filePath: "src/a.ts",
        lineNumber: 5,
        severity: "info",
        categories: ["code-quality"],
        message: "Issue A",
      },
      {
        id: "2",
        filePath: "src/a.ts",
        lineNumber: 5,
        severity: "warning",
        categories: ["code-quality"],
        message: "Issue A",
      },
      {
        id: "3",
        filePath: "src/a.ts",
        lineNumber: 5,
        severity: "critical",
        categories: ["code-quality"],
        message: "Issue A",
      },
    ]

    const merged = mergeReviewItems(items)
    expect(merged).toHaveLength(1)
    expect(merged[0]?.severity).toBe("critical")
  })

  it("preserves non-empty suggestion from any duplicate", () => {
    const items: AIReviewItem[] = [
      {
        id: "1",
        filePath: "src/a.ts",
        lineNumber: 10,
        severity: "warning",
        categories: ["security"],
        message: "Issue",
        suggestion: undefined,
      },
      {
        id: "2",
        filePath: "src/a.ts",
        lineNumber: 10,
        severity: "warning",
        categories: ["security"],
        message: "Issue",
        suggestion: "Add validation here",
      },
    ]

    const merged = mergeReviewItems(items)
    expect(merged).toHaveLength(1)
    expect(merged[0]?.suggestion).toBe("Add validation here")
  })

  it("generates stable IDs after merge", () => {
    const items: AIReviewItem[] = [
      {
        id: "random-id-1",
        filePath: "src/b.ts",
        lineNumber: 20,
        severity: "info",
        categories: ["testing"],
        message: "Missing test",
      },
      {
        id: "random-id-2",
        filePath: "src/a.ts",
        lineNumber: 10,
        severity: "warning",
        categories: ["security"],
        message: "Issue",
      },
    ]

    const merged = mergeReviewItems(items)
    expect(merged).toHaveLength(2)
    expect(merged[0]?.id).toBe("ai-review-1")
    expect(merged[1]?.id).toBe("ai-review-2")
  })

  it("maintains first-seen key order for deterministic output", () => {
    const items: AIReviewItem[] = [
      {
        id: "1",
        filePath: "src/c.ts",
        lineNumber: 30,
        severity: "info",
        categories: ["testing"],
        message: "Third issue",
      },
      {
        id: "2",
        filePath: "src/a.ts",
        lineNumber: 10,
        severity: "warning",
        categories: ["security"],
        message: "First issue",
      },
      {
        id: "3",
        filePath: "src/b.ts",
        lineNumber: 20,
        severity: "warning",
        categories: ["performance"],
        message: "Second issue",
      },
    ]

    const merged = mergeReviewItems(items)
    expect(merged).toHaveLength(3)
    // Order should match first-seen order
    expect(merged[0]?.message).toBe("Third issue")
    expect(merged[1]?.message).toBe("First issue")
    expect(merged[2]?.message).toBe("Second issue")
  })

  it("deduplicates categories within merged item", () => {
    const items: AIReviewItem[] = [
      {
        id: "1",
        filePath: "src/a.ts",
        lineNumber: 10,
        severity: "warning",
        categories: ["security", "api-design"],
        message: "Issue",
      },
      {
        id: "2",
        filePath: "src/a.ts",
        lineNumber: 10,
        severity: "warning",
        categories: ["security", "performance"],
        message: "Issue",
      },
    ]

    const merged = mergeReviewItems(items)
    expect(merged).toHaveLength(1)
    expect(merged[0]?.categories.sort()).toEqual(["api-design", "performance", "security"])
  })

  it("returns empty array for empty input", () => {
    const merged = mergeReviewItems([])
    expect(merged).toEqual([])
  })

  it("handles single item without modification except ID", () => {
    const items: AIReviewItem[] = [
      {
        id: "original-id",
        filePath: "src/a.ts",
        lineNumber: 10,
        severity: "warning",
        categories: ["security"],
        message: "Issue",
        suggestion: "Fix it",
      },
    ]

    const merged = mergeReviewItems(items)
    expect(merged).toHaveLength(1)
    expect(merged[0]).toEqual({
      id: "ai-review-1",
      filePath: "src/a.ts",
      lineNumber: 10,
      severity: "warning",
      categories: ["security"],
      message: "Issue",
      suggestion: "Fix it",
    })
  })
})
