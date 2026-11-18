# Seguridad de Maqnex: los 20 puntos antes de lanzar

Estado de cada medida y dónde está implementada. Todas las reglas del servidor se probaron en una base PostgreSQL local, simulando usuarios con distintos roles (técnico, supervisor, administrador, persona sin sesión).

| # | Medida | Estado | Cómo se hizo |
|---|---|---|---|
| 1 | Ocultar las API keys | ✅ | El código solo lleva la clave **pública** (publishable/anon), que está hecha para estar en el navegador. La clave secreta nunca se usa. `js/supabase.js` detecta si alguien pega una clave `sb_secret_…` o `service_role` y **se niega a arrancar**. |
| 2 | Purgar los secrets del historial de Git | ✅ | Repositorio nuevo, sin secretos desde el primer commit. `.gitignore` excluye `.env` y llaves. En cada `push`, GitHub Actions corre **Gitleaks sobre todo el historial** y `scripts/check-secrets.mjs`. Si algún día se filtra una clave: primero **rotarla en Supabase** y después limpiar el historial con `git filter-repo`. |
| 3 | Usar la key pública de la base de datos | ✅ | `SUPABASE_ANON_KEY` en `js/config.js` es la *publishable*/*anon*: con ella solo se puede lo que permitan las reglas RLS. |
| 4 | Activar Row Level Security | ✅ | RLS activado en las **13 tablas** y en el almacenamiento de fotos. Cada tabla tiene políticas explícitas (ver sección 6 de `schema.sql`). |
| 5 | Encriptar los datos sensibles | ✅ / ⚠️ | Datos cifrados en tránsito (HTTPS/TLS) y en disco (Supabase cifra el almacenamiento con AES-256). Las contraseñas solo existen como hash. No guardamos datos sensibles extra (ni documentos, ni teléfonos). ⚠️ Los mensajes no tienen cifrado de extremo a extremo: los protege RLS, y el dueño del proyecto Supabase técnicamente podría leerlos. |
| 6 | Forzar la autenticación del servidor | ✅ | El rol `anon` (sin sesión) **no tiene ningún permiso** sobre las tablas. Todas las políticas son `to authenticated` y todas las funciones RPC verifican `auth.uid()`. La identidad la decide el token firmado por Supabase, no lo que diga el navegador. |
| 7 | Restringir el acceso a los registros | ✅ | Mensajes privados: solo emisor y receptor (ni el admin los ve). Notificaciones: cada quien las suyas. Canales privados: solo sus miembros. El estado de los términos solo lo ve su dueño (función `get_my_profile`). |
| 8 | Bloquear la manipulación de campos | ✅ | **Permisos por columna**: el navegador no puede escribir `role`, `level`, `author_id`, `reported_by`, `status`, `created_by`, etc. El rol solo lo cambia un admin con `set_user_role`; el semáforo lo calcula un *trigger*; el autor se toma de la sesión. Un técnico solo puede marcar tareas y notas de sus órdenes (validado en `tg_orders_before`). |
| 9 | Asegurar las cookies de sesión | ✅ (no aplica cookies) | Maqnex **no usa cookies**. La sesión es un token JWT de vida corta (1 h) con *refresh token* rotativo, flujo **PKCE**. "Recordarme" desactivado → la sesión se borra al cerrar el navegador (`sessionStorage`). La política CSP impide scripts externos que pudieran robar el token. |
| 10 | Hashear las contraseñas | ✅ | Supabase Auth guarda las contraseñas con **bcrypt**. La app nunca las guarda ni las ve después del envío. |
| 11 | Limitar los intentos de login | ✅ | En el servidor: límites por IP de Supabase Auth. En el navegador: tras 5 fallos se bloquea 1 minuto y el tiempo se duplica con cada fallo. Mensajes de error genéricos ("correo o contraseña incorrectos") para no revelar qué correos existen. |
| 12 | Agregar protección anti-bots | ✅ | Campo trampa invisible + tiempo mínimo de llenado en los formularios. Opcional: **Cloudflare Turnstile**, validado por el servidor de Supabase (se activa en *Attack Protection* y en `TURNSTILE_SITE_KEY`). Anti-spam en el servidor: máximo 20 mensajes por minuto por persona. |
| 13 | Parametrizar las consultas SQL | ✅ | El navegador nunca arma SQL. Supabase (PostgREST) convierte cada filtro en una consulta parametrizada. Las funciones del servidor usan parámetros tipados, sin SQL dinámico. Los identificadores que se usan en filtros se validan como UUID antes de usarse. |
| 14 | Validar todos los inputs | ✅ | Doble validación: en el formulario (longitudes, rangos, listas, formato de correo y contraseña) y **en la base de datos** con restricciones `CHECK`, dominios y *triggers* (códigos `^[A-Z0-9-]{2,20}$`, horas 0,1–24 por registro, textos con máximo, lista de tareas en JSON validada, fechas no futuras…). |
| 15 | Escapar todo el contenido del usuario | ✅ | Todo lo que escriben los usuarios se inserta como **texto** (`textContent`), nunca como HTML. Probado con un mensaje `<img src=x onerror=alert(1)>`: se muestra como texto. La CSP además bloquea scripts en línea. La exportación CSV neutraliza fórmulas (`=`, `+`, `-`, `@`). |
| 16 | Restringir la subida de archivos | ✅ | Solo fotos de perfil. Navegador: PNG/JPG/WEBP, máximo 5 MB, se revisa la firma real del archivo y la imagen se **vuelve a dibujar** a 320×320 en WEBP (borra metadatos y contenido oculto). Servidor: bucket privado, máximo 2 MB, solo `image/webp`, y cada usuario solo puede escribir en su propia carpeta. |
| 17 | Recortar las respuestas de la API | ✅ | Ninguna consulta pide `*`: se piden solo las columnas necesarias, con límites de filas. El correo de los usuarios no se expone en ninguna tabla pública. Los errores del servidor se traducen a mensajes genéricos sin detalles internos. |
| 18 | Agregar headers de seguridad | ✅ / ⚠️ | CSP y política de *referrer* dentro de `index.html`. `_headers` (Netlify/Cloudflare) y `vercel.json` agregan HSTS, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`, `Permissions-Policy` y COOP. ⚠️ GitHub Pages no permite headers personalizados: allí solo aplica la CSP del HTML. Para tenerlos todos, publica el mismo repositorio en Netlify o Cloudflare Pages. |
| 19 | Forzar HTTPS | ✅ | GitHub Pages con *Enforce HTTPS*; Supabase solo acepta HTTPS/WSS; la CSP incluye `upgrade-insecure-requests`; HSTS en `_headers`/`vercel.json`. |
| 20 | Escanear las dependencias | ✅ | Una sola dependencia (`@supabase/supabase-js`), declarada en `package.json`. **Dependabot** revisa cada semana; GitHub Actions corre `npm audit` en cada cambio. |

## Pruebas realizadas sobre la base de datos

| Intento | Resultado |
|---|---|
| Leer máquinas o perfiles sin iniciar sesión | Rechazado (`permission denied`) |
| Un técnico se cambia el rol a admin | Rechazado |
| Un técnico crea una máquina u orden | Rechazado por RLS |
| Un técnico cambia la prioridad o el texto de una tarea | Rechazado por el trigger |
| Registrar una falla a nombre de otra persona | Rechazado (campo bloqueado) |
| Un técnico simula una anomalía | Rechazado |
| Llamar a la función interna de notificaciones | Rechazado (sin permiso de ejecución) |
| Ver o escribir en un canal privado sin ser miembro | Rechazado |
| Enviar mensaje privado a quien no es contacto | Rechazado |
| El admin lee mensajes privados ajenos | 0 resultados |
| Enviar 21 mensajes en un minuto | El 21 es rechazado |
| Subir una foto a la carpeta de otro usuario o un SVG | Rechazado |
| Dejar la plataforma sin administradores | Rechazado |
| Cerrar una orden dos veces o editar una cerrada | Rechazado |

## Límites honestos

- Es un proyecto académico: no ha tenido una auditoría de seguridad profesional.
- La seguridad depende de no publicar nunca la clave secreta y de ejecutar `schema.sql` completo.
- Las lecturas de sensores son simuladas.
