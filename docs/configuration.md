# Configuration guide

Applies to extension release: `v2.2.0`.

Most people only need the setup panel. Select the **AI Helper** Activity Bar icon, choose a provider, complete the fields shown for it, and select **Save Settings**.

## Recommended setup

### Codex CLI

Choose **Codex CLI**, use **Auto-find Codex CLI**, and then select **Check Codex Status**. Leave the model on **Use provider default**. This avoids pinning a model that a future CLI release may no longer support.

```json
{
  "codexCommitWidget.provider": "codexCli",
  "codexCommitWidget.codexCommand": "codex",
  "codexCommitWidget.model": "",
  "codexCommitWidget.reasoningEffort": "low"
}
```

### Direct API provider

Choose the provider and save its key in the setup panel. Keys entered there are stored in VS Code SecretStorage and do not appear in `settings.json`.

| Provider | Default model | Why |
| --- | --- | --- |
| OpenAI | `gpt-5.4-mini` | Strong and efficient for bounded writing tasks |
| DeepSeek | `deepseek-v4-flash` | Fast, lower-cost V4 option |
| Anthropic Claude | `claude-sonnet-5` | Speed and capability balance |
| Google Gemini | `gemini-3.5-flash` | Stable fast model |
| Cohere | `command-a-plus-05-2026` | Current Command A generation model |
| Mistral | `mistral-medium-latest` | Provider-maintained current alias |
| Z.AI / GLM | `glm-4.7-flash` | Lightweight GLM model for short tasks |

Select **Refresh Models** to replace fallback choices with models available to your account.

## Z.AI and GLM

Choose **Z.AI (GLM)** in the provider list. Save a Z.AI key and select a model such as `glm-4.7-flash`, `glm-5-turbo`, or `glm-5.1`.

```json
{
  "codexCommitWidget.provider": "zai",
  "codexCommitWidget.model": "glm-4.7-flash"
}
```

You may use `ZAI_API_KEY` or `ZHIPUAI_API_KEY` instead of saving a key in VS Code.

## Routers and local models

OpenRouter and Hugging Face expose several model families through one provider. Refresh the list, then choose the exact model available to your account. AI Helper recognizes common OpenAI, Claude, DeepSeek, Gemini, GLM, Cohere, and Mistral IDs and applies the matching concise system instruction.

For Ollama gateways, LM Studio, self-hosted vLLM, or another compatible service, choose **Custom OpenAI-Compatible** and enter the service base URL and exact model ID:

```json
{
  "codexCommitWidget.provider": "customOpenAiCompatible",
  "codexCommitWidget.customOpenAiCompatibleBaseUrl": "http://127.0.0.1:1234/v1",
  "codexCommitWidget.model": "your-model-id"
}
```

The service must provide an OpenAI-style chat-completions endpoint. Model refresh also expects an OpenAI-style `/models` response.

## Cancelling safely

Commit, prompt, and release generation notifications include **Cancel**. On cancellation:

- active HTTP requests are aborted;
- an active Codex child process is stopped;
- late provider results are ignored;
- no generated text is inserted into Source Control.

The message that was already in the Source Control box is left as-is.

## Change the commit format

Edit the prompt in the setup panel, or configure it directly:

```json
{
  "codexCommitWidget.additionalPromptInstructions": "Use imperative subjects. Mention migrations when present. Keep every section concise."
}
```

The built-in prompt asks for a Conventional Commit subject, change summary, file-to-intent mapping, and audit notes. Provider-specific system instructions are added automatically.

## Limits and cost controls

- **Max diff characters** limits staged context before it is sent.
- **Max output tokens** limits response length when supported.
- **Temperature** and **Top P** are optional; leave them empty for provider defaults.
- **Reasoning effort** is sent to Codex CLI and compatible OpenAI models.
- **Track token usage** stores a local rolling summary. Missing API usage is marked as estimated.

For predictable commit messages, provider defaults and low reasoning effort are usually sufficient.

## Environment variables

```text
OPENAI_API_KEY
DEEPSEEK_API_KEY
ANTHROPIC_API_KEY
COHERE_API_KEY
GEMINI_API_KEY or GOOGLE_API_KEY
MISTRAL_API_KEY
ZAI_API_KEY or ZHIPUAI_API_KEY
OPENROUTER_API_KEY
HF_TOKEN or HUGGINGFACE_API_KEY
OPENAI_COMPATIBLE_API_KEY
```

## Advanced settings

```json
{
  "codexCommitWidget.maxDiffChars": 120000,
  "codexCommitWidget.reasoningEffort": "low",
  "codexCommitWidget.temperatureOverride": null,
  "codexCommitWidget.topPOverride": null,
  "codexCommitWidget.maxOutputTokensOverride": null,
  "codexCommitWidget.trackTokenUsageAnalytics": true,
  "codexCommitWidget.analyticsRetentionDays": 7
}
```

Older `aiCommitPromptHelper.*` settings are still read as migration fallbacks. New configuration should use `codexCommitWidget.*`.
