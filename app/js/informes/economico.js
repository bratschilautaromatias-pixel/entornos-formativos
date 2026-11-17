/**
 * DASHBOARD E INFORME ECONÓMICO de un entorno (ingresos, egresos, remitos).
 * Dirección: #/economico/huerta
 */
let entornoInformeEconomico = null;

PANTALLAS.economico = function (clave) {
  const entorno = entornoPorClave(clave);
  if (!entorno) return ir('inicio');
  entornoInformeEconomico = entorno;
  render(htmlBarra('Dashboard económico · ' + entorno.nombre, 'entorno/' + entorno.clave) +
    '<main class="contenido" id="contenido-informe"><p class="vacio">Cargando…</p></main>');
  alActualizarDatos = dibujarDashboardEconomico;
  dibujarDashboardEconomico();
};

/** Todos los números del período, para la pantalla, el Excel y el PDF. */
async function datosEconomicos(entorno, periodo) {
  const filtrar = async function (tabla) {
    return (await Datos.listar(tabla)).filter(function (m) { return m.entorno === entorno.nombre && enPeriodo(m.fecha, periodo); })
      .sort(function (a, b) { return a.fecha.localeCompare(b.fecha); });
  };
  const [ingresos, egresos, remitos] = await Promise.all([filtrar('Ingresos'), filtrar('Egresos'), filtrar('Remitos')]);
  const valor = function (m) { return Number(m.valor) || 0; };
  const meses = mesesDelPeriodo(periodo.desde, periodo.hasta, ingresos.concat(egresos, remitos).map(function (m) { return m.fecha; }));
  const ingresosMes = sumarPorMes(ingresos, 'fecha', valor);
  const egresosMes = sumarPorMes(egresos, 'fecha', valor);
  const remitosMes = sumarPorMes(remitos, 'fecha', valor);
  let acumulado = 0;
  const porMes = meses.map(function (m) {
    const i = ingresosMes[m] || 0, e = egresosMes[m] || 0;
    acumulado += i - e;
    return { mes: m, ingresos: i, egresos: e, balance: i - e, acumulado: acumulado, remitos: remitosMes[m] || 0 };
  });
  const totalIngresos = ingresos.reduce(function (t, m) { return t + valor(m); }, 0);
  const totalEgresos = egresos.reduce(function (t, m) { return t + valor(m); }, 0);
  return {
    entorno: entorno, periodo: periodo, ingresos: ingresos, egresos: egresos, remitos: remitos, porMes: porMes,
    totalIngresos: totalIngresos, totalEgresos: totalEgresos, balance: totalIngresos - totalEgresos,
    totalRemitos: remitos.reduce(function (t, m) { return t + valor(m); }, 0),
    ventaPromedio: ingresos.length ? totalIngresos / ingresos.length : 0,
    productos: rankingPor(ingresos, function (m) { return normalizarNombre(m.producto); }, valor, 10),
    pagos: rankingPor(ingresos, function (m) { return m.tipoPago; }, valor, 6),
    gastos: rankingPor(egresos, function (m) { return normalizarNombre(m.producto); }, valor, 8),
    proveedores: rankingPor(egresos, function (m) { return normalizarNombre(m.proveedor); }, valor, 8),
    destinos: rankingPor(remitos, function (m) { return normalizarNombre(m.destino); }, valor, 8)
  };
}

/** "lechuga " y "Lechuga" cuentan como el mismo producto en los rankings. */
function normalizarNombre(texto) {
  const t = String(texto || '').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : '';
}

function htmlGraficosEconomicos(d) {
  const etiquetas = d.porMes.map(function (m) { return etiquetaMes(m.mes, d.porMes.length > 12); });
  const conTexto = function (lista) { return lista.map(function (x) { return Object.assign({ texto: pesos(x.valor) }, x); }); };
  return '<div class="grilla-graficos">' +
    graficoBarras(etiquetas, [
      { nombre: 'Ingresos', valores: d.porMes.map(function (m) { return m.ingresos; }), color: '#2e7d32' },
      { nombre: 'Egresos', valores: d.porMes.map(function (m) { return m.egresos; }), color: '#c62828' }
    ], { titulo: 'Ingresos y egresos por mes ($)' }) +
    graficoLinea(etiquetas, [{ nombre: 'Balance acumulado', valores: d.porMes.map(function (m) { return m.acumulado; }), color: '#1565c0' }],
      { titulo: 'Balance acumulado ($)', nota: 'Cuánto se ganó (o perdió) sumando mes a mes.' }) +
    graficoRanking(conTexto(d.productos), { titulo: 'Productos que más venden ($)' }) +
    graficoRanking(conTexto(d.pagos), { titulo: 'Formas de pago ($)', color: '#1565c0' }) +
    graficoRanking(conTexto(d.gastos), { titulo: 'En qué se gasta ($)', color: '#c62828' }) +
    graficoRanking(conTexto(d.destinos), { titulo: 'Remitos internos por destino ($)', color: '#f9a825' }) +
  '</div>';
}

function indicadoresEconomicos(d) {
  return htmlIndicadores([
    { titulo: 'Ingresos', valor: pesos(d.totalIngresos), detalle: d.ingresos.length + ' ventas', tono: 'ok' },
    { titulo: 'Egresos', valor: pesos(d.totalEgresos), detalle: d.egresos.length + ' compras', tono: 'mal' },
    { titulo: 'Balance', valor: pesos(d.balance), detalle: 'ingresos − egresos', tono: d.balance >= 0 ? 'ok' : 'mal' },
    { titulo: 'Remitos internos', valor: pesos(d.totalRemitos), detalle: d.remitos.length + ' entregas' },
    { titulo: 'Venta promedio', valor: pesos(d.ventaPromedio), detalle: 'por venta' },
    { titulo: 'Mejor mes', valor: (function () {
      const mejor = d.porMes.slice().sort(function (a, b) { return b.ingresos - a.ingresos; })[0];
      return mejor && mejor.ingresos ? etiquetaMes(mejor.mes, true) : '—';
    })(), detalle: 'en ingresos' }
  ]);
}

async function dibujarDashboardEconomico() {
  const lugar = document.getElementById('contenido-informe');
  if (!lugar) return;
  const d = await datosEconomicos(entornoInformeEconomico, periodoInforme());
  if (!document.getElementById('contenido-informe')) return;
  lugar.innerHTML = '<h1>💹 ' + esc(entornoInformeEconomico.nombre.toUpperCase()) + ' · ECONOMÍA</h1>' +
    htmlSelectorPeriodoInforme() +
    '<p class="ayuda centrado">' + esc(d.periodo.titulo) + '</p>' +
    htmlBotonesExportar('exportarEconomicoExcel', 'exportarEconomicoPdf', 'informe económico', 'tablero/economico/' + entornoInformeEconomico.clave, 'Tablero económico') +
    indicadoresEconomicos(d) +
    htmlGraficosEconomicos(d) +
    htmlTablaInforme('Resumen por mes', ['Mes', 'Ingresos', 'Egresos', 'Balance', 'Acumulado', 'Remitos'],
      d.porMes.map(function (m) { return [etiquetaMes(m.mes, true), pesos(m.ingresos), pesos(m.egresos), pesos(m.balance), pesos(m.acumulado), pesos(m.remitos)]; }));
}

/* ---------- Exportar ---------- */

function exportarEconomicoExcel(boton) {
  conBotonOcupado(boton, async function () {
    const d = await datosEconomicos(entornoInformeEconomico, periodoInforme());
    const titulo = 'Informe económico · ' + d.entorno.nombre;
    const fecha = function (f) { return formatearFecha(f); };
    const hojas = [
      { nombre: 'Resumen', encabezado: 3, filas: [
        [titulo], ['Período: ' + d.periodo.titulo + ' · Generado el ' + formatearFecha(hoyTexto())], [],
        ['Concepto', 'Valor'],
        ['Ingresos ($)', celdaNumero(d.totalIngresos)], ['Cantidad de ventas', d.ingresos.length], ['Venta promedio ($)', celdaNumero(d.ventaPromedio)],
        ['Egresos ($)', celdaNumero(d.totalEgresos)], ['Cantidad de compras', d.egresos.length],
        ['Balance ($)', celdaNumero(d.balance)], ['Remitos internos ($)', celdaNumero(d.totalRemitos)], ['Cantidad de remitos', d.remitos.length]
      ] },
      { nombre: 'Por mes', encabezado: 1, filas: [['Resumen por mes'], ['Mes', 'Ingresos ($)', 'Egresos ($)', 'Balance ($)', 'Acumulado ($)', 'Remitos ($)']].concat(
        d.porMes.map(function (m) { return [etiquetaMes(m.mes, true), celdaNumero(m.ingresos), celdaNumero(m.egresos), celdaNumero(m.balance), celdaNumero(m.acumulado), celdaNumero(m.remitos)]; })) },
      { nombre: 'Ingresos', encabezado: 1, filas: [['Ingresos (ventas)'], ['Fecha', 'Producto', 'Cantidad', 'Unidad', 'Valor ($)', 'Forma de pago', 'Cliente', 'Notas']].concat(
        d.ingresos.map(function (m) { return [fecha(m.fecha), m.producto, celdaNumero(m.cantidad), m.unidad, celdaNumero(m.valor), m.tipoPago, m.cliente, m.notas]; })) },
      { nombre: 'Egresos', encabezado: 1, filas: [['Egresos (compras)'], ['Fecha', 'Producto', 'Cantidad', 'Unidad', 'Valor ($)', 'Proveedor', 'N° factura', 'Notas']].concat(
        d.egresos.map(function (m) { return [fecha(m.fecha), m.producto, celdaNumero(m.cantidad), m.unidad, celdaNumero(m.valor), m.proveedor, m.numeroFactura, m.notas]; })) },
      { nombre: 'Remitos', encabezado: 1, filas: [['Remitos internos'], ['N°', 'Fecha', 'Producto', 'Cantidad', 'Unidad', 'Valor ($)', 'Destino', 'Notas']].concat(
        d.remitos.map(function (m) { return [m.numero, fecha(m.fecha), m.producto, celdaNumero(m.cantidad), m.unidad, celdaNumero(m.valor), m.destino, m.notas]; })) },
      { nombre: 'Rankings', encabezado: 1, filas: [['Rankings del período'], ['Productos que más venden', 'Ingresos ($)', '', 'Forma de pago', 'Ingresos ($)', '', 'En qué se gasta', 'Egresos ($)']].concat(
        Array.from({ length: Math.max(d.productos.length, d.pagos.length, d.gastos.length) }, function (_, i) {
          const p = d.productos[i], g = d.pagos[i], e = d.gastos[i];
          return [p ? p.etiqueta : '', p ? celdaNumero(p.valor) : '', '', g ? g.etiqueta : '', g ? celdaNumero(g.valor) : '', '', e ? e.etiqueta : '', e ? celdaNumero(e.valor) : ''];
        })) }
    ];
    descargarArchivo(crearExcel(hojas), nombreArchivo('Informe economico ' + d.entorno.nombre, 'xlsx'));
  });
}

function exportarEconomicoPdf(boton) {
  conBotonOcupado(boton, async function () {
    const d = await datosEconomicos(entornoInformeEconomico, periodoInforme());
    const tabla = htmlTablaInforme;
    imprimirInforme('Informe económico · ' + d.entorno.nombre, d.periodo.titulo,
      indicadoresEconomicos(d) + htmlGraficosEconomicos(d) +
      tabla('Resumen por mes', ['Mes', 'Ingresos', 'Egresos', 'Balance', 'Acumulado', 'Remitos'],
        d.porMes.map(function (m) { return [etiquetaMes(m.mes, true), pesos(m.ingresos), pesos(m.egresos), pesos(m.balance), pesos(m.acumulado), pesos(m.remitos)]; })) +
      tabla('Ingresos (' + d.ingresos.length + ')', ['Fecha', 'Producto', 'Cant.', 'Valor', 'Pago', 'Cliente'],
        d.ingresos.map(function (m) { return [formatearFecha(m.fecha), m.producto, m.cantidad ? numero(m.cantidad) + ' ' + m.unidad : '', pesos(m.valor), m.tipoPago, m.cliente]; })) +
      tabla('Egresos (' + d.egresos.length + ')', ['Fecha', 'Producto', 'Cant.', 'Valor', 'Proveedor', 'Factura'],
        d.egresos.map(function (m) { return [formatearFecha(m.fecha), m.producto, m.cantidad ? numero(m.cantidad) + ' ' + m.unidad : '', pesos(m.valor), m.proveedor, m.numeroFactura]; })) +
      tabla('Remitos internos (' + d.remitos.length + ')', ['N°', 'Fecha', 'Producto', 'Cant.', 'Valor', 'Destino'],
        d.remitos.map(function (m) { return [m.numero, formatearFecha(m.fecha), m.producto, m.cantidad ? numero(m.cantidad) + ' ' + m.unidad : '', pesos(m.valor), m.destino]; }))
    );
  });
}
