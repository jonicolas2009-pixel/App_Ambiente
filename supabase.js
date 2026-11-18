// Conexión con Supabase (base de datos, autenticación, tiempo real y archivos).
import { CONFIG } from './config.js';

const REMEMBER_KEY = 'mx_remember';

// La sesión se guarda en localStorage ("recordarme") o en sessionStorage
// (se cierra al cerrar el navegador). Maqnex no usa cookies.
const sessionStore = {
  getItem: (k) => sessionStorage.getItem(k) ?? localStorage.getItem(k),
  setItem: (k, v) => {
    const remember = localStorage.getItem(REMEMBER_KEY) !== '0';
    (remember ? localStorage : sessionStorage).setItem(k, v);
    (remember ? sessionStorage : localStorage).removeItem(k);
  },
  removeItem: (k) => { sessionStorage.removeItem(k); localStorage.removeItem(k); },
};

export function setRemember(remember) {
  localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0');
}

export function isConfigured() {
  const url = CONFIG.SUPABASE_URL || '';
  return /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url)
    && !url.includes('TU-PROYECTO')
    && (CONFIG.SUPABASE_ANON_KEY || '').length > 20
    && !CONFIG.SUPABASE_ANON_KEY.startsWith('PEGA-AQUI');
}

// Detecta si alguien pegó por error una clave secreta.
export function isSecretKey(key) {
  if (!key) return false;
  if (key.startsWith('sb_secret_')) return true;
  const parts = key.split('.');
  if (parts.length !== 3) return false;
  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.role === 'service_role';
  } catch { return false; }
}

function create() {
  if (!isConfigured() || isSecretKey(CONFIG.SUPABASE_ANON_KEY)) return null;
  if (!window.supabase || typeof window.supabase.createClient !== 'function') return null;
  return window.supabase.createClient(CONFIG.SUPABASE_URL.replace(/\/$/, ''), CONFIG.SUPABASE_ANON_KEY, {
    auth: {
      storage: sessionStore,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
    realtime: { params: { eventsPerSecond: 5 } },
  });
}

export const sb = create();
