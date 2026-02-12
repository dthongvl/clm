import type { AIReviewCategory } from '../types/index.js';

export const CATEGORY_INSTRUCTIONS: Record<AIReviewCategory, string> = {
  "code-quality": `Code-quality focus:
- Variable/function naming clarity
- Code duplication and DRY violations
- Complexity (deeply nested logic, long functions)
- Magic numbers and hardcoded values
- Dead code or unreachable branches`,

  "coding-convention": `Coding-convention focus:
- Consistent formatting and style
- Naming conventions (camelCase, PascalCase, etc.)
- Import ordering and grouping
- Comment quality and documentation
- Consistent error handling patterns`,

  "security": `Security focus:
- SQL injection, XSS, CSRF vulnerabilities
- Hardcoded secrets, API keys, or credentials
- Unsafe deserialization or eval usage
- Missing input validation/sanitization
- Improper authentication/authorization checks
- Insecure cryptographic practices`,

  "accessibility": `Accessibility focus:
- Missing ARIA labels and roles
- Color contrast and visual accessibility
- Keyboard navigation support
- Screen reader compatibility
- Focus management issues
- Alternative text for images`,

  "architecture": `Architecture focus:
- Separation of concerns violations
- Coupling between unrelated modules
- Layer boundary violations (e.g., UI calling DB directly)
- Circular dependencies
- Missing abstractions or over-engineering
- Inconsistent patterns across similar features`,

  "api-design": `Api-design focus:
- RESTful conventions and HTTP method usage
- Request/response payload structure
- Error response consistency
- Breaking changes in public APIs
- Missing or incorrect status codes
- API versioning concerns`,

  "performance": `Performance focus:
- N+1 queries or inefficient database access
- Missing indexes or slow query patterns
- Memory leaks or unbounded allocations
- Unnecessary re-renders in UI code
- Blocking operations in hot paths
- Missing caching opportunities
- Bundle size regressions`,

  "testing": `Testing focus:
- Missing test coverage for new code
- Brittle or flaky test patterns
- Missing edge case coverage
- Test isolation issues
- Mocking/stubbing anti-patterns
- Assertion quality and specificity`,
};

export interface BuildReviewPromptOptions {
  prLink: string;
  categories: AIReviewCategory[];
  additionalContext?: string;
  categoryScopeLabel?: string;
}

/**
 * Build a review prompt scoped to specific categories.
 */
export function buildReviewPrompt(options: BuildReviewPromptOptions): string {
  const { prLink, categories, additionalContext, categoryScopeLabel } = options;
  
  const match = prLink.match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
  const repo = match ? match[1] : '';
  const prNumber = match ? match[2] : '';

  const categoryBlocks = categories
    .map((cat) => CATEGORY_INSTRUCTIONS[cat])
    .join('\n\n');

  const scopeNote = categoryScopeLabel
    ? `\nReview scope: ${categoryScopeLabel}\n`
    : '';

  let prompt = `You are a senior code reviewer. Analyze GitHub PR #${prNumber} in ${repo} and produce high-signal review findings.
${scopeNote}
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
${categoryBlocks}

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
- categories must be an array containing one or more of: ${categories.map(c => `"${c}"`).join(', ')}.
- lineNumber must map to the changed file's new-line numbering.
- message must be actionable and include impact.
- If there are no meaningful findings, return \`"items":[]\` with a concise summary.`;

  return prompt;
}
