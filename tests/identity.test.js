import assert from 'node:assert/strict';
import { resolveActor } from '../shared/js/identity.js';

const actors = [
  { slug: 'coord-ambiental', name: 'Coord. Ambiental', submesa: 'S1', token: 'TOK-A' },
  { slug: 'st-gadpo', name: 'Secretaría Técnica (GADPO)', submesa: 'Mesa', token: 'TOK-B' }
];

function memStorage(initial = null) {
  let v = initial;
  return { get: () => v, set: val => { v = val; } };
}

export function test_resolves_when_url_actor_and_token_match() {
  const url = new URL('https://x/?actor=coord-ambiental&token=TOK-A');
  const r = resolveActor({ url, storage: memStorage(), actors });
  assert.equal(r.slug, 'coord-ambiental');
  assert.equal(r.token, 'TOK-A');
}

export function test_rejects_when_url_has_actor_but_no_token() {
  const url = new URL('https://x/?actor=coord-ambiental');
  const r = resolveActor({ url, storage: memStorage(), actors });
  assert.equal(r, null);
}

export function test_rejects_when_url_token_does_not_match() {
  const url = new URL('https://x/?actor=coord-ambiental&token=WRONG');
  const r = resolveActor({ url, storage: memStorage(), actors });
  assert.equal(r, null);
}

export function test_rejects_when_url_slug_unknown() {
  const url = new URL('https://x/?actor=ghost&token=TOK-A');
  const r = resolveActor({ url, storage: memStorage(), actors });
  assert.equal(r, null);
}

export function test_persists_valid_url_pair_to_storage() {
  const storage = memStorage();
  const url = new URL('https://x/?actor=st-gadpo&token=TOK-B');
  resolveActor({ url, storage, actors });
  const saved = JSON.parse(storage.get());
  assert.equal(saved.slug, 'st-gadpo');
  assert.equal(saved.token, 'TOK-B');
}

export function test_falls_back_to_storage_when_no_url_pair() {
  const storage = memStorage(JSON.stringify({ slug: 'coord-ambiental', token: 'TOK-A' }));
  const url = new URL('https://x/');
  const r = resolveActor({ url, storage, actors });
  assert.equal(r.slug, 'coord-ambiental');
}

export function test_storage_rejected_if_token_no_longer_valid() {
  const storage = memStorage(JSON.stringify({ slug: 'coord-ambiental', token: 'STALE' }));
  const url = new URL('https://x/');
  const r = resolveActor({ url, storage, actors });
  assert.equal(r, null);
}

export function test_returns_null_when_no_url_no_storage() {
  const url = new URL('https://x/');
  const r = resolveActor({ url, storage: memStorage(), actors });
  assert.equal(r, null);
}

export function test_handles_garbage_in_storage_gracefully() {
  const storage = memStorage('not-json');
  const url = new URL('https://x/');
  const r = resolveActor({ url, storage, actors });
  assert.equal(r, null);
}
