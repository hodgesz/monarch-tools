#!/bin/zsh
# Wrapper for launchd to run monarch-tools scripts with correct environment.
# Usage: launchd-run.sh [--guard daily|weekly] <script-name.ts>

set -euo pipefail

GUARD=""
while [[ "${1:-}" == --* ]]; do
  case "$1" in
    --guard) GUARD="$2"; shift 2 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

SCRIPT_NAME="${1:?Usage: launchd-run.sh [--guard daily|weekly] <script-name.ts>}"
# Resolve the project root from this script's own location (scripts/ -> repo root),
# so the wrapper works regardless of where the repo is cloned.
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$HOME/.mm/logs"
LOG_FILE="$LOG_DIR/${SCRIPT_NAME%.ts}.log"

mkdir -p "$LOG_DIR"

# launchd starts jobs with a minimal PATH, so node/npx may not be found.
# Set MONARCH_NODE_BIN to your node bin directory (e.g. an nvm install path)
# either in the environment or via the launchd plist's EnvironmentVariables.
if [[ -n "${MONARCH_NODE_BIN:-}" ]]; then
  export PATH="$MONARCH_NODE_BIN:$PATH"
fi

if [[ -n "$GUARD" ]]; then
  MARKER="$LOG_DIR/.${SCRIPT_NAME%.ts}.guard"
  case "$GUARD" in
    daily)  PERIOD=$(date '+%Y-%m-%d') ;;
    weekly) PERIOD=$(date '+%G-W%V') ;;
    *)      echo "Unknown guard: $GUARD"; exit 1 ;;
  esac
  if [[ -f "$MARKER" ]] && [[ "$(cat "$MARKER")" == "$PERIOD" ]]; then
    echo "--- $(date '+%Y-%m-%d %H:%M:%S') --- [skipped: already ran for $PERIOD]" >> "$LOG_FILE"
    exit 0
  fi
fi

cd "$PROJECT_DIR"

echo "--- $(date '+%Y-%m-%d %H:%M:%S') ---" >> "$LOG_FILE"

npx tsx "scripts/$SCRIPT_NAME" >> "$LOG_FILE" 2>&1

if [[ -n "$GUARD" ]]; then
  echo "$PERIOD" > "$MARKER"
fi
