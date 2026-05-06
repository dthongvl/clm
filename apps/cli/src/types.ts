export interface PRInfoResult {
  baseBranch: string;
  headBranch: string;
}

export interface PRListItem {
  number: number;
  title: string;
  author: { login: string };
  url: string;
  headRefName: string;
  updatedAt: string;
}

export interface ParsedPRInput {
  prNumber: string;
  repo?: string;
}

export interface ServerEnv {
  prNumber: string;
  /** Only set when the OpenCode backend is in use. */
  opencodeUrl?: string;
  repo: string;
  baseRef: string;
  headRef: string;
}
