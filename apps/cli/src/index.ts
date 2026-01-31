import { Command } from 'commander';
import { execa } from 'execa';
import open from 'open';
import { spawn } from 'node:child_process';
import path from 'node:path';

const program = new Command();

async function checkGhCLI(): Promise<boolean> {
  try {
    await execa('gh', ['--version']);
    return true;
  } catch {
    return false;
  }
}

async function getCurrentRepo(): Promise<string | null> {
  try {
    const { stdout } = await execa('gh', ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner']);
    return stdout.trim();
  } catch {
    return null;
  }
}

async function startServer(prNumber: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const serverPath = path.resolve(__dirname, '../../../packages/server/src/index.ts');
    
    const server = spawn('bun', ['run', serverPath, prNumber], {
      stdio: 'inherit',
      env: { ...process.env, PR_NUMBER: prNumber }
    });

    server.on('error', (error) => {
      reject(new Error(`Failed to start server: ${error.message}`));
    });

    // Wait a moment for server to start then resolve
    setTimeout(() => {
      resolve();
    }, 2000);
  });
}

async function main() {
  program
    .name('codereview')
    .description('Local CLI tool for reviewing GitHub PRs with AI assistance')
    .version('1.0.0')
    .argument('<pr-number>', 'GitHub PR number to review')
    .option('-r, --repo <owner/repo>', 'GitHub repository (defaults to current repo)')
    .action(async (prNumber: string, options: { repo?: string }) => {
      console.log(`Starting code review for PR #${prNumber}...`);

      // Check for gh CLI
      const hasGh = await checkGhCLI();
      if (!hasGh) {
        console.error('Error: GitHub CLI (gh) is not installed or not in PATH');
        console.error('Please install it from: https://cli.github.com/');
        process.exit(1);
      }

      console.log('✓ GitHub CLI found');

      // Get repository
      const repo = options.repo || await getCurrentRepo();
      if (!repo) {
        console.error('Error: Could not determine repository.');
        console.error('Please run from a git repository or specify --repo owner/repo');
        process.exit(1);
      }

      console.log(`✓ Repository: ${repo}`);

      // Start the server
      try {
        await startServer(prNumber);
        console.log('✓ Server started on http://localhost:3000');
      } catch (error) {
        console.error('Error starting server:', error);
        process.exit(1);
      }

      // Build URL with PR number and repo
      const params = new URLSearchParams({ pr: prNumber, repo });
      const url = `http://localhost:3000?${params.toString()}`;

      // Open browser
      try {
        await open(url);
        console.log(`✓ Browser opened: ${url}`);
      } catch (error) {
        console.log('Note: Could not open browser automatically');
        console.log(`Please open ${url} manually`);
      }

      console.log('\nCode review UI is ready!');
      console.log('Press Ctrl+C to stop the server');
    });

  await program.parseAsync(process.argv);
}

export { main };
