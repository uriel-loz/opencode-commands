# opencode-commands

Command prompts para opencode agents.

## Contenido

| Path | Descripción |
|------|-------------|
| `commands/` | Prompts operativos para ejecutar tareas específicas |
| `agent/` | Definiciones de subagentes para OpenCode |
| `config/opencode.agents.json` | Configuración de agentes a integrar |

### commands/

| Comando | Descripción |
|---------|-------------|
| `git-commit.md` | Genera y ejecuta commits siguiendo Conventional Commits |
| `engram-import.md` | Importa memorias de Engram |
| `engram-sync.md` | Exporta memorias de Engram a git |

### agent/

| Subagente | Descripción |
|-----------|-------------|
| `apply.md` | Aplica cambios de proposals previamente revisados |
| `review.md` | Revisa planes y proposals antes de implementar |
| `task.md` | Convierte análisis en listas de tareas estructuradas |
| `verify.md` | Verifica que el código coincida con el proposal |

## Instalación

```bash
./init.sh
```

Esto hace:

1. Copia `commands/*.md` → `~/.config/opencode/commands/`
2. Copia `agent/*.md` → `~/.config/opencode/agent/`
3. Integra los subagentes en `~/.config/opencode/opencode.json`
   - Solo reemplaza/agrega los agentes del repo
   - Preserva intacto todo el resto de la configuración existente

## Requisitos

- `node` disponible en PATH (necesario para el merge de JSON)
- Un `opencode.json` existente en `~/.config/opencode/`
  - Si no existe, se crea uno base con schema
  - Si ya existe, se preserva todo su contenido y solo se agregan los agentes del repo
