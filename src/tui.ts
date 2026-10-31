import { readFile } from "node:fs/promises"
import { homedir } from "node:os"
import path from "node:path"
import { Plugin } from "@opencode/plugin/tui"
import { parse } from "jsonc-parser"
import { cliAppearanceSettings, resolveAgentColors, type AppearanceInput } from "./appearance.js"
import { OCRemoteAppearance } from "./rpc.js"

export default Plugin.define({
  id: "ocremote.tui",
  setup(context) {
    let disposed = false
    let publishing = false
    let queued = false
    let lastSent = ""

    const publish = async () => {
      if (disposed) return
      if (publishing) {
        queued = true
        return
      }
      publishing = true
      try {
        const location = context.location ?? context.data.location.default()
        const theme = context.theme
        const mode = context.themeMode
        const agents = context.data.location.agent.list(location) ?? []
        const settings = await readCliAppearance()
        const payload: AppearanceInput = {
          theme: settings.theme,
          mode,
          agents: resolveAgentColors(agents, theme.categorical, settings.newDesigns ? 400 : 200),
        }
        const key = JSON.stringify({ location, payload })
        if (key === lastSent || disposed) return
        await context.client.rpc(OCRemoteAppearance).sync(payload, { location })
        if (!disposed) lastSent = key
      } catch {
        // The server part can load after the TUI part. The next interval retries.
      } finally {
        publishing = false
        if (queued && !disposed) {
          queued = false
          void publish()
        }
      }
    }

    const location = context.location ?? context.data.location.default()
    void context.data.location.agent.sync(location).finally(() => void publish())
    const interval = setInterval(() => void publish(), 1_000)

    return () => {
      disposed = true
      clearInterval(interval)
    }
  },
})

async function readCliAppearance() {
  const directory = process.env.OPENCODE_CONFIG_DIR?.trim()
    || path.join(process.env.XDG_CONFIG_HOME?.trim() || path.join(homedir(), ".config"), "opencode")
  const file = await readJSON(path.join(directory, "cli.json"))
  const inline = parseJSON(process.env.OPENCODE_CLI_CONFIG_CONTENT)
  return cliAppearanceSettings(file, inline)
}

async function readJSON(file: string) {
  try {
    return parseJSON(await readFile(file, "utf8"))
  } catch {
    return {}
  }
}

function parseJSON(value?: string) {
  if (!value) return {}
  try {
    return parse(value) as unknown
  } catch {
    return {}
  }
}
