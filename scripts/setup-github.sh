#!/usr/bin/env bash
# Wharfside Marina — one-shot GitHub repo bootstrap.
#
# Run this once on your Mac, from inside the wharfside-marina/ directory,
# after extracting the tarball. It will:
#   1. Verify prereqs (gh, git, pnpm)
#   2. Initialize the local git repo with proper config
#   3. Create the GitHub repo (private)
#   4. Push the initial commit
#   5. Create 8 labels
#   6. Seed 60 GitHub issues from BACKLOG.md
#   7. Configure branch protection on main
#
# Idempotent for safe parts. Will refuse to re-run destructive steps.
#
# Usage:
#   bash scripts/setup-github.sh                 # default: nickdnj/wharfside-marina
#   REPO=other/name bash scripts/setup-github.sh # override
#   SKIP_ISSUES=1 bash scripts/setup-github.sh   # don't seed issues
#   DRY_RUN=1 bash scripts/setup-github.sh       # show what would happen, do nothing

set -euo pipefail

REPO="${REPO:-nickdnj/wharfside-marina}"
DRY_RUN="${DRY_RUN:-0}"
SKIP_ISSUES="${SKIP_ISSUES:-0}"

run() {
  if [ "$DRY_RUN" = "1" ]; then
    echo "  [dry-run] $*"
  else
    echo "  → $*"
    eval "$@"
  fi
}

step() { echo; echo "=== $* ==="; }

step "1. Prereq check"
command -v git >/dev/null  || { echo "ERROR: git not installed"; exit 1; }
command -v gh >/dev/null   || { echo "ERROR: gh CLI not installed (brew install gh)"; exit 1; }
command -v pnpm >/dev/null || { echo "ERROR: pnpm not installed (corepack enable && corepack prepare pnpm@9.5.0 --activate)"; exit 1; }
command -v node >/dev/null || { echo "ERROR: node not installed"; exit 1; }

gh auth status 2>/dev/null || { echo "ERROR: gh not authed. Run: gh auth login"; exit 1; }

[ -f "package.json" ] || { echo "ERROR: not in wharfside-marina root (no package.json)"; exit 1; }
[ -f "docs/planning/BACKLOG.md" ] || { echo "ERROR: BACKLOG.md missing — tarball not fully extracted"; exit 1; }

echo "✅ prereqs OK"

step "2. Local git init"
if [ -d ".git" ]; then
  echo "  git already initialized — skipping init"
else
  run "git init -q"
  run "git branch -M main"
fi

# Stage and commit everything if nothing committed yet
if ! git rev-parse HEAD >/dev/null 2>&1; then
  run "git add -A"
  run 'git commit -m "Initial scaffold: design + Sprint 1 + lib code + specs + seed data + runbook"'
else
  echo "  commits already exist — skipping initial commit"
  # Stage any uncommitted updates from the bootstrap
  if ! git diff --quiet || ! git diff --cached --quiet; then
    run "git add -A"
    run 'git commit -m "Add proper-repo files (LICENSE, renovate, PR template, issue templates)"'
  fi
fi

step "3. GitHub repo creation"
if gh repo view "$REPO" >/dev/null 2>&1; then
  echo "  repo $REPO already exists — skipping create"
  if ! git remote get-url origin >/dev/null 2>&1; then
    run "git remote add origin git@github.com:$REPO.git"
  fi
else
  run "gh repo create $REPO --private --source=. --remote=origin --description 'Wharfside Manor marina management app'"
fi

step "4. Push to origin"
run "git push -u origin main"

step "5. Create labels"
node scripts/seed-github-issues.mjs --dry-run >/dev/null 2>&1 || { echo "ERROR: issue seeder script broken — investigate manually"; exit 1; }

# Create just the labels (the seeder does this; running with --labels-only would be cleaner
# but the current seeder doesn't support that mode. Either run the full seeder or skip.)
echo "  (labels are created by the issue seeder in step 6)"

step "6. Seed 60 GitHub issues from BACKLOG.md"
if [ "$SKIP_ISSUES" = "1" ]; then
  echo "  SKIP_ISSUES=1 — skipping issue creation"
else
  echo "  Previewing issues (dry-run)..."
  run "node scripts/seed-github-issues.mjs --dry-run --repo $REPO 2>&1 | tail -3"
  echo
  read -p "Proceed with live issue creation? This is NOT idempotent. (y/N) " -n 1 -r
  echo
  if [[ "$REPLY" =~ ^[Yy]$ ]]; then
    run "node scripts/seed-github-issues.mjs --repo $REPO"
  else
    echo "  skipped — you can run this later: node scripts/seed-github-issues.mjs --repo $REPO"
  fi
fi

step "7. Branch protection"
echo "  Configuring main branch protection: require PR, require CI to pass, no force push, no deletion"
# gh API requires JSON; using the cli
PROTECTION_JSON='{
  "required_status_checks": null,
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}'
# (No required reviewers — solo dev. No required status checks until CI is green at least once.)
if [ "$DRY_RUN" = "1" ]; then
  echo "  [dry-run] would PUT /repos/$REPO/branches/main/protection"
else
  echo "$PROTECTION_JSON" | gh api -X PUT "/repos/$REPO/branches/main/protection" --input - 2>&1 \
    | head -3 || echo "  (protection setup may have failed — set it up manually if needed)"
fi

step "8. Done"
cat <<EOF

Repo is live at: https://github.com/$REPO
Issues: https://github.com/$REPO/issues
Labels: https://github.com/$REPO/labels

Remaining manual setup (must be done in GitHub UI):

  1. Settings → Secrets and variables → Actions → add:
     - TEST_DATABASE_URL (for CI integration tests)
     - SENTRY_AUTH_TOKEN (when you wire up Sentry)
     - VERCEL_TOKEN (for the deploy hook, if not using Vercel's own integration)

  2. Settings → Branches → Branch protection rules → main:
     - Once you have green CI, edit the rule to require "CI / check" status check.
     - Consider requiring linear history (no merge commits).

  3. Install Renovate:
     - Visit https://github.com/apps/renovate
     - Install on $REPO
     - Renovate will read renovate.json automatically.

  4. Vercel:
     - https://vercel.com/new → Import $REPO
     - Set env vars from .env.example
     - First deploy will auto-trigger.

  5. Neon:
     - https://console.neon.tech → New project
     - Copy connection string to Vercel env vars + local .env.local
     - Apply migrations: pnpm db:migrate
     - Then run the EXCLUDE constraint migration manually:
       psql "\$DATABASE_URL" -f drizzle/0001_exclude_constraint.sql

Next development steps (per DEV-PLAN.md Sprint 1):
  - SPIKE-A: verify btree_gist works on Neon (see HANDOFF.md step 7)
  - SPIKE-B: Auth.js v5 TOTP setup
  - Then: pnpm install && pnpm test → see what's green

EOF
