export type ActionKey = "grouping" | "ai-review"

export interface ActionSettings {
  model?: string
  variant?: string
}

export interface Settings {
  grouping?: ActionSettings
  "ai-review"?: ActionSettings
}

export interface ModelOption {
  id: string
  name: string
  provider: string
  providerId: string
  modelId: string
  variants: string[]
}
