import type { Subprocess } from 'bun';
import type { OpencodeLauncher } from './opencode-launcher.js';
import { logger } from './logger.js';

let opencodeLauncher: OpencodeLauncher | null = null;
let serverProcess: Subprocess | null = null;
let isShuttingDown = false;

export function setOpencodeLauncher(launcher: OpencodeLauncher | null): void {
  opencodeLauncher = launcher;
}

export function setServerProcess(process: Subprocess | null): void {
  serverProcess = process;
}

export function getOpencodeLauncher(): OpencodeLauncher | null {
  return opencodeLauncher;
}

export async function shutdown(): Promise<void> {
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

export function registerShutdownHandlers(): void {
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
