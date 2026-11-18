import { sb } from '../supabase.js';
import { h, clear, icon, eyebrow, levelChip, prioChip, progress, num1, cop, fdate, rel, STAGES, STATUS, empty, errMsg, toast, confirmDialog, HOURS_PER_DAY } from '../ui.js';
import { state, on, isStaff, isAdmin, profile, machine, loadMachines } from '../state.js';
import { lineChart } from '../components.js';
import { nextService, sinceRatio, normCause } from '../kpi.js';
import { failureForm, hoursForm, orderForm, machineForm } from '../actions.js';

const LOG_LABEL = { horas: 'Horas', mantenimiento: 'Mantenimiento', orden: 'Orden', falla: 'Falla', alta: 'Registro' };

export async function render(page, { param }) {
  const id = Number(param);
  if (!Number.isInteger(id) || !machine(id)) {
    page.append(empty('Esta máquina no existe o fue eliminada.', h('a', { class: 'btn', href: '#/maquinas' }, 'Volver a máquinas')));
    return;
  }
  const [rd, fl, od, lg] = await Promise.all([
    sb.from('sensor_readings').select('id, temperature, vibration, recorded_at').eq('machine_id', id).order('recorded_at', { ascending: false }).limit(40),
    sb.from('failures').select('id, cause, downtime_hours, cost, occurred_at, reported_by').eq('machine_id', id).order('occurred_at', { ascending: false }).limit(50),
    sb.from('work_orders').select('id, title, priority, status, assignee, created_at').eq('machine_id', id).order('created_at', { ascending: false }).limit(20),
    sb.from('machine_logs').select('id, kind, value, note, user_id, created_at').eq('machine_id', id).order('created_at', { ascending: false }).limit(20),
  ]);
  for (const r of [rd, fl, od, lg]) if (r.error) throw r.error;
  let readings = rd.data.reverse();

  const head = h('header', { class: 'ph' });
  const stats = h('div', { class: 'stats' });
  const chartBox = h('div', { class: 'chart-box' });
  const liveVal = h('div', { class: 'live-values' });

  const paintHead = () => {
    const m = machine(id);
    if (!m) return;
    const ns = nextService(m);
    clear(head,
      h('div', { class: 'ph-text' },
        h('a', { class: 'back', href: '#/maquinas' }, icon('back', 16), 'Máquinas'),
        eyebrow(`${m.code} · ${STAGES[m.stage]} · ${m.area}`),
        h('h1', { class: 'display md' }, m.name),
        h('div', { class: 'row gap-sm wrap' }, levelChip(m.level), m.model ? h('span', { class: 'muted' }, m.model) : null)),
      h('div', { class: 'ph-actions wrap' },
        h('button', { class: 'btn', type: 'button', onclick: () => hoursForm(id) }, icon('clock', 16), 'Registrar horas'),
        h('button', { class: 'btn', type: 'button', onclick: () => failureForm(id) }, icon('alert', 16), 'Registrar falla'),
        isStaff() ? h('button', { class: 'btn primary', type: 'button', onclick: () => orderForm(id) }, icon('orders', 16), 'Crear orden') : null));
    clear(stats,
      stat('Horas desde el último mantenimiento', `${num1(m.hours_since_service)} h`, progress(sinceRatio(m), m.level), `de ${m.interval_hours} h del intervalo`),
      stat('Próximo mantenimiento', ns.overdue ? 'Vencido' : fdate(ns.date), null, ns.overdue ? 'Ya superó el intervalo' : `faltan ${num1(ns.left)} h (≈${HOURS_PER_DAY} h/día)`),
      stat('Horas de uso totales', `${num1(m.hours_total)} h`, null, m.last_service_at ? `Último mantenimiento ${fdate(m.last_service_at)}` : 'Sin mantenimientos registrados'),
      stat('Valores normales', `${num1(m.temp_base)} °C · ${num1(m.vib_base)} mm/s`, null, 'Alerta: >75 °C o >4,5 mm/s'));
  };

  const paintChart = () => {
    const m = machine(id);
    clear(chartBox, lineChart([{ cls: 'temp', values: readings.map((r) => ({ v: Number(r.temperature) })) }], { thresholds: [{ v: 75, cls: 'warn' }, { v: 85, cls: 'bad' }] }),
      h('div', { class: 'chart-cap' }, h('span', { class: 'dot temp' }), 'Temperatura (°C)'),
      lineChart([{ cls: 'vib', values: readings.map((r) => ({ v: Number(r.vibration) })) }], { height: 140, thresholds: [{ v: 4.5, cls: 'warn' }, { v: 6.5, cls: 'bad' }] }),
      h('div', { class: 'chart-cap' }, h('span', { class: 'dot vib' }), 'Vibración (mm/s)'));
    const last = readings[readings.length - 1];
    clear(liveVal,
      h('div', {}, h('span', { class: 'kpi-label' }, 'Temperatura'), h('strong', { class: 'kpi-value' }, last ? `${num1(last.temperature)} °C` : '—')),
      h('div', {}, h('span', { class: 'kpi-label' }, 'Vibración'), h('strong', { class: 'kpi-value' }, last ? `${num1(last.vibration)} mm/s` : '—')),
      h('div', {}, h('span', { class: 'kpi-label' }, 'Última lectura'), h('strong', { class: 'small' }, last ? rel(last.recorded_at) : 'Sin lecturas')));
    void m;
  };

  // ----- Sensor IoT simulado en el servidor -----
  let timer = null;
  const liveToggle = h('input', { type: 'checkbox', checked: true });
  const tick = async () => {
    if (document.hidden) return;
    const { error } = await sb.rpc('simulate_reading', { p_machine: id, p_anomaly: false });
    if (error) { liveToggle.checked = false; stop(); toast(errMsg(error), 'error'); }
  };
  const start = () => { stop(); tick(); timer = setInterval(tick, 4000); };
  const stop = () => { clearInterval(timer); timer = null; };
  liveToggle.addEventListener('change', () => liveToggle.checked ? start() : stop());

  const staffTools = isStaff() ? h('div', { class: 'row gap-sm wrap' },
    h('button', { class: 'btn sm', type: 'button', onclick: async () => {
      const { error } = await sb.rpc('simulate_reading', { p_machine: id, p_anomaly: true });
      if (error) toast(errMsg(error), 'error'); else toast('Anomalía simulada: el servidor generó una lectura fuera de rango.', 'info');
    } }, icon('pulse', 16), 'Simular anomalía'),
    h('button', { class: 'btn sm', type: 'button', onclick: async () => {
      if (!await confirmDialog('¿Registrar mantenimiento realizado? Esto reinicia las horas desde el último mantenimiento.')) return;
      const { error } = await sb.rpc('register_maintenance', { p_machine: id, p_note: 'Mantenimiento registrado desde la ficha' });
      if (error) toast(errMsg(error), 'error'); else { await loadMachines(); toast('Mantenimiento registrado.'); }
    } }, icon('wrench', 16), 'Registrar mantenimiento'),
    h('button', { class: 'btn sm ghost', type: 'button', onclick: () => machineForm(machine(id)) }, icon('edit', 16), 'Editar'),
    isAdmin() ? h('button', { class: 'btn sm ghost danger-text', type: 'button', onclick: async () => {
      if (!await confirmDialog('¿Eliminar esta máquina con todo su historial? No se puede deshacer.', { ok: 'Eliminar', danger: true })) return;
      const { error } = await sb.from('machines').delete().eq('id', id);
      if (error) toast(errMsg(error), 'error'); else { await loadMachines(); toast('Máquina eliminada.'); location.hash = '#/maquinas'; }
    } }, icon('trash', 16), 'Eliminar') : null) : null;

  // Fallas repetidas (apoyo, no reemplaza el criterio del técnico)
  const counts = {};
  for (const f of fl.data) { const k = normCause(f.cause); counts[k] = (counts[k] || 0) + 1; }
  const repeated = Object.entries(counts).filter(([, n]) => n >= 2);

  const failuresTable = fl.data.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
    h('thead', {}, h('tr', {}, ['Fecha', 'Causa', 'Paro', 'Costo', 'Reportó'].map((t) => h('th', {}, t)))),
    h('tbody', {}, fl.data.map((f) => h('tr', {},
      h('td', {}, fdate(f.occurred_at)), h('td', {}, f.cause), h('td', {}, `${num1(f.downtime_hours)} h`), h('td', {}, cop(f.cost)),
      h('td', {}, f.reported_by ? profile(f.reported_by).full_name : 'Sistema'))))))
    : empty('Sin fallas registradas.');

  const ordersList = od.data.length ? h('div', { class: 'list' }, od.data.map((o) => h('a', { class: 'list-item', href: `#/ordenes/${o.id}` },
    h('span', { class: 'grow' }, h('strong', {}, o.title), h('span', { class: 'muted small' }, ` · ${STATUS[o.status]}${o.assignee ? ' · ' + profile(o.assignee).full_name : ''}`)), prioChip(o.priority))))
    : empty('Sin órdenes de trabajo.');

  const logList = lg.data.length ? h('ul', { class: 'timeline' }, lg.data.map((l) => h('li', {},
    h('span', { class: 'tl-kind' }, LOG_LABEL[l.kind] || l.kind),
    h('span', { class: 'grow' }, l.note, l.value !== null && l.kind === 'horas' ? ` (+${num1(l.value)} h)` : ''),
    h('span', { class: 'muted small' }, `${l.user_id ? profile(l.user_id).full_name + ' · ' : ''}${rel(l.created_at)}`))))
    : empty('Sin actividad.');

  paintHead(); paintChart();
  page.append(head, stats,
    h('section', { class: 'block card' },
      h('div', { class: 'block-head' }, h('h2', { class: 'h-sm' }, icon('pulse', 18), ' Sensores IoT'),
        h('label', { class: 'switch' }, liveToggle, h('span', {}, 'Monitoreo en vivo'))),
      liveVal, chartBox,
      h('p', { class: 'footnote' }, 'Lecturas simuladas por el servidor alrededor de los valores normales de la máquina (una cada 4 s mientras esta página está abierta). Un sensor real (por ejemplo un ESP32) enviaría sus datos a la misma tabla.'),
      staffTools),
    repeated.length ? h('div', { class: 'callout' }, icon('alert', 18),
      h('span', {}, `Falla repetida: "${repeated[0][0]}" aparece ${repeated[0][1]} veces. Conviene revisar la causa raíz. Es un apoyo y no reemplaza el criterio del técnico.`)) : null,
    h('div', { class: 'cols' },
      h('section', { class: 'block card' }, h('div', { class: 'block-head' }, h('h2', { class: 'h-sm' }, 'Órdenes de trabajo')), ordersList),
      h('section', { class: 'block card' }, h('div', { class: 'block-head' }, h('h2', { class: 'h-sm' }, 'Bitácora')), logList)),
    h('section', { class: 'block card' }, h('div', { class: 'block-head' }, h('h2', { class: 'h-sm' }, 'Historial de fallas')), failuresTable));

  start();
  const offs = [
    on('machines', paintHead),
    on('reading', (r) => {
      if (r.machine_id !== id || readings.some((x) => x.id === r.id)) return;
      readings = [...readings, r].slice(-40);
      paintChart();
    }),
  ];
  return () => { stop(); offs.forEach((f) => f()); };
}

function stat(label, value, extra, sub) {
  return h('div', { class: 'stat card' }, h('span', { class: 'kpi-label' }, label), h('strong', { class: 'stat-value' }, value), extra, h('span', { class: 'kpi-sub' }, sub));
}
