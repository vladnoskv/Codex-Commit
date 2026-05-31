export type ReleaseCommit = {
  fullHash: string;
  shortHash: string;
  date: string;
  author: string;
  subject: string;
  body: string;
};

export type SemverBump = "major" | "minor" | "patch" | "none";

export type SemverSuggestion = {
  bump: SemverBump;
  reason: string;
};

export type ReleaseAssistantPromptInput = {
  targetVersion: string;
  rangeLabel: string;
  semverSuggestion: SemverSuggestion;
  historyContext: string;
  packageName: string;
};

const RECORD_SEPARATOR = "\x1e";
const FIELD_SEPARATOR = "\x1f";

export const RELEASE_GIT_LOG_FORMAT = [
  "%H",
  "%h",
  "%ad",
  "%an",
  "%s",
  "%b"
].join(FIELD_SEPARATOR) + RECORD_SEPARATOR;

export function parseReleaseCommitsFromGitLog(rawLog: string): ReleaseCommit[] {
  return rawLog
    .split(RECORD_SEPARATOR)
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [fullHash = "", shortHash = "", date = "", author = "", subject = "", ...bodyParts] =
        record.split(FIELD_SEPARATOR);
      return {
        fullHash: fullHash.trim(),
        shortHash: shortHash.trim(),
        date: date.trim(),
        author: author.trim(),
        subject: subject.trim(),
        body: bodyParts.join(FIELD_SEPARATOR).trim()
      };
    })
    .filter((commit) => commit.subject);
}

export function suggestSemverBumpFromCommits(commits: ReleaseCommit[]): SemverSuggestion {
  if (commits.length === 0) {
    return {
      bump: "none",
      reason: "No commits were found in the selected release range."
    };
  }

  if (commits.some(isBreakingChangeCommit)) {
    return {
      bump: "major",
      reason: "At least one commit declares a breaking change."
    };
  }

  if (commits.some((commit) => getConventionalCommitType(commit.subject) === "feat")) {
    return {
      bump: "minor",
      reason: "At least one feature commit is present."
    };
  }

  return {
    bump: "patch",
    reason: "The release range contains fixes, maintenance, or documentation changes without feature or breaking-change signals."
  };
}

export function formatReleaseCommitsForPrompt(commits: ReleaseCommit[]): string {
  if (commits.length === 0) {
    return "(no commits found)";
  }

  return commits
    .map((commit) => {
      const body = commit.body ? `\n  Body: ${commit.body.replace(/\r?\n/g, "\n  ")}` : "";
      return `- ${commit.shortHash} ${commit.date} ${commit.subject} (${commit.author})${body}`;
    })
    .join("\n");
}

export function buildReleaseAssistantPrompt(input: ReleaseAssistantPromptInput): string {
  const packageLine = input.packageName ? `Package name: ${input.packageName}` : "Package name: unknown";

  return [
    "You are generating release workflow copy from Git history.",
    "Only include facts supported by the Git history context.",
    "Do not invent issue numbers, validation results, contributors, dates, or migration notes.",
    "If the Git history does not support a section, say so concisely in that section.",
    "",
    packageLine,
    `Target version: ${input.targetVersion}`,
    `Release range: ${input.rangeLabel}`,
    `Deterministic semver suggestion: ${input.semverSuggestion.bump}`,
    `Semver rationale: ${input.semverSuggestion.reason}`,
    "",
    "Return Markdown only, with exactly these top-level sections:",
    "",
    `# Release Assistant: v${input.targetVersion}`,
    "## Suggested Semver Bump",
    "## Changelog",
    "## GitHub Release Notes",
    "## npm Release Summary",
    "## PR Description",
    "## Reviewer Checklist",
    "",
    "Reviewer Checklist must use Markdown task-list checkboxes.",
    "Keep the npm summary short enough for package release notes.",
    "Use grouped changelog bullets such as Added, Changed, Fixed, Documentation, or Internal only when supported.",
    "",
    "Git history context:",
    input.historyContext
  ].join("\n");
}

export function normalizeGeneratedReleaseMarkdown(raw: string): string {
  let text = raw.trim();
  text = text.replace(/^```(?:markdown|md)?\s*/i, "");
  text = text.replace(/\s*```$/i, "");
  text = text.replace(/^Here(?:'s| is) (?:the )?(?:release notes|release assistant output):\s*/i, "");
  return text.trim();
}

function isBreakingChangeCommit(commit: ReleaseCommit): boolean {
  return /^[a-z]+(?:\([^)]+\))?!:/i.test(commit.subject) ||
    /\bBREAKING[ -]CHANGE\b/i.test(commit.body);
}

function getConventionalCommitType(subject: string): string {
  return subject.match(/^([a-z]+)(?:\([^)]+\))?!?:/i)?.[1]?.toLowerCase() ?? "";
}
