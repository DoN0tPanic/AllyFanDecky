#!/usr/bin/env bash
set -euo pipefail

PLUGIN_FOLDER="AllyFanControl"
OUT="AllyFanDecky.tar.gz"

rm -rf _package
mkdir -p "_package/${PLUGIN_FOLDER}"

cp plugin.json "_package/${PLUGIN_FOLDER}/"
cp main.py "_package/${PLUGIN_FOLDER}/"
cp -a dist "_package/${PLUGIN_FOLDER}/"

tar -czf "${OUT}" -C _package "${PLUGIN_FOLDER}"
echo "[OK] Built ${OUT}"
