import { Hono } from 'hono';
import { generateGrouping, buildPRLink, checkOpencodeBinary } from '../services/grouping.js';
import { getCurrentRepo } from '../services/gh.js';
import { safeJson, isPositiveInt } from '../utils/request.js';

const app = new Hono();

interface GroupingBody {
  prNumber: number;
  repo?: string;
}

// GET /api/grouping/status - Check if opencode binary is available
app.get('/status', async (c) => {
  const available = await checkOpencodeBinary();
  return c.json({ available });
});

// POST /api/grouping/generate - Generate intelligent grouping for a PR
app.post('/generate', async (c) => {
  const result = await safeJson<GroupingBody>(c);
  if (!result.ok) return result.response;
  
  const { prNumber, repo } = result.data;

  if (!isPositiveInt(prNumber)) {
    return c.json({ error: 'prNumber must be a positive integer' }, 400);
  }

  try {
    // Get repo from body or try to detect current repo
    let targetRepo = repo;
    if (!targetRepo) {
      targetRepo = await getCurrentRepo() ?? undefined;
    }

    if (!targetRepo) {
      return c.json({ error: 'Repository is required. Provide repo in request or run from a git repository.' }, 400);
    }

    // Build the PR link
    const prLink = buildPRLink(targetRepo, prNumber);

    console.log(`Generating grouping for PR: ${prLink}`);

    // Generate grouping using opencode CLI
    const groupingResult = await generateGrouping(prLink);

    return c.json(groupingResult);
  } catch (error) {
    console.error('Grouping generation failed:', error);
    return c.json(
      { 
        error: 'Failed to generate grouping', 
        details: (error as Error).message 
      }, 
      500
    );
  }
});

export default app;
