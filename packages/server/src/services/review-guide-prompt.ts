export interface BuildReviewGuidePromptOptions {
  prLink: string;
  additionalContext?: string;
}

export interface BuildChapterRegenerationPromptOptions {
  prLink: string;
  chapter: { id: string; title: string; intent: string };
  outlineContext: Array<{ id: string; title: string; intent: string }>;
  additionalContext?: string;
}

const NOTEBOOK_SCHEMA_DESCRIPTION = `Schema:
{
  "overview": "1-3 concrete sentences about the PR spine",
  "outline": [
    {"id": "chapter-1", "title": "Short chapter title", "intent": "One-line reading intent"}
  ],
  "chapters": [
    {
      "chapterId": "chapter-1",
      "cells": [
        {"type": "markdown", "id": "cell-1-1", "content": "Prose paragraph rendered as markdown"},
        {"type": "diff", "id": "cell-1-2", "filePath": "path/to/file.ts", "caption": "What this hunk does", "highlights": [{"side": "additions", "startLine": 12, "endLine": 28, "note": "Optional one-line annotation"}]},
        {"type": "note", "id": "cell-1-3", "severity": "risk", "content": "Why this matters"},
        {"type": "checklist", "id": "cell-1-4", "items": [{"id": "item-1", "text": "Verify foo handles bar"}]}
      ],
      "judgmentThreads": [
        {"id": "jt-1", "chapterId": "chapter-1", "filePath": "path/to/file.ts", "side": "additions", "lineNumber": 42, "content": "Question for human reviewer", "anchorReason": "Why AI cannot decide alone"}
      ]
    }
  ]
}`;

const CELL_TYPE_GUIDANCE = `Cell guidance:
- Use "markdown" for prose context, summaries, or "what to expect" framing.
- Use "diff" to point at concrete code; highlights MUST use line numbers from the changed file (new-line numbering for additions, old-line numbering for deletions).
- Use "note" for callouts. Severity must be exactly one of: "info", "attention", "security", "performance", "risk".
- Use "checklist" only when reviewer should explicitly tick discrete sub-items.
- Do NOT emit standalone judgment thread cells; put judgment threads in the "judgmentThreads" field of the chapter that owns the diff cell they anchor to.
- Order cells within a chapter so prose framing comes before the diff/note/checklist it explains.`;

const JUDGMENT_GUIDANCE = `Judgment threads:
- Only emit when a question genuinely requires team or product context the AI cannot infer from the codebase.
- Each thread anchors to a specific line and side; lineNumber must be a valid changed-file line.
- Density bound: no more than ~1 thread per 200 changed lines. Prefer fewer high-confidence threads.`;

const OUTPUT_CONSTRAINTS = `Output constraints:
- Return only ONE minified JSON object on a single line. No markdown, no code fences, no extra prose.
- Chapter ids MUST be of the form "chapter-N" and stay stable across the notebook.
- Cell ids MUST be unique within a chapter; recommended form is "cell-<chapterIndex>-<cellIndex>".
- "side" must be exactly "additions" or "deletions".
- Severity must be exactly one of: "info", "attention", "security", "performance", "risk".
- If the PR is structurally trivial, emit a single chapter; "judgmentThreads" may be empty.`;

function extractRepoAndPr(prLink: string): { repo: string; prNumber: string } {
  const match = prLink.match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
  return {
    repo: match ? match[1]! : '',
    prNumber: match ? match[2]! : '',
  };
}

/**
 * Build a Notebook prompt for the AI backend.
 *
 * The notebook is a chaptered narrative for guided deep PR review:
 * - An overview/outline pass (chapters with stable ids, titles, intents).
 * - One chapter per logical reading group, each containing markdown, diff,
 *   note, and checklist cells, plus any judgment threads anchored to its diff.
 *
 * The internal action settings key remains `review-guide` for compatibility
 * with persisted user model preferences.
 */
export function buildReviewGuidePrompt(options: BuildReviewGuidePromptOptions): string {
  const { prLink, additionalContext } = options;
  const { repo, prNumber } = extractRepoAndPr(prLink);

  let prompt = `You are a senior code reviewer producing a Notebook — a chaptered guided reading of GitHub PR #${prNumber} in ${repo}.

Execution context:
- You are in the repository working directory.
- You can use local git CLI and GitHub CLI (gh).
- Use gh for PR metadata and changed-file stats.
- Use local git to inspect full diffs between base and head.

Phase 1: Gather PR context.
- Read title/body, base/head refs, and changed files with additions/deletions.
- Form an independent understanding of intent before judging implementation.

Phase 2: Synthesize a PR overview that adds signal beyond the description.
- Cover cross-file dependencies, change-shape inference, or the "spine" of the change.
- Do NOT paraphrase the PR description. If the description is missing or thin, infer from the diff.
- Keep it to 1-3 sentences of concrete, non-generic prose.

Phase 3: Plan the chapter outline.
- Group related changes into ordered chapters that minimize cognitive load: foundational/shared changes before consumers; high-risk areas surfaced before incidental ones; tests and docs late.
- Each chapter has: id (stable, "chapter-N"), title (short), intent (one-line reading goal).
- A trivial PR may yield a single chapter.

Phase 4: For each chapter, write cells in reading order.
${CELL_TYPE_GUIDANCE}

Phase 5: ${JUDGMENT_GUIDANCE}

${NOTEBOOK_SCHEMA_DESCRIPTION}`;

  if (additionalContext) {
    prompt += `

User-provided additional context (optional guidance):
${additionalContext}

Use this context to prioritize analysis when relevant.
Do not violate required JSON schema and output constraints.`;
  }

  prompt += `

${OUTPUT_CONSTRAINTS}`;

  return prompt;
}

/**
 * Build a per-chapter regeneration prompt. The response must preserve the
 * provided `chapter.id` even if title or intent are revised.
 */
export function buildChapterRegenerationPrompt(
  options: BuildChapterRegenerationPromptOptions,
): string {
  const { prLink, chapter, outlineContext, additionalContext } = options;
  const { repo, prNumber } = extractRepoAndPr(prLink);

  const outlineLines = outlineContext
    .map((c) => `- ${c.id}: ${c.title} — ${c.intent}`)
    .join('\n');

  let prompt = `You are regenerating a single chapter of an existing Notebook for GitHub PR #${prNumber} in ${repo}.

Existing notebook outline (do NOT replace; you are only regenerating one chapter):
${outlineLines}

Target chapter:
- id: ${chapter.id} (MUST be preserved verbatim in the response)
- current title: ${chapter.title}
- current intent: ${chapter.intent}

You may revise the chapter's title, intent, cells, and judgment threads, but the chapterId MUST remain "${chapter.id}".

Cell guidance and constraints follow the same rules as full notebook generation.

${CELL_TYPE_GUIDANCE}

${JUDGMENT_GUIDANCE}

Schema:
{
  "chapter": {"id": "${chapter.id}", "title": "...", "intent": "..."},
  "cells": [ ...same shapes as full notebook generation... ],
  "judgmentThreads": [ ...same shapes as full notebook generation... ]
}`;

  if (additionalContext) {
    prompt += `

User-provided regeneration hint:
${additionalContext}

Use this hint to guide what changes for this chapter.`;
  }

  prompt += `

${OUTPUT_CONSTRAINTS}
- Return only the single chapter JSON object described above.
- The "chapter.id" field MUST equal "${chapter.id}".`;

  return prompt;
}
