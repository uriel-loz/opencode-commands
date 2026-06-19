#!/usr/bin/env node
import { existsSync, mkdirSync, cpSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const HOME = process.env.HOME ?? "";
const DEST_DIR = join(HOME, ".config/opencode");
const COMMANDS_SRC = join(ROOT, "commands");
const AGENT_SRC = join(ROOT, "agent");
const CONFIG_FILE = join(DEST_DIR, "opencode.json");
const REPO_AGENTS = join(ROOT, "config/opencode.agents.json");
const OVERRIDES_FILE = join(ROOT, "config/.model-overrides.json");
const MODULES_DIR = join(ROOT, "node_modules");
const DIST_DIR = join(ROOT, "dist");

const log = (emoji, msg) => console.log(`${emoji} ${msg}`);

if (!existsSync(DIST_DIR)) {
  console.log("⚠️  dist/ no encontrado. Ejecutá 'npm run build' antes de 'npm run start'");
  process.exit(1);
}

log("📦", "Verificando dependencias...");
if (!existsSync(MODULES_DIR)) {
  console.log("   Instalando node_modules...");
  execSync("npm install", { cwd: ROOT, stdio: "inherit" });
}

mkdirSync(DEST_DIR, { recursive: true });

const copyMarkdownDir = (src, dest, label) => {
  log("📁", `Instalando ${label}...`);
  mkdirSync(dest, { recursive: true });
  for (const file of readdirSync(src).filter((f) => f.endsWith(".md"))) {
    cpSync(join(src, file), join(dest, file));
  }
  console.log(`   ✅ ${label}/ → ${dest}/`);
};

copyMarkdownDir(COMMANDS_SRC, join(DEST_DIR, "commands"), "commands");
copyMarkdownDir(AGENT_SRC, join(DEST_DIR, "agent"), "agent");

if (!existsSync(REPO_AGENTS)) {
  console.log(`⚠️  ${REPO_AGENTS} no encontrado — saltando integración de agentes`);
  process.exit(0);
}

log("⚙️", "Seleccioná los modelos para cada agente...");
try {
  execSync(`node ${join(DIST_DIR, "configure.js")}`, { stdio: "inherit" });
} catch {
  console.log("⚠️  Configuración cancelada — no se modificó opencode.json");
  process.exit(1);
}

log("🔗", "Integrando agentes en opencode.json...");
execSync(
  `node ${join(DIST_DIR, "merge.js")} ${CONFIG_FILE} ${REPO_AGENTS} ${OVERRIDES_FILE}`,
  { stdio: "inherit" }
);

console.log("");
console.log("✅ opencode-commands instalado");
console.log("");
console.log(`   📁 commands/  → ${DEST_DIR}/commands/`);
console.log(`   📁 agent/     → ${DEST_DIR}/agent/`);
console.log(`   🔗 opencode.json actualizado`);
