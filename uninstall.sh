#!/usr/bin/env bash
# Uninstall dotmanager.
# Usage:  curl -fsSL https://raw.githubusercontent.com/gbsaito/dotmanager/main/uninstall.sh | bash
set -euo pipefail

DEST=${DOTMANAGER_INSTALL_DIR:-$HOME/.local/bin}
BIN="$DEST/dotmanager"

if [ -e "$BIN" ] || [ -L "$BIN" ]; then
  rm -f "$BIN"
  echo "removed: $BIN"
else
  echo "nothing to remove: $BIN not found"
fi

echo "uninstalled: dotmanager"
echo "no other files were removed (config/state, if any, are left untouched)"
