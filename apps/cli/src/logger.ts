/**
 * Beautiful terminal logger for CLI
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
  star: '\u2605',    // Star
  spinner: ['\u280B', '\u2819', '\u2839', '\u2838', '\u283C', '\u2834', '\u2826', '\u2827', '\u2807', '\u280F'],
};

function colorize(text: string, ...codes: string[]): string {
  return `${codes.join('')}${text}${colors.reset}`;
}

function timestamp(): string {
  return colorize(new Date().toLocaleTimeString('en-US', { hour12: false }), colors.dim);
}

export const logger = {
  /**
   * Success message with green checkmark
   */
  success(message: string): void {
    console.log(`  ${colorize(symbols.success, colors.green)} ${message}`);
  },

  /**
   * Error message with red X
   */
  error(message: string, details?: string): void {
    console.error(`  ${colorize(symbols.error, colors.red)} ${colorize(message, colors.red)}`);
    if (details) {
      console.error(`    ${colorize(details, colors.dim)}`);
    }
  },

  /**
   * Warning message with yellow warning sign
   */
  warn(message: string): void {
    console.log(`  ${colorize(symbols.warning, colors.yellow)} ${colorize(message, colors.yellow)}`);
  },

  /**
   * Info message with blue info icon
   */
  info(message: string): void {
    console.log(`  ${colorize(symbols.info, colors.blue)} ${message}`);
  },

  /**
   * Step/progress message with arrow
   */
  step(message: string): void {
    console.log(`  ${colorize(symbols.arrow, colors.cyan)} ${message}`);
  },

  /**
   * Dim/secondary message
   */
  dim(message: string): void {
    console.log(`    ${colorize(message, colors.dim)}`);
  },

  /**
   * Header/title with bold styling
   */
  header(title: string): void {
    console.log();
    console.log(`  ${colorize(title, colors.bold, colors.white)}`);
    console.log(`  ${colorize('\u2500'.repeat(title.length), colors.dim)}`);
  },

  /**
   * Box with content for important messages
   */
  box(title: string, lines: string[]): void {
    const maxLen = Math.max(title.length, ...lines.map(l => l.length));
    const border = '\u2500'.repeat(maxLen + 2);
    
    console.log();
    console.log(`  ${colorize('\u256D' + border + '\u256E', colors.cyan)}`);
    console.log(`  ${colorize('\u2502', colors.cyan)} ${colorize(title.padEnd(maxLen), colors.bold)} ${colorize('\u2502', colors.cyan)}`);
    console.log(`  ${colorize('\u251C' + border + '\u2524', colors.cyan)}`);
    for (const line of lines) {
      console.log(`  ${colorize('\u2502', colors.cyan)} ${line.padEnd(maxLen)} ${colorize('\u2502', colors.cyan)}`);
    }
    console.log(`  ${colorize('\u2570' + border + '\u256F', colors.cyan)}`);
  },

  /**
   * Key-value pair display
   */
  keyValue(key: string, value: string): void {
    console.log(`    ${colorize(key + ':', colors.dim)} ${value}`);
  },

  /**
   * Blank line
   */
  newline(): void {
    console.log();
  },

  /**
   * Prefixed log (for subprocess output)
   */
  prefixed(prefix: string, message: string, isError = false): void {
    const prefixStr = colorize(`[${prefix}]`, colors.magenta);
    if (isError) {
      console.error(`  ${prefixStr} ${colorize(message, colors.dim)}`);
    } else {
      console.log(`  ${prefixStr} ${colorize(message, colors.dim)}`);
    }
  },

  /**
   * Ready/complete message with star
   */
  ready(message: string): void {
    console.log();
    console.log(`  ${colorize(symbols.star, colors.brightYellow)} ${colorize(message, colors.bold, colors.brightGreen)}`);
  },

  /**
   * Shutdown/cleanup message
   */
  shutdown(message: string): void {
    console.log(`  ${colorize(symbols.bullet, colors.gray)} ${colorize(message, colors.gray)}`);
  },

  /**
   * Debug message (only in development)
   */
  debug(message: string): void {
    if (process.env.DEBUG) {
      console.log(`  ${colorize('[debug]', colors.gray)} ${colorize(message, colors.dim)}`);
    }
  },
};

export default logger;
