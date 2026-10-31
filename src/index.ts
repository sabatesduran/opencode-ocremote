import { Plugin } from "@opencode/plugin"
import { usageIntegrations } from "./integrations/index.js"
import { OCRemoteUsage } from "./rpc.js"

export default Plugin.define({
  id: "ocremote",
  async setup(context) {
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
