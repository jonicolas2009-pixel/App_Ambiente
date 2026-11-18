import { h, clear, pageHead, input, LEVELS, STAGES, empty, icon } from '../ui.js';
import { state, on, isStaff } from '../state.js';
import { machineTile } from './dashboard.js';
import { machineForm } from '../actions.js';

export async function render(page, { query }) {
  let level = LEVELS[query?.get('nivel')] ? query.get('nivel') : '';
  let stage = '';
  const search = input({ type: 'search', placeholder: 'Buscar por nombre o código', 'aria-label': 'Buscar máquinas', maxlength: 60 });
  const filters = h('div', { class: 'filters' });
  const grid = h('div', { class: 'mgrid' });

  const paintFilters = () => clear(filters,
    h('div', { class: 'seg', role: 'group', 'aria-label': 'Filtrar por estado' },
      [['', 'Todas'], ...Object.entries(LEVELS).map(([k, v]) => [k, v.label])].map(([k, l]) =>
        h('button', { type: 'button', class: level === k ? 'on' : '', 'aria-pressed': String(level === k), onclick: () => { level = k; paintFilters(); paint(); } }, l))),
    h('select', { class: 'input slim', 'aria-label': 'Filtrar por etapa', onchange: (e) => { stage = e.target.value; paint(); } },
      [['', 'Todas las etapas'], ...Object.entries(STAGES)].map(([k, l]) => h('option', { value: k, selected: k === stage }, l))));

  const paint = () => {
    const q = search.value.trim().toLowerCase();
    const list = state.machines.filter((m) => (!level || m.level === level) && (!stage || m.stage === stage)
      && (!q || `${m.name} ${m.code} ${m.model}`.toLowerCase().includes(q)));
    clear(grid, list.length ? list.map(machineTile) : empty('No hay máquinas con esos filtros.'));
  };
  search.addEventListener('input', paint);
  paintFilters(); paint();

  page.append(
    pageHead('Planta de bebidas', 'Máquinas', `${state.machines.length} equipos registrados en la línea.`,
      isStaff() ? h('button', { class: 'btn primary', type: 'button', onclick: () => machineForm() }, icon('plus', 16), 'Nueva máquina') : null),
    h('div', { class: 'toolbar' }, h('div', { class: 'search' }, icon('search', 18), search), filters),
    grid);
  return on('machines', paint);
}
