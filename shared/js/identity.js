// shared/js/identity.js
// Identity resolution with per-actor magic-link tokens.
//
// URL must carry both ?actor=<slug>&token=<uuid>. The (slug, token) pair must
// match a registered actor's record. Tokens are long random strings emailed to
// each actor privately. This prevents impersonation from the public URL.
//
// Storage persists the last valid (slug, token) pair as JSON in a single key.

const STORAGE_KEY = 'mesaActor';

export function resolveActor({ url, storage, actors }) {
  const urlSlug = url.searchParams.get('actor');
  const urlToken = url.searchParams.get('token');

  // URL path: requires both and must match an actor
  if (urlSlug && urlToken) {
    const hit = actors.find(a => a.slug === urlSlug && a.token === urlToken);
    if (!hit) return null;
    storage.set(JSON.stringify({ slug: urlSlug, token: urlToken }));
    return hit;
  }

  // Storage path: fall back to previously-stored (slug, token), re-validate
  const stored = storage.get();
  if (!stored) return null;
  let parsed;
  try { parsed = JSON.parse(stored); } catch { return null; }
  if (!parsed?.slug || !parsed?.token) return null;
  const hit = actors.find(a => a.slug === parsed.slug && a.token === parsed.token);
  return hit || null;
}

export function clearIdentity(storage) {
  storage.set(null);
}

export function resolveActorFromBrowser(actors) {
  return resolveActor({
    url: new URL(window.location.href),
    storage: browserStorage(),
    actors
  });
}

export function clearIdentityFromBrowser() {
  window.localStorage.removeItem(STORAGE_KEY);
}

function browserStorage() {
  return {
    get: () => window.localStorage.getItem(STORAGE_KEY),
    set: v => {
      if (v == null) window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, v);
    }
  };
}

export const IDENTITY_STORAGE_KEY = STORAGE_KEY;
