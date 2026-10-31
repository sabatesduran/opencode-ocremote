# OC Remote OpenCode plugin

This public host-side plugin gives OC Remote provider-neutral usage and TUI appearance APIs. Integrations run on the
OpenCode host and return only allowlisted summaries. Credentials and account identifiers never leave the host.

The first integration reports Codex quota for the active **Sign in with ChatGPT** account. More usage integrations can
be added without changing the RPC consumed by OC Remote.

Install it globally on the machine running OpenCode:

```sh
opencode plugin add github:sabatesduran/opencode-ocremote
```

OpenCode loads the plugin automatically. In OC Remote, open **Settings → Usage** and refresh.

The package also includes a TUI companion that publishes the active theme name, light/dark mode, and the resolved
visible-agent colors to the host RPC. OC Remote uses those colors for its agent controls. The full CLI configuration,
custom theme source, terminal palette, and other settings are never exposed.

The usage API requires OpenCode V2 and an active OpenAI OAuth connection created with **Sign in with ChatGPT**.

## Add an integration

Usage sources implement the small adapter contract in `src/integrations/types.ts`. Add an adapter under
`src/integrations/`, register it in `src/integrations/index.ts`, and return only the normalized fields defined by the
`ocremote.usage/list` RPC. Never return an upstream response directly.

```sh
bun install
bun run typecheck
bun test
```
