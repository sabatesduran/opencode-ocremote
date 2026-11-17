import { Rpc } from "@opencode/plugin/rpc"

const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] } as const
const nullableNumber = { anyOf: [{ type: "number" }, { type: "null" }] } as const
const nullableBoolean = { anyOf: [{ type: "boolean" }, { type: "null" }] } as const

const resetCredits = {
  anyOf: [{
    type: "object",
    properties: {
      availableCount: { type: "number" },
      credits: {
        anyOf: [{
          type: "array",
          items: {
            type: "object",
            properties: {
              status: { type: "string" },
              title: nullableString,
              description: nullableString,
              grantedAt: nullableNumber,
              expiresAt: nullableNumber,
            },
            required: ["status", "title", "description", "grantedAt", "expiresAt"],
            additionalProperties: false,
          },
        }, { type: "null" }],
      },
    },
    required: ["availableCount", "credits"],
    additionalProperties: false,
  }, { type: "null" }],
} as const

const usageWindow = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: nullableString,
    usedPercent: { type: "number" },
    windowDurationSeconds: nullableNumber,
    resetsAt: nullableNumber,
  },
  required: ["id", "name", "usedPercent", "windowDurationSeconds", "resetsAt"],
  additionalProperties: false,
} as const

const usageSnapshot = {
  type: "object",
  properties: {
    plan: nullableString,
    allowed: nullableBoolean,
    fetchedAt: { type: "number" },
    limits: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: nullableString,
          model: nullableString,
          windows: { type: "array", items: usageWindow },
        },
        required: ["id", "name", "model", "windows"],
        additionalProperties: false,
      },
    },
    balances: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          available: { type: "boolean" },
          unlimited: { type: "boolean" },
          value: nullableString,
        },
        required: ["id", "name", "available", "unlimited", "value"],
        additionalProperties: false,
      },
    },
    resetCredits,
  },
  required: ["plan", "allowed", "fetchedAt", "limits", "balances", "resetCredits"],
  additionalProperties: false,
} as const

const nullableSnapshot = { anyOf: [usageSnapshot, { type: "null" }] } as const

const appearanceAgent = {
  type: "object",
  properties: {
    id: { type: "string" },
    color: { type: "string" },
  },
  required: ["id", "color"],
  additionalProperties: false,
} as const

const appearanceInput = {
  type: "object",
  properties: {
    theme: nullableString,
    mode: { type: "string", enum: ["dark", "light"] },
    agents: { type: "array", items: appearanceAgent },
  },
  required: ["theme", "mode", "agents"],
  additionalProperties: false,
} as const

const appearanceOutput = {
  type: "object",
  properties: {
    schemaVersion: { type: "number" },
    theme: nullableString,
    mode: { anyOf: [{ type: "string", enum: ["dark", "light"] }, { type: "null" }] },
    agents: { type: "array", items: appearanceAgent },
  },
  required: ["schemaVersion", "theme", "mode", "agents"],
  additionalProperties: false,
} as const

export const OCRemoteUsage = Rpc.define({
  id: "ocremote.usage",
  methods: {
    list: {
      input: { type: "object", additionalProperties: false },
      output: {
        type: "object",
        properties: {
          schemaVersion: { type: "number" },
          integrations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                providerID: { type: "string" },
                name: { type: "string" },
                status: {
                  type: "string",
                  enum: ["ready", "not_connected", "authentication_required", "unavailable"],
                },
                message: nullableString,
                snapshot: nullableSnapshot,
              },
              required: ["id", "providerID", "name", "status", "message", "snapshot"],
              additionalProperties: false,
            },
          },
        },
        required: ["schemaVersion", "integrations"],
        additionalProperties: false,
      },
    },
    consumeReset: {
      input: {
        type: "object",
        properties: {
          integrationID: { type: "string" },
          idempotencyKey: { type: "string" },
        },
        required: ["integrationID", "idempotencyKey"],
        additionalProperties: false,
      },
      output: {
        type: "object",
        properties: {
          code: { type: "string", enum: ["reset", "nothing_to_reset", "no_credit", "already_redeemed"] },
          windowsReset: { type: "number" },
        },
        required: ["code", "windowsReset"],
        additionalProperties: false,
      },
    },
  },
  events: {},
})

export const OCRemoteAppearance = Rpc.define({
  id: "ocremote.appearance",
  methods: {
    get: {
      input: { type: "object", additionalProperties: false },
      output: appearanceOutput,
    },
    sync: {
      input: appearanceInput,
      output: appearanceOutput,
    },
  },
  events: {},
})
