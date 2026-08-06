#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# commit.sh — stage everything, have Claude write the commit message, commit.
#
#   ./tools/commit.sh
#
# Never pushes. Use ./tools/deploy.sh for that.
# ---------------------------------------------------------------------------

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; DIM='\033[2m'; NC='\033[0m'
fail() { echo -e "${RED}✗ $1${NC}" >&2; exit 1; }
info() { echo -e "${YELLOW}→ $1${NC}"; }
ok()   { echo -e "${GREEN}✓ $1${NC}"; }

# Diff sent to Claude is capped so a huge change set doesn't blow up the prompt.
# Above this, Claude gets the full file-level stat plus a truncated patch.
MAX_DIFF_BYTES=${MAX_DIFF_BYTES:-120000}

command -v claude >/dev/null 2>&1 || fail "\`claude\` is not on your PATH. Install the Claude Code CLI, or set the message by hand with \`git commit\`."
command -v git    >/dev/null 2>&1 || fail "git not found."

cd "$(git rev-parse --show-toplevel)" || fail "Not inside a git repository."

# ---------------------------------------------------------------------------
# Stage everything
# ---------------------------------------------------------------------------
info "Staging all changes..."
git add -A

if git diff --cached --quiet; then
  echo -e "${DIM}Nothing to commit — working tree is clean.${NC}"
  exit 0
fi

echo
git -c color.status=always status --short
echo

# ---------------------------------------------------------------------------
# Build the context for Claude
# ---------------------------------------------------------------------------
STAT="$(git diff --cached --stat)"
DIFF="$(git diff --cached)"
DIFF_BYTES=${#DIFF}

if [ "$DIFF_BYTES" -gt "$MAX_DIFF_BYTES" ]; then
  info "Diff is ${DIFF_BYTES} bytes — truncating to ${MAX_DIFF_BYTES} for the prompt."
  DIFF="$(printf '%s' "$DIFF" | head -c "$MAX_DIFF_BYTES")
[... diff truncated at ${MAX_DIFF_BYTES} bytes — rely on the file stat above for the rest ...]"
fi

# Recent subjects, so the message matches the voice of this repo's history.
RECENT="$(git log --pretty='%s' -10 2>/dev/null || true)"

PROMPT="Write a git commit message for the staged changes below.

Rules:
- First line: imperative summary, max 72 chars, no trailing period.
- Then a blank line, then 1-5 bullet points ('- ') explaining WHAT changed and WHY.
  Skip the body entirely if the change is genuinely trivial.
- Describe only what the diff actually does. Do not speculate, do not invent
  motivation that is not visible in the change, do not mention testing you
  cannot see.
- Match the style of the recent commit subjects below.
- Output ONLY the commit message. No preamble, no markdown code fences,
  no 'Here is the commit message'.

Recent commit subjects in this repo (for tone):
${RECENT}

Files changed:
${STAT}

Staged diff:
${DIFF}"

# ---------------------------------------------------------------------------
# Ask Claude
# ---------------------------------------------------------------------------
info "Asking Claude for a commit message..."

MSG="$(printf '%s' "$PROMPT" | claude -p 2>/dev/null || true)"

# Strip markdown fences and leading/trailing blank lines, in case they slip through.
MSG="$(printf '%s\n' "$MSG" \
  | sed -e '/^[[:space:]]*```[a-zA-Z]*[[:space:]]*$/d' \
  | sed -e '/./,$!d' \
  | awk 'BEGIN{n=0} {lines[n++]=$0} END{last=n-1; while(last>=0 && lines[last]~/^[[:space:]]*$/) last--; for(i=0;i<=last;i++) print lines[i]}')"

if [ -z "${MSG//[[:space:]]/}" ]; then
  fail "Claude returned an empty message. Your changes are still staged — commit manually with \`git commit\`."
fi

# ---------------------------------------------------------------------------
# Commit
# ---------------------------------------------------------------------------
echo
echo -e "${DIM}────────────────────────── commit message ──────────────────────────${NC}"
printf '%s\n' "$MSG"
echo -e "${DIM}────────────────────────────────────────────────────────────────────${NC}"
echo

printf '%s\n' "$MSG" | git commit -F - || fail "git commit failed. Your changes are still staged."

echo
ok "Committed $(git rev-parse --short HEAD) on $(git rev-parse --abbrev-ref HEAD)."
echo -e "${DIM}Not pushed. Run ./tools/deploy.sh when you're ready to ship.${NC}"
