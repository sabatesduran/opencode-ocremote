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

  return {
    plan: string(payload.plan_type),
    allowed: mainRateLimit ? boolean(mainRateLimit.allowed) : null,
    fetchedAt,
    limits,
    balances,
  }
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
