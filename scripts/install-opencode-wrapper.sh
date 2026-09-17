#!/usr/bin/env bash
# Reinstalls the opencode auto-heal wrapper on a (new) runner.
# Run once per new Codespace runner/machine:
#   bash /workspaces/Robotics-Interview-Dashboard/scripts/install-opencode-wrapper.sh
set -euo pipefail
SRC="/workspaces/Robotics-Interview-Dashboard/scripts/opencode-wrapper.sh"
DST="$HOME/.local/bin/opencode"
mkdir -p "$(dirname "$DST")"
cp "$SRC" "$DST"
chmod +x "$DST"
echo "installed $DST -> shadows real opencode (PATH precedence)"
which -a opencode || true
# Trigger first heal check (writes marker, fixes main+fork if new runner)
"$DST" --version || true
echo "done. Use 'opencode ...' normally. Bypass with OPENCODE_AUTO_FIX=0 opencode ..."
