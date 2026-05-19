#!/usr/bin/env node
/**
 * Seeds GitHub issues from BACKLOG.md.
 *
 * Usage:
 *   1. gh auth login   (one-time)
 *   2. gh repo create nickdnj/wharfside-marina --private --source=. --remote=origin --push
 *   3. node scripts/seed-github-issues.mjs [--dry-run] [--repo OWNER/REPO]
 *
 * Defaults to current repo from `gh`. Add --dry-run first to preview.
 * Idempotent-ish: re-running will create duplicate issues. Don't run twice.
 */

import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BACKLOG_PATH = join(__dirname, "..", "docs", "planning", "BACKLOG.md");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const repoArgIdx = args.indexOf("--repo");
const repo = repoArgIdx >= 0 ? args[repoArgIdx + 1] : null;

const EPIC_LABELS = {
  "EPIC-0": { label: "epic-0-foundation", color: "1a3a5c", desc: "Foundation" },
  "EPIC-1A": { label: "epic-1a-patron-site", color: "0e7490", desc: "Patron site" },
  "EPIC-1B": { label: "epic-1b-pricing-modeler", color: "c9a227", desc: "Pricing modeler" },
  "EPIC-2A": { label: "epic-2a-slip-ops", color: "065f46", desc: "Slip ops" },
  "EPIC-2B": { label: "epic-2b-documents", color: "7c2d12", desc: "Documents" },
  "EPIC-3": { label: "epic-3-reports-launch", color: "581c87", desc: "Reports + launch" },
};

const TYPE_LABELS = {
  STORY: { label: "story", color: "0366d6", desc: "Implementation story" },
  SPIKE: { label: "spike", color: "fbca04", desc: "Investigation / research" },
};

function parseBacklog(md) {
  const lines = md.split("\n");
  const issues = [];
  let currentEpic = null;
  let currentIssue = null;
  let buffer = [];

  const epicHeader = /^# (EPIC-[0-9A-Z]+) —/;
  const storyHeader = /^## ((?:EPIC-[0-9A-Z]+-(?:STORY|SPIKE)-\d+|SPIKE-[A-Z])): (.+)$/;

  for (const line of lines) {
    const epicMatch = line.match(epicHeader);
    if (epicMatch) {
      flushIssue();
      currentEpic = epicMatch[1];
      continue;
    }

    const storyMatch = line.match(storyHeader);
    if (storyMatch) {
      flushIssue();
      const id = storyMatch[1];
      const title = storyMatch[2].trim();
      const type = id.includes("SPIKE") ? "SPIKE" : "STORY";
      currentIssue = { id, title, epic: currentEpic, type };
      buffer = [];
      continue;
    }

    if (currentIssue) {
      buffer.push(line);
    }
  }
  flushIssue();

  function flushIssue() {
    if (!currentIssue) return;
    const body = buffer.join("\n").trim();
    issues.push({ ...currentIssue, body });
    currentIssue = null;
    buffer = [];
  }

  return issues;
}

function run(cmd) {
  if (dryRun) {
    console.log(`[dry-run] ${cmd}`);
    return "";
  }
  return execSync(cmd, { stdio: ["ignore", "pipe", "inherit"] }).toString();
}

function ensureLabel({ label, color, desc }) {
  const repoFlag = repo ? `--repo ${repo}` : "";
  try {
    run(
      `gh label create ${JSON.stringify(label)} --color ${color} --description ${JSON.stringify(desc)} ${repoFlag} 2>/dev/null || true`,
    );
  } catch {
    // label probably already exists; ignore
  }
}

function createIssue(issue) {
  const labels = [];
  if (issue.epic && EPIC_LABELS[issue.epic]) labels.push(EPIC_LABELS[issue.epic].label);
  if (TYPE_LABELS[issue.type]) labels.push(TYPE_LABELS[issue.type].label);

  const title = `[${issue.id}] ${issue.title}`;
  const body = issue.body;
  const labelFlag = labels.length ? `--label ${labels.join(",")}` : "";
  const repoFlag = repo ? `--repo ${repo}` : "";

  const tmpFile = `/tmp/issue-${issue.id}.md`;
  if (!dryRun) {
    execSync(`cat > ${tmpFile} <<'__EOF__'\n${body}\n__EOF__`);
  }
  const bodyFlag = dryRun
    ? `--body ${JSON.stringify(body.slice(0, 80) + "…")}`
    : `--body-file ${tmpFile}`;

  run(`gh issue create --title ${JSON.stringify(title)} ${bodyFlag} ${labelFlag} ${repoFlag}`);

  if (!dryRun) {
    execSync(`rm -f ${tmpFile}`);
  }
}

function main() {
  const md = readFileSync(BACKLOG_PATH, "utf-8");
  const issues = parseBacklog(md);

  console.log(`Parsed ${issues.length} issues from BACKLOG.md`);
  const byEpic = {};
  for (const issue of issues) {
    byEpic[issue.epic ?? "unknown"] = (byEpic[issue.epic ?? "unknown"] ?? 0) + 1;
  }
  console.log("By epic:", byEpic);

  console.log("\nCreating labels...");
  for (const e of Object.values(EPIC_LABELS)) ensureLabel(e);
  for (const t of Object.values(TYPE_LABELS)) ensureLabel(t);

  console.log("\nCreating issues...");
  for (const issue of issues) {
    console.log(`  ${issue.id} — ${issue.title.slice(0, 60)}`);
    createIssue(issue);
  }

  console.log("\nDone.");
  if (dryRun) console.log("(dry-run: no changes were made)");
}

main();
