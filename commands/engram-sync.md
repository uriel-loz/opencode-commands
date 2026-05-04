# Engram Sync

Exporta las memorias de Engram y las guarda en git. Sigue estos pasos en orden.

## Paso 1 — Exportar memorias

```bash
engram sync
```

## Paso 2 — Commitear cambios

```bash
git add .engram/ && git commit -m "sync: engram memories"
```

Si no hay cambios nuevos en `.engram/`, git devolverá "nothing to commit" — informar al usuario y detenerse sin error.

## Paso 3 — Mostrar resultado

```
✅ Engram sync completado

📁 Memorias exportadas a: .engram/
🔖 Commit: <hash corto>
```

Si no hubo cambios:

```
ℹ️  Sin cambios en .engram/ — nada que commitear
```