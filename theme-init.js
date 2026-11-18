// Aplica el tema guardado antes de pintar la página (evita parpadeo).
(function () {
  var t = null;
  try { t = localStorage.getItem('mx_theme'); } catch (e) { /* almacenamiento bloqueado */ }
  if (t !== 'light' && t !== 'dark') t = 'dark';
  document.documentElement.setAttribute('data-theme', t);
  var m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute('content', t === 'light' ? '#e5e5e5' : '#000000');
})();
