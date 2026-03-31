Requirements

You need:

the built-in Git extension enabled in VS Code
the Codex CLI installed locally
Codex already authenticated/configured

codex exec is the documented non-interactive way to run Codex from scripts, which is why this approach is the safest fit for a VS Code extension button.

Notes
1. This is a custom replacement for the Copilot flow

VS Code’s documented commit-message generation UI is a Copilot feature, so this extension adds its own button/command rather than trying to hijack Copilot’s built-in sparkle action.

2. It uses the same Codex config surface

Codex docs say the CLI and IDE extension share configuration layers, and the IDE extension uses Codex config from ~/.codex/config.toml / project .codex/config.toml.

3. If you want deeper integration

The Codex docs describe app-server as the interface used to power rich clients such as the VS Code extension, and it is intended for deep integrations. That is the next step if you want streaming output, approvals, richer UX, or a side-panel flow instead of a simple widget.