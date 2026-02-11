import type { FileDiff } from '../types/index.js';
import { logger } from '../lib/logger.js';

/**
 * Run git command safely using Bun.spawn (no shell injection)
 */
async function runGit(args: string[], opts?: { timeoutMs?: number }): Promise<{ stdout: string; exitCode: number }> {
  const proc = Bun.spawn(['git', ...args], {
    cwd: process.cwd(),
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: opts?.timeoutMs ?? 30_000,
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (exitCode !== 0 && !args.includes('show')) {
    // show can fail for deleted files, that's expected
    throw new Error(stderr || stdout || `git exited with code ${exitCode}`);
  }

  return { stdout, exitCode };
}

/**
 * Parse unified diff output into FileDiff array
 */
function parseDiff(diffOutput: string): FileDiff[] {
  const files: FileDiff[] = [];
  const diffSections = diffOutput.split('diff --git');

  for (const section of diffSections.slice(1)) {
    const lines = section.trim().split('\n');
    const fileLine = lines[0];
    const match = fileLine.match(/a\/(.+) b\/(.+)/);

    if (match) {
      const oldFilename = match[1];
      const newFilename = match[2];
      let status: FileDiff['status'] = 'modified';

      if (section.includes('new file mode')) {
        status = 'added';
      } else if (section.includes('deleted file mode')) {
        status = 'removed';
      } else if (section.includes('rename from')) {
        status = 'renamed';
      }

      const patch = 'diff --git' + section;
      const additions = (section.match(/^\+[^+]/gm) || []).length;
      const deletions = (section.match(/^-[^-]/gm) || []).length;

      files.push({
        filename: newFilename,
        oldFilename: status === 'renamed' ? oldFilename : undefined,
        status,
        additions,
        deletions,
        patch,
      });
    }
  }

  return files;
}

/**
 * Get diff between two refs using local git
 */
export async function getDiff(baseRef: string, headRef: string): Promise<FileDiff[]> {
  const { stdout } = await runGit([
    'diff',
    '--no-color',
    '-M',  // Detect renames
    `${baseRef}...${headRef}`,
  ]);

  return parseDiff(stdout);
}

/**
 * Get file content at a specific ref using local git
 * Returns null if file doesn't exist at that ref (new/deleted files)
 */
export async function getFileContent(ref: string, filepath: string): Promise<string | null> {
  const { stdout, exitCode } = await runGit(['show', `${ref}:${filepath}`]);

  if (exitCode !== 0) {
    return null;  // File doesn't exist at this ref
  }

  return stdout;
}

/**
 * Check if current directory is a git repository
 */
export async function checkGitRepo(): Promise<boolean> {
  try {
    const { exitCode } = await runGit(['rev-parse', '--git-dir']);
    return exitCode === 0;
  } catch (error) {
    // Log the error for debugging - this helps distinguish permission errors from missing repo
    logger.debug(`checkGitRepo failed: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Verify a ref exists locally
 */
export async function verifyRef(ref: string): Promise<boolean> {
  try {
    const { exitCode } = await runGit(['rev-parse', '--verify', ref]);
    return exitCode === 0;
  } catch (error) {
    // Log the error for debugging - helps distinguish different failure modes
    logger.debug(`verifyRef failed for "${ref}": ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

/**
 * Fetch branches from origin
 */
export async function fetchBranches(baseBranch: string, headBranch: string): Promise<void> {
  await runGit(['fetch', 'origin', baseBranch, headBranch]);
}
