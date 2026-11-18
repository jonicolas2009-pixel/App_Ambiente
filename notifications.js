import { sb } from '../supabase.js';
import { h, clear, icon, pageHead, rel, empty, errMsg, toast } from '../ui.js';
import { state, on, refreshUnread } from '../state.js';

const KIND = { falla: ['alert', 'Falla'], alerta: ['pulse', 'Alerta'], orden: ['orders', 'Orden'], contacto: ['users', 'Contacto'], stock: ['parts', 'Stock'], sistema: ['shield', 'Sistema'] };

export async function render(page) {
  let filter = 'todas';
  let rows = [];
  const tabs = h('div', { class: 'seg', role: 'tablist' });
  const box = h('div', { class: 'list notif-list' });
  const load = async () => {
    const { data, error } = await sb.from('notifications').select('id, kind, title, body, link, area, read_at, created_at').order('created_at', { ascending: false }).limit(150);
    if (error) throw error;
    rows = data; paint();
  };
  const open = async (n) => {
    if (!n.read_at) {
      await sb.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id);
      n.read_at = new Date().toISOString(); refreshUnread().catch(() => {});
    }
    if (n.link && /^#\/[a-z0-9/_-]*$/.test(n.link)) location.hash = n.link; else paint();
  };
  const paint = () => {
    clear(tabs, [['todas', 'Todas'], ['noleidas', 'No leídas'], ['area', `Mi área (${state.me.area})`]].map(([k, l]) =>
      h('button', { type: 'button', role: 'tab', class: filter === k ? 'on' : '', 'aria-selected': String(filter === k), onclick: () => { filter = k; paint(); } }, l)));
    const list = rows.filter((n) => filter === 'todas' || (filter === 'noleidas' && !n.read_at) || (filter === 'area' && n.area === state.me.area));
    clear(box, list.length ? list.map((n) => {
      const [ic, label] = KIND[n.kind] || ['bell', n.kind];
      return h('button', { type: 'button', class: `notif k-${n.kind}${n.read_at ? '' : ' unread'}`, onclick: () => open(n) },
        h('span', { class: 'notif-ic' }, icon(ic, 18)),
        h('span', { class: 'grow' }, h('span', { class: 'eyebrow tiny' }, label + (n.area ? ` · ${n.area}` : '')), h('strong', { class: 'block' }, n.title), n.body ? h('span', { class: 'muted small block' }, n.body) : null),
        h('span', { class: 'muted small' }, rel(n.created_at)), n.read_at ? null : h('i', { class: 'unread-dot', 'aria-label': 'No leída' }));
    }) : empty('No tienes notificaciones en esta lista.'));
  };
  await load();
  page.append(pageHead('Avisos', 'Notificaciones', 'Fallas y alertas de tu área, órdenes asignadas y solicitudes de contacto.',
    h('button', { class: 'btn', type: 'button', onclick: async () => {
      const { error } = await sb.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
      if (error) toast(errMsg(error), 'error'); else { await load(); refreshUnread().catch(() => {}); toast('Todo marcado como leído.'); }
    } }, icon('check', 16), 'Marcar todo como leído')), tabs, box);
  return on('notification', (n) => { if (!rows.some((r) => r.id === n.id)) { rows.unshift(n); paint(); } });
}
