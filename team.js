import { sb } from '../supabase.js';
import { h, clear, icon, pageHead, input, empty, errMsg, toast, ROLES, isUuid } from '../ui.js';
import { state, on, profile } from '../state.js';
import { personLine } from '../components.js';

export async function loadContacts() {
  const { data, error } = await sb.from('contacts').select('requester, addressee, status, created_at');
  if (error) throw error;
  const me = state.me.id;
  const rel = new Map();
  for (const c of data) {
    const other = c.requester === me ? c.addressee : c.requester;
    rel.set(other, c.status === 'aceptado' ? 'contact' : c.requester === me ? 'sent' : 'received');
  }
  return rel;
}

export async function contactAction(otherId, relation) {
  if (!isUuid(otherId) || otherId === state.me.id) throw new Error('Persona no válida.');
  let res;
  if (!relation) res = await sb.from('contacts').insert({ addressee: otherId });
  else if (relation === 'received') res = await sb.from('contacts').update({ status: 'aceptado' }).eq('requester', otherId).eq('addressee', state.me.id);
  else res = await sb.from('contacts').delete().or(`and(requester.eq.${state.me.id},addressee.eq.${otherId}),and(requester.eq.${otherId},addressee.eq.${state.me.id})`);
  if (res.error) throw res.error;
}

export function relationButton(p, relation, after) {
  const labels = { '': ['Agregar', 'userplus', 'primary'], sent: ['Cancelar solicitud', 'x', ''], received: ['Aceptar', 'check', 'primary'], contact: ['Quitar contacto', 'x', 'ghost'] };
  const [label, ic, cls] = labels[relation || ''];
  return h('button', { class: `btn sm ${cls}`, type: 'button', onclick: async (e) => {
    e.preventDefault(); e.stopPropagation();
    try { await contactAction(p.id, relation); after(); } catch (ex) { toast(errMsg(ex), 'error'); }
  } }, icon(ic, 14), label);
}

export async function render(page) {
  let tab = 'contactos';
  let rel = await loadContacts();
  const tabs = h('div', { class: 'seg', role: 'tablist' });
  const search = input({ type: 'search', placeholder: 'Busca por nombre, usuario, área o rol', 'aria-label': 'Buscar personas', maxlength: 60 });
  const body = h('div', { class: 'list' });
  const refresh = async () => { rel = await loadContacts(); paint(); };

  const row = (p) => h('div', { class: 'list-item' }, personLine(p),
    h('div', { class: 'row gap-sm' },
      rel.get(p.id) === 'contact' ? h('a', { class: 'btn sm', href: `#/mensajes/${p.id}` }, icon('message', 14), 'Mensaje') : null,
      relationButton(p, rel.get(p.id), refresh)));

  const paint = () => {
    const counts = { contactos: [...rel.values()].filter((v) => v === 'contact').length, solicitudes: [...rel.values()].filter((v) => v === 'received').length };
    clear(tabs, [['contactos', `Mis contactos (${counts.contactos})`], ['solicitudes', `Solicitudes${counts.solicitudes ? ` (${counts.solicitudes})` : ''}`], ['buscar', 'Buscar personas']].map(([k, l]) =>
      h('button', { type: 'button', role: 'tab', class: tab === k ? 'on' : '', 'aria-selected': String(tab === k), onclick: () => { tab = k; paint(); if (k === 'buscar') setTimeout(() => search.focus()); } }, l)));
    search.parentElement.hidden = tab !== 'buscar';
    let people;
    if (tab === 'contactos') people = [...rel].filter(([, v]) => v === 'contact').map(([id]) => profile(id));
    else if (tab === 'solicitudes') people = [...rel].filter(([, v]) => v === 'received' || v === 'sent').map(([id]) => profile(id));
    else {
      const q = search.value.trim().toLowerCase();
      people = [...state.profiles.values()].filter((p) => p.id !== state.me.id &&
        (!q || `${p.full_name} ${p.username} ${p.area} ${ROLES[p.role]} ${p.headline}`.toLowerCase().includes(q))).slice(0, 60);
    }
    clear(body, people.length ? people.map(row) : empty(tab === 'contactos' ? 'Aún no tienes contactos. Búscalos en "Buscar personas".' : tab === 'solicitudes' ? 'No tienes solicitudes pendientes.' : 'Nadie coincide con la búsqueda.'));
  };
  search.addEventListener('input', paint);
  page.append(pageHead('Personas', 'Equipo', `${state.profiles.size} personas en la plataforma. Agrega contactos para enviarles mensajes privados.`),
    tabs, h('div', { class: 'search' }, icon('search', 18), search), body);
  paint();
  return on('contacts', () => refresh().catch(() => {}));
}
