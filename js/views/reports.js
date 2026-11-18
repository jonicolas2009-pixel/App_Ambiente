import { sb } from '../supabase.js';
import { h, clear, icon, pageHead, num, num1, cop, pct, fdate, toCSV, download, HOURS_PER_DAY, progress } from '../ui.js';
import { state, profile } from '../state.js';
import { barChart } from '../components.js';
import { kpis, sinceRatio, normCause } from '../kpi.js';

export async function render(page) {
  let days = 90;
  const box = h('div');
  const periodSel = h('div', { class: 'seg', role: 'group', 'aria-label': 'Periodo' });

  const load = async () => {
    const since = new Date(Date.now() - days * 86400e3).toISOString();
    const [f, o] = await Promise.all([
      sb.from('failures').select('id, machine_id, cause, downtime_hours, cost, occurred_at, reported_by').gte('occurred_at', since).order('occurred_at', { ascending: false }),
      sb.from('work_orders').select('id, machine_id, kind, cost, real_hours, closed_at').eq('status', 'cerrada').gte('closed_at', since),
    ]);
    if (f.error) throw f.error;
    if (o.error) throw o.error;
    paint(f.data, o.data);
  };

  const paint = (fails, orders) => {
    clear(periodSel, [30, 90, 180, 365].map((d) => h('button', { type: 'button', class: d === days ? 'on' : '', 'aria-pressed': String(d === days), onclick: () => { days = d; load(); } }, `${d} días`)));
    const k = kpis(fails, state.machines.length, days);
    const byMachine = (fn) => state.machines.map((m) => ({ label: m.code + ' ' + m.name, value: fn(m) })).sort((a, b) => b.value - a.value);
    const preventive = orders.filter((x) => x.kind === 'preventiva').reduce((a, x) => a + Number(x.cost || 0), 0);
    const correctiveOrders = orders.filter((x) => x.kind === 'correctiva').reduce((a, x) => a + Number(x.cost || 0), 0);
    const causes = {};
    for (const x of fails) { const c = normCause(x.cause); causes[c] = (causes[c] || 0) + 1; }
    const pareto = Object.entries(causes).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([label, value]) => ({ label: label.charAt(0).toUpperCase() + label.slice(1), value }));

    clear(box,
      h('div', { class: 'kpis' },
        kpi('Disponibilidad', pct(k.availability), `${num(k.planned)} h planeadas`, 'inv'),
        kpi('MTBF', k.mtbf === null ? '—' : `${num1(k.mtbf)} h`, `${k.n} fallas en el periodo`),
        kpi('MTTR', k.mttr === null ? '—' : `${num1(k.mttr)} h`, `${num1(k.downtime)} h de paro`),
        kpi('Costo correctivo', cop(k.correctiveCost + correctiveOrders), `Preventivo: ${cop(preventive)}`, '', 'sm')),
      h('p', { class: 'footnote' }, `Disponibilidad = (horas planeadas − horas de paro) ÷ horas planeadas. MTBF = horas de operación ÷ número de fallas. MTTR = horas de paro ÷ número de fallas. Supuesto: ${HOURS_PER_DAY} h de operación al día por máquina.`),
      h('div', { class: 'cols' },
        chartCard('Fallas por máquina', barChart(byMachine((m) => fails.filter((x) => x.machine_id === m.id).length), { format: num })),
        chartCard('Horas de paro por máquina', barChart(byMachine((m) => fails.filter((x) => x.machine_id === m.id).reduce((a, x) => a + Number(x.downtime_hours), 0)), { unit: ' h' }))),
      h('div', { class: 'cols' },
        chartCard('Causas más frecuentes (Pareto)', barChart(pareto, { format: num })),
        chartCard('Costo preventivo vs. correctivo', barChart([
          { label: 'Preventivo (órdenes)', value: preventive, cls: 'ok' },
          { label: 'Correctivo (fallas + órdenes)', value: k.correctiveCost + correctiveOrders, cls: 'bad' }], { format: cop }))),
      chartCard('Avance hacia el próximo mantenimiento', h('div', { class: 'stack' }, state.machines.map((m) => h('div', { class: 'prog-row' },
        h('span', { class: 'prog-label' }, `${m.code} ${m.name}`), progress(sinceRatio(m), m.level),
        h('span', { class: 'small muted' }, `${Math.round(sinceRatio(m) * 100)} %`))))),
      h('div', { class: 'row gap wrap no-print actions-bar' },
        h('button', { class: 'btn', type: 'button', onclick: () => download(`maqnex-fallas-${days}d.csv`, toCSV([
          ['Fecha', 'Máquina', 'Causa', 'Horas de paro', 'Costo COP', 'Reportó'],
          ...fails.map((x) => [fdate(x.occurred_at), state.machines.find((m) => m.id === x.machine_id)?.code || '', x.cause, x.downtime_hours, x.cost, x.reported_by ? profile(x.reported_by).full_name : 'Sistema'])]), 'text/csv;charset=utf-8') }, icon('download', 16), 'Exportar fallas (CSV/Excel)'),
        h('button', { class: 'btn', type: 'button', onclick: () => print() }, icon('printer', 16), 'Imprimir o guardar PDF')));
  };

  page.append(pageHead('Análisis', 'Reportes', 'Indicadores de mantenimiento de la planta.', periodSel), box);
  await load();
}

const kpi = (label, value, sub, cls = '', vcls = '') => h('div', { class: `kpi card ${cls}` }, h('span', { class: 'kpi-label' }, label), h('strong', { class: `kpi-value ${vcls}` }, value), h('span', { class: 'kpi-sub' }, sub));
const chartCard = (title, body) => h('section', { class: 'block card' }, h('h2', { class: 'h-sm' }, title), body);
