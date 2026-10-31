import type { Plugin } from "@opencode/plugin"
import type { UsageSnapshot } from "../usage.js"

export type UsageIntegrationStatus = "ready" | "not_connected" | "authentication_required" | "unavailable"

export type UsageIntegrationResult = {
  id: string
  providerID: string
  name: string
  status: UsageIntegrationStatus
  message: string | null
  snapshot: UsageSnapshot | null
}

export type UsageIntegration = {
  id: string
  read(context: Plugin.Context, signal: AbortSignal): Promise<UsageIntegrationResult>
}
