import * as vscode from "vscode";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type ScmInputBoxLike = {
  value: string;
};

type SourceControlLike = {
  inputBox?: ScmInputBoxLike;
  rootUri?: vscode.Uri;
};

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
  const codexCommand = config.get<string>("codexCommand", "codex");
  const model = config.get<string>("model", "").trim();
  const maxDiffChars = config.get<number>("maxDiffChars", 120000);
  const promptTemplate = config.get<string>(
    "promptTemplate",
    "You are generating a git commit message. Return only the final commit message, no code fences, no explanations. Use conventional commits when appropriate. Prefer a single-line subject under 72 characters unless the change clearly needs a body. Summarize the staged changes accurately."
  );

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Generating commit message with Codex",
        cancellable: false
      },
      async () => {
        const stagedSummary = await getStagedDiff(repo.rootUri.fsPath);

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
        args.push(prompt);

        let stdout: string;
        let stderr: string;

        try {
          ({ stdout, stderr } = await execFileAsync(codexCommand, args, {
            cwd: repo.rootUri.fsPath,
            maxBuffer: 10 * 1024 * 1024,
            env: process.env
          }));
        } catch (error: any) {
          const details = error?.stderr || error?.message || "Unknown Codex error.";
          throw new Error(
            `Failed to run Codex CLI. Make sure \`${codexCommand}\` is installed and working.\n\n${details}`
          );
        }

        const raw = (stdout || stderr || "").trim();
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

async function getStagedDiff(cwd: string): Promise<string> {
  const nameStatus = await execGit(
    ["diff", "--cached", "--name-status", "--no-ext-diff"],
    cwd
  );

  const diff = await execGit(
    ["diff", "--cached", "--no-ext-diff", "--minimal"],
    cwd
  );

  return [
    "Changed files:",
    nameStatus.stdout.trim() || "(none)",
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
