import { describe, expect, it } from "bun:test"
import { buildReviewGuidePrompt } from "./review-guide-prompt.js"

describe("buildReviewGuidePrompt", () => {
  it("includes the PR repo and number", () => {
    const prompt = buildReviewGuidePrompt({
      prLink: "https://github.com/myorg/myrepo/pull/456",
    })
    expect(prompt).toContain("#456")
    expect(prompt).toContain("myorg/myrepo")
  })

  it("describes the structured JSON schema", () => {
    const prompt = buildReviewGuidePrompt({
      prLink: "https://github.com/acme/repo/pull/12",
    })
    expect(prompt).toContain('"overview"')
    expect(prompt).toContain('"steps"')
    expect(prompt).toContain('"fileGroup"')
    expect(prompt).toContain('"rationale"')
    expect(prompt).toContain('"lookFor"')
    expect(prompt).toContain('"judgmentThreads"')
    expect(prompt).toContain('"anchorReason"')
    expect(prompt).toContain('"side"')
  })

  it("encodes the precision-floor language for judgment threads", () => {
    const prompt = buildReviewGuidePrompt({
      prLink: "https://github.com/acme/repo/pull/12",
    })
    expect(prompt).toMatch(/team|product/i)
    expect(prompt).toMatch(/Density bound/i)
  })

  it("requires the overview to add signal beyond the PR description", () => {
    const prompt = buildReviewGuidePrompt({
      prLink: "https://github.com/acme/repo/pull/12",
    })
    expect(prompt).toMatch(/cross-file dependencies|spine|change-shape/i)
    expect(prompt).toMatch(/paraphrase/i)
  })

  it("includes additional context block when present without violating output constraints", () => {
    const prompt = buildReviewGuidePrompt({
      prLink: "https://github.com/acme/repo/pull/12",
      additionalContext: "Focus on the auth migration",
    })
    expect(prompt).toContain("Focus on the auth migration")
    expect(prompt).toContain("User-provided additional context")
    expect(prompt).toContain("Do not violate required JSON schema")
  })

  it("omits additional context block when not present", () => {
    const prompt = buildReviewGuidePrompt({
      prLink: "https://github.com/acme/repo/pull/12",
    })
    expect(prompt).not.toContain("User-provided additional context")
  })

  it("still produces a buildable prompt for a malformed PR link", () => {
    const prompt = buildReviewGuidePrompt({
      prLink: "not-a-pr-link",
    })
    expect(prompt.length).toBeGreaterThan(0)
    expect(prompt).toContain('"overview"')
  })
})
