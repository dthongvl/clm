import { Hono } from 'hono';
import { findRelatedFiles } from '../services/related-files.js';
import { getCurrentRepo } from '../services/gh.js';
import { safeJson, isPositiveInt } from '../utils/request.js';

const app = new Hono();

interface RelatedFilesBody {
  prNumber: number;
  repo?: string;
}

// POST /api/related-files/analyze - Find related files for a PR
app.post('/analyze', async (c) => {
  const result = await safeJson<RelatedFilesBody>(c);
  if (!result.ok) return result.response;
  
  const { prNumber, repo } = result.data;

  if (!isPositiveInt(prNumber)) {
    return c.json({ error: 'prNumber must be a positive integer' }, 400);
  }

  try {
    let targetRepo = repo;
    if (!targetRepo) {
      targetRepo = await getCurrentRepo() ?? undefined;
    }

    if (!targetRepo) {
      return c.json({ error: 'Repository is required. Provide repo in request or run from a git repository.' }, 400);
    }

    const prLink = buildPRLink(targetRepo, prNumber);

    console.log(`Finding related files for PR: ${prLink}`);

    const result = await findRelatedFiles(prLink);

    return c.json(result);
  } catch (error) {
    console.error('Related files analysis failed:', error);
    return c.json(
      { 
        error: 'Failed to find related files', 
        details: (error as Error).message 
      }, 
      500
    );
  }
});

function buildPRLink(repo: string, prNumber: number): string {
  if (repo.startsWith('http')) {
    return `${repo}/pull/${prNumber}`;
  }
  return `https://github.com/${repo}/pull/${prNumber}`;
}

export default app;
