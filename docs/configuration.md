# Configuration Guide

This document shows practical `settings.json` examples for Codex Commit Widget.

## Baseline

```json
{
  "codexCommitWidget.provider": "cli",
  "codexCommitWidget.codexCommand": "codex",
  "codexCommitWidget.model": "gpt-5.1-codex-mini",
  "codexCommitWidget.reasoningEffort": "low"
}
```

## Prompt Customization

```json
{
  "codexCommitWidget.promptTemplate": "You are generating a git commit message from staged changes. Return only the commit message. Use conventional commits and include a short risk audit.",
  "codexCommitWidget.additionalPromptInstructions": "Prefer imperative verbs in subject lines. Mention migrations explicitly if present. Keep sections concise."
}
```

## Sampling Overrides

Use these only when you want explicit control over style variability and response size.

```json
{
  "codexCommitWidget.temperatureOverride": 0.2,
  "codexCommitWidget.topPOverride": 0.95,
  "codexCommitWidget.maxOutputTokensOverride": 500
}
```

Set each value to `null` to let Codex defaults apply.

## Token Usage Hover Tracking

```json
{
  "codexCommitWidget.showTokenUsageInTooltip": true
}
```

When enabled, hover the status-bar icon to see token totals over the last 24 hours:

- Total tokens
- Input tokens
- Output tokens
- Number of generations
- Estimated-run count when exact CLI usage metadata is unavailable

## UI Customization

```json
{
  "codexCommitWidget.statusBarText": "$(sparkle) Smart Commit"
}
```

## Auth Requirement

If generation fails due to authentication, run:

```bash
codex auth login
```

Then run commit generation again.
