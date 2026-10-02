/**
 * BASE DE LA APP: pantallas, navegación y utilidades comunes.
 * Cada pantalla se registra en PANTALLAS desde su propio archivo (carpeta js/pantallas).
 * La dirección después del # indica qué pantalla mostrar: #/ingresar, #/inicio, #/entorno/huerta ...
 */
const PANTALLAS = {};
const PANTALLAS_PUBLICAS = ['ingresar', 'registro'];
const NOMBRES_ROL = { dueno: 'Dueño', editor: 'Editor', visor: 'Visor' };

let avisoPendiente = null; // mensaje para mostrar en la próxima pantalla

function iniciarApp() {
  window.addEventListener('hashchange', mostrarPantalla);
  window.addEventListener('online', actualizarIndicadorRed);
  window.addEventListener('offline', actualizarIndicadorRed);
  mostrarPantalla();
  revisarSesion();
}

function ir(ruta) {
  if (location.hash === '#/' + ruta) mostrarPantalla();
  else location.hash = '#/' + ruta;
}

function mostrarPantalla() {
  const partes = location.hash.replace(/^#\/?/, '').split('/');
  let ruta = partes[0];
  const parametro = partes[1] || '';
  const sesion = Sesion.leer();

  if (!sesion && PANTALLAS_PUBLICAS.indexOf(ruta) === -1) ruta = 'ingresar';
  else if (sesion && (PANTALLAS_PUBLICAS.indexOf(ruta) !== -1 || !PANTALLAS[ruta])) ruta = 'inicio';

  const destino = '#/' + ruta + (parametro && ruta === partes[0] ? '/' + parametro : '');
  if (location.hash !== destino) history.replaceState(null, '', destino);

  window.scrollTo(0, 0);
  PANTALLAS[ruta](parametro);
  actualizarIndicadorRed();
}

/** Al abrir la app con una sesión guardada, confirma con el servidor que sigue valiendo. */
async function revisarSesion() {
  const sesion = Sesion.leer();
  if (!sesion) return;
  try {
    const datos = await llamar('yo');
    Sesion.guardar({ token: datos.token, usuario: datos.usuario, sinConexion: false });
    if (datos.usuario.rol !== sesion.usuario.rol) mostrarPantalla();
  } catch (e) {
    if (e.codigo === 'SESION') cerrarSesion(e.message);
    // Si es 'RED' no pasa nada: se sigue trabajando sin conexión
  }
}

function cerrarSesion(motivo) {
  Sesion.borrar();
  avisoPendiente = motivo ? { texto: motivo, tipo: 'error' } : null;
  ir('ingresar');
}

/* ---------- Utilidades para armar pantallas ---------- */

function render(html) {
  document.getElementById('app').innerHTML = html;
}

/** Escapa texto para mostrarlo sin riesgo dentro del HTML. */
function esc(texto) {
  return String(texto === undefined || texto === null ? '' : texto)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function htmlAviso() {
  if (!avisoPendiente) return '';
  const html = '<div class="aviso ' + (avisoPendiente.tipo || '') + '">' + esc(avisoPendiente.texto) + '</div>';
  avisoPendiente = null;
  return html;
}

/** Barra verde de arriba. volverA = ruta a la que vuelve la flecha (vacío = sin flecha). */
function htmlBarra(titulo, volverA) {
  const sesion = Sesion.leer();
  return '<header class="barra">' +
    (volverA ? '<button onclick="ir(\'' + volverA + '\')" aria-label="Volver">←</button>' : '') +
    '<span class="titulo">' + esc(titulo) + '</span>' +
    '<span class="chip sin-red" id="indicador-red" hidden>Sin conexión</span>' +
    (sesion ? '<span class="chip">' + esc(NOMBRES_ROL[sesion.usuario.rol] || sesion.usuario.rol) + '</span>' : '') +
    (sesion ? '<button onclick="cerrarSesion()">Salir</button>' : '') +
    '</header>';
}

function actualizarIndicadorRed() {
  const indicador = document.getElementById('indicador-red');
  if (indicador) indicador.hidden = navigator.onLine;
}

function mostrarMensaje(id, texto, tipo) {
  const elemento = document.getElementById(id);
  if (!elemento) return;
  elemento.textContent = texto || '';
  elemento.className = 'mensaje ' + (tipo || '');
}

function ocupado(boton, estaOcupado, textoOcupado) {
  if (estaOcupado) {
    boton.dataset.texto = boton.textContent;
    boton.textContent = textoOcupado || 'Un momento…';
    boton.disabled = true;
  } else {
    boton.textContent = boton.dataset.texto || boton.textContent;
    boton.disabled = false;
  }
}

/** "2026-10-01T22:55:00.000Z" → "01/10/2026" */
function formatearFecha(iso) {
  if (!iso) return '';
  const fecha = new Date(iso);
  return isNaN(fecha) ? String(iso) : fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function esDueno() {
  const sesion = Sesion.leer();
  return !!sesion && sesion.usuario.rol === 'dueno';
}
