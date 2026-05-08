/**
 * Application logger backed by LogTape
 * Provides categorized, structured logging with pretty terminal output.
 */

import { getLogger } from '@logtape/logtape';

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

// Category-specific loggers
const opLogger = getLogger(['clm', 'operation']);
const aiLogger = getLogger(['clm', 'ai']);
const ghLogger = getLogger(['clm', 'github']);
const successLogger = getLogger(['clm', 'success']);
const errorLogger = getLogger(['clm', 'error']);

export const logger = {
  /**
   * Server startup banner (kept as direct console output for visual impact)
   */
  serverStart(port: number): void {
    console.log();
    console.log(`  🟢 Server running on http://localhost:${port}`);
    console.log();
  },

  /**
   * Success message
   */
  success(message: string): void {
    successLogger.info`\u2714 ${message}`;
  },

  /**
   * Error message with full stack trace and cause chain
   */
  error(context: string, err: unknown): void {
    const message = err instanceof Error ? err.message : String(err);
    errorLogger.error`${context}: ${message}`;

    if (err instanceof Error && err.stack) {
      const stackLines = err.stack.split('\n').slice(1, 11);
      errorLogger.debug`Stack:\n${stackLines.map((l) => l.trim()).join('\n')}`;
    }

    if (err instanceof Error && err.cause) {
      const causeMsg = err.cause instanceof Error ? err.cause.message : String(err.cause);
      errorLogger.error`Caused by: ${causeMsg}`;
      if (err.cause instanceof Error && err.cause.stack) {
        const causeStackLines = err.cause.stack.split('\n').slice(1, 6);
        errorLogger.debug`Cause stack:\n${causeStackLines.map((l) => l.trim()).join('\n')}`;
      }
    }
  },

  /**
   * Warning message
   */
  warn(message: string): void {
    getLogger(['clm', 'warn']).warn`\u26A0 ${message}`;
  },

  /**
   * Info message
   */
  info(message: string): void {
    getLogger(['clm', 'info']).info`\u2139 ${message}`;
  },

  /**
   * Debug message (only shown when DEBUG env is set)
   */
  debug(message: string): void {
    if (process.env.DEBUG) {
      getLogger(['clm', 'debug']).debug`[debug] ${message}`;
    }
  },

  /**
   * Operation start
   */
  operationStart(operation: string): void {
    opLogger.info`\u2192 ${operation}...`;
  },

  /**
   * Operation complete
   */
  operationEnd(operation: string, duration?: number): void {
    const suffix = duration ? ` (${formatDuration(duration)})` : '';
    opLogger.info`\u2714 ${operation} complete${suffix}`;
  },

  /**
   * AI/LLM operation logging
   */
  ai(operation: string, model?: string): void {
    const modelStr = model ? ` [${model}]` : '';
    aiLogger.info`\u2728 ${operation}${modelStr}`;
  },

  /**
   * GitHub operation logging
   */
  github(operation: string): void {
    ghLogger.info`\u{1F419} ${operation}`;
  },
};

export default logger;
