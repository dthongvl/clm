/**
 * Octokit singletons (REST + GraphQL) wired with retry and throttling plugins.
 * Initialised after `loadGhToken()` runs in bootstrap.
 */
import { Octokit } from '@octokit/rest';
import { graphql } from '@octokit/graphql';
import { retry } from '@octokit/plugin-retry';
import { throttling } from '@octokit/plugin-throttling';
import type { graphql as GraphqlInterface } from '@octokit/graphql/types';
import { getGhToken } from './github-auth.js';
import { logger } from './logger.js';

// Export Octokit instance type directly. Plugin-merged subclasses produce
// non-portable inferred types under pnpm's symlinked layout.
export type OctokitClient = Octokit;
const OctokitWithPlugins: typeof Octokit = Octokit.plugin(retry, throttling);

let octokitInstance: OctokitClient | null = null;
let graphqlInstance: GraphqlInterface | null = null;

export function initOctokit(): void {
  const token = getGhToken();

  octokitInstance = new OctokitWithPlugins({
    auth: token,
    userAgent: 'clm-server',
    request: { retries: 3 },
    throttle: {
      onRateLimit: (retryAfter, options, _octokit, retryCount) => {
        logger.warn(
          `GitHub rate limit hit on ${options.method} ${options.url}; retry in ${retryAfter}s (attempt ${retryCount})`,
        );
        return retryCount < 2;
      },
      onSecondaryRateLimit: (retryAfter, options) => {
        logger.warn(
          `GitHub secondary rate limit on ${options.method} ${options.url}; retry in ${retryAfter}s`,
        );
        return true;
      },
    },
  });

  graphqlInstance = graphql.defaults({
    headers: { authorization: `token ${token}` },
    request: { retries: 3 },
  });
}

export function octokit(): OctokitClient {
  if (!octokitInstance) {
    throw new Error('Octokit not initialised. Call initOctokit() during boot.');
  }
  return octokitInstance;
}

export function gql(): GraphqlInterface {
  if (!graphqlInstance) {
    throw new Error('Octokit GraphQL not initialised. Call initOctokit() during boot.');
  }
  return graphqlInstance;
}
