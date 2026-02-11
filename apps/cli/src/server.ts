import type { Subprocess } from 'bun';
import { resolve } from 'node:path';
import type { ServerEnv } from './types.js';

export async function startServer(env: ServerEnv): Promise<Subprocess> {
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

export async function waitForServerHealth(): Promise<void> {
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
