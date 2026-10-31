import type { UsageIntegrationResult, UsageIntegrationStatus } from "./types.js"
import type { Plugin } from "@opencode/plugin"
import { normalizeCodexUsage } from "../usage.js"

const usageURL = "https://chatgpt.com/backend-api/wham/usage"

export const codexUsageIntegration = {
  id: "openai-codex",
  async read(context: Plugin.Context, signal: AbortSignal): Promise<UsageIntegrationResult> {
    const connection = await context.integration.connection.active("openai")
    if (!connection) return result("not_connected", "Connect OpenAI on the OpenCode host.")

    let credential
    try {
      credential = await context.integration.connection.resolve(connection)
    } catch {
      return result("authentication_required", "Sign in to OpenAI with ChatGPT again.")
    }

    const metadata = credential?.type === "oauth" ? credential.metadata : undefined
    const accountID = isRecord(metadata) && typeof metadata.accountID === "string" ? metadata.accountID : undefined
    if (credential?.type !== "oauth" || !credential.access || !accountID) {
      return result("authentication_required", "The active OpenAI connection must use Sign in with ChatGPT.")
    }

    let response: Response
    try {
      response = await fetch(usageURL, {
        method: "GET",
        redirect: "error",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${credential.access}`,
          "ChatGPT-Account-Id": accountID,
          "User-Agent": `opencode-ocremote/${context.app.version}`,
        },
        signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
      })
    } catch {
      return result("unavailable", "ChatGPT usage is temporarily unavailable.")
    }

    if (response.status === 401 || response.status === 403) {
      return result("authentication_required", "ChatGPT rejected the saved sign-in.")
    }
    if (!response.ok) return result("unavailable", "ChatGPT usage is temporarily unavailable.")

    try {
      return result("ready", null, normalizeCodexUsage(await response.json()))
    } catch {
      return result("unavailable", "ChatGPT returned an unsupported usage response.")
    }
  },
}

function result(
  status: UsageIntegrationStatus,
  message: string | null,
  snapshot: ReturnType<typeof normalizeCodexUsage> | null = null,
): UsageIntegrationResult {
  return { id: "openai-codex", providerID: "openai", name: "Codex", status, message, snapshot }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}
