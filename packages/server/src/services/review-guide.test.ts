import { describe, expect, it } from "bun:test"
import {
  parseChapterRegenerationOutput,
  parseNotebookOutput,
} from "./review-guide.js"

describe("parseNotebookOutput", () => {
  it("parses a well-formed notebook with outline and chapters", () => {
    const output = JSON.stringify({
      overview: "This PR rebuilds the review guide as a chaptered notebook.",
      outline: [
        { id: "chapter-1", title: "Server contract", intent: "Read the new wire shape" },
        { id: "chapter-2", title: "Client UI", intent: "See the new reader" },
      ],
      chapters: [
        {
          chapterId: "chapter-1",
          cells: [
            { type: "markdown", id: "cell-1-1", content: "Overview prose." },
            {
              type: "diff",
              id: "cell-1-2",
              filePath: "packages/server/src/types/review-guide.ts",
              caption: "New types",
              highlights: [
                { side: "additions", startLine: 10, endLine: 30, note: "Notebook DTOs" },
              ],
            },
            { type: "note", id: "cell-1-3", severity: "risk", content: "Watch breaking changes." },
          ],
          judgmentThreads: [
            {
              id: "jt-1",
              chapterId: "chapter-1",
              filePath: "packages/server/src/types/review-guide.ts",
              side: "additions",
              lineNumber: 42,
              content: "Should we keep the old key?",
              anchorReason: "Depends on user settings policy.",
            },
          ],
        },
        {
          chapterId: "chapter-2",
          cells: [
            {
              type: "checklist",
              id: "cell-2-1",
              items: [
                { id: "item-1", text: "Verify rail" },
                { id: "item-2", text: "Verify completion" },
              ],
            },
          ],
          judgmentThreads: [],
        },
      ],
    })

    const notebook = parseNotebookOutput(output)
    expect(notebook.overview).toContain("chaptered notebook")
    expect(notebook.outline).toHaveLength(2)
    expect(notebook.outline[0]!.id).toBe("chapter-1")
    expect(notebook.outline[1]!.title).toBe("Client UI")

    expect(notebook.chapters).toHaveLength(2)
    expect(notebook.chapters[0]!.chapterId).toBe("chapter-1")
    expect(notebook.chapters[0]!.cells).toHaveLength(3)
    expect(notebook.chapters[0]!.cells[0]!.type).toBe("markdown")
    expect(notebook.chapters[0]!.cells[1]!.type).toBe("diff")
    expect(notebook.chapters[0]!.cells[2]!.type).toBe("note")

    const diff = notebook.chapters[0]!.cells[1]
    if (diff.type !== "diff") throw new Error("expected diff")
    expect(diff.filePath).toBe("packages/server/src/types/review-guide.ts")
    expect(diff.highlights).toHaveLength(1)
    expect(diff.highlights[0]!.startLine).toBe(10)
    expect(diff.highlights[0]!.endLine).toBe(30)
    expect(diff.highlights[0]!.side).toBe("additions")

    const checklist = notebook.chapters[1]!.cells[0]
    if (checklist.type !== "checklist") throw new Error("expected checklist")
    expect(checklist.items).toHaveLength(2)
    expect(checklist.items[0]!.id).toBe("item-1")

    expect(notebook.chapters[0]!.judgmentThreads).toHaveLength(1)
    expect(notebook.chapters[0]!.judgmentThreads[0]!.chapterId).toBe("chapter-1")
  })

  it("returns an empty notebook for non-JSON output", () => {
    const result = parseNotebookOutput("not JSON, just prose.")
    expect(result).toEqual({ overview: "", outline: [], chapters: [] })
  })

  it("synthesizes deterministic chapter ids when missing without colliding", () => {
    const output = JSON.stringify({
      overview: "x",
      outline: [
        { title: "First" },
        { title: "Second" },
      ],
      chapters: [],
    })
    const result = parseNotebookOutput(output)
    expect(result.outline.map((c) => c.id)).toEqual(["chapter-1", "chapter-2"])
  })

  it("synthesizes deterministic cell ids without collisions across chapters", () => {
    const output = JSON.stringify({
      overview: "x",
      outline: [
        { id: "chapter-1", title: "a", intent: "i" },
        { id: "chapter-2", title: "b", intent: "i" },
      ],
      chapters: [
        {
          chapterId: "chapter-1",
          cells: [{ type: "markdown", content: "p1" }, { type: "markdown", content: "p2" }],
          judgmentThreads: [],
        },
        {
          chapterId: "chapter-2",
          cells: [{ type: "markdown", content: "p3" }],
          judgmentThreads: [],
        },
      ],
    })
    const result = parseNotebookOutput(output)
    const ids = result.chapters.flatMap((c) => c.cells.map((cell) => cell.id))
    expect(ids).toEqual(["cell-1-1", "cell-1-2", "cell-2-1"])
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("downgrades a diff cell with no file path to a markdown placeholder", () => {
    const output = JSON.stringify({
      overview: "x",
      outline: [{ id: "chapter-1", title: "a", intent: "i" }],
      chapters: [
        {
          chapterId: "chapter-1",
          cells: [
            { type: "diff", id: "broken", caption: "no file", highlights: [] },
          ],
          judgmentThreads: [],
        },
      ],
    })
    const result = parseNotebookOutput(output)
    expect(result.chapters[0]!.cells).toHaveLength(1)
    expect(result.chapters[0]!.cells[0]!.type).toBe("markdown")
  })

  it("downgrades an invalid note severity to info", () => {
    const output = JSON.stringify({
      overview: "x",
      outline: [{ id: "chapter-1", title: "a", intent: "i" }],
      chapters: [
        {
          chapterId: "chapter-1",
          cells: [{ type: "note", id: "n1", severity: "garbage", content: "c" }],
          judgmentThreads: [],
        },
      ],
    })
    const result = parseNotebookOutput(output)
    const note = result.chapters[0]!.cells[0]
    if (note.type !== "note") throw new Error("expected note")
    expect(note.severity).toBe("info")
  })

  it("synthesizes checklist item ids when missing", () => {
    const output = JSON.stringify({
      overview: "x",
      outline: [{ id: "chapter-1", title: "a", intent: "i" }],
      chapters: [
        {
          chapterId: "chapter-1",
          cells: [
            {
              type: "checklist",
              id: "cl",
              items: [{ text: "alpha" }, { text: "beta" }],
            },
          ],
          judgmentThreads: [],
        },
      ],
    })
    const result = parseNotebookOutput(output)
    const cl = result.chapters[0]!.cells[0]
    if (cl.type !== "checklist") throw new Error("expected checklist")
    expect(cl.items.map((i) => i.id)).toEqual(["cl-item-1", "cl-item-2"])
  })

  it("drops a judgment thread missing lineNumber", () => {
    const output = JSON.stringify({
      overview: "x",
      outline: [{ id: "chapter-1", title: "a", intent: "i" }],
      chapters: [
        {
          chapterId: "chapter-1",
          cells: [],
          judgmentThreads: [
            { id: "jt-bad", filePath: "a.ts", side: "additions", content: "c", anchorReason: "r" },
            {
              id: "jt-ok",
              filePath: "b.ts",
              lineNumber: 7,
              side: "additions",
              content: "kept",
              anchorReason: "r",
            },
          ],
        },
      ],
    })
    const result = parseNotebookOutput(output)
    const threads = result.chapters[0]!.judgmentThreads
    expect(threads).toHaveLength(1)
    expect(threads[0]!.id).toBe("jt-ok")
    expect(threads[0]!.chapterId).toBe("chapter-1")
  })

  it("normalizes an unknown highlight side to additions", () => {
    const output = JSON.stringify({
      overview: "x",
      outline: [{ id: "chapter-1", title: "a", intent: "i" }],
      chapters: [
        {
          chapterId: "chapter-1",
          cells: [
            {
              type: "diff",
              id: "d1",
              filePath: "a.ts",
              highlights: [{ side: "garbage", startLine: 1, endLine: 2 }],
            },
          ],
          judgmentThreads: [],
        },
      ],
    })
    const result = parseNotebookOutput(output)
    const diff = result.chapters[0]!.cells[0]
    if (diff.type !== "diff") throw new Error("expected diff")
    expect(diff.highlights[0]!.side).toBe("additions")
  })

  it("preserves a single-chapter trivial notebook", () => {
    const output = JSON.stringify({
      overview: "Tiny copy fix.",
      outline: [{ id: "chapter-1", title: "Copy", intent: "Read the change" }],
      chapters: [
        {
          chapterId: "chapter-1",
          cells: [{ type: "markdown", id: "cell-1-1", content: "Single sentence." }],
          judgmentThreads: [],
        },
      ],
    })
    const result = parseNotebookOutput(output)
    expect(result.outline).toHaveLength(1)
    expect(result.chapters).toHaveLength(1)
  })
})

describe("parseChapterRegenerationOutput", () => {
  it("parses a well-formed regeneration response and preserves chapterId", () => {
    const output = JSON.stringify({
      chapterId: "chapter-2",
      cells: [{ type: "markdown", id: "cell-2-1", content: "Refreshed." }],
      judgmentThreads: [],
    })
    const result = parseChapterRegenerationOutput(output, "chapter-2")
    expect(result?.chapterId).toBe("chapter-2")
    expect(result?.cells[0]!.type).toBe("markdown")
  })

  it("coerces the chapterId to the expected one even if AI rewrote it", () => {
    const output = JSON.stringify({
      chapterId: "chapter-rewritten",
      cells: [{ type: "markdown", id: "x", content: "y" }],
      judgmentThreads: [],
    })
    const result = parseChapterRegenerationOutput(output, "chapter-2")
    expect(result?.chapterId).toBe("chapter-2")
  })

  it("accepts the alternative {chapter:{id,...}} shape", () => {
    const output = JSON.stringify({
      chapter: { id: "chapter-3", title: "t", intent: "i" },
      cells: [{ type: "markdown", id: "x", content: "y" }],
      judgmentThreads: [],
    })
    const result = parseChapterRegenerationOutput(output, "chapter-3")
    expect(result?.chapterId).toBe("chapter-3")
  })

  it("returns null for non-JSON output", () => {
    const result = parseChapterRegenerationOutput("not JSON", "chapter-1")
    expect(result).toBeNull()
  })
})
