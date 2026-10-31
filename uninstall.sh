#!/bin/sh
# dotmanager-uninstall.sh - uninstall dotmanager (gbsaito/dotmanager)
#
# Remove dotmanager installed by install.sh:
#   curl -fsSL https://raw.githubusercontent.com/gbsaito/dotmanager/main/uninstall.sh | sh
#
# Removes the binary, the PATH helper and the shell rc line. Your dotfile repo
# (default ~/dotfiles) is left untouched.

set -eu

APP_NAME="dotmanager"
INSTALL_DIR="${DOTMANAGER_INSTALL_DIR:-${HOME}/.local/bin}"
ENV_DIR="$HOME/.dotmanager-install"
ENV_FILE="$ENV_DIR/env.sh"
RC_LINE='. "$HOME/.dotmanager-install/env.sh"'
QUIET="${DOTMANAGER_UNINSTALL_QUIET:-0}"

say() { if [ "$QUIET" != "1" ]; then echo "$1"; fi; }
err() { echo "dotmanager-uninstaller: ERROR: $1" >&2; exit 1; }

usage() {
    cat <<EOF
dotmanager-uninstall.sh

Removes dotmanager installed by dotmanager-installer.sh:

    binary        ${INSTALL_DIR}/dotmanager
    PATH helper   ${ENV_FILE}
    shell line    ${RC_LINE}

Dotfile repo is left untouched:
    \${HOME}/dotfiles

If dotmanager was installed to a custom directory, set DOTMANAGER_INSTALL_DIR to the
same value used during installation.

USAGE:
    dotmanager-uninstall.sh [OPTIONS]

OPTIONS:
    -q, --quiet     Disable progress output
    -h, --help      Print help information
EOF
}

while [ $# -gt 0 ]; do
    case "$1" in
        -h|--help)
            usage
            exit 0
            ;;
        -q|--quiet)
            QUIET=1
            ;;
        -*)
            err "unknown option $1"
            ;;
        *)
            err "unexpected argument $1"
            ;;
    esac
    shift
done

BIN="${INSTALL_DIR}/${APP_NAME}"

if [ -e "$BIN" ]; then
    rm -f "$BIN"
    say "removed $BIN"
else
    say "no binary found at $BIN"
fi

if [ -e "$ENV_FILE" ]; then
    rm -f "$ENV_FILE"
    say "removed $ENV_FILE"
fi
if [ -d "$ENV_DIR" ]; then
    rmdir "$ENV_DIR" 2>/dev/null || true
fi

for rc in "$HOME/.profile" "$HOME/.bashrc" "$HOME/.bash_profile" "$HOME/.bash_login" "$HOME/.zshrc" "$HOME/.zshenv"; do
    [ -f "$rc" ] || continue
    if grep -Fqx "$RC_LINE" "$rc"; then
        TMP_FILE="$(mktemp)"
        grep -vF "$RC_LINE" "$rc" > "$TMP_FILE" || true
        cat "$TMP_FILE" > "$rc"
        rm -f "$TMP_FILE"
        say "removed PATH line from $rc"
    fi
done

say "dotmanager uninstalled"
say "dotmanager uninstalled"
say "dotfile repo kept at \${HOME}/dotfiles"
