import { describe, expect, it } from "bun:test"
import { buildReviewPrompt, CATEGORY_INSTRUCTIONS } from "./ai-review-prompt.js"

describe("buildReviewPrompt", () => {
  it("includes only selected categories", () => {
    const prompt = buildReviewPrompt({
      prLink: "https://github.com/acme/repo/pull/12",
      categories: ["security", "performance"],
    })
    expect(prompt).toContain("Security focus")
    expect(prompt).toContain("Performance focus")
    expect(prompt).not.toContain("Accessibility focus")
    expect(prompt).not.toContain("Testing focus")
  })

  it("includes all categories when all selected", () => {
    const allCategories = Object.keys(CATEGORY_INSTRUCTIONS) as Array<keyof typeof CATEGORY_INSTRUCTIONS>
    const prompt = buildReviewPrompt({
      prLink: "https://github.com/acme/repo/pull/12",
      categories: allCategories,
    })
    expect(prompt).toContain("Security focus")
    expect(prompt).toContain("Performance focus")
    expect(prompt).toContain("Accessibility focus")
    expect(prompt).toContain("Testing focus")
    expect(prompt).toContain("Code-quality focus")
    expect(prompt).toContain("Coding-convention focus")
    expect(prompt).toContain("Architecture focus")
    expect(prompt).toContain("Api-design focus")
  })

  it("includes additional context block when present", () => {
    const prompt = buildReviewPrompt({
      prLink: "https://github.com/acme/repo/pull/12",
      categories: ["security"],
      additionalContext: "Focus on authentication edge cases",
    })
    expect(prompt).toContain("Focus on authentication edge cases")
    expect(prompt).toContain("User-provided additional context")
  })

  it("omits additional context block when not present", () => {
    const prompt = buildReviewPrompt({
      prLink: "https://github.com/acme/repo/pull/12",
      categories: ["security"],
    })
    expect(prompt).not.toContain("User-provided additional context")
  })

  it("keeps JSON output schema instructions", () => {
    const prompt = buildReviewPrompt({
      prLink: "https://github.com/acme/repo/pull/12",
      categories: ["security"],
    })
    expect(prompt).toContain('"categories"')
    expect(prompt).toContain('"severity"')
    expect(prompt).toContain('"filePath"')
    expect(prompt).toContain('"lineNumber"')
    expect(prompt).toContain('"message"')
    expect(prompt).toContain('"summary"')
  })

  it("extracts PR number and repo from link", () => {
    const prompt = buildReviewPrompt({
      prLink: "https://github.com/myorg/myrepo/pull/456",
      categories: ["security"],
    })
    expect(prompt).toContain("#456")
    expect(prompt).toContain("myorg/myrepo")
  })

  it("includes category scope label when provided", () => {
    const prompt = buildReviewPrompt({
      prLink: "https://github.com/acme/repo/pull/12",
      categories: ["security"],
      categoryScopeLabel: "security-only",
    })
    expect(prompt).toContain("security-only")
  })
})

describe("CATEGORY_INSTRUCTIONS", () => {
  it("has instructions for all 8 categories", () => {
    const expectedCategories = [
      "code-quality",
      "coding-convention",
      "security",
      "accessibility",
      "architecture",
      "api-design",
      "performance",
      "testing",
    ]
    
    for (const category of expectedCategories) {
      expect(CATEGORY_INSTRUCTIONS).toHaveProperty(category)
    }
    
    expect(Object.keys(CATEGORY_INSTRUCTIONS)).toHaveLength(8)
  })
})
