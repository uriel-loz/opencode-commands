#!/bin/bash
set -e

DEST_DIR="$HOME/.config/opencode/commands"
SRC_DIR="$(cd "$(dirname "$0")" && pwd)/commands"

mkdir -p "$DEST_DIR"

cp "$SRC_DIR/git-commit.md" "$DEST_DIR/"
cp "$SRC_DIR/engram-import.md" "$DEST_DIR/"
cp "$SRC_DIR/engram-sync.md" "$DEST_DIR/"

echo "✅ opencode-commands instalado"
echo "   → $DEST_DIR/"