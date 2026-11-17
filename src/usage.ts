type JsonObject = Record<string, unknown>

export type UsageWindow = {
  id: string
  name: string | null
  usedPercent: number
  windowDurationSeconds: number | null
  resetsAt: number | null
}

export type UsageLimit = {
  id: string
  name: string | null
  model: string | null
  windows: UsageWindow[]
}

export type UsageResetCredit = {
  status: string
  title: string | null
  description: string | null
  grantedAt: number | null
  expiresAt: number | null
}

export type UsageResetCredits = {
  availableCount: number
  credits: UsageResetCredit[] | null
}

export type UsageSnapshot = {
  plan: string | null
  allowed: boolean | null
  fetchedAt: number
  limits: UsageLimit[]
  balances: Array<{
    id: string
    name: string
    available: boolean
    unlimited: boolean
    value: string | null
  }>
  resetCredits: UsageResetCredits | null
}

export function normalizeCodexUsage(value: unknown, fetchedAt = Date.now()): UsageSnapshot {
  const payload = object(value)
  const mainRateLimit = objectOrNull(payload.rate_limit)
  const limits: UsageLimit[] = [limit("codex", null, null, mainRateLimit)]

  for (const item of array(payload.additional_rate_limits)) {
    const additional = object(item)
    const id = string(additional.metered_feature) ?? string(additional.limit_name)
    if (!id) continue
    limits.push(limit(
      id,
      string(additional.limit_name),
      string(additional.normal_model_slug),
      objectOrNull(additional.rate_limit),
    ))
  }

  const rawCredits = objectOrNull(payload.credits)
  const balances = rawCredits
    ? [{
        id: "credits",
        name: "Additional credits",
        available: boolean(rawCredits.has_credits) ?? false,
        unlimited: boolean(rawCredits.unlimited) ?? false,
        value: string(rawCredits.balance),
      }]
    : []
  const resetCreditSummary = objectOrNull(payload.rate_limit_reset_credits)
  const availableResetCount = nonNegativeInteger(resetCreditSummary?.available_count)

  return {
    plan: string(payload.plan_type),
    allowed: mainRateLimit ? boolean(mainRateLimit.allowed) : null,
    fetchedAt,
    limits,
    balances,
    resetCredits: availableResetCount === null
      ? null
      : { availableCount: availableResetCount, credits: null },
  }
}

export function normalizeResetCredits(value: unknown): UsageResetCredits {
  const payload = object(value)
  const availableCount = nonNegativeInteger(payload.available_count) ?? 0
  const credits = array(payload.credits)
    .map((item): UsageResetCredit | null => {
      const credit = objectOrNull(item)
      if (!credit || string(credit.status) !== "available") return null
      return {
        status: "available",
        title: string(credit.title),
        description: string(credit.description),
        grantedAt: timestamp(credit.granted_at),
        expiresAt: timestamp(credit.expires_at),
      }
    })
    .filter((credit): credit is UsageResetCredit => credit !== null)
    .sort((left, right) => (left.expiresAt ?? Number.POSITIVE_INFINITY) - (right.expiresAt ?? Number.POSITIVE_INFINITY))

  return { availableCount, credits }
}

function limit(id: string, name: string | null, model: string | null, value: JsonObject | null): UsageLimit {
  const windows = [
    usageWindow("primary", "Primary limit", value?.primary_window),
    usageWindow("secondary", "Secondary limit", value?.secondary_window),
  ].filter((window): window is UsageWindow => window !== null)

  return { id, name, model, windows }
}

function usageWindow(id: string, name: string, value: unknown): UsageWindow | null {
  const input = objectOrNull(value)
  if (!input) return null
  const usedPercent = finiteNumber(input.used_percent)
  if (usedPercent === null) return null
  return {
    id,
    name,
    usedPercent: Math.max(0, Math.min(100, usedPercent)),
    windowDurationSeconds: positiveNumber(input.limit_window_seconds),
    resetsAt: positiveNumber(input.reset_at),
  }
}

function object(value: unknown): JsonObject {
  return objectOrNull(value) ?? {}
}

function objectOrNull(value: unknown): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function string(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function boolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function positiveNumber(value: unknown): number | null {
  const number = finiteNumber(value)
  return number !== null && number > 0 ? number : null
}

function nonNegativeInteger(value: unknown): number | null {
  const number = finiteNumber(value)
  return number !== null && number >= 0 ? Math.floor(number) : null
}

function timestamp(value: unknown): number | null {
  const numeric = finiteNumber(value)
  if (numeric !== null) return numeric > 10_000_000_000 ? numeric / 1_000 : numeric > 0 ? numeric : null
  const text = string(value)
  if (!text) return null
  const milliseconds = Date.parse(text)
  return Number.isFinite(milliseconds) && milliseconds > 0 ? milliseconds / 1_000 : null
}
