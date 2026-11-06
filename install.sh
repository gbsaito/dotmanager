#!/usr/bin/env bash
# Install the latest dotmanager release binary.
# Usage:  curl -fsSL https://raw.githubusercontent.com/gbsaito/dotmanager/main/install.sh | bash
set -euo pipefail

REPO=gbsaito/dotmanager
DEST=${DOTMANAGER_INSTALL_DIR:-$HOME/.local/bin}
OS=$(uname -s)
ARCH=$(uname -m)

case "$OS" in Darwin) os=darwin ;; Linux) os=linux ;; *) echo "unsupported OS: $OS" >&2; exit 1 ;; esac
case "$ARCH" in x86_64|amd64) arch=x64 ;; aarch64|arm64) arch=arm64 ;; *) echo "unsupported arch: $ARCH" >&2; exit 1 ;; esac

mkdir -p "$DEST"

if command -v gh >/dev/null 2>&1; then
  # Works for private repos (uses your gh login).
  echo "downloading latest release via gh..."
  gh release download --repo "$REPO" --pattern "dotmanager-$os-$arch" --output "$DEST/dotmanager"
else
  # Public access / tokenized fallback.
  token=${GITHUB_TOKEN:-}
  auth=""
  [ -n "$token" ] && auth="-H \"Authorization: Bearer $token\""
  echo "fetching latest release tag..."
  url=$(eval curl -fsSL $auth "https://api.github.com/repos/$REPO/releases/latest" \
    | grep -o "\"browser_download_url\": *\"[^\"]*dotmanager-$os-$arch\"" \
    | grep -o 'https[^"]*')
  [ -n "$url" ] || { echo "no release asset for $os-$arch; is the repo public or GITHUB_TOKEN set?" >&2; exit 1; }
  echo "downloading $url ..."
  eval curl -fSL $auth -o "$DEST/dotmanager" "$url"
fi

chmod +x "$DEST/dotmanager"
echo "installed: $DEST/dotmanager"
echo "ensure $DEST is on your PATH"
