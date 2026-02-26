import { Command } from 'commander';
import open from 'open';
import { OpencodeLauncher } from './opencode-launcher.js';
import { logger } from './logger.js';
import { checkGitRepo, fetchBranches } from './git.js';
import { checkGhCLI, getCurrentRepo, getPRInfo, getPRsRequestingReview } from './github.js';
import { parsePRInput, selectPR } from './pr-utils.js';
import { startServer } from './server.js';
import {
  setOpencodeLauncher,
  setServerProcess,
  getOpencodeLauncher,
  shutdown,
  registerShutdownHandlers,
} from './shutdown.js';
import type { PRInfoResult } from './types.js';

const program = new Command();

// Register signal handlers
registerShutdownHandlers();

async function main() {
  program
    .name('clm')
    .description('Local CLI tool for reviewing GitHub PRs with AI assistance')
    .version('1.0.0')
    .argument('[pr]', 'GitHub PR number or URL (e.g., 123 or https://github.com/owner/repo/pull/123)')
    .action(async (prInput?: string) => {
      logger.header('CLM');

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

      // Get current repository
      const currentRepo = await getCurrentRepo();
      if (!currentRepo) {
        logger.error('Could not determine repository', 'Please run from a git repository with a GitHub remote');
        process.exit(1);
      }

      logger.success(`Repository: ${currentRepo}`);

      let prNumber: string;
      let repo: string = currentRepo;

      // If no PR input provided, fetch PRs requesting review and let user select
      if (!prInput) {
        try {
          const prs = await getPRsRequestingReview(currentRepo);

          if (prs.length === 0) {
            logger.warn('No PRs requesting your review in this repository');
            process.exit(0);
          }

          logger.success(`Found ${prs.length} PR(s) requesting your review`);
          logger.newline();

          const selectedPR = await selectPR(prs);
          prNumber = String(selectedPR.number);

          logger.newline();
          logger.step(`Selected PR #${prNumber}: ${selectedPR.title}`);
        } catch (error) {
          logger.error('Failed to fetch PRs', (error as Error).message);
          process.exit(1);
        }
      } else {
        const parsed = parsePRInput(prInput);
        prNumber = parsed.prNumber;

        // Validate repo from URL matches current repo
        if (parsed.repo && parsed.repo !== currentRepo) {
          logger.error(
            `Repository mismatch`,
            `URL repo (${parsed.repo}) does not match current repo (${currentRepo})`
          );
          process.exit(1);
        }
      }

      logger.step(`Reviewing PR #${prNumber}`);

      // Get PR branch info
      let prInfo: PRInfoResult;
      try {
        prInfo = await getPRInfo(prNumber, repo);
        logger.success(`PR branches: ${prInfo.baseBranch} ← ${prInfo.headBranch}`);
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
      let opencodeLauncher: OpencodeLauncher;
      try {
        opencodeLauncher = new OpencodeLauncher();
        setOpencodeLauncher(opencodeLauncher);
        const opencodeInfo = await opencodeLauncher.start();
        logger.success(`OpenCode server started on ${opencodeInfo.baseUrl}`);
      } catch (error) {
        logger.error('Failed to start OpenCode', (error as Error).message);
        process.exit(1);
      }

      // Start the server
      try {
        const serverProcess = await startServer({
          prNumber,
          opencodeUrl: opencodeLauncher.baseUrl,
          repo,
          baseRef: prInfo.baseBranch,
          headRef: prInfo.headBranch,
        });
        setServerProcess(serverProcess);
      } catch (error) {
        logger.error('Failed to start server', (error as Error).message);
        await shutdown();
        process.exit(1);
      }

      const url = 'http://localhost:3000';

      // Open browser
      try {
        await open(url);
        logger.success(`Browser opened: ${url}`);
      } catch {
        logger.warn('Could not open browser automatically');
        logger.dim(`Please open ${url} manually`);
      }

      logger.ready('CLM is ready!');
      logger.dim('Press Ctrl+C to stop');
    });

  await program.parseAsync(process.argv);
}

export { main };
