import { readFileSync, writeFileSync } from "node:fs";

interface AgentRepoConfig {
  description?: string;
  mode?: string;
  model?: string;
  permission?: Record<string, unknown>;
  temperature?: number;
  top_p?: number;
  steps?: number;
}

interface AgentsRepoConfig {
  [agent: string]: AgentRepoConfig;
}

interface ModelOverrides {
  agent: {
    [agent: string]: {
      model: string;
      reasoning?: Record<string, unknown>;
    };
  };
}

interface OpenCodeConfig {
  $schema?: string;
  agent?: {
    [agent: string]: unknown;
  };
}

function mergeDeep(target: Record<string, unknown>, source: Record<string, unknown>): void {
  Object.entries(source).forEach(([k, v]) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      if (!target[k]) target[k] = {} as Record<string, unknown>;
      mergeDeep(target[k] as Record<string, unknown>, v as Record<string, unknown>);
    } else {
      target[k] = v;
    }
  });
}

export function runMerge(
  configPath: string,
  repoAgentsPath: string,
  overridesPath: string
): void {
  const existsSync = (p: string): boolean => {
    try {
      readFileSync(p);
      return true;
    } catch {
      return false;
    }
  };

  if (!existsSync(configPath)) {
    const schema: OpenCodeConfig = { $schema: "https://opencode.ai/config.json", agent: {} };
    writeFileSync(configPath, JSON.stringify(schema, null, 2));
    console.log("   ✅ Creado opencode.json con schema base");
  }

  const existing = JSON.parse(readFileSync(configPath, "utf8")) as OpenCodeConfig;
  const repoAgents = JSON.parse(readFileSync(repoAgentsPath, "utf8")) as AgentsRepoConfig;
  const overrides = existsSync(overridesPath)
    ? (JSON.parse(readFileSync(overridesPath, "utf8")) as ModelOverrides)
    : { agent: {} };

  if (!existing.agent) existing.agent = {};

  const agentKeys = Object.keys(repoAgents);
  agentKeys.forEach((key) => {
    if (!existing.agent![key]) {
      existing.agent![key] = {};
    }
    if (key === "plan" || key === "build") {
      const perms = repoAgents[key]?.permission;
      if (perms) {
        if (!existing.agent![key]) existing.agent![key] = {};
        if (!((existing.agent![key] as Record<string, unknown>).permission)) {
          (existing.agent![key] as Record<string, unknown>).permission = {};
        }
        mergeDeep(
          (existing.agent![key] as Record<string, unknown>).permission as Record<string, unknown>,
          perms as Record<string, unknown>
        );
      }
    } else {
      Object.assign(existing.agent![key] as unknown as object, repoAgents[key]);
    }
    if (overrides.agent?.[key]?.model) {
      (existing.agent![key] as AgentRepoConfig).model = overrides.agent[key].model;
    }
    if (overrides.agent?.[key]?.reasoning) {
      Object.assign(
        existing.agent![key] as Record<string, unknown>,
        overrides.agent[key].reasoning as Record<string, unknown>
      );
    }
  });

  writeFileSync(configPath, JSON.stringify(existing, null, 2));
  console.log("   ✅ Agentes integrados: " + agentKeys.join(", "));
}

const [, , configPath, repoAgentsPath, overridesPath] = process.argv;
runMerge(configPath, repoAgentsPath, overridesPath);