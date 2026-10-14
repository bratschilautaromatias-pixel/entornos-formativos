/**
 * PANTALLA DE UN ENTORNO (Huerta, Forrajes...): punto de partida hacia sus secciones.
 * Dirección: #/entorno/huerta
 */

PANTALLAS.entorno = function (clave) {
  const entorno = entornoPorClave(clave);
  if (!entorno) return ir('inicio');

  render(
    htmlBarra(entorno.nombre, 'inicio') +
    '<main class="contenido">' +
      '<h1>' + entorno.icono + ' ' + esc(entorno.nombre.toUpperCase()) + '</h1>' +
      '<p class="saludo">' + esc(entorno.detalle) + '</p>' +
      '<div class="mini-resumen" id="mini-resumen"></div>' +
      '<div class="grilla grilla-secciones">' +
        '<button class="cuadro ancho" onclick="ir(\'produccion/' + entorno.clave + '\')">' +
          '<span class="icono">' + entorno.produccion.icono + '</span>' +
          '<span><span class="nombre">' + esc(entorno.produccion.nombre) + '</span>' +
          '<span class="detalle">' + esc(entorno.produccion.detalle) + '</span></span>' +
        '</button>' +
        '<button class="cuadro ancho" onclick="ir(\'economia/' + entorno.clave + '\')">' +
          '<span class="icono">💰</span>' +
          '<span><span class="nombre">Economía</span>' +
          '<span class="detalle">Ingresos, egresos y remitos internos</span></span>' +
        '</button>' +
        '<p class="seccion-titulo">Dashboards e informes (Excel y PDF)</p>' +
        '<button class="cuadro ancho" onclick="ir(\'productivo/' + entorno.clave + '\')">' +
          '<span class="icono">📊</span>' +
          '<span><span class="nombre">Dashboard de producción</span>' +
          '<span class="detalle">Gráficos e informe productivo</span></span>' +
        '</button>' +
        '<button class="cuadro ancho" onclick="ir(\'economico/' + entorno.clave + '\')">' +
          '<span class="icono">💹</span>' +
          '<span><span class="nombre">Dashboard económico</span>' +
          '<span class="detalle">Gráficos e informe económico</span></span>' +
        '</button>' +
        '<p class="seccion-titulo">Tareas</p>' +
        '<button class="cuadro ancho" onclick="ir(\'tareas/entorno/' + entorno.clave + '\')">' +
          '<span class="icono">📋</span>' +
          '<span><span class="nombre">Tareas de la semana</span>' +
          '<span class="detalle">Solo las de ' + esc(entorno.nombre) + '</span></span>' +
        '</button>' +
        (entorno.clave !== 'taller' && puedeEditar()
          ? '<button class="cuadro ancho" onclick="formularioPedidoTaller(null, \'' + esc(entorno.nombre) + '\')">' +
              '<span class="icono">📨</span>' +
              '<span><span class="nombre">Pedirle algo al Taller rural</span>' +
              '<span class="detalle">Que fabrique o repare algo para ' + esc(entorno.nombre) + '</span></span>' +
            '</button>'
          : '') +
      '</div>' +
    '</main>'
  );

  alActualizarDatos = function () { dibujarMiniResumen(entorno); };
  dibujarMiniResumen(entorno);
};

/** Ingresos, egresos y balance del mes en curso, arriba de todo. */
async function dibujarMiniResumen(entorno) {
  const lugar = document.getElementById('mini-resumen');
  if (!lugar) return;
  const periodo = calcularPeriodo('mes');
  const [ingresos, egresos] = await Promise.all([
    movimientosDelPeriodo('Ingresos', entorno.nombre, periodo),
    movimientosDelPeriodo('Egresos', entorno.nombre, periodo)
  ]);
  const totalIngresos = sumarValores(ingresos);
  const totalEgresos = sumarValores(egresos);
  if (!document.getElementById('mini-resumen')) return;
  lugar.innerHTML =
    '<p class="ayuda centrado">' + esc(periodo.titulo) + '</p>' +
    '<div class="totales">' +
      '<div class="ok"><span>Ingresos</span><b>' + pesos(totalIngresos) + '</b></div>' +
      '<div class="mal"><span>Egresos</span><b>' + pesos(totalEgresos) + '</b></div>' +
      '<div class="' + (totalIngresos - totalEgresos >= 0 ? 'ok' : 'mal') + '"><span>Balance</span><b>' + pesos(totalIngresos - totalEgresos) + '</b></div>' +
    '</div>';
}

/* Producción: se construye en las próximas etapas */
PANTALLAS.produccion = function (clave) {
  const entorno = entornoPorClave(clave);
  if (!entorno) return ir('inicio');
  pantallaEnConstruccion('Producción · ' + entorno.nombre, '🌱', 'entorno/' + entorno.clave);
};
