export function daysBetween(from, to) {
  const ms = new Date(to).setHours(0,0,0,0) - new Date(from).setHours(0,0,0,0);
  return Math.round(ms / 86400000);
}

export function slugify(s) {
  return String(s).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Strip personal-name suffix to get the institutional base name.
// "Dirección Gestión Ambiental GADPS — Holger Salas" → "Dirección Gestión Ambiental GADPS"
// "Secretaría Técnica (GADPS) - Apoyo" → "Secretaría Técnica (GADPS)"
// Used to match against `lidera_apoya` cells which contain only institutional labels.
export function actorBaseName(name) {
  return String(name || '')
    .replace(/\s*—\s*.+$/, '')          // em-dash + person name
    .replace(/\s*-\s*(Apoyo|\d+)$/i, '') // hyphen + Apoyo/N (legacy)
    .trim();
}

// Inverse: extract personal name if present, otherwise return base.
// Used for greetings ("Hola, Holger" instead of "Hola, Dirección").
export function actorPersonName(name) {
  const m = String(name || '').match(/—\s*(.+)$/);
  return m ? m[1].trim() : actorBaseName(name);
}

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const MESES_CORTOS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

export function formatDate(d, short = false) {
  const x = new Date(d);
  if (isNaN(x)) return '—';
  const meses = short ? MESES_CORTOS : MESES;
  return short ? `${x.getDate()} ${meses[x.getMonth()]}` : `${x.getDate()} de ${meses[x.getMonth()]} de ${x.getFullYear()}`;
}

export function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`fetch ${url}: ${r.status}`);
  return r.json();
}

const CSV_FIELDS = [
  'id', 'trimestre', 'submesa', 'hito_operativo', 'que_se_hace', 'lidera_apoya',
  'fecha_inicio', 'fecha_limite', 'estado', 'fecha_reporte', 'producto_verificable', 'evidencia_minima'
];
const CSV_HEADERS = [
  'ID', 'Trimestre', 'Submesa', 'Hito Operativo', 'Qué se hace', 'Responsable',
  'Fecha Inicio', 'Fecha Límite', 'Estado', 'Fecha Reporte', 'Producto Verificable', 'Evidencia Mínima'
];
const CSV_DATE_FIELDS = new Set(['fecha_inicio', 'fecha_limite', 'fecha_reporte']);

const escapeCell = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';

const formatCell = (a, field) => {
  const v = a[field];
  if (CSV_DATE_FIELDS.has(field)) {
    if (!v) return '""';
    const d = new Date(v);
    if (isNaN(d)) return '""';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return escapeCell(`${yyyy}-${mm}-${dd}`);
  }
  return escapeCell(v);
};

// Pure function — returns CSV string. Exported for testing.
export function buildCsvContent(activities) {
  const lines = [
    CSV_HEADERS.map(escapeCell).join(','),
    ...activities.map(a => CSV_FIELDS.map(f => formatCell(a, f)).join(','))
  ];
  return lines.join('\r\n');
}

export function exportCsv(activities, filter, province) {
  const csv = buildCsvContent(activities);

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const filename = `actividades-${province}-${filter}-${yyyy}-${mm}-${dd}.csv`;

  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
