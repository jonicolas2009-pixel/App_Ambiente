import { sb } from '../supabase.js';
import { h, clear, icon, pageHead, num, cop, empty, errMsg, toast, confirmDialog, formModal, field, input, V } from '../ui.js';
import { state, on, isStaff, isAdmin, loadParts } from '../state.js';
import { partForm } from '../actions.js';

export async function render(page) {
  await loadParts();
  const box = h('div');
  const paint = () => {
    const low = state.parts.filter((p) => p.stock < p.min_stock);
    const value = state.parts.reduce((a, p) => a + p.stock * p.unit_cost, 0);
    clear(box,
      h('div', { class: 'kpis three' },
        h('div', { class: 'kpi card inv' }, h('span', { class: 'kpi-label' }, 'Referencias'), h('strong', { class: 'kpi-value' }, num(state.parts.length))),
        h('div', { class: 'kpi card' }, h('span', { class: 'kpi-label' }, 'Con stock bajo'), h('strong', { class: 'kpi-value' }, num(low.length))),
        h('div', { class: 'kpi card' }, h('span', { class: 'kpi-label' }, 'Valor del inventario'), h('strong', { class: 'kpi-value sm' }, cop(value)))),
      state.parts.length ? h('div', { class: 'table-wrap card' }, h('table', { class: 'table' },
        h('thead', {}, h('tr', {}, ['Referencia', 'Repuesto', 'Stock', 'Mínimo', 'Costo unitario', ''].map((t) => h('th', {}, t)))),
        h('tbody', {}, state.parts.map((p) => h('tr', { class: p.stock < p.min_stock ? 'row-warn' : '' },
          h('td', { class: 'mono small' }, p.sku),
          h('td', {}, p.name, p.stock < p.min_stock ? h('span', { class: 'chip lv-recomendado tiny' }, h('i'), 'Stock bajo') : null),
          h('td', {}, h('strong', {}, num(p.stock))), h('td', {}, num(p.min_stock)), h('td', {}, cop(p.unit_cost)),
          h('td', { class: 'actions' }, isStaff() ? [
            h('button', { class: 'btn sm', type: 'button', onclick: () => adjust(p) }, 'Ajustar stock'),
            h('button', { class: 'iconbtn', type: 'button', 'aria-label': `Editar ${p.name}`, onclick: () => partForm(p) }, icon('edit', 16)),
            isAdmin() ? h('button', { class: 'iconbtn', type: 'button', 'aria-label': `Eliminar ${p.name}`, onclick: () => remove(p) }, icon('trash', 16)) : null,
          ] : null)))))) : empty('Aún no hay repuestos registrados.'));
  };
  paint();
  page.append(pageHead('Inventario', 'Repuestos', 'Stock disponible para las órdenes de trabajo. Se descuenta solo al cerrar una orden.',
    isStaff() ? h('button', { class: 'btn primary', type: 'button', onclick: () => partForm() }, icon('plus', 16), 'Nuevo repuesto') : null), box);
  return on('parts', paint);
}

function adjust(p) {
  formModal({
    title: `Ajustar stock · ${p.name}`, submit: 'Guardar',
    fields: [field('Unidades que entran (+) o salen (−)', input({ name: 'delta', inputmode: 'numeric', value: '1' }), `Stock actual: ${p.stock}`)],
    onSubmit: async (fd) => {
      const delta = V.num(fd.get('delta'), -100000, 100000, 'Cantidad', { int: true });
      const stock = p.stock + delta;
      if (stock < 0) throw new Error('El stock no puede quedar negativo.');
      const { data, error } = await sb.from('parts').update({ stock }).eq('id', p.id).eq('stock', p.stock).select('id');
      if (error) throw error;
      if (!data?.length) { await loadParts(); throw new Error('Alguien cambió el stock mientras editabas. Revisa el valor e intenta de nuevo.'); }
      await loadParts();
      toast(`Stock actualizado: ${stock}.`);
    },
  });
}

async function remove(p) {
  if (!await confirmDialog(`¿Eliminar ${p.name} del inventario?`, { ok: 'Eliminar', danger: true })) return;
  const { error } = await sb.from('parts').delete().eq('id', p.id);
  if (error) toast(errMsg(error), 'error'); else { await loadParts(); toast('Repuesto eliminado.'); }
}
