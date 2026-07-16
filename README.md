# AI Commit & Prompt Helper v2.2.0

![AI Commit & Prompt Helper logo](media/logo.png)

Write useful commit messages, improve coding prompts, and prepare release notes without leaving VS Code. Choose Codex CLI or connect the AI provider you already use.

Current extension release: `v2.2.0`.

## Get started

1. Open a Git repository in VS Code.
2. Select the **AI Helper** icon in the Activity Bar.
3. Choose a provider, add its API key or Codex command, and select **Save Settings**.
4. Stage the changes you want to commit.
5. Select the sparkle button in Source Control, or run **AI Helper: Generate Commit Message**.
6. Review the generated text in the Source Control message box before committing.

While AI is working, the VS Code notification includes **Cancel**. Cancelling stops the HTTP request or Codex process and leaves the Source Control message unchanged.

## Which provider should I choose?

- **Codex CLI** is the simplest choice if you already use Codex. Leave the model set to **Use provider default** so your installed CLI chooses a model it supports.
- **OpenAI** defaults to `gpt-5.4-mini`, a strong speed, quality, and cost balance for commit summaries.
- **Anthropic Claude** defaults to `claude-sonnet-5`, the balanced Claude option. Faster and more capable models can be selected after refreshing the list.
- **DeepSeek** defaults to `deepseek-v4-flash` for fast, cost-efficient generation.
- **Google Gemini** defaults to the stable `gemini-3.5-flash` model.
- **Z.AI (GLM)** defaults to `glm-4.7-flash`; GLM 5 models are also available.
- **Cohere** and **Mistral** use their current provider aliases, so provider-side upgrades do not require a settings change.
- **OpenRouter** and **Hugging Face** are useful when you want several model families behind one account.
- **Custom OpenAI-Compatible** works with local servers and other services that expose `/v1/chat/completions` and `/v1/models`-style endpoints.

Provider catalogs change often. Use **Refresh Models** in the setup panel to load the models available to your own account. The bundled list is only a fallback for first-time and offline setup.

## Codex setup

Install and sign in to Codex CLI, then restart VS Code if it was already open:

```bash
npm install -g @openai/codex@latest
codex login
codex login status
```

In AI Helper settings, use **Auto-find Codex CLI**, then **Check Codex Status**. Keeping the model empty is recommended: the extension passes no `--model` flag, allowing each Codex CLI release to use its supported default.

**Codex Extension, Then CLI** is an advanced compatibility mode. It calls the VS Code command ID you provide only when that command returns generated text; if it cannot, generation falls back to Codex CLI.

## Other commands

### Improve a prompt

Select prompt text in an editor and run **AI Helper: Improve Prompt**. With no selection, the extension asks you to paste a prompt. The result opens for review before anything is copied or replaced.

### Prepare a release

Run **AI Helper: Generate Release Assistant**. The extension reads commits since the latest Git tag and opens a reviewable Markdown draft containing:

- a suggested semantic-version change;
- a changelog;
- GitHub and npm release copy;
- a PR description;
- a reviewer checklist.

It does not create a tag, publish a package, create a GitHub release, or modify repository files.

## Privacy and control

Commit generation sends only the staged context needed for the message:

- repository name;
- Git status and staged file names;
- staged diff statistics and patch.

Absolute repository paths are not sent. Prompt improvement sends only the selected or entered prompt. Release generation sends the selected Git history, changed file names, diff statistics, package name, and target version.

API keys saved in the setup panel use VS Code SecretStorage. Environment variables and older `settings.json` key fields remain supported for migration, but SecretStorage is recommended.

## Model-aware output

The extension adds a short system instruction suited to the selected family—Codex/OpenAI, Claude, DeepSeek, Gemini, GLM, Cohere, or Mistral. Routed models on OpenRouter, Hugging Face, and compatible endpoints are recognized from their model IDs. These instructions keep commit and release output concise, prevent reasoning traces from leaking into SCM text, and treat diff or Git content as data rather than instructions.

You can still customize the main commit format with:

- `codexCommitWidget.promptTemplate`
- `codexCommitWidget.additionalPromptInstructions`
- sampling and output-token overrides in the setup panel

See the friendly [configuration guide](docs/configuration.md) for examples.

## Troubleshooting

- **No repository found:** open the repository folder in VS Code and make sure the built-in Git extension is enabled.
- **No staged changes:** stage at least one file before generating a commit message.
- **Codex not found:** use **Auto-find Codex CLI**, or enter the full `codex` executable path.
- **Codex login failed:** run `codex login status` in a terminal, sign in again if needed, then select **Check Codex Status**.
- **A model is unavailable:** select **Refresh Models** and choose a model returned for your account. For Codex, choose **Use provider default**.
- **An API request is rejected:** check the provider key, account access, model availability, and billing or rate limits.
- **Generation is taking too long:** select **Cancel** in the notification. The existing SCM message will remain unchanged.

## Supported providers and environment variables

| Provider | Environment variable |
| --- | --- |
| OpenAI | `OPENAI_API_KEY` |
| DeepSeek | `DEEPSEEK_API_KEY` |
| Anthropic Claude | `ANTHROPIC_API_KEY` |
| Cohere | `COHERE_API_KEY` |
| Google Gemini | `GEMINI_API_KEY` or `GOOGLE_API_KEY` |
| Mistral | `MISTRAL_API_KEY` |
| Z.AI / GLM | `ZAI_API_KEY` or `ZHIPUAI_API_KEY` |
| OpenRouter | `OPENROUTER_API_KEY` |
| Hugging Face | `HF_TOKEN` or `HUGGINGFACE_API_KEY` |
| Custom compatible API | `OPENAI_COMPATIBLE_API_KEY` |

## Release notes

### v2.2.0

- Added cancellable generation that protects the Source Control message.
- Added first-class Z.AI/GLM support and model-family-specific system instructions.
- Improved live model discovery and provider defaults for current Codex, OpenAI, Claude, DeepSeek, Gemini, Cohere, and Mistral setups.
- Added custom model IDs for every provider and keyless local OpenAI-compatible endpoints.
- Synchronized native VS Code settings with the open setup webview.
- Reworked setup and troubleshooting documentation around user tasks.

### v2.1.0

- Added the release assistant workflow for changelogs, release notes, PR descriptions, and reviewer checklists.

Earlier release history is available in the repository tags and GitHub releases.

## License

MIT
