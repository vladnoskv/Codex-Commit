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

const DEFAULT_MODEL = "gpt-5.4-mini";
const SECRET_PREFIX = "aiCommitPromptHelper.secret";

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
    defaultModel: "gpt-5.4-mini",
    modelOptions: ["gpt-5.4-mini", "gpt-5.4-nano"],
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
    modelOptions: ["deepseek-v4-flash", "deepseek-chat"],
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
    modelOptions: ["claude-opus-4-1-20250805", "claude-sonnet-4-5"],
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
    defaultModel: "command-a-03-2025",
    modelOptions: ["command-a-03-2025"],
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
    defaultModel: "gemini-2.5-flash",
    modelOptions: ["gemini-2.5-flash", "gemini-2.5-flash-lite"],
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
    defaultModel: "mistral-small-latest",
    modelOptions: ["mistral-small-latest", "mistral-large-latest"],
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
    defaultModel: "openai/gpt-5.2-mini",
    modelOptions: [
      "openai/gpt-5.2-mini",
      "google/gemini-2.5-flash",
      "deepseek/deepseek-chat",
      "qwen/qwen3-coder"
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
    defaultModel: "openai/gpt-oss-20b:cheapest",
    modelOptions: [
      "openai/gpt-oss-20b:cheapest",
      "openai/gpt-oss-120b:cheapest",
      "deepseek-ai/DeepSeek-R1:cheapest",
      "openai/gpt-oss-20b:fastest"
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
    defaultModel: DEFAULT_MODEL,
    modelOptions: [DEFAULT_MODEL],
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
