import * as vscode from "vscode";
import { execFile } from "node:child_process";
import type { ExecFileOptions } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type ScmInputBoxLike = {
  value: string;
};

type GenerationProvider = "cli" | "extensionThenCli";

export function activate(context: vscode.ExtensionContext) {
  const statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );

  statusBar.text = "$(sparkle) Codex Commit";
  statusBar.tooltip = "Generate a commit message from staged changes using Codex";
  statusBar.command = "codexCommitWidget.generateCommitMessage";
  statusBar.show();

  const disposable = vscode.commands.registerCommand(
    "codexCommitWidget.generateCommitMessage",
    async () => {
      await generateCommitMessage();
    }
  );

  context.subscriptions.push(statusBar, disposable);
}

export function deactivate() {
  // no-op
}

async function generateCommitMessage(): Promise<void> {
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

  const config = vscode.workspace.getConfiguration("codexCommitWidget");
  const provider = config.get<GenerationProvider>("provider", "cli");
  const codexExtensionCommand = config
    .get<string>("codexExtensionCommand", "")
    .trim();
  const codexCommand = config.get<string>("codexCommand", "codex");
  const model = config.get<string>("model", "").trim();
  const maxDiffChars = config.get<number>("maxDiffChars", 120000);
  const promptTemplate = config.get<string>(
    "promptTemplate",
    "You are generating a git commit message from staged changes. Return only the final commit message, no code fences, no explanations. Format output as: 1) one conventional-commit subject line under 72 chars, 2) blank line, 3) Change Summary section with concise bullets, 4) Files Changed section mapping key files to intent, 5) Audit Trail section with risks, behavior changes, and validation notes. Only include facts supported by the diff."
  );

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
          stagedSummary.length > maxDiffChars
            ? stagedSummary.slice(0, maxDiffChars) +
              "\n\n[Diff truncated to fit token budget]"
            : stagedSummary;

        const prompt = [
          promptTemplate,
          "",
          "Repository path:",
          repo.rootUri.fsPath,
          "",
          "Staged diff:",
          trimmedDiff
        ].join("\n");

        const args = ["exec"];
        if (model) {
          args.push("--model", model);
        }
        args.push("-");

        const raw = (
          await generateRawCommitMessage({
            provider,
            codexExtensionCommand,
            codexCommand,
            args,
            prompt,
            cwd: repo.rootUri.fsPath
          })
        ).trim();
        const message = normalizeCommitMessage(raw);

        if (!message) {
          throw new Error("Codex returned an empty commit message.");
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

async function generateRawCommitMessage(options: {
  provider: GenerationProvider;
  codexExtensionCommand: string;
  codexCommand: string;
  args: string[];
  prompt: string;
  cwd: string;
}): Promise<string> {
  const {
    provider,
    codexExtensionCommand,
    codexCommand,
    args,
    prompt,
    cwd
  } = options;

  if (provider === "extensionThenCli") {
    if (codexExtensionCommand) {
      const extensionRaw = await tryGenerateViaExtensionCommand(
        codexExtensionCommand,
        prompt,
        cwd
      );

      if (extensionRaw.trim()) {
        return extensionRaw;
      }
    }
  }

  const { stdout, stderr } = await runCodexCli(codexCommand, args, cwd, prompt);
  return stdout || stderr || "";
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

  // If Codex returned multiple paragraphs with explanation, keep the likely commit block.
  const sections = text
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sections.length > 1) {
    const likely = sections.find((section) => {
      const firstLine = section.split("\n")[0]?.trim() ?? "";
      return firstLine.length > 0 && firstLine.length <= 100;
    });
    if (likely) {
      text = likely;
    }
  }

  // Trim trailing quotes occasionally produced by CLIs/prompts.
  text = text.replace(/^"+|"+$/g, "").trim();

  return text;
}
