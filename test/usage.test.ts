import { describe, expect, test } from "bun:test"
import { normalizeCodexUsage, normalizeResetCredits } from "../src/usage.js"
import { registerResetSelection, selectedAvailableCreditID } from "../src/integrations/codex.js"

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
      resetCredits: null,
    })
    expect(JSON.stringify(usage)).not.toContain("must-not-leak")
  })

  test("sanitizes reset-credit summaries and expiration details", () => {
    const usage = normalizeCodexUsage({
      rate_limit_reset_credits: { available_count: 2, secret: "must-not-leak" },
    })
    expect(usage.resetCredits).toEqual({ availableCount: 2, credits: null })

    const details = normalizeResetCredits({
      available_count: 2,
      account_id: "must-not-leak",
      credits: [
        {
          id: "must-not-leak",
          status: "available",
          title: "Full reset",
          description: "Weekly and session windows",
          granted_at: "2026-06-18T08:32:53Z",
          expires_at: "2026-07-18T08:32:53Z",
        },
        {
          id: "also-private",
          status: "redeemed",
          expires_at: null,
        },
      ],
    }, () => "opaque-selector")
    expect(details.availableCount).toBe(2)
    expect(details.credits).toHaveLength(1)
    expect(details.credits?.[0]?.selectionKey).toBe("opaque-selector")
    expect(details.credits?.[0]?.title).toBe("Full reset")
    const serialized = JSON.stringify(details)
    expect(serialized).not.toContain("\"id\"")
    expect(serialized).not.toContain("account_id")
    expect(serialized).not.toContain("must-not-leak")
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

  test("resolves an opaque selector to the chosen available credit", () => {
    const details = {
      credits: [
        { id: "later-private-id", status: "available", expires_at: "2026-12-12T23:50:00Z" },
        { id: "first-private-id", status: "available", expires_at: "2026-11-30T21:26:00Z" },
      ],
    }
    const selectionKey = registerResetSelection("later-private-id")

    expect(selectedAvailableCreditID(details, selectionKey)).toBe("later-private-id")
    expect(selectedAvailableCreditID(details)).toBe("first-private-id")
    expect(selectedAvailableCreditID(details, "unknown-selector")).toBeNull()
  })
})
