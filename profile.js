import { sb } from '../supabase.js';
import { CONFIG } from '../config.js';
import { h, clear, icon, eyebrow, roleChip, tag, empty, errMsg, toast, confirmDialog, formModal, modal, field, input, textarea, select, V, AREAS, fdate, isUuid, download, logo } from '../ui.js';
import { state, on, profile, loadProfiles, resolveAvatars, PROFILE_COLS } from '../state.js';
import { avatar, personLine } from '../components.js';
import { loadContacts, relationButton } from './team.js';
import { showTermsModal } from '../auth.js';
import { signOut, setTheme, promptInstall } from '../app.js';

export async function render(page, { param }) {
  const id = isUuid(param) ? param : state.me.id;
  const mine = id === state.me.id;
  const p = profile(id);
  if (!state.profiles.has(id)) { page.append(empty('Este perfil no existe.')); return; }

  const rel = await loadContacts();
  const contactsOf = mine ? [...rel].filter(([, v]) => v === 'contact').map(([cid]) => profile(cid)) : null;
  const [orders, chans, notifs] = await Promise.all([
    sb.from('work_orders').select('id', { count: 'exact', head: true }).eq('assignee', id).neq('status', 'cerrada'),
    mine ? sb.from('channel_members').select('channel_id', { count: 'exact', head: true }).eq('user_id', id) : Promise.resolve({ count: null }),
    mine ? sb.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null) : Promise.resolve({ count: null }),
  ]);

  const box = h('div');
  const paint = () => {
    const pr = profile(id);
    clear(box,
      h('section', { class: 'profile-hero' },
        h('div', { class: 'cover' }, h('span', { class: 'cover-mark' }, logo(120))),
        h('div', { class: 'profile-main' },
          h('div', { class: 'profile-avatar' }, avatar(pr, 128)),
          h('div', { class: 'profile-id' },
            eyebrow(`@${pr.username}`),
            h('h1', { class: 'display' }, pr.full_name),
            pr.headline ? h('p', { class: 'lede' }, pr.headline) : (mine ? h('p', { class: 'muted' }, 'Agrega un titular profesional en "Editar perfil".') : null),
            h('div', { class: 'row gap-sm wrap' }, roleChip(pr.role), tag(pr.area), h('span', { class: 'muted small' }, `En Maqnex desde ${fdate(pr.created_at, { month: 'long', year: 'numeric' })}`))),
          h('div', { class: 'profile-actions' }, mine
            ? h('button', { class: 'btn primary', type: 'button', onclick: () => editProfile() }, icon('edit', 16), 'Editar perfil')
            : [rel.get(id) === 'contact' ? h('a', { class: 'btn primary', href: `#/mensajes/${id}` }, icon('message', 16), 'Mensaje') : null,
              relationButton(pr, rel.get(id), () => dispatchEvent(new HashChangeEvent('hashchange')))])),
        h('div', { class: 'profile-stats' },
          stat(mine ? [...rel.values()].filter((v) => v === 'contact').length : '—', 'Contactos'),
          stat(orders.count ?? 0, 'Órdenes abiertas'),
          mine ? stat(chans.count ?? 0, 'Canales') : null,
          mine ? stat(notifs.count ?? 0, 'Alertas sin leer') : null)),
      h('div', { class: 'cols' },
        h('section', { class: 'block card' }, h('h2', { class: 'h-sm' }, 'Acerca de'),
          pr.about ? h('p', { class: 'prose pre' }, pr.about) : h('p', { class: 'muted' }, mine ? 'Cuéntale al equipo quién eres y en qué trabajas.' : 'Sin descripción.'),
          h('h3', { class: 'h-xs' }, 'Habilidades'),
          pr.skills?.length ? h('div', { class: 'tags' }, pr.skills.map(tag)) : h('p', { class: 'muted' }, 'Sin habilidades registradas.')),
        mine ? h('section', { class: 'block card' }, h('h2', { class: 'h-sm' }, `Mis contactos (${contactsOf.length})`),
          contactsOf.length ? h('div', { class: 'list' }, contactsOf.slice(0, 8).map((c) => personLine(c))) : empty('Aún no tienes contactos.', h('a', { class: 'btn sm', href: '#/equipo' }, 'Buscar personas')),
          contactsOf.length > 8 ? h('a', { class: 'link', href: '#/equipo' }, 'Ver todos') : null) : null),
      mine ? privacy() : null);
  };
  paint();
  page.append(box);
  return on('profiles', paint);
}

const stat = (n, label) => h('div', { class: 'pstat' }, h('strong', {}, String(n)), h('span', {}, label));

function editProfile() {
  const me = profile(state.me.id);
  const skills = [...(me.skills || [])];
  const chips = h('div', { class: 'tags editable' });
  const paintChips = () => clear(chips, skills.map((s, i) => h('button', { type: 'button', class: 'tag removable', title: 'Quitar', onclick: () => { skills.splice(i, 1); paintChips(); } }, s, icon('x', 12))));
  paintChips();
  const skillIn = input({ maxlength: 40, placeholder: 'Escribe una habilidad y pulsa Enter' });
  skillIn.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const v = skillIn.value.trim();
    if (!v) return;
    if (v.length > 40) { toast('Máximo 40 caracteres por habilidad.', 'error'); return; }
    if (skills.length >= 15) { toast('Máximo 15 habilidades.', 'error'); return; }
    if (!skills.some((s) => s.toLowerCase() === v.toLowerCase())) skills.push(v);
    skillIn.value = ''; paintChips();
  });
  let photo = null;
  const preview = h('span', { class: 'photo-preview' }, avatar(me, 72));
  const fileIn = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp', class: 'visually-hidden', id: 'photo-in' });
  fileIn.addEventListener('change', async () => {
    try {
      photo = await processPhoto(fileIn.files[0]);
      clear(preview, h('img', { src: URL.createObjectURL(photo), alt: 'Vista previa', class: 'avatar-img' }));
    } catch (ex) { photo = null; fileIn.value = ''; toast(errMsg(ex), 'error'); }
  });
  formModal({
    title: 'Editar perfil', submit: 'Guardar perfil', wide: true,
    fields: [
      h('div', { class: 'row gap' }, preview, h('div', { class: 'stack-sm' },
        h('label', { class: 'btn sm', for: 'photo-in' }, icon('camera', 16), 'Cambiar foto'), fileIn,
        h('small', { class: 'hint' }, 'PNG, JPG o WEBP de hasta 5 MB. Se recorta a 320×320.'))),
      h('div', { class: 'grid2' },
        field('Nombre completo', input({ name: 'full_name', value: me.full_name, maxlength: 80 })),
        field('Área', select('area', AREAS.map((a) => [a, a]), me.area))),
      field('Titular', input({ name: 'headline', value: me.headline, maxlength: 120, placeholder: 'Técnica de mantenimiento · Línea de llenado' })),
      field('Acerca de', textarea({ name: 'about', value: me.about, maxlength: 1000, rows: 4 })),
      field('Habilidades', h('div', { class: 'stack-sm' }, chips, skillIn)),
      h('p', { class: 'hint' }, 'Tu rol solo lo puede cambiar un administrador.'),
    ],
    onSubmit: async (fd) => {
      const row = {
        full_name: V.text(fd.get('full_name'), 2, 80, 'Nombre'),
        area: V.oneOf(fd.get('area'), AREAS, 'Área'),
        headline: V.text(fd.get('headline'), 0, 120, 'Titular'),
        about: V.text(fd.get('about'), 0, 1000, 'Acerca de'),
        skills: skills.slice(0, 15),
      };
      const old = me.avatar_path;
      if (photo) {
        const path = `${state.me.id}/avatar-${Date.now()}.webp`;
        const { error } = await sb.storage.from('avatars').upload(path, photo, { contentType: 'image/webp', upsert: false, cacheControl: '3600' });
        if (error) throw error;
        row.avatar_path = path;
      }
      const { error } = await sb.from('profiles').update(row).eq('id', state.me.id).select(PROFILE_COLS).single();
      if (error) throw error;
      if (photo && old) sb.storage.from('avatars').remove([old]).catch(() => {});
      if (row.avatar_path) await resolveAvatars([row.avatar_path]);
      await loadProfiles();
      toast('Perfil actualizado.');
    },
  });
}

// Restringir la subida: solo imágenes PNG/JPG/WEBP ≤ 5 MB; se vuelve a dibujar
// (elimina metadatos y cualquier contenido oculto) y se guarda como WEBP 320×320.
async function processPhoto(file) {
  if (!file) throw new Error('Elige una imagen.');
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Formato no permitido. Usa PNG, JPG o WEBP.');
  if (file.size > 5 * 1024 * 1024) throw new Error('La imagen supera 5 MB.');
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const isPng = head[0] === 0x89 && head[1] === 0x50, isJpg = head[0] === 0xff && head[1] === 0xd8,
    isWebp = head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50;
  if (!isPng && !isJpg && !isWebp) throw new Error('El archivo no es una imagen válida.');
  const bmp = await createImageBitmap(file);
  const size = 320, side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  canvas.getContext('2d').drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
  bmp.close?.();
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/webp', 0.86));
  if (!blob || blob.type !== 'image/webp') throw new Error('Tu navegador no pudo convertir la imagen. Prueba con otra.');
  return blob;
}

function privacy() {
  const theme = document.documentElement.dataset.theme;
  return h('section', { class: 'block card' },
    h('h2', { class: 'h-sm' }, icon('shield', 18), ' Cuenta y privacidad'),
    h('div', { class: 'settings' },
      setting('Tema', 'Oscuro (Dala) o claro (Dayos).', h('div', { class: 'seg' },
        h('button', { type: 'button', class: theme !== 'light' ? 'on' : '', onclick: () => { setTheme('dark'); dispatchEvent(new HashChangeEvent('hashchange')); } }, icon('moon', 14), 'Oscuro'),
        h('button', { type: 'button', class: theme === 'light' ? 'on' : '', onclick: () => { setTheme('light'); dispatchEvent(new HashChangeEvent('hashchange')); } }, icon('sun', 14), 'Claro'))),
      setting('Instalar Maqnex', 'Úsala como app en tu celular o computador.', h('button', { class: 'btn sm', type: 'button', onclick: promptInstall }, icon('install', 16), 'Instalar')),
      setting('Términos y política de datos', `Aceptaste la versión ${state.me.terms_version || '—'} el ${fdate(state.me.terms_accepted_at)}.`, h('button', { class: 'btn sm', type: 'button', onclick: showTermsModal }, 'Leer')),
      setting('Descargar mis datos', 'Copia de tu perfil, tus mensajes y tus contactos en formato JSON.', h('button', { class: 'btn sm', type: 'button', onclick: exportData }, icon('download', 16), 'Descargar')),
      setting('Revocar consentimiento', 'Cierra tu sesión. Para volver a entrar deberás aceptar los términos de nuevo.', h('button', { class: 'btn sm', type: 'button', onclick: async () => {
        if (!await confirmDialog('¿Revocar tu autorización de tratamiento de datos? Se cerrará tu sesión.', { ok: 'Revocar' })) return;
        const { error } = await sb.rpc('revoke_terms');
        if (error) toast(errMsg(error), 'error'); else signOut();
      } }, 'Revocar')),
      setting('Cerrar sesión', 'Sal de Maqnex en este dispositivo.', h('button', { class: 'btn sm', type: 'button', onclick: signOut }, icon('logout', 16), 'Cerrar sesión')),
      setting('Eliminar mi cuenta', 'Borra tu perfil, tu foto, tus mensajes y tus contactos. No se puede deshacer.', h('button', { class: 'btn sm danger', type: 'button', onclick: deleteAccount }, icon('trash', 16), 'Eliminar cuenta'))));
}

const setting = (title, desc, control) => h('div', { class: 'setting' }, h('div', { class: 'grow' }, h('strong', {}, title), h('p', { class: 'muted small' }, desc)), control);

async function exportData() {
  try {
    const me = state.me.id;
    const [prof, msgs, dms, contacts, notifs] = await Promise.all([
      sb.rpc('get_my_profile'),
      sb.from('messages').select('channel_id, body, created_at').eq('author_id', me),
      sb.from('direct_messages').select('sender_id, recipient_id, body, created_at, read_at'),
      sb.from('contacts').select('requester, addressee, status, created_at'),
      sb.from('notifications').select('kind, title, body, created_at, read_at'),
    ]);
    const out = { generado: new Date().toISOString(), responsable: CONFIG.RESPONSABLE, perfil: prof.data?.[0], mensajes_en_canales: msgs.data, mensajes_privados: dms.data, contactos: contacts.data, notificaciones: notifs.data };
    download(`maqnex-mis-datos-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(out, null, 2), 'application/json');
  } catch (ex) { toast(errMsg(ex), 'error'); }
}

function deleteAccount() {
  const m = modal({ title: 'Eliminar mi cuenta', body: (() => {
    const conf = input({ placeholder: 'Escribe ELIMINAR', 'aria-label': 'Escribe ELIMINAR para confirmar' });
    const err = h('p', { class: 'form-error', role: 'alert' });
    const btn = h('button', { class: 'btn danger', type: 'button', onclick: async () => {
      if (conf.value.trim() !== 'ELIMINAR') { err.textContent = 'Escribe ELIMINAR en mayúsculas para confirmar.'; return; }
      btn.disabled = true;
      const me = profile(state.me.id);
      if (me.avatar_path) await sb.storage.from('avatars').remove([me.avatar_path]).catch(() => {});
      const { error } = await sb.rpc('delete_my_account');
      if (error) { err.textContent = errMsg(error); btn.disabled = false; return; }
      m.close(); toast('Tu cuenta fue eliminada.'); signOut();
    } }, 'Eliminar definitivamente');
    return h('div', { class: 'stack' }, h('p', {}, 'Se borrarán tu perfil, tu foto, tus mensajes, tus contactos y tus notificaciones. Las fallas y órdenes que registraste quedan en la planta, sin tu nombre.'), conf, err, btn);
  })() });
}
