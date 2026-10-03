/**
 * DASHBOARD E INFORME DE PRODUCCIÓN · HUERTA.
 * Dirección: #/productivo/huerta  (el de Forrajes está en productivo-forrajes.js)
 */
const filtroInformeHuerta = { parcela: '' };

PANTALLAS.productivo = function (clave) {
  const entorno = entornoPorClave(clave);
  if (!entorno) return ir('inicio');
  render(htmlBarra('Dashboard de producción · ' + entorno.nombre, 'entorno/' + entorno.clave) +
    '<main class="contenido" id="contenido-informe"><p class="vacio">Cargando…</p></main>');
  alActualizarDatos = clave === 'forrajes' ? dibujarDashboardForrajes : dibujarDashboardHuerta;
  alActualizarDatos();
};

async function datosProductivosHuerta(periodo, conClima) {
  const h = await cargarHuerta();
  const deParcela = function (parcelaId) { return !filtroInformeHuerta.parcela || parcelaId === filtroInformeHuerta.parcela; };
  const siembraDe = function (r) { return h.siembrasPorId[r.siembraId]; };
  const enFiltro = function (r) { const s = siembraDe(r); return s && deParcela(s.parcelaId); };

  const cosechas = h.cosechas.filter(function (c) { return enPeriodo(c.fecha, periodo) && enFiltro(c); });
  const riegos = h.riegos.filter(function (r) { return enPeriodo(r.fecha, periodo) && enFiltro(r); });
  const tratamientos = h.tratamientos.filter(function (t) { return enPeriodo(t.fecha, periodo) && enFiltro(t); });
  const almacigos = h.almacigos.filter(function (a) { return enPeriodo(a.fechaSiembra, periodo); });

  // Siembras con actividad en el período (sembradas, regadas, tratadas o cosechadas en ese lapso, o activas)
  const conActividad = {};
  cosechas.concat(riegos, tratamientos).forEach(function (r) { conActividad[r.siembraId] = true; });
  const siembras = h.siembras.filter(function (s) {
    if (!deParcela(s.parcelaId)) return false;
    return enPeriodo(s.fechaSiembra, periodo) || conActividad[s.id] ||
      (HUERTA.activas.indexOf(s.estado) !== -1 && s.fechaSiembra <= periodo.hasta);
  }).sort(function (a, b) { return descripcionSiembra(h, a).localeCompare(descripcionSiembra(h, b), 'es', { numeric: true }); });

  const kg = function (c) { return Number(c.kg) || 0; };
  const litros = function (r) { return Number(r.litros) || 0; };
  const meses = mesesDelPeriodo(periodo.desde, periodo.hasta, cosechas.concat(riegos, h.lluviasHuerta).map(function (r) { return r.fecha; }));
  const kgMes = sumarPorMes(cosechas, 'fecha', kg);
  const cubierta = function (r) { const s = siembraDe(r); return s && estaBajoCubierta(h, s.parcelaId); };
  const riegosCubierta = riegos.filter(cubierta);
  const riegosAireLibre = riegos.filter(function (r) { return !cubierta(r); });
  const litrosMesCubierta = sumarPorMes(riegosCubierta, 'fecha', litros);
  const litrosMesAireLibre = sumarPorMes(riegosAireLibre, 'fecha', litros);
  // Pluviómetro (parcelas a cielo abierto): la lectura más alta de cada día
  const lluvias = h.lluviasHuerta.filter(function (r) { return enPeriodo(r.fecha, periodo) && deParcela(r.parcelaId) && !estaBajoCubierta(h, r.parcelaId); });
  const lluviaPorDia = {};
  lluvias.forEach(function (r) { lluviaPorDia[r.fecha] = Math.max(lluviaPorDia[r.fecha] || 0, Number(r.cantidadMm) || 0); });
  const lluviaMes = {};
  Object.keys(lluviaPorDia).forEach(function (dia) { lluviaMes[dia.slice(0, 7)] = (lluviaMes[dia.slice(0, 7)] || 0) + lluviaPorDia[dia]; });

  // Ocupación de lomos por parcela (hoy)
  const ocupacion = h.parcelas.filter(function (p) { return p.activa !== 'false' && deParcela(p.id); }).map(function (p) {
    const lomos = h.lomos.filter(function (l) { return l.parcelaId === p.id; });
    const ocupados = lomos.filter(function (l) {
      return h.siembras.some(function (s) { return s.lomoId === l.id && HUERTA.activas.indexOf(s.estado) !== -1; });
    }).length;
    const enUso = h.siembras.some(function (s) { return s.parcelaId === p.id && HUERTA.activas.indexOf(s.estado) !== -1; });
    return { parcela: p.nombre, lomos: lomos.length, ocupados: ocupados, enUso: enUso };
  });
  const totalLomos = ocupacion.reduce(function (t, o) { return t + o.lomos; }, 0);
  const lomosOcupados = ocupacion.reduce(function (t, o) { return t + o.ocupados; }, 0);
  const germinaciones = almacigos.map(porcentajeGerminacion).filter(function (g) { return g !== null; });

  // Informe completo por siembra (como Surco)
  let climaPorUbicacion = {};
  const filas = [];
  for (const s of siembras) {
    const cs = h.cosechas.filter(function (c) { return c.siembraId === s.id; });
    const rs = h.riegos.filter(function (r) { return r.siembraId === s.id; });
    const ts = h.tratamientos.filter(function (t) { return t.siembraId === s.id; }).sort(function (a, b) { return a.fecha.localeCompare(b.fecha); });
    const ultimaCosecha = cs.length ? cs.map(function (c) { return c.fecha; }).sort().pop() : '';
    // El ciclo dura hasta hoy mientras la siembra siga activa; si terminó, hasta su última cosecha
    const hasta = HUERTA.activas.indexOf(s.estado) !== -1 || !ultimaCosecha ? hoyTexto() : ultimaCosecha;
    const suelo = h.analisisSuelo.filter(function (a) {
      return a.parcelaId === s.parcelaId && (!a.lomoId || a.lomoId === s.lomoId) && a.fecha >= s.fechaSiembra && a.fecha <= hasta;
    }).sort(function (a, b) { return a.fecha.localeCompare(b.fecha); });
    const parcela = h.parcelasPorId[s.parcelaId] || {};
    const bajoCubierta = parcela.bajoCubierta === 'true';
    let diasClima = null;
    const tienePluviometro = h.lluviasHuerta.some(function (r) { return r.parcelaId === s.parcelaId && r.fecha >= s.fechaSiembra && r.fecha <= hasta; });
    if (!bajoCubierta && !tienePluviometro && conClima) {
      const ubicacion = await ubicacionClima(parcela);
      const claveUb = ubicacion.latitud + ',' + ubicacion.longitud;
      if (!(claveUb in climaPorUbicacion)) {
        const desdeTodo = h.siembras.reduce(function (m, x) { return x.fechaSiembra < m ? x.fechaSiembra : m; }, hoyTexto());
        climaPorUbicacion[claveUb] = await climaHistorico(ubicacion, desdeTodo, hoyTexto());
      }
      diasClima = climaPorUbicacion[claveUb];
    }
    const lluvia = lluviaParcela(h, s.parcelaId, s.fechaSiembra, hasta, diasClima);
    const totalKg = cs.reduce(function (t, c) { return t + kg(c); }, 0);
    const almacigo = h.almacigosPorId[s.almacigoId];
    filas.push({
      siembra: s, origen: nombreParcela(h, s.parcelaId) + (h.lomosPorId[s.lomoId] ? ' · Lomo ' + h.lomosPorId[s.lomoId].numero : ''),
      cultivo: nombreCultivo(h, s.cultivoId),
      almacigo: almacigo ? nombreCultivo(h, almacigo.cultivoId) + ' ' + formatearFecha(almacigo.fechaSiembra) : '',
      fechaSiembra: s.fechaSiembra, ultimaCosecha: ultimaCosecha,
      diasCiclo: ultimaCosecha ? diasEntre(s.fechaSiembra, ultimaCosecha) : null,
      plantas: Number(s.cantidadPlantas) || null, kg: totalKg,
      kgPlanta: totalKg && Number(s.cantidadPlantas) ? totalKg / Number(s.cantidadPlantas) : null,
      kgM2: totalKg && superficieSiembraM2(h, s) ? totalKg / superficieSiembraM2(h, s) : null,
      terminada: cs.some(function (c) { return c.cosechaTerminada === 'true'; }),
      tipo: bajoCubierta ? 'Bajo cubierta' : 'Aire libre',
      lluvia: lluvia.mm, lluviaFuente: lluvia.fuente,
      riegoLitros: rs.reduce(function (t, r) { return t + litros(r); }, 0),
      riegoMm: rs.reduce(function (t, r) { return t + (Number(r.laminaMm) || 0); }, 0),
      aguaTotalMm: (lluvia.mm || 0) + rs.reduce(function (t, r) { return t + (Number(r.laminaMm) || 0); }, 0),
      phInicial: suelo.length ? suelo[0].ph : '', phFinal: suelo.length ? suelo[suelo.length - 1].ph : '',
      ceInicial: suelo.length ? suelo[0].conductividad : '', ceFinal: suelo.length ? suelo[suelo.length - 1].conductividad : '',
      tratamientos: ts.map(function (t) { return t.producto + ' (' + diaMes(t.fecha) + ')'; }).join('; ') || '—',
      estado: s.estado
    });
  }

  return {
    h: h, periodo: periodo, siembras: siembras, cosechas: cosechas, riegos: riegos, tratamientos: tratamientos, almacigos: almacigos,
    filas: filas, meses: meses, kgMes: kgMes, ocupacion: ocupacion,
    riegosCubierta: riegosCubierta, riegosAireLibre: riegosAireLibre, lluvias: lluvias,
    litrosMesCubierta: litrosMesCubierta, litrosMesAireLibre: litrosMesAireLibre, lluviaMes: lluviaMes,
    totalKg: cosechas.reduce(function (t, c) { return t + kg(c); }, 0),
    litrosCubierta: riegosCubierta.reduce(function (t, r) { return t + litros(r); }, 0),
    litrosAireLibre: riegosAireLibre.reduce(function (t, r) { return t + litros(r); }, 0),
    totalLluvia: Object.keys(lluviaPorDia).reduce(function (t, d) { return t + lluviaPorDia[d]; }, 0),
    diasConLluvia: Object.keys(lluviaPorDia).length,
    activas: h.siembras.filter(function (s) { return HUERTA.activas.indexOf(s.estado) !== -1 && deParcela(s.parcelaId); }).length,
    ocupacionPct: totalLomos ? Math.round(lomosOcupados * 100 / totalLomos) : null,
    lomosOcupados: lomosOcupados, totalLomos: totalLomos,
    germinacionPromedio: germinaciones.length ? germinaciones.reduce(function (t, g) { return t + g; }, 0) / germinaciones.length : null,
    porCultivo: rankingPor(cosechas, function (c) { const s = siembraDe(c); return s ? nombreCultivo(h, s.cultivoId) : ''; }, kg, 12),
    porEstado: rankingPor(siembras, function (s) { return s.estado; }, function () { return 1; }, 6)
  };
}

function indicadoresHuerta(d) {
  return htmlIndicadores([
    { titulo: 'Siembras activas', valor: String(d.activas), detalle: 'hoy' },
    { titulo: 'Cosechado', valor: numero(d.totalKg) + ' kg', detalle: d.cosechas.length + ' cosechas', tono: 'ok' },
    { titulo: '🏠 Riego bajo cubierta', valor: numero(Math.round(d.litrosCubierta)) + ' L', detalle: contarRiegos(d.riegosCubierta) + ' riegos (goteo)' },
    { titulo: '☀ Lluvia a cielo abierto', valor: numero(d.totalLluvia) + ' mm', detalle: d.diasConLluvia + ' días (pluviómetro)' },
    { titulo: '☀ Riego a cielo abierto', valor: numero(Math.round(d.litrosAireLibre)) + ' L', detalle: contarRiegos(d.riegosAireLibre) + ' riegos' },
    { titulo: 'Tratamientos', valor: String(d.tratamientos.length), detalle: 'aplicaciones' },
    { titulo: 'Ocupación de lomos', valor: d.ocupacionPct === null ? '—' : d.ocupacionPct + '%', detalle: d.lomosOcupados + ' de ' + d.totalLomos + ' lomos' },
    { titulo: 'Germinación', valor: d.germinacionPromedio === null ? '—' : numero(d.germinacionPromedio) + '%', detalle: 'promedio de ' + d.almacigos.length + ' almácigos' }
  ]);
}

function htmlGraficosHuerta(d) {
  const etiquetas = d.meses.map(function (m) { return etiquetaMes(m, d.meses.length > 12); });
  return '<div class="grilla-graficos">' +
    graficoBarras(etiquetas, [{ nombre: 'Kg cosechados', valores: d.meses.map(function (m) { return d.kgMes[m] || 0; }), color: '#2e7d32' }],
      { titulo: 'Kilos cosechados por mes' }) +
    graficoRanking(d.porCultivo.map(function (x) { return Object.assign({ texto: numero(x.valor) + ' kg' }, x); }), { titulo: 'Kilos por cultivo' }) +
    graficoBarras(etiquetas, [
      { nombre: 'Bajo cubierta (goteo)', valores: d.meses.map(function (m) { return d.litrosMesCubierta[m] || 0; }), color: '#6a1b9a' },
      { nombre: 'Cielo abierto', valores: d.meses.map(function (m) { return d.litrosMesAireLibre[m] || 0; }), color: '#1565c0' }
    ], { titulo: 'Agua de riego por mes (litros)' }) +
    graficoBarras(etiquetas, [{ nombre: 'Lluvia', valores: d.meses.map(function (m) { return d.lluviaMes[m] || 0; }), color: '#00838f' }],
      { titulo: 'Lluvia por mes a cielo abierto (mm, pluviómetro)', nota: 'Las parcelas bajo cubierta no reciben lluvia: su agua es solo el riego.' }) +
    graficoRanking(d.ocupacion.map(function (o) {
      if (!o.lomos) return { etiqueta: o.parcela, valor: o.enUso ? 100 : 0, texto: o.enUso ? 'en uso (sin lomos)' : 'libre (sin lomos)' };
      return { etiqueta: o.parcela, valor: o.ocupados / o.lomos * 100, texto: o.ocupados + '/' + o.lomos + ' lomos' };
    }), { titulo: 'Ocupación de lomos por parcela (hoy)', color: '#6a1b9a' }) +
    graficoRanking(d.porEstado.map(function (x) { return Object.assign({ texto: x.valor + ' siembras' }, x); }), { titulo: 'Siembras por estado', color: '#00838f' }) +
  '</div>';
}

function tablaSiembrasHuerta(d, paraPdf) {
  return htmlTablaInforme('Informe completo por siembra (' + d.filas.length + ')',
    ['Origen', 'Tipo', 'Cultivo', 'Siembra', 'Cosecha', 'Días', 'Plantas', 'Kg', 'Kg/planta', 'Lluvia del ciclo mm', 'Riego L', 'Riego mm', 'Agua total mm', 'pH ini/fin', 'Tratamientos'],
    d.filas.map(function (f) {
      return [f.origen, f.tipo === 'Bajo cubierta' ? '🏠 Cubierta' : '☀ Aire libre', f.cultivo, formatearFecha(f.fechaSiembra), f.ultimaCosecha ? formatearFecha(f.ultimaCosecha) + (f.terminada ? ' ✓' : '') : '—',
        f.diasCiclo === null ? '' : f.diasCiclo, f.plantas || '', numero(f.kg), f.kgPlanta === null ? '' : numero(f.kgPlanta),
        f.lluviaFuente === 'Bajo cubierta' ? '—' : f.lluvia === null ? (paraPdf ? 'sin datos' : '') : numero(Math.round(f.lluvia)) + (f.lluviaFuente === 'Servicio de clima' ? ' *' : ''),
        numero(Math.round(f.riegoLitros)), numero(f.riegoMm), numero(Math.round(f.aguaTotalMm)),
        [f.phInicial, f.phFinal].filter(Boolean).join(' / '), f.tratamientos];
    }), 'Una fila por siembra: ciclo (siembra → última cosecha), kilos, lluvia y riego acumulados, pH del período y tratamientos. ✓ = cosecha terminada. ' +
      'Bajo cubierta el agua es solo el riego por goteo. Lluvia del pluviómetro; con * = estimada por el servicio de clima (no había lecturas).');
}

async function dibujarDashboardHuerta() {
  const lugar = document.getElementById('contenido-informe');
  if (!lugar) return;
  const d = await datosProductivosHuerta(periodoInforme(), false);
  if (!document.getElementById('contenido-informe')) return;
  lugar.innerHTML = '<h1>📊 HUERTA · PRODUCCIÓN</h1>' +
    htmlSelectorPeriodoInforme() +
    '<label>Parcela<select onchange="filtroInformeHuerta.parcela = this.value; alActualizarDatos()"><option value="">Todas</option>' +
      d.h.parcelas.map(function (p) { return '<option value="' + esc(p.id) + '"' + (filtroInformeHuerta.parcela === p.id ? ' selected' : '') + '>' + esc(p.nombre) + '</option>'; }).join('') +
    '</select></label>' +
    '<p class="ayuda centrado">' + esc(d.periodo.titulo) + '</p>' +
    htmlBotonesExportar('exportarHuertaExcel', 'exportarHuertaPdf', 'informe de producción', 'tablero/productivo/huerta', 'Tablero productivo') +
    indicadoresHuerta(d) + htmlGraficosHuerta(d) +
    tablaSiembrasHuerta(d, false) +
    '<p class="ayuda">La lluvia de cada siembra se calcula al exportar el informe (necesita internet la primera vez).</p>';
}

function exportarHuertaExcel(boton) {
  conBotonOcupado(boton, async function () {
    const d = await datosProductivosHuerta(periodoInforme(), true);
    const h = d.h;
    const parcela = filtroInformeHuerta.parcela ? ' · ' + nombreParcela(h, filtroInformeHuerta.parcela) : '';
    const desc = function (r) { const s = h.siembrasPorId[r.siembraId]; return s ? descripcionSiembra(h, s, false) : ''; };
    const hojas = [
      { nombre: 'Resumen', encabezado: 3, filas: [
        ['Informe de producción · Huerta' + parcela], ['Período: ' + d.periodo.titulo + ' · Generado el ' + formatearFecha(hoyTexto())], [],
        ['Indicador', 'Valor'],
        ['Siembras activas (hoy)', d.activas], ['Kg cosechados', celdaNumero(d.totalKg)], ['Cantidad de cosechas', d.cosechas.length],
        ['Riego bajo cubierta (L)', celdaNumero(d.litrosCubierta, 0)], ['Riegos bajo cubierta', contarRiegos(d.riegosCubierta)],
        ['Riego a cielo abierto (L)', celdaNumero(d.litrosAireLibre, 0)], ['Riegos a cielo abierto', contarRiegos(d.riegosAireLibre)],
        ['Lluvia a cielo abierto (mm, pluviómetro)', celdaNumero(d.totalLluvia, 1)], ['Días con lluvia', d.diasConLluvia],
        ['Tratamientos aplicados', d.tratamientos.length],
        ['Lomos ocupados (hoy)', d.lomosOcupados + ' de ' + d.totalLomos], ['Germinación promedio (%)', celdaNumero(d.germinacionPromedio, 1)]
      ] },
      { nombre: 'Por siembra', encabezado: 1, filas: [['Informe completo por siembra'],
        ['Origen', 'Tipo', 'Cultivo', 'Almácigo de origen', 'Siembra', 'Última cosecha', 'Días ciclo', 'Estado', 'Plantas', 'Kg', 'Kg/planta', 'Kg/m²', 'Terminada',
          'Lluvia del ciclo (mm)', 'Origen lluvia', 'Riego (L)', 'Riego (mm)', 'Agua total (mm)', 'pH inicial', 'pH final', 'CE inicial', 'CE final', 'Tratamientos']].concat(
        d.filas.map(function (f) {
          return [f.origen, f.tipo, f.cultivo, f.almacigo, formatearFecha(f.fechaSiembra), f.ultimaCosecha ? formatearFecha(f.ultimaCosecha) : '', f.diasCiclo === null ? '' : f.diasCiclo,
            f.estado, f.plantas || '', celdaNumero(f.kg), celdaNumero(f.kgPlanta, 3), celdaNumero(f.kgM2, 2), f.terminada ? 'Sí' : 'No',
            f.lluvia === null ? '' : celdaNumero(f.lluvia, 1), f.lluviaFuente || 'sin datos', celdaNumero(f.riegoLitros, 0), celdaNumero(f.riegoMm, 1), celdaNumero(f.aguaTotalMm, 1),
            celdaNumero(f.phInicial), celdaNumero(f.phFinal), celdaNumero(f.ceInicial), celdaNumero(f.ceFinal), f.tratamientos];
        })) },
      { nombre: 'Por cultivo', encabezado: 1, filas: [['Rendimiento por cultivo'], ['Cultivo', 'Kg cosechados']].concat(
        d.porCultivo.map(function (x) { return [x.etiqueta, celdaNumero(x.valor)]; })) },
      { nombre: 'Cosechas', encabezado: 1, filas: [['Cosechas'], ['Fecha', 'Siembra', 'Kg', 'Terminada', 'Calidad', 'Notas']].concat(
        d.cosechas.map(function (c) { return [formatearFecha(c.fecha), desc(c), celdaNumero(c.kg), c.cosechaTerminada === 'true' ? 'Sí' : 'No', c.calidad, c.notas]; })) },
      { nombre: 'Riegos', encabezado: 1, filas: [['Riegos'], ['Fecha', 'Siembra', 'Tipo de parcela', 'Método', 'Litros', 'mm', 'Riego de toda la parcela', 'Notas']].concat(
        d.riegos.map(function (r) {
          const s = h.siembrasPorId[r.siembraId];
          return [formatearFecha(r.fecha), desc(r), s && estaBajoCubierta(h, s.parcelaId) ? 'Bajo cubierta' : 'Aire libre', r.metodo,
            celdaNumero(r.litros), celdaNumero(r.laminaMm), r.grupoId ? 'Sí' : '', r.notas];
        })) },
      { nombre: 'Lluvias', encabezado: 1, filas: [['Lluvias a cielo abierto (pluviómetro)'], ['Fecha', 'Parcela', 'mm', 'Notas']].concat(
        d.lluvias.slice().sort(function (a, b) { return a.fecha.localeCompare(b.fecha); }).map(function (r) {
          return [formatearFecha(r.fecha), nombreParcela(h, r.parcelaId), celdaNumero(r.cantidadMm, 1), r.notas];
        })) },
      { nombre: 'Tratamientos', encabezado: 1, filas: [['Tratamientos'], ['Fecha', 'Siembra', 'Producto', 'Tipo', 'Dosis', 'Unidad', 'Carencia (días)', 'Fin de carencia', 'Costo ($)']].concat(
        d.tratamientos.map(function (t) { return [formatearFecha(t.fecha), desc(t), t.producto, t.tipo, celdaNumero(t.dosis), t.unidadDosis, celdaNumero(t.carenciaDias, 0), finCarencia(t) ? formatearFecha(finCarencia(t)) : '', celdaNumero(t.costo)]; })) },
      { nombre: 'Germinación', encabezado: 1, filas: [['Germinación de almácigos'], ['Cultivo', 'Fecha siembra', 'Bandeja', 'Total celdas', 'Día 7', 'Día 10', 'Día 14', '% Germinación', 'Estado']].concat(
        d.almacigos.map(function (a) {
          return [nombreCultivo(h, a.cultivoId), formatearFecha(a.fechaSiembra), a.tipoBandeja, (Number(a.cantidadCeldas) || 0) * (Number(a.cantidadBandejas) || 1),
            celdaNumero(a.germinadasDia7, 0), celdaNumero(a.germinadasDia10, 0), celdaNumero(a.germinadasDia14, 0), celdaNumero(porcentajeGerminacion(a), 1), a.estado];
        })) }
    ];
    descargarArchivo(crearExcel(hojas), nombreArchivo('Informe produccion Huerta', 'xlsx'));
  });
}

function exportarHuertaPdf(boton) {
  conBotonOcupado(boton, async function () {
    const d = await datosProductivosHuerta(periodoInforme(), true);
    const h = d.h;
    imprimirInforme('Informe de producción · Huerta' + (filtroInformeHuerta.parcela ? ' · ' + nombreParcela(h, filtroInformeHuerta.parcela) : ''), d.periodo.titulo,
      indicadoresHuerta(d) + htmlGraficosHuerta(d) + tablaSiembrasHuerta(d, true) +
      htmlTablaInforme('Rendimiento por cultivo', ['Cultivo', 'Kg'], d.porCultivo.map(function (x) { return [x.etiqueta, numero(x.valor)]; })) +
      htmlTablaInforme('Germinación de almácigos', ['Cultivo', 'Siembra', 'Celdas', 'Día 7', 'Día 10', 'Día 14', '%'],
        d.almacigos.map(function (a) {
          const pct = porcentajeGerminacion(a);
          return [nombreCultivo(h, a.cultivoId), formatearFecha(a.fechaSiembra), (Number(a.cantidadCeldas) || 0) * (Number(a.cantidadBandejas) || 1),
            a.germinadasDia7, a.germinadasDia10, a.germinadasDia14, pct === null ? '' : numero(pct) + '%'];
        })) +
      htmlTablaInforme('Tratamientos (' + d.tratamientos.length + ')', ['Fecha', 'Siembra', 'Producto', 'Tipo', 'Carencia hasta'],
        d.tratamientos.map(function (t) {
          const s = h.siembrasPorId[t.siembraId];
          return [formatearFecha(t.fecha), s ? descripcionSiembra(h, s, false) : '', t.producto, t.tipo, finCarencia(t) ? formatearFecha(finCarencia(t)) : ''];
        }))
    );
  });
}
