import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Inquirer from "inquirer";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_PATH = path.join(process.env.HOME ?? "", ".local/share/opencode/auth.json");
const AGENTS_PATH = path.join(__dirname, "../config/opencode.agents.json");
const OVERRIDES_PATH = path.join(__dirname, "../config/.model-overrides.json");
const USER_CONFIG_PATH = path.join(process.env.HOME ?? "", ".config/opencode/opencode.json");
function getRegisteredProviders() {
    try {
        const auth = JSON.parse(readFileSync(AUTH_PATH, "utf8"));
        return Object.keys(auth);
    }
    catch {
        return [];
    }
}
function getModelsForProvider(provider) {
    try {
        const output = execSync(`opencode models ${provider}`, { encoding: "utf8" });
        return output
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l.length > 0 && l.includes("/"));
    }
    catch {
        return [];
    }
}
function buildModelCatalog() {
    const providers = getRegisteredProviders();
    const catalog = {};
    for (const p of providers) {
        const models = getModelsForProvider(p);
        if (models.length > 0) {
            catalog[p] = models;
        }
    }
    return catalog;
}
function getAgents() {
    try {
        return JSON.parse(readFileSync(AGENTS_PATH, "utf8"));
    }
    catch {
        return {};
    }
}
function getUserConfig() {
    try {
        return JSON.parse(readFileSync(USER_CONFIG_PATH, "utf8"));
    }
    catch {
        return {};
    }
}
function getProvider(model) {
    if (model.startsWith("openai/") || model.startsWith("github-copilot/"))
        return "openai";
    if (model.startsWith("anthropic/"))
        return "anthropic";
    if (model.includes("gemini"))
        return "gemini";
    return null;
}
function modelSupportsReasoning(model) {
    return getProvider(model) !== null;
}
function getReasoningChoices(model) {
    if (getProvider(model) === "gemini") {
        return ["Sin reasoning", "Bajo", "Alto"];
    }
    return ["Sin reasoning", "Bajo", "Medio", "Alto"];
}
function mapReasoningLevel(level, model) {
    if (level === "Sin reasoning")
        return null;
    const provider = getProvider(model);
    if (!provider)
        return null;
    if (provider === "openai") {
        const effortMap = { Bajo: "low", Medio: "medium", Alto: "high" };
        return { reasoningEffort: effortMap[level] };
    }
    if (provider === "anthropic") {
        const budgetMap = { Bajo: 1024, Medio: 4096, Alto: 16000 };
        return {
            thinking: { type: "enabled", budgetTokens: budgetMap[level] },
        };
    }
    if (provider === "gemini") {
        const budgetMap = { Bajo: 1024, Alto: 16000 };
        return { thinkingConfig: { thinkingBudget: budgetMap[level] } };
    }
    return null;
}
function detectExistingReasoning(model, agentConfig) {
    if (!agentConfig)
        return null;
    const provider = getProvider(model);
    if (!provider)
        return null;
    if (provider === "openai") {
        const effort = agentConfig.reasoningEffort;
        if (effort === "low")
            return "Bajo";
        if (effort === "medium")
            return "Medio";
        if (effort === "high")
            return "Alto";
        return null;
    }
    if (provider === "anthropic") {
        const thinking = agentConfig.thinking;
        if (thinking?.budgetTokens && thinking.budgetTokens <= 2048)
            return "Bajo";
        if (thinking?.budgetTokens && thinking.budgetTokens <= 8192)
            return "Medio";
        if (thinking?.budgetTokens)
            return "Alto";
        return null;
    }
    if (provider === "gemini") {
        const thinkingConfig = agentConfig.thinkingConfig;
        if (thinkingConfig?.thinkingBudget && thinkingConfig.thinkingBudget <= 2048)
            return "Bajo";
        if (thinkingConfig?.thinkingBudget)
            return "Alto";
        return null;
    }
    return null;
}
function formatAgentLine(agent, model) {
    const label = agent.padEnd(12, " ");
    return `${label}  ${model ?? "sin seleccionar"}`;
}
async function main() {
    console.log("\n🔧 Configurador de modelos para opencode-commands\n");
    const catalog = buildModelCatalog();
    const providerNames = Object.keys(catalog);
    if (providerNames.length === 0) {
        console.log("⚠️  No se detectaron providers registrados en auth.json.");
        console.log("   Ejecutá `opencode providers login` para autenticar un provider.");
        process.exit(1);
    }
    const agents = getAgents();
    const userConfig = getUserConfig();
    const agentNames = Object.keys(agents);
    if (agentNames.length === 0) {
        console.log("⚠️  No se encontraron agentes en config/opencode.agents.json");
        process.exit(1);
    }
    const selections = {};
    const reasoningSelections = {};
    for (const agent of agentNames) {
        const model = agents[agent]?.model ?? userConfig.agent?.[agent]?.model ?? null;
        selections[agent] = model;
        if (model && modelSupportsReasoning(model)) {
            reasoningSelections[agent] = detectExistingReasoning(model, userConfig.agent?.[agent]);
        }
    }
    while (true) {
        const menuChoices = agentNames.map((agent) => formatAgentLine(agent, selections[agent]));
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
        const selectedAgent = agentNames.find((a) => formatAgentLine(a, selections[a]) === choice);
        if (!selectedAgent)
            continue;
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
            selections[selectedAgent] =
                agents[selectedAgent]?.model ?? userConfig.agent?.[selectedAgent]?.model ?? null;
            reasoningSelections[selectedAgent] = null;
            continue;
        }
        const modelChoices = catalog[provider] ?? [];
        const currentForAgent = selections[selectedAgent];
        if (currentForAgent && modelChoices.includes(currentForAgent)) {
            modelChoices.unshift("▸ mantener actual");
        }
        else if (!currentForAgent) {
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
        if (modelSupportsReasoning(model)) {
            const choices = getReasoningChoices(model);
            if (reasoningSelections[selectedAgent]) {
                choices.unshift("▸ mantener actual");
            }
            const defaultLevel = reasoningSelections[selectedAgent] ?? "Medio";
            const { reasoning } = await Inquirer.prompt([
                {
                    type: "list",
                    name: "reasoning",
                    message: `Nivel de reasoning para "${selectedAgent}"`,
                    choices: choices.filter((c) => c !== "▸ mantener actual" || reasoningSelections[selectedAgent]),
                    default: defaultLevel,
                },
            ]);
            if (reasoning !== "▸ mantener actual") {
                reasoningSelections[selectedAgent] = reasoning;
            }
        }
        else {
            reasoningSelections[selectedAgent] = null;
        }
    }
    const selected = agentNames
        .filter((a) => selections[a] != null)
        .reduce((acc, agent) => {
        const m = selections[agent];
        if (!m)
            return acc;
        const entry = { model: m };
        const level = reasoningSelections[agent];
        if (level) {
            const mapped = mapReasoningLevel(level, m);
            if (mapped)
                entry.reasoning = mapped;
        }
        acc[agent] = entry;
        return acc;
    }, {});
    const overrides = { agent: selected };
    writeFileSync(OVERRIDES_PATH, JSON.stringify(overrides, null, 2));
    console.log("\n✅ Modelos guardados en config/.model-overrides.json");
    console.log(`   ${Object.keys(selected).length}/${agentNames.length} agentes con modelo elegido\n`);
}
main().catch((err) => {
    console.error("Error:", err.message);
    process.exit(1);
});
