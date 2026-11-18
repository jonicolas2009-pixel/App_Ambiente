import { h, pageHead, levelChip, icon } from '../ui.js';
import { promptInstall } from '../app.js';

const GLOSSARY = [
  ['Mantenimiento preventivo', 'Trabajo planificado antes de que ocurra una falla, por horas de uso o por calendario.'],
  ['Mantenimiento correctivo', 'Reparación que se hace después de que la máquina falla.'],
  ['Mantenimiento predictivo', 'Usa mediciones (temperatura, vibración) para anticipar fallas. Maqnex usa reglas simples; no es inteligencia artificial.'],
  ['Disponibilidad', 'Porcentaje del tiempo planeado en que la máquina estuvo lista para producir.'],
  ['MTBF', 'Mean Time Between Failures: tiempo promedio de operación entre una falla y la siguiente. Más alto es mejor.'],
  ['MTTR', 'Mean Time To Repair: tiempo promedio que toma reparar una falla. Más bajo es mejor.'],
  ['Vibración (mm/s)', 'Velocidad de vibración de la máquina. Un aumento suele indicar desgaste, desbalance o rodamientos dañados.'],
  ['LOTO', 'Lockout/Tagout (bloqueo y etiquetado): cortar y bloquear la energía antes de intervenir una máquina.'],
  ['Orden de trabajo', 'Documento que dice qué hacer, en qué máquina, quién lo hace, con qué repuestos y en cuánto tiempo.'],
  ['IoT', 'Internet de las cosas: sensores conectados que envían datos a un servidor. En Maqnex las lecturas se simulan en el servidor.'],
  ['RLS', 'Row Level Security: reglas de la base de datos que deciden, fila por fila, quién puede ver o cambiar cada dato.'],
];

export async function render(page) {
  const sec = (title, ...body) => h('section', { class: 'block card' }, h('h2', { class: 'h-sm' }, title), body);
  page.append(
    pageHead('Guía', 'Ayuda', 'Cómo funciona Maqnex y qué significa cada término.'),
    h('div', { class: 'cols' },
      sec('El semáforo',
        h('p', { class: 'prose' }, 'El servidor calcula el estado de cada máquina con dos reglas y se queda con la más grave:'),
        h('ul', { class: 'legend' },
          h('li', {}, levelChip('normal'), 'Menos del 70 % del intervalo de mantenimiento.'),
          h('li', {}, levelChip('proximo'), 'Desde el 70 % del intervalo.'),
          h('li', {}, levelChip('recomendado'), 'Desde el 90 %, o temperatura > 75 °C, o vibración > 4,5 mm/s.'),
          h('li', {}, levelChip('alta'), 'Intervalo cumplido, o temperatura > 85 °C, o vibración > 6,5 mm/s.')),
        h('p', { class: 'muted small' }, 'Los umbrales son de ejemplo; en una planta real se ajustan con los manuales del fabricante.')),
      sec('Roles y permisos',
        h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
          h('thead', {}, h('tr', {}, ['Acción', 'Técnico', 'Supervisor', 'Admin'].map((t) => h('th', {}, t)))),
          h('tbody', {}, [
            ['Ver máquinas, reportes y canales', '✓', '✓', '✓'],
            ['Registrar horas y fallas', '✓', '✓', '✓'],
            ['Trabajar y cerrar sus órdenes', '✓', '✓', '✓'],
            ['Crear máquinas, órdenes y repuestos', '—', '✓', '✓'],
            ['Simular anomalías', '—', '✓', '✓'],
            ['Eliminar registros y asignar roles', '—', '—', '✓'],
          ].map((r) => h('tr', {}, r.map((c) => h('td', {}, c))))))),
        h('p', { class: 'muted small' }, 'Estas reglas viven en la base de datos: aunque alguien modifique la página, el servidor rechaza lo que no le corresponde.'))),
    sec('Glosario', h('dl', { class: 'glossary' }, GLOSSARY.map(([k, v]) => h('div', {}, h('dt', {}, k), h('dd', {}, v))))),
    h('div', { class: 'cols' },
      sec('Instalar como app',
        h('ul', { class: 'prose' },
          h('li', {}, h('strong', {}, 'Android (Chrome): '), 'menú ⋮ → "Instalar app" o "Agregar a pantalla principal".'),
          h('li', {}, h('strong', {}, 'iPhone (Safari): '), 'botón Compartir → "Agregar a inicio".'),
          h('li', {}, h('strong', {}, 'Computador (Chrome o Edge): '), 'ícono de instalar en la barra de direcciones.')),
        h('button', { class: 'btn', type: 'button', onclick: promptInstall }, icon('install', 16), 'Instalar ahora')),
      sec('Qué es real y qué es simulado',
        h('ul', { class: 'prose' },
          h('li', {}, 'Real: cuentas, contraseñas, base de datos, permisos, mensajes, canales, órdenes, repuestos, notificaciones y reportes.'),
          h('li', {}, 'Simulado: las lecturas de temperatura y vibración. Las genera el servidor alrededor de los valores normales de cada máquina.'),
          h('li', {}, 'Siguiente paso: conectar un sensor físico (por ejemplo un ESP32) que escriba en la tabla de lecturas.')))));
}
