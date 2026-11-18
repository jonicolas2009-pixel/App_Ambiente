import { sb } from '../supabase.js';
import { h, clear, icon, eyebrow, pageHead, prioChip, num1, cop, fdate, rel, STATUS, PRIORITIES, empty, errMsg, toast, formModal, field, input, textarea, V, confirmDialog } from '../ui.js';
import { state, on, isStaff, isAdmin, profile, machine, loadParts } from '../state.js';
import { avatar } from '../components.js';
import { orderForm } from '../actions.js';

const COLS = 'id, machine_id, title, description, kind, priority, status, assignee, due_date, est_hours, real_hours, safety_steps, checklist, part_id, part_qty, notes, cost, created_by, created_at, started_at, closed_at';

export async function render(page, { param }) {
  return param ? detail(page, Number(param)) : list(page);
}

async function list(page) {
  let tab = 'abierta';
  let rows = [];
  const tabs = h('div', { class: 'seg', role: 'tablist' });
  const box = h('div', { class: 'list' });
  const load = async () => {
    const { data, error } = await sb.from('work_orders').select(COLS).order('created_at', { ascending: false }).limit(300);
    if (error) throw error;
    rows = data; paint();
  };
  const paint = () => {
    const filters = { abierta: (o) => o.status === 'abierta', en_progreso: (o) => o.status === 'en_progreso', cerrada: (o) => o.status === 'cerrada', mias: (o) => o.assignee === state.me.id && o.status !== 'cerrada' };
    clear(tabs, [['abierta', 'Abiertas'], ['en_progreso', 'En progreso'], ['cerrada', 'Cerradas'], ['mias', 'Mis órdenes']].map(([k, l]) =>
      h('button', { type: 'button', role: 'tab', class: tab === k ? 'on' : '', 'aria-selected': String(tab === k), onclick: () => { tab = k; paint(); } }, l, h('small', {}, ` ${rows.filter(filters[k]).length}`))));
    const list = rows.filter(filters[tab]).sort((a, b) => Object.keys(PRIORITIES).indexOf(b.priority) - Object.keys(PRIORITIES).indexOf(a.priority));
    clear(box, list.length ? list.map(orderRow) : empty(tab === 'mias' ? 'No tienes órdenes asignadas.' : 'No hay órdenes en esta lista.'));
  };
  await load();
  page.append(
    pageHead('Mantenimiento', 'Órdenes de trabajo', 'Planifica, asigna y cierra los trabajos de mantenimiento.',
      isStaff() ? h('button', { class: 'btn primary', type: 'button', onclick: () => orderForm() }, icon('plus', 16), 'Nueva orden') : null),
    tabs, box);
  return on('orders', () => load().catch(() => {}));
}

function orderRow(o) {
  const m = machine(o.machine_id);
  const done = (o.checklist || []).filter((t) => t.done).length;
  const overdue = o.due_date && o.status !== 'cerrada' && new Date(o.due_date + 'T23:59:59') < new Date();
  return h('a', { class: 'list-item order', href: `#/ordenes/${o.id}` },
    o.assignee ? avatar(profile(o.assignee), 34) : h('span', { class: 'avatar empty-av' }, '?'),
    h('span', { class: 'grow' },
      h('strong', {}, o.title),
      h('span', { class: 'muted small block' }, `${m ? m.code + ' · ' + m.name : 'Máquina'} · ${o.kind} · ${o.assignee ? profile(o.assignee).full_name : 'sin responsable'}`)),
    h('span', { class: 'order-side' },
      prioChip(o.priority),
      h('span', { class: `small ${overdue ? 'bad-text' : 'muted'}` }, o.status === 'cerrada' ? `Cerrada ${fdate(o.closed_at)}` : o.due_date ? `${overdue ? 'Vencida' : 'Vence'} ${fdate(o.due_date)}` : `${done}/${(o.checklist || []).length} tareas`)));
}

async function detail(page, id) {
  if (!Number.isInteger(id)) { page.append(empty('Orden no válida.')); return; }
  const box = h('div');
  const load = async () => {
    const { data, error } = await sb.from('work_orders').select(COLS).eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) { clear(box, empty('Esta orden no existe.', h('a', { class: 'btn', href: '#/ordenes' }, 'Volver'))); return; }
    paint(data);
  };
  const paint = (o) => {
    const m = machine(o.machine_id);
    const canWork = (o.assignee === state.me.id || isStaff()) && o.status !== 'cerrada';
    const part = state.parts.find((p) => p.id === o.part_id);
    const checklist = h('ul', { class: 'checklist' }, (o.checklist || []).map((t, i) =>
      h('li', {}, h('label', { class: 'check' },
        h('input', { type: 'checkbox', checked: t.done, disabled: !canWork, onchange: async (e) => {
          const next = o.checklist.map((x, j) => (j === i ? { text: x.text, done: e.target.checked } : { text: x.text, done: x.done }));
          const { error } = await sb.from('work_orders').update({ checklist: next }).eq('id', o.id);
          if (error) { e.target.checked = !e.target.checked; toast(errMsg(error), 'error'); } else o.checklist = next;
        } }), h('span', {}, t.text)))));
    clear(box,
      h('header', { class: 'ph' },
        h('div', { class: 'ph-text' },
          h('a', { class: 'back', href: '#/ordenes' }, icon('back', 16), 'Órdenes'),
          eyebrow(`Orden #${o.id} · ${o.kind}`),
          h('h1', { class: 'display md' }, o.title),
          h('div', { class: 'row gap-sm wrap' }, prioChip(o.priority), h('span', { class: `status st-${o.status}` }, STATUS[o.status]),
            m ? h('a', { class: 'link', href: `#/maquinas/${m.id}` }, `${m.code} · ${m.name}`) : null)),
        h('div', { class: 'ph-actions' },
          canWork && o.status === 'abierta' ? h('button', { class: 'btn', type: 'button', onclick: async () => {
            const { error } = await sb.rpc('start_work_order', { p_order: o.id });
            if (error) toast(errMsg(error), 'error'); else { toast('Orden iniciada.'); load(); }
          } }, icon('wrench', 16), 'Iniciar') : null,
          canWork ? h('button', { class: 'btn primary', type: 'button', onclick: () => closeForm(o, part, load) }, icon('check', 16), 'Cerrar orden') : null,
          isAdmin() ? h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Eliminar orden', title: 'Eliminar', onclick: async () => {
            if (!await confirmDialog('¿Eliminar esta orden?', { ok: 'Eliminar', danger: true })) return;
            const { error } = await sb.from('work_orders').delete().eq('id', o.id);
            if (error) toast(errMsg(error), 'error'); else location.hash = '#/ordenes';
          } }, icon('trash', 18)) : null)),
      h('div', { class: 'cols' },
        h('section', { class: 'block card' },
          h('h2', { class: 'h-sm' }, 'Tareas'),
          (o.checklist || []).length ? checklist : empty('Sin tareas.'),
          o.description ? h('p', { class: 'prose' }, o.description) : null,
          h('h3', { class: 'h-xs' }, 'Pasos de seguridad'),
          o.safety_steps?.length ? h('ol', { class: 'safety' }, o.safety_steps.map((s) => h('li', {}, s))) : h('p', { class: 'muted' }, 'No se indicaron.'),
          notesBox(o, canWork)),
        h('section', { class: 'block card' },
          h('dl', { class: 'facts' },
            fact('Responsable', o.assignee ? h('a', { href: `#/perfil/${o.assignee}`, class: 'row gap-sm' }, avatar(profile(o.assignee), 26), profile(o.assignee).full_name) : 'Sin asignar'),
            fact('Creada por', o.created_by ? profile(o.created_by).full_name : 'Sistema'),
            fact('Creada', `${fdate(o.created_at)} (${rel(o.created_at)})`),
            fact('Fecha límite', o.due_date ? fdate(o.due_date) : '—'),
            fact('Tiempo estimado', `${num1(o.est_hours)} h`),
            o.started_at ? fact('Iniciada', fdate(o.started_at)) : null,
            o.status === 'cerrada' ? fact('Tiempo real', `${num1(o.real_hours)} h`) : null,
            o.status === 'cerrada' ? fact('Costo', cop(o.cost)) : null,
            part ? fact('Repuesto', `${part.name} × ${o.part_qty} (stock ${part.stock})`) : null))));
  };
  await load();
  page.append(box);
  return on('orders', (p) => { if ((p.new?.id || p.old?.id) === id) load().catch(() => {}); });
}

function notesBox(o, canWork) {
  if (!canWork) return o.notes ? h('div', {}, h('h3', { class: 'h-xs' }, 'Observaciones'), h('p', { class: 'prose' }, o.notes)) : null;
  const ta = textarea({ maxlength: 1000, value: o.notes || '', placeholder: 'Escribe observaciones del trabajo…' });
  return h('div', { class: 'stack' }, h('h3', { class: 'h-xs' }, 'Observaciones'), ta,
    h('button', { class: 'btn sm', type: 'button', onclick: async () => {
      try {
        const notes = V.text(ta.value, 0, 1000, 'Observaciones');
        const { error } = await sb.from('work_orders').update({ notes: notes || null }).eq('id', o.id);
        if (error) throw error; toast('Observaciones guardadas.');
      } catch (ex) { toast(errMsg(ex), 'error'); }
    } }, 'Guardar observaciones'));
}

function closeForm(o, part, reload) {
  const pending = (o.checklist || []).filter((t) => !t.done).length;
  formModal({
    title: 'Cerrar orden', submit: 'Cerrar orden',
    fields: [
      pending ? h('p', { class: 'callout' }, icon('alert', 16), `Quedan ${pending} tareas sin marcar.`) : null,
      h('div', { class: 'grid2' },
        field('Tiempo real (h)', input({ name: 'real_hours', inputmode: 'decimal', value: o.est_hours })),
        field('Costo de mano de obra y otros (COP)', input({ name: 'cost', inputmode: 'numeric', value: '0' }))),
      field('Observaciones finales', textarea({ name: 'notes', maxlength: 1000, value: o.notes || '' })),
      part ? h('p', { class: 'muted small' }, `Al cerrar se descontarán ${o.part_qty} × ${part.name} del inventario y se reiniciarán las horas de la máquina.`)
        : h('p', { class: 'muted small' }, 'Al cerrar se reiniciarán las horas desde el último mantenimiento de la máquina.'),
    ],
    onSubmit: async (fd) => {
      const partCost = part ? part.unit_cost * o.part_qty : 0;
      const { error } = await sb.rpc('close_work_order', {
        p_order: o.id,
        p_real_hours: V.num(fd.get('real_hours'), 0, 500, 'Tiempo real'),
        p_notes: V.text(fd.get('notes'), 0, 1000, 'Observaciones'),
        p_cost: V.num(fd.get('cost'), 0, 1e9, 'Costo', { int: true }) + partCost,
      });
      if (error) throw error;
      await loadParts();
      toast('Orden cerrada. La máquina volvió a su ciclo de mantenimiento.');
      reload();
    },
  });
}

const fact = (k, v) => h('div', { class: 'fact' }, h('dt', {}, k), h('dd', {}, v));
