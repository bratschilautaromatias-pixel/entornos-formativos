/**
 * FORRAJES · RACIONES: categorías animales, lotes de consumo (grupos de animales),
 * raciones con su cálculo nutricional, asignaciones y registro del consumo diario.
 */
let vistaRaciones = 'raciones';

function pantallaRaciones() {
  marcoForrajes('Raciones · Forrajes', 'forrajes', function (f) {
    let html = '<div class="pestanas">' + [['raciones', 'Raciones'], ['animales', 'Lotes de animales']].map(function (p) {
      return '<button class="pestana' + (vistaRaciones === p[0] ? ' activa' : '') + '" onclick="vistaRaciones = \'' + p[0] + '\'; alActualizarDatos()">' + p[1] + '</button>';
    }).join('') + '</div>';

    if (vistaRaciones === 'animales') {
      return html + (puedeEditar() ? '<button class="boton" onclick="formularioLoteConsumo()">+ Nuevo lote de animales</button>' : '') +
        (f.lotesConsumo.length ? f.lotesConsumo.map(function (lc) {
          const cat = f.categoriasAnimalesPorId[lc.categoriaId];
          const asignacion = f.asignacionesRacion.find(function (a) { return a.loteConsumoId === lc.id && a.activa !== 'false'; });
          const racion = asignacion ? f.racionesPorId[asignacion.racionId] : null;
          return '<div class="movimiento' + (lc.activo === 'false' ? ' eliminado' : '') + '"><div class="movimiento-texto"><strong>' + esc(lc.nombre) + '</strong>' +
            '<span class="ayuda">' + esc(cat ? cat.nombre : 'Sin categoría') + ' · ' + numero(lc.cantidadCabezas) + ' cabezas' +
              (lc.pesoPromedioKg ? ' · ' + numero(lc.pesoPromedioKg) + ' kg promedio' : '') + '</span>' +
            '<span class="ayuda">' + (racion ? 'Come: ' + esc(racion.nombre) + ' (desde el ' + formatearFecha(asignacion.fechaInicio) + ')' : 'Sin ración asignada') + '</span></div>' +
            '<div class="movimiento-acciones">' + botonEditar('formularioLoteConsumo', lc.id) + '</div></div>';
        }).join('') : '<p class="vacio">Todavía no hay lotes de animales. Cargá uno (ej. "Vacas en ordeñe", 12 cabezas) para asignarle una ración.</p>');
    }

    return html + (puedeEditar() ? '<button class="boton" onclick="formularioRacion()">+ Nueva ración</button>' : '') +
      (f.raciones.length ? f.raciones.map(function (r) {
        const cat = f.categoriasAnimalesPorId[r.categoriaId];
        const ingredientes = ingredientesDeRacion(f, r.id);
        const calculo = cat ? calcularRacion(ingredientes, cat, 1, Number(cat.pesoVivoReferenciaKg) || 0) : null;
        const asignadas = f.asignacionesRacion.filter(function (a) { return a.racionId === r.id && a.activa !== 'false'; }).length;
        return '<button class="fila-cultivo" onclick="ir(\'forrajes/racion/' + esc(r.id) + '\')"><strong>' + esc(r.nombre) + (r.activa === 'false' ? ' (inactiva)' : '') + '</strong>' +
          '<span class="ayuda">' + esc(cat ? cat.nombre : 'Sin categoría') + ' · ' + ingredientes.length + ' ingredientes · ' +
            (calculo ? numero(calculo.ms) + ' kg MS/cabeza/día' : '') + ' · ' + asignadas + ' lote(s) de animales</span></button>';
      }).join('') : '<p class="vacio">Todavía no hay raciones.</p>');
  });
}

/* ---------- Ficha de una ración ---------- */

let loteConsumoCalculo = '';

function pantallaFichaRacion(id) {
  marcoForrajes('Ración · Forrajes', 'forrajes/raciones', function (f) {
    const r = f.racionesPorId[id];
    if (!r) return '<p class="vacio">No se encontró la ración.</p>';
    const cat = f.categoriasAnimalesPorId[r.categoriaId];
    const ingredientes = ingredientesDeRacion(f, id);
    const asignaciones = f.asignacionesRacion.filter(function (a) { return a.racionId === id; })
      .sort(function (a, b) { return String(b.fechaInicio).localeCompare(String(a.fechaInicio)); });
    const loteCalculo = f.lotesConsumoPorId[loteConsumoCalculo];
    const cabezas = loteCalculo ? Number(loteCalculo.cantidadCabezas) || 0 : 1;
    const peso = loteCalculo ? pesoPromedioLoteConsumo(f, loteCalculo) : (cat ? Number(cat.pesoVivoReferenciaKg) || 0 : 0);
    const calculo = cat ? calcularRacion(ingredientes, cat, cabezas, peso) : null;
    const editar = puedeEditar();
    const fila = function (nombre, valor, requerido, estado, unidad) {
      const clase = estado === 'Cumple' ? 'ok' : estado === 'Déficit' ? 'texto-rojo' : 'texto-ambar';
      return '<tr><td>' + nombre + '</td><td>' + valor + ' ' + unidad + '</td><td>' + requerido + ' ' + unidad + '</td><td class="' + clase + '"><b>' + estado + '</b></td></tr>';
    };

    return '<h1>' + esc(r.nombre) + '</h1>' +
      '<p class="saludo">Para: ' + esc(cat ? cat.nombre : 'sin categoría') + '</p>' +
      (editar ? '<div class="botones-alta"><button class="boton chico" onclick="formularioIngrediente(null, \'' + esc(id) + '\')">+ Ingrediente</button>' +
        '<button class="boton chico" onclick="formularioAsignacion(\'' + esc(id) + '\')">Asignar a animales</button>' +
        '<button class="boton chico secundario" onclick="formularioRacion(\'' + esc(id) + '\')">✎ Editar</button></div>' : '') +

      '<h2 class="grupo-titulo">Ingredientes (por cabeza por día)</h2>' +
      (ingredientes.length ? ingredientes.map(function (i) {
        const talCual = i.perfil.materiaSecaPct > 0 ? i.kgMs / (i.perfil.materiaSecaPct / 100) : 0;
        return '<div class="fila-historial"><div><strong>' + esc(i.nombre) + '</strong> · ' + numero(i.kgMs) + ' kg MS' +
          '<br><span class="ayuda">≈ ' + numero(talCual) + ' kg tal cual (MS ' + numero(i.perfil.materiaSecaPct) + '%) · PB ' + numero(i.perfil.proteinaBrutaPct) +
          '% · EM ' + numero(i.perfil.energiaMetabolizableMcalKgMs) + '</span></div>' + botonEditar('formularioIngrediente', i.id) + '</div>';
      }).join('') : '<p class="ayuda">Todavía no tiene ingredientes.</p>') +

      (calculo && ingredientes.length
        ? '<h2 class="grupo-titulo">¿Cumple con lo que necesita el animal?</h2>' +
          '<label>Calcular para<select onchange="loteConsumoCalculo = this.value; alActualizarDatos()">' +
            '<option value="">1 animal de referencia (' + numero(peso) + ' kg)</option>' +
            f.lotesConsumo.filter(function (lc) { return lc.activo !== 'false'; }).map(function (lc) {
              return '<option value="' + esc(lc.id) + '"' + (loteConsumoCalculo === lc.id ? ' selected' : '') + '>' + esc(lc.nombre) + ' (' + numero(lc.cantidadCabezas) + ' cabezas)</option>';
            }).join('') + '</select></label>' +
          '<div class="tabla-desplazable"><table class="tabla"><thead><tr><th>Nutriente</th><th>La ración aporta</th><th>Requiere</th><th>Estado</th></tr></thead><tbody>' +
            fila('Materia seca', numero(calculo.ms), numero(calculo.capacidadIngesta), calculo.estadoMs, 'kg/día') +
            fila('Proteína bruta', numero(calculo.pb), numero(cat.requerimientoProteinaBrutaPctMs), calculo.estadoPb, '% MS') +
            fila('Energía metabolizable', numero(calculo.em), numero(cat.requerimientoEnergiaMetabolizableMcalKgMs), calculo.estadoEm, 'Mcal/kg MS') +
            fila('Calcio', numero(calculo.ca), numero(cat.requerimientoCalcioPctMs), calculo.estadoCa, '% MS') +
            fila('Fósforo', numero(calculo.p), numero(cat.requerimientoFosforoPctMs), calculo.estadoP, '% MS') +
          '</tbody></table></div>' +
          '<p class="ayuda">"Cumple" = dentro de ±5% de lo requerido. Materia seca: se compara con lo que puede comer según su peso (' +
            numero(cat.requerimientoMsPctPesoVivo) + '% del peso vivo).</p>' +
          '<div class="totales"><div><span>Consumo del grupo por día</span><b>' + numero(calculo.grupoKgMsDia) + ' kg MS</b><small>≈ ' +
            numero(calculo.grupoKgTalCualDia) + ' kg tal cual · ' + numero(cabezas) + ' cabeza(s)</small></div></div>'
        : '') +

      '<h2 class="grupo-titulo">Lotes de animales que la comen <span class="contador">' + asignaciones.length + '</span></h2>' +
      (asignaciones.length ? asignaciones.map(function (a) {
        const lc = f.lotesConsumoPorId[a.loteConsumoId];
        const activa = a.activa !== 'false';
        return '<div class="fila-historial"><div><strong>' + esc(lc ? lc.nombre : 'Lote eliminado') + '</strong>' +
          (lc ? ' · ' + numero(lc.cantidadCabezas) + ' cabezas' : '') +
          '<br><span class="ayuda">Desde el ' + formatearFecha(a.fechaInicio) + (activa ? ' · activa' : ' · finalizada el ' + formatearFecha(a.fechaFin)) + '</span></div>' +
          (editar && activa ? '<div class="acciones"><button class="boton chico" onclick="registrarConsumoDia(\'' + esc(a.id) + '\')">Registrar consumo de hoy</button>' +
            '<button class="boton chico secundario" onclick="finalizarAsignacion(\'' + esc(a.id) + '\')">Finalizar</button></div>' : '') +
        '</div>';
      }).join('') : '<p class="ayuda">Todavía no está asignada a ningún lote de animales.</p>') +
      (r.observaciones ? '<div class="tarjeta-info">' + dato('Observaciones', r.observaciones) + '</div>' : '');
  });
}

/* ---------- Formularios ---------- */

async function formularioRacion(id) {
  const f = await cargarForrajes();
  const r = id ? f.racionesPorId[id] : null;
  await abrirFormulario({
    tabla: 'Raciones',
    titulo: r ? 'Editar ración' : 'Nueva ración',
    registro: r,
    valores: { activa: 'true' },
    campos: [
      { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true },
      { nombre: 'categoriaId', etiqueta: 'Categoría animal objetivo', tipo: 'select', requerido: true, vacio: 'Elegí…',
        opciones: f.categoriasAnimales.filter(function (c) { return c.activo !== 'false'; }).map(function (c) { return { valor: c.id, texto: c.nombre }; }) },
      { nombre: 'activa', etiqueta: 'Ración activa', tipo: 'sino' },
      { nombre: 'observaciones', etiqueta: 'Observaciones', tipo: 'area' }
    ],
    preguntaEliminar: '¿Eliminar esta ración?',
    alEliminar: function (rac) {
      return f.asignacionesRacion.some(function (a) { return a.racionId === rac.id && a.activa !== 'false'; })
        ? 'No se puede eliminar: hay animales comiendo esta ración. Finalizá la asignación primero.' : null;
    },
    despuesDeGuardar: function (g, anterior) { if (!anterior) ir('forrajes/racion/' + g.id); }
  });
}

async function formularioIngrediente(id, racionId) {
  const f = await cargarForrajes();
  const i = id ? f.racionIngredientesPorId[id] : null;
  await abrirFormulario({
    tabla: 'RacionIngredientes',
    titulo: i ? 'Editar ingrediente' : 'Agregar ingrediente',
    registro: i,
    valores: { racionId: racionId },
    campos: [
      { nombre: 'especieId', etiqueta: 'Alimento', tipo: 'select', requerido: true, vacio: 'Elegí…',
        opciones: f.especiesForraje.filter(function (e) { return e.activo !== 'false' || (i && i.especieId === e.id); }).map(function (e) { return { valor: e.id, texto: e.nombre }; }) },
      { nombre: 'cantidadKgMsCabezaDia', etiqueta: 'Kg de materia seca por cabeza por día', tipo: 'numero', requerido: true, minimo: 0 }
    ],
    antesDeGuardar: function (d) { d.racionId = i ? i.racionId : racionId; },
    preguntaEliminar: '¿Quitar este ingrediente de la ración?'
  });
}

async function formularioAsignacion(racionId) {
  const f = await cargarForrajes();
  const ocupados = f.asignacionesRacion.filter(function (a) { return a.activa !== 'false'; }).map(function (a) { return a.loteConsumoId; });
  const libres = f.lotesConsumo.filter(function (lc) { return lc.activo !== 'false' && ocupados.indexOf(lc.id) === -1; });
  if (!libres.length) return alert('No hay lotes de animales libres. Creá uno en Raciones → Lotes de animales, o finalizá la ración que tiene asignada.');
  await abrirFormulario({
    tabla: 'AsignacionesRacion',
    titulo: 'Asignar ración a un lote de animales',
    valores: { racionId: racionId, fechaInicio: hoyTexto(), activa: 'true' },
    campos: [
      { nombre: 'loteConsumoId', etiqueta: 'Lote de animales', tipo: 'select', requerido: true, vacio: 'Elegí…',
        opciones: libres.map(function (lc) { return { valor: lc.id, texto: lc.nombre + ' (' + lc.cantidadCabezas + ' cabezas)' }; }) },
      { nombre: 'fechaInicio', etiqueta: 'Desde', tipo: 'fecha', requerido: true }
    ],
    antesDeGuardar: function (d) { d.racionId = racionId; d.activa = 'true'; d.fechaFin = ''; }
  });
}

async function finalizarAsignacion(id) {
  if (!confirm('¿Finalizar esta asignación? El lote de animales queda libre para otra ración.')) return;
  await Datos.guardar('AsignacionesRacion', { id: id, activa: 'false', fechaFin: hoyTexto() });
}

/**
 * Descuenta del stock lo que comió hoy el lote de animales (como "Registrar consumo" de Forrajes):
 * por cada ingrediente, kg tal cual = kg MS por cabeza ÷ MS% × cabezas, del primer lote de stock de esa especie.
 */
async function registrarConsumoDia(asignacionId) {
  const f = await cargarForrajes();
  const a = f.asignacionesRacionPorId[asignacionId];
  const r = a && f.racionesPorId[a.racionId];
  const lc = a && f.lotesConsumoPorId[a.loteConsumoId];
  if (!a || !r || !lc) return;
  const plan = [];
  const advertencias = [];
  f.racionIngredientes.filter(function (i) { return i.racionId === r.id; }).forEach(function (i) {
    const e = f.especiesForrajePorId[i.especieId];
    if (!e || !(Number(e.materiaSecaPct) > 0)) return;
    const necesario = Number(i.cantidadKgMsCabezaDia) / (Number(e.materiaSecaPct) / 100) * (Number(lc.cantidadCabezas) || 0);
    if (!(necesario > 0)) return;
    const lote = f.lotesInventario.filter(function (l) { return l.especieId === i.especieId && stockLote(f, l).kg > 0; })
      .sort(function (x, y) { return String(x.fechaIngreso).localeCompare(String(y.fechaIngreso)); })[0];
    if (!lote) { advertencias.push('Sin stock de ' + e.nombre + '.'); return; }
    const disponible = stockLote(f, lote).kg;
    const aDescontar = Math.min(necesario, disponible);
    if (aDescontar < necesario) advertencias.push('Stock insuficiente de ' + e.nombre + ': se descuentan ' + numero(aDescontar) + ' de ' + numero(necesario) + ' kg.');
    plan.push({ lote: lote, especie: e.nombre, kg: Math.round(aDescontar * 100) / 100 });
  });
  if (!plan.length) return alert('No se descontó nada. ' + advertencias.join(' '));
  const texto = 'Se va a descontar del stock el consumo de hoy de "' + lc.nombre + '":\n' +
    plan.map(function (p) { return '• ' + p.especie + ': ' + numero(p.kg) + ' kg'; }).join('\n') +
    (advertencias.length ? '\n\n⚠ ' + advertencias.join('\n⚠ ') : '') + '\n\n¿Confirmar?';
  if (!confirm(texto)) return;
  for (const p of plan) {
    await Datos.guardar('MovimientosInventario', {
      loteInventarioId: p.lote.id, fecha: hoyTexto(), tipoMovimiento: 'Salida', cantidadKg: String(p.kg), cantidadUnidades: '',
      motivo: 'Consumo — ' + r.nombre + ' / ' + lc.nombre, asignacionId: a.id
    });
  }
}

async function formularioLoteConsumo(id) {
  const f = await cargarForrajes();
  const lc = id ? f.lotesConsumoPorId[id] : null;
  await abrirFormulario({
    tabla: 'LotesConsumo',
    titulo: lc ? 'Editar lote de animales' : 'Nuevo lote de animales',
    registro: lc,
    valores: { activo: 'true' },
    campos: [
      { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true, ayuda: 'Ej: "Vacas en ordeñe", "Corderos de engorde"' },
      { nombre: 'categoriaId', etiqueta: 'Categoría animal', tipo: 'select', requerido: true, vacio: 'Elegí…',
        opciones: f.categoriasAnimales.filter(function (c) { return c.activo !== 'false'; }).map(function (c) { return { valor: c.id, texto: c.nombre }; }) },
      { nombre: 'cantidadCabezas', etiqueta: 'Cabezas', tipo: 'entero', requerido: true, minimo: 1, medio: true },
      { nombre: 'pesoPromedioKg', etiqueta: 'Peso promedio (kg)', tipo: 'numero', minimo: 0, medio: true, ayuda: 'Si lo dejás vacío se usa el de la categoría' },
      { nombre: 'activo', etiqueta: 'Lote activo', tipo: 'sino' },
      { nombre: 'notas', etiqueta: 'Notas', tipo: 'area' }
    ],
    preguntaEliminar: '¿Eliminar este lote de animales?',
    alEliminar: function (x) {
      return f.asignacionesRacion.some(function (a) { return a.loteConsumoId === x.id && a.activa !== 'false'; })
        ? 'No se puede eliminar: tiene una ración asignada. Finalizala primero.' : null;
    }
  });
}

/* ---------- Categorías animales ---------- */

function pantallaCategorias() {
  marcoForrajes('Categorías animales · Forrajes', 'forrajes', function (f) {
    return (puedeEditar() ? '<button class="boton" onclick="formularioCategoria()">+ Nueva categoría</button>' : '') +
      '<p class="ayuda">Requerimientos de referencia (NRC/INTA). Ajustalos según raza y objetivo productivo.</p>' +
      '<div class="tabla-desplazable"><table class="tabla"><thead><tr><th>Nombre</th><th>MS % PV</th><th>PB % MS</th><th>EM Mcal/kg MS</th><th>Peso ref.</th><th></th></tr></thead><tbody>' +
      f.categoriasAnimales.map(function (c) {
        return '<tr' + (c.activo === 'false' ? ' class="pronostico"' : '') + '><td style="text-align:left;white-space:normal">' + esc(c.nombre) + '</td>' +
          '<td>' + numero(c.requerimientoMsPctPesoVivo) + '</td><td>' + numero(c.requerimientoProteinaBrutaPctMs) + '</td>' +
          '<td>' + numero(c.requerimientoEnergiaMetabolizableMcalKgMs) + '</td><td>' + (c.pesoVivoReferenciaKg ? numero(c.pesoVivoReferenciaKg) + ' kg' : '—') + '</td>' +
          '<td>' + botonEditar('formularioCategoria', c.id) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  });
}

async function formularioCategoria(id) {
  const f = await cargarForrajes();
  const c = id ? f.categoriasAnimalesPorId[id] : null;
  const n = function (nombre, etiqueta) { return { nombre: nombre, etiqueta: etiqueta, tipo: 'numero', requerido: true, minimo: 0, medio: true }; };
  await abrirFormulario({
    tabla: 'CategoriasAnimales',
    titulo: c ? 'Editar categoría' : 'Nueva categoría animal',
    registro: c,
    valores: { activo: 'true' },
    campos: [
      { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true },
      Object.assign(n('requerimientoMsPctPesoVivo', 'Consumo de MS (% del peso vivo)'), { seccion: 'Requerimientos' }),
      n('requerimientoProteinaBrutaPctMs', 'Proteína bruta (% MS)'), n('requerimientoEnergiaMetabolizableMcalKgMs', 'Energía (Mcal/kg MS)'),
      n('requerimientoCalcioPctMs', 'Calcio (% MS)'), n('requerimientoFosforoPctMs', 'Fósforo (% MS)'),
      { nombre: 'pesoVivoReferenciaKg', etiqueta: 'Peso vivo de referencia (kg)', tipo: 'numero', minimo: 0, medio: true },
      { nombre: 'activo', etiqueta: 'Categoría activa', tipo: 'sino' },
      { nombre: 'notas', etiqueta: 'Notas', tipo: 'area' }
    ],
    preguntaEliminar: '¿Eliminar esta categoría?',
    alEliminar: function (cat) {
      return f.raciones.some(function (r) { return r.categoriaId === cat.id; }) || f.lotesConsumo.some(function (l) { return l.categoriaId === cat.id; })
        ? 'No se puede eliminar: la usan raciones o lotes de animales. Podés marcarla como inactiva.' : null;
    }
  });
}
