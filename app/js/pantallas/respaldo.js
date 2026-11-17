/**
 * COPIA DE SEGURIDAD (solo el dueño, manual): una copia completa de la planilla en el Drive.
 * Dirección: #/respaldo
 */
PANTALLAS.respaldo = function () {
  if (!esDueno()) return ir('inicio');
  render(htmlBarra('Copia de seguridad', 'inicio') +
    '<main class="contenido">' +
      '<h1>💾 COPIA DE SEGURIDAD</h1>' +
      '<p class="saludo">Una copia completa de todos los datos, en tu Drive</p>' +
      '<div class="tarjeta-info">' +
        '<p>Guarda <b>todo junto</b>: Huerta, Forrajes, Taller rural, Maquinaria, Economía, tareas, cursos, asistencia y usuarios. ' +
        'Queda en la carpeta <b>“Entornos Formativos – Respaldos”</b> de tu Drive, con la fecha en el nombre.</p>' +
        '<p class="ayuda">Las fotos no se copian: ya están guardadas en su carpeta del Drive. Antes de hacer la copia, fijate que no diga “sin enviar” arriba.</p>' +
      '</div>' +
      '<button class="boton" id="boton-respaldo" onclick="hacerCopiaSeguridad(this)">💾 Hacer copia de seguridad ahora</button>' +
      '<p class="mensaje" id="mensaje-respaldo"></p>' +
      '<div id="lista-respaldos"><p class="vacio">Buscando las copias…</p></div>' +
    '</main>');
  cargarRespaldos();
};

async function cargarRespaldos() {
  const lugar = document.getElementById('lista-respaldos');
  if (!lugar) return;
  if (!navigator.onLine) { lugar.innerHTML = '<p class="vacio">Sin conexión: para ver o hacer copias hace falta internet.</p>'; return; }
  try {
    await dibujarRespaldos(await llamar('listarCopias'));
  } catch (e) {
    lugar.innerHTML = '<p class="mensaje error">No se pudieron ver las copias: ' + esc(e.message) + '</p>';
  }
}

async function dibujarRespaldos(r) {
  await BaseLocal.escribirMeta('ultimoRespaldo', r.copias.length ? r.copias[0].fecha : '');
  const lugar = document.getElementById('lista-respaldos');
  if (!lugar) return;
  lugar.innerHTML = '<section class="bloque-curso"><div class="lista-necesidades-cabecera"><h2 class="grupo-titulo">Copias guardadas <span class="contador">' + r.copias.length + '</span></h2>' +
      '<div class="acciones"><a class="boton chico secundario" href="' + esc(r.carpeta) + '" target="_blank" rel="noopener">Abrir la carpeta</a></div></div>' +
    (r.copias.length ? r.copias.map(function (c, i) {
      const fecha = new Date(c.fecha);
      return '<a class="fila-clase" href="' + esc(c.url) + '" target="_blank" rel="noopener">' +
        '<strong>' + NOMBRES_DIAS[fecha.getDay()] + ' ' + formatearFecha(fechaLocal(c.fecha)) + ' · ' +
          String(fecha.getHours()).padStart(2, '0') + ':' + String(fecha.getMinutes()).padStart(2, '0') + ' hs' + (i === 0 ? ' (la última)' : '') + '</strong>' +
        '<span class="ayuda">' + esc(c.nombre) + '</span></a>';
    }).join('') + '<p class="ayuda">Si se juntan muchas, podés borrar las más viejas desde la carpeta del Drive.</p>'
      : '<p class="vacio">Todavía no hay ninguna copia.</p>') + '</section>';
}

async function hacerCopiaSeguridad(boton) {
  if (!navigator.onLine) return mostrarMensaje('mensaje-respaldo', 'Hace falta internet para hacer la copia.', 'error');
  ocupado(boton, true, 'Haciendo la copia…');
  mostrarMensaje('mensaje-respaldo', '');
  try {
    await Sincronizador.sincronizar(); // primero se envía lo que falte de este equipo
    if (Sincronizador.pendientes) throw new Error('quedaron cambios sin enviar en este equipo. Probá de nuevo en un momento.');
    await dibujarRespaldos(await llamar('copiaSeguridad'));
    mostrarMensaje('mensaje-respaldo', '✓ Copia hecha. Quedó guardada en tu Drive.', 'ok');
  } catch (e) {
    mostrarMensaje('mensaje-respaldo', 'No se pudo hacer la copia: ' + e.message, 'error');
  }
  ocupado(boton, false);
}

/** En el inicio: avisa si nunca se hizo una copia o si pasaron 7 días o más desde la última. */
async function avisarRespaldoViejo() {
  const ultimo = await BaseLocal.leerMeta('ultimoRespaldo');
  const insignia = document.getElementById('insignia-respaldo');
  if (!insignia) return;
  const dias = ultimo ? diasEntre(fechaLocal(ultimo), hoyTexto()) : null;
  if (dias === null) insignia.textContent = 'sin copias';
  else if (dias >= 7) insignia.textContent = 'hace ' + dias + ' días';
  else return;
  insignia.hidden = false;
}
