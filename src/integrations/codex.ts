import type { UsageIntegrationResult, UsageIntegrationStatus } from "./types.js"
import type { Plugin } from "@opencode/plugin"
import { normalizeCodexUsage, normalizeResetCredits } from "../usage.js"

const usageURL = "https://chatgpt.com/backend-api/wham/usage"
const resetCreditsURL = "https://chatgpt.com/backend-api/wham/rate-limit-reset-credits"
const consumeResetURL = `${resetCreditsURL}/consume`

export const codexUsageIntegration = {
  id: "openai-codex",
  async read(context: Plugin.Context, signal: AbortSignal): Promise<UsageIntegrationResult> {
    let response: Response
    try {
      const auth = await resolveAuth(context)
      if (!auth) return result("not_connected", "Connect OpenAI on the OpenCode host.")
      response = await fetch(usageURL, {
        method: "GET",
        redirect: "error",
        headers: headers(context, auth),
        signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
      })
    } catch (error) {
      if (error instanceof AuthenticationError) {
        return result("authentication_required", error.message)
      }
      return result("unavailable", "ChatGPT usage is temporarily unavailable.")
    }

    if (response.status === 401 || response.status === 403) {
      return result("authentication_required", "ChatGPT rejected the saved sign-in.")
    }
    if (!response.ok) return result("unavailable", "ChatGPT usage is temporarily unavailable.")

    try {
      const snapshot = normalizeCodexUsage(await response.json())
      if ((snapshot.resetCredits?.availableCount ?? 0) > 0) {
        try {
          const auth = await resolveAuth(context)
          if (auth) {
            const details = await fetch(resetCreditsURL, {
              method: "GET",
              redirect: "error",
              headers: headers(context, auth),
              signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
            })
            if (details.ok) snapshot.resetCredits = normalizeResetCredits(await details.json())
          }
        } catch {
          // The summary remains useful when the optional details request fails.
        }
      }
      return result("ready", null, snapshot)
    } catch {
      return result("unavailable", "ChatGPT returned an unsupported usage response.")
    }
  },
  async consumeReset(context: Plugin.Context, signal: AbortSignal, idempotencyKey: string) {
    const auth = await resolveAuth(context)
    if (!auth) throw new Error("Connect OpenAI on the OpenCode host.")

    const detailsResponse = await fetch(resetCreditsURL, {
      method: "GET",
      redirect: "error",
      headers: headers(context, auth),
      signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
    })
    if (detailsResponse.status === 401 || detailsResponse.status === 403) {
      throw new AuthenticationError("ChatGPT rejected the saved sign-in.")
    }
    if (!detailsResponse.ok) throw new Error("ChatGPT reset credits are temporarily unavailable.")

    const rawDetails = await detailsResponse.json()
    const creditID = earliestAvailableCreditID(rawDetails)
    if (!creditID) return { code: "no_credit" as const, windowsReset: 0 }

    const response = await fetch(consumeResetURL, {
      method: "POST",
      redirect: "error",
      headers: { ...headers(context, auth), "Content-Type": "application/json" },
      body: JSON.stringify({ redeem_request_id: idempotencyKey, credit_id: creditID }),
      signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
    })
    if (response.status === 401 || response.status === 403) {
      throw new AuthenticationError("ChatGPT rejected the saved sign-in.")
    }
    if (!response.ok) throw new Error("ChatGPT could not apply the reset.")

    const payload = await response.json()
    if (!isRecord(payload) || !["reset", "nothing_to_reset", "no_credit", "already_redeemed"].includes(String(payload.code))) {
      throw new Error("ChatGPT returned an unsupported reset response.")
    }
    return {
      code: payload.code as "reset" | "nothing_to_reset" | "no_credit" | "already_redeemed",
      windowsReset: typeof payload.windows_reset === "number" && Number.isFinite(payload.windows_reset)
        ? Math.max(0, Math.floor(payload.windows_reset))
        : 0,
    }
  },
}

type Auth = { access: string; accountID: string }

class AuthenticationError extends Error {}

async function resolveAuth(context: Plugin.Context): Promise<Auth | null> {
  const connection = await context.integration.connection.active("openai")
  if (!connection) return null
  let credential
  try {
    credential = await context.integration.connection.resolve(connection)
  } catch {
    throw new AuthenticationError("Sign in to OpenAI with ChatGPT again.")
  }
  const metadata = credential?.type === "oauth" ? credential.metadata : undefined
  const accountID = isRecord(metadata) && typeof metadata.accountID === "string" ? metadata.accountID : undefined
  if (credential?.type !== "oauth" || !credential.access || !accountID) {
    throw new AuthenticationError("The active OpenAI connection must use Sign in with ChatGPT.")
  }
  return { access: credential.access, accountID }
}

function headers(context: Plugin.Context, auth: Auth) {
  return {
    Accept: "application/json",
    Authorization: `Bearer ${auth.access}`,
    "ChatGPT-Account-Id": auth.accountID,
    "User-Agent": `opencode-ocremote/${context.app.version}`,
  }
}

function earliestAvailableCreditID(value: unknown): string | null {
  if (!isRecord(value) || !Array.isArray(value.credits)) return null
  const credit = value.credits
    .filter((item): item is Record<string, unknown> =>
      isRecord(item) && item.status === "available" && typeof item.id === "string" && item.id.length > 0)
    .sort((left, right) => expiry(left.expires_at) - expiry(right.expires_at))[0]
  return typeof credit?.id === "string" ? credit.id : null
}

function expiry(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 10_000_000_000 ? value : value * 1_000
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return Number.POSITIVE_INFINITY
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
