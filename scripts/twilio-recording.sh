#!/usr/bin/env bash
# Usage: scripts/twilio-recording.sh [CallSid] [out-dir]
# Downloads the dual-channel recording of a Dossierly phone call (left = the person called, right = Dossierly) as
# WAV and MP3. Without a CallSid it takes the most recent call placed from the Dossierly number. Never echoes secrets.
set -euo pipefail
CALL="${1:-}"; OUT="${2:-.}"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
"$HOME/.claude/vault/inject.sh" get DOSSIERLY_TWILIO_ACCOUNT_SID DOSSIERLY_TWILIO_AUTH_TOKEN DOSSIERLY_TWILIO_FROM_NUMBER --dir "$TMP" >/dev/null
set -a; . "$TMP/.env.local"; set +a
SID="$DOSSIERLY_TWILIO_ACCOUNT_SID"; API="https://api.twilio.com/2010-04-01/Accounts/$SID"
printf 'user = "%s:%s"\n' "$SID" "$DOSSIERLY_TWILIO_AUTH_TOKEN" > "$TMP/curl.cfg"
get() { curl -fsS -K "$TMP/curl.cfg" "$@"; }
if [[ -z "$CALL" ]]; then
  CALL="$(get -G "$API/Calls.json" --data-urlencode "From=$DOSSIERLY_TWILIO_FROM_NUMBER" -d PageSize=1 | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const c=JSON.parse(s).calls?.[0];if(!c){process.exit(3)}console.log(c.sid)})')"
fi
REC="$(get "$API/Calls/$CALL/Recordings.json" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s).recordings?.[0];if(!r){console.error("No recording yet for this call (it appears a few seconds after hang-up).");process.exit(4)}console.log(r.sid+" "+r.duration+" "+r.channels+" "+r.status)})')"
read -r RSID DUR CH STATUS <<<"$REC"
mkdir -p "$OUT"
get -o "$OUT/A7_call_${CALL}.wav" "$API/Recordings/$RSID.wav?RequestedChannels=2"
get -o "$OUT/A7_call_${CALL}.mp3" "$API/Recordings/$RSID.mp3?RequestedChannels=2"
echo "call $CALL · recording $RSID · ${DUR}s · ${CH} channel(s) · $STATUS"
echo "saved $OUT/A7_call_${CALL}.wav and .mp3"
