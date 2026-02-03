import { parse as parseYaml } from 'yaml';
import type { PatternVerification, PatternVerificationResult, PatternLocation } from '../types/index.js';
import { opencodeClient } from './opencode-client.js';

const AI_MODEL = process.env.AI_MODEL || 'google/gemini-3-flash-preview';

export async function verifyPatterns(prLink: string): Promise<PatternVerificationResult> {
  const prompt = buildVerificationPrompt(prLink);
  
  try {
    const response = await opencodeClient.prompt(prompt, { model: AI_MODEL });
    return parseVerificationOutput(response);
  } catch (error) {
    console.error('Pattern verification failed:', error);
    throw new Error(`Failed to verify patterns: ${(error as Error).message}`);
  }
}

function buildVerificationPrompt(prLink: string): string {
  const match = prLink.match(/github\.com\/([^/]+\/[^/]+)\/pull\/(\d+)/);
  const repo = match ? match[1] : '';
  const prNumber = match ? match[2] : '';

  return `Analyze GitHub PR #${prNumber} in ${repo} and verify that all related code locations were updated consistently.

Step 1: Use the \`gh\` CLI tool to fetch the PR diff:
gh pr diff ${prNumber} --repo ${repo}

Step 2: Identify patterns that require verification:
- Renamed functions/methods/classes: Were all call sites updated?
- Changed function signatures: Were all callers updated with new parameters?
- Modified API endpoints: Were all clients updated?
- Updated type/interface definitions: Were all usages updated?
- Changed constants/config values: Were all references updated?
- Renamed files: Were all imports updated?

Step 3: For each pattern found, search the codebase to verify completeness:
- Use grep or search to find all occurrences
- Check if each occurrence was properly updated in the PR
- Flag any locations that appear to be missed

Step 4: Return ONLY a YAML code block in this exact format (no other text):

\`\`\`yaml
summary: Brief summary of verification findings
verifications:
  - id: verify-1
    pattern: "functionName renamed to newFunctionName"
    description: What was changed and what needs to be verified
    status: verified  # must be: verified, incomplete, or warning
    details: "Found 8 call sites, all 8 were updated in this PR"
    locations:
      - filePath: path/to/file.ts
        lineNumber: 42
        status: updated  # must be: updated, missing, or suspicious
        snippet: "newFunctionName(args)"
\`\`\`

Rules:
- status "verified": All locations were properly updated
- status "incomplete": Some locations appear to be missed
- status "warning": Potential issues that need human review
- Only include verifications for patterns that actually need checking
- If no patterns need verification, return empty verifications array
- Focus on high-value verifications (renames, signature changes, API changes)
- Return ONLY the YAML code block, nothing else`;
}

interface YamlPatternLocation {
  filePath?: string;
  lineNumber?: number;
  status?: string;
  snippet?: string;
}

interface YamlPatternVerification {
  id?: string;
  pattern?: string;
  description?: string;
  status?: string;
  details?: string;
  locations?: YamlPatternLocation[];
}

interface YamlVerificationResult {
  summary?: string;
  verifications?: YamlPatternVerification[];
}

function parseVerificationOutput(output: string): PatternVerificationResult {
  try {
    const yamlMatch = output.match(/```ya?ml\n([\s\S]*?)```/)
      || output.match(/^(summary:\n[\s\S]*)/m)
      || output.match(/^(verifications:\n[\s\S]*)/m);
    
    if (!yamlMatch) {
      console.error('No YAML found in verification output:', output.slice(0, 500));
      return { verifications: [], summary: '' };
    }
    
    const yamlContent = yamlMatch[1];
    const parsed = parseYaml(yamlContent) as YamlVerificationResult;
    
    const summary = parsed?.summary || '';
    const verifications = parseYamlVerifications(parsed?.verifications || []);
    
    return { verifications, summary };
  } catch (error) {
    console.error('Failed to parse verification output:', error);
    console.error('Raw output:', output.slice(0, 1000));
    return { verifications: [], summary: '' };
  }
}

function parseYamlVerifications(yamlVerifications: YamlPatternVerification[]): PatternVerification[] {
  if (!Array.isArray(yamlVerifications)) {
    return [];
  }
  
  return yamlVerifications
    .filter((v): v is YamlPatternVerification => !!v && typeof v.pattern === 'string')
    .map((v, index) => {
      const statusRaw = (v.status || 'warning').toLowerCase();
      const status = ['verified', 'incomplete', 'warning'].includes(statusRaw)
        ? (statusRaw as PatternVerification['status'])
        : 'warning';

      const locations: PatternLocation[] = (v.locations || [])
        .filter((loc): loc is YamlPatternLocation => !!loc && typeof loc.filePath === 'string')
        .map(loc => {
          const locStatusRaw = (loc.status || 'suspicious').toLowerCase();
          const locStatus = ['updated', 'missing', 'suspicious'].includes(locStatusRaw)
            ? (locStatusRaw as PatternLocation['status'])
            : 'suspicious';

          return {
            filePath: loc.filePath!,
            lineNumber: loc.lineNumber || 1,
            status: locStatus,
            snippet: loc.snippet,
          };
        });

      return {
        id: v.id || `verify-${index + 1}`,
        pattern: v.pattern!,
        description: v.description || '',
        status,
        details: v.details || '',
        locations,
      };
    });
}
