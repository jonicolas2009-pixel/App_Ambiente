// Formularios compartidos (botón "+" y botones dentro de las vistas).
import { sb } from './supabase.js';
import { h, icon, formModal, field, input, textarea, select, V, AREAS, STAGES, PRIORITIES, toast, num } from './ui.js';
import { state, isStaff, loadMachines, loadParts, MACHINE_COLS } from './state.js';

const machineOptions = () => state.machines.map((m) => [m.id, `${m.code} · ${m.name}`]);
const peopleOptions = () => [['', 'Sin asignar'], ...[...state.profiles.values()].map((p) => [p.id, `${p.full_name} (${p.role === 'tecnico' ? 'Técnico' : p.role === 'supervisor' ? 'Supervisor' : 'Admin'})`])];
const lines = (txt, max, label) => String(txt || '').split('\n').map((s) => s.trim()).filter(Boolean).map((s) => V.text(s, 1, 120, label)).slice(0, max);

export function openFabMenu(anchor) {
  document.querySelector('.fab-menu')?.remove();
  const items = [
    isStaff() && ['machine', 'Nueva máquina', () => machineForm()],
    ['alert', 'Registrar falla', () => failureForm()],
    ['clock', 'Registrar horas de uso', () => hoursForm()],
    isStaff() && ['orders', 'Nueva orden de trabajo', () => orderForm()],
    ['hash', 'Crear canal', () => channelForm()],
    isStaff() && ['parts', 'Nuevo repuesto', () => partForm()],
  ].filter(Boolean);
  const menu = h('div', { class: 'fab-menu', role: 'menu' }, items.map(([ic, label, fn]) =>
    h('button', { type: 'button', role: 'menuitem', onclick: () => { menu.remove(); fn(); } }, icon(ic, 18), label)));
  document.body.append(menu);
  anchor.classList.add('open');
  const close = (e) => {
    if (e && (menu.contains(e.target) || anchor.contains(e.target))) return;
    menu.remove(); anchor.classList.remove('open');
    document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', esc);
  };
  const esc = (e) => { if (e.key === 'Escape') close(); };
  setTimeout(() => { document.addEventListener('pointerdown', close); document.addEventListener('keydown', esc); });
  menu.addEventListener('click', () => anchor.classList.remove('open'));
  menu.querySelector('button')?.focus();
}

export function machineForm(m) {
  const edit = !!m;
  formModal({
    title: edit ? `Editar ${m.code}` : 'Nueva máquina', submit: edit ? 'Guardar cambios' : 'Agregar máquina', wide: true,
    fields: [
      h('div', { class: 'grid2' },
        field('Código', input({ name: 'code', value: m?.code || '', maxlength: 20, placeholder: 'ET-01', disabled: edit }), 'Letras mayúsculas, números y guion.'),
        field('Nombre', input({ name: 'name', value: m?.name || '', maxlength: 80, placeholder: 'Etiquetadora' }))),
      field('Modelo o descripción', input({ name: 'model', value: m?.model || '', maxlength: 80 })),
      h('div', { class: 'grid2' },
        field('Etapa de la línea', select('stage', Object.entries(STAGES), m?.stage || 'llenado')),
        field('Área responsable', select('area', AREAS.map((a) => [a, a]), m?.area || 'Producción'))),
      h('div', { class: 'grid3' },
        !edit && field('Horas de uso totales', input({ name: 'hours_total', inputmode: 'decimal', value: '0' })),
        field('Mantenimiento cada (h)', input({ name: 'interval_hours', inputmode: 'numeric', value: m?.interval_hours ?? 500 })),
        !edit && field('Horas desde el último', input({ name: 'hours_since_service', inputmode: 'decimal', value: '0' }))),
      h('div', { class: 'grid2' },
        field('Temperatura normal (°C)', input({ name: 'temp_base', inputmode: 'decimal', value: m?.temp_base ?? 55 })),
        field('Vibración normal (mm/s)', input({ name: 'vib_base', inputmode: 'decimal', value: m?.vib_base ?? 2.5 }))),
    ],
    onSubmit: async (fd) => {
      const row = {
        name: V.text(fd.get('name'), 2, 80, 'Nombre'),
        model: V.text(fd.get('model'), 0, 80, 'Modelo'),
        stage: V.oneOf(fd.get('stage'), Object.keys(STAGES), 'Etapa'),
        area: V.oneOf(fd.get('area'), AREAS, 'Área'),
        interval_hours: V.num(fd.get('interval_hours'), 10, 20000, 'Intervalo', { int: true }),
        temp_base: V.num(fd.get('temp_base'), 0, 150, 'Temperatura'),
        vib_base: V.num(fd.get('vib_base'), 0, 20, 'Vibración'),
      };
      if (edit) {
        const { error } = await sb.from('machines').update(row).eq('id', m.id);
        if (error) throw error;
      } else {
        const code = String(fd.get('code') || '').trim().toUpperCase();
        if (!/^[A-Z0-9-]{2,20}$/.test(code)) throw new Error('Código: 2 a 20 caracteres (letras, números o guion).');
        Object.assign(row, { code,
          hours_total: V.num(fd.get('hours_total'), 0, 1000000, 'Horas totales'),
          hours_since_service: V.num(fd.get('hours_since_service'), 0, 1000000, 'Horas desde el último') });
        if (row.hours_since_service > row.hours_total) throw new Error('Las horas desde el último mantenimiento no pueden superar las horas totales.');
        const { error } = await sb.from('machines').insert(row).select(MACHINE_COLS);
        if (error) throw error;
      }
      await loadMachines();
      toast(edit ? 'Máquina actualizada.' : 'Máquina agregada.');
    },
  });
}

export function failureForm(machineId) {
  if (!state.machines.length) { toast('Primero agrega una máquina.', 'info'); return; }
  formModal({
    title: 'Registrar falla', submit: 'Registrar',
    fields: [
      field('Máquina', select('machine_id', machineOptions(), machineId || state.machines[0]?.id)),
      field('Causa', input({ name: 'cause', maxlength: 200, placeholder: 'Ej. fuga en el sello de la válvula' })),
      h('div', { class: 'grid2' },
        field('Horas de paro', input({ name: 'downtime_hours', inputmode: 'decimal', value: '1' })),
        field('Costo (COP)', input({ name: 'cost', inputmode: 'numeric', value: '0' }))),
      field('Fecha y hora', input({ name: 'occurred_at', type: 'datetime-local', value: localNow() })),
    ],
    onSubmit: async (fd) => {
      const when = new Date(fd.get('occurred_at') || Date.now());
      if (Number.isNaN(when.getTime()) || when.getTime() > Date.now() + 3600e3) throw new Error('La fecha no puede estar en el futuro.');
      const row = {
        machine_id: Number(V.oneOf(String(fd.get('machine_id')), state.machines.map((m) => String(m.id)), 'Máquina')),
        cause: V.text(fd.get('cause'), 3, 200, 'Causa'),
        downtime_hours: V.num(fd.get('downtime_hours'), 0, 1000, 'Horas de paro'),
        cost: V.num(fd.get('cost'), 0, 1e9, 'Costo', { int: true }),
        occurred_at: when.toISOString(),
      };
      const { error } = await sb.from('failures').insert(row);
      if (error) throw error;
      toast('Falla registrada. Se avisó al área.');
    },
  });
}

export function hoursForm(machineId) {
  if (!state.machines.length) { toast('Primero agrega una máquina.', 'info'); return; }
  formModal({
    title: 'Registrar horas de uso', submit: 'Registrar',
    fields: [
      field('Máquina', select('machine_id', machineOptions(), machineId || state.machines[0]?.id)),
      field('Horas trabajadas en el turno', input({ name: 'hours', inputmode: 'decimal', value: '8' }), 'Entre 0,1 y 24 horas por registro.'),
    ],
    onSubmit: async (fd) => {
      const { error } = await sb.rpc('add_machine_hours', {
        p_machine: Number(fd.get('machine_id')), p_hours: V.num(fd.get('hours'), 0.1, 24, 'Horas') });
      if (error) throw error;
      await loadMachines();
      toast('Horas registradas.');
    },
  });
}

export function orderForm(machineId) {
  if (!state.machines.length) { toast('Primero agrega una máquina.', 'info'); return; }
  const m = state.machines.find((x) => x.id === Number(machineId));
  formModal({
    title: 'Nueva orden de trabajo', submit: 'Crear orden', wide: true,
    fields: [
      h('div', { class: 'grid2' },
        field('Máquina', select('machine_id', machineOptions(), machineId || state.machines[0]?.id)),
        field('Tipo', select('kind', [['preventiva', 'Preventiva'], ['correctiva', 'Correctiva']], 'preventiva'))),
      field('Título', input({ name: 'title', maxlength: 120, value: m ? `Mantenimiento preventivo ${m.code}` : '' })),
      field('Descripción', textarea({ name: 'description', maxlength: 1000 })),
      h('div', { class: 'grid3' },
        field('Prioridad', select('priority', Object.entries(PRIORITIES), m && m.level === 'alta' ? 'alta' : 'media')),
        field('Fecha límite', input({ name: 'due_date', type: 'date' })),
        field('Tiempo estimado (h)', input({ name: 'est_hours', inputmode: 'decimal', value: '2' }))),
      field('Responsable', select('assignee', peopleOptions(), '')),
      h('div', { class: 'grid2' },
        field('Pasos de seguridad (uno por línea)', textarea({ name: 'safety', rows: 4, value: 'Bloqueo y etiquetado (LOTO)\nUsar guantes y gafas\nVerificar energía cero' })),
        field('Tareas (una por línea)', textarea({ name: 'tasks', rows: 4, value: 'Inspección visual\nLubricación\nPrueba de funcionamiento' }))),
      h('div', { class: 'grid2' },
        field('Repuesto (opcional)', select('part_id', [['', 'Ninguno'], ...state.parts.map((p) => [p.id, `${p.name} (stock ${p.stock})`])], '')),
        field('Cantidad', input({ name: 'part_qty', inputmode: 'numeric', value: '0' }))),
    ],
    onSubmit: async (fd) => {
      const partId = fd.get('part_id') ? Number(fd.get('part_id')) : null;
      const qty = V.num(fd.get('part_qty') || 0, 0, 1000, 'Cantidad', { int: true });
      if (qty > 0 && !partId) throw new Error('Elige el repuesto o deja la cantidad en 0.');
      const assignee = fd.get('assignee') || null;
      if (assignee && !state.profiles.has(assignee)) throw new Error('Responsable no válido.');
      const due = fd.get('due_date') || null;
      if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) throw new Error('Fecha no válida.');
      const row = {
        machine_id: Number(fd.get('machine_id')),
        kind: V.oneOf(fd.get('kind'), ['preventiva', 'correctiva'], 'Tipo'),
        title: V.text(fd.get('title'), 3, 120, 'Título'),
        description: V.text(fd.get('description'), 0, 1000, 'Descripción'),
        priority: V.oneOf(fd.get('priority'), Object.keys(PRIORITIES), 'Prioridad'),
        due_date: due, est_hours: V.num(fd.get('est_hours'), 0, 500, 'Tiempo estimado'), assignee,
        safety_steps: lines(fd.get('safety'), 10, 'Paso de seguridad'),
        checklist: lines(fd.get('tasks'), 20, 'Tarea').map((text) => ({ text, done: false })),
        part_id: qty > 0 ? partId : null, part_qty: qty,
      };
      const { data, error } = await sb.from('work_orders').insert(row).select('id').single();
      if (error) throw error;
      toast('Orden creada.');
      location.hash = `#/ordenes/${data.id}`;
    },
  });
}

export function channelForm() {
  const chosen = new Set();
  const list = h('div', { class: 'pick-list' });
  const search = input({ type: 'search', placeholder: 'Buscar por nombre o área', 'aria-label': 'Buscar personas' });
  const renderList = () => {
    const q = search.value.trim().toLowerCase();
    const people = [...state.profiles.values()].filter((p) => p.id !== state.me.id &&
      (!q || `${p.full_name} ${p.username} ${p.area}`.toLowerCase().includes(q))).slice(0, 30);
    list.replaceChildren(...people.map((p) => h('label', { class: 'pick' },
      h('input', { type: 'checkbox', checked: chosen.has(p.id), onchange: (e) => e.target.checked ? chosen.add(p.id) : chosen.delete(p.id) }),
      h('span', {}, p.full_name), h('small', { class: 'muted' }, `${p.area}`))));
  };
  search.addEventListener('input', renderList); renderList();
  const priv = h('input', { type: 'checkbox', name: 'is_private' });
  const pickWrap = h('div', { class: 'pick-wrap', hidden: true }, field('Agregar personas', search), list);
  priv.addEventListener('change', () => { pickWrap.hidden = !priv.checked; });
  formModal({
    title: 'Crear canal', submit: 'Crear canal',
    fields: [
      field('Nombre del canal', input({ name: 'name', maxlength: 40, placeholder: 'Turno noche' })),
      field('Área', select('area', [['', 'Toda la planta'], ...AREAS.map((a) => [a, a])], state.me.area)),
      field('Descripción', input({ name: 'description', maxlength: 200 })),
      h('label', { class: 'check' }, priv, 'Canal privado (solo lo ven las personas que agregues)'),
      pickWrap,
    ],
    onSubmit: async (fd) => {
      const area = fd.get('area') || null;
      if (area) V.oneOf(area, AREAS, 'Área');
      const row = { name: V.text(fd.get('name'), 2, 40, 'Nombre'), area, description: V.text(fd.get('description'), 0, 200, 'Descripción'), is_private: !!fd.get('is_private') };
      const { data, error } = await sb.from('channels').insert(row).select('id').single();
      if (error) throw error;
      if (row.is_private && chosen.size) {
        const { error: e2 } = await sb.from('channel_members').insert([...chosen].map((user_id) => ({ channel_id: data.id, user_id })));
        if (e2) toast('El canal se creó, pero no se pudo agregar a algunas personas.', 'error');
      }
      toast('Canal creado.');
      location.hash = `#/canales/${data.id}`;
    },
  });
}

export function partForm(p) {
  const edit = !!p;
  formModal({
    title: edit ? `Editar ${p.sku}` : 'Nuevo repuesto', submit: edit ? 'Guardar' : 'Agregar',
    fields: [
      h('div', { class: 'grid2' },
        field('Referencia (SKU)', input({ name: 'sku', value: p?.sku || '', maxlength: 20, placeholder: 'ROD-6205', disabled: edit })),
        field('Nombre', input({ name: 'name', value: p?.name || '', maxlength: 80 }))),
      h('div', { class: 'grid3' },
        field('Stock', input({ name: 'stock', inputmode: 'numeric', value: p?.stock ?? 0 })),
        field('Stock mínimo', input({ name: 'min_stock', inputmode: 'numeric', value: p?.min_stock ?? 1 })),
        field('Costo unitario (COP)', input({ name: 'unit_cost', inputmode: 'numeric', value: p?.unit_cost ?? 0 }))),
    ],
    onSubmit: async (fd) => {
      const row = {
        name: V.text(fd.get('name'), 2, 80, 'Nombre'),
        stock: V.num(fd.get('stock'), 0, 100000, 'Stock', { int: true }),
        min_stock: V.num(fd.get('min_stock'), 0, 100000, 'Stock mínimo', { int: true }),
        unit_cost: V.num(fd.get('unit_cost'), 0, 1e9, 'Costo', { int: true }),
      };
      let error;
      if (edit) ({ error } = await sb.from('parts').update(row).eq('id', p.id));
      else {
        const sku = String(fd.get('sku') || '').trim().toUpperCase();
        if (!/^[A-Z0-9-]{2,20}$/.test(sku)) throw new Error('SKU: 2 a 20 caracteres (letras, números o guion).');
        ({ error } = await sb.from('parts').insert({ ...row, sku }));
      }
      if (error) throw error;
      await loadParts();
      toast(edit ? 'Repuesto actualizado.' : `Repuesto agregado (${num(row.stock)} en stock).`);
    },
  });
}

function localNow() {
  const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}
