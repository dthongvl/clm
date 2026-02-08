import { Hono } from 'hono';
import { verifyPatterns } from '../services/pattern-verification.js';
import { getCurrentRepo } from '../services/gh.js';
import { buildPRLink } from '../utils/github.js';
import { safeJson, isPositiveInt } from '../utils/request.js';
import { logger } from '../lib/logger.js';

const app = new Hono();

interface PatternVerificationBody {
  prNumber: number;
  repo?: string;
}

async function handleVerification(prNumber: number, repo: string) {
  const prLink = buildPRLink(repo, prNumber);
  return verifyPatterns(prLink);
}

app.post('/', async (c) => {
  const result = await safeJson<PatternVerificationBody>(c);
  if (!result.ok) return result.response;

  const { prNumber, repo } = result.data;

  if (!isPositiveInt(prNumber)) {
    return c.json({ error: 'prNumber must be a positive integer' }, 400);
  }

  let targetRepo = repo;
  if (!targetRepo) {
    targetRepo = await getCurrentRepo() ?? undefined;
  }
  if (!targetRepo) {
    return c.json({ error: 'Repository is required.' }, 400);
  }

  try {
    logger.ai(`Verifying patterns for PR #${prNumber}`);
    const verificationResult = await handleVerification(prNumber, targetRepo);
    return c.json(verificationResult);
  } catch (error) {
    logger.error('Pattern verification failed', error);
    return c.json({ error: 'Failed to verify patterns', details: (error as Error).message }, 500);
  }
});

export default app;
