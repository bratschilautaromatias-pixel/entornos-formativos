/**
 * TAREAS DE LA SEMANA
 * Igual que la planilla Tareas_Entornos_Formativos: semana de lunes a viernes,
 * estado de cada tarea, mover a la semana siguiente y bloque de atrasadas.
 * La dirección #/tareas/2026-09-29 muestra la semana que empieza ese lunes.
 */
const ICONOS_ENTORNO = { 'Huerta': '🥬', 'Forrajes': '🌾', 'Taller rural': '🔧', 'Maquinaria': '🚜' };
const filtrosTareas = { entorno: '', curso: '' };
const GRUPOS_TAREA = ['A', 'B'];

/** Cursos de 1° a 7°, más los otros valores que tenga la lista (por ejemplo "Todos"). */
function cursosDeTareas(lista) {
  const base = ['1°', '2°', '3°', '4°', '5°', '6°', '7°'];
  return base.concat(lista.filter(function (c) { return base.indexOf(c) === -1; }));
}
let lunesTareas = '';

PANTALLAS.tareas = function (parametro) {
  lunesTareas = /^\d{4}-\d{2}-\d{2}$/.test(parametro) ? lunesDe(parametro) : lunesSemanaActual();
  render(
    htmlBarra('Tareas de la semana', 'inicio') +
    '<main class="contenido" id="pantalla-tareas"><p class="vacio">Cargando tareas…</p></main>'
  );
  alActualizarDatos = dibujarTareas;
  dibujarTareas();
};

async function dibujarTareas() {
  const contenedor = document.getElementById('pantalla-tareas');
  if (!contenedor) return;

  const lunes = lunesTareas;
  const viernes = sumarDias(lunes, 4);
  const actual = lunesSemanaActual();
  const editar = puedeEditar();
  const [todas, entornos, cursos, estados, ultimaSync] = await Promise.all([
    Datos.listar('Tareas'),
    Datos.lista('Entorno'),
    Datos.lista('Curso'),
    Datos.lista('EstadoTarea'),
    BaseLocal.leerMeta('ultimaSincronizacion')
  ]);
  if (!document.getElementById('pantalla-tareas')) return;

  const filtradas = todas.filter(function (t) {
    return (!filtrosTareas.entorno || t.entorno === filtrosTareas.entorno) &&
           (!filtrosTareas.curso || t.curso === filtrosTareas.curso);
  });
  const deLaSemana = filtradas.filter(function (t) { return t.fecha >= lunes && t.fecha <= viernes; });
  const atrasadas = filtradas
    .filter(function (t) { return t.fecha < lunes && t.estado !== 'Realizada'; })
    .sort(function (a, b) { return a.fecha.localeCompare(b.fecha); });
  const hechas = deLaSemana.filter(function (t) { return t.estado === 'Realizada'; }).length;
  const avance = deLaSemana.length ? Math.round(hechas * 100 / deLaSemana.length) : 0;

  const etiquetaSemana = lunes === actual ? 'Esta semana'
    : lunes === sumarDias(actual, 7) ? 'Semana próxima'
    : lunes === sumarDias(actual, -7) ? 'Semana anterior'
    : lunes > actual ? 'Semana futura' : 'Semana pasada';

  let html =
    '<div class="semana-nav">' +
      '<button class="boton chico secundario" onclick="ir(\'tareas/' + sumarDias(lunes, -7) + '\')" aria-label="Semana anterior">←<span class="solo-ancho"> Anterior</span></button>' +
      '<div class="semana-titulo"><strong>Del lunes ' + diaMes(lunes) + ' al viernes ' + diaMes(viernes) + '</strong>' +
        '<span>' + etiquetaSemana + '</span></div>' +
      '<button class="boton chico secundario" onclick="ir(\'tareas/' + sumarDias(lunes, 7) + '\')" aria-label="Semana siguiente"><span class="solo-ancho">Siguiente </span>→</button>' +
    '</div>' +
    (lunes !== actual ? '<p class="centrado"><a href="#/tareas">Volver a esta semana</a></p>' : '') +

    '<div class="filtros">' +
      '<label>Entorno<select onchange="filtrosTareas.entorno = this.value; dibujarTareas()">' +
        opcionesSelect(entornos, filtrosTareas.entorno, 'Todos') + '</select></label>' +
      '<label>Curso<select onchange="filtrosTareas.curso = this.value; dibujarTareas()">' +
        opcionesSelect(cursosDeTareas(cursos), filtrosTareas.curso, 'Cualquiera') + '</select></label>' +
    '</div>' +

    '<div class="resumen">' +
      '<div><b>' + deLaSemana.length + '</b><span>Tareas</span></div>' +
      '<div class="ok"><b>' + hechas + '</b><span>Hechas</span></div>' +
      '<div><b>' + (deLaSemana.length - hechas) + '</b><span>Faltan</span></div>' +
      '<div class="mal"><b>' + atrasadas.length + '</b><span>Atrasadas</span></div>' +
    '</div>' +
    '<div class="avance"><div class="avance-barra" style="width:' + avance + '%"></div></div>' +
    '<p class="centrado ayuda">' + (deLaSemana.length ? 'Avance: ' + avance + '%' : 'Sin tareas cargadas para esta semana') + '</p>' +

    (editar ? '<button class="boton" onclick="formularioTarea()">+ Nueva tarea</button>' : '');

  if (!todas.length && !ultimaSync) {
    html += '<p class="vacio">Descargando datos del servidor… Si no tenés internet, aparecen cuando vuelva la conexión.</p>';
  }

  if (atrasadas.length) {
    html += '<section class="bloque-atrasadas"><h2>⚠ Atrasadas (' + atrasadas.length + ')</h2>' +
      '<p class="ayuda">Quedaron pendientes o incompletas de semanas anteriores.</p>' +
      atrasadas.map(function (t) { return htmlTarea(t, estados, editar, true); }).join('') +
    '</section>';
  }

  for (let i = 0; i < 5; i++) {
    const dia = sumarDias(lunes, i);
    const delDia = deLaSemana.filter(function (t) { return t.fecha === dia; });
    // Agrupadas por entorno (en el orden de la lista de entornos) y, dentro de cada entorno, en el orden elegido
    const grupos = entornosDeTareas(delDia, entornos).map(function (entorno) {
      const tareas = ordenarTareas(delDia.filter(function (t) { return t.entorno === entorno; }));
      return '<div class="grupo-entorno-tareas">' +
        '<h3>' + (ICONOS_ENTORNO[entorno] || '•') + ' ' + esc(entorno) + '</h3>' +
        tareas.map(function (t, j) {
          return htmlTarea(t, estados, editar, false, { primera: j === 0, ultima: j === tareas.length - 1 });
        }).join('') +
      '</div>';
    }).join('');
    html += '<section class="dia' + (dia === hoyTexto() ? ' hoy' : '') + '">' +
      '<h2>' + NOMBRES_DIAS[i + 1] + ' ' + diaMes(dia) + (dia === hoyTexto() ? ' <span class="insignia">Hoy</span>' : '') + '</h2>' +
      (grupos || '<p class="ayuda sin-tareas">Sin tareas</p>') +
    '</section>';
  }

  contenedor.innerHTML = html;
}

/** Entornos que tienen tareas, en el orden de la lista de entornos (los que no estén en la lista, al final). */
function entornosDeTareas(tareas, entornos) {
  const presentes = tareas.map(function (t) { return t.entorno; })
    .filter(function (e, i, a) { return a.indexOf(e) === i; });
  return presentes.sort(function (a, b) {
    const ia = entornos.indexOf(a), ib = entornos.indexOf(b);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib) || a.localeCompare(b);
  });
}

/** Orden elegido con ↑ ↓; las que nunca se ordenaron van al final, por nombre. */
function ordenarTareas(tareas) {
  const posicion = function (t) { return t.orden !== '' && t.orden !== undefined && !isNaN(Number(t.orden)) ? Number(t.orden) : Infinity; };
  return tareas.sort(function (a, b) {
    return (posicion(a) === posicion(b) ? 0 : posicion(a) < posicion(b) ? -1 : 1) || String(a.tarea).localeCompare(String(b.tarea));
  });
}

function htmlTarea(t, estados, editar, esAtrasada, lugar) {
  const id = esc(t.id);
  const estado = t.estado || 'Pendiente';
  const detalles = [
    esAtrasada ? (ICONOS_ENTORNO[t.entorno] || '•') + ' ' + esc(t.entorno) : '',
    t.curso || t.grupo ? esc(t.curso ? t.curso + (t.grupo ? ' ' + t.grupo : '') : 'Grupo ' + t.grupo) : '',
    esAtrasada ? 'era del ' + esc(NOMBRES_DIAS[textoAFecha(t.fecha).getDay()].toLowerCase()) + ' ' + diaMes(t.fecha) : '',
    t.fechaOriginal ? '↪ movida (antes ' + diaMes(t.fechaOriginal) + ')' : ''
  ].filter(Boolean).join(' · ');

  const ordenable = editar && lugar && !(lugar.primera && lugar.ultima);
  return '<div class="tarea estado-' + esc(estado.toLowerCase()) + '">' +
    (ordenable
      ? '<div class="tarea-orden">' +
          '<button class="boton chico secundario" onclick="subirBajarTarea(\'' + id + '\', -1)"' + (lugar.primera ? ' disabled' : '') + ' aria-label="Subir" title="Subir">▲</button>' +
          '<button class="boton chico secundario" onclick="subirBajarTarea(\'' + id + '\', 1)"' + (lugar.ultima ? ' disabled' : '') + ' aria-label="Bajar" title="Bajar">▼</button>' +
        '</div>'
      : '') +
    '<div class="tarea-texto">' +
      '<strong>' + esc(t.tarea) + '</strong>' +
      '<span class="ayuda">' + detalles + '</span>' +
      (t.notas ? '<span class="ayuda notas">' + esc(t.notas) + '</span>' : '') +
    '</div>' +
    '<div class="tarea-acciones">' +
      (editar
        ? '<select class="estado-select" onchange="cambiarEstadoTarea(\'' + id + '\', this.value)" aria-label="Estado">' +
            opcionesSelect(estados, estado) + '</select>' +
          (esAtrasada
            ? '<button class="boton chico secundario" onclick="moverTarea(\'' + id + '\', \'vista\')" title="Pasarla a la semana que estás viendo">→ A esta semana</button>'
            : '<button class="boton chico secundario" onclick="moverTarea(\'' + id + '\', \'dia\')" title="Pasarla al día hábil siguiente">↪ +1 día</button>' +
              '<button class="boton chico secundario" onclick="moverTarea(\'' + id + '\', \'semana\')" title="Pasarla al mismo día de la semana siguiente">↪ +1 semana</button>') +
          '<button class="boton chico secundario" onclick="formularioTarea(\'' + id + '\')" aria-label="Editar">✎</button>'
        : '<span class="estado-chip">' + esc(estado) + '</span>') +
    '</div>' +
  '</div>';
}

async function cambiarEstadoTarea(id, estado) {
  await Datos.guardar('Tareas', { id: id, estado: estado });
}

/**
 * Mueve la tarea: "dia" = al día hábil siguiente (el viernes pasa al lunes), "semana" = al mismo día
 * de la semana siguiente, "vista" = (atrasadas) al mismo día de la semana que se está viendo.
 * En el día nuevo queda al final de su entorno.
 */
async function moverTarea(id, modo) {
  const t = await Datos.obtener('Tareas', id);
  if (!t) return;
  let nuevaFecha;
  if (modo === 'dia') {
    nuevaFecha = sumarDias(t.fecha, 1);
    while (!esDiaHabil(nuevaFecha)) nuevaFecha = sumarDias(nuevaFecha, 1);
  } else if (modo === 'vista') {
    nuevaFecha = sumarDias(lunesTareas, (textoAFecha(t.fecha).getDay() + 6) % 7); // 0 = lunes
  } else {
    nuevaFecha = sumarDias(t.fecha, 7);
  }
  await Datos.guardar('Tareas', {
    id: id,
    fecha: nuevaFecha,
    fechaOriginal: t.fechaOriginal || t.fecha,
    vecesMovida: String(Number(t.vecesMovida || 0) + 1),
    estado: t.estado === 'Incompleta' ? 'Pendiente' : t.estado,
    orden: ''
  });
}

/** Sube (-1) o baja (+1) la tarea dentro de su entorno, en el mismo día. */
async function subirBajarTarea(id, paso) {
  const todas = await Datos.listar('Tareas');
  const t = todas.find(function (x) { return x.id === id; });
  if (!t) return;
  // Se numera todo el grupo (día + entorno) y se intercambia con la vecina que se ve en pantalla
  const grupo = ordenarTareas(todas.filter(function (x) { return x.fecha === t.fecha && x.entorno === t.entorno; }));
  const nuevoOrden = {};
  grupo.forEach(function (x, i) { nuevoOrden[x.id] = String(i + 1); });
  const visibles = grupo.filter(function (x) { return !filtrosTareas.curso || x.curso === filtrosTareas.curso; });
  const vecina = visibles[visibles.indexOf(t) + paso];
  if (!vecina) return;
  nuevoOrden[t.id] = nuevoOrden[vecina.id];
  nuevoOrden[vecina.id] = String(grupo.indexOf(t) + 1);
  for (const x of grupo) {
    if (String(x.orden || '') !== nuevoOrden[x.id]) await Datos.guardar('Tareas', { id: x.id, orden: nuevoOrden[x.id] });
  }
}

async function formularioTarea(id) {
  if (!puedeEditar()) return;
  const t = id ? await Datos.obtener('Tareas', id) : null;
  const [entornos, cursos, estados] = await Promise.all([Datos.lista('Entorno'), Datos.lista('Curso'), Datos.lista('EstadoTarea')]);
  const hoy = hoyTexto();
  const fechaInicial = t ? t.fecha
    : (hoy >= lunesTareas && hoy <= sumarDias(lunesTareas, 4) ? hoy : lunesTareas);

  abrirModal(
    '<form id="form-tarea" novalidate>' +
      '<h2>' + (t ? 'Editar tarea' : 'Nueva tarea') + '</h2>' +
      '<label>Tarea<input name="tarea" maxlength="300" required value="' + esc(t ? t.tarea : '') + '"></label>' +
      '<div class="dos-columnas">' +
        '<label>Fecha<input name="fecha" type="date" required value="' + esc(fechaInicial) + '">' +
          '<span class="ayuda">De lunes a viernes</span></label>' +
        '<label>Estado<select name="estado">' + opcionesSelect(estados, t ? t.estado : 'Pendiente') + '</select></label>' +
      '</div>' +
      '<div class="dos-columnas">' +
        '<label>Entorno<select name="entorno" required>' + opcionesSelect(entornos, t ? t.entorno : (filtrosTareas.entorno || ''), 'Elegí…') + '</select></label>' +
        '<label>Curso<select name="curso">' + opcionesSelect(cursosDeTareas(cursos), t ? t.curso : (filtrosTareas.curso || ''), '—') + '</select></label>' +
      '</div>' +
      '<div class="dos-columnas">' +
        '<span></span>' +
        '<label>Grupo<select name="grupo">' + opcionesSelect(GRUPOS_TAREA, t ? t.grupo || '' : '', '—') + '</select></label>' +
      '</div>' +
      '<label>Notas<textarea name="notas" rows="2" maxlength="1000">' + esc(t ? t.notas : '') + '</textarea></label>' +
      '<p class="mensaje" id="mensaje-tarea"></p>' +
      '<div class="modal-botones">' +
        (t ? '<button type="button" class="boton chico peligro" onclick="eliminarTarea(\'' + esc(t.id) + '\')">Eliminar</button>' : '') +
        '<span class="espacio"></span>' +
        '<button type="button" class="boton chico secundario" onclick="cerrarModal()">Cancelar</button>' +
        '<button type="submit" class="boton chico">Guardar</button>' +
      '</div>' +
    '</form>'
  );

  document.getElementById('form-tarea').addEventListener('submit', async function (evento) {
    evento.preventDefault();
    const f = evento.target;
    const datos = {
      tarea: f.tarea.value.trim(),
      fecha: f.fecha.value,
      estado: f.estado.value,
      entorno: f.entorno.value,
      curso: f.curso.value,
      grupo: f.grupo.value,
      notas: f.notas.value.trim()
    };
    if (!datos.tarea) return mostrarMensaje('mensaje-tarea', 'Escribí qué hay que hacer.', 'error');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datos.fecha)) return mostrarMensaje('mensaje-tarea', 'Elegí una fecha.', 'error');
    if (!esDiaHabil(datos.fecha)) return mostrarMensaje('mensaje-tarea', 'La fecha tiene que ser de lunes a viernes.', 'error');
    if (!datos.entorno) return mostrarMensaje('mensaje-tarea', 'Elegí el entorno.', 'error');

    if (t) {
      datos.id = t.id;
      // Si se cambió la fecha a mano, deja de figurar como "movida"
      if (datos.fecha !== t.fecha) { datos.fechaOriginal = ''; datos.vecesMovida = '0'; }
      // En otro día o en otro entorno pasa al final de ese grupo
      if (datos.fecha !== t.fecha || datos.entorno !== t.entorno) datos.orden = '';
    } else {
      datos.fechaOriginal = '';
      datos.vecesMovida = '0';
    }
    await Datos.guardar('Tareas', datos);
    cerrarModal();
    // Si la tarea quedó en otra semana, se muestra esa semana
    if (datos.fecha < lunesTareas || datos.fecha > sumarDias(lunesTareas, 4)) ir('tareas/' + lunesDe(datos.fecha));
  });
}

async function eliminarTarea(id) {
  if (!confirm('¿Eliminar esta tarea?')) return;
  await Datos.eliminar('Tareas', id);
  cerrarModal();
}
