import type { Subprocess } from 'bun';
import { resolve } from 'node:path';
import type { ServerEnv } from './types.js';

export interface ServerResult {
  process: Subprocess;
  port: number;
}

export async function startServer(env: ServerEnv): Promise<ServerResult> {
  const serverPath = resolve(import.meta.dir, '../../../packages/server/src/index.ts');

  const server = Bun.spawn(['bun', 'run', serverPath], {
    stdin: 'inherit',
    stdout: 'pipe',
    stderr: 'inherit',
    env: {
      ...process.env,
      PR_NUMBER: env.prNumber,
      ...(env.opencodeUrl ? { OPENCODE_URL: env.opencodeUrl } : {}),
      REPO: env.repo,
      BASE_REF: `origin/${env.baseRef}`,
      HEAD_REF: `origin/${env.headRef}`,
    },
  });

  // Wait for server to output its port
  const port = await waitForServerPort(server);

  // Wait for server to be ready
  await waitForServerHealth(port);

  return { process: server, port };
}

async function waitForServerPort(server: Subprocess): Promise<number> {
  const reader = server.stdout.getReader();
  const decoder = new TextDecoder();
  const startTime = Date.now();
  const timeout = 10_000;
  let buffer = '';

  while (Date.now() - startTime < timeout) {
    const { value, done } = await reader.read();
    if (done) break;

    const text = decoder.decode(value);
    buffer += text;

    // Check for port marker
    const match = buffer.match(/__CLM_PORT__:(\d+)/);
    if (match) {
      const port = parseInt(match[1], 10);
      // Continue piping remaining output to console
      pipeRemainingOutput(reader, buffer.replace(/__CLM_PORT__:\d+\n?/, ''));
      return port;
    }
  }

  throw new Error('Server failed to output port');
}

async function pipeRemainingOutput(reader: ReadableStreamDefaultReader<Uint8Array>, initialOutput: string): Promise<void> {
  const decoder = new TextDecoder();

  // Output any buffered content (excluding the port marker)
  if (initialOutput.trim()) {
    console.log(initialOutput);
  }

  // Continue reading and outputting
  (async () => {
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        process.stdout.write(decoder.decode(value));
      }
    } catch {
      // Stream closed
    }
  })();
}

export async function waitForServerHealth(port: number): Promise<void> {
  const healthUrl = `http://localhost:${port}/api/health`;
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
