import * as vscode from "vscode";
import { execFile } from "node:child_process";
import type { ExecFileOptions } from "node:child_process";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type ScmInputBoxLike = {
  value: string;
};

type GenerationProvider = "cli" | "extensionThenCli";
type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh";

type GenerationSettings = {
  provider: GenerationProvider;
  codexExtensionCommand: string;
  codexCommand: string;
  model: string;
  reasoningEffort: ReasoningEffort;
  maxDiffChars: number;
  promptTemplate: string;
  additionalPromptInstructions: string;
  temperatureOverride: number | null;
  topPOverride: number | null;
  maxOutputTokensOverride: number | null;
  trackTokenUsageAnalytics: boolean;
};

type GeneratedCommitResult = {
  raw: string;
  usage: TokenUsageMeasurement | null;
};

type TokenUsageMeasurement = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimated: boolean;
};

type TokenUsageEntry = {
  timestampMs: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimated: boolean;
};

const COMMAND_ID = "codexCommitWidget.generateCommitMessage";
const SETUP_CODEX_COMMAND_ID = "codexCommitWidget.setupCodexCli";
const OPEN_SETTINGS_COMMAND_ID = "codexCommitWidget.openSettings";
const SIDEBAR_VIEW_ID = "codexCommitWidget.sidebar";
const SIDEBAR_ENABLED_CONTEXT_KEY = "codexCommitWidget.sidebarEnabled";
const DEFAULT_MODEL = "gpt-5.1-codex-mini";
const MIN_RECOMMENDED_CODEX_VERSION = "0.120.0";
const DEFAULT_PROMPT_TEMPLATE =
  "You are generating a git commit message from staged changes. Return only the final commit message, no code fences, no explanations. Format output as: 1) one conventional-commit subject line under 72 chars, 2) blank line, 3) Change Summary section with concise bullets, 4) Files Changed section mapping key files to intent, 5) Audit Trail section with risks, behavior changes, and validation notes. Only include facts supported by the diff.";
const DEFAULT_STATUS_BAR_TEXT = "$(sparkle) Codex Commit";
const BASE_TOOLTIP = "Generate a commit message from staged changes using Codex";
const TOKEN_USAGE_STATE_KEY = "codexCommitWidget.tokenUsageHistory.v1";
const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_ANALYTICS_RETENTION_DAYS = 7;
let hasShownOutdatedCodexVersionWarning = false;
let hasCheckedCodexCliVersion = false;

export function activate(context: vscode.ExtensionContext) {
  const statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  const sidebarProvider = new SidebarActionProvider();

  statusBar.command = COMMAND_ID;
  applyStatusBarText(statusBar);
  void updateStatusBarTooltip(context, statusBar);
  void syncTokenUsageAnalyticsSettings(context);
  void autoConfigureCodexCliIfDefault();
  void updateSidebarVisibilityContext();
  statusBar.show();

  const sidebarView = vscode.window.createTreeView(SIDEBAR_VIEW_ID, {
    treeDataProvider: sidebarProvider,
    showCollapseAll: false
  });

  const commandDisposable = vscode.commands.registerCommand(COMMAND_ID, async () => {
    await generateCommitMessage(context, statusBar);
  });
  const setupCommandDisposable = vscode.commands.registerCommand(
    SETUP_CODEX_COMMAND_ID,
    async () => {
      await setupCodexCliCommand();
    }
  );
  const openSettingsCommandDisposable = vscode.commands.registerCommand(
    OPEN_SETTINGS_COMMAND_ID,
    async () => {
      await openCodexWidgetSettings();
    }
  );

  const configChangeDisposable = vscode.workspace.onDidChangeConfiguration((event) => {
    if (!event.affectsConfiguration("codexCommitWidget")) {
      return;
    }

    applyStatusBarText(statusBar);
    void updateStatusBarTooltip(context, statusBar);
    void updateSidebarVisibilityContext();
  });

  context.subscriptions.push(
    statusBar,
    sidebarView,
    commandDisposable,
    setupCommandDisposable,
    openSettingsCommandDisposable,
    configChangeDisposable
  );
}

export function deactivate() {
  // no-op
}

class SidebarActionProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): vscode.ProviderResult<vscode.TreeItem[]> {
    const generateItem = new vscode.TreeItem(
      "Generate Commit Message",
      vscode.TreeItemCollapsibleState.None
    );
    generateItem.command = {
      command: COMMAND_ID,
      title: "Generate Commit Message"
    };
    generateItem.iconPath = new vscode.ThemeIcon("sparkle");
    generateItem.tooltip = BASE_TOOLTIP;

    const setupItem = new vscode.TreeItem("Setup Codex CLI", vscode.TreeItemCollapsibleState.None);
    setupItem.command = {
      command: SETUP_CODEX_COMMAND_ID,
      title: "Setup Codex CLI"
    };
    setupItem.iconPath = new vscode.ThemeIcon("tools");
    setupItem.tooltip = "Detect Codex CLI path and save it to extension settings";

    const settingsItem = new vscode.TreeItem("Open Settings", vscode.TreeItemCollapsibleState.None);
    settingsItem.command = {
      command: OPEN_SETTINGS_COMMAND_ID,
      title: "Open Settings"
    };
    settingsItem.iconPath = new vscode.ThemeIcon("gear");
    settingsItem.tooltip = "Open Codex Commit Widget settings";

    return [generateItem, setupItem, settingsItem];
  }
}

async function setupCodexCliCommand(): Promise<void> {
  const config = vscode.workspace.getConfiguration("codexCommitWidget");
  const configuredCommand = config.get<string>("codexCommand", "codex");

  const discovered = await discoverCodexCliBinary(configuredCommand);
  if (!discovered) {
    const openSettingsAction = "Open Settings";
    const selected = await vscode.window.showErrorMessage(
      "Codex CLI could not be auto-detected. Install Codex globally (`npm install -g @openai/codex@latest`) or set `codexCommitWidget.codexCommand` manually.",
      openSettingsAction
    );
    if (selected === openSettingsAction) {
      await openCodexWidgetSettings();
    }
    return;
  }

  await config.update("codexCommand", discovered.command, vscode.ConfigurationTarget.Global);
  void vscode.window.showInformationMessage(
    `Configured Codex CLI: ${discovered.command}${discovered.version ? ` (${discovered.version})` : ""}`
  );
}

async function openCodexWidgetSettings(): Promise<void> {
  await vscode.commands.executeCommand(
    "workbench.action.openSettings",
    "codexCommitWidget.codexCommand"
  );
}

async function autoConfigureCodexCliIfDefault(): Promise<void> {
  const config = vscode.workspace.getConfiguration("codexCommitWidget");
  const configured = config.get<string>("codexCommand", "codex").trim() || "codex";
  if (!/^codex(?:\.cmd|\.bat|\.exe)?$/i.test(configured)) {
    return;
  }

  const discovered = await discoverCodexCliBinary(configured);
  if (!discovered) {
    return;
  }

  if (areCommandsEquivalent(discovered.command, configured)) {
    return;
  }

  await config.update("codexCommand", discovered.command, vscode.ConfigurationTarget.Global);
}

async function generateCommitMessage(
  context: vscode.ExtensionContext,
  statusBar: vscode.StatusBarItem
): Promise<void> {
  const gitExtension = vscode.extensions.getExtension("vscode.git");
  if (!gitExtension) {
    void vscode.window.showErrorMessage("Built-in Git extension is not available.");
    return;
  }

  const gitApi = gitExtension.isActive
    ? gitExtension.exports.getAPI(1)
    : (await gitExtension.activate()).getAPI(1);

  const repositories = gitApi.repositories as Array<{
    rootUri: vscode.Uri;
    inputBox: ScmInputBoxLike;
  }>;

  if (!repositories || repositories.length === 0) {
    void vscode.window.showWarningMessage("No Git repository is open in this workspace.");
    return;
  }

  const repo =
    repositories.length === 1
      ? repositories[0]
      : await pickRepository(repositories);

  if (!repo) {
    return;
  }

  const settings = readGenerationSettings();

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Generating commit message with Codex",
        cancellable: false
      },
      async () => {
        const stagedSummary = await getStagedContext(repo.rootUri.fsPath);

        if (!stagedSummary.trim()) {
          throw new Error("No staged changes found. Stage your files first.");
        }

        const trimmedDiff =
          stagedSummary.length > settings.maxDiffChars
            ? stagedSummary.slice(0, settings.maxDiffChars) +
              "\n\n[Diff truncated to fit token budget]"
            : stagedSummary;

        const prompt = buildPrompt(
          settings.promptTemplate,
          settings.additionalPromptInstructions,
          repo.rootUri.fsPath,
          trimmedDiff
        );

        const outputLastMessageFile = getOutputLastMessageTempPath();
        const args = buildCodexExecArgs(settings, outputLastMessageFile);

        const generated = await generateRawCommitMessage({
          provider: settings.provider,
          codexExtensionCommand: settings.codexExtensionCommand,
          codexCommand: settings.codexCommand,
          args,
          prompt,
          cwd: repo.rootUri.fsPath,
          outputLastMessageFile,
          trackTokenUsage: settings.trackTokenUsageAnalytics
        });

        const message = normalizeCommitMessage(generated.raw);

        if (!message) {
          throw new Error("Codex returned an empty commit message.");
        }

        if (generated.usage) {
          await appendTokenUsageEntry(context, {
            timestampMs: Date.now(),
            inputTokens: generated.usage.inputTokens,
            outputTokens: generated.usage.outputTokens,
            totalTokens: generated.usage.totalTokens,
            estimated: generated.usage.estimated
          });
          await syncTokenUsageAnalyticsSettings(context);
          await updateStatusBarTooltip(context, statusBar);
        }

        repo.inputBox.value = message;
        void vscode.window.showInformationMessage("Commit message generated with Codex.");
      }
    );
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown error while generating commit message.";
    void vscode.window.showErrorMessage(message);
  }
}

function applyStatusBarText(statusBar: vscode.StatusBarItem): void {
  const config = vscode.workspace.getConfiguration("codexCommitWidget");
  const configured = config.get<string>("statusBarText", DEFAULT_STATUS_BAR_TEXT).trim();
  statusBar.text = configured || DEFAULT_STATUS_BAR_TEXT;
}

function isSidebarActionEnabled(): boolean {
  const config = vscode.workspace.getConfiguration("codexCommitWidget");
  return config.get<boolean>("enableSidebarAction", true);
}

async function updateSidebarVisibilityContext(): Promise<void> {
  await vscode.commands.executeCommand(
    "setContext",
    SIDEBAR_ENABLED_CONTEXT_KEY,
    isSidebarActionEnabled()
  );
}

async function updateStatusBarTooltip(
  _context: vscode.ExtensionContext,
  statusBar: vscode.StatusBarItem
): Promise<void> {
  statusBar.tooltip =
    `${BASE_TOOLTIP}\n\n` +
    "Token analytics are tracked in settings under:\n" +
    "Codex Commit Widget > Analytics";
}

function readGenerationSettings(): GenerationSettings {
  const config = vscode.workspace.getConfiguration("codexCommitWidget");

  return {
    provider: config.get<GenerationProvider>("provider", "cli"),
    codexExtensionCommand: config.get<string>("codexExtensionCommand", "").trim(),
    codexCommand: config.get<string>("codexCommand", "codex"),
    model: config.get<string>("model", DEFAULT_MODEL).trim(),
    reasoningEffort: normalizeReasoningEffort(config.get<string>("reasoningEffort", "low")),
    maxDiffChars: normalizePositiveInteger(config.get<number>("maxDiffChars", 120000), 120000),
    promptTemplate: config.get<string>("promptTemplate", DEFAULT_PROMPT_TEMPLATE),
    additionalPromptInstructions: config
      .get<string>("additionalPromptInstructions", "")
      .trim(),
    temperatureOverride: normalizeNumberInRange(
      config.get<number | null>("temperatureOverride", null),
      0,
      2
    ),
    topPOverride: normalizeNumberInRange(
      config.get<number | null>("topPOverride", null),
      0,
      1
    ),
    maxOutputTokensOverride: normalizePositiveIntegerOrNull(
      config.get<number | null>("maxOutputTokensOverride", null)
    ),
    trackTokenUsageAnalytics: config.get<boolean>("trackTokenUsageAnalytics", true)
  };
}

function buildPrompt(
  promptTemplate: string,
  additionalPromptInstructions: string,
  repositoryPath: string,
  stagedDiffSummary: string
): string {
  const sections: string[] = [promptTemplate.trim()];
  const repositoryName = normalizeRepositoryName(repositoryPath);

  if (additionalPromptInstructions) {
    sections.push("", "Additional instructions:", additionalPromptInstructions);
  }

  sections.push(
    "",
    "Repository:",
    repositoryName,
    "",
    "Staged diff:",
    stagedDiffSummary
  );

  return sections.join("\n");
}

function normalizeRepositoryName(repositoryPath: string): string {
  const trimmed = repositoryPath.trim();
  if (!trimmed) {
    return "(unknown)";
  }

  const withoutTrailingSeparators = trimmed.replace(/[\\/]+$/g, "");
  const name = basename(withoutTrailingSeparators);
  return name || "(unknown)";
}

function buildCodexExecArgs(settings: GenerationSettings, outputLastMessageFile: string): string[] {
  const args = ["exec", "--output-last-message", outputLastMessageFile];

  if (settings.model) {
    args.push("--model", settings.model);
  }

  args.push("-c", `model_reasoning_effort=${settings.reasoningEffort}`);

  if (settings.temperatureOverride !== null) {
    args.push("-c", `model_temperature=${settings.temperatureOverride}`);
  }
  if (settings.topPOverride !== null) {
    args.push("-c", `model_top_p=${settings.topPOverride}`);
  }
  if (settings.maxOutputTokensOverride !== null) {
    args.push("-c", `model_max_output_tokens=${settings.maxOutputTokensOverride}`);
  }

  args.push("-");
  return args;
}

function getTokenUsageEntries(context: vscode.ExtensionContext): TokenUsageEntry[] {
  const raw = context.globalState.get<unknown>(TOKEN_USAGE_STATE_KEY, []);
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw
    .map((item): TokenUsageEntry | null => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const timestampMs = asFiniteNumber(record.timestampMs);
      const inputTokens = asFiniteNumber(record.inputTokens);
      const outputTokens = asFiniteNumber(record.outputTokens);
      const totalTokens = asFiniteNumber(record.totalTokens);
      const estimated = typeof record.estimated === "boolean" ? record.estimated : false;

      if (
        timestampMs === null ||
        inputTokens === null ||
        outputTokens === null ||
        totalTokens === null
      ) {
        return null;
      }

      return {
        timestampMs,
        inputTokens,
        outputTokens,
        totalTokens,
        estimated
      };
    })
    .filter((entry): entry is TokenUsageEntry => entry !== null);
}

async function appendTokenUsageEntry(
  context: vscode.ExtensionContext,
  entry: TokenUsageEntry
): Promise<void> {
  const entries = getTokenUsageEntries(context);
  entries.push(entry);
  await context.globalState.update(
    TOKEN_USAGE_STATE_KEY,
    pruneTokenUsageEntries(entries, getAnalyticsRetentionDays())
  );
}

function pruneTokenUsageEntries(
  entries: TokenUsageEntry[],
  retentionDays: number,
  nowMs: number = Date.now()
): TokenUsageEntry[] {
  const cutoff = nowMs - retentionDays * DAY_MS;
  return entries.filter((entry) => entry.timestampMs >= cutoff);
}

function getAnalyticsRetentionDays(): number {
  const config = vscode.workspace.getConfiguration("codexCommitWidget");
  return normalizeIntegerInRange(
    config.get<number>("analyticsRetentionDays", DEFAULT_ANALYTICS_RETENTION_DAYS),
    1,
    30,
    DEFAULT_ANALYTICS_RETENTION_DAYS
  );
}

async function syncTokenUsageAnalyticsSettings(
  context: vscode.ExtensionContext
): Promise<void> {
  const config = vscode.workspace.getConfiguration("codexCommitWidget");
  const retentionDays = getAnalyticsRetentionDays();
  const entries = getTokenUsageEntries(context);
  const recent = pruneTokenUsageEntries(entries, retentionDays);

  if (recent.length !== entries.length) {
    await context.globalState.update(TOKEN_USAGE_STATE_KEY, recent);
  }

  const totals = recent.reduce(
    (acc, entry) => {
      acc.input += entry.inputTokens;
      acc.output += entry.outputTokens;
      acc.total += entry.totalTokens;
      if (entry.estimated) {
        acc.estimated += 1;
      }
      return acc;
    },
    { input: 0, output: 0, total: 0, estimated: 0 }
  );

  const summary =
    recent.length === 0
      ? `No tracked generations in the last ${retentionDays} day(s).`
      : `Last ${retentionDays} day(s): ${formatNumber(totals.total)} total tokens (${formatNumber(
          totals.input
        )} input, ${formatNumber(totals.output)} output) across ${recent.length} generation(s)${
          totals.estimated > 0
            ? `; estimated runs: ${totals.estimated}/${recent.length}`
            : ""
        }.`;

  await updateAnalyticsSettingIfChanged(config, "analyticsSummary", summary);
  await updateAnalyticsSettingIfChanged(config, "analyticsTotalTokens", totals.total);
  await updateAnalyticsSettingIfChanged(config, "analyticsInputTokens", totals.input);
  await updateAnalyticsSettingIfChanged(config, "analyticsOutputTokens", totals.output);
  await updateAnalyticsSettingIfChanged(config, "analyticsGenerations", recent.length);
  await updateAnalyticsSettingIfChanged(config, "analyticsEstimatedRuns", totals.estimated);
  await updateAnalyticsSettingIfChanged(
    config,
    "analyticsLastUpdated",
    new Date().toISOString()
  );
}

async function updateAnalyticsSettingIfChanged(
  config: vscode.WorkspaceConfiguration,
  key: string,
  value: string | number
): Promise<void> {
  const current = config.get<string | number>(key);
  if (current === value) {
    return;
  }
  await config.update(key, value, vscode.ConfigurationTarget.Global);
}

async function generateRawCommitMessage(options: {
  provider: GenerationProvider;
  codexExtensionCommand: string;
  codexCommand: string;
  args: string[];
  prompt: string;
  cwd: string;
  outputLastMessageFile: string;
  trackTokenUsage: boolean;
}): Promise<GeneratedCommitResult> {
  const {
    provider,
    codexExtensionCommand,
    codexCommand,
    args,
    prompt,
    cwd,
    outputLastMessageFile,
    trackTokenUsage
  } = options;

  try {
    if (provider === "extensionThenCli" && codexExtensionCommand) {
      const extensionRaw = await tryGenerateViaExtensionCommand(
        codexExtensionCommand,
        prompt,
        cwd
      );

      if (extensionRaw.trim() && !isLikelyPromptEcho(extensionRaw, prompt)) {
        return {
          raw: extensionRaw.trim(),
          usage: trackTokenUsage ? estimateTokenUsage(prompt, extensionRaw) : null
        };
      }
    }

    await warnIfCodexCliOutdated(codexCommand, cwd);

    const { stdout, stderr } = await runCodexCli(codexCommand, args, cwd, prompt);
    const outputLastMessage = await readOutputLastMessage(outputLastMessageFile);
    const raw = (outputLastMessage || stdout || stderr || "").trim();

    return {
      raw,
      usage: trackTokenUsage ? parseOrEstimateTokenUsage(stdout, stderr, prompt, raw) : null
    };
  } finally {
    try {
      await unlink(outputLastMessageFile);
    } catch {
      // no-op
    }
  }
}

async function tryGenerateViaExtensionCommand(
  commandId: string,
  prompt: string,
  cwd: string
): Promise<string> {
  try {
    const result = await vscode.commands.executeCommand(commandId, {
      prompt,
      cwd,
      source: "codex-commit-widget"
    });
    return extractTextFromUnknownResult(result);
  } catch {
    try {
      const fallbackResult = await vscode.commands.executeCommand(commandId, prompt);
      return extractTextFromUnknownResult(fallbackResult);
    } catch {
      return "";
    }
  }
}

async function warnIfCodexCliOutdated(codexCommand: string, cwd: string): Promise<void> {
  if (hasShownOutdatedCodexVersionWarning || hasCheckedCodexCliVersion) {
    return;
  }
  hasCheckedCodexCliVersion = true;

  const parsedVersion = await getCodexCliVersion(codexCommand, cwd);
  if (!parsedVersion) {
    return;
  }

  const minVersion = parseSemver(MIN_RECOMMENDED_CODEX_VERSION);
  if (!minVersion) {
    return;
  }

  if (compareSemver(parsedVersion, minVersion) >= 0) {
    return;
  }

  hasShownOutdatedCodexVersionWarning = true;
  const current = `${parsedVersion[0]}.${parsedVersion[1]}.${parsedVersion[2]}`;
  void vscode.window.showWarningMessage(
    `Codex CLI ${current} detected. This extension is tuned for Codex CLI ${MIN_RECOMMENDED_CODEX_VERSION}+; upgrade to the latest version for best compatibility.`
  );
}

async function getCodexCliVersion(
  codexCommand: string,
  cwd: string
): Promise<[number, number, number] | null> {
  const candidates = getCodexCliCandidates(codexCommand);

  for (const candidate of candidates) {
    try {
      const shell = shouldUseShellForCliCandidate(candidate);
      const { stdout, stderr } = await execFileAsync(candidate, ["--version"], {
        cwd,
        maxBuffer: 1024 * 1024,
        env: process.env,
        shell
      });
      const parsed = parseSemver(`${stdout ?? ""}\n${stderr ?? ""}`);
      if (parsed) {
        return parsed;
      }
    } catch (error: any) {
      if (error?.code === "ENOENT") {
        continue;
      }
      const details = `${String(error?.stdout ?? "")}\n${String(error?.stderr ?? "")}\n${String(
        error?.message ?? ""
      )}`;
      const parsed = parseSemver(details);
      if (parsed) {
        return parsed;
      }
    }
  }

  return null;
}

function parseSemver(text: string): [number, number, number] | null {
  const match = text.match(/(?:codex(?:-cli)?\s+)?(\d+)\.(\d+)\.(\d+)/i);
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

async function runCodexCli(
  codexCommand: string,
  args: string[],
  cwd: string,
  stdinText: string
) {
  const candidates = getCodexCliCandidates(codexCommand);
  let lastEnoentError: unknown;
  const authFailures: Array<{ candidate: string; details: string }> = [];

  for (const candidate of candidates) {
    try {
      const shell = shouldUseShellForCliCandidate(candidate);
      return await execFileWithStdin(candidate, args, stdinText, {
        cwd,
        maxBuffer: 10 * 1024 * 1024,
        env: process.env,
        shell
      });
    } catch (error: any) {
      const stdout = String(error?.stdout ?? "");
      const stderr = String(error?.stderr ?? "");
      const message = String(error?.message ?? "");
      const combined = [stdout, stderr, message].filter(Boolean).join("\n").trim();
      const details = combined || "Unknown Codex error.";

      if (isMissingCommandOrPathError(error, details)) {
        lastEnoentError = error;
        continue;
      }

      if (isAuthenticationRequiredText(details)) {
        authFailures.push({ candidate, details });
        continue;
      }

      if (isNoLastAgentMessageText(details)) {
        // Some Codex CLI builds can exit non-zero for --output-last-message while still
        // returning the useful response in stdout.
        if (stdout.trim()) {
          return { stdout, stderr };
        }
        throw new Error(getNoLastAgentMessageError(details));
      }

      throw new Error(`Codex CLI failed using \`${candidate}\`.\n\n${details}`);
    }
  }

  const attempted = candidates.map((candidate) => `\`${candidate}\``).join(", ");
  const enoentMessage =
    lastEnoentError && typeof lastEnoentError === "object"
      ? (lastEnoentError as { message?: string }).message || ""
      : "";
  if (authFailures.length > 0) {
    throw new Error(getAuthRequiredMessage(authFailures));
  }

  throw new Error(
    "Failed to run Codex CLI (command not found).\n" +
      `Tried: ${attempted}\n\n` +
      "Fix one of these:\n" +
      "1) Install Codex CLI and ensure VS Code can access it in PATH.\n" +
      "2) Set `codexCommitWidget.codexCommand` to the full executable path (for Windows, commonly `%APPDATA%\\\\npm\\\\codex.cmd`).\n" +
      "3) Run `Codex: Setup Codex CLI` from the Command Palette (or sidebar).\n" +
      "4) Use extension mode by setting `codexCommitWidget.provider` to `extensionThenCli` and configuring `codexCommitWidget.codexExtensionCommand`.\n\n" +
      enoentMessage
  );
}

function isMissingCommandOrPathError(error: unknown, details: string): boolean {
  if (typeof error === "object" && error && (error as { code?: string }).code === "ENOENT") {
    return true;
  }

  const normalized = normalizeWhitespace(details);
  return (
    normalized.includes("the system cannot find the path specified") ||
    normalized.includes("cannot find the file") ||
    normalized.includes("is not recognized as an internal or external command") ||
    normalized.includes("no such file or directory")
  );
}

function isAuthenticationRequiredText(text: string): boolean {
  const normalized = normalizeWhitespace(text);

  return [
    "must be logged in",
    "not logged in",
    "not authenticated",
    "unauthenticated",
    "login required",
    "authentication required",
    "run codex login",
    "run `codex login`",
    "please login",
    "please log in",
    "run codex auth login",
    "run `codex auth login`",
    "unauthorized",
    "401",
    "forbidden",
    "invalid api key",
    "missing api key",
    "no auth session"
  ].some((token) => normalized.includes(token));
}

function isNoLastAgentMessageText(text: string): boolean {
  const normalized = normalizeWhitespace(text);
  return (
    normalized.includes("no last agent message") ||
    (normalized.includes("output-last-message") &&
      normalized.includes("empty content"))
  );
}

function getAuthRequiredMessage(
  failures: Array<{ candidate: string; details: string }> | string
): string {
  const normalizedFailures =
    typeof failures === "string"
      ? [{ candidate: "(unknown)", details: failures }]
      : failures;
  const firstFailure = normalizedFailures[0]?.details.trim() ?? "";
  const detailLines = firstFailure ? firstFailure.split(/\r?\n/).slice(0, 4) : [];
  const candidates = normalizedFailures.map((failure) => `\`${failure.candidate}\``).join(", ");
  const triedSuffix = candidates ? `\n\nTried CLI candidates: ${candidates}` : "";
  const detailsSuffix = detailLines.length > 0 ? `\n\nDetails:\n${detailLines.join("\n")}` : "";

  return (
    "You must be logged into a Codex auth session to use commit generation.\n" +
    "Run `codex login` in a terminal, then try again. If you have multiple Codex installs, set `codexCommitWidget.codexCommand` to the exact binary you logged into." +
    triedSuffix +
    detailsSuffix
  );
}

function getNoLastAgentMessageError(details: string): string {
  const compactDetails = details.trim();
  const suffix = compactDetails
    ? `\n\nDetails:\n${compactDetails.split(/\r?\n/).slice(0, 6).join("\n")}`
    : "";

  return (
    "Codex CLI completed without a final assistant message, so no commit message could be extracted.\n" +
    "If you're not logged in, run `codex login` (or `codex auth login` on older CLIs) and try again. If you're already logged in, retry once and ensure your Codex CLI is up to date." +
    suffix
  );
}

async function execFileWithStdin(
  file: string,
  args: string[],
  stdinText: string,
  options: ExecFileOptions
): Promise<{ stdout: string; stderr: string }> {
  return await new Promise((resolve, reject) => {
    const child = execFile(file, args, options, (error, stdout, stderr) => {
      if (error) {
        const enhancedError = error as Error & { stdout?: string; stderr?: string };
        enhancedError.stdout = String(stdout ?? "");
        enhancedError.stderr = String(stderr ?? "");
        reject(enhancedError);
        return;
      }

      resolve({
        stdout: String(stdout ?? ""),
        stderr: String(stderr ?? "")
      });
    });

    if (child.stdin) {
      child.stdin.end(stdinText);
    }
  });
}

function shouldUseShellForCliCandidate(candidate: string): boolean {
  return process.platform === "win32" && /\.(cmd|bat)$/i.test(candidate);
}

function getCodexCliCandidates(configuredCommand: string): string[] {
  const trimmed = configuredCommand.trim();
  const base = trimmed || "codex";
  const isDefaultCodexCommand = !trimmed || /^codex(?:\.cmd|\.bat|\.exe)?$/i.test(trimmed);
  const candidates: string[] = [];
  const pushCandidate = (value: string | undefined) => {
    const candidate = value?.trim();
    if (candidate) {
      candidates.push(candidate);
    }
  };

  if (process.platform === "win32") {
    if (!isDefaultCodexCommand) {
      pushCandidate(base);
    }

    const appData = process.env.APPDATA;
    if (appData) {
      pushCandidate(`${appData}\\npm\\codex.cmd`);
    }

    const npmPrefixes = getNpmGlobalPrefixesFromEnv();
    for (const prefix of npmPrefixes) {
      pushCandidate(`${prefix}\\codex.cmd`);
    }

    // PATH-based shims are still useful as a fallback.
    pushCandidate("codex.cmd");

    const userProfile = process.env.USERPROFILE;
    if (userProfile) {
      pushCandidate(`${userProfile}\\AppData\\Roaming\\npm\\codex.cmd`);
      pushCandidate(`${userProfile}\\scoop\\shims\\codex.cmd`);
      pushCandidate(`${userProfile}\\.npm-global\\bin\\codex.cmd`);
    }

    // Bare command fallback for environments where PATH is already correct.
    pushCandidate("codex");
  } else {
    if (!isDefaultCodexCommand) {
      pushCandidate(base);
    }

    for (const prefix of getNpmGlobalPrefixesFromEnv()) {
      pushCandidate(join(prefix, "bin", "codex"));
      pushCandidate(join(prefix, "codex"));
    }

    pushCandidate("/usr/local/bin/codex");
    pushCandidate("/opt/homebrew/bin/codex");
    if (process.env.HOME) {
      pushCandidate(join(process.env.HOME, ".npm-global", "bin", "codex"));
    }
    pushCandidate("codex");
  }

  // Keep explicit custom command in front for user overrides.
  if (isDefaultCodexCommand) {
    pushCandidate(base);
  }

  return Array.from(new Set(candidates));
}

function getNpmGlobalPrefixesFromEnv(): string[] {
  const prefixes = [process.env.npm_config_prefix, process.env.NPM_CONFIG_PREFIX]
    .map((value) => value?.trim() || "")
    .filter(Boolean);
  return Array.from(new Set(prefixes));
}

async function discoverCodexCliBinary(
  configuredCommand: string
): Promise<{ command: string; version: string } | null> {
  const configured = configuredCommand.trim();
  const candidateSet = new Set<string>();
  const add = (value: string | undefined) => {
    const candidate = value?.trim();
    if (candidate) {
      candidateSet.add(candidate);
    }
  };

  add(configured || "codex");
  for (const candidate of getCodexCliCandidates(configuredCommand)) {
    add(candidate);
  }
  for (const candidate of await getCodexCommandsFromSystemPath()) {
    add(candidate);
  }

  for (const candidate of candidateSet) {
    const probed = await probeCodexCandidate(candidate);
    if (probed) {
      return probed;
    }
  }

  return null;
}

async function getCodexCommandsFromSystemPath(): Promise<string[]> {
  try {
    if (process.platform === "win32") {
      const { stdout } = await execFileAsync("where", ["codex"], {
        maxBuffer: 1024 * 1024,
        env: process.env,
        shell: false
      });
      return String(stdout ?? "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    }

    const { stdout } = await execFileAsync("which", ["-a", "codex"], {
      maxBuffer: 1024 * 1024,
      env: process.env,
      shell: false
    });
    return String(stdout ?? "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function probeCodexCandidate(
  candidate: string
): Promise<{ command: string; version: string } | null> {
  try {
    const shell = shouldUseShellForCliCandidate(candidate);
    const { stdout, stderr } = await execFileAsync(candidate, ["--version"], {
      maxBuffer: 1024 * 1024,
      env: process.env,
      shell
    });
    const output = `${String(stdout ?? "").trim()}\n${String(stderr ?? "").trim()}`.trim();
    if (!output) {
      return null;
    }
    const firstLine = output.split(/\r?\n/)[0]?.trim() || output;
    return {
      command: candidate,
      version: firstLine
    };
  } catch {
    return null;
  }
}

function areCommandsEquivalent(left: string, right: string): boolean {
  if (process.platform === "win32") {
    return left.trim().toLowerCase() === right.trim().toLowerCase();
  }
  return left.trim() === right.trim();
}

function extractTextFromUnknownResult(result: unknown): string {
  if (typeof result === "string") {
    return result;
  }

  if (Array.isArray(result)) {
    return result
      .map((item) => extractTextFromUnknownResult(item))
      .filter(Boolean)
      .join("\n");
  }

  if (result && typeof result === "object") {
    const record = result as Record<string, unknown>;
    const direct = [
      record.message,
      record.text,
      record.content,
      record.output,
      record.response
    ];

    for (const value of direct) {
      const text = extractTextFromUnknownResult(value);
      if (text) {
        return text;
      }
    }
  }

  return "";
}

function parseOrEstimateTokenUsage(
  stdout: string,
  stderr: string,
  prompt: string,
  rawResponse: string
): TokenUsageMeasurement {
  const parsed = parseTokenUsageFromText(`${stdout}\n${stderr}`);
  if (parsed) {
    return parsed;
  }

  return estimateTokenUsage(prompt, rawResponse);
}

function parseTokenUsageFromText(text: string): TokenUsageMeasurement | null {
  const input =
    extractTokenCount(text, [
      /"input_tokens"\s*:\s*(\d+)/i,
      /\binput[_\s-]*tokens?\b[^0-9]{0,20}(\d[\d,]*)/i,
      /\bprompt[_\s-]*tokens?\b[^0-9]{0,20}(\d[\d,]*)/i
    ]) ?? 0;

  const output =
    extractTokenCount(text, [
      /"output_tokens"\s*:\s*(\d+)/i,
      /\boutput[_\s-]*tokens?\b[^0-9]{0,20}(\d[\d,]*)/i,
      /\bcompletion[_\s-]*tokens?\b[^0-9]{0,20}(\d[\d,]*)/i
    ]) ?? 0;

  const parsedTotal =
    extractTokenCount(text, [
      /"total_tokens"\s*:\s*(\d+)/i,
      /\btotal[_\s-]*tokens?\b[^0-9]{0,20}(\d[\d,]*)/i,
      /\btokens? used\b[^0-9]{0,20}(\d[\d,]*)/i
    ]) ?? null;

  const total = parsedTotal ?? input + output;
  if (total <= 0) {
    return null;
  }

  const safeOutput = output > 0 ? output : Math.max(total - input, 0);
  return {
    inputTokens: input,
    outputTokens: safeOutput,
    totalTokens: total,
    estimated: false
  };
}

function estimateTokenUsage(prompt: string, output: string): TokenUsageMeasurement {
  const inputTokens = roughTokenEstimate(prompt);
  const outputTokens = roughTokenEstimate(output);

  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    estimated: true
  };
}

function roughTokenEstimate(text: string): number {
  const normalized = text.trim();
  if (!normalized) {
    return 0;
  }

  // Conservative token estimate for plain text/code payloads.
  return Math.ceil(normalized.length / 4);
}

function extractTokenCount(text: string, patterns: RegExp[]): number | null {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match || !match[1]) {
      continue;
    }

    const parsed = Number.parseInt(match[1].replace(/,/g, ""), 10);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  return null;
}

function getOutputLastMessageTempPath(): string {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return join(tmpdir(), `codex-commit-widget-${suffix}.txt`);
}

async function readOutputLastMessage(path: string): Promise<string> {
  try {
    return (await readFile(path, "utf8")).trim();
  } catch {
    return "";
  }
}

function normalizeReasoningEffort(value: string): ReasoningEffort {
  const normalized = value.trim().toLowerCase();
  const allowed: ReadonlySet<string> = new Set([
    "none",
    "minimal",
    "low",
    "medium",
    "high",
    "xhigh"
  ]);

  if (allowed.has(normalized)) {
    return normalized as ReasoningEffort;
  }

  return "low";
}

function normalizeNumberInRange(
  value: number | null | undefined,
  min: number,
  max: number
): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }
  if (!Number.isFinite(value)) {
    return null;
  }
  if (value < min || value > max) {
    return null;
  }
  return value;
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.floor(value);
}

function normalizePositiveIntegerOrNull(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return Math.floor(value);
}

function normalizeIntegerInRange(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  const rounded = Math.floor(value);
  if (rounded < min || rounded > max) {
    return fallback;
  }
  return rounded;
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value;
}

function isLikelyPromptEcho(result: string, prompt: string): boolean {
  const resultNorm = normalizeWhitespace(result);
  const promptNorm = normalizeWhitespace(prompt);

  if (!resultNorm || !promptNorm) {
    return false;
  }

  if (resultNorm === promptNorm) {
    return true;
  }

  if (
    resultNorm.includes("you are generating a git commit message from staged changes") &&
    resultNorm.includes("staged diff:")
  ) {
    return true;
  }

  if (resultNorm.length > 120 && promptNorm.includes(resultNorm)) {
    return true;
  }

  return false;
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

async function pickRepository(
  repositories: Array<{ rootUri: vscode.Uri; inputBox: ScmInputBoxLike }>
) {
  if (repositories.length === 1) {
    return repositories[0];
  }

  const selected = await vscode.window.showQuickPick(
    repositories.map((repo) => ({
      label: vscode.workspace.asRelativePath(repo.rootUri, false),
      description: repo.rootUri.fsPath,
      repo
    })),
    {
      placeHolder: "Select the repository to generate the commit message for"
    }
  );

  return selected?.repo;
}

async function getStagedContext(cwd: string): Promise<string> {
  const status = await execGit(
    ["status", "--short", "--branch", "--no-renames"],
    cwd
  );

  const nameStatus = await execGit(
    ["diff", "--cached", "--name-status", "--no-ext-diff"],
    cwd
  );

  const stat = await execGit(
    ["diff", "--cached", "--stat", "--no-ext-diff"],
    cwd
  );

  const diff = await execGit(
    ["diff", "--cached", "--no-ext-diff", "--minimal"],
    cwd
  );

  return [
    "Repository status:",
    status.stdout.trim() || "(none)",
    "",
    "Changed files:",
    nameStatus.stdout.trim() || "(none)",
    "",
    "Diff stats:",
    stat.stdout.trim() || "(none)",
    "",
    "Patch:",
    diff.stdout.trim() || "(none)"
  ].join("\n");
}

async function execGit(args: string[], cwd: string) {
  return execFileAsync("git", args, {
    cwd,
    maxBuffer: 10 * 1024 * 1024,
    env: process.env
  });
}

function normalizeCommitMessage(raw: string): string {
  let text = raw.trim();

  text = text.replace(/^```[\w-]*\n?/gm, "");
  text = text.replace(/\n?```$/gm, "");
  text = text.trim();

  // Remove common assistant framing if present.
  text = text.replace(/^Here(?:'s| is) (?:a )?commit message:\s*/i, "");
  text = text.replace(/^Commit message:\s*/i, "");
  text = text.trim();

  // Keep the full structured commit message while trimming any leading chatter.
  const lines = text.split(/\r?\n/);
  const conventionalSubjectIndex = lines.findIndex((line) =>
    /^[a-z]+(?:\([^)]+\))?!?:\s+\S.+$/i.test(line.trim())
  );
  if (conventionalSubjectIndex > 0) {
    text = lines.slice(conventionalSubjectIndex).join("\n").trim();
  }

  // Trim trailing quotes occasionally produced by CLIs/prompts.
  text = text.replace(/^"+|"+$/g, "").trim();

  return text;
}
