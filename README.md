# AI Commit & Prompt Helper v2.0.2

![AI Commit & Prompt Helper logo](media/logo.png)

Generate structured, review-friendly AI commit messages from staged Git changes and improve coding prompts in VS Code using Codex CLI, OpenRouter, Hugging Face, and OpenAI-compatible LLM APIs.

Current extension release: `v2.0.2`.

## Release Notes

### v2.0.2

- Added a provider-mode setup panel with compact provider/model dropdowns.
- Added SecretStorage-backed API key saving with legacy setting and environment-variable fallbacks.
- Added Hugging Face provider support through its OpenAI-compatible router.
- Added low-cost model presets for OpenRouter, Hugging Face, Mistral, Gemini, and DeepSeek-oriented workflows.

### v2.0.1

- Fixed `aiCommitPromptHelper.improvePrompt` not found by adding explicit command activation events.

### v2.0.0

- Renamed the extension package to **AI Commit & Prompt Helper** (`ai-commit-prompt-helper`).
- Added a provider interface for Codex CLI, OpenAI-compatible APIs, Anthropic Claude, Cohere, Google Gemini, Mistral, DeepSeek, OpenRouter, Hugging Face, and custom OpenAI-compatible endpoints.
- Added `AI Helper: Improve Prompt` for selected editor text, with review before copy/open/replace.
- Moved settings to `aiCommitPromptHelper.*`; existing `codexCommitWidget.*` values are still read as fallbacks.

## Install

Install as a VS Code extension:

- From Marketplace: search for **AI Commit & Prompt Helper**
- Or from a `.vsix` build: `Extensions: Install from VSIX...`

## Quick Start

1. Open a Git repository in VS Code.
2. Stage the files you want to commit.
3. Generate using either entry point:
   - Source Control title button
   - Activity Bar -> **AI Helper** -> **Generate Commit Message**
4. The generated message is written directly into the commit message box.

To improve a coding prompt, select prompt text in an editor and run **AI Helper: Improve Prompt**
from the Command Palette or Activity Bar -> **AI Helper** -> **Improve Prompt**. If no text is
selected, the extension asks for a prompt, then shows a review document before you copy,
open, or replace the improved version.

## Providers

Set `aiCommitPromptHelper.provider` to one of:

- `codexCli` (default)
- `codexExtensionThenCli`
- `openai`
- `deepseek`
- `anthropic`
- `cohere`
- `gemini`
- `mistral`
- `openrouter`
- `huggingface`
- `customOpenAiCompatible`

HTTP providers use provider-specific API keys from VS Code SecretStorage when saved through **AI Helper: Open Settings**. Existing `settings.json` API key values and environment variables still work as fallback migration paths.

Low-cost presets are included for providers that support broad routing:

- OpenRouter: `openai/gpt-5.2-mini`, `google/gemini-2.5-flash`, `deepseek/deepseek-chat`, `qwen/qwen3-coder`
- Hugging Face: `openai/gpt-oss-20b:cheapest`, `openai/gpt-oss-120b:cheapest`, `deepseek-ai/DeepSeek-R1:cheapest`
- Mistral, Gemini, and DeepSeek default toward smaller/flash-style models where practical.

## What It Sends

Commit generation sends staged context only:

- Repository name
- Repository status
- Changed file list
- Diff stats
- Staged patch

Prompt improvement sends only the selected/input prompt text. Absolute local repository paths are not sent.

## Settings

Run **AI Helper: Open Settings** to use the provider-mode setup panel. Each mode shows
only the settings that the extension maps into that provider's request.
The panel uses provider/model dropdowns, custom model input, API key visibility toggles,
and provider-specific validation. API keys entered in the panel are stored in VS Code
SecretStorage instead of normal settings.

Core:

- `aiCommitPromptHelper.provider`
- `aiCommitPromptHelper.model`
- `aiCommitPromptHelper.reasoningEffort`
- `aiCommitPromptHelper.maxDiffChars`
- `aiCommitPromptHelper.codexCommand`
- `aiCommitPromptHelper.codexExtensionCommand`
- `aiCommitPromptHelper.customOpenAiCompatibleBaseUrl`

API keys and tokens:

- Setup panel: stores provider keys in VS Code SecretStorage.
- Existing `aiCommitPromptHelper.*ApiKey` values remain supported as fallbacks.
- Environment fallbacks: `OPENAI_API_KEY`, `DEEPSEEK_API_KEY`, `ANTHROPIC_API_KEY`, `COHERE_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_API_KEY`, `MISTRAL_API_KEY`, `OPENROUTER_API_KEY`, `HF_TOKEN`, `HUGGINGFACE_API_KEY`, and `OPENAI_COMPATIBLE_API_KEY`.
- `aiCommitPromptHelper.apiKey` remains a legacy generic override for the selected HTTP provider.

Prompt/style customization:

- `aiCommitPromptHelper.promptTemplate`
- `aiCommitPromptHelper.additionalPromptInstructions`
- `aiCommitPromptHelper.temperatureOverride`
- `aiCommitPromptHelper.topPOverride`
- `aiCommitPromptHelper.maxOutputTokensOverride`

UI and usage:

- `aiCommitPromptHelper.statusBarText`
- `aiCommitPromptHelper.enableSidebarAction`
- `AI Helper: Improve Prompt`
- `aiCommitPromptHelper.trackTokenUsageAnalytics`
- `aiCommitPromptHelper.analyticsRetentionDays`
- `aiCommitPromptHelper.analyticsSummary`
- `aiCommitPromptHelper.analyticsTotalTokens`
- `aiCommitPromptHelper.analyticsInputTokens`
- `aiCommitPromptHelper.analyticsOutputTokens`
- `aiCommitPromptHelper.analyticsGenerations`
- `aiCommitPromptHelper.analyticsEstimatedRuns`
- `aiCommitPromptHelper.analyticsLastUpdated`

Detailed examples: [`docs/configuration.md`](docs/configuration.md)

## Codex CLI

Codex CLI remains supported for local authenticated Codex sessions.

```bash
codex login
codex --version
npm install -g @openai/codex@latest
```

This extension is tuned for Codex CLI `0.120.0` and newer.

## Token Usage Analytics

Token usage is stored in settings and auto-pruned after `analyticsRetentionDays` (default `7` days). Providers that do not return usage metadata fall back to an estimate.

## Troubleshooting

- No repository detected: open a folder/workspace with a Git repo.
- No staged changes: stage files before generating.
- Codex command not found: run `AI Helper: Setup Codex CLI` or set `aiCommitPromptHelper.codexCommand`.
- HTTP provider auth errors: save the key in `AI Helper: Open Settings`, or set the matching environment variable.
- Legacy settings: v2 reads existing `codexCommitWidget.*` values as fallbacks, but new settings should use `aiCommitPromptHelper.*`.

## License

MIT
