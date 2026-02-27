#!/usr/bin/env bash
set -euo pipefail

REPO="DoN0tPanic/AllyFanDecky"
ASSET_NAME="AllyFanDecky.tar.gz"
PLUGIN_FOLDER_NAME="AllyFanControl"

need_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "Missing: $1"; exit 1; }; }
need_cmd curl
need_cmd tar
need_cmd mktemp

PLUGIN_DIR_CANDIDATES=(
  "$HOME/homebrew/plugins"
  "$HOME/.local/share/decky-loader/plugins"
)

pick_plugin_dir() {
  for d in "${PLUGIN_DIR_CANDIDATES[@]}"; do
    if [[ -d "$d" ]]; then
      echo "$d"
      return 0
    fi
  done
  echo "ERROR: Decky plugin directory not found."
  printf "Tried:\n"
  printf " - %s\n" "${PLUGIN_DIR_CANDIDATES[@]}"
  exit 1
}

sudo_if_needed() {
  # Usage: sudo_if_needed <cmd...>
  # Runs command normally; if it fails due to permissions, retries with sudo.
  if "$@"; then
    return 0
  fi
  echo "[*] Permission issue detected, retrying with sudo: $*"
  sudo "$@"
}

PLUGIN_BASE="$(pick_plugin_dir)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "[*] Repo: $REPO"
echo "[*] Plugin dir: $PLUGIN_BASE"

API_URL="https://api.github.com/repos/${REPO}/releases/latest"
ASSET_URL="$(curl -fsSL "$API_URL" \
  | grep -Eo '"browser_download_url":[^"]*"[^"]*'"${ASSET_NAME}"'"' \
  | head -n1 \
  | sed -E 's/.*"browser_download_url":[^"]*"([^"]+)".*/\1/')"

if [[ -z "${ASSET_URL}" ]]; then
  echo "ERROR: Could not find ${ASSET_NAME} in latest release assets."
  echo "Create/publish a release that includes ${ASSET_NAME}."
  exit 1
fi

echo "[*] Download: $ASSET_URL"
curl -fL "$ASSET_URL" -o "$TMP/$ASSET_NAME"

mkdir -p "$TMP/unpack"
tar -xzf "$TMP/$ASSET_NAME" -C "$TMP/unpack"

SRC="$TMP/unpack/$PLUGIN_FOLDER_NAME"
if [[ ! -f "$SRC/plugin.json" ]]; then
  echo "ERROR: plugin.json not found in $SRC"
  echo "Your release archive must contain: ${PLUGIN_FOLDER_NAME}/plugin.json"
  exit 1
fi

DEST="$PLUGIN_BASE/$PLUGIN_FOLDER_NAME"
echo "[*] Installing to: $DEST"

# Remove old install (handle root-owned installs)
if [[ -e "$DEST" ]]; then
  if rm -rf "$DEST" 2>/dev/null; then
    :
  else
    echo "[*] Existing install not removable as user, using sudo..."
    sudo rm -rf "$DEST"
  fi
fi

# Copy new install (handle root-owned plugin dir)
if cp -a "$SRC" "$DEST" 2>/dev/null; then
  :
else
  echo "[*] Target directory not writable as user, using sudo copy..."
  sudo cp -a "$SRC" "$DEST"
fi

echo "[OK] Installed: $PLUGIN_FOLDER_NAME"
echo "[*] Open Decky -> Plugins -> Ally Fan Control"
