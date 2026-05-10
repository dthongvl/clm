export type PRState = "open" | "merged" | "closed"

export interface PRInfo {
  number: number
  title: string
  author: { login: string; avatarUrl: string }
  description: string
  baseBranch: string
  headBranch: string
  state: PRState
  url: string
}
