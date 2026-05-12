#!/bin/bash
set -e

DEST_DIR="$HOME/.config/opencode"
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"
COMMANDS_SRC="$SRC_DIR/commands"
AGENT_SRC="$SRC_DIR/agent"
CONFIG_FILE="$DEST_DIR/opencode.json"
REPO_AGENTS="$SRC_DIR/config/opencode.agents.json"

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

echo "🔗 Integrando agentes en opencode.json..."

MERGE_SCRIPT=$(cat <<'EOF'
const fs = require("fs");
const path = require("path");

const configPath = process.argv[1];
const repoAgentsPath = process.argv[2];

if (!fs.existsSync(configPath)) {
    const schema = { "$schema": "https://opencode.ai/config.json", "agent": {} };
    fs.writeFileSync(configPath, JSON.stringify(schema, null, 2));
    console.log("   ✅ Creado opencode.json con schema base");
}

const existing = JSON.parse(fs.readFileSync(configPath, "utf8"));
const repoAgents = JSON.parse(fs.readFileSync(repoAgentsPath, "utf8"));

if (!existing.agent) existing.agent = {};

const mergeDeep = (target, source) => {
    Object.entries(source).forEach(([k, v]) => {
        if (v && typeof v === 'object' && !Array.isArray(v)) {
            if (!target[k]) target[k] = {};
            mergeDeep(target[k], v);
        } else {
            target[k] = v;
        }
    });
};

const agentKeys = Object.keys(repoAgents);
agentKeys.forEach(key => {
    if (!existing.agent[key]) {
        existing.agent[key] = {};
    }
    if (key === 'plan' || key === 'build') {
        if (repoAgents[key].permission) {
            if (!existing.agent[key].permission) existing.agent[key].permission = {};
            mergeDeep(existing.agent[key].permission, repoAgents[key].permission);
        }
    } else {
        Object.assign(existing.agent[key], repoAgents[key]);
    }
});

fs.writeFileSync(configPath, JSON.stringify(existing, null, 2));
console.log("   ✅ Agentes integrados: " + agentKeys.join(", "));
EOF
)

node -e "$MERGE_SCRIPT" "$CONFIG_FILE" "$REPO_AGENTS"

echo ""
echo "✅ opencode-commands instalado"
echo ""
echo "   📁 commands/  → $DEST_DIR/commands/"
echo "   📁 agent/     → $DEST_DIR/agent/"
echo "   🔗 opencode.json actualizado"
