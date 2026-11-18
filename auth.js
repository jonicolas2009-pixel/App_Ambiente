// Inicio de sesión, registro, recuperación de contraseña y términos.
import { sb, setRemember } from './supabase.js';
import { CONFIG } from './config.js';
import { h, clear, logo, icon, field, input, select, V, AREAS, errMsg, toast, eyebrow, tag } from './ui.js';
import { constellation } from './particles.js';

// ---------- Límite de intentos de inicio de sesión (en este navegador) ----------
// El límite real lo aplica Supabase en el servidor (por IP); este es una capa extra.
const GUARD = 'mx_login_guard';
const readGuard = () => { try { return JSON.parse(localStorage.getItem(GUARD)) || { fails: 0, until: 0 }; } catch { return { fails: 0, until: 0 }; } };
const writeGuard = (g) => localStorage.setItem(GUARD, JSON.stringify(g));
function registerFail() {
  const g = readGuard(); g.fails += 1;
  if (g.fails >= 5) g.until = Date.now() + 60000 * 2 ** Math.min(g.fails - 5, 5);
  writeGuard(g);
}
const resetGuard = () => localStorage.removeItem(GUARD);

// ---------- Cloudflare Turnstile (anti-bots), opcional ----------
let turnstileLoading;
function loadTurnstile() {
  if (!CONFIG.TURNSTILE_SITE_KEY) return Promise.resolve(null);
  if (window.turnstile) return Promise.resolve(window.turnstile);
  turnstileLoading ||= new Promise((res) => {
    const s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true; s.onload = () => res(window.turnstile); s.onerror = () => res(null);
    document.head.append(s);
  });
  return turnstileLoading;
}
function captchaBox() {
  const box = h('div', { class: 'captcha' });
  let token = null, widget = null;
  loadTurnstile().then((ts) => {
    if (!ts) return;
    widget = ts.render(box, { sitekey: CONFIG.TURNSTILE_SITE_KEY, theme: document.documentElement.dataset.theme === 'light' ? 'light' : 'dark',
      callback: (t) => { token = t; }, 'expired-callback': () => { token = null; } });
  });
  return { el: box, token: () => token, reset: () => { token = null; if (widget !== null) window.turnstile?.reset(widget); } };
}

// ---------- Pantalla de acceso ----------
let stopFx;
export function renderAuth(root, { mode = 'login', notice } = {}) {
  stopFx?.();
  const visual = h('canvas', { class: 'constellation', 'aria-hidden': 'true' });
  const panel = h('div', { class: 'auth-form' });
  clear(root, h('main', { class: 'auth' },
    h('section', { class: 'auth-left' },
      h('div', { class: 'brand' }, logo(30), h('span', { class: 'wordmark' }, 'Maqnex')),
      h('div', { class: 'auth-copy' },
        eyebrow('Mantenimiento preventivo · Planta de bebidas'),
        h('h1', { class: 'display xl' }, 'Mantenimiento que se anticipa.'),
        h('p', { class: 'prose' }, 'Semáforo de estado, órdenes de trabajo, repuestos y canales de tu equipo en un solo lugar. Tus datos viven en un servidor seguro y se sincronizan entre todos tus dispositivos.')),
      panel),
    h('section', { class: 'auth-right' }, h('div', { class: 'auth-visual' }, visual,
      h('div', { class: 'auth-visual-tags' }, tag('Base de datos en la nube'), tag('Tiempo real'), tag('RLS activo'))))));
  requestAnimationFrame(() => { stopFx = constellation(visual); });
  const go = (m, n) => renderPanel(panel, m, go, n);
  go(mode, notice);
}

function renderPanel(panel, mode, go, notice) {
  const err = h('p', { class: 'form-error', role: 'alert' });
  const info = notice ? h('p', { class: 'form-info', role: 'status' }, notice) : null;
  const honeypot = h('input', { class: 'hp', name: 'website', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true' });
  const started = Date.now();
  const captcha = captchaBox();
  const botCheck = (fd) => {
    if (fd.get('website')) throw new Error('No se pudo completar la solicitud.');
    if (Date.now() - started < 1500) throw new Error('Vas muy rápido. Intenta de nuevo en un segundo.');
    if (CONFIG.TURNSTILE_SITE_KEY && !captcha.token()) throw new Error('Completa la verificación anti-bots.');
  };
  const btn = (text) => h('button', { class: 'btn primary block', type: 'submit' }, text);

  if (mode === 'login') {
    const submit = btn('Iniciar sesión');
    const form = h('form', { class: 'form', novalidate: true },
      h('h2', { class: 'h-md' }, 'Inicia sesión'), info,
      field('Correo', input({ name: 'email', type: 'email', autocomplete: 'email', required: true, maxlength: 254 })),
      field('Contraseña', input({ name: 'password', type: 'password', autocomplete: 'current-password', required: true, maxlength: 72 })),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', name: 'remember', checked: true }), 'Recordarme en este dispositivo'),
      honeypot, captcha.el, err, submit,
      h('div', { class: 'auth-links' },
        h('button', { type: 'button', class: 'link', onclick: () => go('signup') }, 'Crear cuenta'),
        h('button', { type: 'button', class: 'link', onclick: () => go('forgot') }, 'Olvidé mi contraseña')));
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); err.textContent = '';
      const g = readGuard();
      if (g.until > Date.now()) { err.textContent = `Demasiados intentos fallidos. Espera ${Math.ceil((g.until - Date.now()) / 1000)} s.`; return; }
      const fd = new FormData(form);
      submit.disabled = true;
      try {
        botCheck(fd);
        const email = V.email(fd.get('email'));
        const password = String(fd.get('password') || '');
        if (!password) throw new Error('Escribe tu contraseña.');
        setRemember(!!fd.get('remember'));
        const { error } = await sb.auth.signInWithPassword({ email, password, options: { captchaToken: captcha.token() || undefined } });
        if (error) { if (error.status === 400) registerFail(); throw error; }
        resetGuard();
      } catch (ex) { err.textContent = errMsg(ex); captcha.reset(); }
      finally { submit.disabled = false; }
    });
    clear(panel, form);
  }

  if (mode === 'signup') {
    const submit = btn('Crear cuenta');
    const form = h('form', { class: 'form', novalidate: true },
      h('h2', { class: 'h-md' }, 'Crea tu cuenta'),
      h('div', { class: 'grid2' },
        field('Nombre completo', input({ name: 'full_name', autocomplete: 'name', maxlength: 80, required: true })),
        field('Usuario', input({ name: 'username', autocomplete: 'username', maxlength: 30, required: true, placeholder: 'ej. laura.gomez' }))),
      field('Correo', input({ name: 'email', type: 'email', autocomplete: 'email', maxlength: 254, required: true })),
      field('Área', select('area', AREAS.map((a) => [a, a]), 'Producción')),
      h('div', { class: 'grid2' },
        field('Contraseña', input({ name: 'password', type: 'password', autocomplete: 'new-password', maxlength: 72, required: true }), '8 o más caracteres, con letras y números.'),
        field('Repite la contraseña', input({ name: 'password2', type: 'password', autocomplete: 'new-password', maxlength: 72, required: true }))),
      h('p', { class: 'hint' }, 'Todas las cuentas empiezan con el rol Técnico. Un administrador puede cambiarlo.'),
      h('label', { class: 'check' }, h('input', { type: 'checkbox', name: 'terms' }),
        h('span', {}, 'Acepto los ', h('button', { type: 'button', class: 'link', onclick: () => showTermsModal() }, 'términos y la política de datos'), '.')),
      honeypot, captcha.el, err, submit,
      h('div', { class: 'auth-links' }, h('button', { type: 'button', class: 'link', onclick: () => go('login') }, 'Ya tengo cuenta')));
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); err.textContent = '';
      const fd = new FormData(form);
      submit.disabled = true;
      try {
        botCheck(fd);
        const full_name = V.text(fd.get('full_name'), 2, 80, 'Nombre');
        const username = V.username(fd.get('username'));
        const email = V.email(fd.get('email'));
        const area = V.oneOf(fd.get('area'), AREAS, 'Área');
        const password = V.password(fd.get('password'));
        if (password !== fd.get('password2')) throw new Error('Las contraseñas no coinciden.');
        if (!fd.get('terms')) throw new Error('Debes aceptar los términos para crear la cuenta.');
        setRemember(true);
        const { data, error } = await sb.auth.signUp({ email, password, options: {
          data: { full_name, username, area }, emailRedirectTo: location.origin + location.pathname,
          captchaToken: captcha.token() || undefined } });
        if (error) throw error;
        if (!data.session) go('login', 'Cuenta creada. Revisa tu correo y abre el enlace de confirmación para entrar.');
      } catch (ex) { err.textContent = errMsg(ex); captcha.reset(); }
      finally { submit.disabled = false; }
    });
    clear(panel, form);
  }

  if (mode === 'forgot') {
    const submit = btn('Enviar enlace');
    const form = h('form', { class: 'form', novalidate: true },
      h('h2', { class: 'h-md' }, 'Recupera tu contraseña'),
      h('p', { class: 'muted' }, 'Te enviaremos un enlace para crear una contraseña nueva.'),
      field('Correo', input({ name: 'email', type: 'email', autocomplete: 'email', maxlength: 254 })),
      honeypot, captcha.el, err, submit,
      h('div', { class: 'auth-links' }, h('button', { type: 'button', class: 'link', onclick: () => go('login') }, 'Volver')));
    form.addEventListener('submit', async (e) => {
      e.preventDefault(); err.textContent = '';
      const fd = new FormData(form);
      submit.disabled = true;
      try {
        botCheck(fd);
        const email = V.email(fd.get('email'));
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname, captchaToken: captcha.token() || undefined });
        if (error) throw error;
        // Mismo mensaje exista o no la cuenta (no revelamos qué correos están registrados).
        go('login', 'Si el correo está registrado, te llegará un enlace en unos minutos.');
      } catch (ex) { err.textContent = errMsg(ex); captcha.reset(); }
      finally { submit.disabled = false; }
    });
    clear(panel, form);
  }
}

// Al volver desde el enlace del correo: crear la nueva contraseña.
export function renderNewPassword(root, onDone) {
  stopFx?.();
  const err = h('p', { class: 'form-error', role: 'alert' });
  const submit = h('button', { class: 'btn primary block', type: 'submit' }, 'Guardar contraseña');
  const form = h('form', { class: 'form narrow', novalidate: true },
    h('div', { class: 'brand' }, logo(30), h('span', { class: 'wordmark' }, 'Maqnex')),
    h('h1', { class: 'display' }, 'Nueva contraseña'),
    field('Contraseña nueva', input({ name: 'password', type: 'password', autocomplete: 'new-password', maxlength: 72 }), '8 o más caracteres, con letras y números.'),
    field('Repítela', input({ name: 'password2', type: 'password', autocomplete: 'new-password', maxlength: 72 })),
    err, submit);
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); err.textContent = '';
    const fd = new FormData(form); submit.disabled = true;
    try {
      const password = V.password(fd.get('password'));
      if (password !== fd.get('password2')) throw new Error('Las contraseñas no coinciden.');
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw error;
      toast('Contraseña actualizada.');
      onDone();
    } catch (ex) { err.textContent = errMsg(ex); } finally { submit.disabled = false; }
  });
  clear(root, h('main', { class: 'center-screen' }, form));
}

// ---------- Términos y condiciones (Ley 1581 de 2012, Colombia) ----------
export function termsContent() {
  const sec = (t, ...p) => h('section', {}, h('h3', { class: 'h-xs' }, t), p.map((x) => h('p', {}, x)));
  return h('div', { class: 'terms prose' },
    h('p', { class: 'muted' }, `Versión ${CONFIG.TERMS_VERSION}. Al usar Maqnex aceptas estas condiciones y autorizas el tratamiento de tus datos personales según la Ley 1581 de 2012 y el Decreto 1377 de 2013.`),
    sec('1. Responsable', `${CONFIG.RESPONSABLE}. Contacto: ${CONFIG.CONTACT_EMAIL}.`),
    sec('2. Qué datos recogemos', 'Correo electrónico, nombre, usuario, área, rol, foto de perfil (opcional), descripción y habilidades que escribas, mensajes en canales y conversaciones privadas, y el registro de lo que haces sobre las máquinas (horas, fallas, órdenes).'),
    sec('3. Para qué los usamos', 'Para identificarte, permitir la comunicación del equipo, asignar y seguir órdenes de mantenimiento y avisarte de fallas de tu área. No vendemos ni compartimos tus datos con terceros para publicidad.'),
    sec('4. Dónde se guardan', 'En una base de datos PostgreSQL administrada por Supabase, en servidores en la nube. Los datos viajan cifrados (HTTPS) y se guardan cifrados en disco. Tu contraseña nunca se guarda en texto: el servidor guarda solo una huella (hash bcrypt).'),
    sec('5. Quién puede ver qué', 'Las personas con cuenta ven los perfiles públicos (nombre, usuario, área, rol, foto, titular). Tus mensajes privados solo los ven tú y la otra persona. Los canales privados solo los ven sus miembros. Las reglas se aplican en el servidor (Row Level Security), no solo en la pantalla.'),
    sec('6. Tus derechos', 'Puedes conocer, actualizar y rectificar tus datos (Perfil → Editar), descargar una copia (Perfil → Privacidad → Descargar mis datos), revocar esta autorización y pedir la supresión de tu cuenta (Perfil → Privacidad → Eliminar cuenta), que borra tu perfil, tus mensajes y tus contactos.'),
    sec('7. Uso adecuado', 'No compartas tu contraseña. No publiques datos sensibles de otras personas ni contenido ofensivo. Las lecturas de sensores de este proyecto son simuladas y no reemplazan la evaluación de un técnico.'),
    sec('8. Cambios', 'Si estas condiciones cambian, te pediremos aceptarlas de nuevo antes de seguir usando la plataforma.'));
}

export function showTermsModal() {
  import('./ui.js').then(({ modal }) => modal({ title: 'Términos y política de datos', body: termsContent(), wide: true }));
}

export function renderTerms(root, { onAccept, onReject }) {
  stopFx?.();
  const err = h('p', { class: 'form-error', role: 'alert' });
  const check = h('input', { type: 'checkbox' });
  const accept = h('button', { class: 'btn primary', type: 'button', disabled: true }, 'Aceptar y continuar');
  check.addEventListener('change', () => { accept.disabled = !check.checked; });
  accept.addEventListener('click', async () => {
    accept.disabled = true; err.textContent = '';
    try {
      const { error } = await sb.rpc('accept_terms', { p_version: CONFIG.TERMS_VERSION });
      if (error) throw error;
      onAccept();
    } catch (ex) { err.textContent = errMsg(ex); accept.disabled = false; }
  });
  clear(root, h('main', { class: 'terms-screen' },
    h('div', { class: 'brand' }, logo(30), h('span', { class: 'wordmark' }, 'Maqnex')),
    eyebrow('Antes de entrar'),
    h('h1', { class: 'display' }, 'Términos y política de datos'),
    h('div', { class: 'terms-box' }, termsContent()),
    h('label', { class: 'check' }, check, 'Leí y acepto los términos y autorizo el tratamiento de mis datos personales.'),
    err,
    h('div', { class: 'row gap' }, accept,
      h('button', { class: 'btn', type: 'button', onclick: onReject }, icon('logout', 16), 'No acepto (salir)'))));
}
