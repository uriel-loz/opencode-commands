import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as p from "@clack/prompts";
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
async function confirmExit() {
    const result = await p.confirm({
        message: "¿Deseás salir?",
        initialValue: false,
    });
    if (p.isCancel(result)) {
        return true;
    }
    return result;
}
async function showMainMenu(agentNames, selections) {
    const menuChoices = agentNames.map((agent) => ({
        value: `agent:${agent}`,
        label: formatAgentLine(agent, selections[agent]),
    }));
    menuChoices.push({ value: "action:confirm", label: "Confirmar e instalar" });
    menuChoices.push({ value: "action:exit", label: "Salir sin guardar" });
    const choice = await p.select({
        message: "Seleccioná un agente para configurar",
        options: menuChoices,
    });
    if (p.isCancel(choice)) {
        return { action: "back" };
    }
    const choiceStr = choice;
    if (choiceStr.startsWith("action:")) {
        const action = choiceStr.replace("action:", "");
        return { action };
    }
    const agent = choiceStr.replace("agent:", "");
    return { action: "select", value: agent };
}
async function showProviderMenu(agent, catalog) {
    const providerChoices = Object.keys(catalog).map((provider) => ({
        value: `provider:${provider}`,
        label: provider,
    }));
    providerChoices.push({ value: "action:clear", label: "Limpiar selección" });
    const provider = await p.select({
        message: `Provider para "${agent}"`,
        options: providerChoices,
    });
    if (p.isCancel(provider)) {
        return { action: "back" };
    }
    const providerStr = provider;
    if (providerStr.startsWith("action:")) {
        const action = providerStr.replace("action:", "");
        return { action };
    }
    const providerName = providerStr.replace("provider:", "");
    return { action: "select", value: providerName };
}
async function showModelMenu(agent, provider, modelChoices) {
    const choices = modelChoices.map((model) => ({
        value: `model:${model}`,
        label: model,
    }));
    const model = await p.select({
        message: `Modelo para "${agent}" (provider: ${provider})`,
        options: choices,
    });
    if (p.isCancel(model)) {
        return { action: "back" };
    }
    const modelName = model.replace("model:", "");
    return { action: "select", value: modelName };
}
async function showReasoningMenu(agent, model, choices) {
    const modelChoices = choices.map((choice) => ({
        value: `reasoning:${choice}`,
        label: choice,
    }));
    const reasoning = await p.select({
        message: `Nivel de reasoning para "${agent}"`,
        options: modelChoices,
    });
    if (p.isCancel(reasoning)) {
        return { action: "back" };
    }
    const level = reasoning.replace("reasoning:", "");
    return { action: "select", value: level };
}
async function main() {
    p.intro("🔧 Configurador de modelos para opencode-commands");
    const catalog = buildModelCatalog();
    const providerNames = Object.keys(catalog);
    if (providerNames.length === 0) {
        p.log.warn("No se detectaron providers registrados en auth.json.");
        p.log.info("Ejecutá `opencode providers login` para autenticar un provider.");
        process.exit(1);
    }
    const agents = getAgents();
    const userConfig = getUserConfig();
    const agentNames = Object.keys(agents);
    if (agentNames.length === 0) {
        p.log.warn("No se encontraron agentes en config/opencode.agents.json");
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
    let exitConfirmed = false;
    while (!exitConfirmed) {
        const mainResult = await showMainMenu(agentNames, selections);
        if (mainResult.action === "back") {
            const shouldExit = await confirmExit();
            if (shouldExit) {
                exitConfirmed = true;
                break;
            }
            continue;
        }
        if (mainResult.action === "exit") {
            p.outro("👋 Operaciones canceladas. No se hizo ningún cambio.");
            process.exit(0);
        }
        if (mainResult.action === "confirm") {
            break;
        }
        if (mainResult.action === "select" && mainResult.value) {
            const selectedAgent = mainResult.value;
            let inSubmenu = true;
            while (inSubmenu) {
                const providerResult = await showProviderMenu(selectedAgent, catalog);
                if (providerResult.action === "back") {
                    break;
                }
                if (providerResult.action === "clear") {
                    selections[selectedAgent] =
                        agents[selectedAgent]?.model ?? userConfig.agent?.[selectedAgent]?.model ?? null;
                    reasoningSelections[selectedAgent] = null;
                    continue;
                }
                if (providerResult.action === "select" && providerResult.value) {
                    const provider = providerResult.value;
                    const availableModels = catalog[provider] ?? [];
                    const modelChoices = [...availableModels];
                    const currentForAgent = selections[selectedAgent];
                    if (currentForAgent && modelChoices.includes(currentForAgent)) {
                        modelChoices.unshift("▸ mantener actual");
                    }
                    else if (!currentForAgent) {
                        modelChoices.unshift("ninguno disponible");
                    }
                    let inModelMenu = true;
                    while (inModelMenu) {
                        const modelResult = await showModelMenu(selectedAgent, provider, modelChoices);
                        if (modelResult.action === "back") {
                            break;
                        }
                        if (modelResult.action === "select" && modelResult.value) {
                            const model = modelResult.value;
                            if (model === "▸ mantener actual") {
                                continue;
                            }
                            selections[selectedAgent] = model;
                            if (modelSupportsReasoning(model)) {
                                const reasoningChoices = getReasoningChoices(model);
                                const defaultLevel = reasoningSelections[selectedAgent] ?? "Medio";
                                const reasoningResult = await showReasoningMenu(selectedAgent, model, reasoningChoices);
                                if (reasoningResult.action === "back") {
                                    continue;
                                }
                                if (reasoningResult.action === "select" && reasoningResult.value) {
                                    reasoningSelections[selectedAgent] = reasoningResult.value;
                                }
                            }
                            else {
                                reasoningSelections[selectedAgent] = null;
                            }
                            inModelMenu = false;
                        }
                    }
                }
            }
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
    p.outro(`✅ Modelos guardados en config/.model-overrides.json (${Object.keys(selected).length}/${agentNames.length} agentes)`);
}
main().catch((err) => {
    p.log.error(`Error: ${err.message}`);
    process.exit(1);
});
