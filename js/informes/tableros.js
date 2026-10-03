/**
 * TABLEROS (diseño "editorial", una hoja apaisada): Tablero productivo y Tablero económico
 * de Huerta y Forrajes. Se abren desde un botón en cada dashboard y se pueden imprimir.
 * Dirección: #/tablero/productivo/huerta · #/tablero/economico/forrajes ...
 */
const PALETA_TABLERO = {
  verde: '#2f6b45', verdeClaro: '#a9cdb0', marron: '#9a6431', beige: '#e3cfb4',
  rojo: '#b5452b', gris: '#66706a', grisClaro: '#c9d1cb'
};
const COLORES_GRUPO_TABLERO = ['#2f6b45', '#a9cdb0', '#9a6431', '#66706a', '#c9a227', '#4f7ca8'];
const NOMBRE_ESCUELA = 'Escuela Agraria Parque Pereyra Iraola';

PANTALLAS.tablero = function (parametro) {
  const partes = String(parametro || '').split('/');
  const tipo = partes[0] === 'economico' ? 'economico' : 'productivo';
  const entorno = entornoPorClave(partes[1]);
  if (!entorno) return ir('inicio');
  const volver = (tipo === 'economico' ? 'economico/' : 'productivo/') + entorno.clave;
  render(htmlBarra((tipo === 'economico' ? 'Tablero económico · ' : 'Tablero productivo · ') + entorno.nombre, volver) +
    '<main class="contenido contenido-tablero">' +
      '<div class="botones-exportar"><span>Tablero listo para imprimir en una hoja apaisada.</span>' +
        '<button class="boton chico" onclick="imprimirTablero()">🖨 Imprimir / PDF</button></div>' +
      '<div id="lugar-tablero"><p class="vacio">Armando el tablero…</p></div>' +
    '</main>');
  alActualizarDatos = async function () {
    const lugar = document.getElementById('lugar-tablero');
    if (!lugar) return;
    const html = tipo === 'economico' ? await htmlTableroEconomico(entorno)
      : entorno.clave === 'huerta' ? await htmlTableroHuerta() : await htmlTableroForrajes();
    if (document.getElementById('lugar-tablero')) lugar.innerHTML = '<div class="tablero">' + html + '</div>';
  };
  alActualizarDatos();
};

function imprimirTablero() {
  const t = document.querySelector('#lugar-tablero .tablero');
  if (!t) return;
  imprimirHtml('<div class="tablero tablero-impreso">' + t.innerHTML + '</div>');
}

/* ---------- Piezas de diseño ---------- */

function tabCabecera(entorno, titulo, meta1, meta2) {
  return '<header class="tab-cabecera"><div><p class="tab-antetitulo">' + esc(entorno.toUpperCase() + ' · ' + NOMBRE_ESCUELA.toUpperCase()) + '</p>' +
    '<h1>' + esc(titulo) + '</h1></div><div class="tab-meta">' + esc(meta1) + '<br>' + esc(meta2) + '</div></header>';
}

/** [{ valor, texto, color }] */
function tabIndicadores(lista) {
  return '<div class="tab-kpis">' + lista.map(function (k) {
    return '<div><b style="color:' + (k.color || '#1c2b1d') + '">' + esc(k.valor) + '</b><span>' + esc(k.texto) + '</span></div>';
  }).join('') + '</div>';
}

function tabTitulo(texto, bajada) {
  return '<h2 class="tab-titulo">' + esc(texto) + '</h2>' + (bajada ? '<p class="tab-bajada">' + esc(bajada) + '</p>' : '');
}

function tabLeyenda(items) {
  return '<div class="tab-leyenda">' + items.map(function (i) {
    return '<span><i style="background:' + i.color + '"></i>' + esc(i.texto) + '</span>';
  }).join('') + '</div>';
}

/**
 * Barras horizontales con etiqueta de dos líneas.
 * items: [{ titulo, sub, valor, texto, color }] · op: { eje: [0,30,60...], unidad: 'días', quiebre: true }
 */
function tabBarras(items, op) {
  op = op || {};
  if (!items.length) return '<p class="tab-vacio">Sin datos cargados.</p>';
  const valores = items.map(function (i) { return i.valor; }).sort(function (a, b) { return b - a; });
  let maximo = valores[0] || 1;
  // Si un valor es mucho más grande que el resto (ej. una siembra de hace más de un año), se corta la barra
  const cortar = op.quiebre && valores.length > 2 && valores[0] > valores[1] * 2.2;
  if (cortar) maximo = valores[1] * 1.15;
  if (op.eje) maximo = Math.max(maximo, op.eje[op.eje.length - 1]);
  const html = items.map(function (i) {
    const ancho = Math.min(100, Math.max(1.5, i.valor / maximo * 100));
    const cortada = cortar && i.valor > maximo;
    return '<div class="tab-fila"><div class="tab-etiqueta"><b>' + esc(i.titulo) + '</b>' + (i.sub ? '<small>' + esc(i.sub) + '</small>' : '') + '</div>' +
      '<div class="tab-pista"><i style="width:' + ancho + '%;background:' + (i.color || PALETA_TABLERO.verde) + '"' + (cortada ? ' class="cortada"' : '') + '></i>' +
      '<em style="left:calc(' + ancho + '% + 6px)">' + esc(i.texto) + '</em></div></div>';
  }).join('');
  const eje = op.eje
    ? '<div class="tab-fila tab-eje"><div class="tab-etiqueta"></div><div class="tab-pista">' + op.eje.map(function (v) {
        return '<span style="left:' + (v / maximo * 100) + '%">' + v + '</span>';
      }).join('') + (op.unidad ? '<span class="tab-unidad">' + esc(op.unidad) + '</span>' : '') + '</div></div>'
    : '';
  return '<div class="tab-barras' + (op.eje ? ' con-guias' : '') + '" style="--guias:' + (op.eje ? op.eje.length - 1 : 0) + '">' + html + eje + '</div>';
}

/** Columnas verticales agrupadas o apiladas con el valor arriba. series: [{ nombre, valores, color }] */
function tabColumnas(etiquetas, series, op) {
  op = op || {};
  const ancho = 600, alto = 260, izq = 50, abajo = 30, arriba = 26;
  const totales = etiquetas.map(function (_, i) {
    return op.apiladas ? series.reduce(function (t, s) { return t + (s.valores[i] || 0); }, 0)
      : Math.max.apply(null, series.map(function (s) { return s.valores[i] || 0; }));
  });
  const maximo = escalaRedonda(Math.max(1, ...totales));
  const y = function (v) { return arriba + (1 - v / maximo) * (alto - arriba - abajo); };
  const grupo = (ancho - izq) / Math.max(1, etiquetas.length);
  const barra = op.apiladas ? Math.min(90, grupo * 0.55) : Math.min(34, grupo * 0.8 / series.length);
  let svg = '<svg class="tab-svg" viewBox="0 0 ' + ancho + ' ' + alto + '">';
  const div = divisionesEje(maximo);
  for (let i = 0; i <= div; i++) {
    const v = maximo * i / div;
    svg += '<line x1="' + izq + '" x2="' + ancho + '" y1="' + y(v) + '" y2="' + y(v) + '" class="tab-guia"/>' +
      '<text x="' + (izq - 6) + '" y="' + (y(v) + 4) + '" text-anchor="end" class="tab-eje">' + esc(op.formato ? op.formato(v, true) : numero(v)) + '</text>';
  }
  etiquetas.forEach(function (et, i) {
    const centro = izq + i * grupo + grupo / 2;
    if (op.apiladas) {
      let base = 0;
      series.forEach(function (s) {
        const v = s.valores[i] || 0;
        if (!v) return;
        const y1 = y(base + v), y0 = y(base);
        svg += '<rect x="' + (centro - barra / 2) + '" y="' + y1 + '" width="' + barra + '" height="' + (y0 - y1) + '" fill="' + s.color + '"/>';
        if (y0 - y1 > 18) svg += '<text x="' + centro + '" y="' + ((y0 + y1) / 2 + 4) + '" text-anchor="middle" class="tab-valor-dentro">' + esc(op.formato(v)) + '</text>';
        base += v;
      });
      if (totales[i]) svg += '<text x="' + centro + '" y="' + (y(totales[i]) - 6) + '" text-anchor="middle" class="tab-valor">' + esc(op.formato(totales[i])) + '</text>';
    } else {
      series.forEach(function (s, j) {
        const v = s.valores[i] || 0;
        if (!v) return;
        const x = centro - barra * series.length / 2 + j * barra;
        svg += '<rect x="' + (x + 1) + '" y="' + y(v) + '" width="' + (barra - 2) + '" height="' + (y(0) - y(v)) + '" fill="' + s.color + '"/>' +
          '<text x="' + (x + barra / 2) + '" y="' + (y(v) - 5) + '" text-anchor="middle" class="tab-valor chico">' + esc(op.formato ? op.formato(v) : numero(v)) + '</text>';
      });
    }
    svg += '<text x="' + centro + '" y="' + (alto - 8) + '" text-anchor="middle" class="tab-eje">' + esc(et) + '</text>';
  });
  svg += '<line x1="' + izq + '" x2="' + ancho + '" y1="' + y(0) + '" y2="' + y(0) + '" class="tab-base"/></svg>';
  return svg;
}

function tabTablaDatos(filas) {
  return '<table class="tab-tabla">' + filas.map(function (f) {
    return '<tr><td>' + esc(f[0]) + '</td><td class="der">' + esc(f[1]) + '</td></tr>';
  }).join('') + '</table>';
}

function tabTabla(cabeceras, filas, alineaDerecha) {
  return '<table class="tab-tabla con-cabecera"><thead><tr>' + cabeceras.map(function (c, i) {
    return '<th' + (alineaDerecha && alineaDerecha.indexOf(i) !== -1 ? ' class="der"' : '') + '>' + esc(c) + '</th>';
  }).join('') + '</tr></thead><tbody>' + filas.map(function (f) {
    return '<tr>' + f.map(function (v, i) { return '<td' + (alineaDerecha && alineaDerecha.indexOf(i) !== -1 ? ' class="der"' : '') + '>' + esc(v) + '</td>'; }).join('') + '</tr>';
  }).join('') + '</tbody></table>';
}

function tabAviso(titulo, items) {
  if (!items.length) return '';
  return '<div class="tab-aviso"><b>' + esc(titulo) + '</b><ul>' + items.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul></div>';
}

function tabPie(texto) {
  return '<footer class="tab-pie">' + esc(texto) + '</footer>';
}

/** "$212.700" (sin espacio, como en los tableros de referencia) */
function pesosT(v) {
  return pesos(Math.round(Number(v) || 0)).replace(/\s/g, '');
}

function pesosCortos(v, eje) {
  const a = Math.abs(v);
  if (a >= 1000) return '$' + (eje ? Math.round(v / 1000) : (Math.round(v / 100) / 10).toString().replace('.', ',')) + 'k';
  return '$' + Math.round(v);
}

function fechaLarga(texto) {
  const p = texto.split('-');
  return Number(p[2]) + ' de ' + NOMBRES_MESES[Number(p[1]) - 1] + ' de ' + p[0];
}

function mayuscula(texto) {
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : '';
}

function listaNatural(items) {
  if (items.length <= 1) return items.join('');
  return items.slice(0, -1).join(', ') + ' y ' + items[items.length - 1];
}

/* ---------- Tablero productivo · Huerta ---------- */

async function htmlTableroHuerta() {
  const h = await cargarHuerta();
  const hoy = hoyTexto();
  const anio = hoy.slice(0, 4);
  const activas = h.siembras.filter(function (s) { return HUERTA.activas.indexOf(s.estado) !== -1; });
  const cultivosActivos = {};
  activas.forEach(function (s) { cultivosActivos[nombreCultivo(h, s.cultivoId)] = (cultivosActivos[nombreCultivo(h, s.cultivoId)] || 0) + 1; });
  const cosechasAnio = h.cosechas.filter(function (c) { return c.fecha.slice(0, 4) === anio; });
  const kgAnio = cosechasAnio.reduce(function (t, c) { return t + (Number(c.kg) || 0); }, 0);
  const cultivosCosechados = Object.keys(cosechasAnio.reduce(function (m, c) {
    const s = h.siembrasPorId[c.siembraId]; if (s) m[nombreCultivo(h, s.cultivoId).toLowerCase()] = true; return m;
  }, {}));
  const almacigos = h.almacigos.filter(function (a) { return a.fechaSiembra.slice(0, 4) === anio; });
  const celdas = almacigos.reduce(function (t, a) { return t + (Number(a.cantidadCeldas) || 0) * (Number(a.cantidadBandejas) || 1); }, 0);
  const germinadas = almacigos.reduce(function (t, a) { return t + (Number(a.germinadasDia7) || 0) + (Number(a.germinadasDia10) || 0) + (Number(a.germinadasDia14) || 0); }, 0);

  // Colores por parcela
  const colorParcela = {};
  h.parcelas.forEach(function (p, i) { colorParcela[p.id] = COLORES_GRUPO_TABLERO[i % COLORES_GRUPO_TABLERO.length]; });
  // Parcelas con más siembras activas primero (como en el tablero de referencia)
  const cantidadPorParcela = {};
  activas.forEach(function (s) { cantidadPorParcela[s.parcelaId] = (cantidadPorParcela[s.parcelaId] || 0) + 1; });
  const ordenParcelas = h.parcelas.slice().sort(function (a, b) { return (cantidadPorParcela[b.id] || 0) - (cantidadPorParcela[a.id] || 0); });
  ordenParcelas.forEach(function (p, i) { colorParcela[p.id] = COLORES_GRUPO_TABLERO[i % COLORES_GRUPO_TABLERO.length]; });
  const ordenadas = activas.slice().sort(function (a, b) {
    const pa = ordenParcelas.findIndex(function (p) { return p.id === a.parcelaId; }), pb = ordenParcelas.findIndex(function (p) { return p.id === b.parcelaId; });
    const la = h.lomosPorId[a.lomoId], lb = h.lomosPorId[b.lomoId];
    return pa - pb || (la ? Number(la.numero) : 0) - (lb ? Number(lb.numero) : 0);
  });
  const etiquetaLugar = function (s) {
    const l = h.lomosPorId[s.lomoId];
    return nombreParcela(h, s.parcelaId) + (l ? ' L' + l.numero : '');
  };
  const dias = function (s) { return diasEntre(s.fechaSiembra, hoy); };
  const maxDias = Math.max(30, ...activas.map(dias).sort(function (a, b) { return b - a; }).slice(1, 2));
  const pasos = []; for (let v = 0; v <= Math.ceil(maxDias / 30) * 30; v += 30) pasos.push(v);

  // Frase: en qué meses se concentraron las siembras y cuándo llega la cosecha
  let frase = '';
  if (activas.length) {
    const porMes = {};
    activas.forEach(function (s) { const m = s.fechaSiembra.slice(0, 7); porMes[m] = (porMes[m] || 0) + 1; });
    const meses = Object.keys(porMes).sort();
    let mejor = { n: 0 };
    meses.forEach(function (m, i) {
      const n = porMes[m] + (porMes[meses[i + 1]] || 0);
      if (n > mejor.n) mejor = { n: n, desde: m, hasta: porMes[meses[i + 1]] ? meses[i + 1] : m };
    });
    const grupo = activas.filter(function (s) { const m = s.fechaSiembra.slice(0, 7); return m >= mejor.desde && m <= mejor.hasta; });
    const finCiclo = grupo.map(function (s) {
      const c = h.cultivosPorId[s.cultivoId];
      const n = c && String(c.diasACosechaTexto || '').match(/\d+/);
      return sumarDias(s.fechaSiembra, n ? Number(n[0]) : duracionCicloDias(c) || 90).slice(0, 7);
    }).sort();
    const mesTexto = function (m) { return NOMBRES_MESES[Number(m.slice(5, 7)) - 1]; };
    frase = mejor.n + ' de las ' + activas.length + ' siembras activas se hicieron ' +
      (mejor.desde === mejor.hasta ? 'en ' + mesTexto(mejor.desde) : 'entre ' + mesTexto(mejor.desde) + ' y ' + mesTexto(mejor.hasta)) +
      (finCiclo.length ? (function () {
        // la mitad central de las fechas estimadas de cosecha (sin los extremos)
        const desde = finCiclo[Math.floor((finCiclo.length - 1) * 0.25)], hasta = finCiclo[Math.ceil((finCiclo.length - 1) * 0.75)];
        return ': la cosecha fuerte llega ' + (desde === hasta ? 'en ' + mesTexto(desde) : 'de ' + mesTexto(desde) + ' a ' + mesTexto(hasta));
      })() : '') + '.';
  }

  // Para mejorar el registro
  const avisos = [];
  const sinKg = activas.filter(function (s) {
    const c = h.cultivosPorId[s.cultivoId];
    const n = c && String(c.diasACosechaTexto || '').match(/\d+/);
    return dias(s) > (n ? Number(n[0]) : 120) && !h.cosechas.some(function (x) { return x.siembraId === s.id; });
  }).map(function (s) { return nombreCultivo(h, s.cultivoId).toLowerCase(); });
  if (sinKg.length) avisos.push('Faltan kg cosechados de ' + listaNatural(Object.keys(sinKg.reduce(function (m, x) { m[x] = 1; return m; }, {}))) + ' (ya superan su ciclo).');
  if (!h.analisisSuelo.some(function (a) { return a.fecha.slice(0, 4) === anio; })) avisos.push('Sin mediciones de pH ni CE este año.');
  const sinPlantas = activas.filter(function (s) { return !Number(s.cantidadPlantas); }).length;
  if (sinPlantas) avisos.push('Falta la cantidad de plantas en ' + sinPlantas + ' siembra' + (sinPlantas === 1 ? '' : 's') + '.');
  const riegosRaros = h.riegos.filter(function (r) { return !Number(r.litros) && !Number(r.laminaMm) || Number(r.laminaMm) > 150; });
  if (riegosRaros.length) avisos.push(riegosRaros.length + ' riego' + (riegosRaros.length === 1 ? '' : 's') + ' sin cantidad o con un valor fuera de lo normal: revisar la carga.');
  const sinSuperficie = h.parcelas.filter(function (p) { return p.activa !== 'false' && !Number(p.superficieM2); }).map(function (p) { return p.nombre; });
  if (sinSuperficie.length) avisos.push('Falta la superficie de ' + listaNatural(sinSuperficie) + '.');

  // Pie: lotes por parcela
  const resumenLotes = ordenParcelas.filter(function (p) { return activas.some(function (s) { return s.parcelaId === p.id; }); }).map(function (p) {
    const nums = activas.filter(function (s) { return s.parcelaId === p.id && h.lomosPorId[s.lomoId]; }).map(function (s) { return Number(h.lomosPorId[s.lomoId].numero); }).sort(function (a, b) { return a - b; });
    return p.nombre + (nums.length ? ' L' + nums[0] + (nums.length > 1 ? '–L' + nums[nums.length - 1] : '') : '');
  });

  const rankingCultivos = Object.keys(cultivosActivos).sort(function (a, b) { return cultivosActivos[b] - cultivosActivos[a]; });
  return tabCabecera('Huerta', 'Tablero productivo', 'Datos al ' + fechaLarga(hoy), 'Fuente: registros de Huerta') +
    tabIndicadores([
      { valor: String(activas.length), texto: 'siembras activas' },
      { valor: String(rankingCultivos.length), texto: 'cultivos distintos' },
      { valor: numero(kgAnio) + ' kg', texto: 'cosecha registrada' + (cultivosCosechados.length ? ' (' + listaNatural(cultivosCosechados) + ')' : '') },
      { valor: celdas ? numero(Math.round(germinadas * 1000 / celdas) / 10) + '%' : '—', texto: 'germinación de almácigos' + (celdas ? ' (' + germinadas + ' de ' + celdas + ' celdas)' : ''), color: PALETA_TABLERO.verde }
    ]) +
    '<div class="tab-cuerpo"><section class="tab-izq">' +
      tabTitulo('Días desde la siembra, por lote', frase) +
      tabLeyenda(ordenParcelas.filter(function (p) { return activas.some(function (s) { return s.parcelaId === p.id; }); })
        .map(function (p) { return { texto: p.nombre, color: colorParcela[p.id] }; })) +
      tabBarras(ordenadas.map(function (s) {
        return { titulo: nombreCultivo(h, s.cultivoId), sub: etiquetaLugar(s), valor: dias(s), texto: dias(s) + ' d', color: colorParcela[s.parcelaId] };
      }), { eje: pasos, unidad: 'días', quiebre: true }) +
    '</section><section class="tab-der">' +
      tabTitulo('Siembras por cultivo') +
      tabBarras(rankingCultivos.map(function (c, i) {
        return { titulo: c, valor: cultivosActivos[c], texto: String(cultivosActivos[c]), color: i < 2 ? PALETA_TABLERO.verde : PALETA_TABLERO.verdeClaro };
      })) +
      (almacigos.length ? tabTitulo('Germinación de almácigos') + '<div class="tab-germinacion">' + almacigos.map(function (a) {
        const total = (Number(a.cantidadCeldas) || 0) * (Number(a.cantidadBandejas) || 1);
        const g = (Number(a.germinadasDia7) || 0) + (Number(a.germinadasDia10) || 0) + (Number(a.germinadasDia14) || 0);
        const pct = porcentajeGerminacion(a);
        return '<div class="tab-fila"><div class="tab-etiqueta izq"><b>' + esc(nombreCultivo(h, a.cultivoId)) + '</b><small>' + g + ' de ' + total + ' celdas</small></div>' +
          '<div class="tab-pista fondo"><i style="width:' + Math.min(100, pct || 0) + '%;background:' + PALETA_TABLERO.verde + '"></i></div>' +
          '<b class="tab-pct">' + (pct === null ? '—' : numero(pct) + '%') + '</b></div>';
      }).join('') + '</div>' : '') +
      tabAviso('Para mejorar el registro', avisos) +
    '</section></div>' +
    tabPie('Lotes: ' + resumenLotes.join(' · ') + '. Días contados al ' + formatearFecha(hoy) + '.');
}

/* ---------- Tablero productivo · Forrajes ---------- */

function nombreCortoMezcla(f, siembraId) {
  const especies = especiesDeSiembra(f, siembraId);
  if (especies.length > 1) return 'Pastura consociada';
  return especies.length ? nombreEspecie(f, especies[0].especieId).replace(/\s*\(.*\)\s*/g, '') : 'Sin especie';
}

function lugarCorto(f, s) {
  const c = f.cuadrosPorId[s.cuadroId];
  return nombreLote(f, s.loteId) + (c ? ' · C' + c.numero : '');
}

async function htmlTableroForrajes() {
  const f = await cargarForrajes();
  const hoy = hoyTexto();
  const siembras = f.siembrasForraje.filter(function (s) { return s.estado !== 'Perdida'; });
  const lotes = {};
  siembras.forEach(function (s) { lotes[s.loteId] = true; });
  const usos = { Heno: 0, Pastoreo: 0, Ambas: 0 };
  siembras.forEach(function (s) { usos[s.usoPrevisto] = (usos[s.usoPrevisto] || 0) + 1; });
  const semilla = function (s) { return especiesDeSiembra(f, s.id).reduce(function (t, e) { return t + (Number(e.cantidadSemillaKg) || 0); }, 0); };
  const totalSemilla = siembras.reduce(function (t, s) { return t + semilla(s); }, 0);
  const cosechas = f.cosechasForraje.filter(function (c) { return c.fecha.slice(0, 4) === hoy.slice(0, 4); });
  const kg = cosechas.reduce(function (t, c) { return t + (Number(c.cantidadTotalKg) || 0); }, 0);
  const rollos = cosechas.reduce(function (t, c) { return t + (Number(c.cantidadRollos) || 0); }, 0);
  const especiesCosechadas = Object.keys(cosechas.reduce(function (m, c) { if (c.especieId) m[nombreEspecie(f, c.especieId).replace(/\s*\(.*\)\s*/g, '').toLowerCase()] = 1; return m; }, {}));
  const siembrasCosechadas = siembras.filter(function (s) { return cosechas.some(function (c) { return c.siembraId === s.id; }); });
  const semillaCosechadas = siembrasCosechadas.reduce(function (t, s) { return t + semilla(s); }, 0);
  const colorUso = { Heno: PALETA_TABLERO.verde, Pastoreo: PALETA_TABLERO.marron, Ambas: PALETA_TABLERO.verdeClaro };
  const ultimaCosecha = function (s) { return f.cosechasForraje.filter(function (c) { return c.siembraId === s.id; }).map(function (c) { return c.fecha; }).sort().pop() || ''; };
  const diasCiclo = function (s) { const u = ultimaCosecha(s); return diasEntre(s.fechaSiembra, s.estado === 'En crecimiento' || !u ? hoy : u); };
  const ordenadas = siembras.slice().sort(function (a, b) { return diasCiclo(b) - diasCiclo(a); });
  const pasos = []; for (let v = 0; v <= Math.ceil(Math.max(30, ...ordenadas.map(diasCiclo)) / 30) * 30; v += 30) pasos.push(v);
  const lluvia = function (s) { return lluviaEntre(f, s.loteId, s.cuadroId, s.fechaSiembra, s.estado === 'En crecimiento' || !ultimaCosecha(s) ? hoy : ultimaCosecha(s)); };

  // Frase
  const partesFrase = siembrasCosechadas.map(function (s) {
    return 'El corte de ' + nombreCortoMezcla(f, s.id).toLowerCase() + ' del ' + nombreLote(f, s.loteId) + ' se hizo a los ' + diasEntre(s.fechaSiembra, ultimaCosecha(s)) + ' días';
  });
  const largas = siembras.filter(function (s) { return diasCiclo(s) > 120 && !f.cosechasForraje.some(function (c) { return c.siembraId === s.id; }) && !pastoreosDeSiembra(f, s.id).length; })
    .map(function (s) { return nombreCortoMezcla(f, s.id).toLowerCase(); });
  const frase = [partesFrase.join('. '), largas.length ? mayuscula(listaNatural(Object.keys(largas.reduce(function (m, x) { m[x] = 1; return m; }, {})))) + ' superan los 120 días sin cortes ni pastoreos cargados' : '']
    .filter(Boolean).join('. ') + (partesFrase.length || largas.length ? '.' : '');

  // Última cosecha: tabla de datos
  const ultima = f.cosechasForraje.slice().sort(function (a, b) { return b.fecha.localeCompare(a.fecha); })[0];
  let fichaCosecha = '';
  if (ultima) {
    const s = f.siembrasForrajePorId[ultima.siembraId];
    fichaCosecha = tabTitulo('Cosecha de ' + (ultima.especieId ? nombreEspecie(f, ultima.especieId).replace(/\s*\(.*\)\s*/g, '').toLowerCase() : 'forraje')) +
      tabTablaDatos([
        s ? ['Siembra → cosecha', diaMes(s.fechaSiembra) + ' → ' + formatearFecha(ultima.fecha)] : null,
        s ? ['Ciclo', diasEntre(s.fechaSiembra, ultima.fecha) + ' días'] : null,
        ['Forraje cosechado', numero(ultima.cantidadTotalKg) + ' kg'],
        ultima.cantidadRollos ? ['Rollos', ultima.cantidadRollos + (ultima.pesoPromedioRolloKg ? ' (≈' + numero(ultima.pesoPromedioRolloKg) + ' kg c/u)' : '')] : null,
        s ? ['Lluvia del ciclo', numero(Math.round(lluviaEntre(f, s.loteId, s.cuadroId, s.fechaSiembra, ultima.fecha))) + ' mm'] : null
      ].filter(Boolean));
  }

  // Para mejorar el registro
  const avisos = [];
  const sinPastoreo = siembras.filter(function (s) {
    return s.usoPrevisto !== 'Heno' && diasCiclo(s) > 90 && !pastoreosDeSiembra(f, s.id).length &&
      !f.cosechasForraje.some(function (c) { return c.siembraId === s.id && c.tipoAprovechamiento === 'Pastoreo directo'; });
  }).map(function (s) { return nombreLote(f, s.loteId); });
  if (sinPastoreo.length) avisos.push('Cargar los pastoreos de ' + listaNatural(Object.keys(sinPastoreo.reduce(function (m, x) { m[x] = 1; return m; }, {}))) + '.');
  const sinSuperficie = f.lotes.filter(function (l) { return l.activo !== 'false' && !Number(l.superficieHa); }).map(function (l) { return l.nombre; });
  if (sinSuperficie.length) avisos.push('Falta la superficie de ' + listaNatural(sinSuperficie) + ' (no se puede calcular kg/ha).');
  const enCampo = f.cortesForraje.filter(function (c) { return c.enrollado !== 'true'; }).length;
  if (enCampo) avisos.push(enCampo + ' corte' + (enCampo === 1 ? '' : 's') + ' en el campo sin enrollar (ver Henificación).');
  const sinStock = f.cosechasForraje.filter(function (c) { return c.tipoAprovechamiento !== 'Pastoreo directo' && c.ingresadaAInventario !== 'true'; }).length;
  if (sinStock) avisos.push(sinStock + ' cosecha' + (sinStock === 1 ? '' : 's') + ' sin ingresar al stock de reservas.');

  const piePartes = siembras.map(function (s) {
    const c = f.cuadrosPorId[s.cuadroId];
    const ha = c ? c.superficieHa : f.lotesPorId[s.loteId] && f.lotesPorId[s.loteId].superficieHa;
    return nombreLote(f, s.loteId) + (c ? ' Cuadro ' + c.numero : '') + (ha ? ' (' + numero(ha) + ' ha)' : '') + ': ' + nombreCortoMezcla(f, s.id).toLowerCase();
  });

  return tabCabecera('Forrajes', 'Tablero productivo', 'Datos al ' + fechaLarga(hoy), 'Fuente: registros de Forrajes') +
    tabIndicadores([
      { valor: String(siembras.length), texto: 'siembras en ' + Object.keys(lotes).length + ' lotes (' + ['Heno', 'Pastoreo', 'Ambas'].filter(function (u) { return usos[u]; }).map(function (u) { return usos[u] + ' ' + u.toLowerCase(); }).join(' · ') + ')' },
      { valor: numero(totalSemilla) + ' kg', texto: 'de semilla sembrada' },
      { valor: numero(kg) + ' kg', texto: (especiesCosechadas.length ? 'de ' + listaNatural(especiesCosechadas) + ' cosechada' : 'cosechados') + (rollos ? ' en ' + rollos + ' rollos' : ''), color: PALETA_TABLERO.verde },
      { valor: semillaCosechadas ? numero(Math.round(kg / semillaCosechadas * 10) / 10) : '—', texto: 'kg de forraje por kg de semilla' + (especiesCosechadas.length ? ' (' + listaNatural(especiesCosechadas) + ')' : ''), color: PALETA_TABLERO.verde }
    ]) +
    '<div class="tab-cuerpo"><section class="tab-izq">' +
      tabTitulo('Días desde la siembra, por lote', frase) +
      tabLeyenda(['Heno', 'Pastoreo', 'Ambas'].filter(function (u) { return usos[u]; }).map(function (u) { return { texto: u, color: colorUso[u] }; })) +
      tabBarras(ordenadas.map(function (s) {
        const u = ultimaCosecha(s);
        return { titulo: nombreCortoMezcla(f, s.id), sub: lugarCorto(f, s), valor: diasCiclo(s),
          texto: diasCiclo(s) + ' d' + (u ? ' · ' + (s.estado === 'En crecimiento' ? 'con corte' : 'cosechada') : '') +
            (pastoreosDeSiembra(f, s.id).length ? ' · ' + pastoreosDeSiembra(f, s.id).length + ' pastoreo' + (pastoreosDeSiembra(f, s.id).length === 1 ? '' : 's') : ''),
          color: colorUso[s.usoPrevisto] || PALETA_TABLERO.gris };
      }), { eje: pasos, unidad: 'días' }) +
      tabTitulo('Lluvia acumulada desde la siembra') +
      tabBarras(ordenadas.map(function (s) {
        return { titulo: nombreCortoMezcla(f, s.id), sub: lugarCorto(f, s), valor: lluvia(s), texto: numero(Math.round(lluvia(s))) + ' mm', color: colorUso[s.usoPrevisto] || PALETA_TABLERO.gris };
      })) +
    '</section><section class="tab-der">' +
      tabTitulo('Semilla sembrada por lote') +
      tabBarras(ordenadas.filter(function (s) { return semilla(s); }).map(function (s) {
        return { titulo: nombreCortoMezcla(f, s.id), sub: lugarCorto(f, s), valor: semilla(s), texto: numero(semilla(s)) + ' kg', color: colorUso[s.usoPrevisto] || PALETA_TABLERO.gris };
      })) +
      fichaCosecha +
      tabAviso('Para mejorar el registro', avisos) +
    '</section></div>' +
    tabPie(piePartes.join(' · ') + '. Días contados al ' + formatearFecha(hoy) + '.');
}

/* ---------- Tablero económico (Huerta y Forrajes) ---------- */

/** Agrupa productos en conceptos (para entender en qué se gasta / de dónde vienen los ingresos). */
function conceptoEgreso(producto) {
  const t = String(producto || '').toLowerCase();
  if (/semill|tr[eé]bol|avena|alfalfa|raigr|moha|vicia|cebadilla/.test(t)) return 'Semillas';
  if (/diesel|di[eé]sel|gasoil|gas oil|nafta|combustible/.test(t)) return 'Gasoil';
  if (/plant[ií]n/.test(t)) return 'Plantines';
  if (/sustrato|tierra|abono|fertiliz|compost|enmienda/.test(t)) return 'Sustratos y fertilizantes';
  if (/riego|manguera|aspersor|gotero|cinta|microaspersor/.test(t)) return 'Riego';
  if (/herbicid|insecticid|fungicid|agroqu|fitosanit/.test(t)) return 'Fitosanitarios';
  return 'Varios';
}

function origenIngreso(producto, entorno) {
  const t = String(producto || '').toLowerCase();
  if (/combo/.test(t)) return 'Combos';
  if (/plant[ií]n/.test(t)) return 'Plantines';
  if (/rollo|fardo|heno/.test(t)) return 'Rollos y fardos';
  if (/alcaucil/.test(t)) return 'Alcaucil';
  return entorno === 'Huerta' ? 'Verdura de huerta' : mayuscula(t.trim()) || 'Otros';
}

async function htmlTableroEconomico(entorno) {
  const hoy = hoyTexto();
  const periodo = calcularPeriodo('anio');
  const d = await datosEconomicos(entorno, periodo);
  const conMovimiento = d.porMes.filter(function (m) { return m.ingresos || m.egresos; });
  const mesNombre = function (m) { return mayuscula(NOMBRES_MESES[Number(m.slice(5, 7)) - 1]); };
  const meta1 = conMovimiento.length
    ? (conMovimiento.length === 1 ? mesNombre(conMovimiento[0].mes) : mesNombre(conMovimiento[0].mes) + ' a ' + NOMBRES_MESES[Number(conMovimiento[conMovimiento.length - 1].mes.slice(5, 7)) - 1]) + ' de ' + periodo.desde.slice(0, 4)
    : 'Año ' + periodo.desde.slice(0, 4);
  const conIngresos = d.ingresos.length > 0;
  const etiquetas = conMovimiento.map(function (m) { return mesNombre(m.mes).slice(0, 3); });
  const concepto = {};
  d.egresos.forEach(function (e) { const c = conceptoEgreso(e.producto); concepto[c] = (concepto[c] || 0) + (Number(e.valor) || 0); });
  const conceptos = Object.keys(concepto).sort(function (a, b) { return concepto[b] - concepto[a]; });
  const pct = function (v, total) { return total ? Math.round(v * 100 / total) : 0; };

  // Mes de mayor gasto y su detalle
  const mesGasto = d.porMes.slice().sort(function (a, b) { return b.egresos - a.egresos; })[0];
  let fraseGasto = '';
  if (mesGasto && mesGasto.egresos) {
    const delMes = d.egresos.filter(function (e) { return e.fecha.slice(0, 7) === mesGasto.mes; });
    const conceptosMes = Object.keys(delMes.reduce(function (m, e) { m[conceptoEgreso(e.producto).toLowerCase()] = 1; return m; }, {}));
    fraseGasto = mesNombre(mesGasto.mes) + ' concentra el ' + pct(mesGasto.egresos, d.totalEgresos) + '% del gasto' + (conceptosMes.length ? ': ' + listaNatural(conceptosMes) : '') + '.';
  }

  let kpis, izquierda, derecha, avisos = [], pie;
  if (conIngresos) {
    const sinMes = d.balance + (mesGasto ? mesGasto.egresos : 0);
    kpis = [
      { valor: pesosT(d.totalIngresos), texto: 'ingresos · ' + d.ingresos.length + ' ventas', color: PALETA_TABLERO.verde },
      { valor: pesosT(d.totalEgresos), texto: 'egresos · ' + d.egresos.length + ' facturas' },
      { valor: (d.balance < 0 ? '−' : '+') + pesosT(Math.abs(d.balance)), texto: 'saldo del período', color: d.balance < 0 ? PALETA_TABLERO.rojo : PALETA_TABLERO.verde },
      mesGasto && mesGasto.egresos && pct(mesGasto.egresos, d.totalEgresos) >= 40
        ? { valor: (sinMes < 0 ? '−' : '+') + pesosT(Math.abs(sinMes)), texto: 'saldo sin las compras de ' + NOMBRES_MESES[Number(mesGasto.mes.slice(5, 7)) - 1] + ' (' + pesosT(mesGasto.egresos) + ')', color: sinMes < 0 ? PALETA_TABLERO.rojo : PALETA_TABLERO.verde }
        : { valor: pesosT(d.ventaPromedio), texto: 'venta promedio' }
    ];
    izquierda = tabTitulo('Ingresos y egresos por mes', fraseGasto) +
      tabLeyenda([{ texto: 'Ingresos', color: PALETA_TABLERO.verde }, { texto: 'Egresos', color: PALETA_TABLERO.beige }]) +
      tabColumnas(etiquetas, [
        { nombre: 'Ingresos', valores: conMovimiento.map(function (m) { return m.ingresos; }), color: PALETA_TABLERO.verde },
        { nombre: 'Egresos', valores: conMovimiento.map(function (m) { return m.egresos; }), color: PALETA_TABLERO.beige }
      ], { formato: pesosCortos }) +
      '<p class="tab-nota">Meses sin barra: sin movimientos registrados.</p>';
    const origen = {};
    d.ingresos.forEach(function (i) { const o = origenIngreso(i.producto, entorno.nombre); origen[o] = (origen[o] || 0) + (Number(i.valor) || 0); });
    const origenes = Object.keys(origen).sort(function (a, b) { return origen[b] - origen[a]; }).slice(0, 5);
    const pagos = {};
    d.ingresos.forEach(function (i) { pagos[i.tipoPago || 'Sin dato'] = (pagos[i.tipoPago || 'Sin dato'] || 0) + (Number(i.valor) || 0); });
    const medios = Object.keys(pagos).sort(function (a, b) { return pagos[b] - pagos[a]; });
    const proveedores = {};
    d.egresos.forEach(function (e) {
      const p = normalizarNombre(e.proveedor) || 'Sin proveedor';
      proveedores[p] = proveedores[p] || { monto: 0, conceptos: {} };
      proveedores[p].monto += Number(e.valor) || 0;
      proveedores[p].conceptos[normalizarNombre(e.producto)] = 1;
    });
    derecha = tabTitulo('Origen de los ingresos') +
      '<div class="tab-origen">' + origenes.map(function (o, i) {
        return '<div class="tab-fila"><div class="tab-etiqueta">' + esc(o) + '</div><div class="tab-pista"><i style="width:' + Math.max(2, origen[o] / origen[origenes[0]] * 100) + '%;background:' +
          (i === 0 ? PALETA_TABLERO.verde : PALETA_TABLERO.verdeClaro) + '"></i><em style="left:calc(' + Math.max(2, origen[o] / origen[origenes[0]] * 100) + '% + 6px)"><b>' + pct(origen[o], d.totalIngresos) + '%</b><small>' + esc(pesosT(origen[o])) + '</small></em></div></div>';
      }).join('') + '</div>' +
      tabTitulo('Medio de cobro') +
      '<div class="tab-apilada">' + medios.map(function (m, i) {
        return '<span style="width:' + pct(pagos[m], d.totalIngresos) + '%;background:' + (i === 0 ? PALETA_TABLERO.verde : PALETA_TABLERO.marron) + '">' + pct(pagos[m], d.totalIngresos) + '%</span>';
      }).join('') + '</div><div class="tab-apilada-pie">' + medios.map(function (m) { return '<span>' + esc(m + ' · ' + pesosT(pagos[m])) + '</span>'; }).join('') + '</div>' +
      tabTitulo('Gasto por proveedor') +
      tabTabla(['Proveedor', 'Concepto', 'Monto'], Object.keys(proveedores).sort(function (a, b) { return proveedores[b].monto - proveedores[a].monto; }).slice(0, 6).map(function (p) {
        return [p, Object.keys(proveedores[p].conceptos).slice(0, 3).join(', '), pesosT(proveedores[p].monto)];
      }), [2]);
    const mejorVentas = d.porMes.slice().sort(function (a, b) { return b.ingresos - a.ingresos; })[0];
    const ventasMejor = mejorVentas ? d.ingresos.filter(function (i) { return i.fecha.slice(0, 7) === mejorVentas.mes; }).length : 0;
    pie = 'Ticket promedio: ' + pesosT(d.ventaPromedio) + ' por venta.' + (mejorVentas && mejorVentas.ingresos ? ' Mejor mes de ventas: ' + NOMBRES_MESES[Number(mejorVentas.mes.slice(5, 7)) - 1] + ' (' + ventasMejor + ' ventas).' : '') +
      (d.remitos.length ? ' Remitos internos: ' + pesosT(d.totalRemitos) + ' en ' + d.remitos.length + ' entregas.' : '');
  } else {
    // Sin ventas (típico de Forrajes): el foco es el gasto
    const top = conceptos.slice(0, 2);
    kpis = [
      { valor: pesosT(d.totalEgresos), texto: 'egresos · ' + d.egresos.length + ' facturas', color: PALETA_TABLERO.rojo },
      top[0] ? { valor: pesosT(concepto[top[0]]), texto: top[0].toLowerCase() + ' (' + pct(concepto[top[0]], d.totalEgresos) + '%)' } : { valor: '—', texto: 'sin egresos' },
      top[1] ? { valor: pesosT(concepto[top[1]]), texto: top[1].toLowerCase() + ' (' + pct(concepto[top[1]], d.totalEgresos) + '%)' } : { valor: pesosT(d.totalRemitos), texto: 'remitos internos' },
      { valor: '$0', texto: 'ingresos registrados' + (entorno.clave === 'forrajes' ? ' · forraje de uso interno' : '') }
    ];
    const coloresConcepto = [PALETA_TABLERO.verde, PALETA_TABLERO.marron, PALETA_TABLERO.verdeClaro, PALETA_TABLERO.gris];
    const series = conceptos.slice(0, 3).map(function (c, i) {
      return { nombre: c, color: coloresConcepto[i], valores: conMovimiento.map(function (m) {
        return d.egresos.filter(function (e) { return e.fecha.slice(0, 7) === m.mes && conceptoEgreso(e.producto) === c; }).reduce(function (t, e) { return t + (Number(e.valor) || 0); }, 0);
      }) };
    });
    if (conceptos.length > 3) series.push({ nombre: 'Otros', color: coloresConcepto[3], valores: conMovimiento.map(function (m) {
      return d.egresos.filter(function (e) { return e.fecha.slice(0, 7) === m.mes && conceptos.slice(0, 3).indexOf(conceptoEgreso(e.producto)) === -1; }).reduce(function (t, e) { return t + (Number(e.valor) || 0); }, 0);
    }) });
    izquierda = tabTitulo('Egresos por mes y concepto', fraseGasto) +
      tabLeyenda(series.map(function (s) { return { texto: s.nombre, color: s.color }; })) +
      tabColumnas(conMovimiento.map(function (m) { return mesNombre(m.mes); }), series, { apiladas: true, formato: function (v, eje) { return eje ? pesosCortos(v, true) : pesosT(v); } });
    const forrajes = entorno.clave === 'forrajes' ? await cargarForrajes() : null;
    const kgCosechado = forrajes ? forrajes.cosechasForraje.filter(function (c) { return enPeriodo(c.fecha, periodo); }).reduce(function (t, c) { return t + (Number(c.cantidadTotalKg) || 0); }, 0) : 0;
    const rollos = forrajes ? forrajes.cosechasForraje.filter(function (c) { return enPeriodo(c.fecha, periodo); }).reduce(function (t, c) { return t + (Number(c.cantidadRollos) || 0); }, 0) : 0;
    derecha = tabTitulo('Facturas') +
      tabTabla(['Fecha', 'Concepto', 'Proveedor', 'Monto'], d.egresos.slice().sort(function (a, b) { return b.fecha.localeCompare(a.fecha); }).slice(0, 8).map(function (e) {
        return [diaMes(e.fecha), e.producto, e.proveedor, pesosT(e.valor)];
      }), [3]) +
      (kgCosechado ? tabTitulo('Indicadores') + tabTablaDatos([
        ['Costo por kg de forraje cosechado', pesosT(d.totalEgresos / kgCosechado)],
        rollos ? ['Costo por rollo', pesosT(d.totalEgresos / rollos)] : null,
        concepto.Semillas ? ['Costo de semilla por kg cosechado', pesosT(concepto.Semillas / kgCosechado)] : null
      ].filter(Boolean)) : '');
    avisos.push('Para medir el aporte del entorno conviene valorizar ' + (entorno.clave === 'forrajes' ? 'los rollos y los pastoreos' : 'la producción entregada') + ' a precio de mercado.');
    pie = d.egresos.length + ' egresos registrados' + (d.remitos.length ? ' · remitos internos: ' + pesosT(d.totalRemitos) : '') + '.';
  }

  return tabCabecera(entorno.nombre, 'Tablero económico', meta1, 'Fuente: ingresos y egresos registrados') +
    tabIndicadores(kpis) +
    '<div class="tab-cuerpo"><section class="tab-izq">' + izquierda + '</section><section class="tab-der">' + derecha +
      (conIngresos ? '' : tabAviso('Sin ventas registradas', avisos)) +
    '</section></div>' + tabPie(pie);
}
