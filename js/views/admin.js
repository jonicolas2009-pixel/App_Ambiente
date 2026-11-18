import { sb } from '../supabase.js';
import { h, clear, icon, pageHead, input, ROLES, errMsg, toast, confirmDialog, fdate, num } from '../ui.js';
import { state, isAdmin, loadProfiles, on } from '../state.js';
import { avatar } from '../components.js';

export async function render(page) {
  if (!isAdmin()) { location.hash = '#/inicio'; return; }
  await loadProfiles();
  const search = input({ type: 'search', placeholder: 'Buscar usuario', 'aria-label': 'Buscar usuario', maxlength: 60 });
  const stats = h('div', { class: 'kpis three' });
  const body = h('tbody');
  const paint = () => {
    const all = [...state.profiles.values()];
    clear(stats, Object.entries(ROLES).map(([k, l], i) => h('div', { class: `kpi card${i === 0 ? ' inv' : ''}` }, h('span', { class: 'kpi-label' }, l + 's'), h('strong', { class: 'kpi-value' }, num(all.filter((p) => p.role === k).length)))));
    const q = search.value.trim().toLowerCase();
    clear(body, all.filter((p) => !q || `${p.full_name} ${p.username} ${p.area}`.toLowerCase().includes(q)).map((p) => {
      const sel = h('select', { class: 'input slim', 'aria-label': `Rol de ${p.full_name}` }, Object.entries(ROLES).map(([k, l]) => h('option', { value: k, selected: k === p.role }, l)));
      sel.addEventListener('change', async () => {
        const role = sel.value;
        if (!await confirmDialog(`¿Cambiar el rol de ${p.full_name} a ${ROLES[role]}?`)) { sel.value = p.role; return; }
        const { error } = await sb.rpc('set_user_role', { p_user: p.id, p_role: role });
        if (error) { toast(errMsg(error), 'error'); sel.value = p.role; return; }
        toast('Rol actualizado.');
        await loadProfiles();
      });
      return h('tr', {},
        h('td', {}, h('a', { href: `#/perfil/${p.id}`, class: 'row gap-sm' }, avatar(p, 30), h('span', {}, h('strong', {}, p.full_name), h('small', { class: 'muted block' }, '@' + p.username)))),
        h('td', {}, p.area), h('td', {}, fdate(p.created_at)), h('td', {}, sel));
    }));
  };
  search.addEventListener('input', paint);
  paint();
  page.append(
    pageHead('Solo administradores', 'Administración', 'Asigna roles. Los permisos se aplican en el servidor: cambiar el rol aquí es la única forma de hacerlo.'),
    stats,
    h('div', { class: 'search' }, icon('search', 18), search),
    h('div', { class: 'table-wrap card' }, h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, ['Usuario', 'Área', 'Registro', 'Rol'].map((t) => h('th', {}, t)))), body)),
    h('p', { class: 'footnote' }, 'Técnico: ve todo, registra horas y fallas, trabaja sus órdenes. Supervisor: además crea máquinas, órdenes y repuestos, y simula anomalías. Administrador: además elimina registros y asigna roles.'));
  return on('profiles', paint);
}
