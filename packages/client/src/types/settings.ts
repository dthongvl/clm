export type ActionKey = "grouping" | "ai-review" | "pattern-verification" | "related-files"

export interface ActionSettings {
  model?: string
  variant?: string
}

export interface Settings {
  grouping?: ActionSettings
  "ai-review"?: ActionSettings
  "pattern-verification"?: ActionSettings
  "related-files"?: ActionSettings
}

export interface ModelOption {
  id: string
  name: string
  provider: string
  providerId: string
  modelId: string
  variants: string[]
}
