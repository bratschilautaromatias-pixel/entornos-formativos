/**
 * GRÁFICOS (dibujados en SVG por la app: funcionan sin internet y se imprimen bien en el PDF).
 */
const COLORES_GRAFICO = ['#2e7d32', '#c62828', '#1565c0', '#f9a825', '#6a1b9a', '#00838f', '#8d6e63', '#ef6c00'];

/** Redondea el máximo de la escala a un número "lindo" (1, 2, 2,5, 5 × 10ⁿ) para que el eje tenga marcas redondas. */
function escalaRedonda(valor) {
  if (valor <= 0) return 0;
  const potencia = Math.pow(10, Math.floor(Math.log10(valor)));
  const base = valor / potencia;
  const paso = base <= 1 ? 1 : base <= 2 ? 2 : base <= 2.5 ? 2.5 : base <= 5 ? 5 : 10;
  return paso * potencia;
}

/** Cantidad de marcas del eje para que caigan en números redondos. */
function divisionesEje(rango) {
  const base = rango / Math.pow(10, Math.floor(Math.log10(rango || 1)));
  return Math.abs(base - 2) < 1e-9 ? 4 : 5;
}

function formatoCorto(valor) {
  const v = Math.abs(valor);
  if (v >= 1e6) return (valor / 1e6).toFixed(1).replace('.', ',') + ' M';
  if (v >= 1e4) return Math.round(valor / 1e3) + ' mil';
  return numero(Math.round(valor * 10) / 10);
}

/**
 * Barras verticales agrupadas.
 * etiquetas: ['ene', 'feb'...] · series: [{ nombre, valores: [...], color }]
 */
function graficoBarras(etiquetas, series, opciones) {
  opciones = opciones || {};
  const hayDatos = series.some(function (s) { return s.valores.some(function (v) { return v; }); });
  if (!hayDatos) return envolverGrafico('<p class="ayuda vacio-grafico">Sin datos en este período.</p>', [], opciones);
  const ancho = 640, alto = 280, izq = 84, der = 12, arriba = 16, abajo = 50;
  const crudoMax = Math.max(0, ...series.map(function (s) { return Math.max(0, ...s.valores); }));
  const crudoMin = Math.min(0, ...series.map(function (s) { return Math.min(0, ...s.valores); }));
  const maximo = escalaRedonda(crudoMax || (crudoMin ? 0 : 1));
  const minimo = -escalaRedonda(-crudoMin);
  const rango = maximo - minimo || 1;
  const y = function (v) { return arriba + (maximo - v) / rango * (alto - arriba - abajo); };
  const anchoGrupo = (ancho - izq - der) / Math.max(1, etiquetas.length);
  const anchoBarra = Math.min(34, (anchoGrupo - 8) / series.length);
  let svg = '<svg class="grafico" viewBox="0 0 ' + ancho + ' ' + alto + '" role="img" aria-label="' + esc(opciones.titulo || 'Gráfico') + '">';
  // Líneas guía
  const div = divisionesEje(rango);
  for (let i = 0; i <= div; i++) {
    const v = minimo + rango * i / div;
    svg += '<line x1="' + izq + '" x2="' + (ancho - der) + '" y1="' + y(v) + '" y2="' + y(v) + '" class="guia"/>' +
      '<text x="' + (izq - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end" class="eje">' + formatoCorto(v) + '</text>';
  }
  etiquetas.forEach(function (et, i) {
    const x0 = izq + i * anchoGrupo + (anchoGrupo - anchoBarra * series.length) / 2;
    series.forEach(function (s, j) {
      const v = s.valores[i] || 0;
      const yTop = y(Math.max(0, v)), yBase = y(Math.min(0, v));
      svg += '<rect x="' + (x0 + j * anchoBarra) + '" y="' + yTop + '" width="' + Math.max(1, anchoBarra - 2) + '" height="' + Math.max(0.5, yBase - yTop) +
        '" rx="2" fill="' + (s.color || COLORES_GRAFICO[j % COLORES_GRAFICO.length]) + '"><title>' + esc(s.nombre + ' · ' + et + ': ' + numero(v)) + '</title></rect>';
    });
    if (etiquetas.length <= 12 || i % Math.ceil(etiquetas.length / 12) === 0) {
      svg += '<text x="' + (izq + i * anchoGrupo + anchoGrupo / 2) + '" y="' + (alto - abajo + 26) + '" text-anchor="middle" class="eje">' + esc(et) + '</text>';
    }
  });
  svg += '</svg>';
  return envolverGrafico(svg, series, opciones);
}

/** Línea (una o varias series). */
function graficoLinea(etiquetas, series, opciones) {
  opciones = opciones || {};
  const ancho = 640, alto = 260, izq = 96, der = 20, arriba = 16, abajo = 46;
  const todos = series.reduce(function (t, s) { return t.concat(s.valores.filter(function (v) { return v !== null; })); }, []);
  const crudoMax = Math.max(0, ...todos), crudoMin = Math.min(0, ...todos);
  const maximo = escalaRedonda(crudoMax || (crudoMin ? 0 : 1)), minimo = -escalaRedonda(-crudoMin), rango = maximo - minimo || 1;
  const x = function (i) { return izq + (etiquetas.length <= 1 ? (ancho - izq - der) / 2 : i * (ancho - izq - der) / (etiquetas.length - 1)); };
  const y = function (v) { return arriba + (maximo - v) / rango * (alto - arriba - abajo); };
  let svg = '<svg class="grafico" viewBox="0 0 ' + ancho + ' ' + alto + '" role="img" aria-label="' + esc(opciones.titulo || 'Gráfico') + '">';
  const div = divisionesEje(rango);
  for (let i = 0; i <= div; i++) {
    const v = minimo + rango * i / div;
    svg += '<line x1="' + izq + '" x2="' + (ancho - der) + '" y1="' + y(v) + '" y2="' + y(v) + '" class="guia"/>' +
      '<text x="' + (izq - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end" class="eje">' + formatoCorto(v) + '</text>';
  }
  if (minimo < 0) svg += '<line x1="' + izq + '" x2="' + (ancho - der) + '" y1="' + y(0) + '" y2="' + y(0) + '" class="cero"/>';
  series.forEach(function (s, j) {
    const color = s.color || COLORES_GRAFICO[j % COLORES_GRAFICO.length];
    const puntos = s.valores.map(function (v, i) { return v === null ? null : x(i) + ',' + y(v); }).filter(Boolean);
    svg += '<polyline points="' + puntos.join(' ') + '" fill="none" stroke="' + color + '" stroke-width="2.5" stroke-linejoin="round"/>';
    s.valores.forEach(function (v, i) {
      if (v !== null) svg += '<circle cx="' + x(i) + '" cy="' + y(v) + '" r="3.5" fill="' + color + '"><title>' + esc(etiquetas[i] + ': ' + numero(v)) + '</title></circle>';
    });
  });
  etiquetas.forEach(function (et, i) {
    if (etiquetas.length <= 12 || i % Math.ceil(etiquetas.length / 12) === 0) {
      svg += '<text x="' + x(i) + '" y="' + (alto - abajo + 26) + '" text-anchor="middle" class="eje">' + esc(et) + '</text>';
    }
  });
  svg += '</svg>';
  return envolverGrafico(svg, series, opciones);
}

/** Barras horizontales para rankings: items [{ etiqueta, valor, texto? }] */
function graficoRanking(items, opciones) {
  opciones = opciones || {};
  if (!items.length) return envolverGrafico('<p class="ayuda">Sin datos en este período.</p>', [], opciones);
  const maximo = Math.max(1, ...items.map(function (i) { return i.valor; }));
  const html = items.map(function (i, n) {
    return '<div class="barra-dato"><span title="' + esc(i.etiqueta) + '">' + esc(i.etiqueta) + '</span><div><i style="width:' +
      Math.max(1, Math.round(i.valor * 100 / maximo)) + '%;background:' + (opciones.color || COLORES_GRAFICO[0]) + '"></i></div><b>' +
      esc(i.texto !== undefined ? i.texto : numero(i.valor)) + '</b></div>';
  }).join('');
  return envolverGrafico(html, [], opciones);
}

function envolverGrafico(contenido, series, opciones) {
  const leyenda = series.length > 1
    ? '<div class="leyenda">' + series.map(function (s, j) {
        return '<span><i style="background:' + (s.color || COLORES_GRAFICO[j % COLORES_GRAFICO.length]) + '"></i>' + esc(s.nombre) + '</span>';
      }).join('') + '</div>'
    : '';
  return '<figure class="tarjeta-grafico">' + (opciones.titulo ? '<figcaption>' + esc(opciones.titulo) + '</figcaption>' : '') +
    leyenda + contenido + (opciones.nota ? '<p class="ayuda">' + esc(opciones.nota) + '</p>' : '') + '</figure>';
}

/* ---------- Ayudantes para agrupar por mes ---------- */

const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Lista de meses "AAAA-MM" entre dos fechas (como máximo los últimos 24). */
function mesesDelPeriodo(desde, hasta, fechasConDatos) {
  let inicio = desde, fin = hasta;
  if (desde < '1000' || hasta > '9000') {
    const fechas = fechasConDatos.filter(Boolean).sort();
    if (!fechas.length) return [];
    inicio = fechas[0];
    fin = fechas[fechas.length - 1] > hoyTexto() ? fechas[fechas.length - 1] : hoyTexto();
  }
  if (fin > hoyTexto() && inicio <= hoyTexto()) fin = hoyTexto(); // no mostrar meses que todavía no llegaron
  const meses = [];
  let a = Number(inicio.slice(0, 4)), m = Number(inicio.slice(5, 7));
  const fa = Number(fin.slice(0, 4)), fm = Number(fin.slice(5, 7));
  while (a < fa || (a === fa && m <= fm)) {
    meses.push(a + '-' + String(m).padStart(2, '0'));
    m++; if (m > 12) { m = 1; a++; }
  }
  return meses.slice(-24);
}

function etiquetaMes(clave, conAnio) {
  return MESES_CORTOS[Number(clave.slice(5, 7)) - 1] + (conAnio ? ' ' + clave.slice(2, 4) : '');
}

function sumarPorMes(registros, campoFecha, valor) {
  const suma = {};
  registros.forEach(function (r) {
    const mes = String(r[campoFecha] || '').slice(0, 7);
    suma[mes] = (suma[mes] || 0) + valor(r);
  });
  return suma;
}

function rankingPor(registros, clave, valor, limite) {
  const suma = {};
  registros.forEach(function (r) {
    const k = clave(r) || 'Sin dato';
    suma[k] = (suma[k] || 0) + valor(r);
  });
  return Object.keys(suma).map(function (k) { return { etiqueta: k, valor: suma[k] }; })
    .sort(function (a, b) { return b.valor - a.valor; }).slice(0, limite || 8);
}
