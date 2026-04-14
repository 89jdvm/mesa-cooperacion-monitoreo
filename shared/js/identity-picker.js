// shared/js/identity-picker.js
import { IDENTITY_STORAGE_KEY } from './identity.js';

export function showPicker(actors) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay open';
    overlay.innerHTML = `
      <div class="modal" style="max-width:420px">
        <h3 style="font-size:18px;margin-bottom:6px">¿Quién eres en la Mesa?</h3>
        <p style="font-size:13px;color:var(--muted);margin-bottom:18px">Selecciona tu rol. Se guardará en tu navegador; puedes cambiarlo luego desde el menú superior.</p>
        <select id="actor-select" style="width:100%;padding:10px;border:1px solid var(--line);border-radius:8px;font-size:14px;margin-bottom:16px">
          <option value="">— elige —</option>
          ${actors.map(a => `<option value="${a.slug}">${a.name}${a.submesa ? ' — ' + a.submesa : ''}</option>`).join('')}
        </select>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button data-action="cancel" style="background:none;border:1px solid var(--line);padding:10px 16px;border-radius:8px;font-size:13px;cursor:pointer">Cancelar</button>
          <button data-action="ok" style="background:var(--primary);color:#fff;border:0;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer">Continuar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const close = val => { document.body.removeChild(overlay); resolve(val); };
    overlay.querySelector('[data-action="cancel"]').onclick = () => close(null);
    overlay.querySelector('[data-action="ok"]').onclick = () => {
      const slug = overlay.querySelector('#actor-select').value;
      if (!slug) return;
      localStorage.setItem(IDENTITY_STORAGE_KEY, slug);
      const a = actors.find(x => x.slug === slug);
      close(a);
    };
  });
}
