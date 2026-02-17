#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# GitHub PR Extractor — Build Script
# Builds for Chrome and Firefox from the shared src/ directory.
# ============================================================

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SRC_DIR="$ROOT_DIR/src"
DIST_DIR="$ROOT_DIR/dist"

echo "==> Cleaning dist/"
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR/chrome" "$DIST_DIR/firefox"

# ---- Chrome Build (MV3 as-is) ----
echo "==> Building Chrome extension..."
cp -r "$SRC_DIR"/* "$DIST_DIR/chrome/"
echo "    Chrome build ready at dist/chrome/"

# ---- Firefox Build (MV3 with gecko settings) ----
echo "==> Building Firefox extension..."
cp -r "$SRC_DIR"/* "$DIST_DIR/firefox/"

# Firefox MV3 uses background.scripts instead of service_worker
# Patch manifest for Firefox compatibility
python3 - "$DIST_DIR/firefox/manifest.json" << 'PYEOF'
import json, sys

manifest_path = sys.argv[1]
with open(manifest_path, "r") as f:
    manifest = json.load(f)

# Firefox MV3 supports service_worker since v109,
# but also supports background.scripts — use scripts for broader compat
if "background" in manifest and "service_worker" in manifest["background"]:
    sw = manifest["background"]["service_worker"]
    manifest["background"] = {"scripts": [sw]}

with open(manifest_path, "w") as f:
    json.dump(manifest, f, indent=2)

print("    Firefox manifest patched.")
PYEOF

echo "    Firefox build ready at dist/firefox/"

# ---- Package as .zip ----
echo "==> Packaging..."
cd "$DIST_DIR/chrome"
zip -r -q "$DIST_DIR/github-pr-extractor-chrome.zip" .
echo "    dist/github-pr-extractor-chrome.zip"

cd "$DIST_DIR/firefox"
zip -r -q "$DIST_DIR/github-pr-extractor-firefox.zip" .
echo "    dist/github-pr-extractor-firefox.zip"

echo ""
echo "==> Build complete!"
echo "    Chrome:  Load dist/chrome/ as unpacked extension"
echo "    Firefox: Load dist/firefox/ via about:debugging"
