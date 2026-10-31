import { Plugin } from "@opencode/plugin"
import { usageIntegrations } from "./integrations/index.js"
import { emptyAppearance, sanitizeAppearance } from "./appearance.js"
import { OCRemoteAppearance, OCRemoteUsage } from "./rpc.js"

export default Plugin.define({
  id: "ocremote",
  async setup(context) {
    let appearance = sanitizeAppearance(await context.storage.get("appearance") ?? emptyAppearance())

    await context.rpc.register(OCRemoteAppearance, {
      get: async () => appearance,
      sync: async (input) => {
        appearance = sanitizeAppearance(input)
        await context.storage.set("appearance", appearance)
        return appearance
      },
    })

    await context.rpc.register(OCRemoteUsage, {
      list: async (_input, rpc) => ({
        schemaVersion: 1,
        integrations: await Promise.all(
          usageIntegrations.map((integration) => integration.read(context, rpc.signal)),
        ),
      }),
    })
  },
})
