import { describe, expect, it } from "bun:test"
import {
  buildChapterRegenerationPrompt,
  buildReviewGuidePrompt,
} from "./review-guide-prompt.js"

describe("buildReviewGuidePrompt", () => {
  it("includes the PR repo and number", () => {
    const prompt = buildReviewGuidePrompt({
      prLink: "https://github.com/myorg/myrepo/pull/456",
    })
    expect(prompt).toContain("#456")
    expect(prompt).toContain("myorg/myrepo")
  })

  it("describes the notebook JSON schema with chapters and cells", () => {
    const prompt = buildReviewGuidePrompt({
      prLink: "https://github.com/acme/repo/pull/12",
    })
    expect(prompt).toContain('"overview"')
    expect(prompt).toContain('"outline"')
    expect(prompt).toContain('"chapters"')
    expect(prompt).toContain('"chapterId"')
    expect(prompt).toContain('"cells"')
    expect(prompt).toContain('"highlights"')
    expect(prompt).toContain('"judgmentThreads"')
    expect(prompt).toContain('"anchorReason"')
    expect(prompt).toContain('"side"')
  })

  it("constrains note severity to the allowed enum", () => {
    const prompt = buildReviewGuidePrompt({
      prLink: "https://github.com/acme/repo/pull/12",
    })
    expect(prompt).toContain('"info"')
    expect(prompt).toContain('"attention"')
    expect(prompt).toContain('"security"')
    expect(prompt).toContain('"performance"')
    expect(prompt).toContain('"risk"')
  })

  it("forbids standalone judgment thread cells", () => {
    const prompt = buildReviewGuidePrompt({
      prLink: "https://github.com/acme/repo/pull/12",
    })
    expect(prompt).toMatch(/Do NOT emit standalone judgment thread cells/i)
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

describe("buildChapterRegenerationPrompt", () => {
  it("includes the target chapter id and current title/intent", () => {
    const prompt = buildChapterRegenerationPrompt({
      prLink: "https://github.com/acme/repo/pull/12",
      chapter: { id: "chapter-2", title: "Server contract", intent: "Read DTOs" },
      outlineContext: [
        { id: "chapter-1", title: "Overview", intent: "Skim spine" },
        { id: "chapter-2", title: "Server contract", intent: "Read DTOs" },
      ],
    })
    expect(prompt).toContain("chapter-2")
    expect(prompt).toContain("Server contract")
    expect(prompt).toContain("Read DTOs")
  })

  it("renders the surrounding outline so the AI keeps narrative consistency", () => {
    const prompt = buildChapterRegenerationPrompt({
      prLink: "https://github.com/acme/repo/pull/12",
      chapter: { id: "chapter-2", title: "t", intent: "i" },
      outlineContext: [
        { id: "chapter-1", title: "First", intent: "i1" },
        { id: "chapter-2", title: "t", intent: "i" },
        { id: "chapter-3", title: "Third", intent: "i3" },
      ],
    })
    expect(prompt).toContain("chapter-1: First")
    expect(prompt).toContain("chapter-3: Third")
  })

  it("requires the response to preserve the chapter id verbatim", () => {
    const prompt = buildChapterRegenerationPrompt({
      prLink: "https://github.com/acme/repo/pull/12",
      chapter: { id: "chapter-2", title: "t", intent: "i" },
      outlineContext: [],
    })
    expect(prompt).toMatch(/MUST be preserved verbatim/i)
    expect(prompt).toMatch(/MUST equal "chapter-2"/i)
  })

  it("includes the optional reviewer hint when provided", () => {
    const prompt = buildChapterRegenerationPrompt({
      prLink: "https://github.com/acme/repo/pull/12",
      chapter: { id: "chapter-2", title: "t", intent: "i" },
      outlineContext: [],
      additionalContext: "Please cover the rate limiter edge case",
    })
    expect(prompt).toContain("Please cover the rate limiter edge case")
    expect(prompt).toContain("regeneration hint")
  })
})
