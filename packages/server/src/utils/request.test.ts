import { describe, expect, it } from "bun:test"
import {
  normalizeAdditionalContext,
  normalizeReviewCategories,
  normalizeReviewRunMode,
  REVIEW_CATEGORIES,
} from "./request.js"

describe("normalizeAdditionalContext", () => {
  it("returns undefined for missing context", () => {
    const result = normalizeAdditionalContext(undefined)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBeUndefined()
    }
  })

  it("returns undefined for null context", () => {
    const result = normalizeAdditionalContext(null)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBeUndefined()
    }
  })

  it("returns undefined for whitespace-only string", () => {
    const result = normalizeAdditionalContext("   \t\n  ")
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBeUndefined()
    }
  })

  it("trims valid context", () => {
    const result = normalizeAdditionalContext("  focus auth edge cases  ")
    expect(result).toEqual({ ok: true, value: "focus auth edge cases" })
  })

  it("returns error for non-string value", () => {
    const result = normalizeAdditionalContext(123)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe("additionalContext must be a string")
    }
  })

  it("returns error for object value", () => {
    const result = normalizeAdditionalContext({ foo: "bar" })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe("additionalContext must be a string")
    }
  })

  it("returns error for string exceeding max length", () => {
    const longString = "a".repeat(2001)
    const result = normalizeAdditionalContext(longString)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe("additionalContext exceeds maximum length of 2000")
    }
  })

  it("accepts string at exactly max length", () => {
    const exactString = "a".repeat(2000)
    const result = normalizeAdditionalContext(exactString)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe(exactString)
    }
  })

  it("uses custom max length when provided", () => {
    const result = normalizeAdditionalContext("12345", 3)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe("additionalContext exceeds maximum length of 3")
    }
  })
})

describe("normalizeReviewCategories", () => {
  it("defaults to all categories when missing", () => {
    const result = normalizeReviewCategories(undefined)
    expect(result).toEqual({ ok: true, value: [...REVIEW_CATEGORIES] })
  })

  it("defaults to all categories when null", () => {
    const result = normalizeReviewCategories(null)
    expect(result).toEqual({ ok: true, value: [...REVIEW_CATEGORIES] })
  })

  it("accepts valid categories array", () => {
    const result = normalizeReviewCategories(["security", "performance"])
    expect(result).toEqual({ ok: true, value: ["security", "performance"] })
  })

  it("deduplicates and normalizes with whitespace/case", () => {
    const result = normalizeReviewCategories([" Security ", "SECURITY", "performance"])
    expect(result).toEqual({ ok: true, value: ["security", "performance"] })
  })

  it("rejects unknown category", () => {
    const result = normalizeReviewCategories(["security", "unknown-cat"])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe("Unknown review category: unknown-cat")
    }
  })

  it("rejects empty array", () => {
    const result = normalizeReviewCategories([])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe("reviewCategories must include at least one category")
    }
  })

  it("rejects non-array value", () => {
    const result = normalizeReviewCategories("security")
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe("reviewCategories must be an array of strings")
    }
  })

  it("filters out non-string values and rejects if none remain", () => {
    const result = normalizeReviewCategories([123, null, {}])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe("reviewCategories must include at least one category")
    }
  })
})

describe("normalizeReviewRunMode", () => {
  it("defaults to combined when missing", () => {
    const result = normalizeReviewRunMode(undefined)
    expect(result).toEqual({ ok: true, value: "combined" })
  })

  it("defaults to combined when null", () => {
    const result = normalizeReviewRunMode(null)
    expect(result).toEqual({ ok: true, value: "combined" })
  })

  it("accepts combined mode", () => {
    const result = normalizeReviewRunMode("combined")
    expect(result).toEqual({ ok: true, value: "combined" })
  })

  it("accepts separate mode", () => {
    const result = normalizeReviewRunMode("separate")
    expect(result).toEqual({ ok: true, value: "separate" })
  })

  it("rejects invalid run mode", () => {
    const result = normalizeReviewRunMode("fast")
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe("runMode must be 'combined' or 'separate'")
    }
  })

  it("rejects non-string value", () => {
    const result = normalizeReviewRunMode(123)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe("runMode must be 'combined' or 'separate'")
    }
  })
})
