# Codex Commit Widget

![Codex Commit Widget logo](media/logo.png)

Generate structured, review-friendly commit messages in VS Code from staged Git changes using Codex.

Current extension release: `v1.7.0`.

## Install

Install as a VS Code extension:

- From Marketplace: search for **Codex Commit Widget**
- Or from a `.vsix` build: `Extensions: Install from VSIX...`

## Quick Start

1. Open a Git repository in VS Code.
2. Stage the files you want to commit.
3. Generate using either entry point:
   - Source Control title button (Codex icon)
   - Activity Bar -> **Codex Commit** -> **Generate Commit Message**
4. The generated message is written directly into the commit message box.

## UI Preview

Source Control commit button:

![Source Control commit button](media/commit-button.png)

Settings examples:

![Settings example 1](media/commit-settings-1.PNG)
![Settings example 2](media/commit-settings-2.PNG)

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
codex login
```

Then run generation again.

## Codex CLI Version

This extension is tuned for Codex CLI `0.120.0` and newer.

Check your version:

```bash
codex --version
```

Upgrade to the latest version:

```bash
npm install -g @openai/codex@latest
```

If you installed with Homebrew:

```bash
brew upgrade --cask codex
```

## Settings

Core:

- `codexCommitWidget.provider`
  - `cli` (default) or `extensionThenCli`
- `codexCommitWidget.codexCommand`
  - Codex CLI path/name (default: `codex`)
  - With the default `codex`, the extension now prioritizes common npm global install paths (for `npm install -g @openai/codex@latest`) before PATH-only fallbacks.
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
- `codexCommitWidget.enableSidebarAction`
  - Enables/disables the Activity Bar sidebar action (default: enabled)
- `codexCommitWidget.trackTokenUsageAnalytics`
  - Tracks token usage analytics for commit generations (default: enabled)
- `codexCommitWidget.analyticsRetentionDays`
  - Retention window for analytics (default: `7` days; auto-clears older entries)
- `codexCommitWidget.analyticsSummary`
- `codexCommitWidget.analyticsTotalTokens`
- `codexCommitWidget.analyticsInputTokens`
- `codexCommitWidget.analyticsOutputTokens`
- `codexCommitWidget.analyticsGenerations`
- `codexCommitWidget.analyticsEstimatedRuns`
- `codexCommitWidget.analyticsLastUpdated`
  - Auto-managed analytics fields written by the extension

Detailed examples: [`docs/configuration.md`](docs/configuration.md)

## Token Usage Analytics

Token usage is stored in settings (not hover UI) and auto-pruned after `analyticsRetentionDays` (default `7` days).

## Troubleshooting

- No repository detected: open a folder/workspace with a Git repo.
- No staged changes: stage files before generating.
- Codex command not found: run `Codex: Setup Codex CLI` from the Command Palette or sidebar, or set `codexCommitWidget.codexCommand` manually.
- Auth/session errors: run `codex login` (or `codex auth login` on older CLI versions).
- Old Codex version: run `codex --version`; if below `0.120.0`, upgrade with `npm install -g @openai/codex@latest`.
- Settings show "No settings found" or logs show `Cannot register 'codexCommitWidget.*'` / `scm/inputBox is a proposed menu identifier`:
  - Remove older installed versions of this extension and keep only the latest one.
  - In local debugging, launch with `--disable-extensions` (already configured in `.vscode/launch.json`).


## License

MIT
