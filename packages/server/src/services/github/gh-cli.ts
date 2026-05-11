/**
 * Thin wrapper around the `gh` CLI for the few operations we still shell out
 * for: --version probe, repo discovery, and `gh auth token`. All other GitHub
 * traffic uses Octokit (see ../../lib/octokit.ts).
 */

/**
 * Run gh CLI command safely using Bun.spawn (no shell injection)
 */
export async function runGh(
  args: string[],
  opts?: { timeoutMs?: number; input?: string },
): Promise<string> {
  const proc = Bun.spawn(['gh', ...args], {
    stdin: opts?.input ? 'pipe' : null,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: opts?.timeoutMs ?? 120_000,
  });

  if (opts?.input && proc.stdin) {
    proc.stdin.write(opts.input);
    proc.stdin.end();
  }

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (exitCode !== 0) {
    const parts = [stderr, stdout].filter(Boolean).join('\n');
    throw new Error(parts || `gh exited with code ${exitCode}`);
  }

  return stdout;
}

export async function checkGhCli(): Promise<boolean> {
  try {
    await runGh(['--version']);
    return true;
  } catch {
    return false;
  }
}

export async function getCurrentRepo(): Promise<string | null> {
  try {
    const stdout = await runGh([
      'repo', 'view',
      '--json', 'nameWithOwner',
      '-q', '.nameWithOwner',
    ]);
    return stdout.trim();
  } catch {
    return null;
  }
}

/**
 * Get the current GitHub CLI authentication token.
 *
 * Prefer reading from `process.env.GITHUB_TOKEN` (set during boot by
 * `loadGhToken()`); fall back to spawning `gh auth token` for any caller that
 * runs before bootstrap.
 */
export async function getGhAuthToken(): Promise<string> {
  const fromEnv = process.env.GITHUB_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  return (await runGh(['auth', 'token'])).trim();
}
