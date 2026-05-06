import { describe, expect, it } from "bun:test"
import { buildReviewPrompt } from "./ai-review-prompt.js"

describe("buildReviewPrompt", () => {
  it("includes all focus areas", () => {
    const prompt = buildReviewPrompt({
      prLink: "https://github.com/acme/repo/pull/12",
    })
    expect(prompt).toContain("Security")
    expect(prompt).toContain("Performance")
    expect(prompt).toContain("Accessibility")
    expect(prompt).toContain("Testing")
    expect(prompt).toContain("Code Quality")
    expect(prompt).toContain("Coding Convention")
    expect(prompt).toContain("Architecture")
    expect(prompt).toContain("API Design")
  })

  it("includes additional context block when present", () => {
    const prompt = buildReviewPrompt({
      prLink: "https://github.com/acme/repo/pull/12",
      additionalContext: "Focus on authentication edge cases",
    })
    expect(prompt).toContain("Focus on authentication edge cases")
    expect(prompt).toContain("User-provided additional context")
  })

  it("omits additional context block when not present", () => {
    const prompt = buildReviewPrompt({
      prLink: "https://github.com/acme/repo/pull/12",
    })
    expect(prompt).not.toContain("User-provided additional context")
  })

  it("keeps JSON output schema instructions", () => {
    const prompt = buildReviewPrompt({
      prLink: "https://github.com/acme/repo/pull/12",
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
    })
    expect(prompt).toContain("#456")
    expect(prompt).toContain("myorg/myrepo")
  })
})
