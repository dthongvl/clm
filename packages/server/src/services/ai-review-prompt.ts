export interface BuildReviewPromptOptions {
  prLink: string;
  additionalContext?: string;
}

/**
 * Build a review prompt for the AI backend.
 */
export function buildReviewPrompt(options: BuildReviewPromptOptions): string {
  const { prLink, additionalContext } = options;

  const match = prLink.match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
  const repo = match ? match[1] : '';
  const prNumber = match ? match[2] : '';

  let prompt = `You are a senior code reviewer. Analyze GitHub PR #${prNumber} in ${repo} and produce high-signal review findings.

Execution context:
- You are in the repository working directory.
- You can use local git CLI and GitHub CLI (gh).
- Use local git for diff analysis and gh for PR metadata.

Step 1: Gather PR context.
- Read PR title/body, base/head refs, and changed-file scope.
- Understand the intent before judging implementation.

Step 2: Inspect code changes.
- Use local git commands to compare base and head branches and inspect the patch.
- Use new-file line numbers from the diff when reporting findings.
- Read nearby code when needed to avoid false positives.

Step 3: Focus areas for this review.
- Code Quality: naming clarity, DRY violations, complexity, magic numbers, dead code
- Coding Convention: formatting consistency, naming conventions, import ordering, comment quality
- Security: injection vulnerabilities, hardcoded secrets, unsafe deserialization, missing validation
- Accessibility: ARIA labels, color contrast, keyboard navigation, screen reader compatibility
- Architecture: separation of concerns, coupling, layer boundaries, circular dependencies
- API Design: RESTful conventions, payload structure, error responses, breaking changes
- Performance: N+1 queries, memory leaks, unnecessary re-renders, blocking operations, caching
- Testing: missing coverage, brittle tests, edge cases, test isolation, assertion quality

Step 4: Identify meaningful findings.
- critical: bugs, security issues, data loss, race conditions, major performance regressions
- warning: correctness risks, edge cases, missing error handling, maintainability issues
- info: useful improvements with practical impact
- Avoid trivial style nitpicks unless they hide real risk.
- Prefer fewer high-confidence findings over many weak guesses.

Step 5: Return ONLY one minified JSON object (single line) with this exact schema:
{"summary":"Brief overall summary of the PR and key findings","items":[{"severity":"critical","filePath":"path/to/file.ts","lineNumber":42,"categories":["security"],"message":"Clear description of the issue and why it matters","suggestion":"Optional concrete fix"}]}`;

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
- severity must be exactly: critical, warning, or info.
- categories must be an array containing one or more of: "code-quality", "coding-convention", "security", "accessibility", "architecture", "api-design", "performance", "testing".
- lineNumber must map to the changed file's new-line numbering.
- message must be actionable and include impact.
- If there are no meaningful findings, return "items":[] with a concise summary.`;

  return prompt;
}
