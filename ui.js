// Utilidades de interfaz. Regla de seguridad: el contenido de los usuarios
// SIEMPRE se inserta como texto (textContent), nunca como HTML.

export function h(tag, props = {}, ...children) {
  const el = tag === 'frag' ? document.createDocumentFragment() : document.createElement(tag);
  if (props && tag !== 'frag') {
    for (const [k, v] of Object.entries(props)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'required' || k === 'multiple') el[k] = !!v;
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false || c === '') continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export function clear(el, ...children) { el.replaceChildren(); append(el, children); return el; }

// --- Iconos (SVG fijos escritos por nosotros: contenido de confianza) ---
const P = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  machine: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  orders: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v3h6V3M9 11h6M9 15h4"/>',
  parts: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  hash: '<path d="M5 9h14M5 15h14M10 3 8 21M16 3l-2 18"/>',
  message: '<path d="M4 5h16v11H9l-5 4z"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.6c1.8.7 3 2.5 3.5 5.4"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.2-6 8-6s7 2 8 6"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01"/>',
  shield: '<path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  logout: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
  send: '<path d="M4 12 20 4l-6 16-3-7z"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  printer: '<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3"/><rect x="7" y="14" width="10" height="7"/>',
  pulse: '<path d="M3 12h4l2-6 4 12 2-6h6"/>',
  alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.01"/>',
  wrench: '<path d="M14.5 6.5a4 4 0 0 0-5.3 5.3L3 18l3 3 6.2-6.2a4 4 0 0 0 5.3-5.3l-2.5 2.5-2.6-.6-.6-2.6z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  install: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M12 8v7M9 12l3 3 3-3"/>',
  userplus: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M19 8v6M16 11h6"/>',
};
export function icon(name, size = 20) {
  const span = document.createElement('span');
  span.className = 'ic';
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${P[name] || ''}</svg>`;
  return span;
}

export function logo(size = 28) {
  const span = document.createElement('span');
  span.className = 'logo-mark';
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 32 32"><defs><linearGradient id="lg${size}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8052ff"/><stop offset="1" stop-color="#15846e"/></linearGradient></defs><path d="M3 27 10 5l6 13 6-13 7 22h-5l-4-12-4 9-4-9-4 12z" fill="url(#lg${size})"/><path d="M25 3l4 6h-8z" fill="#ffb829"/></svg>`;
  return span;
}

// --- Catálogos ---
export const AREAS = ['Producción', 'Mantenimiento', 'Calidad', 'Logística', 'Servicios'];
export const ROLES = { tecnico: 'Técnico', supervisor: 'Supervisor', admin: 'Administrador' };
export const LEVELS = {
  normal: { label: 'Normal', order: 0 },
  proximo: { label: 'Próximo', order: 1 },
  recomendado: { label: 'Recomendado', order: 2 },
  alta: { label: 'Prioridad alta', order: 3 },
};
export const STAGES = {
  preparacion: 'Preparación',
  llenado: 'Llenado y tapado',
  etiquetado: 'Etiquetado y empaque',
  servicios: 'Servicios industriales',
};
export const PRIORITIES = { baja: 'Baja', media: 'Media', alta: 'Alta', critica: 'Crítica' };
export const STATUS = { abierta: 'Abierta', en_progreso: 'En progreso', cerrada: 'Cerrada' };
export const HOURS_PER_DAY = 16;

export const levelChip = (level) => h('span', { class: `chip lv-${level}` }, h('i'), LEVELS[level]?.label || level);
export const roleChip = (role) => h('span', { class: `role role-${role}` }, ROLES[role] || role);
export const prioChip = (p) => h('span', { class: `prio prio-${p}` }, PRIORITIES[p] || p);
export const tag = (text) => h('span', { class: 'tag' }, text);
export const eyebrow = (text) => h('div', { class: 'eyebrow' }, text);

// --- Formatos ---
const nf = new Intl.NumberFormat('es-CO');
const nf1 = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });
export const num = (n) => nf.format(Number(n) || 0);
export const num1 = (n) => nf1.format(Number(n) || 0);
export const cop = (n) => '$' + nf.format(Math.round(Number(n) || 0));
export const pct = (n) => nf1.format(n) + ' %';
export function fdate(d, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!d) return '—';
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) d += 'T12:00:00';
  return new Date(d).toLocaleDateString('es-CO', opts);
}
export function ftime(d) {
  return d ? new Date(d).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '';
}
export function rel(d) {
  if (!d) return '';
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 45) return 'hace un momento';
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  if (s < 604800) return `hace ${Math.round(s / 86400)} d`;
  return fdate(d);
}
export const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '·';

export function debounce(fn, ms = 200) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

export const isUuid = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v || '');

// --- Validación de formularios (el servidor vuelve a validar todo) ---
export const V = {
  text(v, min, max, label) {
    const s = (v ?? '').trim();
    if (s.length < min) throw new Error(`${label}: mínimo ${min} caracteres.`);
    if (s.length > max) throw new Error(`${label}: máximo ${max} caracteres.`);
    return s;
  },
  num(v, min, max, label, { int = false } = {}) {
    const s = String(v ?? '').replace(',', '.').trim();
    const n = Number(s);
    if (s === '' || !Number.isFinite(n)) throw new Error(`${label}: escribe un número.`);
    if (int && !Number.isInteger(n)) throw new Error(`${label}: debe ser un número entero.`);
    if (n < min || n > max) throw new Error(`${label}: debe estar entre ${num(min)} y ${num(max)}.`);
    return n;
  },
  oneOf(v, list, label) {
    if (!list.includes(v)) throw new Error(`${label}: opción no válida.`);
    return v;
  },
  email(v) {
    const s = (v ?? '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) || s.length > 254) throw new Error('Escribe un correo válido.');
    return s;
  },
  password(v) {
    if ((v || '').length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');
    if ((v || '').length > 72) throw new Error('La contraseña puede tener máximo 72 caracteres.');
    if (!/[a-zA-Z]/.test(v) || !/[0-9]/.test(v)) throw new Error('La contraseña debe tener letras y números.');
    return v;
  },
  username(v) {
    const s = (v ?? '').trim().toLowerCase();
    if (!/^[a-z0-9_.]{3,30}$/.test(s)) throw new Error('Usuario: 3 a 30 caracteres, solo letras minúsculas, números, punto o guion bajo.');
    return s;
  },
};

// Mensajes de error en español y sin detalles internos del servidor.
export function errMsg(e) {
  if (!e) return 'Ocurrió un error.';
  if (e instanceof Error && !e.code && !('status' in e) && e.message && !/fetch|network/i.test(e.message)) return e.message;
  const m = String(e.message || '').toLowerCase();
  const code = e.code || '';
  if (m.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.';
  if (m.includes('email not confirmed')) return 'Confirma tu correo: te enviamos un enlace.';
  if (m.includes('already registered') || code === 'user_already_exists') return 'Ya existe una cuenta con ese correo.';
  if (m.includes('rate limit') || code.startsWith('over_')) return 'Demasiados intentos. Espera unos minutos e intenta de nuevo.';
  if (code === 'weak_password' || m.includes('password should')) return 'La contraseña es muy débil. Usa al menos 8 caracteres con letras y números.';
  if (m.includes('captcha')) return 'Completa la verificación anti-bots.';
  if (m.includes('same_password') || m.includes('different from the old')) return 'La nueva contraseña debe ser distinta a la anterior.';
  if (m.includes('failed to fetch') || m.includes('network') || m.includes('load failed')) return 'Sin conexión con el servidor. Revisa tu internet.';
  if (m.includes('jwt') || code === 'PGRST301') return 'Tu sesión expiró. Vuelve a iniciar sesión.';
  if (code === '23505') return m.includes('duplicate key') ? (m.includes('channels') ? 'Ya existe un canal con ese nombre.' : 'Ese registro ya existe.') : e.message;
  if (code === '23514' || code === '22P02' || code === '23502') return 'Algún dato no tiene el formato permitido.';
  if (code === '42501' || m.includes('row-level security') || m.includes('permission denied')) {
    return (m.includes('row-level') || m.includes('permission denied')) ? 'No tienes permiso para hacer esto.' : e.message;
  }
  if (['P0001', 'P0002', '22023', '28000'].includes(code)) return e.message;
  if (m.includes('payload too large') || m.includes('maximum allowed size')) return 'El archivo es demasiado grande.';
  if (m.includes('mime type') ) return 'Tipo de archivo no permitido.';
  return 'Ocurrió un error. Intenta de nuevo.';
}

// --- Avisos ---
let toastWrap;
export function toast(msg, kind = 'ok') {
  if (!toastWrap) { toastWrap = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' }); document.body.append(toastWrap); }
  const t = h('div', { class: `toast toast-${kind}` }, msg);
  toastWrap.append(t);
  setTimeout(() => t.classList.add('out'), 3800);
  setTimeout(() => t.remove(), 4300);
}

// --- Ventanas modales ---
export function modal({ title, body, actions = [], wide = false, onClose }) {
  const prevFocus = document.activeElement;
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey); onClose?.(); prevFocus?.focus?.(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const box = h('div', { class: `modal${wide ? ' wide' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'modal-head' }, h('h2', { class: 'h-sm' }, title),
      h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Cerrar', onclick: close }, icon('x'))),
    h('div', { class: 'modal-body' }, body),
    actions.length ? h('div', { class: 'modal-actions' }, actions) : null);
  const back = h('div', { class: 'backdrop', onmousedown: (e) => { if (e.target === back) close(); } }, box);
  document.body.append(back);
  document.addEventListener('keydown', onKey);
  setTimeout(() => box.querySelector('input,select,textarea,button.primary')?.focus(), 30);
  return { close, box };
}

export function confirmDialog(text, { ok = 'Confirmar', danger = false } = {}) {
  return new Promise((resolve) => {
    let done = false;
    const m = modal({
      title: 'Confirmar', body: h('p', { class: 'muted' }, text),
      onClose: () => { if (!done) resolve(false); },
      actions: [
        h('button', { class: 'btn', type: 'button', onclick: () => { done = true; m.close(); resolve(false); } }, 'Cancelar'),
        h('button', { class: `btn ${danger ? 'danger' : 'primary'}`, type: 'button', onclick: () => { done = true; m.close(); resolve(true); } }, ok),
      ],
    });
  });
}

// Formulario dentro de un modal: valida, envía y muestra errores.
export function formModal({ title, fields, submit = 'Guardar', onSubmit, wide }) {
  const err = h('p', { class: 'form-error', role: 'alert' });
  const form = h('form', { class: 'form', novalidate: true }, fields, err);
  const btn = h('button', { class: 'btn primary', type: 'submit' }, submit);
  form.append(h('div', { class: 'modal-actions inline' }, btn));
  const m = modal({ title, body: form, wide });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.textContent = '';
    btn.disabled = true;
    try {
      const ok = await onSubmit(new FormData(form), form);
      if (ok !== false) m.close();
    } catch (ex) { err.textContent = errMsg(ex); }
    finally { btn.disabled = false; }
  });
  return m;
}

export function field(label, control, hint) {
  return h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), control, hint ? h('small', { class: 'hint' }, hint) : null);
}
export const input = (props) => h('input', { class: 'input', ...props });
export const textarea = (props) => h('textarea', { class: 'input', rows: 3, ...props });
export function select(name, options, value, props = {}) {
  return h('select', { class: 'input', name, ...props },
    options.map(([v, l]) => h('option', { value: v, selected: String(v) === String(value) }, l)));
}

export function empty(text, actionEl) {
  return h('div', { class: 'empty' }, h('p', {}, text), actionEl || null);
}

export function loading() { return h('div', { class: 'loading' }, h('span'), h('span'), h('span')); }

export function pageHead(eb, title, sub, actions) {
  return h('header', { class: 'ph' },
    h('div', { class: 'ph-text' }, eyebrow(eb), h('h1', { class: 'display' }, title), sub ? h('p', { class: 'lede' }, sub) : null),
    actions ? h('div', { class: 'ph-actions' }, actions) : null);
}

export function progress(ratio, level) {
  const pctv = Math.max(0, Math.min(1, ratio)) * 100;
  const bar = h('div', { class: `bar lv-${level || 'normal'}`, role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(pctv) }, h('i'));
  bar.firstChild.style.width = pctv + '%';
  return bar;
}

// Descargar un archivo generado en el navegador.
export function download(name, content, type = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = h('a', { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// CSV seguro: evita que Excel ejecute fórmulas escritas por usuarios.
export function toCSV(rows) {
  const esc = (v) => {
    let s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + rows.map((r) => r.map(esc).join(';')).join('\n');
}
