# opencode-commands

Command prompts para opencode agents.

## Contenido

| Path | Descripción |
|------|-------------|
| `commands/` | Prompts operativos para ejecutar tareas específicas |
| `agent/` | Definiciones de subagentes para OpenCode |
| `config/opencode.agents.json` | Configuración de agentes a integrar |
| `src/` | Código TypeScript fuente |
| `dist/` | JavaScript compilado (versionado) |

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
| `explore` | Configuración de agente de exploración de codebase |
| `general` | Configuración de agente general-purpose |

## Instalación

```bash
npm run build   # solo la primera vez o tras cambiar src/
./init.sh      # seleccionar modelos e integrar agentes
```

Esto hace:

1. **Verifica que `dist/` exista** — si no existe, aborta con instrucciones
2. Instala `node_modules/` si no existen
3. Copia `commands/*.md` → `~/.config/opencode/commands/`
4. Copia `agent/*.md` → `~/.config/opencode/agent/`
5. **Pregunta interactivamente** qué modelo usar para cada agente, usando los providers registrados en `opencode` y los modelos disponibles
6. Integra los subagentes en `~/.config/opencode/opencode.json`
   - Solo reemplaza/agrega los agentes del repo
   - Preserva intacto todo el resto de la configuración existente

### Flujo interactivo de selección de modelos

Al ejecutar `./init.sh`, `dist/configure.js`:
1. Lee los providers autenticados desde `~/.local/share/opencode/auth.json`
2. Consulta los modelos disponibles para cada provider via `opencode models <provider>`
3. Pregunta agente por agente qué modelo asignar (con opción de mantener el actual del repo)
4. Guarda los elegidos en `config/.model-overrides.json` para aplicar al merge

## Configuracion de skills y bash para `plan` y `build`

Por defecto, los agentes `plan` y `build` pueden cargar cualquier skill. Si instalaste skills SDD (como `sdd-verify`, `sdd-tasks`, etc.), estas pueden activarse automaticamente cuando el agente menciona temas relacionados con "verificar" o "tareas".

Este repo incluye una configuracion que bloquea las skills `sdd-*` para ambos agentes, permitiendo que uses `@task`, `@verify`, `@apply` y `@review` sin conflicto:

```json
"agent": {
  "plan": {
    "permission": {
      "skill": {
        "*": "allow",
        "sdd-*": "deny"
      }
    }
  },
  "build": {
    "permission": {
      "skill": {
        "*": "allow",
        "sdd-*": "deny"
      },
      "bash": {
        "*": "ask",
        "git status*": "allow",
        "git log*": "allow",
        "git diff*": "allow",
        "git add*": "allow",
        "git commit*": "deny",
        "git push*": "deny"
      }
    }
  }
}
```

Para `build`, ademas se restringen comandos de git que modifican el repo:
- `git commit` y `git push` requieren aprobacion explícita (`ask`)
- `git status`, `git log`, `git diff`, `git add` funcionan automaticamente

Esto se integra automaticamente al ejecutar `init.sh` para `plan` y `build`.

Si queres permitir una skill SDD especifica en `plan`, podes cambiarla a `"allow"` despues de la instalacion.

## Requisitos

- `node` y `npm` disponibles en PATH
- `opencode` autenticado con al menos un provider (`opencode providers list` para verificar)
- tras modificar `src/`, ejecutar `npm run build` y commitear `dist/` junto con los cambios en `src/`
