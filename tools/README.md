# tools/

## sync-from-sheet.js

Fetches the master activity list from a publicly shared Google Sheet (CSV export) and
regenerates `<province>/data/actividades.json`, applying a non-destructive merge so that
evidence links and notes written by the Apps Script backend are never overwritten by an
empty cell.

### Prerequisites

1. The Google Sheet must be shared as **"Anyone with the link — Viewer"**.
2. For Orellana: set `PROVINCE_GID.orellana` inside the script to the numeric tab GID
   (visible in the sheet URL as `?gid=<number>`), or pass `--gid` at runtime.

### Usage

```bash
# Sync Sucumbíos (uses default sheet ID and GID = 0)
node tools/sync-from-sheet.js --province sucumbios

# Sync Orellana with explicit sheet ID and tab GID
node tools/sync-from-sheet.js --province orellana --sheet-id 1IW0AxQ... --gid 123456789

# Preview changes without writing the file
node tools/sync-from-sheet.js --province sucumbios --dry-run

# Override sheet ID via environment variable
SHEET_ID=1IW0AxQ... node tools/sync-from-sheet.js --province sucumbios
```

### Merge strategy

For each activity matched by `id`:

- All fields in the CSV overwrite the existing JSON value.
- **Exception** — these fields are preserved from the existing JSON if the CSV cell is
  empty: `enlace_evidencia`, `notas_bloqueador`, `fecha_reporte`, `verificado_st`.
- Activities present in the JSON but absent from the CSV are kept as orphans (not deleted).
