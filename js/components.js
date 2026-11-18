// Piezas de interfaz que dependen del estado (avatares, personas, gráficas).
import { h, initials, roleChip, num1 } from './ui.js';
import { state } from './state.js';

const AV_COLORS = ['#8052ff', '#15846e', '#c8742f', '#3a6df0', '#b8336a', '#5b8c00'];

export function avatar(p, size = 40) {
  const url = p?.avatar_path ? state.avatarUrls.get(p.avatar_path) : null;
  const box = h('span', { class: 'avatar', title: p?.full_name || '' });
  box.style.width = box.style.height = size + 'px';
  box.style.fontSize = Math.round(size * 0.38) + 'px';
  if (url) {
    box.append(h('img', { src: url, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer', width: size, height: size }));
  } else {
    let hash = 0; for (const c of p?.id || '') hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
    box.style.background = AV_COLORS[hash % AV_COLORS.length];
    box.textContent = initials(p?.full_name);
  }
  return box;
}

export function personLine(p, extra) {
  return h('a', { class: 'person', href: `#/perfil/${p.id}` },
    avatar(p, 40),
    h('span', { class: 'person-text' },
      h('strong', {}, p.full_name),
      h('span', { class: 'person-meta' }, roleChip(p.role), h('span', { class: 'muted' }, p.area))),
    extra || null);
}

// Barras horizontales (div) — legibles en celular y fáciles de imprimir.
export function barChart(items, { format = num1, unit = '', max } = {}) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return h('p', { class: 'muted' }, 'Sin datos en este periodo.');
  return h('div', { class: 'bars' }, items.map((it) => {
    const fill = h('i', { class: it.cls || '' });
    fill.style.width = Math.max(0.5, (it.value / top) * 100) + '%';
    return h('div', { class: 'bars-row' },
      h('span', { class: 'bars-label', title: it.label }, it.label),
      h('span', { class: 'bars-track' }, fill),
      h('span', { class: 'bars-value' }, format(it.value) + unit));
  }));
}

// Gráfica de líneas en SVG para las lecturas de los sensores.
const NS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs) => { const el = document.createElementNS(NS, tag); for (const k in attrs) el.setAttribute(k, attrs[k]); return el; };

export function lineChart(series, { height = 180, thresholds = [] } = {}) {
  const W = 600, H = height, padL = 34, padR = 10, padT = 10, padB = 20;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'linechart', role: 'img', preserveAspectRatio: 'none' });
  const all = series.flatMap((se) => se.values.map((v) => v.v)).concat(thresholds.map((t) => t.v));
  if (!series.some((se) => se.values.length)) {
    const t = s('text', { x: W / 2, y: H / 2, 'text-anchor': 'middle', class: 'lc-empty' }); t.textContent = 'Esperando lecturas…'; svg.append(t);
    return svg;
  }
  let lo = Math.min(...all), hi = Math.max(...all);
  if (hi - lo < 1) { hi += 1; lo -= 1; }
  const pad = (hi - lo) * 0.12; lo -= pad; hi += pad;
  const n = Math.max(...series.map((se) => se.values.length));
  const x = (i) => padL + (i / Math.max(1, n - 1)) * (W - padL - padR);
  const y = (v) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);
  for (let k = 0; k <= 3; k++) {
    const v = lo + ((hi - lo) * k) / 3;
    svg.append(s('line', { x1: padL, x2: W - padR, y1: y(v), y2: y(v), class: 'lc-grid' }));
    const lab = s('text', { x: padL - 6, y: y(v) + 4, 'text-anchor': 'end', class: 'lc-axis' }); lab.textContent = num1(v); svg.append(lab);
  }
  for (const t of thresholds) {
    svg.append(s('line', { x1: padL, x2: W - padR, y1: y(t.v), y2: y(t.v), class: `lc-th ${t.cls || ''}` }));
  }
  for (const se of series) {
    if (!se.values.length) continue;
    const off = n - se.values.length;
    const pts = se.values.map((v, i) => `${x(i + off).toFixed(1)},${y(v.v).toFixed(1)}`).join(' ');
    svg.append(s('polyline', { points: pts, class: `lc-line ${se.cls}`, fill: 'none', 'vector-effect': 'non-scaling-stroke' }));
    const last = se.values[se.values.length - 1];
    svg.append(s('circle', { cx: x(n - 1), cy: y(last.v), r: 3.5, class: `lc-dot ${se.cls}` }));
  }
  return svg;
}
