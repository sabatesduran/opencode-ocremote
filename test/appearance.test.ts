import { describe, expect, test } from "bun:test"
import { cliAppearanceSettings, resolveAgentColors, sanitizeAppearance } from "../src/appearance.js"

type TestColor = {
  equals(other?: TestColor): boolean
  toInts(): [number, number, number, number]
}

function color(hex: string): TestColor {
  const value = Number.parseInt(hex.replace("#", ""), 16)
  const channels: [number, number, number, number] = [value >> 16, (value >> 8) & 255, value & 255, 255]
  return {
    equals(other?: TestColor) {
      return other?.toInts().every((channel, index) => channel === channels[index]) ?? false
    },
    toInts() { return channels },
  }
}

describe("OC Remote appearance", () => {
  test("uses the same visible-agent palette ordering as the TUI", () => {
    const purple = color("#A277FF")
    const red = color("#FF6767")
    const duplicatePurple = color("#A277FF")
    const agents = resolveAgentColors(
      [
        { id: "build", hidden: false },
        { id: "plan", hidden: false, color: "#123456" },
        { id: "review", hidden: false },
        { id: "hidden", hidden: true },
      ],
      [{ 200: purple }, { 200: duplicatePurple }, { 200: red }],
      200,
    )

    expect(agents).toEqual([
      { id: "build", color: "#A277FF" },
      { id: "plan", color: "#123456" },
      { id: "review", color: "#A277FF" },
    ])
  })

  test("preserves explicit agent colors and removes private fields", () => {
    const snapshot = sanitizeAppearance({
      theme: " aura ",
      mode: "dark",
      agents: [{ id: "plan", color: "#f00", secret: "must-not-leak" }],
      config: { token: "must-not-leak" },
    })

    expect(snapshot).toEqual({
      schemaVersion: 1,
      theme: "aura",
      mode: "dark",
      agents: [{ id: "plan", color: "#FF0000" }],
    })
    expect(JSON.stringify(snapshot)).not.toContain("must-not-leak")
  })

  test("uses the new-design categorical step when requested", () => {
    expect(resolveAgentColors(
      [{ id: "build", hidden: false }],
      [{ 200: color("#111111"), 400: color("#444444") }],
      400,
    )).toEqual([{ id: "build", color: "#444444" }])
  })

  test("merges inline CLI appearance settings over the global file", () => {
    expect(cliAppearanceSettings(
      { theme: { name: "aura" }, experimental: { "new-designs": false } },
      { theme: { name: "tokyonight" }, experimental: { "new-designs": true } },
    )).toEqual({ theme: "tokyonight", newDesigns: true })
  })
})
