# Scripts

## `seed-github-issues.mjs`

Parses `docs/planning/BACKLOG.md` and creates one GitHub issue per story, with epic + type labels.

### Prereqs

- `gh` CLI installed and authed (`gh auth login`)
- Repo exists on GitHub and is set as the current remote

### Run

```bash
# preview without creating anything
node scripts/seed-github-issues.mjs --dry-run

# create issues in current repo
node scripts/seed-github-issues.mjs

# or target a specific repo
node scripts/seed-github-issues.mjs --repo nickdnj/wharfside-marina
```

### What it does

1. Creates 8 labels: `epic-0-foundation`, `epic-1a-patron-site`, `epic-1b-pricing-modeler`, `epic-2a-slip-ops`, `epic-2b-documents`, `epic-3-reports-launch`, `story`, `spike`
2. Parses BACKLOG.md, finds 60 story headers (`## EPIC-X-STORY-NN: Title`)
3. Creates one issue per story with title `[EPIC-X-STORY-NN] Title`, full body from BACKLOG, and appropriate labels

### Warning

**Not idempotent.** Running twice creates duplicate issues. Use `--dry-run` first, and only run the live version once.
