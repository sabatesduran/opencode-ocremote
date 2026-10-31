import { describe, expect, test } from "bun:test"
import { normalizeCodexUsage } from "../src/usage.js"

describe("normalizeCodexUsage", () => {
  test("returns a sanitized provider-neutral snapshot", () => {
    const usage = normalizeCodexUsage({
      plan_type: "prolite",
      account_id: "must-not-leak",
      user_id: "must-not-leak",
      rate_limit: {
        allowed: true,
        primary_window: { used_percent: 69, limit_window_seconds: 604800, reset_at: 1793519838 },
        secondary_window: null,
      },
      credits: {
        has_credits: false,
        unlimited: false,
        balance: "0",
        private_metadata: "must-not-leak",
      },
    }, 1234)

    expect(usage).toEqual({
      plan: "prolite",
      allowed: true,
      fetchedAt: 1234,
      limits: [{
        id: "codex",
        name: null,
        model: null,
        windows: [{
          id: "primary",
          name: "Primary limit",
          usedPercent: 69,
          windowDurationSeconds: 604800,
          resetsAt: 1793519838,
        }],
      }],
      balances: [{
        id: "credits",
        name: "Additional credits",
        available: false,
        unlimited: false,
        value: "0",
      }],
    })
    expect(JSON.stringify(usage)).not.toContain("must-not-leak")
  })

  test("supports additional quota buckets and clamps percentages", () => {
    const usage = normalizeCodexUsage({
      rate_limit: { primary_window: { used_percent: -5 } },
      additional_rate_limits: [{
        metered_feature: "codex_fast",
        limit_name: "Fast models",
        normal_model_slug: "gpt-fast",
        rate_limit: { secondary_window: { used_percent: 120, limit_window_seconds: 300 } },
      }],
    })

    expect(usage.limits[0]?.windows[0]?.usedPercent).toBe(0)
    expect(usage.limits[1]).toEqual({
      id: "codex_fast",
      name: "Fast models",
      model: "gpt-fast",
      windows: [{
        id: "secondary",
        name: "Secondary limit",
        usedPercent: 100,
        windowDurationSeconds: 300,
        resetsAt: null,
      }],
    })
  })
})
