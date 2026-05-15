import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Inquirer from "inquirer";

interface AuthEntry {
  type: string;
  key?: string;
  access?: string;
  refresh?: string;
}

interface AgentRepoConfig {
  description?: string;
  mode?: string;
  model?: string;
  permission?: Record<string, unknown>;
  temperature?: number;
  top_p?: number;
  steps?: number;
}

interface AgentsConfig {
  [agent: string]: AgentRepoConfig;
}

interface ModelOverrides {
  agent: {
    [agent: string]: {
      model: string;
    };
  };
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_PATH = path.join(process.env.HOME ?? "", ".local/share/opencode/auth.json");
const AGENTS_PATH = path.join(__dirname, "../config/opencode.agents.json");
const OVERRIDES_PATH = path.join(__dirname, "../config/.model-overrides.json");

function getRegisteredProviders(): string[] {
  try {
    const auth = JSON.parse(readFileSync(AUTH_PATH, "utf8")) as Record<string, AuthEntry>;
    return Object.keys(auth);
  } catch {
    return [];
  }
}

function getModelsForProvider(provider: string): string[] {
  try {
    const output = execSync(`opencode models ${provider}`, { encoding: "utf8" });
    return output
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && l.includes("/"));
  } catch {
    return [];
  }
}

function buildModelCatalog(): Record<string, string[]> {
  const providers = getRegisteredProviders();
  const catalog: Record<string, string[]> = {};
  for (const p of providers) {
    const models = getModelsForProvider(p);
    if (models.length > 0) {
      catalog[p] = models;
    }
  }
  return catalog;
}

function getAgents(): AgentsConfig {
  try {
    return JSON.parse(readFileSync(AGENTS_PATH, "utf8")) as AgentsConfig;
  } catch {
    return {};
  }
}

function formatAgentLine(agent: string, model: string | null): string {
  const label = agent.padEnd(12, " ");
  return `${label}  ${model ?? "sin seleccionar"}`;
}

async function main(): Promise<void> {
  console.log("\n🔧 Configurador de modelos para opencode-commands\n");

  const catalog = buildModelCatalog();
  const providerNames = Object.keys(catalog);
  if (providerNames.length === 0) {
    console.log("⚠️  No se detectaron providers registrados en auth.json.");
    console.log("   Ejecutá `opencode providers login` para autenticar un provider.");
    process.exit(1);
  }

  const agents = getAgents();
  const agentNames = Object.keys(agents);
  if (agentNames.length === 0) {
    console.log("⚠️  No se encontraron agentes en config/opencode.agents.json");
    process.exit(1);
  }

  const selections: Record<string, string | null> = {};
  for (const agent of agentNames) {
    selections[agent] = agents[agent]?.model ?? null;
  }

  while (true) {
    const menuChoices: string[] = agentNames.map((agent) =>
      formatAgentLine(agent, selections[agent])
    );
    menuChoices.push("Confirmar e instalar");
    menuChoices.push("Salir sin guardar");

    const { choice } = await Inquirer.prompt([
      {
        type: "list",
        name: "choice",
        message: "Seleccioná un agente para configurar",
        choices: menuChoices,
      },
    ]);

    if (choice === "Salir sin guardar") {
      console.log("\n👋 Operaciones canceladas. No se hizo ningún cambio.");
      process.exit(0);
    }

    if (choice === "Confirmar e instalar") {
      break;
    }

    const selectedAgent = agentNames.find((a) =>
      formatAgentLine(a, selections[a]) === choice
    );
    if (!selectedAgent) continue;

    const providerChoices = Object.keys(catalog);
    providerChoices.push("Limpiar selección");

    const { provider } = await Inquirer.prompt([
      {
        type: "list",
        name: "provider",
        message: `Provider para "${selectedAgent}"`,
        choices: providerChoices,
      },
    ]);

    if (provider === "Limpiar selección") {
      selections[selectedAgent] = agents[selectedAgent]?.model ?? null;
      continue;
    }

    const modelChoices: string[] = catalog[provider] ?? [];
    const currentForAgent = selections[selectedAgent];
    if (currentForAgent && modelChoices.includes(currentForAgent)) {
      modelChoices.unshift("▸ mantener actual");
    } else if (!currentForAgent) {
      modelChoices.unshift("ninguno disponible");
    }
    modelChoices.push("Volver al menú");

    const { model } = await Inquirer.prompt([
      {
        type: "list",
        name: "model",
        message: `Modelo para "${selectedAgent}" (provider: ${provider})`,
        choices: modelChoices,
      },
    ]);

    if (model === "Volver al menú" || model === "▸ mantener actual") {
      continue;
    }

    selections[selectedAgent] = model;
  }

  const selected = agentNames
    .filter((a) => selections[a] != null)
    .reduce<ModelOverrides["agent"]>((acc, agent) => {
      const m = selections[agent];
      if (m) acc[agent] = { model: m };
      return acc;
    }, {});

  const overrides: ModelOverrides = { agent: selected };
  writeFileSync(OVERRIDES_PATH, JSON.stringify(overrides, null, 2));

  console.log("\n✅ Modelos guardados en config/.model-overrides.json");
  console.log(
    `   ${Object.keys(selected).length}/${agentNames.length} agentes con modelo elegido\n`
  );
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});