# Configuration Guide

This document shows practical `settings.json` examples for **AI Commit & Prompt Helper**.

Applies to extension release: `v2.0.1`.

## Visual Preview

Commit action in Source Control:

![Source Control commit button](../media/commit-button.png)

Settings examples:

![Settings example 1](../media/commit-settings-1.PNG)
![Settings example 2](../media/commit-settings-2.PNG)

## Baseline

```json
{
  "aiCommitPromptHelper.provider": "codexCli",
  "aiCommitPromptHelper.codexCommand": "codex",
  "aiCommitPromptHelper.model": "",
  "aiCommitPromptHelper.reasoningEffort": "low",
  "aiCommitPromptHelper.enableSidebarAction": true
}
```

Leave `model` empty to use the built-in default for the selected provider.

## Provider Examples

OpenAI:

```json
{
  "aiCommitPromptHelper.provider": "openai",
  "aiCommitPromptHelper.model": "gpt-5.4-mini",
  "aiCommitPromptHelper.openAiApiKey": ""
}
```

DeepSeek:

```json
{
  "aiCommitPromptHelper.provider": "deepseek",
  "aiCommitPromptHelper.model": "deepseek-v4-flash",
  "aiCommitPromptHelper.deepSeekApiKey": ""
}
```

Anthropic Claude:

```json
{
  "aiCommitPromptHelper.provider": "anthropic",
  "aiCommitPromptHelper.model": "claude-opus-4-1-20250805",
  "aiCommitPromptHelper.anthropicApiKey": ""
}
```

Google Gemini:

```json
{
  "aiCommitPromptHelper.provider": "gemini",
  "aiCommitPromptHelper.model": "gemini-2.5-flash",
  "aiCommitPromptHelper.geminiApiKey": ""
}
```

Mistral, Cohere, OpenRouter, and custom OpenAI-compatible endpoints:

```json
{
  "aiCommitPromptHelper.provider": "mistral",
  "aiCommitPromptHelper.model": "mistral-large-latest",
  "aiCommitPromptHelper.mistralApiKey": ""
}
```

```json
{
  "aiCommitPromptHelper.provider": "cohere",
  "aiCommitPromptHelper.model": "command-a-03-2025",
  "aiCommitPromptHelper.cohereApiKey": ""
}
```

```json
{
  "aiCommitPromptHelper.provider": "openrouter",
  "aiCommitPromptHelper.model": "openai/gpt-4",
  "aiCommitPromptHelper.openRouterApiKey": ""
}
```

```json
{
  "aiCommitPromptHelper.provider": "customOpenAiCompatible",
  "aiCommitPromptHelper.customOpenAiCompatibleBaseUrl": "https://api.example.com/v1",
  "aiCommitPromptHelper.model": "provider-model-id",
  "aiCommitPromptHelper.customOpenAiCompatibleApiKey": ""
}
```

Prefer environment variables for API keys:

- `OPENAI_API_KEY`
- `DEEPSEEK_API_KEY`
- `ANTHROPIC_API_KEY`
- `COHERE_API_KEY`
- `GEMINI_API_KEY` or `GOOGLE_API_KEY`
- `MISTRAL_API_KEY`
- `OPENROUTER_API_KEY`
- `OPENAI_COMPATIBLE_API_KEY`

## CLI Setup

If Codex CLI is installed globally but not detected in VS Code:

1. Run `AI Helper: Setup Codex CLI` from the Command Palette.
2. Or use the sidebar action `Setup Codex CLI` in the AI Helper view.

## Prompt Customization

```json
{
  "aiCommitPromptHelper.promptTemplate": "You are generating a git commit message from staged changes. Return only the commit message. Use conventional commits and include a short risk audit.",
  "aiCommitPromptHelper.additionalPromptInstructions": "Prefer imperative verbs in subject lines. Mention migrations explicitly if present. Keep sections concise."
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
  "aiCommitPromptHelper.temperatureOverride": 0.2,
  "aiCommitPromptHelper.topPOverride": 0.95,
  "aiCommitPromptHelper.maxOutputTokensOverride": 500
}
```

Set each value to `null` to let provider defaults apply.

## Token Usage Analytics

```json
{
  "aiCommitPromptHelper.trackTokenUsageAnalytics": true,
  "aiCommitPromptHelper.analyticsRetentionDays": 7
}
```

The extension auto-populates these settings from tracked runs:

- `aiCommitPromptHelper.analyticsSummary`
- `aiCommitPromptHelper.analyticsTotalTokens`
- `aiCommitPromptHelper.analyticsInputTokens`
- `aiCommitPromptHelper.analyticsOutputTokens`
- `aiCommitPromptHelper.analyticsGenerations`
- `aiCommitPromptHelper.analyticsEstimatedRuns`
- `aiCommitPromptHelper.analyticsLastUpdated`

## Migration From v1

New settings use `aiCommitPromptHelper.*`. Existing `codexCommitWidget.*` values are read
as fallbacks, but update your settings to the new namespace when practical.
