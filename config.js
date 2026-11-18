// =====================================================================
//  MAQNEX · Configuración
//  Pega aquí los datos de tu proyecto de Supabase
//  (Supabase → Project Settings → API / API Keys).
//
//  ✅ SUPABASE_ANON_KEY: usa la clave PÚBLICA ("publishable" o "anon").
//     Es pública por diseño: la seguridad la ponen las políticas RLS.
//  ❌ NUNCA pongas aquí la "service_role" ni la "secret" key.
//     La app se niega a arrancar si detecta una de esas claves.
// =====================================================================
export const CONFIG = {
  SUPABASE_URL: 'https://TU-PROYECTO.supabase.co',
  SUPABASE_ANON_KEY: 'PEGA-AQUI-TU-CLAVE-PUBLICA',

  // Opcional: protección anti-bots con Cloudflare Turnstile.
  // Si la activas en Supabase (Authentication → Attack Protection),
  // pega aquí la "site key" pública. Déjalo vacío para no usarla.
  TURNSTILE_SITE_KEY: '',

  // Datos que aparecen en los Términos y condiciones.
  RESPONSABLE: 'Equipo Maqnex (proyecto académico)',
  CONTACT_EMAIL: 'tu-correo@ejemplo.com',

  // Si cambias los términos, sube la versión: todos deberán aceptarlos de nuevo.
  TERMS_VERSION: 'v1-2026-11',
};
