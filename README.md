# Maqnex · Mantenimiento que se anticipa

Plataforma web (instalable como app en el celular) para el **mantenimiento preventivo de una planta de bebidas**: semáforo de estado de las máquinas, sensores IoT simulados, órdenes de trabajo, repuestos, canales por área, mensajes privados, equipo, notificaciones y reportes con indicadores de ingeniería industrial (disponibilidad, MTBF, MTTR).

A diferencia del prototipo anterior, **esta versión no es una demo**: las cuentas, los datos y los permisos viven en un servidor real (Supabase: PostgreSQL + autenticación + tiempo real), así que cualquier persona puede registrarse con su correo y empezar a usarla desde cualquier dispositivo.

---

## ¿Qué hay en esta carpeta?

| Archivo o carpeta | Para qué sirve |
|---|---|
| `index.html` | La página. Incluye la política de seguridad de contenido (CSP). |
| `css/app.css` | Diseño: tema oscuro (guía Dala) y tema claro (guía Dayos). |
| `js/config.js` | **El único archivo que debes editar**: la dirección y la clave pública de tu Supabase. |
| `js/app.js` | Arranque, menú, navegación y sesión. |
| `js/views/` | Una pantalla por archivo (inicio, máquinas, órdenes, canales, perfil…). |
| `js/supabase.js` | Conexión con el servidor. Se niega a arrancar con una clave secreta. |
| `supabase/schema.sql` | **La base de datos completa**: tablas, seguridad (RLS), funciones y datos iniciales. |
| `supabase/seed_ejemplo.sql` | Opcional: historial de fallas y lecturas para que las gráficas no estén vacías. |
| `manifest.webmanifest`, `sw.js`, `icons/` | Lo que permite instalarla como app (PWA). |
| `SEGURIDAD.md` | Cómo se cumplió cada uno de los 20 puntos de seguridad. |
| `.github/` y `scripts/` | Revisión automática de secretos y dependencias en GitHub. |
| `_headers`, `vercel.json` | Headers de seguridad si publicas en Netlify, Cloudflare Pages o Vercel. |

---

## Puesta en marcha (unos 20 minutos)

### Paso 1. Crear la base de datos en Supabase (gratis)

1. Entra a **supabase.com** → *Start your project* → crea una cuenta (puedes usar tu GitHub).
2. **New project**. Nombre: `maqnex`. Región: **South America (São Paulo)**, la más cercana a Colombia. Guarda la contraseña de la base de datos en un lugar seguro (no la vas a pegar en la app).
3. Cuando el proyecto termine de crearse, abre **SQL Editor → New query**, pega **todo** el contenido de `supabase/schema.sql` y pulsa **Run**. Debe decir *Success*.
4. (Opcional, recomendado para la exposición) Abre otra *New query*, pega `supabase/seed_ejemplo.sql` y pulsa **Run**.

### Paso 2. Configurar el inicio de sesión

En **Authentication**:

- **Sign In / Providers → Email**: déjalo activado.
  - **Confirm email**: para la clase recomiendo **desactivarlo**. El servicio de correo que trae Supabase envía solo 2 correos por hora y está pensado para pruebas, así que tus compañeros no recibirían el correo de confirmación. Si lo desactivas, las cuentas funcionan de inmediato. (Para un producto real se deja activado y se configura un servicio de correo propio en *Authentication → SMTP Settings*, por ejemplo Brevo, que tiene plan gratis).
- **Password** (en la misma sección o en *Policies*): longitud mínima **8** y exigir **letras y números**.
- **Attack Protection** (opcional): activa *CAPTCHA* con **Cloudflare Turnstile** y pega la *site key* en `TURNSTILE_SITE_KEY` dentro de `js/config.js`.

### Paso 3. Conectar la app con tu base de datos

1. En Supabase abre **Project Settings → API Keys** (o *Data API*).
2. Copia la **Project URL** (algo como `https://abcdxyz.supabase.co`).
3. Copia la clave **Publishable** (`sb_publishable_…`). Si tu proyecto solo muestra *Legacy API keys*, usa la **anon public**.
4. Abre `js/config.js` y pégalas en `SUPABASE_URL` y `SUPABASE_ANON_KEY`. Escribe también tu correo en `CONTACT_EMAIL` (aparece en los términos).

> ⚠️ **Nunca** copies la clave `secret` (`sb_secret_…`) ni la `service_role`. Esas claves saltan toda la seguridad. Si por error la pegas, la app se niega a arrancar y te avisa.

### Paso 4. Publicar en GitHub Pages

1. En GitHub crea un repositorio **público** llamado `maqnex` (con README).
2. **Add file → Upload files** y arrastra **todo el contenido** de esta carpeta (las carpetas `css`, `js`, `icons`, `supabase`, `.github`, `scripts` y los archivos sueltos). Confirma con **Commit changes**.
   - Si GitHub no deja arrastrar `.github` (carpeta oculta), créala a mano: *Add file → Create new file* y escribe `.github/workflows/seguridad.yml` como nombre; pega el contenido.
3. **Settings → Pages** → *Deploy from a branch* → rama `main`, carpeta `/ (root)` → **Save**.
4. En la misma página marca **Enforce HTTPS**.
5. Espera 1 o 2 minutos. Tu app quedará en: **`https://nicolas-rey.github.io/maqnex/`**
6. En **Settings → Code security** activa *Dependabot alerts* y *Secret scanning* (si aparecen).

### Paso 5. Avisarle a Supabase cuál es tu página

En Supabase → **Authentication → URL Configuration**:
- **Site URL**: `https://nicolas-rey.github.io/maqnex/`
- **Redirect URLs**: agrega la misma dirección.

Sin esto, los enlaces de "olvidé mi contraseña" llevarían a una dirección equivocada.

### Paso 6. Primer ingreso

1. Abre tu enlace → **Crear cuenta**. **La primera cuenta que se registra queda como Administrador** (eres tú).
2. Acepta los términos.
3. Comparte el enlace con tu compañero y tu profesor. Cada uno crea su cuenta (empiezan como *Técnico*).
4. En **Administración** cambias sus roles (por ejemplo, tu compañero como *Supervisor*).

### Paso 7. Instalarla como app
- **Android (Chrome)**: menú ⋮ → *Instalar app*.
- **iPhone (Safari)**: Compartir → *Agregar a inicio*.
- **Computador (Chrome/Edge)**: ícono de instalar en la barra de direcciones.

---

## Probarla en tu computador (opcional)

Con Python instalado, dentro de la carpeta:

```
python -m http.server 5173
```

y abre `http://localhost:5173`. Recuerda agregar `http://localhost:5173` en *Redirect URLs* de Supabase si vas a probar la recuperación de contraseña.

---

## Qué mostrarle al profesor

| Lo que pide | Dónde se ve |
|---|---|
| **Base de datos** | Supabase → *Table Editor*: tablas `profiles`, `machines`, `failures`, `work_orders`, `parts`, `messages`… con los datos reales que crean los usuarios. |
| **Servidor y autenticación** | Supabase → *Authentication → Users*: las cuentas registradas. Las contraseñas no se ven: solo se guarda su huella (hash). |
| **Seguridad por filas (RLS)** | Supabase → *Authentication → Policies* (o *Database → Policies*): las reglas de cada tabla. |
| **Tiempo real** | Abre la app en dos celulares: un mensaje en *Canales* o una anomalía simulada aparece en el otro al instante. |
| **Permisos por rol** | Entra como Técnico: no puede crear máquinas ni órdenes. Aunque alguien modifique la página, el servidor lo rechaza. |
| **Indicadores de ingeniería** | *Inicio* y *Reportes*: disponibilidad, MTBF, MTTR y costos, con la fórmula explicada en pantalla. |

**Demostración sugerida (3 minutos):** entra al *Compresor de aire* → *Simular anomalía* → el semáforo pasa a rojo y llega una notificación a todo el área → *Crear orden* asignada a tu compañero → él la abre en su celular, marca las tareas y la cierra → la máquina vuelve a verde y se descuenta el repuesto.

---

## Problemas frecuentes

| Problema | Solución |
|---|---|
| Aparece "Falta conectar la base de datos" | Revisa `js/config.js`: la URL debe terminar en `.supabase.co` y la clave no debe tener espacios. |
| "Demasiados intentos" o *Email rate limit exceeded* al registrarse | Es el límite de correos de Supabase. Desactiva *Confirm email* (Paso 2) o configura SMTP propio. |
| Error 404 en GitHub Pages | El archivo debe llamarse `index.html` y estar en la raíz del repositorio. Espera unos minutos. |
| "No tienes permiso para hacer esto" | Es correcto: esa acción no corresponde a tu rol. Pide a un administrador que te lo cambie. |
| La app dejó de cargar después de unos días sin uso | En el plan gratis, Supabase pausa los proyectos con poca actividad durante 7 días. Entra al panel de Supabase y pulsa **Resume project**. **Hazlo el día antes de la exposición.** |

---

## Lo que es real y lo que es simulado

- **Real**: cuentas, contraseñas, base de datos, permisos, canales, mensajes privados, contactos, órdenes, repuestos, notificaciones, reportes y exportaciones.
- **Simulado**: las lecturas de temperatura y vibración. Las genera **el servidor** (función `simulate_reading`) alrededor de los valores normales de cada máquina; el navegador no puede inventar lecturas. El siguiente paso sería un sensor físico (por ejemplo un ESP32) que escriba en la tabla `sensor_readings`.
- Los umbrales del semáforo (75/85 °C y 4,5/6,5 mm/s) son de ejemplo: en una planta real se toman de los manuales del fabricante.
- El texto de los términos es un modelo para el proyecto académico; no es asesoría legal.

---

## Cómo está construido (para explicar el código)

- **Frontend**: HTML, CSS y JavaScript sin frameworks, dividido en módulos (`js/views/*.js`, una pantalla por archivo). No necesita instalar nada para publicarse.
- **Backend**: Supabase. La lógica importante está en la base de datos (`schema.sql`):
  - el semáforo se calcula en el servidor (`compute_level`),
  - las notificaciones las crean *triggers* (cuando se registra una falla o una máquina empeora),
  - cerrar una orden (`close_work_order`) descuenta el repuesto y reinicia las horas en una sola operación,
  - las reglas RLS deciden quién ve y cambia cada fila.
- **Tiempo real**: Supabase Realtime envía a cada usuario solo los cambios que su RLS le permite ver.
