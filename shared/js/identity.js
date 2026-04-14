// shared/js/identity.js
// resolveActor({ url: URL, storage: {get,set}, actors: [{slug,name,submesa}] }) → {slug,name,submesa} | null
// URL param > storage > null. URL always writes back to storage.

const STORAGE_KEY = 'mesaActor';

export function resolveActor({ url, storage, actors }) {
  const fromUrl = url.searchParams.get('actor');
  let slug = fromUrl || storage.get();
  if (!slug) return null;

  const hit = actors.find(a => a.slug === slug);
  if (!hit) return null;

  if (fromUrl) storage.set(fromUrl);
  return hit;
}

// Browser wrapper — used from pages, not from tests.
export function resolveActorFromBrowser(actors) {
  return resolveActor({
    url: new URL(window.location.href),
    storage: {
      get: () => window.localStorage.getItem(STORAGE_KEY),
      set: v => window.localStorage.setItem(STORAGE_KEY, v)
    },
    actors
  });
}

export const IDENTITY_STORAGE_KEY = STORAGE_KEY;
