#!/usr/bin/env bash
# opencode auto-heal wrapper (shadows real binary via PATH precedence)
# - Detects new runner via /etc/machine-id + hostname marker
# - If new runner OR stale encrypted_content tags remain, applies v1 fix:
#   deletes ONLY metadata.openai.reasoningEncryptedContent, keeps itemId + text
#   for known sessions (main + fork), in both part and event tables.
# Real binary: /usr/local/share/nvm/versions/node/v24.20.0/lib/node_modules/opencode-ai/bin/opencode.exe
set -uo pipefail

REAL_BIN="/usr/local/share/nvm/versions/node/v24.20.0/lib/node_modules/opencode-ai/bin/opencode.exe"
DB="$HOME/.local/share/opencode/opencode.db"
MARKER="$HOME/.local/share/opencode/.runner_fixed_marker"
# Known sessions: main + fork (add more IDs here if needed)
SESSIONS="ses_f7428d927ffeU5bWgONAlPQuxP ses_f62dc87ffffenlOEJ66qJ6fki6"

# If real binary missing (nvm switch), resolve dynamically, avoiding self
if [[ ! -x "$REAL_BIN" ]]; then
  for c in /home/codespace/nvm/current/bin/opencode /usr/local/share/nvm/versions/node/v24.20.0/bin/opencode; do
    if [[ "$c" != "$0" && -L "$c" ]]; then
      R=$(readlink -f "$c" 2>/dev/null || true)
      if [[ -n "$R" && -x "$R" && "$R" != "$0" ]]; then REAL_BIN="$R"; break; fi
    elif [[ "$c" != "$0" && -x "$c" && ! -d "$c" ]]; then
      # ensure it's not this wrapper (check for marker string)
      if ! head -n 5 "$c" 2>/dev/null | grep -q "auto-heal wrapper"; then REAL_BIN="$c"; break; fi
    fi
  done
fi

needs_fix=0
reason=""

# Allow opt-out: OPENCODE_AUTO_FIX=0 skips healing
if [[ "${OPENCODE_AUTO_FIX:-1}" == "0" ]]; then
  needs_fix=0
elif [[ ! -f "$DB" ]]; then
  needs_fix=0
else
  CURR_ID="$(cat /etc/machine-id 2>/dev/null || echo no-machine-id):$(hostname 2>/dev/null || echo no-host)"
  LAST_ID=""
  [[ -f "$MARKER" ]] && LAST_ID="$(cat "$MARKER" 2>/dev/null || true)"
  if [[ "$CURR_ID" != "$LAST_ID" ]]; then
    needs_fix=1
    reason="new-runner (curr=$CURR_ID last=${LAST_ID:-none})"
  elif [[ "${OPENCODE_AUTO_FIX:-}" == "force" ]]; then
    needs_fix=1
    reason="forced (OPENCODE_AUTO_FIX=force)"
  fi
  # NOTE: intentionally NOT checking stale-tags on same runner.
  # New reasoning turns legitimately create fresh encrypted_content for the
  # current gateway node; stripping on every run would churn + slow every
  # invocation (2x256MB backups). Only new runners need healing.
fi

if [[ "$needs_fix" -eq 1 ]]; then
  echo "[opencode-wrapper] detected $reason -> auto-fixing encrypted_content (v1, keep itemId)..." >&2
  # Single backup + single transaction for all sessions (fast, avoids 2x256MB backups).
  # Prefer repo-persisted fixer if it supports multi-session, else inline fallback.
  FIXER="/workspaces/Robotics-Interview-Dashboard/scripts/fix-opencode-fork.py"
  if [[ -f "$FIXER" ]] && grep -q "SESSIONS\|nargs" "$FIXER" 2>/dev/null; then
    python3 "$FIXER" --db "$DB" $SESSIONS >&2 || echo "[opencode-wrapper] fixer failed, continuing..." >&2
  else
    # Inline v1: one backup, strip ONLY reasoningEncryptedContent, keep itemId+text
    BAK="/tmp/opencode.db.bak.$(date +%s)"
    python3 - "$DB" "$BAK" $SESSIONS >&2 <<'PYEOF'
import sqlite3, json, sys
db, bak = sys.argv[1], sys.argv[2]
sessions = sys.argv[3:]
s = sqlite3.connect(db); d = sqlite3.connect(bak)
with d: s.backup(d)
d.close(); s.close()
print(f"backup -> {bak}", file=sys.stderr)
con = sqlite3.connect(db, timeout=30.0)
cur = con.cursor()
tp = te = 0
for sid in sessions:
    for pid, data in cur.execute("SELECT id, data FROM part WHERE session_id=? AND data LIKE '%reasoningEncryptedContent%'", (sid,)).fetchall():
        try:
            j = json.loads(data)
            md = j.get("metadata", {})
            if isinstance(md, dict):
                for v in md.values():
                    if isinstance(v, dict) and "reasoningEncryptedContent" in v:
                        del v["reasoningEncryptedContent"]; tp += 1
                cur.execute("UPDATE part SET data=? WHERE id=?", (json.dumps(j, separators=(",", ":"), ensure_ascii=False), pid))
        except Exception as e:
            print(f"part {pid} err {e}", file=sys.stderr)
    for eid, data in cur.execute("SELECT id, data FROM event WHERE aggregate_id=? AND data LIKE '%reasoningEncryptedContent%'", (sid,)).fetchall():
        try:
            j = json.loads(data)
            part = j.get("part", {})
            md = part.get("metadata", {}) if isinstance(part, dict) else {}
            if isinstance(md, dict):
                ch = False
                for v in md.values():
                    if isinstance(v, dict) and "reasoningEncryptedContent" in v:
                        del v["reasoningEncryptedContent"]; ch = True; te += 1
                if ch:
                    cur.execute("UPDATE event SET data=? WHERE id=?", (json.dumps(j, separators=(",", ":"), ensure_ascii=False), eid))
        except Exception as e:
            print(f"event {eid} err {e}", file=sys.stderr)
con.commit()
print(f"v1 stripped parts={tp} events={te}", file=sys.stderr)
print("integrity: " + str(con.execute("PRAGMA integrity_check").fetchone()[0]), file=sys.stderr)
con.close()
PYEOF
  fi
  # Mark this runner as fixed (even if fixer partially failed, avoid loop; next run will re-check tags)
  mkdir -p "$(dirname "$MARKER")"
  echo "$(cat /etc/machine-id 2>/dev/null || echo no-machine-id):$(hostname 2>/dev/null || echo no-host)" > "$MARKER" 2>/dev/null || true
  echo "[opencode-wrapper] fix done, launching opencode..." >&2
fi

exec "$REAL_BIN" "$@"
