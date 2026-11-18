// Indicadores de mantenimiento (ingeniería industrial).
// Supuesto declarado en pantalla: cada máquina opera HOURS_PER_DAY horas al día.
import { HOURS_PER_DAY } from './ui.js';

export function kpis(failures, machineCount, days) {
  const planned = days * HOURS_PER_DAY * Math.max(1, machineCount);
  const downtime = failures.reduce((a, f) => a + Number(f.downtime_hours || 0), 0);
  const n = failures.length;
  const operating = Math.max(0, planned - downtime);
  return {
    planned, downtime, n,
    availability: planned ? (operating / planned) * 100 : 100,
    mtbf: n ? operating / n : null,
    mttr: n ? downtime / n : null,
    correctiveCost: failures.reduce((a, f) => a + Number(f.cost || 0), 0),
  };
}

// Próximo mantenimiento estimado a partir de las horas que faltan.
export function nextService(m) {
  const left = Number(m.interval_hours) - Number(m.hours_since_service);
  if (left <= 0) return { left: 0, date: new Date(), overdue: true };
  const days = left / HOURS_PER_DAY;
  return { left, date: new Date(Date.now() + days * 86400e3), overdue: false };
}

export const sinceRatio = (m) => Number(m.hours_since_service) / Math.max(1, Number(m.interval_hours));

export const normCause = (c) => String(c || '').replace(/\(histórico de ejemplo\)/i, '').trim().toLowerCase();
