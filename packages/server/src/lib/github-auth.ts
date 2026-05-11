/**
 * Acquires a GitHub token via the `gh` CLI at boot and exposes it to the
 * rest of the process (Octokit, child processes via GITHUB_TOKEN).
 */
import { logger } from './logger.js';

let cachedToken: string | null = null;

async function runGhAuthToken(): Promise<string> {
  const proc = Bun.spawn(['gh', 'auth', 'token'], {
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 10_000,
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (exitCode !== 0) {
    const detail = (stderr || stdout || '').trim();
    throw new Error(
      `\`gh auth token\` failed (exit ${exitCode}): ${detail || 'no output'}. ` +
        'Run `gh auth login` and try again.',
    );
  }

  const token = stdout.trim();
  if (!token) {
    throw new Error('`gh auth token` returned an empty token. Run `gh auth login`.');
  }
  return token;
}

/**
 * Load a GitHub token from the `gh` CLI and cache it. Also writes the token
 * to `process.env.GITHUB_TOKEN` so child tools (opencode, git, etc.) inherit
 * it — mirroring how `gh` itself exposes the token to subprocesses.
 *
 * Safe to call multiple times; subsequent calls are no-ops.
 */
export async function loadGhToken(): Promise<string> {
  if (cachedToken) return cachedToken;

  // Honour pre-existing GITHUB_TOKEN (e.g. CI) without invoking gh.
  const fromEnv = process.env.GITHUB_TOKEN?.trim();
  if (fromEnv) {
    cachedToken = fromEnv;
    logger.info('Using GITHUB_TOKEN from environment');
    return fromEnv;
  }

  const token = await runGhAuthToken();
  cachedToken = token;
  process.env.GITHUB_TOKEN = token;
  logger.info('Loaded GitHub token via `gh auth token`');
  return token;
}

export function getGhToken(): string {
  if (!cachedToken) {
    throw new Error('GitHub token not loaded. Call loadGhToken() during boot.');
  }
  return cachedToken;
}
