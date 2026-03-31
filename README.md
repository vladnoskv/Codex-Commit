# Codex Commit Widget

VS Code extension that adds a commit-message generator button in Source Control, similar to the inline Copilot-style action.

## What it does

- Adds a `$(sparkle)` action on the Source Control commit input box.
- Reads staged Git changes only.
- Sends Codex a structured context:
  - `git status --short --branch`
  - staged changed files (`git diff --cached --name-status`)
  - staged diff stats (`git diff --cached --stat`)
  - staged patch (`git diff --cached --minimal`)
- Generates an audit-friendly commit message with:
  - subject line
  - Change Summary
  - Files Changed
  - Audit Trail

## Run locally

1. Install dependencies:
   - `npm install`
2. Build:
   - `npm run build`
3. Launch Extension Development Host:
   - press `F5` in this workspace
4. In the new VS Code window:
   - open a Git repo
   - stage changes
   - open Source Control view
   - click the sparkle icon at the right side of the commit message input

## Settings

- `codexCommitWidget.provider`
  - `cli` (default): uses Codex CLI.
  - `extensionThenCli`: tries a configured VS Code command first, then falls back to CLI.
- `codexCommitWidget.codexExtensionCommand`
  - Optional command ID used when `provider = extensionThenCli`.
- `codexCommitWidget.codexCommand`
  - CLI executable name/path (default: `codex`).
- `codexCommitWidget.model`
  - Default model passed as `--model` (default: `gpt-5.1-codex-mini`).
- `codexCommitWidget.reasoningEffort`
  - Reasoning effort passed via `-c model_reasoning_effort=...` (default: `low`).
- `codexCommitWidget.maxDiffChars`
  - Max chars from staged context sent to Codex.
- `codexCommitWidget.promptTemplate`
  - Prompt prefix for output style and policy.

## Notes

- Commit generation reads staged worktree context from Git and sends it to Codex.
- The extension uses `codex exec --output-last-message` so the commit box is filled with the model's final response, not CLI progress logs.

## Requirements

- Built-in Git extension enabled in VS Code.
- Codex CLI installed and authenticated when using `provider = cli` or CLI fallback.
