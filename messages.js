import { sb } from '../supabase.js';
import { h, clear, icon, eyebrow, roleChip, ftime, fdate, rel, empty, isUuid, modal } from '../ui.js';
import { state, on, profile, refreshUnread } from '../state.js';
import { avatar } from '../components.js';
import { composerBox } from './channels.js';

async function contactIds() {
  const { data, error } = await sb.from('contacts').select('requester, addressee, status').eq('status', 'aceptado');
  if (error) throw error;
  return new Set(data.map((c) => (c.requester === state.me.id ? c.addressee : c.requester)));
}

export async function render(page, { param }) {
  const other = isUuid(param) ? param : null;
  page.classList.add('chat-page');
  const [convRes, contacts] = await Promise.all([sb.rpc('my_conversations'), contactIds()]);
  if (convRes.error) throw convRes.error;
  const convs = convRes.data.sort((a, b) => new Date(b.last_at) - new Date(a.last_at));

  const newChat = () => {
    const people = [...contacts].map(profile);
    const m = modal({ title: 'Nuevo mensaje', body: people.length
      ? h('div', { class: 'list' }, people.map((p) => h('a', { class: 'list-item', href: `#/mensajes/${p.id}`, onclick: () => m.close() }, avatar(p, 34), h('span', { class: 'grow' }, p.full_name), roleChip(p.role))))
      : empty('Aún no tienes contactos. Agrégalos en Equipo.', h('a', { class: 'btn', href: '#/equipo', onclick: () => m.close() }, 'Ir a Equipo')) });
  };

  const listPane = h('aside', { class: 'chat-list' },
    h('div', { class: 'chat-list-head' }, h('h1', { class: 'h-md' }, 'Mensajes'),
      h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Nuevo mensaje', title: 'Nuevo mensaje', onclick: newChat }, icon('plus', 18))),
    h('nav', {}, convs.length ? convs.map((c) => {
      const p = profile(c.other_id);
      return h('a', { class: `chat-link${other === c.other_id ? ' active' : ''}`, href: `#/mensajes/${c.other_id}` }, avatar(p, 38),
        h('span', { class: 'grow' }, h('strong', {}, p.full_name),
          h('small', { class: 'muted block clamp' }, (c.last_from_me ? 'Tú: ' : '') + c.last_body)),
        h('span', { class: 'conv-side' }, h('small', { class: 'muted' }, rel(c.last_at)), c.unread && other !== c.other_id ? h('b', { class: 'badge' }, String(c.unread)) : null));
    }) : h('p', { class: 'muted pad' }, 'Sin conversaciones todavía.')));

  if (!other) {
    page.classList.add('no-conv');
    page.append(h('div', { class: 'chat' }, listPane, h('section', { class: 'chat-main placeholder' },
      empty('Tus conversaciones privadas aparecen aquí. Solo tú y la otra persona pueden leerlas.',
        h('button', { class: 'btn primary', type: 'button', onclick: newChat }, 'Nuevo mensaje')))));
    return;
  }

  const p = profile(other);
  const isContact = contacts.has(other);
  const filter = `and(sender_id.eq.${state.me.id},recipient_id.eq.${other}),and(sender_id.eq.${other},recipient_id.eq.${state.me.id})`;
  const { data: msgs, error } = await sb.from('direct_messages').select('id, sender_id, recipient_id, body, created_at, read_at')
    .or(filter).order('created_at', { ascending: false }).limit(100);
  if (error) throw error;

  const stream = h('div', { class: 'stream', role: 'log', 'aria-live': 'polite' });
  const ids = new Set(); let lastDay = '';
  const add = (m) => {
    if (ids.has(m.id)) return; ids.add(m.id);
    const day = fdate(m.created_at);
    if (day !== lastDay) { stream.append(h('div', { class: 'day-sep' }, day)); lastDay = day; }
    const mine = m.sender_id === state.me.id;
    stream.append(h('div', { class: `msg${mine ? ' mine' : ''}` }, mine ? null : h('span', { class: 'msg-av' }, avatar(p, 34)),
      h('div', { class: 'msg-body' }, h('div', { class: 'bubble' }, m.body),
        h('div', { class: 'msg-meta' }, h('span', { class: 'muted' }, ftime(m.created_at)), mine && m.read_at ? h('span', { class: 'muted' }, '· Visto') : null))));
  };
  msgs.reverse().forEach(add);
  const scrollDown = () => { stream.scrollTop = stream.scrollHeight; };
  const markRead = async () => { await sb.rpc('mark_conversation_read', { p_other: other }); refreshUnread().catch(() => {}); };
  markRead();

  page.append(h('div', { class: 'chat' }, listPane, h('section', { class: 'chat-main' },
    h('header', { class: 'chat-head' },
      h('a', { class: 'iconbtn only-mobile', href: '#/mensajes', 'aria-label': 'Volver a mensajes' }, icon('back', 18)),
      h('a', { href: `#/perfil/${p.id}`, class: 'row gap-sm grow' }, avatar(p, 40),
        h('span', {}, eyebrow('Conversación privada'), h('strong', { class: 'h-sm block' }, p.full_name), roleChip(p.role)))),
    stream,
    isContact ? composerBox(async (body) => {
      const { data, error: e } = await sb.from('direct_messages').insert({ recipient_id: other, body }).select('id, sender_id, recipient_id, body, created_at, read_at').single();
      if (e) throw e; add(data); scrollDown();
    }) : h('div', { class: 'callout' }, icon('lock', 16), h('span', {}, 'Solo puedes escribir a tus contactos. ', h('a', { class: 'link', href: `#/perfil/${p.id}` }, 'Envía una solicitud desde su perfil.'))))));
  requestAnimationFrame(scrollDown);

  return on('dm', (m) => {
    const inConv = (m.sender_id === other && m.recipient_id === state.me.id) || (m.sender_id === state.me.id && m.recipient_id === other);
    if (!inConv) return;
    add(m); scrollDown();
    if (m.sender_id === other) markRead();
  });
}
