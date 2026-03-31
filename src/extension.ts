import * as vscode from "vscode";
import { execFile } from "node:child_process";
import type { ExecFileOptions } from "node:child_process";
import { readFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  showTokenUsageInTooltip: boolean;
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
const DEFAULT_MODEL = "gpt-5.1-codex-mini";
const DEFAULT_PROMPT_TEMPLATE =
  "You are generating a git commit message from staged changes. Return only the final commit message, no code fences, no explanations. Format output as: 1) one conventional-commit subject line under 72 chars, 2) blank line, 3) Change Summary section with concise bullets, 4) Files Changed section mapping key files to intent, 5) Audit Trail section with risks, behavior changes, and validation notes. Only include facts supported by the diff.";
const DEFAULT_STATUS_BAR_TEXT = "$(sparkle) Codex Commit";
const BASE_TOOLTIP = "Generate a commit message from staged changes using Codex";
const TOKEN_USAGE_STATE_KEY = "codexCommitWidget.tokenUsageHistory.v1";
const DAY_MS = 24 * 60 * 60 * 1000;

export function activate(context: vscode.ExtensionContext) {
  const statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );

  statusBar.command = COMMAND_ID;
  applyStatusBarText(statusBar);
  void updateStatusBarTooltip(context, statusBar);
  statusBar.show();

  const commandDisposable = vscode.commands.registerCommand(COMMAND_ID, async () => {
    await generateCommitMessage(context, statusBar);
  });

  const configChangeDisposable = vscode.workspace.onDidChangeConfiguration((event) => {
    if (!event.affectsConfiguration("codexCommitWidget")) {
      return;
    }

    applyStatusBarText(statusBar);
    void updateStatusBarTooltip(context, statusBar);
  });

  context.subscriptions.push(statusBar, commandDisposable, configChangeDisposable);
}

export function deactivate() {
  // no-op
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
          trackTokenUsage: settings.showTokenUsageInTooltip
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

async function updateStatusBarTooltip(
  context: vscode.ExtensionContext,
  statusBar: vscode.StatusBarItem
): Promise<void> {
  const config = vscode.workspace.getConfiguration("codexCommitWidget");
  const showTokenUsage = config.get<boolean>("showTokenUsageInTooltip", true);

  if (!showTokenUsage) {
    statusBar.tooltip = `${BASE_TOOLTIP}\n\nToken usage hover details are disabled in settings.`;
    return;
  }

  const entries = getTokenUsageEntries(context);
  const recent = pruneTokenUsageEntries(entries);

  if (recent.length === 0) {
    statusBar.tooltip = `${BASE_TOOLTIP}\n\nToken usage (last 24h): no tracked generations yet.`;
    return;
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

  const estimatedLine =
    totals.estimated > 0
      ? `\nEstimated runs (fallback parsing): ${totals.estimated}/${recent.length}`
      : "";

  statusBar.tooltip =
    `${BASE_TOOLTIP}\n\n` +
    "Token usage (last 24h)\n" +
    `Total: ${formatNumber(totals.total)}\n` +
    `Input: ${formatNumber(totals.input)}\n` +
    `Output: ${formatNumber(totals.output)}\n` +
    `Generations: ${recent.length}` +
    estimatedLine;

  if (recent.length !== entries.length) {
    await context.globalState.update(TOKEN_USAGE_STATE_KEY, recent);
  }
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
    showTokenUsageInTooltip: config.get<boolean>("showTokenUsageInTooltip", true)
  };
}

function buildPrompt(
  promptTemplate: string,
  additionalPromptInstructions: string,
  repositoryPath: string,
  stagedDiffSummary: string
): string {
  const sections: string[] = [promptTemplate.trim()];

  if (additionalPromptInstructions) {
    sections.push("", "Additional instructions:", additionalPromptInstructions);
  }

  sections.push(
    "",
    "Repository path:",
    repositoryPath,
    "",
    "Staged diff:",
    stagedDiffSummary
  );

  return sections.join("\n");
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
  await context.globalState.update(TOKEN_USAGE_STATE_KEY, pruneTokenUsageEntries(entries));
}

function pruneTokenUsageEntries(
  entries: TokenUsageEntry[],
  nowMs: number = Date.now()
): TokenUsageEntry[] {
  const cutoff = nowMs - DAY_MS;
  return entries.filter((entry) => entry.timestampMs >= cutoff);
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

    await ensureCodexAuthSession(codexCommand, cwd);

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

async function ensureCodexAuthSession(codexCommand: string, cwd: string): Promise<void> {
  const candidates = getCodexCliCandidates(codexCommand);

  for (const candidate of candidates) {
    try {
      const shell = shouldUseShellForCliCandidate(candidate);
      const { stdout, stderr } = await execFileAsync(candidate, ["auth", "status"], {
        cwd,
        maxBuffer: 1024 * 1024,
        env: process.env,
        shell
      });
      const combined = `${stdout ?? ""}\n${stderr ?? ""}`;

      if (isAuthenticationRequiredText(combined)) {
        throw new Error(getAuthRequiredMessage(combined));
      }
      return;
    } catch (error: any) {
      if (error?.code === "ENOENT") {
        continue;
      }

      const details = [
        String(error?.stdout ?? ""),
        String(error?.stderr ?? ""),
        String(error?.message ?? "")
      ]
        .join("\n")
        .trim();

      if (isUnsupportedAuthStatusCommand(details)) {
        return;
      }

      if (isAuthenticationRequiredText(details)) {
        throw new Error(getAuthRequiredMessage(details));
      }

      return;
    }
  }
}

async function runCodexCli(
  codexCommand: string,
  args: string[],
  cwd: string,
  stdinText: string
) {
  const candidates = getCodexCliCandidates(codexCommand);
  let lastEnoentError: unknown;

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
      if (error?.code === "ENOENT") {
        lastEnoentError = error;
        continue;
      }

      const details = error?.stderr || error?.message || "Unknown Codex error.";
      if (isAuthenticationRequiredText(details)) {
        throw new Error(getAuthRequiredMessage(details));
      }

      throw new Error(`Codex CLI failed using \`${candidate}\`.\n\n${details}`);
    }
  }

  const attempted = candidates.map((candidate) => `\`${candidate}\``).join(", ");
  const enoentMessage =
    lastEnoentError && typeof lastEnoentError === "object"
      ? (lastEnoentError as { message?: string }).message || ""
      : "";

  throw new Error(
    "Failed to run Codex CLI (command not found).\n" +
      `Tried: ${attempted}\n\n` +
      "Fix one of these:\n" +
      "1) Install Codex CLI and ensure VS Code can access it in PATH.\n" +
      "2) Set `codexCommitWidget.codexCommand` to the full executable path (for Windows, commonly `%APPDATA%\\\\npm\\\\codex.cmd`).\n" +
      "3) Use extension mode by setting `codexCommitWidget.provider` to `extensionThenCli` and configuring `codexCommitWidget.codexExtensionCommand`.\n\n" +
      enoentMessage
  );
}

function isAuthenticationRequiredText(text: string): boolean {
  const normalized = normalizeWhitespace(text);

  return [
    "not logged in",
    "login required",
    "authentication required",
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

function isUnsupportedAuthStatusCommand(text: string): boolean {
  const normalized = normalizeWhitespace(text);
  if (!normalized.includes("auth")) {
    return false;
  }

  return (
    normalized.includes("unknown") ||
    normalized.includes("unrecognized") ||
    normalized.includes("no such command") ||
    normalized.includes("invalid subcommand")
  );
}

function getAuthRequiredMessage(details: string): string {
  const compactDetails = details.trim();
  const suffix = compactDetails
    ? `\n\nDetails:\n${compactDetails.split(/\r?\n/).slice(0, 4).join("\n")}`
    : "";

  return (
    "You must be logged into a Codex auth session to use commit generation.\n" +
    "Run `codex auth login` in a terminal, then try again." +
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
  const base = configuredCommand.trim() || "codex";
  const candidates: string[] = [base];

  if (process.platform === "win32") {
    candidates.push("codex.cmd");

    const appData = process.env.APPDATA;
    if (appData) {
      candidates.push(`${appData}\\npm\\codex.cmd`);
    }

    const userProfile = process.env.USERPROFILE;
    if (userProfile) {
      candidates.push(`${userProfile}\\AppData\\Roaming\\npm\\codex.cmd`);
      candidates.push(`${userProfile}\\.npm-global\\bin\\codex.cmd`);
      candidates.push(`${userProfile}\\scoop\\shims\\codex.cmd`);
    }
  }

  return Array.from(new Set(candidates.filter(Boolean)));
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
