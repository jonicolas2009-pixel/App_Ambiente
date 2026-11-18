import { sb } from '../supabase.js';
import { h, clear, pageHead, levelChip, prioChip, progress, num1, pct, fdate, rel, STAGES, LEVELS, HOURS_PER_DAY, empty, icon } from '../ui.js';
import { state, on, isStaff } from '../state.js';
import { kpis, sinceRatio } from '../kpi.js';
import { orderForm } from '../actions.js';

const DAYS = 90;

export async function render(page) {
  const since = new Date(Date.now() - DAYS * 86400e3).toISOString();
  const [fails, myOrders] = await Promise.all([
    sb.from('failures').select('id, machine_id, downtime_hours, cost, occurred_at').gte('occurred_at', since),
    sb.from('work_orders').select('id, title, priority, status, due_date, machine_id').eq('assignee', state.me.id).neq('status', 'cerrada').order('priority', { ascending: false }).limit(6),
  ]);
  if (fails.error) throw fails.error;
  const first = (state.me.full_name || '').split(' ')[0];
  const hour = new Date().getHours();
  const hello = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches';

  const kpiBox = h('section', { class: 'kpis' });
  const lightsBox = h('div', { class: 'lights' });
  const lineBox = h('div', { class: 'line' });
  const alertsBox = h('div', { class: 'list' });

  const paint = () => {
    const k = kpis(fails.data, state.machines.length, DAYS);
    const active = state.machines.filter((m) => LEVELS[m.level].order >= 2);
    clear(kpiBox,
      kpi('Disponibilidad', pct(k.availability), `Últimos ${DAYS} días`, 'inv'),
      kpi('MTBF', k.mtbf === null ? '—' : `${num1(k.mtbf)} h`, 'Tiempo medio entre fallas'),
      kpi('MTTR', k.mttr === null ? '—' : `${num1(k.mttr)} h`, 'Tiempo medio de reparación'),
      kpi('Alertas activas', String(active.length), active.length ? 'Requieren atención' : 'Todo en orden'));
    clear(lightsBox, Object.keys(LEVELS).map((lv) =>
      h('a', { class: `light lv-${lv}`, href: `#/maquinas?nivel=${lv}` }, h('b', {}, String(state.machines.filter((m) => m.level === lv).length)), levelChip(lv))));
    clear(lineBox, Object.entries(STAGES).map(([key, label], i) => {
      const ms = state.machines.filter((m) => m.stage === key);
      return h('div', { class: 'stage' },
        h('div', { class: 'stage-head' }, h('span', { class: 'stage-n' }, String(i + 1).padStart(2, '0')), h('span', {}, label)),
        ms.length ? ms.map(machineTile) : h('p', { class: 'muted small' }, 'Sin máquinas en esta etapa.'));
    }));
    clear(alertsBox, active.length ? active.sort((a, b) => LEVELS[b.level].order - LEVELS[a.level].order).map((m) =>
      h('div', { class: 'list-item' },
        h('a', { href: `#/maquinas/${m.id}`, class: 'grow' }, h('strong', {}, `${m.name}`), h('span', { class: 'muted small' }, ` ${m.code} · ${num1(m.hours_since_service)} / ${m.interval_hours} h` + (m.last_temp ? ` · ${num1(m.last_temp)} °C` : ''))),
        levelChip(m.level),
        isStaff() ? h('button', { class: 'btn sm', type: 'button', onclick: () => orderForm(m.id) }, 'Crear orden') : null))
      : empty('No hay máquinas en estado recomendado o de prioridad alta.'));
  };
  paint();

  const ordersList = myOrders.data?.length
    ? h('div', { class: 'list' }, myOrders.data.map((o) => h('a', { class: 'list-item', href: `#/ordenes/${o.id}` },
      h('span', { class: 'grow' }, h('strong', {}, o.title), h('span', { class: 'muted small' }, ` ${state.machines.find((m) => m.id === o.machine_id)?.code || ''} · ${o.due_date ? 'vence ' + fdate(o.due_date) : 'sin fecha'}`)),
      prioChip(o.priority))))
    : empty('No tienes órdenes pendientes.');

  page.append(
    pageHead(`Planta de bebidas · ${fdate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })}`, `${hello}, ${first}.`, 'Así está la línea de producción en este momento.'),
    kpiBox,
    h('p', { class: 'footnote' }, `Indicadores calculados con las fallas registradas en los últimos ${DAYS} días, suponiendo ${HOURS_PER_DAY} h de operación al día por máquina.`),
    h('section', { class: 'block' }, h('div', { class: 'block-head' }, h('h2', { class: 'h-md' }, 'Semáforo')), lightsBox),
    h('section', { class: 'block' }, h('div', { class: 'block-head' }, h('h2', { class: 'h-md' }, 'Línea de producción'), h('a', { class: 'link', href: '#/maquinas' }, 'Ver todas')), lineBox),
    h('div', { class: 'cols' },
      h('section', { class: 'block card' }, h('div', { class: 'block-head' }, h('h2', { class: 'h-sm' }, icon('alert', 18), ' Alertas')), alertsBox),
      h('section', { class: 'block card' }, h('div', { class: 'block-head' }, h('h2', { class: 'h-sm' }, icon('orders', 18), ' Mis órdenes'), h('a', { class: 'link', href: '#/ordenes' }, 'Todas')), ordersList)));

  return on('machines', paint);
}

function kpi(label, value, sub, cls = '') {
  return h('div', { class: `kpi card ${cls}` }, h('span', { class: 'kpi-label' }, label), h('strong', { class: 'kpi-value' }, value), h('span', { class: 'kpi-sub' }, sub));
}

export function machineTile(m) {
  return h('a', { class: `mtile lv-${m.level}`, href: `#/maquinas/${m.id}` },
    h('div', { class: 'mtile-top' }, h('span', { class: 'mono small' }, m.code), levelChip(m.level)),
    h('strong', { class: 'mtile-name' }, m.name),
    progress(sinceRatio(m), m.level),
    h('div', { class: 'mtile-meta' },
      h('span', {}, `${num1(m.hours_since_service)} / ${m.interval_hours} h`),
      h('span', {}, m.last_temp !== null && m.last_temp !== undefined ? `${num1(m.last_temp)} °C · ${num1(m.last_vib)} mm/s` : 'Sin lecturas'),
      m.last_reading_at ? h('span', { class: 'muted' }, rel(m.last_reading_at)) : null));
}
