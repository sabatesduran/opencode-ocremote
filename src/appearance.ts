export type AppearanceAgent = {
  id: string
  color: string
}

export type AppearanceInput = {
  theme: string | null
  mode: "dark" | "light"
  agents: AppearanceAgent[]
}

export type AppearanceSnapshot = Omit<AppearanceInput, "mode"> & {
  schemaVersion: 1
  mode: "dark" | "light" | null
}

type ColorValue = {
  equals(other?: ColorValue): boolean
  toInts(): [number, number, number, number]
}

type ThemeScale = Record<number, ColorValue>

type AgentValue = {
  id: string
  hidden: boolean
  color?: string
}

export function emptyAppearance(): AppearanceSnapshot {
  return { schemaVersion: 1, theme: null, mode: null, agents: [] }
}

export function sanitizeAppearance(value: unknown): AppearanceSnapshot {
  const input = record(value)
  const mode = input.mode === "dark" || input.mode === "light" ? input.mode : null
  if (!mode) return emptyAppearance()

  const agents: AppearanceAgent[] = []
  const seen = new Set<string>()
  for (const item of Array.isArray(input.agents) ? input.agents : []) {
    const agent = record(item)
    const id = typeof agent.id === "string" ? agent.id.trim() : ""
    const color = typeof agent.color === "string" ? normalizeHex(agent.color) : null
    if (!id || !color || seen.has(id)) continue
    seen.add(id)
    agents.push({ id, color })
  }

  return {
    schemaVersion: 1,
    theme: typeof input.theme === "string" && input.theme.trim() ? input.theme.trim() : null,
    mode,
    agents,
  }
}

export function resolveAgentColors(
  agents: readonly AgentValue[],
  categorical: readonly ThemeScale[],
  step: 200 | 400,
): AppearanceAgent[] {
  const palette = categorical
    .map((scale) => scale[step])
    .filter((color): color is ColorValue => color !== undefined)
    .filter((color, index, values) => values.findIndex((candidate) => candidate.equals(color)) === index)
  if (!palette.length) return []

  return agents
    .filter((agent) => !agent.hidden)
    .map((agent, index) => ({
      id: agent.id,
      color: normalizeHex(agent.color) ?? colorHex(palette[index % palette.length]!),
    }))
}

export function cliAppearanceSettings(file: unknown, inline: unknown) {
  const fromFile = record(file)
  const fromInline = record(inline)
  const fileTheme = record(fromFile.theme)
  const inlineTheme = record(fromInline.theme)
  const fileExperimental = record(fromFile.experimental)
  const inlineExperimental = record(fromInline.experimental)
  const theme = string(inlineTheme.name) ?? string(fileTheme.name) ?? "opencode"
  const inlineNewDesigns = inlineExperimental["new-designs"]
  const fileNewDesigns = fileExperimental["new-designs"]

  return {
    theme,
    newDesigns: typeof inlineNewDesigns === "boolean"
      ? inlineNewDesigns
      : typeof fileNewDesigns === "boolean" ? fileNewDesigns : false,
  }
}

function colorHex(color: ColorValue) {
  const [red, green, blue] = color.toInts()
  return `#${[red, green, blue].map((channel) => channel.toString(16).padStart(2, "0")).join("").toUpperCase()}`
}

function normalizeHex(value?: string) {
  if (!value) return null
  let hex = value.trim().replace(/^#/, "")
  if (/^[0-9a-f]{3}$/i.test(hex)) hex = hex.split("").map((part) => part + part).join("")
  if (!/^[0-9a-f]{6}$/i.test(hex)) return null
  return `#${hex.toUpperCase()}`
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function string(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null
}
