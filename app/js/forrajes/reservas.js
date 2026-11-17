/**
 * FORRAJES · RESERVAS: ubicaciones, lotes de stock, movimientos y análisis nutricionales.
 */
let vistaInventario = 'stock';
let verAgotados = false;

function pantallaInventario() {
  marcoForrajes('Reservas · Forrajes', 'forrajes', function (f) {
    const pestanas = [['stock', 'Stock'], ['movimientos', 'Movimientos'], ['ubicaciones', 'Ubicaciones'], ['analisis', 'Análisis']];
    let html = '<div class="pestanas">' + pestanas.map(function (p) {
      return '<button class="pestana' + (vistaInventario === p[0] ? ' activa' : '') + '" onclick="vistaInventario = \'' + p[0] + '\'; alActualizarDatos()">' + p[1] + '</button>';
    }).join('') + '</div>';

    if (vistaInventario === 'ubicaciones') return html + htmlUbicaciones(f);
    if (vistaInventario === 'movimientos') return html + htmlMovimientos(f);
    if (vistaInventario === 'analisis') return html + htmlAnalisis(f);

    // Stock
    const proyeccion = proyeccionStock(f);
    const lotes = f.lotesInventario.map(function (l) { return Object.assign({ _stock: stockLote(f, l) }, l); })
      .filter(function (l) { return verAgotados || l._stock.kg > 0; })
      .sort(function (a, b) { return nombreEspecie(f, a.especieId).localeCompare(nombreEspecie(f, b.especieId)); });
    html += (puedeEditar()
        ? '<div class="botones-alta"><button class="boton chico" onclick="formularioCompra()">+ Compra / ingreso</button>' +
          '<button class="boton chico" onclick="formularioMovimientoStock()">± Movimiento</button></div>' : '') +
      (proyeccion.length
        ? '<div class="tabla-desplazable"><table class="tabla"><thead><tr><th>Especie</th><th>Stock (kg)</th><th>Consumo (kg/día)</th><th>Días restantes</th></tr></thead><tbody>' +
            proyeccion.map(function (p) {
              return '<tr><td>' + esc(p.nombre) + '</td><td>' + numero(p.stockKg) + '</td><td>' + (p.consumoKgDia ? numero(p.consumoKgDia) : '—') + '</td>' +
                '<td class="' + (p.dias !== null && p.dias <= FORRAJES.diasAlertaStock ? 'texto-rojo' : '') + '">' + (p.dias === null ? 'Sin consumo' : Math.floor(p.dias)) + '</td></tr>';
            }).join('') + '</tbody></table></div>'
        : '') +
      '<label class="casilla"><input type="checkbox"' + (verAgotados ? ' checked' : '') + ' onchange="verAgotados = this.checked; alActualizarDatos()"> Mostrar también los lotes agotados</label>' +
      (lotes.length ? lotes.map(function (l) {
        const u = f.ubicacionesAlmacenamientoPorId[l.ubicacionId];
        const perfil = perfilNutricional(f, l.especieId, l.id);
        const vence = l.fechaLimiteCalidad && l.fechaLimiteCalidad <= sumarDias(hoyTexto(), 15);
        return '<div class="movimiento' + (l._stock.kg <= 0 ? ' eliminado' : ' mov-ingresos') + '">' +
          '<div class="movimiento-texto"><strong>' + esc(nombreEspecie(f, l.especieId)) + (l.identificador ? ' · ' + esc(l.identificador) : '') + '</strong>' +
            '<span class="ayuda">' + (u ? esc(u.nombre) : 'Sin ubicación') + ' · ingreso ' + formatearFecha(l.fechaIngreso) + ' · ' + esc(l.origen) +
              (Number(l.costoPorKg) ? ' · ' + pesos(l.costoPorKg) + '/kg' : '') + '</span>' +
            '<span class="ayuda">MS ' + numero(perfil.materiaSecaPct) + '% · PB ' + numero(perfil.proteinaBrutaPct) + '%' + (perfil.conAnalisis ? ' (análisis de laboratorio)' : ' (catálogo)') + '</span>' +
            (vence ? '<span class="aviso-carencia">⚠ Usar antes del ' + formatearFecha(l.fechaLimiteCalidad) + '</span>' : '') +
          '</div>' +
          '<div class="movimiento-valor">' + numero(l._stock.kg) + ' kg' + (l._stock.unidades !== null ? '<br><span class="ayuda">' + numero(l._stock.unidades) + ' unid.</span>' : '') +
            (l._stock.kg <= 0 ? '<br><span class="ayuda">Agotado</span>' : '') + '</div>' +
          (puedeEditar() ? '<div class="movimiento-acciones">' +
            '<button class="boton chico secundario" onclick="formularioMovimientoStock(null, \'' + esc(l.id) + '\')" title="Registrar movimiento">±</button>' +
            '<button class="boton chico secundario" onclick="formularioAnalisis(null, \'' + esc(l.id) + '\')" title="Cargar análisis">🧪</button>' +
            botonEditar('formularioCompra', l.id) + '</div>' : '') +
        '</div>';
      }).join('') : '<p class="vacio">No hay reservas en stock. Ingresá una cosecha desde Cosechas o cargá una compra.</p>');
    return html;
  });
}

function opcionesLotesInventario(f, incluirId) {
  return f.lotesInventario
    .filter(function (l) { return stockLote(f, l).kg > 0 || l.id === incluirId; })
    .map(function (l) {
      const u = f.ubicacionesAlmacenamientoPorId[l.ubicacionId];
      return { valor: l.id, texto: nombreEspecie(f, l.especieId) + (l.identificador ? ' · ' + l.identificador : '') + ' · ' + (u ? u.nombre : '') + ' · ' + numero(stockLote(f, l).kg) + ' kg' };
    });
}

/** Compra (o edición de un lote de stock). */
async function formularioCompra(id) {
  const f = await cargarForrajes();
  const l = id ? f.lotesInventarioPorId[id] : null;
  const ubicaciones = f.ubicacionesAlmacenamiento.filter(function (u) { return u.activo !== 'false' || (l && l.ubicacionId === u.id); });
  if (!ubicaciones.length) return alert('Primero creá una ubicación de almacenamiento (pestaña Ubicaciones).');
  await abrirFormulario({
    tabla: 'LotesInventario',
    titulo: l ? 'Editar lote de stock' : 'Registrar compra / ingreso',
    registro: l,
    valores: { fechaIngreso: hoyTexto(), origen: 'Compra' },
    ayuda: l ? 'Para sumar o restar stock usá "Movimiento"; acá se corrigen los datos del ingreso.' : '',
    campos: [
      { nombre: 'especieId', etiqueta: 'Especie / producto', tipo: 'select', requerido: true, vacio: 'Elegí…',
        opciones: f.especiesForraje.map(function (e) { return { valor: e.id, texto: e.nombre }; }) },
      { nombre: 'ubicacionId', etiqueta: 'Ubicación', tipo: 'select', requerido: true, vacio: 'Elegí…', medio: true,
        opciones: ubicaciones.map(function (u) { return { valor: u.id, texto: u.nombre }; }) },
      { nombre: 'fechaIngreso', etiqueta: 'Fecha de ingreso', tipo: 'fecha', requerido: true, medio: true },
      { nombre: 'kgIngreso', etiqueta: 'Kg que ingresaron', tipo: 'numero', requerido: true, minimo: 0, medio: true },
      { nombre: 'unidadesIngreso', etiqueta: 'Unidades (rollos, fardos, bolsas)', tipo: 'numero', minimo: 0, medio: true },
      { nombre: 'pesoPromedioUnidadKg', etiqueta: 'Peso promedio por unidad (kg)', tipo: 'numero', minimo: 0, medio: true },
      { nombre: 'costoPorKg', etiqueta: 'Costo $/kg', tipo: 'numero', minimo: 0, medio: true },
      { nombre: 'origen', etiqueta: 'Origen', tipo: 'select', opciones: FORRAJES.origenes, medio: true },
      { nombre: 'fechaLimiteCalidad', etiqueta: 'Usar antes de', tipo: 'fecha', medio: true },
      { nombre: 'identificador', etiqueta: 'Identificador', tipo: 'texto' }
    ],
    preguntaEliminar: '¿Eliminar este lote de stock y sus movimientos?',
    eliminar: async function (lote) {
      for (const m of f.movimientosInventario.filter(function (x) { return x.loteInventarioId === lote.id; })) await Datos.eliminar('MovimientosInventario', m.id);
      await Datos.eliminar('LotesInventario', lote.id);
      if (lote.cosechaId) await Datos.guardar('CosechasForraje', { id: lote.cosechaId, ingresadaAInventario: 'false' });
    }
  });
}

async function formularioMovimientoStock(id, loteInventarioId) {
  const f = await cargarForrajes();
  const m = id ? f.movimientosInventarioPorId[id] : null;
  const opciones = opcionesLotesInventario(f, m ? m.loteInventarioId : loteInventarioId);
  if (!opciones.length) return alert('No hay lotes de stock para mover.');
  await abrirFormulario({
    tabla: 'MovimientosInventario',
    titulo: m ? 'Editar movimiento' : 'Registrar movimiento de stock',
    registro: m,
    valores: { fecha: hoyTexto(), tipoMovimiento: 'Salida', loteInventarioId: loteInventarioId || '' },
    ayuda: 'Entrada suma · Salida y Merma restan · Ajuste corrige (usá un número negativo para restar).',
    campos: [
      { nombre: 'loteInventarioId', etiqueta: 'Lote de stock', tipo: 'select', requerido: true, vacio: 'Elegí…', opciones: opciones },
      { nombre: 'tipoMovimiento', etiqueta: 'Tipo', tipo: 'select', opciones: FORRAJES.tiposMovimiento, requerido: true, medio: true },
      { nombre: 'fecha', etiqueta: 'Fecha', tipo: 'fecha', requerido: true, medio: true },
      { nombre: 'cantidadKg', etiqueta: 'Kg', tipo: 'numero', requerido: true, medio: true },
      { nombre: 'cantidadUnidades', etiqueta: 'Unidades', tipo: 'numero', medio: true },
      { nombre: 'motivo', etiqueta: 'Motivo', tipo: 'texto' }
    ],
    validar: function (d) {
      const kg = Number(d.cantidadKg);
      if (d.tipoMovimiento !== 'Ajuste' && !(kg > 0)) return 'La cantidad debe ser mayor a cero.';
      if (d.tipoMovimiento === 'Ajuste' && !kg) return 'Cargá cuánto se ajusta (positivo suma, negativo resta).';
      if (d.cantidadUnidades !== '' && d.tipoMovimiento !== 'Ajuste' && Number(d.cantidadUnidades) < 0) return 'Las unidades no pueden ser negativas.';
      const lote = f.lotesInventarioPorId[d.loteInventarioId];
      if (lote && (d.tipoMovimiento === 'Salida' || d.tipoMovimiento === 'Merma')) {
        const disponible = stockLote(f, lote).kg + (m && m.loteInventarioId === lote.id ? signoMovimiento(m) * -1 * Number(m.cantidadKg) : 0);
        if (kg > disponible + 0.001 && !confirm('Solo hay ' + numero(disponible) + ' kg en ese lote. ¿Registrar igual?')) return 'Movimiento no registrado.';
      }
      return null;
    },
    preguntaEliminar: '¿Eliminar este movimiento? El stock se recalcula.'
  });
}

function htmlMovimientos(f) {
  const lista = f.movimientosInventario.slice().sort(porFechaDesc).slice(0, 200);
  return (puedeEditar() ? '<button class="boton" onclick="formularioMovimientoStock()">± Registrar movimiento</button>' : '') +
    (lista.length ? '<div class="tabla-desplazable"><table class="tabla"><thead><tr><th>Fecha</th><th>Lote</th><th>Tipo</th><th>Kg</th><th>Unid.</th><th>Motivo</th><th></th></tr></thead><tbody>' +
      lista.map(function (m) {
        const l = f.lotesInventarioPorId[m.loteInventarioId];
        return '<tr><td>' + formatearFecha(m.fecha) + '</td><td>' + (l ? esc(nombreEspecie(f, l.especieId)) : '—') + '</td><td>' + esc(m.tipoMovimiento) + '</td>' +
          '<td>' + (signoMovimiento(m) < 0 ? '−' : '+') + numero(Math.abs(Number(m.cantidadKg))) + '</td><td>' + (m.cantidadUnidades ? numero(m.cantidadUnidades) : '') + '</td>' +
          '<td style="text-align:left">' + esc(m.motivo || '') + '</td><td>' + botonEditar('formularioMovimientoStock', m.id) + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<p class="vacio">Todavía no hay movimientos.</p>');
}

function htmlUbicaciones(f) {
  return (puedeEditar() ? '<button class="boton" onclick="formularioUbicacion()">+ Nueva ubicación</button>' : '') +
    (f.ubicacionesAlmacenamiento.length ? f.ubicacionesAlmacenamiento.map(function (u) {
      const kg = f.lotesInventario.filter(function (l) { return l.ubicacionId === u.id; }).reduce(function (t, l) { return t + Math.max(0, stockLote(f, l).kg); }, 0);
      return '<div class="movimiento' + (u.activo === 'false' ? ' eliminado' : '') + '"><div class="movimiento-texto"><strong>' + esc(u.nombre) + '</strong>' +
        '<span class="ayuda">' + esc(u.tipoAlmacenamiento) + (u.capacidadTon ? ' · capacidad ' + numero(u.capacidadTon) + ' t' : '') + (u.activo === 'false' ? ' · inactiva' : '') + '</span></div>' +
        '<div class="movimiento-valor">' + numero(kg) + ' kg' + (Number(u.capacidadTon) ? '<br><span class="ayuda">' + Math.round(kg / (Number(u.capacidadTon) * 10)) + '% ocupado</span>' : '') + '</div>' +
        '<div class="movimiento-acciones">' + botonEditar('formularioUbicacion', u.id) + '</div></div>';
    }).join('') : '<p class="vacio">Todavía no hay ubicaciones. Creá una (ej. "Galpón", "Fardera") para poder guardar reservas.</p>');
}

async function formularioUbicacion(id) {
  const f = await cargarForrajes();
  const u = id ? f.ubicacionesAlmacenamientoPorId[id] : null;
  await abrirFormulario({
    tabla: 'UbicacionesAlmacenamiento',
    titulo: u ? 'Editar ubicación' : 'Nueva ubicación',
    registro: u,
    valores: { activo: 'true', tipoAlmacenamiento: 'Galpón' },
    campos: [
      { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true },
      { nombre: 'tipoAlmacenamiento', etiqueta: 'Tipo', tipo: 'select', opciones: FORRAJES.tiposAlmacenamiento, medio: true },
      { nombre: 'capacidadTon', etiqueta: 'Capacidad (toneladas)', tipo: 'numero', minimo: 0, medio: true },
      { nombre: 'activo', etiqueta: 'Ubicación activa', tipo: 'sino' },
      { nombre: 'notas', etiqueta: 'Notas', tipo: 'area' }
    ],
    preguntaEliminar: '¿Eliminar esta ubicación?',
    alEliminar: function (ub) {
      return f.lotesInventario.some(function (l) { return l.ubicacionId === ub.id && stockLote(f, l).kg > 0; })
        ? 'No se puede eliminar: tiene reservas guardadas. Podés marcarla como inactiva.' : null;
    }
  });
}

function htmlAnalisis(f) {
  const lista = f.analisisNutricionales.slice().sort(porFechaDesc);
  return (puedeEditar() ? '<button class="boton" onclick="formularioAnalisis()">🧪 Cargar análisis</button>' : '') +
    '<p class="ayuda">El análisis de laboratorio reemplaza, para ese lote de stock, los valores del catálogo en el cálculo de raciones (solo los campos medidos).</p>' +
    (lista.length ? '<div class="tabla-desplazable"><table class="tabla"><thead><tr><th>Lote</th><th>Fecha</th><th>MS %</th><th>PB %</th><th>EM</th><th>Laboratorio</th><th></th></tr></thead><tbody>' +
      lista.map(function (a) {
        const l = f.lotesInventarioPorId[a.loteInventarioId];
        return '<tr><td>' + (l ? esc(nombreEspecie(f, l.especieId) + (l.identificador ? ' · ' + l.identificador : '')) : '—') + '</td><td>' + formatearFecha(a.fecha) + '</td>' +
          '<td>' + (a.materiaSecaPct ? numero(a.materiaSecaPct) : '—') + '</td><td>' + (a.proteinaBrutaPct ? numero(a.proteinaBrutaPct) : '—') + '</td>' +
          '<td>' + (a.energiaMetabolizableMcalKgMs ? numero(a.energiaMetabolizableMcalKgMs) : '—') + '</td><td>' + esc(a.laboratorio || '') + '</td>' +
          '<td>' + botonEditar('formularioAnalisis', a.id) + '</td></tr>';
      }).join('') + '</tbody></table></div>' : '<p class="vacio">Todavía no hay análisis.</p>');
}

async function formularioAnalisis(id, loteInventarioId) {
  const f = await cargarForrajes();
  const a = id ? f.analisisNutricionalesPorId[id] : null;
  const n = function (nombre, etiqueta) { return { nombre: nombre, etiqueta: etiqueta, tipo: 'numero', minimo: 0, medio: true }; };
  await abrirFormulario({
    tabla: 'AnalisisNutricionales',
    titulo: a ? 'Editar análisis' : 'Cargar análisis nutricional',
    registro: a,
    valores: { fecha: hoyTexto(), loteInventarioId: loteInventarioId || '' },
    ayuda: 'Cargá solo los valores que midió el laboratorio; el resto se sigue tomando del catálogo.',
    campos: [
      { nombre: 'loteInventarioId', etiqueta: 'Lote de stock', tipo: 'select', requerido: true, vacio: 'Elegí…',
        opciones: f.lotesInventario.map(function (l) { return { valor: l.id, texto: nombreEspecie(f, l.especieId) + (l.identificador ? ' · ' + l.identificador : '') + ' · ' + formatearFecha(l.fechaIngreso) }; }) },
      { nombre: 'fecha', etiqueta: 'Fecha', tipo: 'fecha', requerido: true, medio: true },
      { nombre: 'laboratorio', etiqueta: 'Laboratorio', tipo: 'texto', medio: true },
      n('materiaSecaPct', 'Materia seca %'), n('proteinaBrutaPct', 'Proteína bruta %'), n('fdnPct', 'FDN %'), n('fdaPct', 'FDA %'),
      n('energiaMetabolizableMcalKgMs', 'EM (Mcal/kg MS)'), n('calcioPct', 'Calcio %'), n('fosforoPct', 'Fósforo %'),
      { nombre: 'observaciones', etiqueta: 'Observaciones', tipo: 'area' }
    ],
    preguntaEliminar: '¿Eliminar este análisis?'
  });
}
