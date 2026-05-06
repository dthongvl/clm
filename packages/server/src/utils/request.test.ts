import { describe, expect, it } from "bun:test"
import { normalizeAdditionalContext } from "./request.js"

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
