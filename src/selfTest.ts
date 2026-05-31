import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PROVIDER_MODE_DEFINITIONS,
  getCodexCliModelFallbackForVersion,
  getDefaultModelForProvider,
  getProviderLabel,
  isCodexCliModelBlockedByVersion,
  normalizeGenerationProvider,
  resolveConfiguredModelForProvider,
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
      views: Record<
        string,
        Array<{ id: string; icon?: string; name?: string; type?: string; when?: string }>
      >;
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
    Object.values(packageManifest.contributes.views)
      .flat()
      .every((view) => view.when === undefined),
    "contributed views must not be hidden behind context keys before activation"
  );
  assert.ok(
    Object.values(packageManifest.contributes.views)
      .flat()
      .every((view) => view.name === "Settings"),
    "AI Helper Activity Bar view should be named Settings, not Actions"
  );
  assert.ok(
    Object.values(packageManifest.contributes.views)
      .flat()
      .every((view) => view.type === "webview"),
    "sidebar view must be contributed as a webview so VS Code uses the registered WebviewViewProvider"
  );
  assert.ok(
    (packageManifest.activationEvents ?? []).every(
      (event) => !event.startsWith("onCommand:") && !event.startsWith("onView:")
    ),
    "VS Code generates command and view activation events from package contributions"
  );
  assert.ok(
    !Object.prototype.hasOwnProperty.call(
      packageManifest.contributes.configuration.properties,
      "codexCommitWidget.enableSidebarAction"
    ),
    "sidebar action visibility is no longer configurable because the Activity Bar icon opens settings"
  );
}

function testSidebarActionOnlyOpensSettings(): void {
  const extensionSource = readFileSync(join(__dirname, "extension.js"), "utf8");

  assert.ok(
    extensionSource.includes("registerWebviewViewProvider(SIDEBAR_VIEW_ID"),
    "sidebar view should open the settings panel without a tree menu"
  );
  assert.ok(
    !extensionSource.includes("createTreeView(SIDEBAR_VIEW_ID"),
    "sidebar view should not render a tree menu"
  );
  assert.ok(
    extensionSource.includes("Run Setup Wizard"),
    "settings panel should expose a setup wizard rerun action"
  );
  assert.ok(
    extensionSource.includes("const allowCustom = mode.provider === \"customOpenAiCompatible\""),
    "custom model input must be scoped to custom-compatible provider modes"
  );
  assert.ok(
    !extensionSource.includes('new vscode.TreeItem("Generate Commit Message"'),
    "sidebar should not duplicate generate actions"
  );
  assert.ok(
    !extensionSource.includes('new vscode.TreeItem("Improve Prompt"'),
    "sidebar should not duplicate prompt actions"
  );
  assert.ok(
    extensionSource.includes("Run Setup Wizard opens this guided settings flow"),
    "setup wizard should explain that saving this settings panel applies the selected provider"
  );
  assert.ok(
    extensionSource.includes("Auto-find Codex CLI"),
    "settings panel should expose a Codex CLI auto-find action"
  );
  assert.ok(
    extensionSource.includes("Check Codex Status"),
    "settings panel should expose a Codex CLI status action"
  );
  assert.ok(
    extensionSource.includes('type === "findCodexCli"'),
    "settings panel should handle Codex CLI auto-discovery without requiring native settings"
  );
  assert.ok(
    extensionSource.includes('type === "checkCodexCliStatus"'),
    "settings panel should handle Codex CLI auth status checks"
  );
  assert.ok(
    extensionSource.includes('"login", "status"'),
    "Codex CLI auth detection should use the supported `codex login status` command"
  );
  assert.ok(
    extensionSource.includes("readLocalCodexAuthStatus") &&
      extensionSource.includes("decodeJwtPayload"),
    "Codex CLI auth status should fall back to safe local auth metadata when CLI status is stale"
  );
  assert.ok(
    extensionSource.includes("isCodexCliModelBlockedByVersion") &&
      extensionSource.includes("getCodexCliUpgradeRequiredMessage"),
    "Codex CLI execution should be version-aware and explain required CLI updates"
  );
  assert.ok(
    extensionSource.includes("getConfigurationUpdateTarget"),
    "settings saves should update the effective configuration target instead of only global settings"
  );
  assert.ok(
    extensionSource.includes("vscode.ConfigurationTarget.WorkspaceFolder"),
    "settings saves should be able to replace workspace-folder provider/model overrides"
  );
  assert.ok(
    extensionSource.includes("analyticsSummary") &&
      extensionSource.includes("Token usage"),
    "settings panel should show current usage analytics, not only raw limits inputs"
  );
  const localProfile = process.env.USERPROFILE || "";
  if (localProfile) {
    assert.ok(
      !extensionSource.includes(localProfile) &&
        !extensionSource.includes(localProfile.replace(/\\/g, "/")),
      "production extension source must not include the developer's local Codex CLI path"
    );
  }
}

function testDocsMatchCurrentRelease(): void {
  const readme = readFileSync(join(__dirname, "..", "README.md"), "utf8");
  const configuration = readFileSync(join(__dirname, "..", "docs", "configuration.md"), "utf8");

  assert.ok(
    readme.startsWith("# AI Commit & Prompt Helper v2.0.7"),
    "README title should describe the current release"
  );
  assert.ok(
    readme.includes("Current extension release: `v2.0.7`."),
    "README current release line should match the package version"
  );
  assert.ok(
    configuration.includes("Applies to extension release: `v2.0.7`."),
    "configuration docs should describe the current release"
  );
}

function testProviderModelDefaultsStayWithinProvider(): void {
  assert.equal(PROVIDER_MODE_DEFINITIONS.codexCli.defaultModel, "gpt-5.5");
  assert.equal(PROVIDER_MODE_DEFINITIONS.codexExtensionThenCli.defaultModel, "gpt-5.5");
  assert.ok(
    isCodexCliModelBlockedByVersion("gpt-5.5", "0.120.0"),
    "Codex CLI 0.120.0 should not receive gpt-5.5"
  );
  assert.equal(
    getCodexCliModelFallbackForVersion("gpt-5.5", "0.120.0"),
    "gpt-5.4",
    "Codex CLI 0.120.0 should use the verified gpt-5.4 fallback"
  );
  assert.ok(
    !isCodexCliModelBlockedByVersion("gpt-5.5", "0.120.1"),
    "newer Codex CLI builds should be allowed to try gpt-5.5"
  );
  assert.equal(getCodexCliModelFallbackForVersion("gpt-5.5", "0.120.1"), null);
  assert.equal(
    resolveConfiguredModelForProvider("codexCli", "gpt-5.5"),
    "gpt-5.5",
    "Codex CLI model resolution should keep the configured model until version-aware execution"
  );
  assert.equal(
    resolveConfiguredModelForProvider("codexCli", "gpt-5.4"),
    "gpt-5.4",
    "custom Codex CLI model IDs should still be preserved"
  );
  assert.equal(PROVIDER_MODE_DEFINITIONS.openai.defaultModel, "gpt-5.5");
  assert.ok(PROVIDER_MODE_DEFINITIONS.openai.modelOptions.includes("gpt-5.4-mini"));

  assert.equal(PROVIDER_MODE_DEFINITIONS.deepseek.defaultModel, "deepseek-v4-flash");
  assert.deepEqual(PROVIDER_MODE_DEFINITIONS.deepseek.modelOptions, [
    "deepseek-v4-flash",
    "deepseek-v4-pro"
  ]);
  assert.equal(
    resolveConfiguredModelForProvider("deepseek", "gpt-5.4-mini"),
    "deepseek-v4-flash"
  );
  assert.equal(
    resolveConfiguredModelForProvider("deepseek", "deepseek-v4-pro"),
    "deepseek-v4-pro"
  );
  assert.equal(PROVIDER_MODE_DEFINITIONS.anthropic.defaultModel, "claude-opus-4-1-20250805");
  assert.ok(PROVIDER_MODE_DEFINITIONS.anthropic.modelOptions.includes("claude-sonnet-4-20250514"));
  assert.equal(PROVIDER_MODE_DEFINITIONS.cohere.defaultModel, "command-a-plus-05-2026");
  assert.ok(PROVIDER_MODE_DEFINITIONS.cohere.modelOptions.includes("command-a-reasoning-08-2025"));
  assert.equal(PROVIDER_MODE_DEFINITIONS.gemini.defaultModel, "gemini-3.5-flash");
  assert.ok(PROVIDER_MODE_DEFINITIONS.gemini.modelOptions.includes("gemini-3.1-pro-preview"));
  assert.equal(PROVIDER_MODE_DEFINITIONS.mistral.defaultModel, "mistral-medium-latest");
  assert.ok(PROVIDER_MODE_DEFINITIONS.mistral.modelOptions.includes("ministral-14b-latest"));
  assert.equal(
    PROVIDER_MODE_DEFINITIONS.customOpenAiCompatible.defaultModel,
    "",
    "custom OpenAI-compatible providers should not inherit a hard-coded model"
  );
}

function testHuggingFaceProviderMetadata(): void {
  const definition = PROVIDER_MODE_DEFINITIONS.huggingface;

  assert.equal(normalizeGenerationProvider("huggingface"), "huggingface");
  assert.equal(getProviderLabel("huggingface"), "Hugging Face");
  assert.equal(getDefaultModelForProvider("huggingface"), "openai/gpt-oss-120b");
  assert.equal(definition.defaultBaseUrl, "https://router.huggingface.co/v1");
  assert.equal(definition.secretKey, "aiCommitPromptHelper.secret.huggingface");
  assert.ok(definition.modelOptions.includes("Qwen/Qwen3-Coder-480B-A35B-Instruct"));
}

function testOpenRouterLowCostPresets(): void {
  const definition = PROVIDER_MODE_DEFINITIONS.openrouter;

  assert.equal(definition.defaultModel, "openai/gpt-5.5");
  assert.ok(definition.modelOptions.includes("google/gemini-3.5-flash"));
  assert.ok(definition.modelOptions.includes("anthropic/claude-opus-4.8"));
  assert.ok(definition.modelOptions.includes("mistralai/mistral-medium-3-5"));
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
testSidebarActionOnlyOpensSettings();
testDocsMatchCurrentRelease();
testProviderModelDefaultsStayWithinProvider();
testHuggingFaceProviderMetadata();
testOpenRouterLowCostPresets();
testApiKeyResolutionPrefersSecretsBeforeLegacyAndEnvironment();
