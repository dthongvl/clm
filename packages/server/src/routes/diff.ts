import { Hono } from 'hono';
import { getPRDiff, getFileContent, getCurrentRepo } from '../services/gh.js';
import type { FileDiff } from '../types/index.js';

const app = new Hono();

// GET /api/diff?pr={number}&repo={owner/repo}
app.get('/', async (c) => {
  const prNumber = c.req.query('pr');
  const repo = c.req.query('repo') || await getCurrentRepo();
  const includeContent = c.req.query('includeContent') === 'true';

  if (!prNumber) {
    return c.json({ error: 'PR number is required' }, 400);
  }

  if (!repo) {
    return c.json({ error: 'Repository not found. Please specify repo parameter or run from a git repository.' }, 400);
  }

  try {
    const files = await getPRDiff(parseInt(prNumber, 10), repo);

    // Optionally fetch full file content for base and head branches
    if (includeContent) {
      const prInfo = await import('../services/gh.js').then(m => m.getPRInfo(parseInt(prNumber, 10), repo));
      console.log(`Fetching content for PR #${prNumber}, base: ${prInfo.baseBranch}, head: ${prInfo.headBranch}, repo: ${repo}`);
      
      // Fetch content for all files in parallel for better performance
      await Promise.all(files.map(async (file) => {
        const contentPromises: Promise<void>[] = [];
        
        if (file.status !== 'removed') {
          contentPromises.push(
            getFileContent(file.filename, prInfo.headBranch, repo).then(content => {
              file.headContent = content;
            })
          );
        }
        if (file.status !== 'added') {
          contentPromises.push(
            getFileContent(file.filename, prInfo.baseBranch, repo).then(content => {
              file.baseContent = content;
            })
          );
        }
        
        await Promise.all(contentPromises);
      }));
    }

    return c.json({ files });
  } catch (error) {
    console.error('Failed to fetch diff:', error);
    return c.json({ error: 'Failed to fetch PR diff', details: (error as Error).message }, 500);
  }
});

// GET /api/diff/file?pr={number}&repo={owner/repo}&filename={path}
app.get('/file', async (c) => {
  const prNumber = c.req.query('pr');
  const repo = c.req.query('repo') || await getCurrentRepo();
  const filename = c.req.query('filename');

  if (!prNumber || !filename) {
    return c.json({ error: 'PR number and filename are required' }, 400);
  }

  if (!repo) {
    return c.json({ error: 'Repository not found' }, 400);
  }

  try {
    const { getPRInfo } = await import('../services/gh.js');
    const prInfo = await getPRInfo(parseInt(prNumber, 10), repo);
    
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
