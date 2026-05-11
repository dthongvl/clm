/**
 * Error mapping for Octokit / GitHub API failures.
 *
 * Wraps every GitHub call in `withGithubError(...)` so route handlers receive
 * `AppError` instances with a meaningful `code`.
 */
import { RequestError } from '@octokit/request-error';
import { GraphqlResponseError } from '@octokit/graphql';
import { AppError, classifyGhError, type ErrorCode } from '../../lib/errors.js';

interface Classified {
  code: ErrorCode;
  message: string;
}

function isCommentLocationStale(message: string): boolean {
  const normalised = message.toLowerCase();
  return (
    message.includes('pull_request_review_thread.diff_hunk')
    || normalised.includes('line must be part of the diff')
    || normalised.includes('outside the diff')
    || normalised.includes('position is outdated')
  );
}

function classifyByStatus(status: number, message: string): Classified {
  if (status === 422 && isCommentLocationStale(message)) {
    return { code: 'COMMENT_LOCATION_STALE', message };
  }
  if (status === 422) return { code: 'VALIDATION_ERROR', message };
  if (status === 404) return { code: 'NOT_FOUND', message };
  if (status === 401) return { code: 'UNAUTHORIZED', message };
  if (status === 403) return { code: 'FORBIDDEN', message };
  if (status === 408 || status === 504) return { code: 'TIMEOUT', message };
  if (status >= 500) return { code: 'SERVICE_UNAVAILABLE', message };
  return { code: 'GH_API_ERROR', message };
}

function classifyGraphqlError(error: GraphqlResponseError<unknown>): Classified {
  const message = error.errors?.map((e) => e.message).filter(Boolean).join('; ')
    || error.message;

  if (isCommentLocationStale(message)) {
    return { code: 'COMMENT_LOCATION_STALE', message };
  }

  const types = error.errors?.map((e) => e.type) ?? [];
  if (types.includes('NOT_FOUND')) return { code: 'NOT_FOUND', message };
  if (types.includes('FORBIDDEN')) return { code: 'FORBIDDEN', message };
  if (types.includes('UNAUTHORIZED')) return { code: 'UNAUTHORIZED', message };

  return { code: 'GH_API_ERROR', message };
}

export function classifyOctokitError(error: unknown): Classified {
  if (error instanceof GraphqlResponseError) return classifyGraphqlError(error);
  if (error instanceof RequestError) {
    return classifyByStatus(error.status, error.message);
  }
  // Fall back to the legacy CLI heuristics for non-Octokit errors
  // (e.g. failures from `gh` invocations in gh-cli.ts).
  return classifyGhError(error);
}

/**
 * Wrap a GitHub call so any error becomes a typed AppError.
 */
export async function withGithubError<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof AppError) throw error;
    const { code, message } = classifyOctokitError(error);
    throw new AppError(code, message, { cause: error });
  }
}
