/**
 * Pull-request metadata (info, head sha, node id) and viewer queries.
 */
import type { PRInfo } from '../../types/index.js';
import { gql, octokit } from '../../lib/octokit.js';
import { withGithubError } from './errors.js';

function splitRepo(repo: string): { owner: string; name: string } {
  const [owner, name] = repo.split('/');
  if (!owner || !name) {
    throw new Error(`Invalid repo "${repo}". Expected "owner/name".`);
  }
  return { owner, name };
}

export async function getPRInfo(prNumber: number, repo?: string): Promise<PRInfo> {
  return withGithubError(async () => {
    if (!repo) {
      throw new Error('repo is required to fetch PR info');
    }
    const { owner, name } = splitRepo(repo);

    const { data } = await octokit().rest.pulls.get({
      owner,
      repo: name,
      pull_number: prNumber,
    });

    const rawState =
      data.state === 'closed' && data.merged_at ? 'merged' : (data.state ?? 'open');
    const state: PRInfo['state'] =
      rawState === 'merged' || rawState === 'closed' ? rawState : 'open';

    return {
      number: data.number,
      title: data.title,
      author: data.user?.login ?? '',
      description: data.body ?? '',
      baseBranch: data.base.ref,
      headBranch: data.head.ref,
      repo,
      url: data.html_url ?? '',
      state,
    };
  });
}

export async function getCurrentUserLogin(): Promise<string> {
  return withGithubError(async () => {
    const result = await gql()<{ viewer: { login: string } }>(
      `query { viewer { login } }`,
    );
    return result.viewer.login;
  });
}

/**
 * Get the GraphQL node ID for a PR
 */
export async function getPRNodeId(prNumber: number, repo: string): Promise<string> {
  return withGithubError(async () => {
    const { owner, name } = splitRepo(repo);
    const result = await gql()<{
      repository: { pullRequest: { id: string } };
    }>(
      `
        query($owner: String!, $name: String!, $prNumber: Int!) {
          repository(owner: $owner, name: $name) {
            pullRequest(number: $prNumber) { id }
          }
        }
      `,
      { owner, name, prNumber },
    );
    return result.repository.pullRequest.id;
  });
}

export async function getPRHeadSha(prNumber: number, repo: string): Promise<string> {
  return withGithubError(async () => {
    const { owner, name } = splitRepo(repo);
    const result = await gql()<{
      repository: { pullRequest: { headRefOid: string } };
    }>(
      `
        query($owner: String!, $name: String!, $prNumber: Int!) {
          repository(owner: $owner, name: $name) {
            pullRequest(number: $prNumber) { headRefOid }
          }
        }
      `,
      { owner, name, prNumber },
    );
    return result.repository.pullRequest.headRefOid;
  });
}
