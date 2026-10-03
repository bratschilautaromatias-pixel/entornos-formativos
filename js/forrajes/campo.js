/**
 * FORRAJES · PRODUCCIÓN: menú, siembras, cosechas, crecimiento, lluvias, lotes y especies.
 * Direcciones: #/forrajes · #/forrajes/<sección>[/<id>]
 */
const SECCIONES_FORRAJES = [
  { clave: 'siembras', nombre: 'Siembras', icono: '🌾', detalle: 'Qué hay sembrado en cada lote y cuadro (mezclas de especies)' },
  { clave: 'lluvias', nombre: 'Lluvias', icono: '🌧', detalle: 'Pluviómetro: una lectura para varios lotes a la vez' },
  { clave: 'crecimiento', nombre: 'Crecimiento', icono: '📏', detalle: 'Muestreos de materia verde' },
  { clave: 'henificacion', nombre: 'Henificación', icono: '🌀', detalle: 'Corte, volteos y enrollado' },
  { clave: 'cosechas', nombre: 'Cosechas', icono: '🚜', detalle: 'Rollos, fardos, silo y su ingreso al stock' },
  { clave: 'inventario', nombre: 'Reservas (stock)', icono: '🏚', detalle: 'Ubicaciones, stock, movimientos y análisis' },
  { clave: 'raciones', nombre: 'Raciones', icono: '🐄', detalle: 'Dieta por categoría animal y consumo' },
  { clave: 'lotes', nombre: 'Lotes y cuadros', icono: '🗺', detalle: 'Superficies y ubicación' },
  { clave: 'especies', nombre: 'Especies', icono: '📖', detalle: 'Catálogo con valor nutritivo' },
  { clave: 'categorias', nombre: 'Categorías animales', icono: '🐑', detalle: 'Requerimientos nutricionales' }
];

PANTALLAS.forrajes = function (parametro) {
  const partes = String(parametro || '').split('/');
  const pantallas = {
    siembras: pantallaSiembrasForraje, siembra: pantallaFichaSiembraForraje, lluvias: pantallaLluvias,
    crecimiento: pantallaCrecimiento, cosechas: pantallaCosechasForraje, henificacion: pantallaHenificacion, inventario: pantallaInventario,
    raciones: pantallaRaciones, racion: pantallaFichaRacion, lotes: pantallaLotes, especies: pantallaEspecies,
    categorias: pantallaCategorias
  };
  if (pantallas[partes[0]]) return pantallas[partes[0]](partes[1]);
  pantallaMenuForrajes();
};

const produccionSinForrajes = PANTALLAS.produccion;
PANTALLAS.produccion = function (clave) {
  if (clave === 'forrajes') return ir('forrajes');
  return produccionSinForrajes(clave);
};

function marcoForrajes(titulo, volverA, dibujar) {
  render(htmlBarra(titulo, volverA) + '<main class="contenido" id="contenido-forrajes"><p class="vacio">Cargando…</p></main>');
  const redibujar = async function () {
    if (!document.getElementById('contenido-forrajes')) return;
    const f = await cargarForrajes();
    const lugar = document.getElementById('contenido-forrajes');
    if (!lugar) return;
    lugar.innerHTML = await dibujar(f);
  };
  alActualizarDatos = redibujar;
  redibujar();
}

function botonEditar(funcion, id) {
  return puedeEditar() ? '<button class="boton chico secundario" onclick="' + funcion + '(\'' + esc(id) + '\')" aria-label="Editar">✎</button>' : '';
}

function opcionesLotes(f, soloActivos) {
  return f.lotes.filter(function (l) { return !soloActivos || l.activo !== 'false'; }).map(function (l) { return { valor: l.id, texto: l.nombre }; });
}

function opcionesCuadros(f) {
  return function (v) {
    return f.cuadros.filter(function (c) { return c.loteId === v.loteId; }).map(function (c) { return { valor: c.id, texto: etiquetaCuadro(c) }; });
  };
}

/* ---------- Menú ---------- */

function pantallaMenuForrajes() {
  marcoForrajes('Producción · Forrajes', 'entorno/forrajes', function (f) {
    const enCrecimiento = f.siembrasForraje.filter(function (s) { return s.estado === 'En crecimiento'; }).length;
    const lotesActivos = f.lotes.filter(function (l) { return l.activo !== 'false'; }).length;
    const racionesActivas = f.raciones.filter(function (r) { return r.activa !== 'false'; }).length;
    const alertas = proyeccionStock(f).filter(function (p) { return p.dias !== null && p.dias <= FORRAJES.diasAlertaStock; });
    const anio = String(new Date().getFullYear());
    const lluviaAnio = (function () {
      // lluvia del año: se toma la lectura más alta de cada día (todos los lotes reciben la misma lluvia)
      const porDia = {};
      f.lluviasManuales.filter(function (r) { return r.fecha.slice(0, 4) === anio; }).forEach(function (r) {
        porDia[r.fecha] = Math.max(porDia[r.fecha] || 0, Number(r.cantidadMm) || 0);
      });
      return Object.keys(porDia).reduce(function (t, d) { return t + porDia[d]; }, 0);
    })();

    return '<h1>🌾 PRODUCCIÓN · FORRAJES</h1>' +
      '<div class="resumen">' +
        '<div><b>' + lotesActivos + '</b><span>Lotes activos</span></div>' +
        '<div class="ok"><b>' + enCrecimiento + '</b><span>Siembras en crecimiento</span></div>' +
        '<div><b>' + racionesActivas + '</b><span>Raciones activas</span></div>' +
        '<div><b>' + numero(lluviaAnio) + '</b><span>mm de lluvia ' + anio + '</span></div>' +
      '</div>' +
      (alertas.length
        ? '<div class="aviso error"><b>⚠ Stock por agotarse (' + FORRAJES.diasAlertaStock + ' días o menos):</b><br>' +
            alertas.map(function (a) { return esc(a.nombre) + ': ' + numero(a.stockKg) + ' kg, alcanza ' + Math.floor(a.dias) + ' días'; }).join('<br>') + '</div>'
        : '') +
      '<div class="grilla grilla-secciones">' +
        SECCIONES_FORRAJES.map(function (s) {
          return '<button class="cuadro" onclick="ir(\'forrajes/' + s.clave + '\')"><span class="icono">' + s.icono + '</span>' +
            '<span class="nombre">' + esc(s.nombre) + '</span><span class="detalle">' + esc(s.detalle) + '</span></button>';
        }).join('') +
      '</div>';
  });
}

/* ---------- Siembras ---------- */

const filtroSiembrasForraje = { estado: 'En crecimiento', lote: '' };

function pantallaSiembrasForraje() {
  marcoForrajes('Siembras · Forrajes', 'forrajes', function (f) {
    const lista = f.siembrasForraje.filter(function (s) {
      return (!filtroSiembrasForraje.estado || s.estado === filtroSiembrasForraje.estado) &&
        (!filtroSiembrasForraje.lote || s.loteId === filtroSiembrasForraje.lote);
    }).sort(function (a, b) { return lugarTexto(f, a.loteId, a.cuadroId).localeCompare(lugarTexto(f, b.loteId, b.cuadroId), 'es', { numeric: true }); });

    return '<div class="filtros">' +
        '<label>Estado<select onchange="filtroSiembrasForraje.estado = this.value; alActualizarDatos()">' +
          '<option value="">Todas</option>' + opcionesSelect(FORRAJES.estadosSiembra, filtroSiembrasForraje.estado) + '</select></label>' +
        '<label>Lote<select onchange="filtroSiembrasForraje.lote = this.value; alActualizarDatos()">' +
          '<option value="">Todos</option>' + f.lotes.map(function (l) { return '<option value="' + esc(l.id) + '"' + (filtroSiembrasForraje.lote === l.id ? ' selected' : '') + '>' + esc(l.nombre) + '</option>'; }).join('') +
        '</select></label>' +
      '</div>' +
      (puedeEditar() ? '<button class="boton" onclick="formularioSiembraForraje()">+ Nueva siembra</button>' : '') +
      (lista.length ? lista.map(function (s) {
        const dias = diasEntre(s.fechaSiembra, hoyTexto());
        const lluvia = lluviaEntre(f, s.loteId, s.cuadroId, s.fechaSiembra, null);
        return '<div class="tarjeta-siembra estado-' + (s.estado === 'En crecimiento' ? 'en-curso' : s.estado === 'Perdida' ? 'perdida' : 'cosechada') + '">' +
          '<button class="tarjeta-siembra-texto" onclick="ir(\'forrajes/siembra/' + esc(s.id) + '\')">' +
            '<strong>' + esc(lugarTexto(f, s.loteId, s.cuadroId)) + '</strong>' +
            '<span class="ayuda">' + esc(resumenEspecies(f, s.id)) + '</span>' +
            '<span class="ayuda">Sembrado ' + formatearFecha(s.fechaSiembra) + ' · ' + dias + ' días · ' + esc(s.usoPrevisto) + ' · ' + esc(s.estado) +
              ' · ' + numero(lluvia) + ' mm de lluvia desde la siembra</span>' +
          '</button>' +
        '</div>';
      }).join('') : '<p class="vacio">No hay siembras para mostrar.</p>');
  });
}

function pantallaFichaSiembraForraje(id) {
  marcoForrajes('Siembra · Forrajes', 'forrajes/siembras', function (f) {
    const s = f.siembrasForrajePorId[id];
    if (!s) return '<p class="vacio">No se encontró la siembra.</p>';
    const especies = especiesDeSiembra(f, id);
    const cosechas = f.cosechasForraje.filter(function (c) { return c.siembraId === id; }).sort(porFechaDesc);
    const muestreos = f.muestreosCrecimiento.filter(function (m) {
      return m.loteId === s.loteId && (!s.cuadroId || !m.cuadroId || m.cuadroId === s.cuadroId) && m.fecha >= s.fechaSiembra;
    }).sort(porFechaDesc);
    const kg = cosechas.reduce(function (t, c) { return t + (Number(c.cantidadTotalKg) || 0); }, 0);
    const semilla = especies.reduce(function (t, e) { return t + (Number(e.cantidadSemillaKg) || 0); }, 0);
    return '<h1>' + esc(lugarTexto(f, s.loteId, s.cuadroId)) + '</h1>' +
      '<p class="saludo">' + esc(resumenEspecies(f, id)) + '</p>' +
      '<div class="resumen resumen-3">' +
        '<div><b>' + diasEntre(s.fechaSiembra, hoyTexto()) + '</b><span>Días desde la siembra</span></div>' +
        '<div><b>' + numero(lluviaEntre(f, s.loteId, s.cuadroId, s.fechaSiembra, null)) + '</b><span>mm de lluvia</span></div>' +
        '<div><b>' + numero(semilla) + '</b><span>Kg de semilla</span></div>' +
        '<div class="ok"><b>' + numero(kg) + '</b><span>Kg cosechados</span></div>' +
        '<div><b>' + cosechas.length + '</b><span>Cosechas</span></div>' +
        '<div><b>' + muestreos.length + '</b><span>Muestreos</span></div>' +
      '</div>' +
      (puedeEditar() ? '<div class="botones-alta">' +
        '<button class="boton chico" onclick="formularioCorte(null, \'' + esc(id) + '\')">✂ Corte</button>' +
        '<button class="boton chico" onclick="formularioCosechaForraje(null, \'' + esc(id) + '\')">🚜 Cosecha</button>' +
        '<button class="boton chico" onclick="formularioMuestreo(null, \'' + esc(s.loteId) + '\', \'' + esc(s.cuadroId) + '\')">📏 Muestreo</button>' +
        '<button class="boton chico secundario" onclick="formularioSiembraForraje(\'' + esc(id) + '\')">✎ Editar</button></div>' : '') +
      '<div class="tarjeta-info">' + dato('Fecha de siembra', formatearFecha(s.fechaSiembra)) + dato('Uso previsto', s.usoPrevisto) +
        dato('Estado', s.estado) + dato('Observaciones', s.observaciones) + '</div>' +
      '<h2 class="grupo-titulo">🌱 Especies de la mezcla <span class="contador">' + especies.length + '</span></h2>' +
      (especies.length ? especies.map(function (se) {
        return '<div class="fila-historial"><div><strong>' + esc(nombreEspecie(f, se.especieId)) + '</strong>' +
          '<br><span class="ayuda">' + [se.densidadSiembra ? 'Densidad ' + numero(se.densidadSiembra) : '', se.cantidadSemillaKg ? numero(se.cantidadSemillaKg) + ' kg de semilla' : '']
            .filter(Boolean).join(' · ') + '</span></div>' + botonEditar('formularioEspecieSiembra', se.id) + '</div>';
      }).join('') : '<p class="ayuda">Sin especies cargadas.</p>') +
      (puedeEditar() ? '<button class="boton chico secundario" onclick="formularioEspecieSiembra(null, \'' + esc(id) + '\')">+ Agregar especie</button>' : '') +
      htmlHistorial('🚜 Cosechas', cosechas, function (c) {
        return '<strong>' + numero(c.cantidadTotalKg) + ' kg</strong> · ' + esc(c.tipoAprovechamiento) + ' · ' + formatearFecha(c.fecha) +
          (c.cantidadRollos ? ' · ' + numero(c.cantidadRollos) + ' rollos' : '') + (c.ingresadaAInventario === 'true' ? ' · en stock' : '');
      }, 'formularioCosechaForraje') +
      htmlHistorial('📏 Muestreos de crecimiento', muestreos, function (m) {
        return '<strong>' + numero(m.materiaVerdeTotalKg) + ' kg de materia verde</strong> · ' + formatearFecha(m.fecha) +
          (m.notas ? '<br><span class="ayuda">' + esc(m.notas) + '</span>' : '');
      }, 'formularioMuestreo');
  });
}

async function formularioSiembraForraje(id) {
  const f = await cargarForrajes();
  const s = id ? f.siembrasForrajePorId[id] : null;
  const campos = [
    { nombre: 'loteId', etiqueta: 'Lote', tipo: 'select', requerido: true, vacio: 'Elegí…', medio: true, opciones: opcionesLotes(f, true) },
    { nombre: 'cuadroId', etiqueta: 'Cuadro', tipo: 'select', vacio: 'Todo el lote', medio: true, recalcularCon: ['loteId'], opciones: opcionesCuadros(f) },
    { nombre: 'fechaSiembra', etiqueta: 'Fecha de siembra', tipo: 'fecha', requerido: true, medio: true },
    { nombre: 'usoPrevisto', etiqueta: 'Uso previsto', tipo: 'select', opciones: FORRAJES.usosPrevistos, requerido: true, medio: true },
    { nombre: 'estado', etiqueta: 'Estado', tipo: 'select', opciones: FORRAJES.estadosSiembra, requerido: true },
    { nombre: 'observaciones', etiqueta: 'Observaciones', tipo: 'area' }
  ];
  if (!s) {
    campos.splice(5, 0, { nombre: 'especies', etiqueta: 'Especies de la mezcla', tipo: 'casillas', requerido: true,
      opciones: f.especiesForraje.filter(function (e) { return e.activo !== 'false'; }).map(function (e) { return { valor: e.id, texto: e.nombre }; }),
      ayuda: 'Después podés cargar la densidad y los kg de semilla de cada una.' });
  }
  await abrirFormulario({
    tabla: 'SiembrasForraje',
    titulo: s ? 'Editar siembra' : 'Nueva siembra',
    registro: s,
    valores: { fechaSiembra: hoyTexto(), usoPrevisto: 'Heno', estado: 'En crecimiento', loteId: filtroSiembrasForraje.lote },
    campos: campos,
    validar: function (d) {
      const lote = f.cuadros.some(function (c) { return c.loteId === d.loteId; });
      return lote && !d.cuadroId ? 'Este lote está dividido en cuadros: elegí en cuál se sembró.' : null;
    },
    preguntaEliminar: '¿Eliminar esta siembra?',
    guardar: async function (d, anterior) {
      const especies = (d.especies || '').split(',').filter(Boolean);
      delete d.especies;
      if (anterior) d.id = anterior.id;
      const guardada = await Datos.guardar('SiembrasForraje', d);
      for (const especieId of especies) {
        await Datos.guardar('SiembraEspecies', { siembraId: guardada.id, especieId: especieId, densidadSiembra: '', cantidadSemillaKg: '' });
      }
      return guardada;
    },
    despuesDeGuardar: function (g, anterior) { if (!anterior) ir('forrajes/siembra/' + g.id); }
  });
}

async function formularioEspecieSiembra(id, siembraId) {
  const f = await cargarForrajes();
  const se = id ? f.siembraEspeciesPorId[id] : null;
  await abrirFormulario({
    tabla: 'SiembraEspecies',
    titulo: se ? 'Editar especie de la mezcla' : 'Agregar especie a la mezcla',
    registro: se,
    valores: { siembraId: siembraId },
    campos: [
      { nombre: 'especieId', etiqueta: 'Especie', tipo: 'select', requerido: true, vacio: 'Elegí…',
        opciones: f.especiesForraje.map(function (e) { return { valor: e.id, texto: e.nombre }; }) },
      { nombre: 'densidadSiembra', etiqueta: 'Densidad de siembra', tipo: 'numero', minimo: 0, medio: true },
      { nombre: 'cantidadSemillaKg', etiqueta: 'Kg de semilla', tipo: 'numero', minimo: 0, medio: true }
    ],
    antesDeGuardar: function (d) { d.siembraId = se ? se.siembraId : siembraId; },
    preguntaEliminar: '¿Quitar esta especie de la mezcla?'
  });
}

/* ---------- Cosechas ---------- */

function pantallaCosechasForraje() {
  marcoForrajes('Cosechas · Forrajes', 'forrajes', function (f) {
    const lista = f.cosechasForraje.slice().sort(porFechaDesc);
    const total = lista.reduce(function (t, c) { return t + (Number(c.cantidadTotalKg) || 0); }, 0);
    return '<div class="totales"><div class="ok"><span>Total cosechado</span><b>' + numero(total) + ' kg</b><small>' + lista.length + ' cosechas</small></div></div>' +
      (puedeEditar() ? '<button class="boton" onclick="formularioCosechaForraje()">🚜 Registrar cosecha</button>' : '') +
      (lista.length ? lista.map(function (c) {
        const s = f.siembrasForrajePorId[c.siembraId];
        const sinStock = c.tipoAprovechamiento !== 'Pastoreo directo' && c.ingresadaAInventario !== 'true';
        return '<div class="movimiento mov-ingresos">' +
          '<div class="movimiento-texto"><strong>' + esc(c.especieId ? nombreEspecie(f, c.especieId) : 'Sin especie') + ' · ' + esc(c.tipoAprovechamiento) + '</strong>' +
            '<span class="ayuda">' + formatearFecha(c.fecha) + (s ? ' · ' + esc(lugarTexto(f, s.loteId, s.cuadroId)) : '') +
              (c.cantidadRollos ? ' · ' + numero(c.cantidadRollos) + ' rollos de ' + numero(c.pesoPromedioRolloKg) + ' kg' : '') +
              (c.humedadPct ? ' · ' + numero(c.humedadPct) + '% humedad' : '') + '</span>' +
            '<span class="ayuda">' + (c.tipoAprovechamiento === 'Pastoreo directo' ? 'Pastoreo: no genera stock'
              : c.ingresadaAInventario === 'true' ? '✓ Ingresada al stock' : '⚠ Todavía no ingresó al stock') + '</span>' +
          '</div>' +
          '<div class="movimiento-valor">' + numero(c.cantidadTotalKg) + ' kg</div>' +
          '<div class="movimiento-acciones">' +
            (sinStock && puedeEditar() ? '<button class="boton chico" onclick="ingresarCosechaAlStock(\'' + esc(c.id) + '\')">Ingresar al stock</button>' : '') +
            botonEditar('formularioCosechaForraje', c.id) +
          '</div></div>';
      }).join('') : '<p class="vacio">Todavía no hay cosechas.</p>');
  });
}

async function formularioCosechaForraje(id, siembraId) {
  const f = await cargarForrajes();
  const c = id ? f.cosechasForrajePorId[id] : null;
  const siembraInicial = c ? c.siembraId : siembraId;
  const especiesUnicas = siembraInicial ? especiesDeSiembra(f, siembraInicial) : [];
  await abrirFormulario({
    tabla: 'CosechasForraje',
    titulo: c ? 'Editar cosecha' : 'Registrar cosecha',
    registro: c,
    valores: { fecha: hoyTexto(), siembraId: siembraId || '', tipoAprovechamiento: 'Corte para heno', ingresadaAInventario: 'false',
      especieId: especiesUnicas.length === 1 ? especiesUnicas[0].especieId : '' },
    ayuda: 'Si cargás cantidad de rollos y peso promedio, el total se calcula solo.',
    campos: [
      { nombre: 'siembraId', etiqueta: 'Siembra', tipo: 'select', vacio: 'Sin siembra (ej. campo natural)',
        opciones: f.siembrasForraje.filter(function (s) { return s.estado === 'En crecimiento' || s.id === siembraInicial; })
          .map(function (s) { return { valor: s.id, texto: descripcionSiembraForraje(f, s) }; }) },
      { nombre: 'especieId', etiqueta: 'Especie cosechada (para el stock)', tipo: 'select', vacio: '—',
        opciones: f.especiesForraje.map(function (e) { return { valor: e.id, texto: e.nombre }; }) },
      { nombre: 'fecha', etiqueta: 'Fecha', tipo: 'fecha', requerido: true, medio: true },
      { nombre: 'tipoAprovechamiento', etiqueta: 'Aprovechamiento', tipo: 'select', opciones: FORRAJES.aprovechamientos, requerido: true, medio: true },
      { nombre: 'cantidadRollos', etiqueta: 'Cantidad de rollos/fardos', tipo: 'entero', minimo: 0, medio: true },
      { nombre: 'pesoPromedioRolloKg', etiqueta: 'Peso promedio (kg)', tipo: 'numero', minimo: 0, medio: true },
      { nombre: 'cantidadTotalKg', etiqueta: 'Cantidad total (kg)', tipo: 'numero', minimo: 0, medio: true },
      { nombre: 'humedadPct', etiqueta: 'Humedad %', tipo: 'numero', minimo: 0, medio: true },
      { nombre: 'rendimientoKgMsHa', etiqueta: 'Rendimiento (kg MS/ha)', tipo: 'numero', minimo: 0 },
      { nombre: 'calidadObservaciones', etiqueta: 'Calidad / observaciones', tipo: 'area' }
    ],
    antesDeGuardar: function (d) {
      if (!d.cantidadTotalKg && Number(d.cantidadRollos) && Number(d.pesoPromedioRolloKg)) {
        d.cantidadTotalKg = String(Number(d.cantidadRollos) * Number(d.pesoPromedioRolloKg));
      }
    },
    validar: function (d) {
      const calculado = Number(d.cantidadRollos) * Number(d.pesoPromedioRolloKg);
      if (!d.cantidadTotalKg && !calculado) return 'Cargá la cantidad total en kg (o rollos y peso promedio).';
      return null;
    },
    preguntaEliminar: '¿Eliminar esta cosecha?'
  });
}

/** Igual que "Generar stock" de Forrajes: crea un lote de inventario con lo cosechado. */
async function ingresarCosechaAlStock(id) {
  const f = await cargarForrajes();
  const c = f.cosechasForrajePorId[id];
  if (!c) return;
  if (!c.especieId) return alert('Esta cosecha no tiene especie asignada. Editala y elegí qué especie se cosechó antes de ingresarla al stock.');
  const ubicaciones = f.ubicacionesAlmacenamiento.filter(function (u) { return u.activo !== 'false'; });
  if (!ubicaciones.length) return alert('Todavía no hay ubicaciones de almacenamiento. Creá una (ej. "Galpón") en Reservas → Ubicaciones.');
  await abrirFormulario({
    tabla: 'LotesInventario',
    titulo: 'Ingresar cosecha al stock',
    ayuda: numero(c.cantidadTotalKg) + ' kg de ' + nombreEspecie(f, c.especieId) + (c.cantidadRollos ? ' (' + c.cantidadRollos + ' rollos)' : '') + ' del ' + formatearFecha(c.fecha) + '.',
    valores: {},
    campos: [
      { nombre: 'ubicacionId', etiqueta: 'Dónde se guarda', tipo: 'select', requerido: true, vacio: 'Elegí…',
        opciones: ubicaciones.map(function (u) { return { valor: u.id, texto: u.nombre + ' (' + u.tipoAlmacenamiento + ')' }; }) },
      { nombre: 'identificador', etiqueta: 'Identificador del lote', tipo: 'texto', ayuda: 'Ej: "Rollos avena sept 2026"' },
      { nombre: 'fechaLimiteCalidad', etiqueta: 'Usar antes de', tipo: 'fecha' }
    ],
    guardar: async function (d) {
      const lote = await Datos.guardar('LotesInventario', {
        especieId: c.especieId, ubicacionId: d.ubicacionId, fechaIngreso: c.fecha, kgIngreso: c.cantidadTotalKg,
        unidadesIngreso: c.cantidadRollos || '', pesoPromedioUnidadKg: c.pesoPromedioRolloKg || '', origen: 'Producción propia',
        cosechaId: c.id, costoPorKg: '', fechaLimiteCalidad: d.fechaLimiteCalidad, identificador: d.identificador
      });
      await Datos.guardar('CosechasForraje', { id: c.id, ingresadaAInventario: 'true' });
      return lote;
    }
  });
}

/* ---------- Crecimiento (muestreos) ---------- */

function pantallaCrecimiento() {
  marcoForrajes('Crecimiento · Forrajes', 'forrajes', function (f) {
    const lista = f.muestreosCrecimiento.slice().sort(porFechaDesc);
    return (puedeEditar() ? '<button class="boton" onclick="formularioMuestreo()">📏 Registrar muestreo</button>' : '') +
      '<p class="ayuda">Cortá la pastura en un marco conocido (por ejemplo 1 m²), pesala y cargá el peso y la superficie: la app calcula la materia verde total del lote o cuadro.</p>' +
      (lista.length ? '<div class="tabla-desplazable"><table class="tabla"><thead><tr><th>Fecha</th><th>Lote / cuadro</th><th>Muestra</th><th>Materia verde total</th><th></th></tr></thead><tbody>' +
        lista.map(function (m) {
          return '<tr><td>' + formatearFecha(m.fecha) + '</td><td>' + esc(lugarTexto(f, m.loteId, m.cuadroId)) + '</td>' +
            '<td>' + (m.pesoMuestraKg ? numero(m.pesoMuestraKg) + ' kg / ' + numero(m.superficieMuestraM2) + ' m²' : '—') + '</td>' +
            '<td><b>' + numero(m.materiaVerdeTotalKg) + ' kg</b></td><td>' + botonEditar('formularioMuestreo', m.id) + '</td></tr>' +
            (m.notas ? '<tr><td></td><td colspan="4" class="ayuda" style="text-align:left">' + esc(m.notas) + '</td></tr>' : '');
        }).join('') + '</tbody></table></div>' : '<p class="vacio">Todavía no hay muestreos.</p>');
  });
}

async function formularioMuestreo(id, loteId, cuadroId) {
  const f = await cargarForrajes();
  const m = id ? f.muestreosCrecimientoPorId[id] : null;
  await abrirFormulario({
    tabla: 'MuestreosCrecimiento',
    titulo: m ? 'Editar muestreo' : 'Registrar muestreo de crecimiento',
    registro: m,
    valores: { fecha: hoyTexto(), loteId: loteId || '', cuadroId: cuadroId || '' },
    ayuda: 'Si cargás el peso y la superficie de la muestra, la materia verde total se calcula sola para todo el lote o cuadro.',
    campos: [
      { nombre: 'loteId', etiqueta: 'Lote', tipo: 'select', requerido: true, vacio: 'Elegí…', medio: true, opciones: opcionesLotes(f, true) },
      { nombre: 'cuadroId', etiqueta: 'Cuadro', tipo: 'select', vacio: 'Todo el lote', medio: true, recalcularCon: ['loteId'], opciones: opcionesCuadros(f) },
      { nombre: 'fecha', etiqueta: 'Fecha', tipo: 'fecha', requerido: true },
      { nombre: 'pesoMuestraKg', etiqueta: 'Peso de la muestra (kg)', tipo: 'numero', minimo: 0, medio: true },
      { nombre: 'superficieMuestraM2', etiqueta: 'Superficie de la muestra (m²)', tipo: 'numero', minimo: 0, medio: true },
      { nombre: 'materiaVerdeTotalKg', etiqueta: 'Materia verde total (kg)', tipo: 'numero', minimo: 0, ayuda: 'Dejalo vacío para que se calcule' },
      { nombre: 'notas', etiqueta: 'Notas', tipo: 'area', ayuda: 'Ej: "990 g de MS"' }
    ],
    validar: function (d) {
      if (f.cuadros.some(function (c) { return c.loteId === d.loteId; }) && !d.cuadroId) return 'Este lote está dividido en cuadros: elegí en cuál se hizo el muestreo.';
      // Igual que Forrajes: total = superficie del lote o cuadro ÷ superficie de la muestra × peso
      const superficie = superficieReferenciaM2(f, d.loteId, d.cuadroId);
      if (!d.materiaVerdeTotalKg && Number(d.pesoMuestraKg) > 0 && Number(d.superficieMuestraM2) > 0 && superficie) {
        d.materiaVerdeTotalKg = String(Math.round(superficie / Number(d.superficieMuestraM2) * Number(d.pesoMuestraKg) * 100) / 100);
      }
      if (!(Number(d.materiaVerdeTotalKg) > 0)) return 'Cargá los kg totales de materia verde (o el peso y la superficie de la muestra para calcularlo solo).';
      return null;
    },
    preguntaEliminar: '¿Eliminar este muestreo?'
  });
}

/* ---------- Lluvias (una lectura para varios lotes/cuadros) ---------- */

function pantallaLluvias() {
  marcoForrajes('Lluvias · Forrajes', 'forrajes', function (f) {
    // Agrupadas por lectura (misma carga para varios lugares)
    const grupos = {};
    f.lluviasManuales.forEach(function (r) {
      const clave = r.grupoId || r.id;
      (grupos[clave] = grupos[clave] || []).push(r);
    });
    const lecturas = Object.keys(grupos).map(function (k) { return grupos[k]; })
      .sort(function (a, b) { return b[0].fecha.localeCompare(a[0].fecha); });

    // Totales por lote/cuadro (como la segunda tabla de Forrajes)
    const totales = {};
    f.lluviasManuales.forEach(function (r) {
      const clave = lugarTexto(f, r.loteId, r.cuadroId);
      totales[clave] = totales[clave] || { mm: 0, lecturas: 0 };
      totales[clave].mm += Number(r.cantidadMm) || 0;
      totales[clave].lecturas += 1;
    });

    return (puedeEditar() ? '<button class="boton" onclick="formularioLluvia()">🌧 Registrar lluvia</button>' : '') +
      '<details class="desplegable"><summary>Totales por lote y cuadro</summary><div class="tabla-desplazable"><table class="tabla">' +
        '<thead><tr><th>Lote / cuadro</th><th>Total (mm)</th><th>Lecturas</th></tr></thead><tbody>' +
        Object.keys(totales).sort(function (a, b) { return a.localeCompare(b, 'es', { numeric: true }); }).map(function (k) {
          return '<tr><td>' + esc(k) + '</td><td>' + numero(totales[k].mm) + '</td><td>' + totales[k].lecturas + '</td></tr>';
        }).join('') + '</tbody></table></div></details>' +
      (lecturas.length ? lecturas.map(function (g) {
        const r = g[0];
        return '<div class="movimiento"><div class="movimiento-texto"><strong>' + numero(r.cantidadMm) + ' mm · ' + formatearFecha(r.fecha) + '</strong>' +
          '<span class="ayuda">' + g.map(function (x) { return esc(lugarTexto(f, x.loteId, x.cuadroId)); }).join(', ') + '</span>' +
          (r.notas ? '<span class="ayuda notas">' + esc(r.notas) + '</span>' : '') + '</div>' +
          '<div class="movimiento-acciones">' + botonEditar('formularioLluvia', r.id) + '</div></div>';
      }).join('') : '<p class="vacio">Todavía no hay lluvias cargadas.</p>');
  });
}

async function formularioLluvia(id) {
  const f = await cargarForrajes();
  const r = id ? f.lluviasManualesPorId[id] : null;
  const delGrupo = r ? f.lluviasManuales.filter(function (x) { return r.grupoId ? x.grupoId === r.grupoId : x.id === r.id; }) : [];
  const claveLugar = function (x) { return x.cuadroId ? 'c:' + x.cuadroId : 'l:' + x.loteId; };
  const opciones = [];
  f.lotes.filter(function (l) { return l.activo !== 'false'; }).forEach(function (l) {
    const cuadros = f.cuadros.filter(function (c) { return c.loteId === l.id; });
    if (!cuadros.length) opciones.push({ valor: 'l:' + l.id, texto: l.nombre });
    else cuadros.forEach(function (c) { opciones.push({ valor: 'c:' + c.id, texto: l.nombre + ' · Cuadro ' + c.numero }); });
  });

  await abrirFormulario({
    tabla: 'LluviasManuales',
    titulo: r ? 'Editar lluvia' : 'Registrar lluvia',
    registro: r,
    valores: r ? { lugares: delGrupo.map(claveLugar).join(','), fecha: r.fecha, cantidadMm: r.cantidadMm, notas: r.notas }
      : { fecha: hoyTexto(), lugares: opciones.map(function (o) { return o.valor; }).join(',') },
    ayuda: 'Elegí en qué lotes y cuadros cayó esta lluvia: se guarda para cada uno.',
    campos: [
      { nombre: 'fecha', etiqueta: 'Fecha', tipo: 'fecha', requerido: true, medio: true },
      { nombre: 'cantidadMm', etiqueta: 'Milímetros', tipo: 'numero', requerido: true, minimo: 0, medio: true },
      { nombre: 'lugares', etiqueta: 'Lotes y cuadros', tipo: 'casillas', requerido: true, botonTodos: true, opciones: opciones },
      { nombre: 'notas', etiqueta: 'Notas', tipo: 'area' }
    ],
    preguntaEliminar: '¿Eliminar esta lectura de lluvia' + (delGrupo.length > 1 ? ' de los ' + delGrupo.length + ' lugares' : '') + '?',
    guardar: async function (d) {
      const lugares = d.lugares.split(',').filter(Boolean);
      const grupoId = (r && r.grupoId) || (lugares.length > 1 ? idAlAzar() : '');
      const existentes = {};
      delGrupo.forEach(function (x) { existentes[claveLugar(x)] = x; });
      let primero = null;
      for (const lugar of lugares) {
        const cuadro = lugar.indexOf('c:') === 0 ? f.cuadrosPorId[lugar.slice(2)] : null;
        const registro = { loteId: cuadro ? cuadro.loteId : lugar.slice(2), cuadroId: cuadro ? cuadro.id : '', fecha: d.fecha,
          cantidadMm: d.cantidadMm, notas: d.notas, grupoId: grupoId };
        if (existentes[lugar]) { registro.id = existentes[lugar].id; delete existentes[lugar]; }
        const g = await Datos.guardar('LluviasManuales', registro);
        if (!primero) primero = g;
      }
      for (const sobra of Object.values(existentes)) await Datos.eliminar('LluviasManuales', sobra.id);
      return primero;
    },
    eliminar: async function () {
      for (const x of delGrupo) await Datos.eliminar('LluviasManuales', x.id);
    }
  });
}

/* ---------- Lotes y cuadros ---------- */

function pantallaLotes() {
  marcoForrajes('Lotes y cuadros · Forrajes', 'forrajes', function (f) {
    return (puedeEditar() ? '<button class="boton" onclick="formularioLote()">+ Nuevo lote</button>' : '') +
      f.lotes.map(function (l) {
        const cuadros = f.cuadros.filter(function (c) { return c.loteId === l.id; });
        const enCrecimiento = f.siembrasForraje.filter(function (s) { return s.loteId === l.id && s.estado === 'En crecimiento'; });
        return '<div class="fila-usuario' + (l.activo === 'false' ? ' inactiva' : '') + '"><div class="datos-usuario">' +
          '<strong>' + esc(l.nombre) + (l.activo === 'false' ? ' (inactivo)' : '') + '</strong>' +
          '<span class="ayuda">' + numero(l.superficieHa) + ' ha · ' + cuadros.length + ' cuadros · ' + enCrecimiento.length + ' siembras en crecimiento</span>' +
          (cuadros.length ? '<div class="chips">' + cuadros.map(function (c) {
            return '<button class="chip-lomo" ' + (puedeEditar() ? 'onclick="formularioCuadro(\'' + esc(c.id) + '\')"' : 'disabled') + '>' + esc(etiquetaCuadro(c)) + '</button>';
          }).join('') + '</div>' : '') +
          (l.notas ? '<span class="ayuda notas">' + esc(l.notas) + '</span>' : '') + '</div>' +
          (puedeEditar() ? '<div class="acciones"><button class="boton chico secundario" onclick="formularioLote(\'' + esc(l.id) + '\')">✎ Editar</button>' +
            '<button class="boton chico secundario" onclick="formularioCuadro(null, \'' + esc(l.id) + '\')">+ Cuadro</button></div>' : '') +
        '</div>';
      }).join('');
  });
}

async function formularioLote(id) {
  const f = await cargarForrajes();
  const l = id ? f.lotesPorId[id] : null;
  await abrirFormulario({
    tabla: 'Lotes',
    titulo: l ? 'Editar lote' : 'Nuevo lote',
    registro: l,
    valores: { activo: 'true' },
    campos: [
      { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true },
      { nombre: 'superficieHa', etiqueta: 'Superficie (ha)', tipo: 'numero', requerido: true, minimo: 0, medio: true },
      { nombre: 'cantidadCuadros', etiqueta: 'Cantidad de cuadros', tipo: 'entero', minimo: 0, medio: true, ayuda: 'Se crean solos: Cuadro 1, 2…' },
      { nombre: 'superficiePorCuadroHa', etiqueta: 'Superficie de cada cuadro (ha)', tipo: 'numero', minimo: 0 },
      { nombre: 'latitud', etiqueta: 'Latitud', tipo: 'numero', medio: true, seccion: 'Ubicación (opcional)' },
      { nombre: 'longitud', etiqueta: 'Longitud', tipo: 'numero', medio: true },
      { nombre: 'activo', etiqueta: 'Lote activo', tipo: 'sino' },
      { nombre: 'notas', etiqueta: 'Notas', tipo: 'area' }
    ],
    preguntaEliminar: '¿Eliminar este lote?',
    alEliminar: function (lote) {
      const activas = f.siembrasForraje.filter(function (s) { return s.loteId === lote.id && s.estado === 'En crecimiento'; });
      return activas.length ? 'No se puede eliminar: tiene siembras en crecimiento. Podés marcarlo como inactivo.' : null;
    },
    despuesDeGuardar: async function (g) {
      const cantidad = Number(g.cantidadCuadros) || 0;
      const existentes = f.cuadros.filter(function (c) { return c.loteId === g.id; }).map(function (c) { return Number(c.numero); });
      for (let n = 1; n <= cantidad; n++) {
        if (existentes.indexOf(n) === -1) await Datos.guardar('Cuadros', { loteId: g.id, numero: String(n), superficieHa: g.superficiePorCuadroHa || '', notas: '' });
      }
    }
  });
}

async function formularioCuadro(id, loteId) {
  const f = await cargarForrajes();
  const c = id ? f.cuadrosPorId[id] : null;
  const lid = c ? c.loteId : loteId;
  const siguiente = f.cuadros.filter(function (x) { return x.loteId === lid; }).reduce(function (m, x) { return Math.max(m, Number(x.numero) || 0); }, 0) + 1;
  await abrirFormulario({
    tabla: 'Cuadros',
    titulo: (c ? 'Editar cuadro · ' : 'Nuevo cuadro · ') + nombreLote(f, lid),
    registro: c,
    valores: { loteId: lid, numero: String(siguiente) },
    campos: [
      { nombre: 'numero', etiqueta: 'Número', tipo: 'entero', requerido: true, minimo: 1, medio: true },
      { nombre: 'superficieHa', etiqueta: 'Superficie (ha)', tipo: 'numero', minimo: 0, medio: true },
      { nombre: 'notas', etiqueta: 'Notas', tipo: 'area' }
    ],
    antesDeGuardar: function (d) { d.loteId = lid; },
    preguntaEliminar: '¿Eliminar este cuadro?',
    alEliminar: function (cuadro) {
      return f.siembrasForraje.some(function (s) { return s.cuadroId === cuadro.id && s.estado === 'En crecimiento'; })
        ? 'No se puede eliminar: tiene una siembra en crecimiento.' : null;
    }
  });
}

/* ---------- Especies (catálogo nutritivo) ---------- */

function pantallaEspecies() {
  marcoForrajes('Especies · Forrajes', 'forrajes', function (f) {
    return (puedeEditar() ? '<button class="boton" onclick="formularioEspecieForraje()">+ Nueva especie</button>' : '') +
      '<p class="ayuda">Valores de referencia en base materia seca. Para un lote de reserva puntual, cargá un análisis nutricional: lo reemplaza.</p>' +
      '<div class="tabla-desplazable"><table class="tabla"><thead><tr><th>Nombre</th><th>Tipo</th><th>MS %</th><th>PB %</th><th>EM Mcal/kg MS</th><th></th></tr></thead><tbody>' +
      f.especiesForraje.map(function (e) {
        return '<tr' + (e.activo === 'false' ? ' class="pronostico"' : '') + '><td>' + esc(e.nombre) + '</td><td>' + esc(e.tipoForraje) + '</td>' +
          '<td>' + numero(e.materiaSecaPct) + '</td><td>' + numero(e.proteinaBrutaPct) + '</td><td>' + numero(e.energiaMetabolizableMcalKgMs) + '</td>' +
          '<td>' + botonEditar('formularioEspecieForraje', e.id) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  });
}

async function formularioEspecieForraje(id) {
  const f = await cargarForrajes();
  const e = id ? f.especiesForrajePorId[id] : null;
  const n = function (nombre, etiqueta, requerido) { return { nombre: nombre, etiqueta: etiqueta, tipo: 'numero', minimo: 0, medio: true, requerido: requerido }; };
  await abrirFormulario({
    tabla: 'EspeciesForraje',
    titulo: e ? 'Editar especie' : 'Nueva especie',
    registro: e,
    valores: { activo: 'true', tipoForraje: 'Pastura perenne' },
    campos: [
      { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true },
      { nombre: 'nombreCientifico', etiqueta: 'Nombre científico', tipo: 'texto', medio: true },
      { nombre: 'tipoForraje', etiqueta: 'Tipo', tipo: 'select', opciones: FORRAJES.tiposForraje, medio: true },
      Object.assign(n('materiaSecaPct', 'Materia seca %', true), { seccion: 'Valor nutritivo (base materia seca)' }),
      n('proteinaBrutaPct', 'Proteína bruta %', true),
      n('energiaMetabolizableMcalKgMs', 'Energía metabolizable (Mcal/kg MS)', true), n('fdnPct', 'FDN %'),
      n('fdaPct', 'FDA %'), n('calcioPct', 'Calcio %', true), n('fosforoPct', 'Fósforo %', true),
      n('costoReferencialPorKgMs', 'Costo $/kg MS'),
      { nombre: 'activo', etiqueta: 'Especie activa', tipo: 'sino' },
      { nombre: 'notas', etiqueta: 'Notas', tipo: 'area' }
    ],
    preguntaEliminar: '¿Eliminar esta especie del catálogo?',
    alEliminar: function (esp) {
      const usada = f.siembraEspecies.some(function (x) { return x.especieId === esp.id; }) || f.lotesInventario.some(function (x) { return x.especieId === esp.id; }) ||
        f.racionIngredientes.some(function (x) { return x.especieId === esp.id; });
      return usada ? 'No se puede eliminar: se usa en siembras, stock o raciones. Podés marcarla como inactiva.' : null;
    }
  });
}
