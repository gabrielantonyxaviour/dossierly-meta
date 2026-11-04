#!/usr/bin/env bash
# Usage: scripts/put-secrets.sh <prod|onboarding|app|voice|look>
# Pipes vault values into `wrangler secret put` for the NEW dossierly-meta Workers only. Never echoes values.
set -euo pipefail
ENVNAME="${1:?usage: put-secrets.sh <prod|onboarding|app|voice|look>}"
case "$ENVNAME" in
  prod) ENVFLAG=(); WORKER=dossierly-meta ;;
  onboarding|app|voice|look) ENVFLAG=(--env "$ENVNAME"); WORKER="dossierly-meta-$ENVNAME" ;;
  *) echo "unknown env: $ENVNAME" >&2; exit 2 ;;
esac
cd "$(dirname "$0")/.."
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
INJ="$HOME/.claude/vault/inject.sh"

# worker secret name : vault name
MAP=(
  "MODEL_API_KEY:DOSSIERLY_META_API_KEY"
  "ELEVENLABS_API_KEY:DOSSIERLY_ELEVENLABS_API_KEY"
  "TAVILY_API_KEY:TAVILY_API_KEY"
  "NVIDIA_API_KEY:NVIDIA_API_KEY"
  "RESEND_API_KEY:RESEND_API_KEY"
  "COMPOSIO_API_KEY:COMPOSIO_API_KEY"
  # Not in the vault yet; skipped with a warning until added:
  "COMPOSIO_PROJECT_ID:COMPOSIO_PROJECT_ID"
  "COMPOSIO_GMAIL_AUTH_CONFIG_ID:COMPOSIO_GMAIL_AUTH_CONFIG_ID"
  "COMPOSIO_OUTLOOK_AUTH_CONFIG_ID:COMPOSIO_OUTLOOK_AUTH_CONFIG_ID"
  "COMPOSIO_GOOGLECALENDAR_AUTH_CONFIG_ID:COMPOSIO_GOOGLECALENDAR_AUTH_CONFIG_ID"
  "COMPOSIO_MICROSOFTCALENDAR_AUTH_CONFIG_ID:COMPOSIO_MICROSOFTCALENDAR_AUTH_CONFIG_ID"
  "JUDGE_CODE:DOSSIERLY_JUDGE_CODE"
)

# Cloudflare credentials -> wrangler (scoped to this process tree).
"$INJ" get CLOUDFLARE_API_TOKEN_BROAD CLOUDFLARE_ACCOUNT_ID --dir "$TMP/cf" >/dev/null
set -a; . "$TMP/cf/.env.local"; set +a
export CLOUDFLARE_API_TOKEN="$CLOUDFLARE_API_TOKEN_BROAD"

put() { # name, stdin value
  printf '%s' "$(cat)" | npx wrangler secret put "$1" --config wrangler.jsonc ${ENVFLAG[@]+"${ENVFLAG[@]}"} >/dev/null
  echo "set   $1 on $WORKER"
}

EXISTING="$(npx wrangler secret list --config wrangler.jsonc ${ENVFLAG[@]+"${ENVFLAG[@]}"} 2>/dev/null || true)"

for pair in "${MAP[@]}"; do
  [[ "$pair" == \#* ]] && continue
  name="${pair%%:*}"; vault="${pair##*:}"
  d="$TMP/$name"
  if "$INJ" get "$vault" --dir "$d" >/dev/null 2>&1 && grep -q "^$vault=" "$d/.env.local" 2>/dev/null; then
    grep "^$vault=" "$d/.env.local" | head -1 | cut -d= -f2- | tr -d '\n"' | put "$name"
  else
    echo "MISSING vault name $vault (needed as $name) - skipped"
  fi
done

# Per-environment random secrets: created once, never rotated automatically.
for name in SESSION_SECRET BRIDGE_SECRET; do
  if grep -q "\"$name\"" <<<"$EXISTING"; then echo "keep  $name (already set)"
  else openssl rand -base64 48 | tr -d '\n' | put "$name"; fi
done
