import { strict as assert } from "node:assert";
import {
  PROVIDER_MODE_DEFINITIONS,
  getDefaultModelForProvider,
  getProviderLabel,
  normalizeGenerationProvider,
  resolveApiKeyValue
} from "./providers";

function testHuggingFaceProviderMetadata(): void {
  const definition = PROVIDER_MODE_DEFINITIONS.huggingface;

  assert.equal(normalizeGenerationProvider("huggingface"), "huggingface");
  assert.equal(getProviderLabel("huggingface"), "Hugging Face");
  assert.equal(getDefaultModelForProvider("huggingface"), "openai/gpt-oss-20b:cheapest");
  assert.equal(definition.defaultBaseUrl, "https://router.huggingface.co/v1");
  assert.equal(definition.secretKey, "aiCommitPromptHelper.secret.huggingface");
  assert.ok(definition.modelOptions.includes("openai/gpt-oss-120b:cheapest"));
}

function testOpenRouterLowCostPresets(): void {
  const definition = PROVIDER_MODE_DEFINITIONS.openrouter;

  assert.ok(definition.modelOptions.includes("openai/gpt-5.2-mini"));
  assert.ok(definition.modelOptions.includes("google/gemini-2.5-flash"));
  assert.equal(definition.secretKey, "aiCommitPromptHelper.secret.openrouter");
}

function testApiKeyResolutionPrefersSecretsBeforeLegacyAndEnvironment(): void {
  assert.equal(
    resolveApiKeyValue({
      genericSecret: "generic-secret",
      providerSecret: "provider-secret",
      legacySetting: "legacy-key",
      environmentValues: ["env-key"]
    }),
    "generic-secret"
  );
  assert.equal(
    resolveApiKeyValue({
      genericSecret: "",
      providerSecret: "provider-secret",
      legacySetting: "legacy-key",
      environmentValues: ["env-key"]
    }),
    "provider-secret"
  );
  assert.equal(
    resolveApiKeyValue({
      genericSecret: "",
      providerSecret: "",
      legacySetting: "legacy-key",
      environmentValues: ["env-key"]
    }),
    "legacy-key"
  );
  assert.equal(
    resolveApiKeyValue({
      genericSecret: "",
      providerSecret: "",
      legacySetting: "",
      environmentValues: ["", "env-key"]
    }),
    "env-key"
  );
}

testHuggingFaceProviderMetadata();
testOpenRouterLowCostPresets();
testApiKeyResolutionPrefersSecretsBeforeLegacyAndEnvironment();
