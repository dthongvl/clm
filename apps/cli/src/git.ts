import { logger } from './logger.js';

export async function checkGitRepo(): Promise<boolean> {
  try {
    const result = await Bun.$`git rev-parse --git-dir`.quiet();
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

export async function fetchBranches(base: string, head: string): Promise<void> {
  logger.step(`Fetching branches: ${base}, ${head}`);

  const result = await Bun.$`git fetch origin ${base} ${head}`.quiet();

  if (result.exitCode !== 0) {
    throw new Error(`Failed to fetch branches: ${result.stderr.toString()}`);
  }
}
