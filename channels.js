import { sb } from '../supabase.js';
import { h, clear, icon, eyebrow, roleChip, ftime, fdate, empty, errMsg, toast, confirmDialog, modal, input } from '../ui.js';
import { state, on, profile, isAdmin } from '../state.js';
import { avatar } from '../components.js';
import { channelForm } from '../actions.js';

export async function render(page, { param }) {
  const { data: chans, error } = await sb.from('channels').select('id, name, area, description, is_private, created_by').order('name');
  if (error) throw error;
  const current = param ? chans.find((c) => c.id === Number(param)) : null;
  page.classList.add('chat-page');

  const listPane = h('aside', { class: 'chat-list' },
    h('div', { class: 'chat-list-head' }, h('h1', { class: 'h-md' }, 'Canales'),
      h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Crear canal', title: 'Crear canal', onclick: () => channelForm() }, icon('plus', 18))),
    h('nav', {}, chans.map((c) => h('a', { class: `chat-link${current?.id === c.id ? ' active' : ''}`, href: `#/canales/${c.id}` },
      h('span', { class: 'hash' }, c.is_private ? icon('lock', 16) : '#'),
      h('span', { class: 'grow' }, h('strong', {}, c.name), h('small', { class: 'muted block' }, c.area || 'Toda la planta'))))));

  if (!current) {
    page.classList.add('no-conv');
    page.append(h('div', { class: 'chat' }, listPane,
      h('section', { class: 'chat-main placeholder' }, empty(chans.length ? 'Elige un canal para ver la conversación.' : 'No hay canales todavía.',
        h('button', { class: 'btn primary', type: 'button', onclick: () => channelForm() }, 'Crear canal')))));
    return;
  }

  const { data: msgs, error: e2 } = await sb.from('messages').select('id, channel_id, author_id, body, created_at')
    .eq('channel_id', current.id).order('created_at', { ascending: false }).limit(100);
  if (e2) throw e2;
  const ids = new Set();
  const stream = h('div', { class: 'stream', role: 'log', 'aria-live': 'polite' });
  let lastDay = '';
  const addMsg = (m) => {
    if (ids.has(m.id)) return;
    ids.add(m.id);
    const day = fdate(m.created_at);
    if (day !== lastDay) { stream.append(h('div', { class: 'day-sep' }, day)); lastDay = day; }
    stream.append(bubble(m, current));
  };
  msgs.reverse().forEach(addMsg);

  const composer = composerBox(async (body) => {
    const { data, error } = await sb.from('messages').insert({ channel_id: current.id, body }).select('id, channel_id, author_id, body, created_at').single();
    if (error) throw error;
    addMsg(data); scrollDown();
  });
  const scrollDown = () => { stream.scrollTop = stream.scrollHeight; };

  const canManage = current.created_by === state.me.id || isAdmin();
  page.append(h('div', { class: 'chat' }, listPane,
    h('section', { class: 'chat-main' },
      h('header', { class: 'chat-head' },
        h('a', { class: 'iconbtn only-mobile', href: '#/canales', 'aria-label': 'Volver a canales' }, icon('back', 18)),
        h('div', { class: 'grow' }, eyebrow(current.is_private ? 'Canal privado' : current.area || 'Toda la planta'),
          h('h2', { class: 'h-md' }, (current.is_private ? '' : '# ') + current.name),
          current.description ? h('p', { class: 'muted small' }, current.description) : null),
        current.is_private ? h('button', { class: 'btn sm', type: 'button', onclick: () => membersModal(current, canManage) }, icon('users', 16), 'Miembros') : null,
        canManage && current.created_by ? h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Eliminar canal', title: 'Eliminar canal', onclick: async () => {
          if (!await confirmDialog(`¿Eliminar el canal ${current.name} y todos sus mensajes?`, { ok: 'Eliminar', danger: true })) return;
          const { error } = await sb.from('channels').delete().eq('id', current.id);
          if (error) toast(errMsg(error), 'error'); else location.hash = '#/canales';
        } }, icon('trash', 18)) : null),
      stream, composer)));
  requestAnimationFrame(scrollDown);

  return on('message', (m) => {
    if (m.channel_id !== current.id) return;
    const near = stream.scrollHeight - stream.scrollTop - stream.clientHeight < 120;
    addMsg(m); if (near) scrollDown();
  });
}

function bubble(m, channel) {
  const p = profile(m.author_id);
  const mine = m.author_id === state.me.id;
  const del = (mine || isAdmin()) ? h('button', { class: 'msg-del', type: 'button', 'aria-label': 'Eliminar mensaje', title: 'Eliminar', onclick: async (e) => {
    if (!await confirmDialog('¿Eliminar este mensaje?', { ok: 'Eliminar', danger: true })) return;
    const { error } = await sb.from('messages').delete().eq('id', m.id);
    if (error) toast(errMsg(error), 'error'); else e.target.closest('.msg')?.remove();
  } }, icon('trash', 14)) : null;
  void channel;
  return h('div', { class: `msg${mine ? ' mine' : ''}` },
    mine ? null : h('a', { href: `#/perfil/${p.id}`, class: 'msg-av' }, avatar(p, 34)),
    h('div', { class: 'msg-body' },
      h('div', { class: 'bubble' }, m.body),
      h('div', { class: 'msg-meta' }, h('strong', {}, mine ? 'Tú' : p.full_name), roleChip(p.role), h('span', { class: 'muted' }, ftime(m.created_at)), del)));
}

export function composerBox(send) {
  const ta = h('textarea', { class: 'input composer-input', rows: 1, maxlength: 2000, placeholder: 'Escribe un mensaje…', 'aria-label': 'Mensaje' });
  const btn = h('button', { class: 'btn primary send', type: 'submit', 'aria-label': 'Enviar' }, icon('send', 18));
  const form = h('form', { class: 'composer' }, ta, btn);
  const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(160, ta.scrollHeight) + 'px'; };
  ta.addEventListener('input', grow);
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = ta.value.trim();
    if (!body) return;
    if (body.length > 2000) { toast('Máximo 2.000 caracteres.', 'error'); return; }
    btn.disabled = true;
    try { await send(body); ta.value = ''; grow(); } catch (ex) { toast(errMsg(ex), 'error'); }
    finally { btn.disabled = false; ta.focus(); }
  });
  return form;
}

async function membersModal(channel, canManage) {
  const { data, error } = await sb.from('channel_members').select('user_id').eq('channel_id', channel.id);
  if (error) { toast(errMsg(error), 'error'); return; }
  const members = new Set(data.map((r) => r.user_id));
  const listEl = h('div', { class: 'list' });
  const search = input({ type: 'search', placeholder: 'Agregar persona…', 'aria-label': 'Buscar persona para agregar' });
  const results = h('div', { class: 'list' });
  const paint = () => {
    clear(listEl, [...members].map((id) => {
      const p = profile(id);
      return h('div', { class: 'list-item' }, avatar(p, 32), h('span', { class: 'grow' }, p.full_name), roleChip(p.role),
        (canManage && id !== channel.created_by) || id === state.me.id ? h('button', { class: 'btn sm ghost', type: 'button', onclick: async () => {
          const { error } = await sb.from('channel_members').delete().eq('channel_id', channel.id).eq('user_id', id);
          if (error) { toast(errMsg(error), 'error'); return; }
          members.delete(id); paint();
          if (id === state.me.id) { m.close(); location.hash = '#/canales'; }
        } }, id === state.me.id ? 'Salir' : 'Quitar') : null);
    }));
    const q = search.value.trim().toLowerCase();
    clear(results, canManage && q ? [...state.profiles.values()].filter((p) => !members.has(p.id) && `${p.full_name} ${p.username}`.toLowerCase().includes(q)).slice(0, 8)
      .map((p) => h('div', { class: 'list-item' }, avatar(p, 32), h('span', { class: 'grow' }, p.full_name),
        h('button', { class: 'btn sm', type: 'button', onclick: async () => {
          const { error } = await sb.from('channel_members').insert({ channel_id: channel.id, user_id: p.id });
          if (error) { toast(errMsg(error), 'error'); return; }
          members.add(p.id); search.value = ''; paint();
        } }, 'Agregar'))) : []);
  };
  search.addEventListener('input', paint);
  const m = modal({ title: `Miembros de ${channel.name}`, body: h('div', { class: 'stack' }, listEl, canManage ? search : null, results) });
  paint();
}
