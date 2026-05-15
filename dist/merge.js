import { readFileSync, writeFileSync } from "node:fs";
function mergeDeep(target, source) {
    Object.entries(source).forEach(([k, v]) => {
        if (v && typeof v === "object" && !Array.isArray(v)) {
            if (!target[k])
                target[k] = {};
            mergeDeep(target[k], v);
        }
        else {
            target[k] = v;
        }
    });
}
export function runMerge(configPath, repoAgentsPath, overridesPath) {
    const existsSync = (p) => {
        try {
            readFileSync(p);
            return true;
        }
        catch {
            return false;
        }
    };
    if (!existsSync(configPath)) {
        const schema = { $schema: "https://opencode.ai/config.json", agent: {} };
        writeFileSync(configPath, JSON.stringify(schema, null, 2));
        console.log("   ✅ Creado opencode.json con schema base");
    }
    const existing = JSON.parse(readFileSync(configPath, "utf8"));
    const repoAgents = JSON.parse(readFileSync(repoAgentsPath, "utf8"));
    const overrides = existsSync(overridesPath)
        ? JSON.parse(readFileSync(overridesPath, "utf8"))
        : { agent: {} };
    if (!existing.agent)
        existing.agent = {};
    const agentKeys = Object.keys(repoAgents);
    agentKeys.forEach((key) => {
        if (!existing.agent[key]) {
            existing.agent[key] = {};
        }
        if (key === "plan" || key === "build") {
            const perms = repoAgents[key]?.permission;
            if (perms) {
                if (!existing.agent[key])
                    existing.agent[key] = {};
                if (!(existing.agent[key].permission)) {
                    existing.agent[key].permission = {};
                }
                mergeDeep(existing.agent[key].permission, perms);
            }
        }
        else {
            Object.assign(existing.agent[key], repoAgents[key]);
        }
        if (overrides.agent?.[key]?.model) {
            existing.agent[key].model = overrides.agent[key].model;
        }
    });
    writeFileSync(configPath, JSON.stringify(existing, null, 2));
    console.log("   ✅ Agentes integrados: " + agentKeys.join(", "));
}
const [, , configPath, repoAgentsPath, overridesPath] = process.argv;
runMerge(configPath, repoAgentsPath, overridesPath);
