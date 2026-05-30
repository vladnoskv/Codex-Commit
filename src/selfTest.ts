import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PROVIDER_MODE_DEFINITIONS,
  getDefaultModelForProvider,
  getProviderLabel,
  normalizeGenerationProvider,
  resolveApiKeyValue
} from "./providers";

function readJsonFile<T>(relativePath: string): T {
  return JSON.parse(readFileSync(join(__dirname, "..", relativePath), "utf8")) as T;
}

function testPackageIdentityMatchesMarketplaceExtensionPath(): void {
  const packageManifest = readJsonFile<{ name: string; version: string }>("package.json");
  const packageLock = readJsonFile<{
    name: string;
    version: string;
    packages: Record<string, { name?: string; version?: string }>;
  }>(
    "package-lock.json"
  );

  assert.equal(packageManifest.name, "codex-commit-widget");
  assert.equal(packageLock.name, "codex-commit-widget");
  assert.equal(packageLock.packages[""].name, "codex-commit-widget");
  assert.equal(packageManifest.version, packageLock.version);
  assert.equal(packageManifest.version, packageLock.packages[""].version);
}

function testPackageContributionIdsUseExtensionNamespace(): void {
  const packageManifest = readJsonFile<{
    activationEvents?: string[];
    contributes: {
      commands: Array<{ command: string }>;
      configuration: { properties: Record<string, unknown> };
      views: Record<string, Array<{ id: string; icon?: string; when?: string }>>;
      viewsContainers: { activitybar: Array<{ id: string }> };
      menus: Record<string, Array<{ command: string }>>;
    };
  }>("package.json");

  const serializedContributions = JSON.stringify(packageManifest.contributes);

  assert.ok(
    !serializedContributions.includes("aiCommitPromptHelper"),
    "package contributions must not use IDs owned by the retired ai-commit-prompt-helper extension"
  );
  assert.ok(
    packageManifest.contributes.commands.every(({ command }) =>
      command.startsWith("codexCommitWidget.")
    )
  );
  assert.ok(
    Object.keys(packageManifest.contributes.configuration.properties).every((key) =>
      key.startsWith("codexCommitWidget.")
    )
  );
  assert.ok(
    Object.values(packageManifest.contributes.views)
      .flat()
      .every((view) => Boolean(view.icon)),
    "contributed views must include icons for VS Code manifest validation"
  );
  assert.ok(
    (packageManifest.activationEvents ?? []).every(
      (event) => !event.startsWith("onCommand:") && !event.startsWith("onView:")
    ),
    "VS Code generates command and view activation events from package contributions"
  );
}

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

testPackageIdentityMatchesMarketplaceExtensionPath();
testPackageContributionIdsUseExtensionNamespace();
testHuggingFaceProviderMetadata();
testOpenRouterLowCostPresets();
testApiKeyResolutionPrefersSecretsBeforeLegacyAndEnvironment();
