# Configuration Guide

This document shows practical `settings.json` examples for **AI Commit & Prompt Helper**.

Applies to extension release: `v2.0.3`.

## Visual Preview

Commit action in Source Control:

![Source Control commit button](../media/commit-button.png)

Settings examples:

![Settings example 1](../media/commit-settings-1.PNG)
![Settings example 2](../media/commit-settings-2.PNG)

## Baseline

Run `AI Helper: Open Settings` for the provider-mode setup panel. It writes non-secret
settings shown below, while hiding controls that are not used by the selected provider.
API keys entered in the panel are stored in VS Code SecretStorage. Existing key values
in `settings.json` still work as migration fallbacks.

```json
{
  "codexCommitWidget.provider": "codexCli",
  "codexCommitWidget.codexCommand": "codex",
  "codexCommitWidget.model": "",
  "codexCommitWidget.reasoningEffort": "low",
  "codexCommitWidget.enableSidebarAction": true
}
```

Leave `model` empty to use the built-in default for the selected provider.

## Provider Examples

OpenAI:

```json
{
  "codexCommitWidget.provider": "openai",
  "codexCommitWidget.model": "gpt-5.4-mini",
  "codexCommitWidget.openAiApiKey": ""
}
```

DeepSeek:

```json
{
  "codexCommitWidget.provider": "deepseek",
  "codexCommitWidget.model": "deepseek-v4-flash",
  "codexCommitWidget.deepSeekApiKey": ""
}
```

Anthropic Claude:

```json
{
  "codexCommitWidget.provider": "anthropic",
  "codexCommitWidget.model": "claude-opus-4-1-20250805",
  "codexCommitWidget.anthropicApiKey": ""
}
```

Google Gemini:

```json
{
  "codexCommitWidget.provider": "gemini",
  "codexCommitWidget.model": "gemini-2.5-flash",
  "codexCommitWidget.geminiApiKey": ""
}
```

Mistral, Cohere, OpenRouter, Hugging Face, and custom OpenAI-compatible endpoints:

```json
{
  "codexCommitWidget.provider": "mistral",
  "codexCommitWidget.model": "mistral-small-latest",
  "codexCommitWidget.mistralApiKey": ""
}
```

```json
{
  "codexCommitWidget.provider": "cohere",
  "codexCommitWidget.model": "command-a-03-2025",
  "codexCommitWidget.cohereApiKey": ""
}
```

```json
{
  "codexCommitWidget.provider": "openrouter",
  "codexCommitWidget.model": "openai/gpt-5.2-mini",
  "codexCommitWidget.openRouterApiKey": ""
}
```

```json
{
  "codexCommitWidget.provider": "huggingface",
  "codexCommitWidget.model": "openai/gpt-oss-20b:cheapest",
  "codexCommitWidget.huggingFaceApiKey": ""
}
```

```json
{
  "codexCommitWidget.provider": "customOpenAiCompatible",
  "codexCommitWidget.customOpenAiCompatibleBaseUrl": "https://api.example.com/v1",
  "codexCommitWidget.model": "provider-model-id",
  "codexCommitWidget.customOpenAiCompatibleApiKey": ""
}
```

Prefer the setup panel or environment variables for API keys. Environment fallbacks:

- `OPENAI_API_KEY`
- `DEEPSEEK_API_KEY`
- `ANTHROPIC_API_KEY`
- `COHERE_API_KEY`
- `GEMINI_API_KEY` or `GOOGLE_API_KEY`
- `MISTRAL_API_KEY`
- `OPENROUTER_API_KEY`
- `HF_TOKEN` or `HUGGINGFACE_API_KEY`
- `OPENAI_COMPATIBLE_API_KEY`

Low-cost provider presets:

- OpenRouter: `openai/gpt-5.2-mini`, `google/gemini-2.5-flash`, `deepseek/deepseek-chat`, `qwen/qwen3-coder`
- Hugging Face: `openai/gpt-oss-20b:cheapest`, `openai/gpt-oss-120b:cheapest`, `deepseek-ai/DeepSeek-R1:cheapest`
- Mistral: `mistral-small-latest`
- Gemini: `gemini-2.5-flash`

## CLI Setup

If Codex CLI is installed globally but not detected in VS Code:

1. Run `AI Helper: Setup Codex CLI` from the Command Palette.
2. Or use the sidebar action `Setup Codex CLI` in the AI Helper view.

## Prompt Customization

```json
{
  "codexCommitWidget.promptTemplate": "You are generating a git commit message from staged changes. Return only the commit message. Use conventional commits and include a short risk audit.",
  "codexCommitWidget.additionalPromptInstructions": "Prefer imperative verbs in subject lines. Mention migrations explicitly if present. Keep sections concise."
}
```

## Improve Prompt

Run `AI Helper: Improve Prompt` from the Command Palette or the AI Helper sidebar to
rewrite selected editor text into a clearer coding-agent prompt. If no text is selected,
the extension asks for prompt text first. It uses the same configured provider, model,
API key, reasoning effort, and sampling overrides, then opens a review document before
you copy, open, or replace the result.

## Sampling Overrides

Use these only when you want explicit control over style variability and response size.

```json
{
  "codexCommitWidget.temperatureOverride": 0.2,
  "codexCommitWidget.topPOverride": 0.95,
  "codexCommitWidget.maxOutputTokensOverride": 500
}
```

Set each value to `null` to let provider defaults apply.

## Token Usage Analytics

```json
{
  "codexCommitWidget.trackTokenUsageAnalytics": true,
  "codexCommitWidget.analyticsRetentionDays": 7
}
```

The extension auto-populates these settings from tracked runs:

- `codexCommitWidget.analyticsSummary`
- `codexCommitWidget.analyticsTotalTokens`
- `codexCommitWidget.analyticsInputTokens`
- `codexCommitWidget.analyticsOutputTokens`
- `codexCommitWidget.analyticsGenerations`
- `codexCommitWidget.analyticsEstimatedRuns`
- `codexCommitWidget.analyticsLastUpdated`

## Migration From v1

New settings use `codexCommitWidget.*`. Existing `aiCommitPromptHelper.*` values are read
as fallbacks, but update your settings to the public extension namespace when practical.
