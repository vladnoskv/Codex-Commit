export type GenerationProvider =
  | "codexCli"
  | "codexExtensionThenCli"
  | "openai"
  | "deepseek"
  | "anthropic"
  | "cohere"
  | "gemini"
  | "mistral"
  | "openrouter"
  | "huggingface"
  | "customOpenAiCompatible";

export type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh";

export type ProviderModeDefinition = {
  provider: GenerationProvider;
  label: string;
  defaultModel: string;
  modelOptions: string[];
  apiKeySetting: string | null;
  apiKeyLabel: string | null;
  apiKeyEnvironment: string | null;
  secretKey: string | null;
  defaultBaseUrl: string | null;
  supportsReasoningEffort: boolean;
  supportsSamplingOverrides: boolean;
  requiresCodexCommand: boolean;
  requiresCodexExtensionCommand: boolean;
  requiresCustomBaseUrl: boolean;
};

const DEFAULT_MODEL = "gpt-5.5";
const SECRET_PREFIX = "aiCommitPromptHelper.secret";
const CODEX_CLI_MODEL_COMPATIBILITY: Record<
  string,
  { blockedThrough: string; fallbackModel: string }
> = {
  "gpt-5.5": { blockedThrough: "0.120.0", fallbackModel: "gpt-5.4" }
};

export const GENERIC_API_KEY_SECRET_KEY = `${SECRET_PREFIX}.apiKey`;

export const PROVIDER_MODE_DEFINITIONS: Record<GenerationProvider, ProviderModeDefinition> = {
  codexCli: {
    provider: "codexCli",
    label: "Codex CLI",
    defaultModel: DEFAULT_MODEL,
    modelOptions: [DEFAULT_MODEL],
    apiKeySetting: null,
    apiKeyLabel: null,
    apiKeyEnvironment: null,
    secretKey: null,
    defaultBaseUrl: null,
    supportsReasoningEffort: true,
    supportsSamplingOverrides: true,
    requiresCodexCommand: true,
    requiresCodexExtensionCommand: false,
    requiresCustomBaseUrl: false
  },
  codexExtensionThenCli: {
    provider: "codexExtensionThenCli",
    label: "Codex Extension, Then CLI",
    defaultModel: DEFAULT_MODEL,
    modelOptions: [DEFAULT_MODEL],
    apiKeySetting: null,
    apiKeyLabel: null,
    apiKeyEnvironment: null,
    secretKey: null,
    defaultBaseUrl: null,
    supportsReasoningEffort: true,
    supportsSamplingOverrides: true,
    requiresCodexCommand: true,
    requiresCodexExtensionCommand: true,
    requiresCustomBaseUrl: false
  },
  openai: {
    provider: "openai",
    label: "OpenAI",
    defaultModel: "gpt-5.5",
    modelOptions: ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.4-nano"],
    apiKeySetting: "openAiApiKey",
    apiKeyLabel: "OpenAI API key",
    apiKeyEnvironment: "OPENAI_API_KEY",
    secretKey: `${SECRET_PREFIX}.openai`,
    defaultBaseUrl: "https://api.openai.com/v1",
    supportsReasoningEffort: false,
    supportsSamplingOverrides: true,
    requiresCodexCommand: false,
    requiresCodexExtensionCommand: false,
    requiresCustomBaseUrl: false
  },
  deepseek: {
    provider: "deepseek",
    label: "DeepSeek",
    defaultModel: "deepseek-v4-flash",
    modelOptions: ["deepseek-v4-flash", "deepseek-v4-pro"],
    apiKeySetting: "deepSeekApiKey",
    apiKeyLabel: "DeepSeek API key",
    apiKeyEnvironment: "DEEPSEEK_API_KEY",
    secretKey: `${SECRET_PREFIX}.deepseek`,
    defaultBaseUrl: "https://api.deepseek.com",
    supportsReasoningEffort: false,
    supportsSamplingOverrides: true,
    requiresCodexCommand: false,
    requiresCodexExtensionCommand: false,
    requiresCustomBaseUrl: false
  },
  anthropic: {
    provider: "anthropic",
    label: "Anthropic Claude",
    defaultModel: "claude-opus-4-1-20250805",
    modelOptions: [
      "claude-opus-4-1-20250805",
      "claude-opus-4-20250514",
      "claude-sonnet-4-20250514",
      "claude-3-7-sonnet-20250219",
      "claude-3-5-haiku-20241022"
    ],
    apiKeySetting: "anthropicApiKey",
    apiKeyLabel: "Anthropic API key",
    apiKeyEnvironment: "ANTHROPIC_API_KEY",
    secretKey: `${SECRET_PREFIX}.anthropic`,
    defaultBaseUrl: null,
    supportsReasoningEffort: false,
    supportsSamplingOverrides: true,
    requiresCodexCommand: false,
    requiresCodexExtensionCommand: false,
    requiresCustomBaseUrl: false
  },
  cohere: {
    provider: "cohere",
    label: "Cohere",
    defaultModel: "command-a-plus-05-2026",
    modelOptions: [
      "command-a-plus-05-2026",
      "command-a-03-2025",
      "command-a-reasoning-08-2025",
      "command-a-translate-08-2025",
      "command-a-vision-07-2025",
      "command-r7b-12-2024",
      "command-r-plus-08-2024",
      "command-r-08-2024",
      "tiny-aya-global",
      "tiny-aya-earth",
      "tiny-aya-fire"
    ],
    apiKeySetting: "cohereApiKey",
    apiKeyLabel: "Cohere API key",
    apiKeyEnvironment: "COHERE_API_KEY",
    secretKey: `${SECRET_PREFIX}.cohere`,
    defaultBaseUrl: null,
    supportsReasoningEffort: false,
    supportsSamplingOverrides: true,
    requiresCodexCommand: false,
    requiresCodexExtensionCommand: false,
    requiresCustomBaseUrl: false
  },
  gemini: {
    provider: "gemini",
    label: "Google Gemini",
    defaultModel: "gemini-3.5-flash",
    modelOptions: [
      "gemini-3.5-flash",
      "gemini-3.1-pro-preview",
      "gemini-3.1-flash-lite",
      "gemini-3-flash-preview",
      "gemini-2.5-pro",
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite"
    ],
    apiKeySetting: "geminiApiKey",
    apiKeyLabel: "Google Gemini API key",
    apiKeyEnvironment: "GEMINI_API_KEY or GOOGLE_API_KEY",
    secretKey: `${SECRET_PREFIX}.gemini`,
    defaultBaseUrl: null,
    supportsReasoningEffort: false,
    supportsSamplingOverrides: true,
    requiresCodexCommand: false,
    requiresCodexExtensionCommand: false,
    requiresCustomBaseUrl: false
  },
  mistral: {
    provider: "mistral",
    label: "Mistral",
    defaultModel: "mistral-medium-latest",
    modelOptions: [
      "mistral-medium-latest",
      "mistral-large-latest",
      "mistral-small-latest",
      "ministral-14b-latest",
      "ministral-8b-latest",
      "ministral-3b-latest",
      "devstral-latest",
      "devstral-small-latest",
      "magistral-medium-latest",
      "magistral-small-latest",
      "codestral-latest",
      "voxtral-small-latest",
      "labs-mistral-small-creative"
    ],
    apiKeySetting: "mistralApiKey",
    apiKeyLabel: "Mistral API key",
    apiKeyEnvironment: "MISTRAL_API_KEY",
    secretKey: `${SECRET_PREFIX}.mistral`,
    defaultBaseUrl: "https://api.mistral.ai/v1",
    supportsReasoningEffort: false,
    supportsSamplingOverrides: true,
    requiresCodexCommand: false,
    requiresCodexExtensionCommand: false,
    requiresCustomBaseUrl: false
  },
  openrouter: {
    provider: "openrouter",
    label: "OpenRouter",
    defaultModel: "openai/gpt-5.5",
    modelOptions: [
      "openai/gpt-5.5",
      "openai/gpt-5.4",
      "openai/gpt-5.4-mini",
      "anthropic/claude-opus-4.8",
      "anthropic/claude-opus-4.8-fast",
      "google/gemini-3.5-flash",
      "google/gemini-3.1-flash-lite",
      "deepseek/deepseek-v4-flash",
      "deepseek/deepseek-v4-pro",
      "qwen/qwen3.7-max",
      "x-ai/grok-4.3",
      "x-ai/grok-build-0.1",
      "mistralai/mistral-medium-3-5",
      "openrouter/owl-alpha"
    ],
    apiKeySetting: "openRouterApiKey",
    apiKeyLabel: "OpenRouter API key",
    apiKeyEnvironment: "OPENROUTER_API_KEY",
    secretKey: `${SECRET_PREFIX}.openrouter`,
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    supportsReasoningEffort: false,
    supportsSamplingOverrides: true,
    requiresCodexCommand: false,
    requiresCodexExtensionCommand: false,
    requiresCustomBaseUrl: false
  },
  huggingface: {
    provider: "huggingface",
    label: "Hugging Face",
    defaultModel: "openai/gpt-oss-120b",
    modelOptions: [
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
      "Qwen/Qwen3-Coder-480B-A35B-Instruct",
      "Qwen/Qwen3-4B-Thinking-2507",
      "Qwen/Qwen2.5-7B-Instruct-1M",
      "Qwen/Qwen2.5-Coder-32B-Instruct",
      "deepseek-ai/DeepSeek-R1",
      "zai-org/GLM-4.5",
      "google/gemma-2-2b-it"
    ],
    apiKeySetting: "huggingFaceApiKey",
    apiKeyLabel: "Hugging Face token",
    apiKeyEnvironment: "HF_TOKEN or HUGGINGFACE_API_KEY",
    secretKey: `${SECRET_PREFIX}.huggingface`,
    defaultBaseUrl: "https://router.huggingface.co/v1",
    supportsReasoningEffort: false,
    supportsSamplingOverrides: true,
    requiresCodexCommand: false,
    requiresCodexExtensionCommand: false,
    requiresCustomBaseUrl: false
  },
  customOpenAiCompatible: {
    provider: "customOpenAiCompatible",
    label: "Custom OpenAI-Compatible",
    defaultModel: "",
    modelOptions: [],
    apiKeySetting: "customOpenAiCompatibleApiKey",
    apiKeyLabel: "Custom provider API key",
    apiKeyEnvironment: "OPENAI_COMPATIBLE_API_KEY",
    secretKey: `${SECRET_PREFIX}.customOpenAiCompatible`,
    defaultBaseUrl: null,
    supportsReasoningEffort: false,
    supportsSamplingOverrides: true,
    requiresCodexCommand: false,
    requiresCodexExtensionCommand: false,
    requiresCustomBaseUrl: true
  }
};

export function normalizeGenerationProvider(value: string): GenerationProvider {
  switch (value) {
    case "cli":
    case "codexCli":
      return "codexCli";
    case "extensionThenCli":
    case "codexExtensionThenCli":
      return "codexExtensionThenCli";
    case "openai":
    case "deepseek":
    case "anthropic":
    case "cohere":
    case "gemini":
    case "mistral":
    case "openrouter":
    case "huggingface":
    case "customOpenAiCompatible":
      return value;
    default:
      return "codexCli";
  }
}

export function getDefaultModelForProvider(provider: GenerationProvider): string {
  return PROVIDER_MODE_DEFINITIONS[provider].defaultModel;
}

export function resolveConfiguredModelForProvider(
  provider: GenerationProvider,
  configuredModel: string
): string {
  const definition = PROVIDER_MODE_DEFINITIONS[provider];
  const trimmed = configuredModel.trim();
  if (!trimmed) {
    return definition.defaultModel;
  }

  if (provider === "customOpenAiCompatible" || provider === "codexCli" || provider === "codexExtensionThenCli") {
    return trimmed;
  }

  return definition.modelOptions.includes(trimmed) ? trimmed : definition.defaultModel;
}

export function isCodexCliModelBlockedByVersion(model: string, cliVersion: string): boolean {
  const compatibility = CODEX_CLI_MODEL_COMPATIBILITY[model.trim()];
  if (!compatibility) {
    return false;
  }

  const parsedCliVersion = parseSemver(cliVersion);
  const parsedBlockedThrough = parseSemver(compatibility.blockedThrough);
  if (!parsedCliVersion || !parsedBlockedThrough) {
    return false;
  }

  return compareSemver(parsedCliVersion, parsedBlockedThrough) <= 0;
}

export function getCodexCliModelFallbackForVersion(
  model: string,
  cliVersion: string
): string | null {
  const compatibility = CODEX_CLI_MODEL_COMPATIBILITY[model.trim()];
  if (!compatibility || !isCodexCliModelBlockedByVersion(model, cliVersion)) {
    return null;
  }

  return compatibility.fallbackModel;
}

function parseSemver(text: string): [number, number, number] | null {
  const match = text.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    return null;
  }

  const major = Number.parseInt(match[1], 10);
  const minor = Number.parseInt(match[2], 10);
  const patch = Number.parseInt(match[3], 10);
  if (![major, minor, patch].every((part) => Number.isFinite(part))) {
    return null;
  }

  return [major, minor, patch];
}

function compareSemver(
  left: [number, number, number],
  right: [number, number, number]
): number {
  for (let i = 0; i < 3; i += 1) {
    if (left[i] > right[i]) {
      return 1;
    }
    if (left[i] < right[i]) {
      return -1;
    }
  }
  return 0;
}

export function getProviderLabel(provider: GenerationProvider): string {
  return PROVIDER_MODE_DEFINITIONS[provider].label;
}

export function resolveApiKeyValue(options: {
  genericSecret: string;
  providerSecret: string;
  legacySetting: string;
  environmentValues: string[];
}): string {
  const values = [
    options.genericSecret,
    options.providerSecret,
    options.legacySetting,
    ...options.environmentValues
  ];
  return values.map((value) => value.trim()).find(Boolean) ?? "";
}
