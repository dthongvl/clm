export interface BuildReviewGuidePromptOptions {
  prLink: string;
  additionalContext?: string;
}

/**
 * Build a Review Guide prompt for the AI backend.
 *
 * The guide synthesizes a PR overview (Step 0), an ordered route of file-group
 * steps with per-step focus notes, and "needs your judgment" threads for cases
 * the AI cannot decide without team or product context.
 */
export function buildReviewGuidePrompt(options: BuildReviewGuidePromptOptions): string {
  const { prLink, additionalContext } = options;

  const match = prLink.match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
  const repo = match ? match[1] : '';
  const prNumber = match ? match[2] : '';

  let prompt = `You are a senior code reviewer producing a guided reading route for GitHub PR #${prNumber} in ${repo}.

Execution context:
- You are in the repository working directory.
- You can use local git CLI and GitHub CLI (gh).
- Use gh for PR metadata and changed-file stats.
- Use local git to inspect full diffs between base and head.

Step 1: Gather PR context.
- Read title/body, base/head refs, and changed files with additions/deletions.
- Form an independent understanding of intent before judging implementation.

Step 2: Synthesize a PR Overview ("what this PR is and why").
- The overview MUST add signal beyond the PR description: cross-file dependencies, change-shape inference, or the "spine" of the change (the central thread that ties files together).
- Do NOT paraphrase the PR description. If the description is missing or thin, infer from the diff.
- Keep it to 2–4 sentences of concrete, non-generic prose.

Step 3: Plan the reading route.
- Group related files into ordered steps. Order steps to minimize cognitive load: foundational/shared changes before consumers; high-risk areas surfaced before incidental ones; tests and docs late.
- For each step provide:
  - title: short descriptive group title.
  - fileGroup: repo-relative paths in this group.
  - rationale: ONE line explaining why this step appears in this position in the route.
  - lookFor: per-step "what to look at" notes referencing specific symbols, line ranges, or named decisions in the diff. Avoid generic checklist content ("check error handling"); cite concrete identifiers.

Step 4: Emit "needs your judgment" threads.
- Only for cases that genuinely require concrete human, team, or product context the AI cannot infer from the codebase alone (e.g., product policy, team conventions not encoded in code, cross-team contracts, intentional regressions).
- Do NOT emit threads for issues you can already evaluate (correctness, style, obvious bugs — those belong in the AI Review surface, not here).
- Each thread anchors to a specific line in the diff, with side indicating which side of the diff it lives on.
- Density bound: emit no more than ~1 judgment thread per 200 lines changed. If in doubt, omit.

Step 5: Return ONLY one minified JSON object (single line) with this exact schema:
{"overview":"PR overview narrative for Step 0","steps":[{"id":"step-1","title":"Short group title","fileGroup":["path/to/file.ts"],"rationale":"One-line reason for this position","lookFor":"What to look at, citing specific symbols or line ranges"}],"judgmentThreads":[{"id":"jt-1","filePath":"path/to/file.ts","lineNumber":42,"side":"additions","content":"The question or handoff for the human reviewer","anchorReason":"Why the AI couldn't decide this without team or product context"}]}`;

  if (additionalContext) {
    prompt += `

User-provided additional context (optional guidance):
${additionalContext}

Use this context to prioritize analysis when relevant.
Do not violate required JSON schema and output constraints.`;
  }

  prompt += `

Output constraints:
- Return only the JSON object; no markdown, no code fences, no extra prose.
- Output must be valid minified JSON on a single line.
- side must be exactly "additions" or "deletions".
- lineNumber must map to the changed file's new-line numbering for "additions" or old-line numbering for "deletions".
- If the PR is structurally trivial, return a single step in "steps" plus a concise overview; "judgmentThreads" may be empty.
- Prefer fewer high-confidence judgment threads over many weak prompts; an empty array is acceptable and often correct.`;

  return prompt;
}
