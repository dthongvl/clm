import { Command } from 'commander';
import open from 'open';
import type { Subprocess } from 'bun';
import { resolve } from 'node:path';
import { OpencodeLauncher } from './opencode-launcher.js';
import { logger } from './logger.js';

const program = new Command();

let opencodeLauncher: OpencodeLauncher | null = null;
let serverProcess: Subprocess | null = null;
let isShuttingDown = false;

async function checkGhCLI(): Promise<boolean> {
  try {
    const result = await Bun.$`gh --version`.quiet();
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

async function getCurrentRepo(): Promise<string | null> {
  try {
    const result = await Bun.$`gh repo view --json nameWithOwner -q .nameWithOwner`.quiet();
    if (result.exitCode === 0) {
      return result.text().trim();
    }
    return null;
  } catch {
    return null;
  }
}

async function fetchBranches(base: string, head: string): Promise<void> {
  logger.step(`Fetching branches: ${base}, ${head}`);

  const result = await Bun.$`git fetch origin ${base} ${head}`.quiet();

  if (result.exitCode !== 0) {
    throw new Error(`Failed to fetch branches: ${result.stderr.toString()}`);
  }
}

interface PRInfoResult {
  baseBranch: string;
  headBranch: string;
}

async function getPRInfo(prNumber: string, repo: string): Promise<PRInfoResult> {
  const result = await Bun.$`gh pr view ${prNumber} --repo ${repo} --json baseRefName,headRefName`.quiet();

  if (result.exitCode !== 0) {
    throw new Error(`Failed to get PR info: ${result.stderr.toString()}`);
  }

  const data = JSON.parse(result.text());
  return {
    baseBranch: data.baseRefName,
    headBranch: data.headRefName,
  };
}

async function checkGitRepo(): Promise<boolean> {
  try {
    const result = await Bun.$`git rev-parse --git-dir`.quiet();
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

interface ServerEnv {
  prNumber: string;
  opencodeUrl: string;
  repo: string;
  baseRef: string;
  headRef: string;
}

async function startServer(env: ServerEnv): Promise<Subprocess> {
  const serverPath = resolve(import.meta.dir, '../../../packages/server/src/index.ts');

  const server = Bun.spawn(['bun', 'run', serverPath], {
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
    env: {
      ...process.env,
      PR_NUMBER: env.prNumber,
      OPENCODE_URL: env.opencodeUrl,
      REPO: env.repo,
      BASE_REF: `origin/${env.baseRef}`,
      HEAD_REF: `origin/${env.headRef}`,
    },
  });

  // Wait for server to be ready
  await waitForServerHealth();

  return server;
}

async function waitForServerHealth(): Promise<void> {
  const healthUrl = 'http://localhost:3000/api/health';
  const startTime = Date.now();
  const timeout = 10_000;

  while (Date.now() - startTime < timeout) {
    try {
      const resp = await fetch(healthUrl, { signal: AbortSignal.timeout(1000) });
      if (resp.ok) return;
    } catch {
      // Server not ready yet
    }
    await Bun.sleep(200);
  }

  throw new Error('Server failed to become healthy');
}

async function shutdown(): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.newline();
  logger.shutdown('Shutting down...');

  // Kill server first
  if (serverProcess) {
    logger.shutdown('Stopping server...');
    serverProcess.kill();
    await Promise.race([
      serverProcess.exited,
      Bun.sleep(3000),
    ]);
  }

  // Then kill opencode
  if (opencodeLauncher) {
    await opencodeLauncher.shutdown();
  }

  logger.shutdown('Shutdown complete');
  process.exit(0);
}

// Register signal handlers
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

async function main() {
  program
    .name('codereview')
    .description('Local CLI tool for reviewing GitHub PRs with AI assistance')
    .version('1.0.0')
    .argument('<pr-number>', 'GitHub PR number to review')
    .option('-r, --repo <owner/repo>', 'GitHub repository (defaults to current repo)')
    .action(async (prNumber: string, options: { repo?: string }) => {
      logger.header(`Code Review for PR #${prNumber}`);

      // Check for gh CLI
      const hasGh = await checkGhCLI();
      if (!hasGh) {
        logger.error('GitHub CLI (gh) is not installed or not in PATH', 'Please install it from: https://cli.github.com/');
        process.exit(1);
      }

      logger.success('GitHub CLI found');

      // Check we're in a git repo
      const isGitRepo = await checkGitRepo();
      if (!isGitRepo) {
        logger.error('Not a git repository', 'Please run from within a git repository');
        process.exit(1);
      }

      logger.success('Git repository found');

      // Get repository
      const repo = options.repo || await getCurrentRepo();
      if (!repo) {
        logger.error('Could not determine repository', 'Please run from a git repository or specify --repo owner/repo');
        process.exit(1);
      }

      logger.success(`Repository: ${repo}`);

      // Get PR branch info
      let prInfo: PRInfoResult;
      try {
        prInfo = await getPRInfo(prNumber, repo);
        logger.success(`PR branches: ${prInfo.baseBranch} \u2190 ${prInfo.headBranch}`);
      } catch (error) {
        logger.error('Failed to fetch PR info', (error as Error).message);
        process.exit(1);
      }

      // Fetch branches locally
      try {
        await fetchBranches(prInfo.baseBranch, prInfo.headBranch);
        logger.success('Branches fetched');
      } catch (error) {
        logger.error('Failed to fetch branches', (error as Error).message);
        process.exit(1);
      }

      // Start opencode first
      try {
        opencodeLauncher = new OpencodeLauncher();
        const opencodeInfo = await opencodeLauncher.start();
        logger.success(`OpenCode server started on ${opencodeInfo.baseUrl}`);
      } catch (error) {
        logger.error('Failed to start OpenCode', (error as Error).message);
        process.exit(1);
      }

      // Start the server
      try {
        serverProcess = await startServer({
          prNumber,
          opencodeUrl: opencodeLauncher.baseUrl,
          repo,
          baseRef: prInfo.baseBranch,
          headRef: prInfo.headBranch,
        });
      } catch (error) {
        logger.error('Failed to start server', (error as Error).message);
        await shutdown();
        process.exit(1);
      }

      // Build URL with PR number and repo
      const params = new URLSearchParams({ pr: prNumber, repo });
      const url = `http://localhost:3000?${params.toString()}`;

      // Open browser
      try {
        await open(url);
        logger.success(`Browser opened: ${url}`);
      } catch {
        logger.warn('Could not open browser automatically');
        logger.dim(`Please open ${url} manually`);
      }

      logger.ready('Code review UI is ready!');
      logger.dim('Press Ctrl+C to stop');
    });

  await program.parseAsync(process.argv);
}

export { main };
