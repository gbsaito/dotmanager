#!/usr/bin/env bash
# Build the binary for the current platform and publish it as the latest GitHub release.
# Usage: ./release.sh v1.0.1
set -euo pipefail

tag=${1:?usage: ./release.sh v1.0.1}

# ponytail: builds host target only (linux-x64); add per-target builds + node_modules/@opentui/core-<target> when needed
bun run build
mv dotmanager "dotmanager-linux-x64"

gh release create "$tag" --generate-notes "dotmanager-linux-x64"
echo "released $tag -> $(gh release view "$tag" --json url -q .url)"
