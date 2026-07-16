#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
FRONTEND="$ROOT/../frontend"
SPA_DEST="$ROOT/uploads/static/spa"

echo "Building frontend..."
( cd "$FRONTEND" && npm install && npm run build )

echo "Copying dist -> $SPA_DEST"
rm -rf "$SPA_DEST"
mkdir -p "$SPA_DEST"
cp -r "$FRONTEND/dist/." "$SPA_DEST/"
echo "Done."
