---
description: Analyze changed files and generate a git commit on the current branch with Conventional Commits
---

# Git Commit

Genera y ejecuta un commit siguiendo Conventional Commits. Sigue estos pasos en orden.

## Paso 1 — Inspeccionar el estado actual

```bash
git status
git diff --cached --stat
```

Con esto determina:
- Si hay cambios staged → commitear solo eso
- Si no hay nada staged → correr `git add -A` primero
- Si no hay cambios → decirle al usuario y detenerse
- Si hay conflictos de merge → advertir y abortar
- Si HEAD está detached → advertir antes de continuar

⚠️ Si detectas archivos `.env`, `*.key`, `*.pem`, o similares entre los staged, **advierte al usuario antes de continuar**.

## Paso 2 — Elegir el tipo de commit

| Tipo | Cuándo usarlo |
|------|---------------|
| `feat` | Nueva funcionalidad, endpoint, componente, o comportamiento |
| `fix` | Bug corregido, valor incorrecto, lógica rota reparada |
| `refactor` | Código reestructurado sin cambiar comportamiento |
| `chore` | Config, CI/CD, scripts, tooling, Docker |
| `build` | Build system, dependencias externas (`package.json`, `composer.json`, `Makefile`) |
| `docs` | README, comentarios, docblocks, documentación |
| `style` | Espacios, formato, indentación — sin cambio de lógica |
| `test` | Tests añadidos, actualizados o corregidos |
| `perf` | Optimización de queries, caché, algoritmos |

## Paso 3 — Determinar el scope

Usa el **nombre del módulo más cercano** según las rutas afectadas:

- `app/Http/Controllers/InvoiceController.php` → `invoices`
- `app/Services/AuthService.php` → `auth`
- `database/migrations/` → `migrations`
- `docker-compose.yml` / `Dockerfile` → `docker`
- `angular/src/app/modules/orders/` → `orders`
- Múltiples módulos no relacionados → omitir scope

## Paso 4 — Escribir el mensaje

**Subject line:**
- Modo imperativo: `add`, `fix`, `update`, `remove`, `extract`, `rename`
- Máximo 72 caracteres
- Sin punto al final
- Sin mayúscula después de los dos puntos

**Body (solo si hay 3+ cambios significativos):**

```
feat(invoices): add PDF export functionality

- Add InvoiceService with PDF generation via DomPDF
- Update InvoiceController to handle export endpoint
- Add export button to invoice detail view
```

**Casos especiales:**
- Más de 20 archivos → agrupar por directorio en los bullets
- Solo archivos binarios → usar tipo `chore`, mencionar los archivos en el body
- Commit temporal/WIP → usar prefijo `wip:` y agregar `--no-verify` si hay hooks

## Paso 5 — Ejecutar

```bash
git commit -m "<mensaje>"
```

Luego intentar push:

```bash
git push origin <rama-actual>
```

## Paso 6 — Mostrar resultado

```
✅ Commit realizado en rama: <branch>

📁 Archivos commiteados:
  - path/to/file.php
  - path/to/another.ts

📝 Mensaje:
  <mensaje completo>

🔖 Commit: <hash corto>
🚀 Push:   origin/<branch> ✓
```

Si el push falla:

```
🚀 Push:   origin/<branch> ✗
⚠️  Error: <mensaje de error>
💡 Siguiente paso sugerido: <pull/rebase/etc.>
```

No hacer force push bajo ninguna circunstancia.