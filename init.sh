#!/bin/bash
set -e

DEST_DIR="$HOME/.config/opencode"
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"
COMMANDS_SRC="$SRC_DIR/commands"
AGENT_SRC="$SRC_DIR/agent"
CONFIG_FILE="$DEST_DIR/opencode.json"
REPO_AGENTS="$SRC_DIR/config/opencode.agents.json"
OVERRIDES_FILE="$SRC_DIR/config/.model-overrides.json"
MODULES_DIR="$SRC_DIR/node_modules"
DIST_DIR="$SRC_DIR/dist"

if [ ! -d "$DIST_DIR" ]; then
    echo "⚠️  dist/ no encontrado. Ejecutá 'npm run build' antes de ./init.sh"
    exit 1
fi

echo "📦 Verificando dependencias..."
if [ ! -d "$MODULES_DIR" ]; then
    echo "   Instalando node_modules..."
    npm install --prefix "$SRC_DIR" --silent
fi

mkdir -p "$DEST_DIR"

echo "📁 Instalando commands..."
mkdir -p "$DEST_DIR/commands"
cp "$COMMANDS_SRC"/*.md "$DEST_DIR/commands/"
echo "   ✅ commands/ → $DEST_DIR/commands/"

echo "📁 Instalando agents..."
mkdir -p "$DEST_DIR/agent"
cp "$AGENT_SRC"/*.md "$DEST_DIR/agent/"
echo "   ✅ agent/ → $DEST_DIR/agent/"

if [ ! -f "$REPO_AGENTS" ]; then
    echo "⚠️  $REPO_AGENTS no encontrado — saltando integración de agentes"
    exit 0
fi

echo "⚙️  Seleccioná los modelos para cada agente..."
node "$DIST_DIR/configure.js"
if [ $? -ne 0 ]; then
    echo "⚠️  Configuración cancelada — no se modifyó opencode.json"
    exit 1
fi

echo "🔗 Integrando agentes en opencode.json..."
node "$DIST_DIR/merge.js" "$CONFIG_FILE" "$REPO_AGENTS" "$OVERRIDES_FILE"

echo ""
echo "✅ opencode-commands instalado"
echo ""
echo "   📁 commands/  → $DEST_DIR/commands/"
echo "   📁 agent/     → $DEST_DIR/agent/"
echo "   🔗 opencode.json actualizado"