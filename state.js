// Estado compartido de la app + eventos en tiempo real.
import { sb } from './supabase.js';
import { isUuid } from './ui.js';

// Columnas públicas del perfil (nunca pedimos '*': "recortar respuestas").
export const PROFILE_COLS = 'id, username, full_name, headline, about, area, role, skills, avatar_path, created_at';
export const MACHINE_COLS = 'id, code, name, model, stage, area, hours_total, interval_hours, hours_since_service, temp_base, vib_base, last_temp, last_vib, last_reading_at, level, last_service_at, created_at';

export const state = {
  session: null,
  me: null,
  profiles: new Map(),
  machines: [],
  parts: [],
  avatarUrls: new Map(),
  unread: { notifs: 0, dms: 0 },
};

const bus = new EventTarget();
export function emit(name, detail) { bus.dispatchEvent(new CustomEvent(name, { detail })); }
export function on(name, fn) {
  const handler = (e) => fn(e.detail);
  bus.addEventListener(name, handler);
  return () => bus.removeEventListener(name, handler);
}

export const isStaff = () => ['supervisor', 'admin'].includes(state.me?.role);
export const isAdmin = () => state.me?.role === 'admin';
export const profile = (id) => state.profiles.get(id) || { id, full_name: 'Usuario', username: '', role: 'tecnico', area: '' };
export const machine = (id) => state.machines.find((m) => m.id === Number(id));

export async function loadMe() {
  const { data, error } = await sb.rpc('get_my_profile');
  if (error) throw error;
  state.me = Array.isArray(data) ? data[0] : data;
  return state.me;
}

export async function loadProfiles() {
  const { data, error } = await sb.from('profiles').select(PROFILE_COLS).order('full_name').limit(1000);
  if (error) throw error;
  state.profiles = new Map(data.map((p) => [p.id, p]));
  if (state.me && state.profiles.has(state.me.id)) Object.assign(state.me, state.profiles.get(state.me.id));
  await resolveAvatars(data.map((p) => p.avatar_path).filter(Boolean));
  emit('profiles');
}

// Las fotos están en un bucket privado: pedimos enlaces firmados que vencen en 1 hora.
export async function resolveAvatars(paths) {
  const missing = [...new Set(paths)].filter((p) => !state.avatarUrls.has(p));
  if (!missing.length) return;
  const { data, error } = await sb.storage.from('avatars').createSignedUrls(missing, 3600);
  if (error || !data) return;
  for (const item of data) if (item.signedUrl && item.path) state.avatarUrls.set(item.path, item.signedUrl);
}

export async function loadMachines() {
  const { data, error } = await sb.from('machines').select(MACHINE_COLS).order('stage').order('code');
  if (error) throw error;
  state.machines = data;
  emit('machines');
}

export async function loadParts() {
  const { data, error } = await sb.from('parts').select('id, sku, name, stock, min_stock, unit_cost').order('name');
  if (error) throw error;
  state.parts = data;
  emit('parts');
}

export async function refreshUnread() {
  const [n, c] = await Promise.all([
    sb.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null),
    sb.rpc('my_conversations'),
  ]);
  state.unread.notifs = n.count || 0;
  state.unread.dms = (c.data || []).reduce((a, r) => a + (r.unread || 0), 0);
  emit('unread');
}

let channel;
export function startRealtime() {
  stopRealtime();
  const me = state.me.id;
  if (!isUuid(me)) return;
  channel = sb.channel('maqnex-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'machines' }, (p) => {
      if (p.eventType === 'DELETE') state.machines = state.machines.filter((m) => m.id !== p.old.id);
      else {
        const i = state.machines.findIndex((m) => m.id === p.new.id);
        if (i >= 0) state.machines[i] = { ...state.machines[i], ...p.new }; else state.machines.push(p.new);
      }
      emit('machines', p);
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sensor_readings' }, (p) => emit('reading', p.new))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${me}` }, (p) => {
      state.unread.notifs += 1; emit('unread'); emit('notification', p.new);
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => emit('message', p.new))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'direct_messages' }, (p) => {
      if (p.new.recipient_id === me) { state.unread.dms += 1; emit('unread'); }
      emit('dm', p.new);
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'work_orders' }, (p) => emit('orders', p))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, (p) => emit('contacts', p))
    .subscribe();
}
export function stopRealtime() {
  if (channel) { sb.removeChannel(channel); channel = null; }
}
