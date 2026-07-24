#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# deploy.sh — Push main, then merge and push to prod
# Stops immediately on any failure and reports where and why.
# ---------------------------------------------------------------------------

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

fail() {
  echo -e "${RED}✗ STOPPED: $1${NC}"
  exit 1
}

ok() {
  echo -e "${GREEN}✓ $1${NC}"
}

info() {
  echo -e "${YELLOW}→ $1${NC}"
}

# ---------------------------------------------------------------------------
# Step 1: Verify main is up to date (nothing to pull)
# ---------------------------------------------------------------------------
info "Step 1: Checking main is up to date..."

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
  fail "Not on main (currently on '$CURRENT_BRANCH'). Switch to main before deploying."
fi

git fetch origin main --quiet || fail "Could not fetch from origin."

BEHIND=$(git rev-list --count HEAD..origin/main)
if [ "$BEHIND" -gt 0 ]; then
  fail "main is $BEHIND commit(s) behind origin/main. Pull (--rebase) before deploying."
fi

ok "main is up to date with origin/main."

# ---------------------------------------------------------------------------
# Step 2: Push main to origin
# ---------------------------------------------------------------------------
info "Step 2: Pushing main to origin..."

git push origin main || fail "Push to origin/main failed."

ok "Pushed main to origin/main."

# ---------------------------------------------------------------------------
# Step 3: Checkout prod
# ---------------------------------------------------------------------------
info "Step 3: Checking out prod..."

git checkout prod || fail "Could not checkout prod. Does the branch exist?"

ok "On prod."

# ---------------------------------------------------------------------------
# Step 4: Pull prod with rebase
# ---------------------------------------------------------------------------
info "Step 4: Pulling prod (--rebase)..."

git pull --rebase origin prod || fail "Pull --rebase on prod failed. Resolve conflicts, then re-run."

ok "prod is up to date."

# ---------------------------------------------------------------------------
# Step 5: Merge main into prod
# ---------------------------------------------------------------------------
info "Step 5: Merging origin/main into prod..."

git merge origin/main --no-edit || fail "Merge of origin/main into prod failed. Resolve conflicts, then re-run."

ok "Merged origin/main into prod."

# ---------------------------------------------------------------------------
# Step 6: Push prod to origin
# ---------------------------------------------------------------------------
info "Step 6: Pushing prod to origin..."

git push origin prod || fail "Push to origin/prod failed."

ok "Pushed prod to origin/prod."

# ---------------------------------------------------------------------------
# Done — return to main
# ---------------------------------------------------------------------------

git checkout main --quiet
echo ""
ok "Deploy complete. Back on main."
