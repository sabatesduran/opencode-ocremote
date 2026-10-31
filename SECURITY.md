# Security

Usage integrations execute on the OpenCode host. Provider credentials, OAuth tokens, and account identifiers must
never be returned through the `ocremote.usage` RPC. Each integration constructs a new allowlisted response rather than
forwarding an upstream payload.

Please report vulnerabilities privately to didac@didac.dev. Do not include credentials, tokens, or private source code
in a report.
