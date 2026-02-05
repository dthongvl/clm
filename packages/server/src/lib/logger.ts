/**
 * Beautiful terminal logger for Server
 * Uses ANSI colors for rich, human-readable output
 */

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  
  // Foreground colors
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  
  // Bright colors
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
};

// Symbols for visual feedback
const symbols = {
  success: '\u2714', // Heavy check mark
  error: '\u2718',   // Heavy ballot X
  warning: '\u26A0', // Warning sign  
  info: '\u2139',    // Information source
  arrow: '\u2192',   // Right arrow
  bullet: '\u2022',  // Bullet point
  server: '\u25CF',  // Black circle (server indicator)
};

function colorize(text: string, ...codes: string[]): string {
  return `${codes.join('')}${text}${colors.reset}`;
}

function timestamp(): string {
  return colorize(
    new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    colors.dim
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export const logger = {
  /**
   * Server startup message
   */
  serverStart(port: number): void {
    console.log();
    console.log(`  ${colorize(symbols.server, colors.brightGreen)} ${colorize('Server running', colors.bold)} on ${colorize(`http://localhost:${port}`, colors.cyan)}`);
    console.log();
  },

  /**
   * Request logging (replaces Hono logger)
   */
  request(method: string, path: string, status: number, duration: number): void {
    const methodColor = {
      GET: colors.green,
      POST: colors.blue,
      PUT: colors.yellow,
      DELETE: colors.red,
      PATCH: colors.magenta,
    }[method] || colors.white;
    
    const statusColor = status >= 500 ? colors.red 
      : status >= 400 ? colors.yellow 
      : status >= 300 ? colors.cyan 
      : colors.green;

    const methodStr = colorize(method.padEnd(6), methodColor);
    const pathStr = path.length > 50 ? path.slice(0, 47) + '...' : path;
    const statusStr = colorize(String(status), statusColor);
    const durationStr = colorize(formatDuration(duration), colors.dim);

    console.log(`  ${timestamp()} ${methodStr} ${pathStr.padEnd(50)} ${statusStr} ${durationStr}`);
  },

  /**
   * Success message with green checkmark
   */
  success(message: string): void {
    console.log(`  ${timestamp()} ${colorize(symbols.success, colors.green)} ${message}`);
  },

  /**
   * Error message with details
   */
  error(context: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`  ${timestamp()} ${colorize(symbols.error, colors.red)} ${colorize(context, colors.red)}`);
    console.error(`             ${colorize(message, colors.dim)}`);
    
    // Log stack trace in debug mode
    if (process.env.DEBUG && error instanceof Error && error.stack) {
      const stackLines = error.stack.split('\n').slice(1, 4);
      for (const line of stackLines) {
        console.error(`             ${colorize(line.trim(), colors.dim)}`);
      }
    }
  },

  /**
   * Warning message
   */
  warn(message: string): void {
    console.log(`  ${timestamp()} ${colorize(symbols.warning, colors.yellow)} ${colorize(message, colors.yellow)}`);
  },

  /**
   * Info message
   */
  info(message: string): void {
    console.log(`  ${timestamp()} ${colorize(symbols.info, colors.blue)} ${message}`);
  },

  /**
   * Debug message (only shown when DEBUG env is set)
   */
  debug(message: string): void {
    if (process.env.DEBUG) {
      console.log(`  ${timestamp()} ${colorize('[debug]', colors.gray)} ${colorize(message, colors.dim)}`);
    }
  },

  /**
   * Operation start (for long-running operations)
   */
  operationStart(operation: string): void {
    console.log(`  ${timestamp()} ${colorize(symbols.arrow, colors.cyan)} ${operation}...`);
  },

  /**
   * Operation complete
   */
  operationEnd(operation: string, duration?: number): void {
    const durationStr = duration ? ` ${colorize(`(${formatDuration(duration)})`, colors.dim)}` : '';
    console.log(`  ${timestamp()} ${colorize(symbols.success, colors.green)} ${operation} complete${durationStr}`);
  },

  /**
   * AI/LLM operation logging
   */
  ai(operation: string, model?: string): void {
    const modelStr = model ? colorize(` [${model}]`, colors.magenta) : '';
    console.log(`  ${timestamp()} ${colorize('\u2728', colors.brightMagenta)} ${operation}${modelStr}`);
  },

  /**
   * GitHub operation logging
   */
  github(operation: string): void {
    console.log(`  ${timestamp()} ${colorize('\u{1F419}', colors.white)} ${operation}`);
  },
};

/**
 * Custom Hono logger middleware for beautiful request logging
 */
export function createLoggerMiddleware() {
  return async (c: { req: { method: string; path: string }; res: { status: number } }, next: () => Promise<void>) => {
    const start = Date.now();
    await next();
    const duration = Date.now() - start;
    logger.request(c.req.method, c.req.path, c.res.status, duration);
  };
}

export default logger;
