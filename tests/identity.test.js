import assert from 'node:assert/strict';
import { resolveActor } from '../shared/js/identity.js';

const actors = [
  { slug: 'coord-ambiental', name: 'Coord. Ambiental', submesa: 'S1' },
  { slug: 'st-gadpo', name: 'Secretaría Técnica (GADPO)', submesa: 'Mesa' }
];

export function test_resolves_from_url_param() {
  const storage = { get: () => null, set: () => {} };
  const url = new URL('https://x/?actor=coord-ambiental');
  const r = resolveActor({ url, storage, actors });
  assert.equal(r.slug, 'coord-ambiental');
  assert.equal(r.name, 'Coord. Ambiental');
}

export function test_url_wins_over_storage_and_persists() {
  let stored = null;
  const storage = { get: () => 'st-gadpo', set: v => { stored = v; } };
  const url = new URL('https://x/?actor=coord-ambiental');
  const r = resolveActor({ url, storage, actors });
  assert.equal(r.slug, 'coord-ambiental');
  assert.equal(stored, 'coord-ambiental');
}

export function test_falls_back_to_storage_when_no_url() {
  const storage = { get: () => 'st-gadpo', set: () => {} };
  const url = new URL('https://x/');
  const r = resolveActor({ url, storage, actors });
  assert.equal(r.slug, 'st-gadpo');
}

export function test_returns_null_when_no_url_no_storage() {
  const storage = { get: () => null, set: () => {} };
  const url = new URL('https://x/');
  const r = resolveActor({ url, storage, actors });
  assert.equal(r, null);
}

export function test_ignores_unknown_slug() {
  const storage = { get: () => null, set: () => {} };
  const url = new URL('https://x/?actor=ghost');
  const r = resolveActor({ url, storage, actors });
  assert.equal(r, null);
}
