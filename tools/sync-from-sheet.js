#!/usr/bin/env node
/**
 * sync-from-sheet.js
 * Regenerates actividades.json for a given province from a Google Sheets public CSV export.
 * Merge strategy is non-destructive: evidence fields written by Apps Script are preserved
 * if the corresponding CSV cell is empty.
 *
 * Usage:
 *   node tools/sync-from-sheet.js --province sucumbios [--sheet-id ID] [--gid GID] [--dry-run]
 *   node tools/sync-from-sheet.js --province orellana  [--sheet-id ID] [--gid GID] [--dry-run]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_SHEET_ID = '1IW0AxQ9y4R1G9JVejjkyHb8oX7Cad-HS8bNGVLVJ0uM';

// GID = the numeric tab ID in the URL (?gid=...)
const PROVINCE_GID = {
  sucumbios: 0,
  orellana: null, // TODO: set this to the Orellana sheet tab GID once the tab exists
};

// Fields that the Apps Script backend writes and that should NOT be overwritten
// by an empty CSV cell (non-destructive merge).
const PRESERVE_IF_BLANK = new Set([
  'enlace_evidencia',
  'notas_bloqueador',
  'fecha_reporte',
  'verificado_st',
]);

// All columns the sheet is expected to export (order in sheet may vary).
// Keys are the lowercase-trimmed header as it appears in the CSV first row.
// Values are the JSON field names (they happen to be identical here).
const COLUMN_MAP = {
  id: 'id',
  provincia: 'provincia',
  trimestre: 'trimestre',
  fecha_inicio: 'fecha_inicio',
  fecha_limite: 'fecha_limite',
  hito_operativo: 'hito_operativo',
  que_se_hace: 'que_se_hace',
  producto_verificable: 'producto_verificable',
  evidencia_minima: 'evidencia_minima',
  lidera_apoya: 'lidera_apoya',
  tipo: 'tipo',
  ambito: 'ambito',
  estado: 'estado',
  porcentaje: 'porcentaje',            // parsed → number
  fecha_reporte: 'fecha_reporte',
  verificado_st: 'verificado_st',
  enlace_evidencia: 'enlace_evidencia',
  notas_bloqueador: 'notas_bloqueador',
  urgente: 'urgente',                  // parsed → boolean
  actores_normalizados: 'actores_normalizados', // parsed → array
  submesa: 'submesa',                  // optional; inferSubmesa handles it at runtime
};

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg.startsWith('--')) {
      const key = arg.slice(2);
      args[key] = argv[i + 1] ?? true;
      if (argv[i + 1] && !argv[i + 1].startsWith('--')) i++;
    }
  }
  return args;
}

function usage() {
  console.error(
    'Usage: node tools/sync-from-sheet.js --province <sucumbios|orellana> ' +
    '[--sheet-id SHEET_ID] [--gid GID] [--dry-run]'
  );
}

// ---------------------------------------------------------------------------
// CSV fetch
// ---------------------------------------------------------------------------

async function fetchCSV(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new FetchError(response.status, url);
  }
  const contentType = response.headers.get('content-type') || '';
  // Google returns text/csv for valid public sheets; HTML means a login wall
  if (contentType.includes('text/html')) {
    throw new AccessError();
  }
  const buffer = await response.arrayBuffer();
  // Strip UTF-8 BOM if present
  const bytes = new Uint8Array(buffer);
  const hasBOM = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  const text = new TextDecoder('utf-8').decode(hasBOM ? bytes.slice(3) : bytes);
  return text;
}

class FetchError extends Error {
  constructor(status, url) {
    super(`HTTP ${status} al descargar: ${url}`);
    this.status = status;
  }
}

class AccessError extends Error {
  constructor() {
    super(
      'El Sheet no está compartido públicamente. ' +
      "Compartir con 'Cualquier persona con el enlace puede ver'."
    );
  }
}

// ---------------------------------------------------------------------------
// CSV parser (handles quoted fields, embedded commas, embedded newlines)
// ---------------------------------------------------------------------------

function parseCSV(text) {
  const rows = [];
  let col = '';
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        // Escaped quote inside a quoted field
        col += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        col += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(col);
        col = '';
      } else if (ch === '\r' && next === '\n') {
        row.push(col);
        col = '';
        rows.push(row);
        row = [];
        i++; // skip \n
      } else if (ch === '\n') {
        row.push(col);
        col = '';
        rows.push(row);
        row = [];
      } else {
        col += ch;
      }
    }
  }
  // Flush last row if file doesn't end with newline
  if (col !== '' || row.length > 0) {
    row.push(col);
    rows.push(row);
  }
  // Drop trailing empty rows
  while (rows.length && rows[rows.length - 1].every(c => c === '')) {
    rows.pop();
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Row → activity object
// ---------------------------------------------------------------------------

function buildHeaderIndex(headerRow) {
  const index = {};
  headerRow.forEach((h, i) => {
    const key = h.toString().toLowerCase().trim();
    if (COLUMN_MAP[key] !== undefined) {
      index[COLUMN_MAP[key]] = i;
    }
  });
  return index;
}

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  const s = String(value).trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes' || s === 'sí' || s === 'si';
}

function parseArray(value) {
  if (Array.isArray(value)) return value;
  const s = String(value || '').trim();
  if (!s) return [];
  return s.split(';').map(v => v.trim()).filter(Boolean);
}

function parseNumber(value) {
  const n = Number(value);
  return isNaN(n) ? 0 : n;
}

function rowToActivity(row, headerIndex) {
  const get = (field) => {
    const idx = headerIndex[field];
    return idx !== undefined ? (row[idx] ?? '') : '';
  };

  return {
    id: get('id').trim(),
    provincia: get('provincia'),
    trimestre: get('trimestre'),
    fecha_inicio: get('fecha_inicio'),
    fecha_limite: get('fecha_limite'),
    hito_operativo: get('hito_operativo'),
    que_se_hace: get('que_se_hace'),
    producto_verificable: get('producto_verificable'),
    evidencia_minima: get('evidencia_minima'),
    lidera_apoya: get('lidera_apoya'),
    tipo: get('tipo'),
    ambito: get('ambito'),
    estado: get('estado'),
    porcentaje: parseNumber(get('porcentaje')),
    fecha_reporte: get('fecha_reporte'),
    verificado_st: get('verificado_st'),
    enlace_evidencia: get('enlace_evidencia'),
    notas_bloqueador: get('notas_bloqueador'),
    urgente: parseBoolean(get('urgente')),
    actores_normalizados: parseArray(get('actores_normalizados')),
    ...(headerIndex['submesa'] !== undefined
      ? { submesa: get('submesa') }
      : {}),
  };
}

// ---------------------------------------------------------------------------
// Merge logic
// ---------------------------------------------------------------------------

function mergeActivities(csvActivities, existingActivities) {
  const existingMap = new Map(existingActivities.map(a => [a.id, a]));
  const csvIds = new Set();
  const merged = [];
  const changes = [];

  for (const csvAct of csvActivities) {
    csvIds.add(csvAct.id);
    const existing = existingMap.get(csvAct.id);

    if (!existing) {
      merged.push(csvAct);
      changes.push({ type: 'new', id: csvAct.id });
      continue;
    }

    // Merge: start with CSV values, then preserve existing values for
    // PRESERVE_IF_BLANK fields where the CSV cell is empty.
    const mergedAct = { ...csvAct };
    for (const field of PRESERVE_IF_BLANK) {
      const csvVal = csvAct[field];
      const existingVal = existing[field];
      if ((csvVal === '' || csvVal === null || csvVal === undefined) &&
          existingVal !== '' && existingVal !== null && existingVal !== undefined) {
        mergedAct[field] = existingVal;
      }
    }

    // Detect changed fields (excluding the preserved ones from noise)
    const changedFields = [];
    for (const key of Object.keys(mergedAct)) {
      const csvVal = JSON.stringify(csvAct[key]);
      const exVal = JSON.stringify(existing[key]);
      if (csvVal !== exVal) {
        changedFields.push({ field: key, from: existing[key], to: csvAct[key] });
      }
    }

    if (changedFields.length > 0) {
      changes.push({ type: 'updated', id: csvAct.id, fields: changedFields });
    }

    merged.push(mergedAct);
  }

  // Orphaned: activities in existing JSON not found in CSV
  const orphaned = [];
  for (const act of existingActivities) {
    if (!csvIds.has(act.id)) {
      orphaned.push(act);
      changes.push({ type: 'orphan', id: act.id });
    }
  }

  return { merged: [...merged, ...orphaned], changes };
}

// ---------------------------------------------------------------------------
// Diff summary printer
// ---------------------------------------------------------------------------

function formatValue(v) {
  if (Array.isArray(v)) return `[${v.join(', ')}]`;
  if (v === '' || v === null || v === undefined) return '(vacío)';
  return String(v);
}

function printDiff(changes, csvCount, sheetUrl, province, dryRun) {
  const newCount = changes.filter(c => c.type === 'new').length;
  const updatedChanges = changes.filter(c => c.type === 'updated');
  const orphanCount = changes.filter(c => c.type === 'orphan').length;
  const unchangedCount = csvCount - newCount - updatedChanges.length;

  const provinceLabel = province === 'sucumbios' ? 'Sucumbíos' : 'Orellana';

  console.log(`\nProvincia: ${provinceLabel}`);
  console.log(`Sheet: ${sheetUrl}`);
  console.log(`Descargados: ${csvCount} filas del CSV\n`);
  console.log('Cambios:');
  console.log(`  ✓ ${unchangedCount} actividades sin cambios`);
  console.log(`  ~ ${updatedChanges.length} actividades actualizadas`);
  console.log(`  + ${newCount} actividades nuevas`);
  console.log(`  ? ${orphanCount} actividades en JSON pero no en Sheet (huérfanas)\n`);

  if (updatedChanges.length > 0) {
    console.log('Resumen de campos actualizados:');
    for (const change of updatedChanges) {
      for (const { field, from, to } of change.fields) {
        console.log(`  ${field}: ${change.id} (${formatValue(from)} → ${formatValue(to)})`);
      }
    }
    console.log('');
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv);

  // Resolve province
  const province = (args.province || '').toLowerCase();
  if (province !== 'sucumbios' && province !== 'orellana') {
    usage();
    console.error('\nError: --province debe ser "sucumbios" o "orellana".');
    process.exit(1);
  }

  // Resolve sheet ID
  const sheetId = args['sheet-id'] || process.env.SHEET_ID || DEFAULT_SHEET_ID;

  // Resolve GID
  let gid = args.gid !== undefined ? Number(args.gid) : PROVINCE_GID[province];
  if (gid === null) {
    console.error(
      `Error: El GID de la pestaña de Orellana no está configurado.\n` +
      `Edita PROVINCE_GID.orellana en tools/sync-from-sheet.js o pasa --gid <número>.`
    );
    process.exit(1);
  }

  const dryRun = Boolean(args['dry-run'] || args.dryRun);

  const sheetUrl =
    `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;

  // Resolve output path (relative to project root, which is __dirname/..)
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = path.resolve(__dirname, '..');
  const outputPath = path.join(projectRoot, province, 'data', 'actividades.json');

  // Fetch CSV
  let csvText;
  try {
    csvText = await fetchCSV(sheetUrl);
  } catch (err) {
    if (err instanceof AccessError) {
      console.error(`\nError de acceso: ${err.message}`);
    } else if (err instanceof FetchError) {
      console.error(`\nError HTTP ${err.status}: ${err.message}`);
    } else {
      console.error(`\nError inesperado al descargar el Sheet: ${err.message}`);
    }
    process.exit(1);
  }

  // Parse CSV
  const rows = parseCSV(csvText);
  if (rows.length < 2) {
    console.warn('Advertencia: el CSV no contiene filas de datos. No se escribe nada.');
    process.exit(0);
  }

  const [headerRow, ...dataRows] = rows;
  const headerIndex = buildHeaderIndex(headerRow);

  if (!headerIndex['id']) {
    console.error(
      'Error: No se encontró la columna "id" en el CSV. ' +
      'Verifica que el Sheet tenga encabezados en la primera fila.'
    );
    process.exit(1);
  }

  // Filter out rows with no id (blank rows in the sheet)
  const csvActivities = dataRows
    .map(row => rowToActivity(row, headerIndex))
    .filter(a => a.id.trim() !== '');

  if (csvActivities.length === 0) {
    console.warn('Advertencia: el CSV no contiene actividades con ID. No se escribe nada.');
    process.exit(0);
  }

  // Load existing JSON (may not exist yet)
  let existingActivities = [];
  if (fs.existsSync(outputPath)) {
    try {
      existingActivities = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
    } catch (err) {
      console.warn(`Advertencia: no se pudo leer ${outputPath}: ${err.message}`);
    }
  }

  // Merge
  const { merged, changes } = mergeActivities(csvActivities, existingActivities);

  // Print diff
  printDiff(changes, csvActivities.length, sheetUrl, province, dryRun);

  if (dryRun) {
    console.log('Dry run — archivo no escrito.');
    return;
  }

  // Write
  console.log(`Escribiendo en ${outputPath}...`);
  fs.writeFileSync(outputPath, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
  console.log('Listo.');
}

main().catch(err => {
  console.error(`Error fatal: ${err.message}`);
  process.exit(1);
});
