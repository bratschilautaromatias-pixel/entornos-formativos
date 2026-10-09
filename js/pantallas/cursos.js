/**
 * CURSOS Y ASISTENCIA
 * Cada curso con su grupo (ej. 3° A), sus estudiantes y los días y horarios de clase.
 * La lista se toma solo los días que hay clase (igual se puede tomar otro día, por ejemplo una recuperación).
 * Direcciones: #/cursos · #/curso/<id> · #/lista/<cursoId>/<fecha>
 */
const ESTADOS_ASISTENCIA = ['Presente', 'Tarde', 'Ausente'];
const LETRA_ASISTENCIA = { 'Presente': 'P', 'Tarde': 'T', 'Ausente': 'A' };
const CURSOS_ANIOS = ['1°', '2°', '3°', '4°', '5°', '6°', '7°'];
const GRUPOS_CURSO = ['A', 'B'];
const DIAS_CLASE = [1, 2, 3, 4, 5]; // lunes a viernes

/* ---------- Ayudas ---------- */

/** "2 08:00 10:00; 5 13:00 15:00" → [{ dia: 2, desde: '08:00', hasta: '10:00' }, …] */
function leerHorarios(texto) {
  return String(texto || '').split(';').map(function (parte) {
    const p = parte.trim().split(/\s+/);
    return p.length === 3 && Number(p[0]) >= 1 && Number(p[0]) <= 6 ? { dia: Number(p[0]), desde: p[1], hasta: p[2] } : null;
  }).filter(Boolean).sort(function (a, b) { return a.dia - b.dia || a.desde.localeCompare(b.desde); });
}

/** "08:00" → "8", "13:30" → "13:30" */
function horaCorta(h) {
  const p = String(h).split(':');
  return Number(p[0]) + (p[1] && p[1] !== '00' ? ':' + p[1] : '');
}

function textoHorario(h) {
  return NOMBRES_DIAS[h.dia] + ' de ' + horaCorta(h.desde) + ' a ' + horaCorta(h.hasta) + ' hs';
}

function textoHorarios(curso) {
  const lista = leerHorarios(curso.horarios);
  return lista.length ? lista.map(textoHorario).join(' · ') : 'Sin horario cargado';
}

/** Horarios del curso para el día de esa fecha (vacío si ese día no tiene clase). */
function horariosDelDia(curso, fecha) {
  const dia = textoAFecha(fecha).getDay();
  return leerHorarios(curso.horarios).filter(function (h) { return h.dia === dia; });
}

function nombreCurso(c) {
  return c ? (c.curso || '') + (c.grupo ? ' ' + c.grupo : '') : '(curso borrado)';
}

function nombreEstudiante(e) {
  return e.apellido + (e.nombre ? ', ' + e.nombre : '');
}

function ordenarCursos(lista) {
  return lista.sort(function (a, b) {
    return CURSOS_ANIOS.indexOf(a.curso) - CURSOS_ANIOS.indexOf(b.curso) || String(a.grupo).localeCompare(String(b.grupo));
  });
}

function ordenarEstudiantes(lista) {
  return lista.sort(function (a, b) {
    return (a.activo === 'false') - (b.activo === 'false') ||
      String(a.apellido).localeCompare(String(b.apellido), 'es') || String(a.nombre).localeCompare(String(b.nombre), 'es');
  });
}

async function cargarCursos() {
  const [cursos, estudiantes, asistencias] = await Promise.all([
    Datos.listar('Cursos'), Datos.listar('Estudiantes'), Datos.listar('Asistencias')
  ]);
  return { cursos: ordenarCursos(cursos), estudiantes: estudiantes, asistencias: asistencias };
}

/** Presentes, tardes y ausentes; el % de asistencia cuenta la tardanza como presente. */
function resumenAsistencia(registros) {
  const r = { Presente: 0, Tarde: 0, Ausente: 0, total: 0 };
  registros.forEach(function (a) {
    if (r[a.estado] !== undefined) { r[a.estado]++; r.total++; }
  });
  r.pct = r.total ? Math.round((r.Presente + r.Tarde) * 100 / r.total) : null;
  return r;
}

function textoResumen(r) {
  return r.Presente + ' presente' + (r.Presente === 1 ? '' : 's') + ' · ' + r.Tarde + ' tarde' + (r.Tarde === 1 ? '' : 's') + ' · ' + r.Ausente + ' ausente' + (r.Ausente === 1 ? '' : 's');
}

/** Fechas en que se tomó lista en el curso, de la más nueva a la más vieja. */
function clasesDelCurso(asistencias, cursoId) {
  return asistencias.filter(function (a) { return a.cursoId === cursoId; })
    .map(function (a) { return a.fecha; })
    .filter(function (f, i, todas) { return todas.indexOf(f) === i; })
    .sort().reverse();
}

/* ---------- Pantalla: todos los cursos ---------- */

PANTALLAS.cursos = function () {
  render(htmlBarra('Cursos y asistencia', 'inicio') + '<main class="contenido" id="pantalla-cursos"><p class="vacio">Cargando…</p></main>');
  alActualizarDatos = dibujarCursos;
  dibujarCursos();
};

async function dibujarCursos() {
  if (!document.getElementById('pantalla-cursos')) return;
  const d = await cargarCursos();
  const lugar = document.getElementById('pantalla-cursos');
  if (!lugar) return;
  const hoy = hoyTexto();
  const editar = puedeEditar();
  const activos = d.cursos.filter(function (c) { return c.activo !== 'false'; });
  const inactivos = d.cursos.filter(function (c) { return c.activo === 'false'; });
  const cantidadEstudiantes = function (c) {
    return d.estudiantes.filter(function (e) { return e.cursoId === c.id && e.activo !== 'false'; }).length;
  };

  let html = '<h1>👨‍🎓 CURSOS Y ASISTENCIA</h1>' +
    '<p class="saludo">Estudiantes, horarios de clase y toma de lista</p>';

  const deHoy = activos.filter(function (c) { return horariosDelDia(c, hoy).length; });
  if (deHoy.length) {
    html += '<section class="clases-hoy"><h2>Hoy, ' + NOMBRES_DIAS[textoAFecha(hoy).getDay()].toLowerCase() + ' ' + diaMes(hoy) + ', tenés clase con</h2>' +
      deHoy.map(function (c) {
        const tomada = d.asistencias.some(function (a) { return a.cursoId === c.id && a.fecha === hoy; });
        return '<div class="tarjeta-clase">' +
          '<div><strong>' + esc(nombreCurso(c)) + '</strong>' +
            '<span class="ayuda">' + horariosDelDia(c, hoy).map(function (h) { return 'de ' + horaCorta(h.desde) + ' a ' + horaCorta(h.hasta) + ' hs'; }).join(' y ') +
            ' · ' + cantidadEstudiantes(c) + ' estudiantes</span></div>' +
          '<button class="boton chico' + (tomada ? ' secundario' : '') + '" onclick="ir(\'lista/' + esc(c.id) + '/' + hoy + '\')">' +
            (tomada ? '✓ Lista tomada' : '📋 Tomar lista') + '</button>' +
        '</div>';
      }).join('') +
    '</section>';
  }

  if (editar) html += '<button class="boton" onclick="formularioCurso()">+ Nuevo curso</button>';

  const tarjeta = function (c) {
    const r = resumenAsistencia(d.asistencias.filter(function (a) { return a.cursoId === c.id; }));
    const clases = clasesDelCurso(d.asistencias, c.id).length;
    return '<button class="tarjeta-curso" onclick="ir(\'curso/' + esc(c.id) + '\')">' +
      '<span class="tarjeta-curso-nombre">' + esc(nombreCurso(c)) + '</span>' +
      '<span class="tarjeta-curso-datos">' +
        '<span>' + cantidadEstudiantes(c) + ' estudiantes · ' + esc(textoHorarios(c)) + '</span>' +
        '<span class="ayuda">' + (clases ? clases + ' clase' + (clases === 1 ? '' : 's') + ' con lista · asistencia ' + r.pct + '%' : 'Todavía no se tomó lista') + '</span>' +
      '</span>' +
    '</button>';
  };

  if (activos.length) html += '<div class="lista-cursos">' + activos.map(tarjeta).join('') + '</div>';
  else if (!inactivos.length) html += '<p class="vacio">Todavía no hay cursos. ' + (editar ? 'Tocá "+ Nuevo curso" para crear el primero.' : '') + '</p>';
  if (inactivos.length) {
    html += '<details class="cursos-inactivos"><summary>Cursos que ya no están activos (' + inactivos.length + ')</summary>' +
      '<div class="lista-cursos">' + inactivos.map(tarjeta).join('') + '</div></details>';
  }
  lugar.innerHTML = html;
}

/* ---------- Pantalla: un curso ---------- */

PANTALLAS.curso = function (id) {
  render(htmlBarra('Curso', 'cursos') + '<main class="contenido" id="pantalla-curso"><p class="vacio">Cargando…</p></main>');
  alActualizarDatos = function () { dibujarCurso(id); };
  dibujarCurso(id);
};

async function dibujarCurso(id) {
  if (!document.getElementById('pantalla-curso')) return;
  const d = await cargarCursos();
  const lugar = document.getElementById('pantalla-curso');
  if (!lugar) return;
  const c = d.cursos.find(function (x) { return x.id === id; });
  if (!c) { lugar.innerHTML = '<p class="vacio">No se encontró el curso.</p>'; return; }
  const editar = puedeEditar();
  const hoy = hoyTexto();
  const estudiantes = ordenarEstudiantes(d.estudiantes.filter(function (e) { return e.cursoId === id; }));
  const activos = estudiantes.filter(function (e) { return e.activo !== 'false'; });
  const asistencias = d.asistencias.filter(function (a) { return a.cursoId === id; });
  const clases = clasesDelCurso(d.asistencias, id);
  const total = resumenAsistencia(asistencias);

  let html = '<h1>' + esc(nombreCurso(c)) + (c.activo === 'false' ? ' <span class="insignia">inactivo</span>' : '') + '</h1>' +
    '<p class="saludo">' + esc(textoHorarios(c)) + '</p>' +
    (c.notas ? '<p class="ayuda centrado">' + esc(c.notas) + '</p>' : '') +
    '<div class="resumen">' +
      '<div><b>' + activos.length + '</b><span>Estudiantes</span></div>' +
      '<div><b>' + clases.length + '</b><span>Clases con lista</span></div>' +
      '<div class="ok"><b>' + (total.pct === null ? '—' : total.pct + '%') + '</b><span>Asistencia</span></div>' +
      '<div class="mal"><b>' + total.Ausente + '</b><span>Ausencias</span></div>' +
    '</div>' +
    '<button class="boton" onclick="ir(\'lista/' + esc(id) + '/' + hoy + '\')">📋 ' + (editar ? 'Tomar lista' : 'Ver lista') +
      (horariosDelDia(c, hoy).length ? ' de hoy' : '') + '</button>' +
    '<div class="acciones-curso">' +
      (editar ? '<button class="boton chico secundario" onclick="formularioCurso(\'' + esc(id) + '\')">✎ Editar curso</button>' : '') +
      (clases.length ? '<button class="boton chico secundario" onclick="imprimirPlanillaAsistencia(\'' + esc(id) + '\')">🖨 Planilla de asistencia</button>' : '') +
    '</div>';

  // Estudiantes
  html += '<section class="bloque-curso"><div class="lista-necesidades-cabecera"><h2 class="grupo-titulo">Estudiantes <span class="contador">' + activos.length + '</span></h2>' +
    (editar ? '<div class="acciones">' +
      '<button class="boton chico secundario" onclick="formularioEstudiante(null, \'' + esc(id) + '\')">+ Estudiante</button>' +
      '<button class="boton chico secundario" onclick="formularioVariosEstudiantes(\'' + esc(id) + '\')">+ Varios</button></div>' : '') +
    '</div>' +
    (estudiantes.length ? estudiantes.map(function (e, i) {
      const r = resumenAsistencia(asistencias.filter(function (a) { return a.estudianteId === e.id; }));
      const baja = e.activo === 'false';
      return '<div class="fila-estudiante' + (baja ? ' baja' : '') + '">' +
        '<span class="numero-estudiante">' + (baja ? '—' : i + 1) + '</span>' +
        '<div class="estudiante-texto"><strong>' + esc(nombreEstudiante(e)) + (baja ? ' <span class="ayuda">(ya no está en el curso)</span>' : '') + '</strong>' +
          '<span class="ayuda">' + (r.total ? textoResumen(r) : 'Sin registros de asistencia') + '</span>' +
          (e.notas ? '<span class="ayuda notas">' + esc(e.notas) + '</span>' : '') + '</div>' +
        '<span class="porcentaje-asistencia' + (r.pct !== null && r.pct < 75 ? ' bajo' : '') + '">' + (r.pct === null ? '—' : r.pct + '%') + '</span>' +
        (editar ? '<button class="boton chico secundario" onclick="formularioEstudiante(\'' + esc(e.id) + '\')" aria-label="Editar">✎</button>' : '') +
      '</div>';
    }).join('') : '<p class="vacio">Todavía no hay estudiantes cargados.</p>') +
    '</section>';

  // Clases en las que se tomó lista
  html += '<section class="bloque-curso"><h2 class="grupo-titulo">Clases con lista <span class="contador">' + clases.length + '</span></h2>' +
    (clases.length ? clases.map(function (f) {
      const r = resumenAsistencia(asistencias.filter(function (a) { return a.fecha === f; }));
      return '<button class="fila-clase" onclick="ir(\'lista/' + esc(id) + '/' + f + '\')">' +
        '<strong>' + NOMBRES_DIAS[textoAFecha(f).getDay()] + ' ' + formatearFecha(f) + '</strong>' +
        '<span class="ayuda">' + textoResumen(r) + '</span></button>';
    }).join('') : '<p class="vacio">Todavía no se tomó lista en este curso.</p>') +
    '</section>';

  lugar.innerHTML = html;
}

/* ---------- Pantalla: tomar lista ---------- */

const tomaLista = { cursoId: '', fecha: '', marcas: {}, guardadas: {}, curso: null, estudiantes: [] };

PANTALLAS.lista = function (parametro) {
  const p = String(parametro || '').split('/');
  tomaLista.cursoId = p[0] || '';
  tomaLista.fecha = /^\d{4}-\d{2}-\d{2}$/.test(p[1] || '') ? p[1] : hoyTexto();
  render(htmlBarra('Tomar lista', 'curso/' + tomaLista.cursoId) + '<main class="contenido" id="pantalla-lista"><p class="vacio">Cargando…</p></main>');
  cargarTomaLista();
};

function idAsistencia(cursoId, fecha, estudianteId) {
  // Siempre el mismo id: si dos equipos toman la misma lista sin internet, no se duplica
  return 'as_' + cursoId + '_' + fecha + '_' + estudianteId;
}

async function cargarTomaLista() {
  const d = await cargarCursos();
  const c = d.cursos.find(function (x) { return x.id === tomaLista.cursoId; });
  const lugar = document.getElementById('pantalla-lista');
  if (!lugar) return;
  if (!c) { lugar.innerHTML = '<p class="vacio">No se encontró el curso.</p>'; return; }
  const deLaFecha = d.asistencias.filter(function (a) { return a.cursoId === c.id && a.fecha === tomaLista.fecha; });
  const conRegistro = deLaFecha.map(function (a) { return a.estudianteId; });
  tomaLista.curso = c;
  // Los que siguen en el curso, y también los que tenían registro ese día aunque después se hayan ido
  tomaLista.estudiantes = ordenarEstudiantes(d.estudiantes.filter(function (e) {
    return e.cursoId === c.id && (e.activo !== 'false' || conRegistro.indexOf(e.id) !== -1);
  }));
  tomaLista.guardadas = {};
  deLaFecha.forEach(function (a) { tomaLista.guardadas[a.estudianteId] = a.estado; });
  tomaLista.marcas = Object.assign({}, tomaLista.guardadas);
  dibujarTomaLista();
}

function dibujarTomaLista() {
  const lugar = document.getElementById('pantalla-lista');
  if (!lugar) return;
  const c = tomaLista.curso;
  const fecha = tomaLista.fecha;
  const editar = puedeEditar();
  const horarios = horariosDelDia(c, fecha);
  const cuenta = { Presente: 0, Tarde: 0, Ausente: 0 };
  tomaLista.estudiantes.forEach(function (e) { const m = tomaLista.marcas[e.id]; if (cuenta[m] !== undefined) cuenta[m]++; });
  const sinMarcar = tomaLista.estudiantes.length - cuenta.Presente - cuenta.Tarde - cuenta.Ausente;
  const yaTomada = Object.keys(tomaLista.guardadas).length > 0;

  let html = '<h1>' + esc(nombreCurso(c)) + '</h1>' +
    '<label class="fecha-lista">Fecha de la clase<input type="date" value="' + esc(fecha) + '" ' +
      'onchange="if (this.value) ir(\'lista/' + esc(c.id) + '/\' + this.value)"></label>' +
    '<p class="ayuda centrado">' + NOMBRES_DIAS[textoAFecha(fecha).getDay()] + ' ' + formatearFecha(fecha) +
      (horarios.length ? ' · clase ' + horarios.map(function (h) { return 'de ' + horaCorta(h.desde) + ' a ' + horaCorta(h.hasta) + ' hs'; }).join(' y ') : '') +
      (yaTomada ? ' · <b>lista ya tomada</b>' : '') + '</p>' +
    (horarios.length ? '' : '<p class="aviso-lista">⚠ Según el horario, este curso no tiene clase este día. Podés tomar lista igual (por ejemplo, una clase de recuperación).</p>') +
    '<div class="resumen">' +
      '<div class="ok"><b>' + cuenta.Presente + '</b><span>Presentes</span></div>' +
      '<div><b>' + cuenta.Tarde + '</b><span>Tarde</span></div>' +
      '<div class="mal"><b>' + cuenta.Ausente + '</b><span>Ausentes</span></div>' +
      '<div><b>' + sinMarcar + '</b><span>Sin marcar</span></div>' +
    '</div>';

  if (!tomaLista.estudiantes.length) {
    html += '<p class="vacio">Este curso no tiene estudiantes cargados. Cargalos desde la pantalla del curso.</p>';
    lugar.innerHTML = html;
    return;
  }

  if (editar && sinMarcar) {
    html += '<button class="boton secundario" onclick="marcarRestantesPresentes()">✓ Marcar presentes a los ' + sinMarcar + ' que faltan</button>';
  }

  html += '<div class="lista-asistencia">' + tomaLista.estudiantes.map(function (e, i) {
    const marca = tomaLista.marcas[e.id] || '';
    return '<div class="fila-asistencia' + (marca ? ' marcada-' + marca.toLowerCase() : '') + '">' +
      '<span class="numero-estudiante">' + (i + 1) + '</span>' +
      '<span class="estudiante-texto"><strong>' + esc(nombreEstudiante(e)) + '</strong></span>' +
      '<span class="marcas">' + ESTADOS_ASISTENCIA.map(function (estado) {
        return '<button type="button" class="marca-asistencia ' + estado.toLowerCase() + (marca === estado ? ' activa' : '') + '"' +
          (editar ? ' onclick="marcarAsistencia(\'' + esc(e.id) + '\', \'' + estado + '\')"' : ' disabled') +
          ' title="' + estado + '" aria-label="' + estado + '">' + LETRA_ASISTENCIA[estado] + '</button>';
      }).join('') + '</span>' +
    '</div>';
  }).join('') + '</div>' +
  '<p class="ayuda centrado">P = presente · T = tarde · A = ausente</p>';

  if (editar) {
    html += '<p class="mensaje" id="mensaje-lista"></p>' +
      '<button class="boton" onclick="guardarTomaLista()">💾 Guardar lista</button>';
  }
  lugar.innerHTML = html;
}

function marcarAsistencia(estudianteId, estado) {
  tomaLista.marcas[estudianteId] = estado;
  dibujarTomaLista();
}

function marcarRestantesPresentes() {
  tomaLista.estudiantes.forEach(function (e) { if (!tomaLista.marcas[e.id]) tomaLista.marcas[e.id] = 'Presente'; });
  dibujarTomaLista();
}

async function guardarTomaLista() {
  const sinMarcar = tomaLista.estudiantes.filter(function (e) { return !tomaLista.marcas[e.id]; }).length;
  if (sinMarcar && !confirm('Quedan ' + sinMarcar + ' estudiante' + (sinMarcar === 1 ? '' : 's') + ' sin marcar. ¿Guardar igual?')) return;
  try {
    for (const e of tomaLista.estudiantes) {
      const estado = tomaLista.marcas[e.id];
      if (!estado || tomaLista.guardadas[e.id] === estado) continue;
      await Datos.guardar('Asistencias', {
        id: idAsistencia(tomaLista.cursoId, tomaLista.fecha, e.id),
        cursoId: tomaLista.cursoId, estudianteId: e.id, fecha: tomaLista.fecha, estado: estado, eliminado: 'false'
      });
    }
  } catch (error) {
    return mostrarMensaje('mensaje-lista', error.message, 'error');
  }
  ir('curso/' + tomaLista.cursoId);
}

/* ---------- Formularios ---------- */

async function formularioCurso(id) {
  if (!puedeEditar()) return;
  const c = id ? await Datos.obtener('Cursos', id) : null;
  const horarios = c ? leerHorarios(c.horarios) : [];
  while (horarios.length < 3) horarios.push({ dia: '', desde: '', hasta: '' });
  const opcionesDia = function (elegido) {
    return '<option value="">—</option>' + DIAS_CLASE.map(function (d) {
      return '<option value="' + d + '"' + (Number(elegido) === d ? ' selected' : '') + '>' + NOMBRES_DIAS[d] + '</option>';
    }).join('');
  };

  abrirModal(
    '<form id="form-curso" novalidate>' +
      '<h2>' + (c ? 'Editar curso' : 'Nuevo curso') + '</h2>' +
      '<div class="dos-columnas">' +
        '<label>Curso<select name="curso">' + opcionesSelect(CURSOS_ANIOS, c ? c.curso : '', 'Elegí…') + '</select></label>' +
        '<label>Grupo<select name="grupo">' + opcionesSelect(GRUPOS_CURSO, c ? c.grupo || '' : '', '—') + '</select></label>' +
      '</div>' +
      '<h3 class="form-seccion">Días y horario de clase</h3>' +
      '<p class="ayuda">Los días que tenés clase con este grupo. Esos días la app te propone tomar lista.</p>' +
      horarios.map(function (h, i) {
        return '<div class="fila-horario">' +
          '<label>Día<select name="dia' + i + '">' + opcionesDia(h.dia) + '</select></label>' +
          '<label>Desde<input type="time" name="desde' + i + '" value="' + esc(h.desde) + '"></label>' +
          '<label>Hasta<input type="time" name="hasta' + i + '" value="' + esc(h.hasta) + '"></label>' +
        '</div>';
      }).join('') +
      (c ? '<label class="casilla"><input type="checkbox" name="activo"' + (c.activo !== 'false' ? ' checked' : '') + '> Curso activo (si lo destildás, queda guardado con su asistencia pero no aparece en la lista)</label>' : '') +
      '<label>Notas<textarea name="notas" rows="2" maxlength="1000">' + esc(c ? c.notas : '') + '</textarea></label>' +
      '<p class="mensaje" id="mensaje-curso"></p>' +
      '<div class="modal-botones">' +
        (c ? '<button type="button" class="boton chico peligro" onclick="eliminarCurso(\'' + esc(c.id) + '\')">Eliminar</button>' : '') +
        '<span class="espacio"></span>' +
        '<button type="button" class="boton chico secundario" onclick="cerrarModal()">Cancelar</button>' +
        '<button type="submit" class="boton chico">Guardar</button>' +
      '</div>' +
    '</form>'
  );

  document.getElementById('form-curso').addEventListener('submit', async function (evento) {
    evento.preventDefault();
    const f = evento.target;
    const elegidos = [];
    for (let i = 0; i < 3; i++) {
      const dia = f['dia' + i].value, desde = f['desde' + i].value, hasta = f['hasta' + i].value;
      if (!dia && !desde && !hasta) continue;
      if (!dia || !desde || !hasta) return mostrarMensaje('mensaje-curso', 'Completá día, hora de inicio y hora de fin en cada horario (o dejalo vacío).', 'error');
      if (hasta <= desde) return mostrarMensaje('mensaje-curso', 'La hora de fin tiene que ser después de la de inicio.', 'error');
      elegidos.push(dia + ' ' + desde + ' ' + hasta);
    }
    const datos = {
      curso: f.curso.value,
      grupo: f.grupo.value,
      horarios: elegidos.join('; '),
      activo: c ? (f.activo.checked ? 'true' : 'false') : 'true',
      notas: f.notas.value.trim()
    };
    if (!datos.curso) return mostrarMensaje('mensaje-curso', 'Elegí el curso.', 'error');
    const repetido = (await Datos.listar('Cursos')).some(function (x) {
      return x.id !== (c && c.id) && x.activo !== 'false' && x.curso === datos.curso && (x.grupo || '') === datos.grupo;
    });
    if (repetido && datos.activo === 'true') return mostrarMensaje('mensaje-curso', 'Ya existe un curso activo ' + nombreCurso(datos) + '.', 'error');
    if (c) datos.id = c.id;
    const guardado = await Datos.guardar('Cursos', datos);
    cerrarModal();
    if (!c) ir('curso/' + guardado.id);
  });
}

async function eliminarCurso(id) {
  const tieneEstudiantes = (await Datos.listar('Estudiantes')).some(function (e) { return e.cursoId === id; });
  if (tieneEstudiantes) {
    return mostrarMensaje('mensaje-curso', 'El curso tiene estudiantes cargados. Si terminó, destildá "Curso activo": así queda guardada su asistencia.', 'error');
  }
  if (!confirm('¿Eliminar este curso?')) return;
  await Datos.eliminar('Cursos', id);
  cerrarModal();
  ir('cursos');
}

async function formularioEstudiante(id, cursoId) {
  const e = id ? await Datos.obtener('Estudiantes', id) : null;
  await abrirFormulario({
    tabla: 'Estudiantes',
    titulo: e ? 'Editar estudiante' : 'Nuevo estudiante',
    registro: e,
    valores: { activo: 'true' },
    campos: [
      { nombre: 'apellido', etiqueta: 'Apellido', tipo: 'texto', requerido: true, medio: true },
      { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true, medio: true },
      { nombre: 'activo', etiqueta: 'Sigue en el curso', tipo: 'sino',
        ayuda: 'Si se cambió de curso o dejó la escuela, destildalo: su asistencia queda guardada pero ya no aparece al tomar lista.' },
      { nombre: 'notas', etiqueta: 'Notas', tipo: 'area' }
    ],
    antesDeGuardar: function (datos) { if (!e) datos.cursoId = cursoId; },
    alEliminar: async function (registro) {
      const tieneAsistencia = (await Datos.listar('Asistencias')).some(function (a) { return a.estudianteId === registro.id; });
      if (tieneAsistencia) return 'Tiene asistencia registrada. Si ya no está en el curso, destildá "Sigue en el curso".';
    },
    preguntaEliminar: '¿Eliminar este estudiante?'
  });
}

/** Carga muchos estudiantes de una vez: uno por renglón, "Apellido, Nombre". */
function formularioVariosEstudiantes(cursoId) {
  if (!puedeEditar()) return;
  abrirModal(
    '<form id="form-varios" novalidate>' +
      '<h2>Cargar varios estudiantes</h2>' +
      '<p class="ayuda">Uno por renglón, con el apellido, una coma y el nombre. Por ejemplo:<br>' +
        '<b>Gómez, Juan Pablo</b><br><b>Di María, Lucía</b><br>' +
        'Si no ponés coma, la primera palabra se toma como apellido. Podés pegar la lista desde una planilla.</p>' +
      '<label>Estudiantes<textarea name="lista" rows="10"></textarea></label>' +
      '<p class="mensaje" id="mensaje-varios"></p>' +
      '<div class="modal-botones"><span class="espacio"></span>' +
        '<button type="button" class="boton chico secundario" onclick="cerrarModal()">Cancelar</button>' +
        '<button type="submit" class="boton chico">Cargar</button>' +
      '</div>' +
    '</form>'
  );
  document.getElementById('form-varios').addEventListener('submit', async function (evento) {
    evento.preventDefault();
    const filas = evento.target.lista.value.split(/\r?\n/).map(function (l) { return l.replace(/\t/g, ', ').trim(); }).filter(Boolean);
    if (!filas.length) return mostrarMensaje('mensaje-varios', 'Escribí o pegá al menos un estudiante.', 'error');
    const nuevos = filas.map(function (linea) {
      const coma = linea.indexOf(',');
      if (coma !== -1) return { apellido: linea.slice(0, coma).trim(), nombre: linea.slice(coma + 1).replace(/^[\s,]+/, '').trim() };
      const espacio = linea.indexOf(' ');
      return espacio === -1 ? { apellido: linea, nombre: '' } : { apellido: linea.slice(0, espacio), nombre: linea.slice(espacio + 1).trim() };
    });
    for (const n of nuevos) {
      await Datos.guardar('Estudiantes', { cursoId: cursoId, apellido: n.apellido, nombre: n.nombre, activo: 'true', notas: '' });
    }
    cerrarModal();
    alert('Se cargaron ' + nuevos.length + ' estudiante' + (nuevos.length === 1 ? '' : 's') + '. Revisá que el apellido y el nombre hayan quedado bien; cualquiera se corrige con ✎.');
  });
}

/* ---------- Planilla para imprimir ---------- */

async function imprimirPlanillaAsistencia(cursoId) {
  const d = await cargarCursos();
  const c = d.cursos.find(function (x) { return x.id === cursoId; });
  if (!c) return;
  const asistencias = d.asistencias.filter(function (a) { return a.cursoId === cursoId; });
  const fechas = clasesDelCurso(d.asistencias, cursoId).reverse(); // de la más vieja a la más nueva
  const estudiantes = ordenarEstudiantes(d.estudiantes.filter(function (e) {
    return e.cursoId === cursoId && (e.activo !== 'false' || asistencias.some(function (a) { return a.estudianteId === e.id; }));
  }));
  const filas = estudiantes.map(function (e) {
    const propias = asistencias.filter(function (a) { return a.estudianteId === e.id; });
    const r = resumenAsistencia(propias);
    return [nombreEstudiante(e)].concat(fechas.map(function (f) {
      const a = propias.find(function (x) { return x.fecha === f; });
      return a ? LETRA_ASISTENCIA[a.estado] || '' : '';
    }), [r.Presente, r.Tarde, r.Ausente, r.pct === null ? '' : r.pct + '%']);
  });
  imprimirInforme('Asistencia · ' + nombreCurso(c), textoHorarios(c) + ' · al ' + formatearFecha(hoyTexto()),
    htmlTablaInforme(estudiantes.length + ' estudiantes · ' + fechas.length + ' clases',
      ['Estudiante'].concat(fechas.map(diaMes), ['P', 'T', 'A', '%']), filas,
      'P = presente · T = tarde · A = ausente. El % de asistencia cuenta la tardanza como presente.'));
}
