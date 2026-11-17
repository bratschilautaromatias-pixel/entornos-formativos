/**
 * FOTOS: se sacan o eligen desde el celular, se achican (1280 px, ~200 KB), se guardan en el equipo
 * y se suben al Drive (carpeta privada) cuando hay internet. Funcionan sin conexión.
 * Cada foto pertenece a un registro: { tabla, registroId }. La imagen queda guardada en el equipo
 * (meta "foto:<id>") para verla sin internet.
 */
const FOTOS = { ladoMaximo: 1280, calidad: 0.72, maximoEnInforme: 30 };

function fotosDe(lista, tabla, registroId) {
  return (lista || []).filter(function (f) { return f.tabla === tabla && f.registroId === registroId; })
    .sort(function (a, b) { return String(a.fecha).localeCompare(String(b.fecha)) || String(a.creadoEn).localeCompare(String(b.creadoEn)); });
}

/**
 * Bloque de fotos para la ficha de un registro (siembra, máquina, proyecto…).
 * contexto: texto corto que identifica el registro en los informes (ej. "Macrotúnel lomo 1 · Tomate").
 */
function htmlBloqueFotos(listaFotos, tabla, registroId, entorno, contexto) {
  const fotos = fotosDe(listaFotos, tabla, registroId);
  return '<section class="bloque-curso bloque-fotos"><div class="lista-necesidades-cabecera"><h2 class="grupo-titulo">📷 Fotos <span class="contador">' + fotos.length + '</span></h2>' +
      (puedeEditar() ? '<div class="acciones"><button class="boton chico secundario" onclick="agregarFotos(\'' + esc(tabla) + '\', \'' + esc(registroId) + '\', \'' +
        esc(entorno) + '\', \'' + esc(String(contexto || '').replace(/'/g, '’')) + '\')">+ Foto</button></div>' : '') +
    '</div>' +
    (fotos.length ? htmlMiniaturas(fotos) : '<p class="ayuda">Todavía no hay fotos.</p>') +
  '</section>';
}

/** Botón chico "📷 3" para registros que se muestran en listas (almácigos, servicios, pedidos…). */
function htmlBotonFotos(listaFotos, tabla, registroId, entorno, contexto) {
  const cantidad = fotosDe(listaFotos, tabla, registroId).length;
  if (!cantidad && !puedeEditar()) return '';
  return '<button class="boton chico secundario boton-fotos" onclick="event.stopPropagation(); abrirGaleria(\'' + esc(tabla) + '\', \'' + esc(registroId) + '\', \'' +
    esc(entorno) + '\', \'' + esc(String(contexto || '').replace(/'/g, '’')) + '\')" aria-label="Fotos" title="Fotos">📷' + (cantidad ? ' ' + cantidad : '') + '</button>';
}

function htmlMiniaturas(fotos) {
  return '<div class="miniaturas">' + fotos.map(function (f) {
    return '<button class="miniatura" onclick="event.stopPropagation(); verFoto(\'' + esc(f.id) + '\')" title="' + esc(f.descripcion || formatearFecha(f.fecha)) + '">' +
      '<img data-foto="' + esc(f.id) + '" alt="' + esc(f.descripcion || 'Foto') + '">' +
      '<span>' + esc(diaMes(f.fecha)) + (f.archivoId ? '' : ' ⏳') + '</span></button>';
  }).join('') + '</div>';
}

/** Completa las <img data-foto> que haya en pantalla (desde el equipo, o pidiéndolas al servidor). */
async function pintarFotosEnPantalla(raiz) {
  const imagenes = (raiz || document).querySelectorAll('img[data-foto]:not([src])');
  for (const img of imagenes) {
    const foto = await Datos.obtener('Fotos', img.getAttribute('data-foto'));
    const src = foto ? await imagenDeFoto(foto) : null;
    if (src) img.src = src;
    else img.closest('.miniatura') && img.closest('.miniatura').classList.add('sin-imagen');
  }
}

/** La imagen de una foto: la guardada en el equipo o, con internet, la del Drive (y se guarda). */
async function imagenDeFoto(foto) {
  const local = await BaseLocal.leerMeta('foto:' + foto.id);
  if (local) return local;
  if (!foto.archivoId || !navigator.onLine) return null;
  try {
    const r = await llamar('verFoto', { archivoId: foto.archivoId });
    const src = 'data:image/jpeg;base64,' + r.datos;
    await BaseLocal.escribirMeta('foto:' + foto.id, src);
    return src;
  } catch (e) {
    return null;
  }
}

/* ---------- Sacar / elegir fotos ---------- */

function agregarFotos(tabla, registroId, entorno, contexto) {
  if (!puedeEditar()) return;
  const entrada = document.createElement('input');
  entrada.type = 'file';
  entrada.accept = 'image/*';
  entrada.multiple = true;
  entrada.addEventListener('change', function () {
    guardarArchivosFoto(Array.prototype.slice.call(entrada.files || []), tabla, registroId, entorno, contexto);
  });
  entrada.click();
}

/** Achica y guarda en el equipo las fotos elegidas; después se suben solas. */
async function guardarArchivosFoto(archivos, tabla, registroId, entorno, contexto) {
  if (!archivos.length) return;
  let guardadas = 0;
  for (const archivo of archivos) {
    try {
      const src = await comprimirImagen(archivo);
      const fecha = archivo.lastModified ? fechaATexto(new Date(archivo.lastModified)) : hoyTexto();
      // Primero la imagen en el equipo y después el registro: así nunca hay un registro sin su foto
      const id = crypto.randomUUID ? crypto.randomUUID() : idAlAzar();
      await BaseLocal.escribirMeta('foto:' + id, src);
      await Datos.guardar('Fotos', {
        id: id, tabla: tabla, registroId: registroId, entorno: entorno, contexto: contexto,
        fecha: fecha > hoyTexto() ? hoyTexto() : fecha, descripcion: '', archivoId: ''
      });
      guardadas++;
    } catch (e) {
      alert('No se pudo usar la foto "' + archivo.name + '": ' + e.message);
    }
  }
  if (guardadas && document.getElementById('galeria-fotos')) abrirGaleria(tabla, registroId, entorno, contexto);
}

/** Achica la foto a 1280 px de lado como máximo y la pasa a JPEG. Devuelve "data:image/jpeg;base64,…". */
function comprimirImagen(archivo) {
  return new Promise(function (resolver, rechazar) {
    if (!/^image\//.test(archivo.type)) return rechazar(new Error('no es una imagen'));
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = function () {
      const escala = Math.min(1, FOTOS.ladoMaximo / Math.max(img.naturalWidth, img.naturalHeight));
      const lienzo = document.createElement('canvas');
      lienzo.width = Math.round(img.naturalWidth * escala);
      lienzo.height = Math.round(img.naturalHeight * escala);
      lienzo.getContext('2d').drawImage(img, 0, 0, lienzo.width, lienzo.height);
      URL.revokeObjectURL(url);
      resolver(lienzo.toDataURL('image/jpeg', FOTOS.calidad));
    };
    img.onerror = function () { URL.revokeObjectURL(url); rechazar(new Error('el formato no se puede leer')); };
    img.src = url;
  });
}

/* ---------- Subida (la llama el Sincronizador cuando hay internet) ---------- */

let subiendoFotos = false;

async function subirFotosPendientes() {
  if (subiendoFotos || !navigator.onLine || !puedeEditar()) return;
  subiendoFotos = true;
  try {
    const pendientes = (await Datos.listar('Fotos')).filter(function (f) { return !f.archivoId; });
    for (const f of pendientes) {
      const src = await BaseLocal.leerMeta('foto:' + f.id);
      if (!src) continue; // la sacó otro equipo: la sube ese equipo
      const r = await llamar('subirFoto', { id: f.id, datos: String(src).replace(/^data:image\/\w+;base64,/, '') });
      await Datos.guardar('Fotos', { id: f.id, archivoId: r.archivoId });
    }
  } catch (e) {
    // sin conexión o error del servidor: se reintenta en la próxima sincronización
  } finally {
    subiendoFotos = false;
  }
}

/* ---------- Galería y visor ---------- */

async function abrirGaleria(tabla, registroId, entorno, contexto) {
  const fotos = fotosDe(await Datos.listar('Fotos'), tabla, registroId);
  abrirModal('<div id="galeria-fotos"><h2>📷 Fotos</h2>' + (contexto ? '<p class="ayuda">' + esc(contexto) + '</p>' : '') +
    (fotos.length ? htmlMiniaturas(fotos) : '<p class="ayuda">Todavía no hay fotos.</p>') +
    '<div class="modal-botones"><span class="espacio"></span>' +
      '<button type="button" class="boton chico secundario" onclick="cerrarModal()">Cerrar</button>' +
      (puedeEditar() ? '<button type="button" class="boton chico" onclick="agregarFotos(\'' + esc(tabla) + '\', \'' + esc(registroId) + '\', \'' + esc(entorno) + '\', \'' +
        esc(String(contexto || '').replace(/'/g, '’')) + '\')">+ Foto</button>' : '') +
    '</div></div>');
  pintarFotosEnPantalla(document.getElementById('galeria-fotos'));
}

async function verFoto(id) {
  const foto = await Datos.obtener('Fotos', id);
  if (!foto) return;
  const editar = puedeEditar();
  abrirModal('<div class="visor-foto">' +
    '<img id="foto-grande" alt="' + esc(foto.descripcion || 'Foto') + '">' +
    '<p class="ayuda" id="foto-estado">Cargando…</p>' +
    '<p><strong>' + formatearFecha(foto.fecha) + '</strong>' + (foto.contexto ? ' · ' + esc(foto.contexto) : '') + '</p>' +
    (foto.descripcion ? '<p>' + esc(foto.descripcion) + '</p>' : '') +
    (foto.archivoId ? '' : '<p class="ayuda">⏳ Todavía no se subió: se sube sola cuando haya internet.</p>') +
    '<div class="modal-botones">' +
      (editar ? '<button type="button" class="boton chico peligro" onclick="eliminarFoto(\'' + esc(id) + '\')">Eliminar</button>' : '') +
      '<span class="espacio"></span>' +
      '<button type="button" class="boton chico secundario" onclick="cerrarModal()">Cerrar</button>' +
      (editar ? '<button type="button" class="boton chico" onclick="editarFoto(\'' + esc(id) + '\')">✎ Descripción</button>' : '') +
    '</div></div>');
  const src = await imagenDeFoto(foto);
  const img = document.getElementById('foto-grande');
  const estado = document.getElementById('foto-estado');
  if (!img) return;
  if (src) { img.src = src; estado.remove(); }
  else estado.textContent = 'No se puede mostrar sin internet (se sacó en otro equipo). Probá cuando haya conexión.';
}

async function editarFoto(id) {
  const foto = await Datos.obtener('Fotos', id);
  if (!foto) return;
  await abrirFormulario({
    tabla: 'Fotos',
    titulo: 'Foto',
    registro: foto,
    alEliminar: false,
    campos: [
      { nombre: 'fecha', etiqueta: 'Fecha', tipo: 'fecha', requerido: true },
      { nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'area', ayuda: 'Ej: "Tomates a los 45 días", "Antes de la reparación"' }
    ],
    despuesDeGuardar: function () { verFoto(id); }
  });
}

async function eliminarFoto(id) {
  if (!confirm('¿Eliminar esta foto? (En el Drive queda 30 días en la papelera.)')) return;
  await Datos.eliminar('Fotos', id);
  cerrarModal();
}

/* ---------- Fotos en los informes ---------- */

/** Fotos de un entorno en un período, para el PDF y el informe escrito. */
async function fotosDelPeriodo(entornoNombre, periodo) {
  return (await Datos.listar('Fotos')).filter(function (f) { return f.entorno === entornoNombre && enPeriodo(f.fecha, periodo); })
    .sort(function (a, b) { return String(a.fecha).localeCompare(String(b.fecha)); });
}

/** Grilla de fotos para imprimir (las que se puedan mostrar; hasta 30). */
async function htmlFotosInforme(fotos) {
  const elegidas = fotos.slice(-FOTOS.maximoEnInforme);
  const celdas = [];
  for (const f of elegidas) {
    const src = await imagenDeFoto(f);
    if (!src) continue;
    celdas.push('<figure class="foto-informe"><img src="' + src + '" alt=""><figcaption><b>' + esc(formatearFecha(f.fecha)) + '</b>' +
      (f.contexto ? ' · ' + esc(f.contexto) : '') + (f.descripcion ? '<br>' + esc(f.descripcion) : '') + '</figcaption></figure>');
  }
  if (!celdas.length) return '';
  return '<section class="seccion-informe fotos-informe"><h3>Fotos (' + celdas.length + ')</h3>' +
    (fotos.length > elegidas.length ? '<p class="ayuda">Se muestran las ' + elegidas.length + ' más recientes de ' + fotos.length + '.</p>' : '') +
    (celdas.length < elegidas.length ? '<p class="ayuda">Algunas fotos no se pudieron cargar (falta internet).</p>' : '') +
    '<div class="grilla-fotos-informe">' + celdas.join('') + '</div></section>';
}

/** Para los PDF de los dashboards: si hay fotos del período, pregunta si se incluyen. */
async function fotosParaPdf(entornoNombre, periodo) {
  const fotos = await fotosDelPeriodo(entornoNombre, periodo);
  if (!fotos.length) return '';
  if (!confirm('Hay ' + fotos.length + ' foto' + (fotos.length === 1 ? '' : 's') + ' de ' + entornoNombre + ' en este período. ¿Incluirlas en el PDF?')) return '';
  return htmlFotosInforme(fotos);
}
