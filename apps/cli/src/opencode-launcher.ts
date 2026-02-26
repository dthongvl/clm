import type { Subprocess } from 'bun';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { logger } from './logger.js';

const OPENCODE_BINARY = process.env.OPENCODE_BINARY || 'opencode';
const OPENCODE_PORT = parseInt(process.env.OPENCODE_PORT || '4096', 10);
const OPENCODE_HOSTNAME = process.env.OPENCODE_HOSTNAME || '127.0.0.1';
const HEALTH_CHECK_TIMEOUT_MS = 30_000;
const HEALTH_CHECK_INTERVAL_MS = 500;

const PID_FILE = join(tmpdir(), 'clm-opencode.json');

export interface OpencodeInfo {
  pid: number;
  port: number;
  hostname: string;
  baseUrl: string;
}

export class OpencodeLauncher {
  private process: Subprocess | null = null;
  private info: OpencodeInfo | null = null;

  get baseUrl(): string {
    return `http://${OPENCODE_HOSTNAME}:${OPENCODE_PORT}`;
  }

  async start(): Promise<OpencodeInfo> {
    logger.step(`Starting OpenCode server on ${this.baseUrl}`);

    this.process = Bun.spawn([
      OPENCODE_BINARY,
      'serve',
      '--port', String(OPENCODE_PORT),
      '--hostname', OPENCODE_HOSTNAME,
    ], {
      stdin: 'ignore',
      stdout: 'pipe',
      stderr: 'pipe',
    });

    // Forward logs
    this.forwardLogs();

    // Wait for health check
    await this.waitForHealth();

    this.info = {
      pid: this.process.pid,
      port: OPENCODE_PORT,
      hostname: OPENCODE_HOSTNAME,
      baseUrl: this.baseUrl,
    };

    // Write PID file
    await this.writePidFile();

    logger.debug('OpenCode server ready');
    return this.info;
  }

  private forwardLogs(): void {
    if (!this.process) return;

    const { stdout, stderr } = this.process;

    if (stdout && typeof stdout !== 'number') {
      (async () => {
        const reader = stdout.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value).trim();
          if (text) logger.prefixed('opencode', text);
        }
      })();
    }

    if (stderr && typeof stderr !== 'number') {
      (async () => {
        const reader = stderr.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value).trim();
          if (text) logger.prefixed('opencode', text, true);
        }
      })();
    }
  }

  private async waitForHealth(): Promise<void> {
    const healthUrl = `${this.baseUrl}/global/health`;
    const startTime = Date.now();

    while (Date.now() - startTime < HEALTH_CHECK_TIMEOUT_MS) {
      try {
        const resp = await fetch(healthUrl, { signal: AbortSignal.timeout(2000) });
        if (resp.ok) {
          const data = await resp.json() as { healthy?: boolean };
          if (data.healthy) return;
        }
      } catch {
        // Connection refused - server not ready yet
      }
      await Bun.sleep(HEALTH_CHECK_INTERVAL_MS);
    }

    throw new Error('OpenCode server failed to become healthy');
  }

  private async writePidFile(): Promise<void> {
    if (this.info) {
      await Bun.write(PID_FILE, JSON.stringify(this.info, null, 2));
      logger.debug(`PID file written: ${PID_FILE}`);
    }
  }

  private async cleanup(): Promise<void> {
    try {
      const file = Bun.file(PID_FILE);
      if (await file.exists()) {
        await Bun.$`rm ${PID_FILE}`.quiet();
      }
    } catch {
      // Ignore cleanup errors
    }
    this.process = null;
    this.info = null;
  }

  async shutdown(): Promise<void> {
    logger.shutdown('Stopping OpenCode...');

    if (this.process) {
      this.process.kill();
      
      // Wait for process to exit with timeout
      await Promise.race([
        this.process.exited,
        Bun.sleep(5000),
      ]);
    }

    await this.cleanup();
    logger.shutdown('OpenCode stopped');
  }
}

export async function readPidFile(): Promise<OpencodeInfo | null> {
  try {
    const file = Bun.file(PID_FILE);
    if (await file.exists()) {
      const content = await file.text();
      return JSON.parse(content) as OpencodeInfo;
    }
  } catch {
    // Ignore read errors
  }
  return null;
}
