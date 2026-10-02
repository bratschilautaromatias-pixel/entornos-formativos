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
          '<span class="icono">🌱</span>' +
          '<span><span class="nombre">Producción</span>' +
          '<span class="detalle">' + (entorno.clave === 'huerta'
            ? 'Parcelas, cultivos, almácigos, siembras, riego, tratamientos y cosechas'
            : 'Lotes, especies, siembras, cosechas, reservas y raciones') + '</span></span>' +
        '</button>' +
        '<button class="cuadro ancho" onclick="ir(\'economia/' + entorno.clave + '\')">' +
          '<span class="icono">💰</span>' +
          '<span><span class="nombre">Economía</span>' +
          '<span class="detalle">Ingresos, egresos y remitos internos</span></span>' +
        '</button>' +
        '<button class="cuadro ancho" onclick="ir(\'tareas\')">' +
          '<span class="icono">📋</span>' +
          '<span><span class="nombre">Tareas de la semana</span>' +
          '<span class="detalle">Lo que hay que hacer en ' + esc(entorno.nombre) + ' y el resto de los entornos</span></span>' +
        '</button>' +
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
