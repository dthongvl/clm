/**
 * Per-file viewed state for a PR (viewer-private "Viewed" checkbox).
 */
import type { ViewedFileState, ViewedState } from '../../types/index.js';
import { gql } from '../../lib/octokit.js';
import { withGithubError } from './errors.js';
import { getPRNodeId } from './pull-request.js';

function splitRepo(repo: string): { owner: string; name: string } {
  const [owner, name] = repo.split('/');
  if (!owner || !name) {
    throw new Error(`Invalid repo "${repo}". Expected "owner/name".`);
  }
  return { owner, name };
}

/**
 * Get viewed state for all files in a PR with pagination
 */
export async function getPRFileViewedStates(
  prNumber: number,
  repo: string,
): Promise<ViewedFileState[]> {
  return withGithubError(async () => {
    const { owner, name } = splitRepo(repo);
    type FileNode = { path: string; viewerViewedState: ViewedState };

    const query = `
      query($owner: String!, $name: String!, $prNumber: Int!, $after: String) {
        repository(owner: $owner, name: $name) {
          pullRequest(number: $prNumber) {
            files(first: 100, after: $after) {
              pageInfo { hasNextPage endCursor }
              nodes { path viewerViewedState }
            }
          }
        }
      }
    `;

    type FileConn = {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: FileNode[];
    };
    type FilesResult = {
      repository: { pullRequest: { files: FileConn } };
    };

    const allFiles: ViewedFileState[] = [];
    let after: string | null = null;
    const client = gql();

    do {
      const result: FilesResult = await client<FilesResult>(query, {
        owner,
        name,
        prNumber,
        after,
      });

      const conn: FileConn = result.repository.pullRequest.files;
      for (const file of conn.nodes) {
        allFiles.push({ path: file.path, state: file.viewerViewedState });
      }
      after = conn.pageInfo.hasNextPage ? conn.pageInfo.endCursor : null;
    } while (after);

    return allFiles;
  });
}

/**
 * Set viewed state for a file in a PR
 */
export async function setPRFileViewedState(
  prNumber: number,
  repo: string,
  filePath: string,
  viewed: boolean,
): Promise<ViewedFileState> {
  return withGithubError(async () => {
    const prNodeId = await getPRNodeId(prNumber, repo);

    const mutation = viewed
      ? `
        mutation($prId: ID!, $path: String!) {
          markFileAsViewed(input: { pullRequestId: $prId, path: $path }) {
            pullRequest { id }
          }
        }
      `
      : `
        mutation($prId: ID!, $path: String!) {
          unmarkFileAsViewed(input: { pullRequestId: $prId, path: $path }) {
            pullRequest { id }
          }
        }
      `;

    await gql()(mutation, { prId: prNodeId, path: filePath });

    return {
      path: filePath,
      state: viewed ? 'VIEWED' : 'UNVIEWED',
    };
  });
}
