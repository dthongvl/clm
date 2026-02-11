/**
 * Custom error classes and utilities for better error handling
 */

export type ErrorCode =
  | 'UNKNOWN'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'SERVICE_UNAVAILABLE'
  | 'TIMEOUT'
  | 'GH_CLI_ERROR'
  | 'GH_API_ERROR'
  | 'GIT_ERROR'
  | 'AI_ERROR'
  | 'COMMENT_LOCATION_STALE'
  | 'PARSE_ERROR'
  | 'FILE_ERROR';

export interface ErrorDetails {
  /** Machine-readable error code */
  code: ErrorCode;
  /** Human-readable error message */
  message: string;
  /** Stack trace (included in development) */
  stack?: string;
  /** Original error message if wrapped */
  cause?: string;
  /** Additional context for debugging */
  context?: Record<string, unknown>;
}

/**
 * Application error with code and preserved stack trace
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly context?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    options?: {
      statusCode?: number;
      cause?: unknown;
      context?: Record<string, unknown>;
    }
  ) {
    super(message, { cause: options?.cause });
    this.name = 'AppError';
    this.code = code;
    this.statusCode = options?.statusCode ?? mapCodeToStatus(code);
    this.context = options?.context;

    // Preserve stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  /**
   * Convert to JSON-serializable error details
   */
  toJSON(includeStack = process.env.NODE_ENV !== 'production'): ErrorDetails {
    const details: ErrorDetails = {
      code: this.code,
      message: this.message,
    };

    if (includeStack && this.stack) {
      details.stack = this.stack;
    }

    if (this.cause) {
      details.cause = this.cause instanceof Error
        ? this.cause.message
        : String(this.cause);
    }

    if (this.context) {
      details.context = this.context;
    }

    return details;
  }
}

/**
 * Map error codes to HTTP status codes
 */
function mapCodeToStatus(code: ErrorCode): number {
  switch (code) {
    case 'VALIDATION_ERROR':
      return 400;
    case 'UNAUTHORIZED':
      return 401;
    case 'FORBIDDEN':
      return 403;
    case 'NOT_FOUND':
      return 404;
    case 'COMMENT_LOCATION_STALE':
      return 422;
    case 'SERVICE_UNAVAILABLE':
    case 'AI_ERROR':
      return 503;
    case 'TIMEOUT':
      return 504;
    default:
      return 500;
  }
}

/**
 * Wrap an unknown error into an AppError, preserving the original error as cause
 */
export function wrapError(
  error: unknown,
  code: ErrorCode,
  context?: string,
  additionalContext?: Record<string, unknown>
): AppError {
  const originalMessage = error instanceof Error ? error.message : String(error);
  const message = context ? `${context}: ${originalMessage}` : originalMessage;

  return new AppError(code, message, {
    cause: error,
    context: additionalContext,
  });
}

/**
 * Extract error details from any error type
 */
export function getErrorDetails(error: unknown): {
  message: string;
  stack?: string;
  code: ErrorCode;
} {
  if (error instanceof AppError) {
    return {
      message: error.message,
      stack: error.stack,
      code: error.code,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      stack: error.stack,
      code: 'UNKNOWN',
    };
  }

  return {
    message: String(error),
    code: 'UNKNOWN',
  };
}

/**
 * Classify GitHub CLI errors into specific error codes
 */
export function classifyGhError(error: unknown): { code: ErrorCode; message: string } {
  const msg = error instanceof Error ? error.message : String(error);
  const normalizedMsg = msg.toLowerCase();

  if (
    msg.includes('422')
    || msg.includes('pull_request_review_thread.diff_hunk')
    || normalizedMsg.includes('line must be part of the diff')
    || normalizedMsg.includes('outside the diff')
    || normalizedMsg.includes('position is outdated')
  ) {
    return { code: 'COMMENT_LOCATION_STALE', message: msg };
  }
  if (msg.includes('404')) {
    return { code: 'NOT_FOUND', message: msg };
  }
  if (msg.includes('401') || msg.includes('authentication') || msg.includes('not logged in')) {
    return { code: 'UNAUTHORIZED', message: msg };
  }
  if (msg.includes('403') || msg.includes('permission')) {
    return { code: 'FORBIDDEN', message: msg };
  }
  if (msg.includes('timeout') || msg.includes('ETIMEDOUT')) {
    return { code: 'TIMEOUT', message: msg };
  }

  return { code: 'GH_CLI_ERROR', message: msg };
}

/**
 * Create a standardized error response for Hono routes
 */
export function createErrorResponse(error: unknown, defaultMessage: string): {
  error: string;
  code: ErrorCode;
  details: string;
  stack?: string;
} {
  const includeStack = process.env.NODE_ENV !== 'production';

  if (error instanceof AppError) {
    return {
      error: defaultMessage,
      code: error.code,
      details: error.message,
      ...(includeStack && error.stack ? { stack: error.stack } : {}),
    };
  }

  if (error instanceof Error) {
    return {
      error: defaultMessage,
      code: 'UNKNOWN',
      details: error.message,
      ...(includeStack && error.stack ? { stack: error.stack } : {}),
    };
  }

  return {
    error: defaultMessage,
    code: 'UNKNOWN',
    details: String(error),
  };
}
