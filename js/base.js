/**
 * BASE DE LA APP: pantallas, navegación y utilidades comunes.
 * Cada pantalla se registra en PANTALLAS desde su propio archivo (carpeta js/pantallas).
 * La dirección después del # indica qué pantalla mostrar: #/ingresar, #/inicio, #/entorno/huerta ...
 */
const PANTALLAS = {};
const PANTALLAS_PUBLICAS = ['ingresar', 'registro'];
const NOMBRES_ROL = { dueno: 'Dueño', editor: 'Editor', visor: 'Visor' };

let avisoPendiente = null;       // mensaje para mostrar en la próxima pantalla
let alActualizarDatos = null;    // la pantalla abierta pone acá cómo redibujarse cuando llegan datos nuevos

function iniciarApp() {
  window.addEventListener('hashchange', mostrarPantalla);
  window.addEventListener('ef-sync', actualizarIndicadorSync);
  window.addEventListener('ef-datos', function () {
    if (typeof alActualizarDatos === 'function') alActualizarDatos();
  });
  Sincronizador.iniciar();
  registrarTrabajadorSinConexion();
  mostrarPantalla();
  revisarSesion();
}

/**
 * Activa el funcionamiento sin internet (sw.js) y avisa cuando hay una versión nueva de la app.
 */
function registrarTrabajadorSinConexion() {
  if (!('serviceWorker' in navigator)) return;
  let recargando = false;
  const habiaVersionAnterior = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    // La primera vez que se instala no hace falta recargar; solo al pasar a una versión nueva
    if (recargando || !habiaVersionAnterior) return;
    recargando = true;
    location.reload();
  });

  navigator.serviceWorker.register('sw.js').then(function (registro) {
    if (registro.waiting && navigator.serviceWorker.controller) mostrarAvisoActualizacion(registro.waiting);
    registro.addEventListener('updatefound', function () {
      const nuevo = registro.installing;
      nuevo.addEventListener('statechange', function () {
        if (nuevo.state === 'installed' && navigator.serviceWorker.controller) mostrarAvisoActualizacion(nuevo);
      });
    });
    // Revisar si hay versión nueva cada vez que se vuelve a la app
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') registro.update().catch(function () {});
    });
  }).catch(function () { /* sin soporte: la app funciona igual, pero no abre sin internet */ });
}

function mostrarAvisoActualizacion(trabajador) {
  if (document.getElementById('aviso-version')) return;
  const aviso = document.createElement('div');
  aviso.id = 'aviso-version';
  aviso.className = 'aviso-version';
  aviso.innerHTML = '<span>Hay una versión nueva de la app.</span><button class="boton chico">Actualizar</button>';
  aviso.querySelector('button').addEventListener('click', function () {
    this.disabled = true;
    this.textContent = 'Actualizando…';
    trabajador.postMessage('actualizar');
  });
  document.body.appendChild(aviso);
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

  cerrarModal();
  alActualizarDatos = null;
  window.scrollTo(0, 0);
  PANTALLAS[ruta](parametro);
  actualizarIndicadorSync();
}

/** Al abrir la app con una sesión guardada, confirma con el servidor que sigue valiendo y sincroniza. */
async function revisarSesion() {
  const sesion = Sesion.leer();
  if (!sesion) return;
  try {
    const datos = await llamar('yo');
    Sesion.guardar({ token: datos.token, usuario: datos.usuario, sinConexion: false });
    if (datos.usuario.rol !== sesion.usuario.rol) mostrarPantalla();
  } catch (e) {
    if (e.codigo === 'SESION') return cerrarSesion(e.message);
    // Si es 'RED' no pasa nada: se sigue trabajando sin conexión
  }
  Sincronizador.sincronizar();
}

function cerrarSesion(motivo) {
  Sesion.borrar();
  avisoPendiente = motivo ? { texto: motivo, tipo: 'error' } : null;
  ir('ingresar');
}

/** Botón Salir: avisa si quedan cambios sin enviar al servidor. */
async function salir() {
  await Sincronizador.actualizarEstado();
  if (Sincronizador.pendientes &&
      !confirm('Hay ' + Sincronizador.pendientes + ' cambio(s) sin sincronizar.\n' +
               'Quedan guardados en este equipo y se van a enviar la próxima vez que alguien entre con internet.\n\n¿Salir igual?')) {
    return;
  }
  cerrarSesion();
}

/* ---------- Permisos ---------- */

function esDueno() {
  const sesion = Sesion.leer();
  return !!sesion && sesion.usuario.rol === 'dueno';
}

function puedeEditar() {
  const sesion = Sesion.leer();
  return !!sesion && (sesion.usuario.rol === 'dueno' || sesion.usuario.rol === 'editor');
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
    '<button class="chip-sync" id="indicador-sync" onclick="Sincronizador.sincronizar()" hidden></button>' +
    (sesion ? '<span class="chip">' + esc(NOMBRES_ROL[sesion.usuario.rol] || sesion.usuario.rol) + '</span>' : '') +
    (sesion ? '<button onclick="salir()">Salir</button>' : '') +
    '</header>';
}

/** El cartelito de la barra: sin conexión, cambios sin enviar, sincronizando... */
function actualizarIndicadorSync() {
  const indicador = document.getElementById('indicador-sync');
  if (!indicador) return;
  const s = Sincronizador;
  const textos = {
    'sin-red': 'Sin conexión' + (s.pendientes ? ' · ' + s.pendientes + ' sin enviar' : ''),
    'sincronizando': 'Sincronizando…',
    'pendiente': s.pendientes + ' sin enviar',
    'error': 'Error al sincronizar',
    'ok': ''
  };
  indicador.textContent = textos[s.estado] || '';
  indicador.title = s.estado === 'error' ? s.mensajeError : 'Tocá para sincronizar ahora';
  indicador.className = 'chip-sync ' + s.estado;
  indicador.hidden = !indicador.textContent;
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

function opcionesSelect(valores, elegido, textoVacio) {
  return (textoVacio !== undefined ? '<option value="">' + esc(textoVacio) + '</option>' : '') +
    valores.map(function (v) {
      return '<option value="' + esc(v) + '"' + (v === elegido ? ' selected' : '') + '>' + esc(v) + '</option>';
    }).join('');
}

/* ---------- Ventana emergente (formularios) ---------- */

function abrirModal(html) {
  cerrarModal();
  const fondo = document.createElement('div');
  fondo.className = 'modal-fondo';
  fondo.id = 'modal';
  fondo.innerHTML = '<div class="modal" role="dialog" aria-modal="true">' + html + '</div>';
  fondo.addEventListener('click', function (e) { if (e.target === fondo) cerrarModal(); });
  document.body.appendChild(fondo);
  document.body.classList.add('con-modal');
  const primero = fondo.querySelector('input, select, textarea');
  if (primero) primero.focus();
}

function cerrarModal() {
  const modal = document.getElementById('modal');
  if (modal) modal.remove();
  document.body.classList.remove('con-modal');
}

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') cerrarModal();
});

/* ---------- Fechas (siempre como texto "AAAA-MM-DD", hora local) ---------- */

const NOMBRES_DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function fechaATexto(fecha) {
  return fecha.getFullYear() + '-' + String(fecha.getMonth() + 1).padStart(2, '0') + '-' + String(fecha.getDate()).padStart(2, '0');
}

function textoAFecha(texto) {
  const p = String(texto).split('-').map(Number);
  return new Date(p[0], p[1] - 1, p[2]);
}

function hoyTexto() {
  return fechaATexto(new Date());
}

function sumarDias(texto, dias) {
  const fecha = textoAFecha(texto);
  fecha.setDate(fecha.getDate() + dias);
  return fechaATexto(fecha);
}

function lunesDe(texto) {
  const fecha = textoAFecha(texto);
  return sumarDias(texto, -((fecha.getDay() + 6) % 7));
}

/** La semana "actual": sábado y domingo ya muestran la semana que viene. */
function lunesSemanaActual() {
  const dia = new Date().getDay();
  const lunes = lunesDe(hoyTexto());
  return dia === 0 || dia === 6 ? sumarDias(lunes, 7) : lunes;
}

function esDiaHabil(texto) {
  const dia = textoAFecha(texto).getDay();
  return dia >= 1 && dia <= 5;
}

/** "2026-10-01" → "01/10" */
function diaMes(texto) {
  const p = String(texto).split('-');
  return p.length === 3 ? p[2] + '/' + p[1] : String(texto);
}

/** "2026-10-01T22:55:00.000Z" o "2026-10-01" → "01/10/2026" */
function formatearFecha(valor) {
  if (!valor) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const p = valor.split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }
  const fecha = new Date(valor);
  return isNaN(fecha) ? String(valor) : fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
