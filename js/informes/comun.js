/**
 * PARTES COMUNES DE DASHBOARDS E INFORMES: período, tablas, PDF y clima histórico.
 */
const estadoInforme = { periodo: 'anio', desde: '', hasta: '' };

function periodoInforme() {
  return calcularPeriodo(estadoInforme.periodo, estadoInforme.desde, estadoInforme.hasta);
}

function htmlSelectorPeriodoInforme() {
  const opciones = [['mes', 'Este mes'], ['mesAnterior', 'Mes anterior'], ['anio', 'Este año'], ['todo', 'Todo'], ['rango', 'Elegir fechas']];
  return '<div class="selector-periodo"><label>Período<select onchange="cambiarPeriodoInforme(this.value)">' +
      opciones.map(function (o) { return '<option value="' + o[0] + '"' + (estadoInforme.periodo === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') +
    '</select></label>' +
    (estadoInforme.periodo === 'rango'
      ? '<div class="dos-columnas"><label>Desde<input type="date" value="' + esc(estadoInforme.desde) + '" onchange="estadoInforme.desde = this.value; alActualizarDatos()"></label>' +
        '<label>Hasta<input type="date" value="' + esc(estadoInforme.hasta) + '" onchange="estadoInforme.hasta = this.value; alActualizarDatos()"></label></div>'
      : '') + '</div>';
}

function cambiarPeriodoInforme(valor) {
  estadoInforme.periodo = valor;
  if (valor === 'rango' && !estadoInforme.desde) {
    const p = calcularPeriodo('anio');
    estadoInforme.desde = p.desde;
    estadoInforme.hasta = hoyTexto();
  }
  alActualizarDatos();
}

function enPeriodo(fecha, periodo) {
  return !!fecha && fecha >= periodo.desde && fecha <= periodo.hasta;
}

/** Botones de exportación que aparecen arriba de cada dashboard. */
function htmlBotonesExportar(funcionExcel, funcionPdf, nombreInforme) {
  return '<div class="botones-exportar">' +
    '<span>Exportar ' + esc(nombreInforme) + ':</span>' +
    '<button class="boton chico" onclick="' + funcionExcel + '(this)">⬇ Excel</button>' +
    '<button class="boton chico" onclick="' + funcionPdf + '(this)">⬇ PDF</button>' +
  '</div>';
}

/** Tarjetas de números grandes: [{ titulo, valor, detalle, tono: 'ok'|'mal' }] */
function htmlIndicadores(lista) {
  return '<div class="totales indicadores">' + lista.map(function (i) {
    return '<div class="' + (i.tono || '') + '"><span>' + esc(i.titulo) + '</span><b>' + esc(i.valor) + '</b>' +
      (i.detalle ? '<small>' + esc(i.detalle) + '</small>' : '') + '</div>';
  }).join('') + '</div>';
}

/** Tabla para pantalla y PDF. filas: arrays de valores ya formateados. */
function htmlTablaInforme(titulo, cabeceras, filas, nota) {
  return '<section class="seccion-informe"><h3>' + esc(titulo) + '</h3>' +
    (filas.length
      ? '<div class="tabla-desplazable"><table class="tabla"><thead><tr>' + cabeceras.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') +
        '</tr></thead><tbody>' + filas.map(function (f) {
          return '<tr>' + f.map(function (v) { return '<td>' + esc(v === null || v === undefined ? '' : v) + '</td>'; }).join('') + '</tr>';
        }).join('') + '</tbody></table></div>'
      : '<p class="ayuda">Sin datos en este período.</p>') +
    (nota ? '<p class="ayuda">' + esc(nota) + '</p>' : '') + '</section>';
}

/** Arma el PDF: abre la ventana de impresión con un informe prolijo (en "Destino" elegir "Guardar como PDF"). */
function imprimirInforme(titulo, subtitulo, cuerpo) {
  const sesion = Sesion.leer();
  imprimirHtml(
    '<div class="informe-impreso">' +
      '<header><div><h1>' + esc(titulo) + '</h1><p>' + esc(subtitulo) + '</p></div>' +
        '<div class="informe-fecha">Entornos Formativos<br>Generado el ' + formatearFecha(hoyTexto()) +
          (sesion ? '<br>por ' + esc(sesion.usuario.nombre) : '') + '</div></header>' +
      cuerpo +
    '</div>'
  );
}

/** Marca un botón como "trabajando" mientras se arma un archivo. */
async function conBotonOcupado(boton, tarea) {
  if (boton) ocupado(boton, true, 'Armando…');
  try {
    await tarea();
  } catch (e) {
    alert('No se pudo generar el informe: ' + e.message);
  }
  if (boton) ocupado(boton, false);
}

/** Formato de número para celdas de Excel (número real) o texto vacío. */
function celdaNumero(valor, decimales) {
  if (valor === null || valor === undefined || valor === '' || isNaN(Number(valor))) return '';
  const factor = Math.pow(10, decimales === undefined ? 2 : decimales);
  return Math.round(Number(valor) * factor) / factor;
}

/* ---------- Clima histórico (Open-Meteo, para lluvia y temperaturas de cada ciclo) ---------- */

/**
 * Clima diario entre dos fechas. Usa el archivo histórico de Open-Meteo y, para los últimos días,
 * el servicio de pronóstico. Se guarda en el equipo. Si no hay internet devuelve null.
 */
async function climaHistorico(ubicacion, desde, hasta) {
  const clave = 'climaHist:' + ubicacion.latitud.toFixed(3) + ',' + ubicacion.longitud.toFixed(3);
  const guardado = (await BaseLocal.leerMeta(clave)) || { dias: {} };
  const faltan = [];
  for (let d = desde; d <= hasta; d = sumarDias(d, 1)) {
    if (!guardado.dias[d] || d >= sumarDias(hoyTexto(), -7)) faltan.push(d);
    if (faltan.length > 4000) break;
  }
  if (faltan.length && navigator.onLine) {
    const limiteArchivo = sumarDias(hoyTexto(), -6);
    const variables = '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto';
    const pedidos = [];
    if (faltan[0] <= limiteArchivo) {
      pedidos.push('https://archive-api.open-meteo.com/v1/archive?latitude=' + ubicacion.latitud + '&longitude=' + ubicacion.longitud +
        '&start_date=' + faltan[0] + '&end_date=' + (faltan[faltan.length - 1] < limiteArchivo ? faltan[faltan.length - 1] : limiteArchivo) + variables);
    }
    if (faltan[faltan.length - 1] > limiteArchivo) {
      pedidos.push('https://api.open-meteo.com/v1/forecast?latitude=' + ubicacion.latitud + '&longitude=' + ubicacion.longitud +
        '&past_days=10&forecast_days=1' + variables);
    }
    for (const url of pedidos) {
      try {
        const json = await (await fetch(url)).json();
        (json.daily ? json.daily.time : []).forEach(function (fecha, i) {
          if (json.daily.temperature_2m_max[i] === null) return;
          guardado.dias[fecha] = [json.daily.temperature_2m_max[i], json.daily.temperature_2m_min[i], json.daily.precipitation_sum[i] || 0];
        });
      } catch (e) { /* sin conexión: se usa lo guardado */ }
    }
    await BaseLocal.escribirMeta(clave, guardado);
  }
  const dias = [];
  for (let d = desde; d <= hasta; d = sumarDias(d, 1)) {
    if (guardado.dias[d]) dias.push({ fecha: d, max: guardado.dias[d][0], min: guardado.dias[d][1], lluvia: guardado.dias[d][2] });
  }
  return dias.length ? dias : null;
}

function resumenClima(dias) {
  if (!dias || !dias.length) return { lluvia: null, max: null, min: null };
  return {
    lluvia: dias.reduce(function (t, d) { return t + d.lluvia; }, 0),
    max: dias.reduce(function (t, d) { return t + d.max; }, 0) / dias.length,
    min: dias.reduce(function (t, d) { return t + d.min; }, 0) / dias.length
  };
}
