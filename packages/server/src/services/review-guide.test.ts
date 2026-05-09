import { describe, expect, it } from "bun:test"
import { parseReviewGuideOutput } from "./review-guide.js"

describe("parseReviewGuideOutput", () => {
  it("parses a well-formed minified JSON object", () => {
    const output = JSON.stringify({
      overview: "This PR introduces feature X across three layers.",
      steps: [
        {
          id: "step-1",
          title: "Server route",
          fileGroup: ["packages/server/src/routes/x.ts"],
          rationale: "Foundational; consumers downstream depend on it.",
          lookFor: "buildXPrompt symbol and routing in index.ts",
        },
      ],
      judgmentThreads: [
        {
          id: "jt-1",
          filePath: "packages/server/src/routes/x.ts",
          lineNumber: 42,
          side: "additions",
          content: "Should this enforce org-level rate limits?",
          anchorReason: "Depends on team policy not encoded in code.",
        },
      ],
    })

    const result = parseReviewGuideOutput(output)
    expect(result.overview).toContain("feature X")
    expect(result.steps).toHaveLength(1)
    expect(result.steps[0]!.fileGroup).toEqual(["packages/server/src/routes/x.ts"])
    expect(result.judgmentThreads).toHaveLength(1)
    expect(result.judgmentThreads[0]!.lineNumber).toBe(42)
    expect(result.judgmentThreads[0]!.side).toBe("additions")
  })

  it("yields an empty steps array when steps is empty", () => {
    const output = JSON.stringify({ overview: "tiny", steps: [], judgmentThreads: [] })
    const result = parseReviewGuideOutput(output)
    expect(result.steps).toEqual([])
  })

  it("preserves a result with a single step (trivial PR signal, AE6)", () => {
    const output = JSON.stringify({
      overview: "Tiny copy fix.",
      steps: [
        {
          id: "step-1",
          title: "Copy update",
          fileGroup: ["packages/client/src/copy.ts"],
          rationale: "Single-file structural change.",
          lookFor: "Updated string literal at line 12",
        },
      ],
      judgmentThreads: [],
    })
    const result = parseReviewGuideOutput(output)
    expect(result.steps).toHaveLength(1)
    expect(result.judgmentThreads).toEqual([])
  })

  it("defaults missing judgmentThreads field to an empty array", () => {
    const output = JSON.stringify({
      overview: "x",
      steps: [
        {
          id: "step-1",
          title: "t",
          fileGroup: ["a.ts"],
          rationale: "r",
          lookFor: "l",
        },
      ],
    })
    const result = parseReviewGuideOutput(output)
    expect(result.judgmentThreads).toEqual([])
  })

  it("drops a judgment thread missing lineNumber rather than fabricating zero", () => {
    const output = JSON.stringify({
      overview: "x",
      steps: [],
      judgmentThreads: [
        {
          id: "jt-1",
          filePath: "a.ts",
          side: "additions",
          content: "valid",
          anchorReason: "r",
        },
        {
          id: "jt-2",
          filePath: "b.ts",
          lineNumber: 7,
          side: "additions",
          content: "kept",
          anchorReason: "r",
        },
      ],
    })
    const result = parseReviewGuideOutput(output)
    expect(result.judgmentThreads).toHaveLength(1)
    expect(result.judgmentThreads[0]!.id).toBe("jt-2")
  })

  it("returns an empty guide for non-JSON output", () => {
    const result = parseReviewGuideOutput("This is not JSON at all, just prose.")
    expect(result).toEqual({ overview: "", steps: [], judgmentThreads: [] })
  })

  it("normalizes an unknown side value to additions", () => {
    const output = JSON.stringify({
      overview: "x",
      steps: [],
      judgmentThreads: [
        {
          id: "jt-1",
          filePath: "a.ts",
          lineNumber: 5,
          side: "garbage",
          content: "c",
          anchorReason: "r",
        },
      ],
    })
    const result = parseReviewGuideOutput(output)
    expect(result.judgmentThreads[0]!.side).toBe("additions")
  })

  it("preserves a deletions-side judgment thread", () => {
    const output = JSON.stringify({
      overview: "x",
      steps: [],
      judgmentThreads: [
        {
          id: "jt-1",
          filePath: "a.ts",
          lineNumber: 5,
          side: "deletions",
          content: "c",
          anchorReason: "r",
        },
      ],
    })
    const result = parseReviewGuideOutput(output)
    expect(result.judgmentThreads[0]!.side).toBe("deletions")
  })

  it("synthesizes step ids when missing", () => {
    const output = JSON.stringify({
      overview: "x",
      steps: [
        { title: "a", fileGroup: ["a.ts"], rationale: "r", lookFor: "l" },
        { title: "b", fileGroup: ["b.ts"], rationale: "r", lookFor: "l" },
      ],
      judgmentThreads: [],
    })
    const result = parseReviewGuideOutput(output)
    expect(result.steps.map((s) => s.id)).toEqual(["step-1", "step-2"])
  })
})
