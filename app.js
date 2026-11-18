// Arranque de Maqnex: sesión, términos, estructura de la app y navegación.
import { sb, isConfigured, isSecretKey } from './supabase.js';
import { CONFIG } from './config.js';
import { h, clear, icon, logo, roleChip, errMsg, toast, loading } from './ui.js';
import { state, on, loadMe, loadProfiles, loadMachines, loadParts, refreshUnread, startRealtime, stopRealtime, isStaff, isAdmin } from './state.js';
import { avatar } from './components.js';
import { renderAuth, renderTerms, renderNewPassword } from './auth.js';
import { openFabMenu } from './actions.js';

import * as dashboard from './views/dashboard.js';
import * as machines from './views/machines.js';
import * as machineDetail from './views/machine.js';
import * as orders from './views/orders.js';
import * as parts from './views/parts.js';
import * as channels from './views/channels.js';
import * as messages from './views/messages.js';
import * as team from './views/team.js';
import * as notifications from './views/notifications.js';
import * as reports from './views/reports.js';
import * as profileView from './views/profile.js';
import * as admin from './views/admin.js';
import * as help from './views/help.js';

const root = document.getElementById('app');

// ---------------- Tema claro / oscuro ----------------
export function setTheme(t) {
  document.documentElement.dataset.theme = t;
  localStorage.setItem('mx_theme', t);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'light' ? '#e5e5e5' : '#000000');
}
export const toggleTheme = () => setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');

// ---------------- Instalar como app (PWA) ----------------
let installEvent = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; document.body.classList.add('can-install'); });
export async function promptInstall() {
  if (!installEvent) { toast('Usa el menú del navegador: "Instalar app" o "Agregar a pantalla de inicio".', 'info'); return; }
  installEvent.prompt(); await installEvent.userChoice; installEvent = null; document.body.classList.remove('can-install');
}
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

// ---------------- Rutas ----------------
const NAV = [
  { path: 'inicio', label: 'Inicio', icon: 'home', view: dashboard },
  { path: 'maquinas', label: 'Máquinas', icon: 'machine', view: machines },
  { path: 'ordenes', label: 'Órdenes', icon: 'orders', view: orders },
  { path: 'repuestos', label: 'Repuestos', icon: 'parts', view: parts },
  { path: 'canales', label: 'Canales', icon: 'hash', view: channels },
  { path: 'mensajes', label: 'Mensajes', icon: 'message', view: messages, badge: 'dms' },
  { path: 'equipo', label: 'Equipo', icon: 'users', view: team },
  { path: 'notificaciones', label: 'Notificaciones', icon: 'bell', view: notifications, badge: 'notifs' },
  { path: 'reportes', label: 'Reportes', icon: 'chart', view: reports },
  { path: 'perfil', label: 'Perfil', icon: 'user', view: profileView },
  { path: 'admin', label: 'Administración', icon: 'shield', view: admin, adminOnly: true },
  { path: 'ayuda', label: 'Ayuda', icon: 'help', view: help },
];
const DETAIL = { maquinas: machineDetail };
const MOBILE_TABS = ['inicio', 'maquinas', 'canales', 'mensajes'];

let cleanup = null;
let content;

function parseHash() {
  const [path, qs] = location.hash.replace(/^#\/?/, '').split('?');
  const parts = (path || 'inicio').split('/').filter(Boolean).map((s) => { try { return decodeURIComponent(s); } catch { return ''; } });
  return { section: parts[0] || 'inicio', param: parts[1], query: new URLSearchParams(qs || '') };
}

async function route() {
  if (!content) return;
  const { section, param, query } = parseHash();
  let item = NAV.find((n) => n.path === section);
  if (!item || (item.adminOnly && !isAdmin())) { location.hash = '#/inicio'; return; }
  const view = (param && DETAIL[section]) ? DETAIL[section] : item.view;
  try { cleanup?.(); } catch { /* vista anterior ya cerrada */ }
  cleanup = null;
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === section));
  document.body.classList.toggle('in-detail', !!param);
  clear(content, loading());
  content.focus({ preventScroll: true });
  scrollTo(0, 0);
  try {
    const page = h('div', { class: 'page' });
    // append seguro: ignora null/false (evita que aparezca el texto "null").
    page.append = (...c) => Element.prototype.append.call(page, ...c.flat(Infinity).filter((x) => x !== null && x !== undefined && x !== false));
    const maybe = await view.render(page, { param, section, query });
    if (parseHash().section !== section || parseHash().param !== param) { maybe?.(); return; }
    clear(content, page);
    cleanup = typeof maybe === 'function' ? maybe : null;
  } catch (ex) {
    console.error(ex);
    clear(content, h('div', { class: 'empty' }, h('p', {}, errMsg(ex)),
      h('button', { class: 'btn', onclick: () => route() }, 'Reintentar')));
  }
}

// ---------------- Estructura de la app ----------------
function navLink(n, mobile = false) {
  const badge = n.badge ? h('b', { class: 'badge', dataset: { badge: n.badge } }) : null;
  return h('a', { href: `#/${n.path}`, class: mobile ? 'tab' : 'nav-item', dataset: { nav: n.path } },
    icon(n.icon, mobile ? 22 : 18), h('span', {}, n.label), badge);
}

function updateBadges() {
  document.querySelectorAll('[data-badge]').forEach((b) => {
    const n = state.unread[b.dataset.badge] || 0;
    b.textContent = n > 99 ? '99+' : n ? String(n) : '';
    b.hidden = !n;
  });
}

function meCard() {
  const p = state.profiles.get(state.me.id) || state.me;
  return h('a', { class: 'me-card', href: '#/perfil' }, avatar(p, 38),
    h('span', {}, h('strong', {}, p.full_name), roleChip(p.role)));
}

function renderShell() {
  const items = NAV.filter((n) => !n.adminOnly || isAdmin());
  content = h('main', { class: 'content', id: 'content', tabindex: '-1' });
  const side = h('aside', { class: 'side' },
    h('a', { class: 'brand', href: '#/inicio' }, logo(28), h('span', { class: 'wordmark' }, 'Maqnex')),
    h('nav', { class: 'nav', 'aria-label': 'Secciones' }, items.map((n) => navLink(n))),
    h('div', { class: 'side-foot' },
      h('div', { class: 'me-slot' }, meCard()),
      h('div', { class: 'row gap-sm' },
        h('button', { class: 'iconbtn', type: 'button', title: 'Cambiar tema', 'aria-label': 'Cambiar tema claro u oscuro', onclick: toggleTheme }, icon('sun', 18)),
        h('button', { class: 'iconbtn install-btn', type: 'button', title: 'Instalar app', 'aria-label': 'Instalar app', onclick: promptInstall }, icon('install', 18)),
        h('button', { class: 'iconbtn', type: 'button', title: 'Cerrar sesión', 'aria-label': 'Cerrar sesión', onclick: signOut }, icon('logout', 18)))));
  const moreItems = items.filter((n) => !MOBILE_TABS.includes(n.path));
  const tabbar = h('nav', { class: 'tabbar', 'aria-label': 'Secciones' },
    MOBILE_TABS.map((p) => navLink(items.find((n) => n.path === p), true)),
    h('button', { class: 'tab', type: 'button', onclick: () => openMore(moreItems) }, icon('more', 22), h('span', {}, 'Más')));
  const topbar = h('header', { class: 'topbar' },
    h('a', { class: 'brand', href: '#/inicio' }, logo(24), h('span', { class: 'wordmark' }, 'Maqnex')),
    h('div', { class: 'row gap-sm' },
      h('a', { class: 'iconbtn rel', href: '#/notificaciones', 'aria-label': 'Notificaciones' }, icon('bell', 20), h('b', { class: 'badge', dataset: { badge: 'notifs' } })),
      h('a', { class: 'top-avatar', href: '#/perfil', 'aria-label': 'Mi perfil' }, avatar(state.me, 32))));
  const offline = h('div', { class: 'offline', role: 'status' }, 'Sin conexión: los cambios no se guardarán hasta que vuelvas a estar en línea.');
  const fab = h('button', { class: 'fab', type: 'button', 'aria-label': 'Agregar', title: 'Agregar', onclick: (e) => openFabMenu(e.currentTarget) }, icon('plus', 26));
  clear(root, h('div', { class: 'shell' }, side, h('div', { class: 'main-col' }, topbar, offline, content), tabbar, fab));
  updateBadges();
}

function openMore(items) {
  import('./ui.js').then(({ modal }) => {
    const m = modal({ title: 'Más secciones', body: h('div', { class: 'more-grid' },
      items.map((n) => h('a', { class: 'more-item', href: `#/${n.path}`, onclick: () => m.close() }, icon(n.icon, 22), n.label, n.badge ? h('b', { class: 'badge', dataset: { badge: n.badge } }) : null)),
      h('button', { class: 'more-item', type: 'button', onclick: () => { m.close(); toggleTheme(); } }, icon('sun', 22), 'Cambiar tema'),
      h('button', { class: 'more-item', type: 'button', onclick: () => { m.close(); signOut(); } }, icon('logout', 22), 'Cerrar sesión')) });
    updateBadges();
  });
}

export async function signOut() {
  stopRealtime();
  await sb.auth.signOut();
}

// ---------------- Flujo de sesión ----------------
let started = false;
let recovering = false;

async function enter() {
  try {
    const me = await loadMe();
    if (!me) throw new Error('No encontramos tu perfil. Cierra sesión e intenta de nuevo.');
    if (me.terms_version !== CONFIG.TERMS_VERSION) {
      renderTerms(root, { onAccept: () => { started = false; enter(); }, onReject: signOut });
      return;
    }
    if (started) return;
    started = true;
    clear(root, h('div', { class: 'center-screen' }, logo(44), loading()));
    await Promise.all([loadProfiles(), loadMachines(), loadParts()]);
    renderShell();
    startRealtime();
    refreshUnread().catch(() => {});
    route();
  } catch (ex) {
    started = false;
    clear(root, h('div', { class: 'center-screen' }, logo(44), h('p', {}, errMsg(ex)),
      h('div', { class: 'row gap' }, h('button', { class: 'btn primary', onclick: () => enter() }, 'Reintentar'),
        h('button', { class: 'btn', onclick: signOut }, 'Cerrar sesión'))));
  }
}

function setupScreen(message) {
  clear(root, h('main', { class: 'center-screen setup' }, logo(48),
    h('h1', { class: 'display' }, 'Falta conectar la base de datos'),
    h('p', { class: 'prose' }, message),
    h('ol', { class: 'prose' },
      h('li', {}, 'Crea un proyecto gratis en supabase.com.'),
      h('li', {}, 'En SQL Editor ejecuta el archivo supabase/schema.sql.'),
      h('li', {}, 'Copia la Project URL y la clave pública (publishable / anon) en js/config.js.'),
      h('li', {}, 'Sube los cambios a GitHub y recarga esta página.')),
    h('p', { class: 'muted' }, 'La guía completa está en el archivo README.md.')));
}

async function init() {
  if (!isConfigured()) return setupScreen('Maqnex necesita un proyecto de Supabase para guardar cuentas y datos.');
  if (isSecretKey(CONFIG.SUPABASE_ANON_KEY)) return setupScreen('⚠️ Pegaste una clave SECRETA (service_role). Esa clave nunca debe estar en el navegador: bórrala de js/config.js, cámbiala en Supabase (Settings → API → Roll) y usa la clave pública.');
  if (!sb) return setupScreen('No se pudo cargar la librería de Supabase. Revisa tu conexión a internet y recarga.');

  addEventListener('online', () => document.body.classList.remove('is-offline'));
  addEventListener('offline', () => document.body.classList.add('is-offline'));
  if (!navigator.onLine) document.body.classList.add('is-offline');

  on('unread', updateBadges);
  on('profiles', () => { const slot = document.querySelector('.me-slot'); if (slot && state.me) clear(slot, meCard()); });
  addEventListener('hashchange', route);

  sb.auth.onAuthStateChange((event, session) => {
    state.session = session;
    // Se difiere para no bloquear el cliente de autenticación.
    setTimeout(() => {
      if (event === 'PASSWORD_RECOVERY') { recovering = true; renderNewPassword(root, () => { recovering = false; enter(); }); return; }
      if (recovering) return;
      if (event === 'SIGNED_OUT' || !session) {
        started = false; stopRealtime(); content = null;
        Object.assign(state, { me: null, profiles: new Map(), machines: [], parts: [] });
        renderAuth(root);
        return;
      }
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') enter();
    }, 0);
  });
}

init();

// Accesos usados por otras vistas.
export { isStaff };
