export type ActionKey = "grouping" | "ai-review" | "review-guide"

export type Theme = "light" | "dark" | "system"

export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh"

export interface ActionSettings {
  model?: string
  variant?: string
  thinkingLevel?: ThinkingLevel
}

export interface Settings {
  grouping?: ActionSettings
  "ai-review"?: ActionSettings
  "review-guide"?: ActionSettings
  theme?: Theme
}

export interface ModelOption {
  id: string
  name: string
  provider: string
  providerId: string
  modelId: string
  variants: string[]
}
