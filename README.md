# Codex Commit Widget

![Codex Commit Widget logo](media/logo.png)

**DISCLAIMER** Note: This is an independent project. It is not affiliated with OpenAI. 
"Codex" is a trademarked name and is used here for naming purposes only. 
No endorsement or association is implied.

Generate structured, review-friendly commit messages in VS Code from staged Git changes using Codex.

## Install

Install as a VS Code extension:

- From Marketplace: search for **Codex Commit Widget**
- Or from a `.vsix` build: `Extensions: Install from VSIX...`

## Quick Start

1. Open a Git repository in VS Code.
2. Stage the files you want to commit.
3. Open Source Control.
4. Click the Codex action in the Source Control title bar.
5. The generated message is written directly into the commit message box.

## What It Uses

The extension sends staged context (not unstaged changes):

- Repository name
- Repository status
- Changed file list
- Diff stats
- Staged patch

## Data Handling

- This extension does not collect telemetry.
- It sends prompt context to your configured Codex backend only when you trigger generation.
- Prompt context includes staged Git content and excludes unstaged changes.
- Absolute local repository paths are not sent.

## Authentication Requirement

You must be logged into Codex to generate messages.

If your session is missing/expired, the extension shows a fallback message and tells you to run:

```bash
codex auth login
```

Then run generation again.

## Settings

Core:

- `codexCommitWidget.provider`
  - `cli` (default) or `extensionThenCli`
- `codexCommitWidget.codexCommand`
  - Codex CLI path/name (default: `codex`)
- `codexCommitWidget.codexExtensionCommand`
  - Optional extension command ID for `extensionThenCli`
- `codexCommitWidget.model`
- `codexCommitWidget.reasoningEffort`
- `codexCommitWidget.maxDiffChars`

Prompt/style customization:

- `codexCommitWidget.promptTemplate`
- `codexCommitWidget.additionalPromptInstructions`
- `codexCommitWidget.temperatureOverride`
- `codexCommitWidget.topPOverride`
- `codexCommitWidget.maxOutputTokensOverride`

UI and usage:

- `codexCommitWidget.statusBarText`
- `codexCommitWidget.showTokenUsageInTooltip`
  - Shows token usage totals for the last 24 hours when hovering the status bar icon.

Detailed examples: [`docs/configuration.md`](docs/configuration.md)

## Token Usage Hover

When enabled, hovering the status bar icon shows:

- Total tokens (last 24h)
- Input tokens
- Output tokens
- Number of generations
- Estimated-run count when exact usage metadata is unavailable

## Troubleshooting

- No repository detected: open a folder/workspace with a Git repo.
- No staged changes: stage files before generating.
- Codex command not found: set `codexCommitWidget.codexCommand` to the executable path.
- Auth/session errors: run `codex auth login`.
- Settings show "No settings found" or logs show `Cannot register 'codexCommitWidget.*'` / `scm/inputBox is a proposed menu identifier`:
  - Remove older installed versions of this extension and keep only the latest one.
  - In local debugging, launch with `--disable-extensions` (already configured in `.vscode/launch.json`).

## For Contributors

Local dev/build instructions are intended for extension maintainers, not end users:

1. `npm install`
2. `npm run build`
3. Press `F5` to launch an Extension Development Host

## License

MIT
