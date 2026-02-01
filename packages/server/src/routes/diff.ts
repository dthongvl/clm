import { Hono } from 'hono';
import { getPRDiff, getFileContent, getCurrentRepo, getPRInfo } from '../services/gh.js';
import { parsePositiveInt } from '../utils/request.js';
import type { FileDiff } from '../types/index.js';

const app = new Hono();

// Concurrency limit for file content fetching to avoid rate limits
const MAX_CONCURRENT_FETCHES = 5;

/**
 * Process items with limited concurrency
 */
async function processWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  processor: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  const executing: Promise<void>[] = [];

  for (const item of items) {
    const promise = processor(item).then((result) => {
      results.push(result);
    });
    
    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
      // Remove completed promises
      for (let i = executing.length - 1; i >= 0; i--) {
        const p = executing[i];
        // Check if promise is settled by racing with an immediate resolve
        const settled = await Promise.race([
          p.then(() => true).catch(() => true),
          Promise.resolve(false),
        ]);
        if (settled) {
          executing.splice(i, 1);
        }
      }
    }
  }

  await Promise.all(executing);
  return results;
}

// GET /api/diff?pr={number}&repo={owner/repo}&includeContent={true|false}
app.get('/', async (c) => {
  const prNumberStr = c.req.query('pr');
  const repo = c.req.query('repo') || await getCurrentRepo();
  const includeContent = c.req.query('includeContent') === 'true';

  const prNumber = parsePositiveInt(prNumberStr);
  if (!prNumber) {
    return c.json({ error: 'PR number must be a positive integer' }, 400);
  }

  if (!repo) {
    return c.json({ error: 'Repository not found. Please specify repo parameter or run from a git repository.' }, 400);
  }

  try {
    const files = await getPRDiff(prNumber, repo);

    // Optionally fetch full file content for base and head branches
    if (includeContent) {
      const prInfo = await getPRInfo(prNumber, repo);
      console.log(`Fetching content for PR #${prNumber}, base: ${prInfo.baseBranch}, head: ${prInfo.headBranch}, repo: ${repo}`);
      
      // Build list of content fetch tasks
      const fetchTasks: { file: FileDiff; branch: string; type: 'base' | 'head' }[] = [];
      
      for (const file of files) {
        if (file.status !== 'removed') {
          fetchTasks.push({ file, branch: prInfo.headBranch, type: 'head' });
        }
        if (file.status !== 'added') {
          fetchTasks.push({ file, branch: prInfo.baseBranch, type: 'base' });
        }
      }

      // Fetch with concurrency limit to avoid rate limiting
      await processWithConcurrency(fetchTasks, MAX_CONCURRENT_FETCHES, async (task) => {
        const content = await getFileContent(task.file.filename, task.branch, repo);
        if (task.type === 'head') {
          task.file.headContent = content;
        } else {
          task.file.baseContent = content;
        }
      });
    }

    return c.json({ files });
  } catch (error) {
    console.error('Failed to fetch diff:', error);
    return c.json({ error: 'Failed to fetch PR diff', details: (error as Error).message }, 500);
  }
});

// GET /api/diff/file?pr={number}&repo={owner/repo}&filename={path}
app.get('/file', async (c) => {
  const prNumberStr = c.req.query('pr');
  const repo = c.req.query('repo') || await getCurrentRepo();
  const filename = c.req.query('filename');

  const prNumber = parsePositiveInt(prNumberStr);
  if (!prNumber) {
    return c.json({ error: 'PR number must be a positive integer' }, 400);
  }

  if (!filename) {
    return c.json({ error: 'filename is required' }, 400);
  }

  if (!repo) {
    return c.json({ error: 'Repository not found' }, 400);
  }

  try {
    const prInfo = await getPRInfo(prNumber, repo);
    
    const [baseContent, headContent] = await Promise.all([
      getFileContent(filename, prInfo.baseBranch, repo),
      getFileContent(filename, prInfo.headBranch, repo),
    ]);

    return c.json({
      filename,
      base: { branch: prInfo.baseBranch, content: baseContent },
      head: { branch: prInfo.headBranch, content: headContent },
    });
  } catch (error) {
    console.error('Failed to fetch file:', error);
    return c.json({ error: 'Failed to fetch file content', details: (error as Error).message }, 500);
  }
});

export default app;
