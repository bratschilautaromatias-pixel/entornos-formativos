/**
 * DASHBOARD E INFORME DE PRODUCCIÓN · MAQUINARIA: horas de uso, servicios, reparaciones, costos y estado del plan.
 * Dirección: #/productivo/maquinaria
 */
async function datosProductivosMaquinaria(periodo) {
  const q = await cargarMaquinaria();
  const usos = q.usosMaquina.filter(function (u) { return enPeriodo(u.fecha, periodo); }).sort(function (a, b) { return a.fecha.localeCompare(b.fecha); });
  const servicios = q.serviciosMaquina.filter(function (s) { return enPeriodo(s.fecha, periodo); }).sort(function (a, b) { return a.fecha.localeCompare(b.fecha); });
  const horas = function (u) { return Number(u.horas) || 0; };
  const costo = function (s) { return Number(s.costo) || 0; };
  const conFalla = usos.filter(function (u) { return u.fallas; });
  const meses = mesesDelPeriodo(periodo.desde, periodo.hasta, usos.map(function (u) { return u.fecha; }).concat(servicios.map(function (s) { return s.fecha; })));
  const porMaquina = q.maquinas.map(function (m) {
    const us = usos.filter(function (u) { return u.maquinaId === m.id; });
    const ss = servicios.filter(function (s) { return s.maquinaId === m.id; });
    const alertas = alertasMaquinaria(q, m.id);
    return {
      maquina: m, usos: us, servicios: ss, horas: us.reduce(function (t, u) { return t + horas(u); }, 0),
      costo: ss.reduce(function (t, s) { return t + costo(s); }, 0), fallas: us.filter(function (u) { return u.fallas; }).length,
      horasTotales: horasMaquina(q, m.id), vencidos: alertas.vencidos.length, proximos: alertas.proximos.length
    };
  }).filter(function (x) { return x.maquina.activa !== 'false' || x.usos.length || x.servicios.length; });
  return {
    q: q, periodo: periodo, usos: usos, servicios: servicios, conFalla: conFalla, meses: meses, porMaquina: porMaquina,
    horasMes: sumarPorMes(usos, 'fecha', horas), costoMes: sumarPorMes(servicios, 'fecha', costo),
    totalHoras: usos.reduce(function (t, u) { return t + horas(u); }, 0),
    totalCosto: servicios.reduce(function (t, s) { return t + costo(s); }, 0),
    serviciosPlan: servicios.filter(function (s) { return s.tipo !== 'Reparación'; }),
    reparaciones: servicios.filter(function (s) { return s.tipo === 'Reparación'; }),
    alertas: alertasMaquinaria(q),
    porTarea: rankingPor(usos, function (u) { return normalizarNombre(u.tarea); }, horas, 10),
    porEntorno: rankingPor(usos, function (u) { return u.entorno || 'Sin dato'; }, horas, 6)
  };
}

function indicadoresMaquinaria(d) {
  return htmlIndicadores([
    { titulo: 'Horas de uso', valor: numero(Math.round(d.totalHoras * 10) / 10) + ' h', detalle: d.usos.length + (d.usos.length === 1 ? ' uso' : ' usos'), tono: 'ok' },
    { titulo: 'Servicios del plan', valor: String(d.serviciosPlan.length), detalle: 'hechos en el período' },
    { titulo: 'Reparaciones', valor: String(d.reparaciones.length), detalle: 'fuera del plan', tono: d.reparaciones.length ? 'mal' : '' },
    { titulo: 'Costo de servicios', valor: pesos(d.totalCosto), detalle: 'repuestos y mano de obra' },
    { titulo: 'Usos con falla', valor: String(d.conFalla.length), detalle: 'en el chequeo diario', tono: d.conFalla.length ? 'mal' : '' },
    { titulo: 'Servicios vencidos', valor: String(d.alertas.vencidos.length), detalle: 'hoy · ' + d.alertas.proximos.length + ' próximos', tono: d.alertas.vencidos.length ? 'mal' : 'ok' }
  ]);
}

function htmlGraficosMaquinaria(d) {
  const etiquetas = d.meses.map(function (m) { return etiquetaMes(m, d.meses.length > 12); });
  return '<div class="grilla-graficos">' +
    graficoBarras(etiquetas, [{ nombre: 'Horas de uso', valores: d.meses.map(function (m) { return d.horasMes[m] || 0; }), color: '#2e7d32' }],
      { titulo: 'Horas de uso por mes' }) +
    graficoRanking(d.porMaquina.filter(function (x) { return x.horas; }).map(function (x) {
      return { etiqueta: x.maquina.nombre, valor: x.horas, texto: numero(Math.round(x.horas * 10) / 10) + ' h' };
    }), { titulo: 'Horas por máquina' }) +
    graficoBarras(etiquetas, [{ nombre: 'Costo', valores: d.meses.map(function (m) { return d.costoMes[m] || 0; }), color: '#c62828' }],
      { titulo: 'Costo de servicios y reparaciones por mes ($)' }) +
    graficoRanking(d.porTarea.map(function (x) { return Object.assign({ texto: numero(Math.round(x.valor * 10) / 10) + ' h' }, x); }), { titulo: 'Horas por tarea', color: '#1565c0' }) +
    graficoRanking(d.porEntorno.map(function (x) { return Object.assign({ texto: numero(Math.round(x.valor * 10) / 10) + ' h' }, x); }), { titulo: 'Horas por entorno donde se usó', color: '#00838f' }) +
  '</div>';
}

function tablasMaquinaria(d) {
  const q = d.q;
  const estadoHoy = [];
  d.porMaquina.forEach(function (x) {
    planDeMaquina(q, x.maquina.id).forEach(function (e) {
      estadoHoy.push([x.maquina.nombre, e.plan.tarea, e.ultimo ? formatearFecha(e.ultimo.fecha) + ' · ' + horasTexto(e.ultimo.horas) : 'Sin dato',
        [e.proximoHoras !== null ? horasTexto(e.proximoHoras) : '', e.proximaFecha ? formatearFecha(e.proximaFecha) : ''].filter(Boolean).join(' o '), e.estado]);
    });
  });
  return htmlTablaInforme('Resumen por máquina', ['Máquina', 'Horas en el período', 'Usos', 'Con falla', 'Servicios', 'Costo', 'Horas totales', 'Vencidos hoy'],
      d.porMaquina.map(function (x) {
        return [x.maquina.nombre, numero(Math.round(x.horas * 10) / 10), x.usos.length, x.fallas, x.servicios.length, pesos(x.costo), numero(Math.round(x.horasTotales * 10) / 10), x.vencidos];
      })) +
    htmlTablaInforme('Servicios y reparaciones del período (' + d.servicios.length + ')', ['Fecha', 'Máquina', 'Tipo', 'Qué se hizo', 'Horas', 'Repuestos', 'Costo', 'Realizado por'],
      d.servicios.map(function (s) {
        const p = q.planServiciosPorId[s.planId];
        return [formatearFecha(s.fecha), nombreMaquina(q, s.maquinaId), s.tipo, p ? p.tarea : s.descripcion, numero(s.horas), s.repuestos, Number(s.costo) ? pesos(s.costo) : '', s.realizadoPor];
      })) +
    htmlTablaInforme('Usos con falla en el chequeo (' + d.conFalla.length + ')', ['Fecha', 'Máquina', 'Falla', 'Observaciones'],
      d.conFalla.map(function (u) { return [formatearFecha(u.fecha), nombreMaquina(q, u.maquinaId), String(u.fallas).split(',').join(', '), u.observaciones]; })) +
    htmlTablaInforme('Estado del plan de servicios (hoy)', ['Máquina', 'Tarea', 'Último', 'Próximo', 'Estado'], estadoHoy,
      'PRÓXIMO = faltan 20 h o 15 días o menos. SIN DATO = todavía no se cargó cuándo se hizo por última vez.');
}

async function dibujarDashboardMaquinaria() {
  const lugar = document.getElementById('contenido-informe');
  if (!lugar) return;
  const d = await datosProductivosMaquinaria(periodoInforme());
  if (!document.getElementById('contenido-informe')) return;
  lugar.innerHTML = '<h1>📊 MAQUINARIA · USO Y MANTENIMIENTO</h1>' +
    htmlSelectorPeriodoInforme() +
    '<p class="ayuda centrado">' + esc(d.periodo.titulo) + '</p>' +
    htmlBotonesExportar('exportarMaquinariaExcel', 'exportarMaquinariaPdf', 'informe de producción') +
    indicadoresMaquinaria(d) + htmlGraficosMaquinaria(d) + tablasMaquinaria(d);
}

function exportarMaquinariaExcel(boton) {
  conBotonOcupado(boton, async function () {
    const d = await datosProductivosMaquinaria(periodoInforme());
    const q = d.q;
    const estadoPlan = [];
    q.maquinas.forEach(function (m) {
      planDeMaquina(q, m.id).forEach(function (e) {
        estadoPlan.push([m.nombre, e.plan.tarea, celdaNumero(e.plan.cadaHoras, 0), celdaNumero(e.plan.cadaMeses, 0),
          e.ultimo ? celdaNumero(e.ultimo.horas, 1) : 'SIN DATO', e.ultimo ? formatearFecha(e.ultimo.fecha) : '',
          e.proximoHoras !== null ? celdaNumero(e.proximoHoras, 1) : '', e.proximaFecha ? formatearFecha(e.proximaFecha) : '',
          e.faltanHoras !== null ? celdaNumero(e.faltanHoras, 1) : '', e.estado, e.plan.insumo]);
      });
    });
    const hojas = [
      { nombre: 'Resumen', encabezado: 3, filas: [
        ['Informe de uso y mantenimiento · Maquinaria'], ['Período: ' + d.periodo.titulo + ' · Generado el ' + formatearFecha(hoyTexto())], [],
        ['Indicador', 'Valor'],
        ['Horas de uso', celdaNumero(d.totalHoras, 1)], ['Usos registrados', d.usos.length], ['Servicios del plan', d.serviciosPlan.length],
        ['Reparaciones', d.reparaciones.length], ['Costo de servicios ($)', celdaNumero(d.totalCosto)], ['Usos con falla', d.conFalla.length],
        ['Servicios vencidos (hoy)', d.alertas.vencidos.length], ['Servicios próximos (hoy)', d.alertas.proximos.length]
      ] },
      { nombre: 'Por máquina', encabezado: 1, filas: [['Resumen por máquina'],
        ['Máquina', 'Tipo', 'Horas en el período', 'Usos', 'Con falla', 'Servicios', 'Costo ($)', 'Horas totales', 'Vencidos hoy', 'Próximos hoy']].concat(
        d.porMaquina.map(function (x) {
          return [x.maquina.nombre, x.maquina.tipo, celdaNumero(x.horas, 1), x.usos.length, x.fallas, x.servicios.length, celdaNumero(x.costo),
            celdaNumero(x.horasTotales, 1), x.vencidos, x.proximos];
        })) },
      { nombre: 'Registro de uso', encabezado: 1, filas: [['Registro de uso y chequeo diario'],
        ['Fecha', 'Máquina', 'Tarea', 'Horas', 'Dónde', 'Curso', 'Operador', 'Chequeo', 'Fallas', 'Observaciones']].concat(
        d.usos.map(function (u) {
          return [formatearFecha(u.fecha), nombreMaquina(q, u.maquinaId), u.tarea, celdaNumero(u.horas, 1), u.entorno, cursoDe(u, q.cursos), u.operador,
            u.chequeoHecho === 'false' ? 'No se hizo' : u.fallas ? 'Falla' : 'OK', String(u.fallas || '').split(',').join(', '), u.observaciones];
        })) },
      { nombre: 'Servicios', encabezado: 1, filas: [['Historial de servicios y reparaciones'],
        ['Fecha', 'Máquina', 'Tipo', 'Qué se hizo', 'Horas de la máquina', 'Repuestos / insumos', 'Cantidad', 'Costo ($)', 'Realizado por', 'Notas']].concat(
        d.servicios.map(function (s) {
          const p = q.planServiciosPorId[s.planId];
          return [formatearFecha(s.fecha), nombreMaquina(q, s.maquinaId), s.tipo, (p ? p.tarea : '') + (p && s.descripcion ? ' · ' : '') + (s.descripcion || ''),
            celdaNumero(s.horas, 1), s.repuestos, s.cantidad, celdaNumero(s.costo), s.realizadoPor, s.notas];
        })) },
      { nombre: 'Plan de servicios', encabezado: 1, filas: [['Estado del plan de servicios (hoy)'],
        ['Máquina', 'Tarea', 'Cada (horas)', 'Cada (meses)', 'Último (horas)', 'Último (fecha)', 'Próximo (horas)', 'Próximo (fecha)', 'Faltan (horas)', 'Estado', 'Insumo']].concat(estadoPlan) }
    ];
    descargarArchivo(crearExcel(hojas), nombreArchivo('Informe Maquinaria', 'xlsx'));
  });
}

function exportarMaquinariaPdf(boton) {
  conBotonOcupado(boton, async function () {
    const d = await datosProductivosMaquinaria(periodoInforme());
    const fotos = await fotosParaPdf('Maquinaria', d.periodo);
    imprimirInforme('Informe de uso y mantenimiento · Maquinaria', d.periodo.titulo,
      indicadoresMaquinaria(d) + htmlGraficosMaquinaria(d) + tablasMaquinaria(d) + fotos);
  });
}

/* ---------- Informe escrito ---------- */

async function redactarProductivoMaquinaria(periodo) {
  const d = await datosProductivosMaquinaria(periodo);
  const q = d.q;
  let html = tituloSeccion('Resumen');
  html += parrafo('En el período (' + periodo.titulo.charAt(0).toLowerCase() + periodo.titulo.slice(1) + ') las máquinas trabajaron ' +
    horasTexto(d.totalHoras) + ' en ' + cantidadTexto(d.usos.length, 'uso') + '. Hubo ' + cantidadTexto(d.serviciosPlan.length, 'servicio del plan', 'servicios del plan') + ' y ' +
    cantidadTexto(d.reparaciones.length, 'reparación', 'reparaciones') + ', con un costo de ' + pesos(d.totalCosto) + '. ' +
    (d.conFalla.length ? 'Hubo ' + cantidadTexto(d.conFalla.length, 'uso con falla', 'usos con falla') + ' en el chequeo diario.' : 'El chequeo diario no registró fallas.'));

  html += tituloSeccion('Uso por máquina');
  const usadas = d.porMaquina.filter(function (x) { return x.usos.length; });
  if (usadas.length) {
    html += listaPuntos(usadas.map(function (x) {
      const tareas = agruparSuma(x.usos, function (u) { return normalizarNombre(u.tarea); }, function (u) { return Number(u.horas) || 0; });
      return x.maquina.nombre + ': ' + horasTexto(x.horas) + ' en ' + cantidadTexto(x.usos.length, 'uso') + ' (' +
        tareas.map(function (t) { return t.nombre.toLowerCase() + ' ' + horasTexto(t.total); }).join('; ') + '). Lleva ' + horasTexto(x.horasTotales) + ' en total.';
    }));
  } else {
    html += parrafo('No se registraron usos en el período.');
  }

  html += tituloSeccion('Servicios y reparaciones');
  html += d.servicios.length
    ? listaPuntos(d.servicios.map(function (s) {
        const p = q.planServiciosPorId[s.planId];
        return formatearFecha(s.fecha) + ' · ' + nombreMaquina(q, s.maquinaId) + ': ' + (p ? p.tarea : 'reparación — ' + s.descripcion) +
          ' (a las ' + horasTexto(s.horas) + ')' + (s.repuestos ? ' · repuestos: ' + s.repuestos : '') + (Number(s.costo) ? ' · ' + pesos(s.costo) : '') +
          (s.realizadoPor ? ' · ' + s.realizadoPor : '');
      }))
    : parrafo('No se hicieron servicios ni reparaciones en el período.');

  if (d.conFalla.length) {
    html += tituloSeccion('Fallas del chequeo diario');
    html += listaPuntos(d.conFalla.map(function (u) {
      return formatearFecha(u.fecha) + ' · ' + nombreMaquina(q, u.maquinaId) + ': ' + String(u.fallas).split(',').join(', ') + (u.observaciones ? ' — ' + u.observaciones : '');
    }));
  }

  html += tituloSeccion('Estado del mantenimiento (hoy)');
  const a = d.alertas;
  html += parrafo(a.vencidos.length || a.proximos.length
    ? 'Hay ' + cantidadTexto(a.vencidos.length, 'servicio vencido', 'servicios vencidos') + ' y ' + cantidadTexto(a.proximos.length, 'servicio próximo', 'servicios próximos') + ':'
    : 'No hay servicios vencidos ni próximos.');
  html += listaPuntos(a.vencidos.concat(a.proximos).map(function (e) {
    return nombreMaquina(q, e.plan.maquinaId) + ': ' + e.plan.tarea + ' — ' + e.estado.toLowerCase() + ' (' + textoFaltan(e) + ')';
  }));
  if (a.sinDato) html += parrafo('Hay ' + cantidadTexto(a.sinDato, 'tarea del plan', 'tareas del plan') + ' sin dato del último servicio.');

  html += await seccionTareasInforme('Maquinaria', periodo);
  return html;
}
