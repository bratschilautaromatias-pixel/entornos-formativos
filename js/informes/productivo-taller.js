/**
 * DASHBOARD E INFORME DE PRODUCCIÓN · TALLER RURAL: proyectos, pedidos de los entornos, materiales y préstamos.
 * Dirección: #/productivo/taller
 */
async function datosProductivosTaller(periodo) {
  const t = await cargarTaller();
  const fechaPedido = function (p) { return fechaLocal(p.creadoEn); };
  const proyectos = t.proyectosTaller.filter(function (p) {
    // Los que tuvieron actividad en el período: empezaron, terminaron o seguían en curso
    const inicio = p.fechaInicio || fechaLocal(p.creadoEn);
    const fin = p.fechaFin || '9999-12-31';
    return inicio <= periodo.hasta && fin >= periodo.desde && p.estado !== 'Suspendido';
  }).sort(function (a, b) { return String(a.fechaInicio).localeCompare(String(b.fechaInicio)); });
  const terminados = t.proyectosTaller.filter(function (p) { return p.estado === 'Terminado' && enPeriodo(p.fechaFin, periodo); });
  const pedidos = t.pedidosTaller.filter(function (p) { return enPeriodo(fechaPedido(p), periodo); })
    .sort(function (a, b) { return fechaPedido(a).localeCompare(fechaPedido(b)); });
  const atendidos = t.pedidosTaller.filter(function (p) { return p.estado === 'Hecho' && enPeriodo(p.fechaHecho, periodo); });
  const demoras = atendidos.map(function (p) { return diasEntre(fechaPedido(p), p.fechaHecho); }).filter(function (d) { return d >= 0; });
  const movimientos = t.movimientosMaterial.filter(function (mv) { return enPeriodo(mv.fecha, periodo); });
  const compras = movimientos.filter(function (mv) { return mv.tipo === 'Entrada'; });
  const usos = movimientos.filter(function (mv) { return mv.tipo === 'Salida'; });
  const costoUso = function (mv) { const u = costoUnitarioMaterial(t, mv.materialId); return u === null ? 0 : u * (Number(mv.cantidad) || 0); };
  const prestamos = t.prestamosHerramienta.filter(function (p) { return enPeriodo(p.fechaSalida, periodo); });
  const meses = mesesDelPeriodo(periodo.desde, periodo.hasta, pedidos.map(fechaPedido).concat(movimientos.map(function (m) { return m.fecha; })));
  return {
    t: t, periodo: periodo, proyectos: proyectos, terminados: terminados, pedidos: pedidos, atendidos: atendidos,
    demoraPromedio: demoras.length ? demoras.reduce(function (s, d) { return s + d; }, 0) / demoras.length : null,
    pendientesHoy: t.pedidosTaller.filter(function (p) { return p.estado === 'Pendiente' || !p.estado; }),
    enCursoHoy: t.proyectosTaller.filter(function (p) { return p.estado === 'En curso'; }),
    compras: compras, usos: usos, prestamos: prestamos, meses: meses,
    totalCompras: compras.reduce(function (s, mv) { return s + (Number(mv.costo) || 0); }, 0),
    totalUsado: usos.reduce(function (s, mv) { return s + costoUso(mv); }, 0),
    sinDevolver: t.prestamosHerramienta.filter(function (p) { return !p.fechaDevolucion; }),
    bajos: bajoMinimo(t),
    pedidosMes: sumarPorMes(pedidos.map(function (p) { return { fecha: fechaPedido(p) }; }), 'fecha', function () { return 1; }),
    porEntorno: rankingPor(pedidos, function (p) { return p.entorno; }, function () { return 1; }, 6),
    materialesUsados: rankingPor(usos, function (mv) { return nombreMaterial(t, mv.materialId); }, costoUso, 10),
    herramientasPrestadas: rankingPor(prestamos, function (p) { return nombreHerramienta(t, p.herramientaId); }, function (p) { return Number(p.cantidad) || 1; }, 10),
    costoUso: costoUso
  };
}

function indicadoresTaller(d) {
  return htmlIndicadores([
    { titulo: 'Proyectos terminados', valor: String(d.terminados.length), detalle: d.enCursoHoy.length + ' en curso hoy', tono: 'ok' },
    { titulo: 'Pedidos recibidos', valor: String(d.pedidos.length), detalle: d.atendidos.length + ' atendidos en el período' },
    { titulo: 'Demora promedio', valor: d.demoraPromedio === null ? '—' : numero(Math.round(d.demoraPromedio)) + ' días', detalle: 'del pedido a hecho' },
    { titulo: 'Pedidos pendientes', valor: String(d.pendientesHoy.length), detalle: 'hoy', tono: d.pendientesHoy.length ? 'mal' : 'ok' },
    { titulo: 'Compras de materiales', valor: pesos(d.totalCompras), detalle: d.compras.length + (d.compras.length === 1 ? ' entrada' : ' entradas') },
    { titulo: 'Materiales usados', valor: pesos(d.totalUsado), detalle: 'valor estimado' },
    { titulo: 'Préstamos', valor: String(d.prestamos.length), detalle: d.sinDevolver.length + ' sin devolver hoy', tono: d.sinDevolver.length ? 'mal' : '' }
  ]);
}

function htmlGraficosTaller(d) {
  const etiquetas = d.meses.map(function (m) { return etiquetaMes(m, d.meses.length > 12); });
  const conTexto = function (lista, sufijo, enPesos) {
    return lista.map(function (x) { return Object.assign({ texto: enPesos ? pesos(x.valor) : numero(x.valor) + sufijo }, x); });
  };
  return '<div class="grilla-graficos">' +
    graficoBarras(etiquetas, [{ nombre: 'Pedidos', valores: d.meses.map(function (m) { return d.pedidosMes[m] || 0; }), color: '#2e7d32' }], { titulo: 'Pedidos recibidos por mes' }) +
    graficoRanking(conTexto(d.porEntorno, ' pedidos'), { titulo: 'Pedidos por entorno', color: '#1565c0' }) +
    graficoRanking(conTexto(d.materialesUsados, '', true), { titulo: 'Materiales usados (valor estimado)', color: '#9a6431' }) +
    graficoRanking(conTexto(d.herramientasPrestadas, ''), { titulo: 'Herramientas más prestadas', color: '#00838f' }) +
  '</div>';
}

function tablasTaller(d) {
  const t = d.t;
  return htmlTablaInforme('Proyectos del período (' + d.proyectos.length + ')', ['Proyecto', 'Tipo', 'Para', 'Curso', 'Inicio', 'Fin', 'Estado', 'Avance', 'Materiales $'],
      d.proyectos.map(function (p) {
        const costo = materialesDeProyecto(t, p.id).reduce(function (s, m) { return s + (m.costo || 0); }, 0);
        return [p.nombre, p.tipo, p.destino, t.cursos[p.cursoId] || '', formatearFecha(p.fechaInicio), formatearFecha(p.fechaFin), p.estado, avanceProyecto(t, p) + '%', costo ? pesos(costo) : ''];
      })) +
    htmlTablaInforme('Pedidos de los entornos (' + d.pedidos.length + ')', ['Pedido', 'Entorno', 'Tipo', 'Prioridad', 'Estado', 'Pedido el', 'Hecho el'],
      d.pedidos.map(function (p) {
        return [p.titulo, p.entorno, p.tipo, p.prioridad, p.estado || 'Pendiente', formatearFecha(fechaLocal(p.creadoEn)), formatearFecha(p.fechaHecho)];
      })) +
    htmlTablaInforme('Uso de materiales (' + d.usos.length + ')', ['Fecha', 'Material', 'Cantidad', 'Proyecto', 'Valor estimado'],
      d.usos.map(function (mv) {
        const m = t.materialesTallerPorId[mv.materialId];
        const valor = d.costoUso(mv);
        return [formatearFecha(mv.fecha), nombreMaterial(t, mv.materialId), cantidadMaterialTexto(mv.cantidad, m), nombreProyecto(t, mv.proyectoId), valor ? pesos(valor) : ''];
      })) +
    htmlTablaInforme('Préstamos de herramientas (' + d.prestamos.length + ')', ['Salida', 'Herramienta', 'Cantidad', 'Quién', 'Curso', 'Devuelta'],
      d.prestamos.map(function (p) {
        return [formatearFecha(p.fechaSalida), nombreHerramienta(t, p.herramientaId), p.cantidad, p.persona, t.cursos[p.cursoId] || '',
          p.fechaDevolucion ? formatearFecha(p.fechaDevolucion) + (p.estadoDevolucion && p.estadoDevolucion !== 'Buena' ? ' (' + p.estadoDevolucion.toLowerCase() + ')' : '') : 'No'];
      }));
}

async function dibujarDashboardTaller() {
  const lugar = document.getElementById('contenido-informe');
  if (!lugar) return;
  const d = await datosProductivosTaller(periodoInforme());
  if (!document.getElementById('contenido-informe')) return;
  lugar.innerHTML = '<h1>📊 TALLER RURAL · PRODUCCIÓN</h1>' +
    htmlSelectorPeriodoInforme() +
    '<p class="ayuda centrado">' + esc(d.periodo.titulo) + '</p>' +
    htmlBotonesExportar('exportarTallerExcel', 'exportarTallerPdf', 'informe de producción') +
    indicadoresTaller(d) + htmlGraficosTaller(d) + tablasTaller(d);
}

function exportarTallerExcel(boton) {
  conBotonOcupado(boton, async function () {
    const d = await datosProductivosTaller(periodoInforme());
    const t = d.t;
    const hojas = [
      { nombre: 'Resumen', encabezado: 3, filas: [
        ['Informe de producción · Taller rural'], ['Período: ' + d.periodo.titulo + ' · Generado el ' + formatearFecha(hoyTexto())], [],
        ['Indicador', 'Valor'],
        ['Proyectos terminados', d.terminados.length], ['Proyectos en curso (hoy)', d.enCursoHoy.length],
        ['Pedidos recibidos', d.pedidos.length], ['Pedidos atendidos', d.atendidos.length], ['Demora promedio (días)', celdaNumero(d.demoraPromedio, 0)],
        ['Pedidos pendientes (hoy)', d.pendientesHoy.length], ['Compras de materiales ($)', celdaNumero(d.totalCompras)],
        ['Materiales usados, valor estimado ($)', celdaNumero(d.totalUsado)], ['Préstamos de herramientas', d.prestamos.length],
        ['Préstamos sin devolver (hoy)', d.sinDevolver.length], ['Materiales en el mínimo (hoy)', d.bajos.length]
      ] },
      { nombre: 'Proyectos', encabezado: 1, filas: [['Proyectos'], ['Proyecto', 'Tipo', 'Para', 'Curso', 'Inicio', 'Fin', 'Estado', 'Avance (%)', 'Guía', 'Materiales ($)']].concat(
        d.proyectos.map(function (p) {
          return [p.nombre, p.tipo, p.destino, t.cursos[p.cursoId] || '', formatearFecha(p.fechaInicio), formatearFecha(p.fechaFin), p.estado,
            avanceProyecto(t, p), p.guia, celdaNumero(materialesDeProyecto(t, p.id).reduce(function (s, m) { return s + (m.costo || 0); }, 0))];
        })) },
      { nombre: 'Pedidos', encabezado: 1, filas: [['Pedidos de los entornos'], ['Pedido', 'Entorno', 'Quién', 'Tipo', 'Prioridad', 'Estado', 'Pedido el', 'Hecho el', 'Detalle']].concat(
        d.pedidos.map(function (p) {
          return [p.titulo, p.entorno, p.solicitante, p.tipo, p.prioridad, p.estado || 'Pendiente', formatearFecha(fechaLocal(p.creadoEn)), formatearFecha(p.fechaHecho), p.descripcion];
        })) },
      { nombre: 'Materiales', encabezado: 1, filas: [['Movimientos de materiales'], ['Fecha', 'Material', 'Tipo', 'Cantidad', 'Unidad', 'Proyecto', 'Costo ($)', 'Proveedor', 'Notas']].concat(
        d.compras.concat(d.usos).sort(function (a, b) { return a.fecha.localeCompare(b.fecha); }).map(function (mv) {
          const m = t.materialesTallerPorId[mv.materialId];
          return [formatearFecha(mv.fecha), nombreMaterial(t, mv.materialId), mv.tipo, celdaNumero(mv.cantidad), m ? m.unidad : '', nombreProyecto(t, mv.proyectoId),
            celdaNumero(mv.costo), mv.proveedor, mv.notas];
        })) },
      { nombre: 'Stock hoy', encabezado: 1, filas: [['Stock de materiales (hoy)'], ['Material', 'Tipo', 'Stock', 'Unidad', 'Mínimo', 'Precio promedio ($)', 'Dónde']].concat(
        t.materialesTaller.filter(function (m) { return m.activo !== 'false'; }).map(function (m) {
          return [m.nombre, m.categoria, celdaNumero(stockMaterial(t, m.id), 2), m.unidad, celdaNumero(m.stockMinimo), celdaNumero(costoUnitarioMaterial(t, m.id)), m.ubicacion];
        })) },
      { nombre: 'Pañol', encabezado: 1, filas: [['Préstamos de herramientas'], ['Salida', 'Herramienta', 'Cantidad', 'Quién', 'Curso', 'Para', 'Devuelta', 'Cómo volvió']].concat(
        d.prestamos.map(function (p) {
          return [formatearFecha(p.fechaSalida), nombreHerramienta(t, p.herramientaId), celdaNumero(p.cantidad, 0), p.persona, t.cursos[p.cursoId] || '', p.destino,
            formatearFecha(p.fechaDevolucion), p.estadoDevolucion];
        })) }
    ];
    descargarArchivo(crearExcel(hojas), nombreArchivo('Informe Taller rural', 'xlsx'));
  });
}

function exportarTallerPdf(boton) {
  conBotonOcupado(boton, async function () {
    const d = await datosProductivosTaller(periodoInforme());
    imprimirInforme('Informe de producción · Taller rural', d.periodo.titulo, indicadoresTaller(d) + htmlGraficosTaller(d) + tablasTaller(d));
  });
}

/* ---------- Informe escrito ---------- */

async function redactarProductivoTaller(periodo) {
  const d = await datosProductivosTaller(periodo);
  const t = d.t;
  let html = tituloSeccion('Resumen');
  html += parrafo('En el período (' + periodo.titulo.charAt(0).toLowerCase() + periodo.titulo.slice(1) + ') el taller terminó ' +
    cantidadTexto(d.terminados.length, 'proyecto') + ' y recibió ' + cantidadTexto(d.pedidos.length, 'pedido') + ' de los otros entornos (' +
    cantidadTexto(d.atendidos.length, 'atendido', 'atendidos') + (d.demoraPromedio === null ? '' : ', con una demora promedio de ' + cantidadDias(Math.round(d.demoraPromedio))) + '). ' +
    'Se compraron materiales por ' + pesos(d.totalCompras) + ' y se usaron materiales por un valor estimado de ' + pesos(d.totalUsado) + '. ' +
    'Hubo ' + cantidadTexto(d.prestamos.length, 'préstamo', 'préstamos') + ' de herramientas.');

  html += tituloSeccion('Proyectos');
  html += d.proyectos.length
    ? listaPuntos(d.proyectos.map(function (p) {
        const materiales = materialesDeProyecto(t, p.id);
        const costo = materiales.reduce(function (s, m) { return s + (m.costo || 0); }, 0);
        return p.nombre + ' (' + [p.tipo, p.destino ? 'para ' + p.destino : '', t.cursos[p.cursoId]].filter(Boolean).join(', ') + '): ' +
          p.estado.toLowerCase() + ', ' + avanceProyecto(t, p) + '% de avance' +
          (materiales.length ? '; materiales: ' + materiales.map(function (m) { return (m.material ? m.material.nombre : 'material') + ' ' + cantidadMaterialTexto(m.cantidad, m.material); }).join(', ') +
            (costo ? ' (' + pesos(costo) + ')' : '') : '') + '.';
      }))
    : parrafo('No hubo proyectos en el período.');

  html += tituloSeccion('Pedidos de los entornos');
  if (d.pedidos.length) {
    const porEntorno = agruparSuma(d.pedidos, function (p) { return p.entorno; }, function () { return 1; });
    html += parrafo('Pedidos por entorno: ' + unirTexto(porEntorno.map(function (g) { return g.nombre + ' ' + g.total; })) + '.');
    html += listaPuntos(d.pedidos.map(function (p) {
      return formatearFecha(fechaLocal(p.creadoEn)) + ' · ' + p.entorno + ': ' + p.titulo + ' (' + String(p.tipo || 'Reparar').toLowerCase() + ')' +
        ' — ' + (p.estado || 'Pendiente').toLowerCase() + (p.fechaHecho ? ' el ' + formatearFecha(p.fechaHecho) : '');
    }));
  } else {
    html += parrafo('No se recibieron pedidos en el período.');
  }
  if (d.pendientesHoy.length) {
    html += parrafo(verboSegun(d.pendientesHoy.length, 'Hoy queda ', 'Hoy quedan ') + cantidadTexto(d.pendientesHoy.length, 'pedido pendiente', 'pedidos pendientes') + ': ' +
      unirTexto(d.pendientesHoy.map(function (p) { return p.titulo + ' (' + p.entorno + ')'; })) + '.');
  }

  html += tituloSeccion('Materiales');
  if (d.usos.length) {
    const porMaterial = agruparSuma(d.usos, function (mv) { return mv.materialId; }, function (mv) { return Number(mv.cantidad) || 0; });
    html += parrafo('Se usaron: ' + unirTexto(porMaterial.map(function (g) {
      const m = t.materialesTallerPorId[g.nombre];
      return (m ? m.nombre : 'material') + ' ' + cantidadMaterialTexto(g.total, m);
    })) + '.');
  } else {
    html += parrafo('No se registró uso de materiales en el período.');
  }
  if (d.compras.length) {
    html += parrafo('Entradas: ' + unirTexto(d.compras.map(function (mv) {
      const m = t.materialesTallerPorId[mv.materialId];
      return cantidadMaterialTexto(mv.cantidad, m) + ' de ' + nombreMaterial(t, mv.materialId) + (Number(mv.costo) ? ' por ' + pesos(mv.costo) : ' (sin costo)') +
        (mv.proveedor ? ' en ' + mv.proveedor : '');
    })) + '.');
  }
  if (d.bajos.length) {
    html += parrafo('Hoy están en el mínimo: ' + unirTexto(d.bajos.map(function (m) { return m.nombre + ' (' + cantidadMaterialTexto(stockMaterial(t, m.id), m) + ')'; })) + '.');
  }

  html += tituloSeccion('Pañol de herramientas');
  html += parrafo(d.prestamos.length
    ? 'Se prestaron herramientas ' + cantidadTexto(d.prestamos.length, 'vez', 'veces') + ': ' + unirTexto(d.herramientasPrestadas.map(function (x) { return x.etiqueta + ' ' + x.valor; })) + '.'
    : 'No hubo préstamos de herramientas en el período.');
  if (d.sinDevolver.length) {
    html += parrafo('Hoy siguen prestadas: ' + unirTexto(d.sinDevolver.map(function (p) {
      return nombreHerramienta(t, p.herramientaId) + (p.persona ? ' (' + p.persona + ', desde el ' + formatearFecha(p.fechaSalida) + ')' : '');
    })) + '.');
  }

  html += await seccionTareasInforme('Taller rural', periodo);
  return html;
}
