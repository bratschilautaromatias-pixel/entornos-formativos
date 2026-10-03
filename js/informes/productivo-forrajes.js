/**
 * DASHBOARD E INFORME DE PRODUCCIÓN · FORRAJES (como Informes del programa Forrajes).
 * Dirección: #/productivo/forrajes
 */
const filtroInformeForrajes = { lote: '', especie: '' };

async function datosProductivosForrajes(periodo, conClima) {
  const f = await cargarForrajes();
  const deLote = function (loteId) { return !filtroInformeForrajes.lote || loteId === filtroInformeForrajes.lote; };
  const conEspecie = function (siembraId) {
    return !filtroInformeForrajes.especie || especiesDeSiembra(f, siembraId).some(function (se) { return se.especieId === filtroInformeForrajes.especie; });
  };
  const loteDeCosecha = function (c) { const s = f.siembrasForrajePorId[c.siembraId]; return s ? s.loteId : ''; };

  const cosechas = f.cosechasForraje.filter(function (c) {
    return enPeriodo(c.fecha, periodo) && deLote(loteDeCosecha(c)) && (!filtroInformeForrajes.especie || c.especieId === filtroInformeForrajes.especie);
  });
  const lluvias = f.lluviasManuales.filter(function (r) { return enPeriodo(r.fecha, periodo) && deLote(r.loteId); });
  const muestreos = f.muestreosCrecimiento.filter(function (m) { return deLote(m.loteId); }).sort(function (a, b) { return a.fecha.localeCompare(b.fecha); });
  const siembras = f.siembrasForraje.filter(function (s) {
    if (!deLote(s.loteId) || !conEspecie(s.id)) return false;
    const cosechada = f.cosechasForraje.some(function (c) { return c.siembraId === s.id && enPeriodo(c.fecha, periodo); });
    return enPeriodo(s.fechaSiembra, periodo) || cosechada || (s.estado === 'En crecimiento' && s.fechaSiembra <= periodo.hasta);
  }).sort(function (a, b) { return lugarTexto(f, a.loteId, a.cuadroId).localeCompare(lugarTexto(f, b.loteId, b.cuadroId), 'es', { numeric: true }); });

  // Lluvia por día: la lectura más alta de cada día (todos los lotes reciben la misma lluvia)
  const lluviaPorDia = {};
  lluvias.forEach(function (r) { lluviaPorDia[r.fecha] = Math.max(lluviaPorDia[r.fecha] || 0, Number(r.cantidadMm) || 0); });
  const lluviaMes = {};
  Object.keys(lluviaPorDia).forEach(function (dia) { lluviaMes[dia.slice(0, 7)] = (lluviaMes[dia.slice(0, 7)] || 0) + lluviaPorDia[dia]; });
  const meses = mesesDelPeriodo(periodo.desde, periodo.hasta, cosechas.map(function (c) { return c.fecha; }).concat(Object.keys(lluviaPorDia)));
  const kg = function (c) { return Number(c.cantidadTotalKg) || 0; };
  const kgMes = sumarPorMes(cosechas, 'fecha', kg);

  // Informe por siembra (como el programa Forrajes)
  let clima = null;
  if (conClima && siembras.length) {
    const ubicacion = await ubicacionClima(null);
    const desdeTodo = siembras.reduce(function (m, s) { return s.fechaSiembra < m ? s.fechaSiembra : m; }, hoyTexto());
    clima = await climaHistorico(ubicacion, desdeTodo, hoyTexto());
  }
  const filas = siembras.map(function (s) {
    const cs = f.cosechasForraje.filter(function (c) { return c.siembraId === s.id; });
    const ultima = cs.length ? cs.map(function (c) { return c.fecha; }).sort().pop() : '';
    const hasta = ultima || hoyTexto();
    const manual = f.lluviasManuales.filter(function (r) {
      return r.loteId === s.loteId && (!s.cuadroId || !r.cuadroId || r.cuadroId === s.cuadroId) && r.fecha >= s.fechaSiembra && r.fecha <= hasta;
    });
    const diasClima = clima ? clima.filter(function (d) { return d.fecha >= s.fechaSiembra && d.fecha <= hasta; }) : [];
    const rc = resumenClima(diasClima);
    const rollos = cs.reduce(function (t, c) { return t + (Number(c.cantidadRollos) || 0); }, 0);
    const semilla = especiesDeSiembra(f, s.id).reduce(function (t, se) { return t + (Number(se.cantidadSemillaKg) || 0); }, 0);
    return {
      lote: nombreLote(f, s.loteId), cuadro: f.cuadrosPorId[s.cuadroId] ? 'Cuadro ' + f.cuadrosPorId[s.cuadroId].numero : '',
      especies: resumenEspecies(f, s.id), uso: s.usoPrevisto, estado: s.estado, siembra: s.fechaSiembra, cosecha: ultima,
      diasCiclo: ultima ? diasEntre(s.fechaSiembra, ultima) : null, kg: cs.reduce(function (t, c) { return t + kg(c); }, 0),
      rollos: rollos || null, semilla: semilla || null,
      // Igual que Forrajes: si hay lecturas del pluviómetro se usan; si no, la lluvia del servicio de clima
      lluvia: manual.length ? manual.reduce(function (t, r) { return t + (Number(r.cantidadMm) || 0); }, 0) : rc.lluvia,
      lluviaManual: manual.length > 0, tMax: rc.max, tMin: rc.min
    };
  });

  const proyeccion = proyeccionStock(f).filter(function (p) { return !filtroInformeForrajes.especie || p.especieId === filtroInformeForrajes.especie; });
  const raciones = f.raciones.filter(function (r) { return r.activa !== 'false'; }).map(function (r) {
    const cat = f.categoriasAnimalesPorId[r.categoriaId];
    if (!cat) return null;
    const c = calcularRacion(ingredientesDeRacion(f, r.id), cat, 1, Number(cat.pesoVivoReferenciaKg) || 0);
    return { racion: r.nombre, categoria: cat.nombre, c: c };
  }).filter(Boolean);
  const lotesActivos = f.lotes.filter(function (l) { return l.activo !== 'false' && deLote(l.id); });

  return {
    f: f, periodo: periodo, siembras: siembras, cosechas: cosechas, lluvias: lluvias, muestreos: muestreos, filas: filas,
    meses: meses, kgMes: kgMes, lluviaMes: lluviaMes, proyeccion: proyeccion, raciones: raciones,
    totalKg: cosechas.reduce(function (t, c) { return t + kg(c); }, 0),
    totalRollos: cosechas.reduce(function (t, c) { return t + (Number(c.cantidadRollos) || 0); }, 0),
    totalLluvia: Object.keys(lluviaPorDia).reduce(function (t, d) { return t + lluviaPorDia[d]; }, 0),
    stockTotal: proyeccion.reduce(function (t, p) { return t + p.stockKg; }, 0),
    lotesActivos: lotesActivos.length, hectareas: lotesActivos.reduce(function (t, l) { return t + (Number(l.superficieHa) || 0); }, 0),
    enCrecimiento: f.siembrasForraje.filter(function (s) { return s.estado === 'En crecimiento' && deLote(s.loteId); }).length,
    porEspecie: rankingPor(cosechas, function (c) { return c.especieId ? nombreEspecie(f, c.especieId) : 'Sin especie'; }, kg, 12)
  };
}

function indicadoresForrajes(d) {
  return htmlIndicadores([
    { titulo: 'Lotes activos', valor: String(d.lotesActivos), detalle: numero(d.hectareas) + ' ha' },
    { titulo: 'Siembras en crecimiento', valor: String(d.enCrecimiento), detalle: 'hoy' },
    { titulo: 'Cosechado', valor: numero(d.totalKg) + ' kg', detalle: d.totalRollos ? d.totalRollos + ' rollos/fardos' : d.cosechas.length + ' cosechas', tono: 'ok' },
    { titulo: 'Lluvia', valor: numero(d.totalLluvia) + ' mm', detalle: 'pluviómetro' },
    { titulo: 'Stock de reservas', valor: numero(d.stockTotal) + ' kg', detalle: d.proyeccion.length + ' especies' },
    { titulo: 'Raciones activas', valor: String(d.raciones.length), detalle: 'en uso' }
  ]);
}

function htmlGraficosForrajes(d) {
  const etiquetas = d.meses.map(function (m) { return etiquetaMes(m, d.meses.length > 12); });
  const loteCurva = filtroInformeForrajes.lote;
  const muestreosCurva = loteCurva ? d.muestreos : [];
  return '<div class="grilla-graficos">' +
    graficoBarras(etiquetas, [{ nombre: 'Lluvia', valores: d.meses.map(function (m) { return d.lluviaMes[m] || 0; }), color: '#1565c0' }],
      { titulo: 'Lluvia por mes (mm)' }) +
    graficoBarras(etiquetas, [{ nombre: 'Kg cosechados', valores: d.meses.map(function (m) { return d.kgMes[m] || 0; }), color: '#2e7d32' }],
      { titulo: 'Kilos cosechados por mes' }) +
    graficoRanking(d.porEspecie.map(function (x) { return Object.assign({ texto: numero(x.valor) + ' kg' }, x); }), { titulo: 'Cosechado por especie' }) +
    graficoRanking(d.proyeccion.map(function (p) {
      return { etiqueta: p.nombre, valor: p.stockKg, texto: numero(p.stockKg) + ' kg' + (p.dias !== null ? ' · ' + Math.floor(p.dias) + ' días' : '') };
    }), { titulo: 'Stock de reservas (y días que alcanza)', color: '#8d6e63' }) +
    (loteCurva
      ? (muestreosCurva.length
          ? graficoLinea(muestreosCurva.map(function (m) { return diaMes(m.fecha); }),
              [{ nombre: 'Materia verde', valores: muestreosCurva.map(function (m) { return Number(m.materiaVerdeTotalKg) || 0; }), color: '#2e7d32' }],
              { titulo: 'Curva de materia verde · ' + nombreLote(d.f, loteCurva) + ' (kg)' })
          : envolverGrafico('<p class="ayuda">Todavía no hay muestreos para este lote.</p>', [], { titulo: 'Curva de materia verde' }))
      : envolverGrafico('<p class="ayuda">Elegí un lote arriba para ver su curva de materia verde.</p>', [], { titulo: 'Curva de materia verde' })) +
  '</div>';
}

function tablaSiembrasForrajes(d) {
  return htmlTablaInforme('Informe por siembra (' + d.filas.length + ')',
    ['Lote', 'Cuadro', 'Especies', 'Uso', 'Siembra', 'Cosecha', 'Días', 'Kg', 'Rollos', 'Kg semilla', 'Lluvia mm', 'T. máx', 'T. mín'],
    d.filas.map(function (x) {
      return [x.lote, x.cuadro, x.especies, x.uso, formatearFecha(x.siembra), x.cosecha ? formatearFecha(x.cosecha) : '—', x.diasCiclo === null ? '' : x.diasCiclo,
        numero(x.kg), x.rollos || '', x.semilla ? numero(x.semilla) : '',
        x.lluvia === null ? '' : numero(Math.round(x.lluvia)) + (x.lluviaManual ? '' : ' *'),
        x.tMax === null ? '' : numero(Math.round(x.tMax * 10) / 10) + '°', x.tMin === null ? '' : numero(Math.round(x.tMin * 10) / 10) + '°'];
    }), 'Lluvia del pluviómetro; con * = estimada por el servicio de clima (no había lecturas). Temperaturas promedio del ciclo (se calculan al exportar).');
}

function tablaRaciones(d) {
  return htmlTablaInforme('Cumplimiento de raciones (1 animal de referencia)', ['Ración', 'Categoría', 'MS kg', 'Estado MS', 'PB %', 'Estado PB', 'EM', 'Estado EM'],
    d.raciones.map(function (r) {
      return [r.racion, r.categoria, numero(r.c.ms), r.c.estadoMs, numero(r.c.pb), r.c.estadoPb, numero(r.c.em), r.c.estadoEm];
    }));
}

async function dibujarDashboardForrajes() {
  const lugar = document.getElementById('contenido-informe');
  if (!lugar) return;
  const d = await datosProductivosForrajes(periodoInforme(), false);
  if (!document.getElementById('contenido-informe')) return;
  lugar.innerHTML = '<h1>📊 FORRAJES · PRODUCCIÓN</h1>' +
    htmlSelectorPeriodoInforme() +
    '<div class="filtros">' +
      '<label>Lote<select onchange="filtroInformeForrajes.lote = this.value; alActualizarDatos()"><option value="">Todos</option>' +
        d.f.lotes.map(function (l) { return '<option value="' + esc(l.id) + '"' + (filtroInformeForrajes.lote === l.id ? ' selected' : '') + '>' + esc(l.nombre) + '</option>'; }).join('') +
      '</select></label>' +
      '<label>Especie<select onchange="filtroInformeForrajes.especie = this.value; alActualizarDatos()"><option value="">Todas</option>' +
        d.f.especiesForraje.map(function (e) { return '<option value="' + esc(e.id) + '"' + (filtroInformeForrajes.especie === e.id ? ' selected' : '') + '>' + esc(e.nombre) + '</option>'; }).join('') +
      '</select></label>' +
    '</div>' +
    '<p class="ayuda centrado">' + esc(d.periodo.titulo) + '</p>' +
    htmlBotonesExportar('exportarForrajesExcel', 'exportarForrajesPdf', 'informe de producción') +
    indicadoresForrajes(d) + htmlGraficosForrajes(d) + tablaSiembrasForrajes(d) + tablaRaciones(d);
}

function exportarForrajesExcel(boton) {
  conBotonOcupado(boton, async function () {
    const d = await datosProductivosForrajes(periodoInforme(), true);
    const f = d.f;
    const hojas = [
      { nombre: 'Resumen', encabezado: 3, filas: [
        ['Informe de producción · Forrajes' + (filtroInformeForrajes.lote ? ' · ' + nombreLote(f, filtroInformeForrajes.lote) : '')],
        ['Período: ' + d.periodo.titulo + ' · Generado el ' + formatearFecha(hoyTexto())], [],
        ['Indicador', 'Valor'],
        ['Lotes activos', d.lotesActivos], ['Hectáreas', celdaNumero(d.hectareas)], ['Siembras en crecimiento (hoy)', d.enCrecimiento],
        ['Kg cosechados', celdaNumero(d.totalKg)], ['Rollos / fardos', d.totalRollos], ['Lluvia (mm)', celdaNumero(d.totalLluvia, 1)],
        ['Stock de reservas (kg)', celdaNumero(d.stockTotal)], ['Raciones activas', d.raciones.length]
      ] },
      { nombre: 'Por siembra', encabezado: 1, filas: [['Informe por siembra'],
        ['Lote', 'Cuadro', 'Especies', 'Uso previsto', 'Estado', 'Siembra', 'Última cosecha', 'Días ciclo', 'Kg', 'Rollos', 'Kg semilla',
          'Lluvia (mm)', 'Origen lluvia', 'Temp. máx. prom. (°C)', 'Temp. mín. prom. (°C)']].concat(
        d.filas.map(function (x) {
          return [x.lote, x.cuadro, x.especies, x.uso, x.estado, formatearFecha(x.siembra), x.cosecha ? formatearFecha(x.cosecha) : '', x.diasCiclo === null ? '' : x.diasCiclo,
            celdaNumero(x.kg), x.rollos || '', celdaNumero(x.semilla), celdaNumero(x.lluvia, 1), x.lluvia === null ? '' : (x.lluviaManual ? 'Pluviómetro' : 'Servicio de clima'),
            celdaNumero(x.tMax, 1), celdaNumero(x.tMin, 1)];
        })) },
      { nombre: 'Por especie', encabezado: 1, filas: [['Cosechado por especie'], ['Especie', 'Kg cosechados']].concat(
        d.porEspecie.map(function (x) { return [x.etiqueta, celdaNumero(x.valor)]; })) },
      { nombre: 'Stock', encabezado: 1, filas: [['Stock de reservas'], ['Especie', 'Stock (kg)', 'Consumo (kg/día)', 'Días restantes']].concat(
        d.proyeccion.map(function (p) { return [p.nombre, celdaNumero(p.stockKg), celdaNumero(p.consumoKgDia), p.dias === null ? 'Sin consumo' : Math.floor(p.dias)]; })) },
      { nombre: 'Raciones', encabezado: 1, filas: [['Cumplimiento de raciones (1 animal de referencia)'],
        ['Ración', 'Categoría', 'MS (kg)', 'Estado MS', 'PB %', 'Estado PB', 'EM Mcal/kg MS', 'Estado EM', 'Ca %', 'Estado Ca', 'P %', 'Estado P']].concat(
        d.raciones.map(function (r) {
          return [r.racion, r.categoria, celdaNumero(r.c.ms), r.c.estadoMs, celdaNumero(r.c.pb), r.c.estadoPb, celdaNumero(r.c.em), r.c.estadoEm,
            celdaNumero(r.c.ca), r.c.estadoCa, celdaNumero(r.c.p), r.c.estadoP];
        })) },
      { nombre: 'Lluvias', encabezado: 1, filas: [['Lluvias (pluviómetro)'], ['Fecha', 'Lote', 'Cuadro', 'mm', 'Notas']].concat(
        d.lluvias.slice().sort(function (a, b) { return a.fecha.localeCompare(b.fecha); }).map(function (r) {
          return [formatearFecha(r.fecha), nombreLote(f, r.loteId), f.cuadrosPorId[r.cuadroId] ? 'Cuadro ' + f.cuadrosPorId[r.cuadroId].numero : '', celdaNumero(r.cantidadMm, 1), r.notas];
        })) },
      { nombre: 'Muestreos', encabezado: 1, filas: [['Muestreos de crecimiento'], ['Fecha', 'Lote', 'Cuadro', 'Peso muestra (kg)', 'Superficie muestra (m²)', 'Materia verde total (kg)', 'Notas']].concat(
        d.muestreos.filter(function (m) { return enPeriodo(m.fecha, d.periodo); }).map(function (m) {
          return [formatearFecha(m.fecha), nombreLote(f, m.loteId), f.cuadrosPorId[m.cuadroId] ? 'Cuadro ' + f.cuadrosPorId[m.cuadroId].numero : '',
            celdaNumero(m.pesoMuestraKg), celdaNumero(m.superficieMuestraM2), celdaNumero(m.materiaVerdeTotalKg), m.notas];
        })) },
      { nombre: 'Cosechas', encabezado: 1, filas: [['Cosechas'], ['Fecha', 'Lote / cuadro', 'Especie', 'Aprovechamiento', 'Kg', 'Rollos', 'Peso prom. (kg)', 'Humedad %', 'En stock']].concat(
        d.cosechas.map(function (c) {
          const s = f.siembrasForrajePorId[c.siembraId];
          return [formatearFecha(c.fecha), s ? lugarTexto(f, s.loteId, s.cuadroId) : '', c.especieId ? nombreEspecie(f, c.especieId) : '', c.tipoAprovechamiento,
            celdaNumero(c.cantidadTotalKg), celdaNumero(c.cantidadRollos, 0), celdaNumero(c.pesoPromedioRolloKg), celdaNumero(c.humedadPct), c.ingresadaAInventario === 'true' ? 'Sí' : 'No'];
        })) }
    ];
    descargarArchivo(crearExcel(hojas), nombreArchivo('Informe produccion Forrajes', 'xlsx'));
  });
}

function exportarForrajesPdf(boton) {
  conBotonOcupado(boton, async function () {
    const d = await datosProductivosForrajes(periodoInforme(), true);
    imprimirInforme('Informe de producción · Forrajes' + (filtroInformeForrajes.lote ? ' · ' + nombreLote(d.f, filtroInformeForrajes.lote) : ''), d.periodo.titulo,
      indicadoresForrajes(d) + htmlGraficosForrajes(d) + tablaSiembrasForrajes(d) + tablaRaciones(d) +
      htmlTablaInforme('Stock de reservas', ['Especie', 'Stock (kg)', 'Consumo (kg/día)', 'Días restantes'],
        d.proyeccion.map(function (p) { return [p.nombre, numero(p.stockKg), p.consumoKgDia ? numero(p.consumoKgDia) : '—', p.dias === null ? 'Sin consumo' : Math.floor(p.dias)]; })));
  });
}
