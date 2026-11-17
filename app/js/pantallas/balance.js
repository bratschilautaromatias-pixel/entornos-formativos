/**
 * BALANCE DE CAMPAÑA (solo el dueño): compara dos campañas con los datos cargados y guarda
 * las anotaciones de qué funcionó, qué no, y las mejoras para la campaña siguiente.
 * Campañas: otoño-invierno (1 de marzo al 31 de agosto) y primavera-verano (1 de septiembre a fin de febrero),
 * o fechas elegidas a mano.
 * Dirección: #/balance
 */
const BALANCE = {
  resultados: ['Funcionó', 'A medias', 'No funcionó'],
  iconoResultado: { 'Funcionó': '✅', 'A medias': '⚠️', 'No funcionó': '❌' },
  claseResultado: { 'Funcionó': 'bien', 'A medias': 'medio', 'No funcionó': 'mal' }
};
const estadoBalance = { entorno: 'huerta', a: '', b: '', aDesde: '', aHasta: '', bDesde: '', bHasta: '', pestana: 'comparar', todas: false };

PANTALLAS.balance = function () {
  if (!esDueno()) return ir('inicio');
  if (!estadoBalance.a) {
    estadoBalance.a = claveCampaniaDeFecha(hoyTexto());
    estadoBalance.b = moverCampania(estadoBalance.a, -2); // la misma época del año anterior
  }
  render(htmlBarra('Balance de campaña', 'inicio') +
    '<main class="contenido" id="pantalla-balance"><p class="vacio">Cargando…</p></main>');
  alActualizarDatos = dibujarBalance;
  dibujarBalance();
};

/* ---------- Campañas ---------- */

/** "OI-2026" → otoño-invierno 2026 · "PV-2026" → primavera-verano 2026/27 */
function campaniaPorClave(clave) {
  const m = /^(OI|PV)-(\d{4})$/.exec(clave || '');
  if (!m) return null;
  const anio = Number(m[2]);
  if (m[1] === 'OI') {
    return { clave: clave, desde: anio + '-03-01', hasta: anio + '-08-31', titulo: 'Otoño-invierno ' + anio };
  }
  return { clave: clave, desde: anio + '-09-01', hasta: fechaATexto(new Date(anio + 1, 2, 0)),
    titulo: 'Primavera-verano ' + anio + '/' + String(anio + 1).slice(2) };
}

function claveCampaniaDeFecha(fecha) {
  const anio = Number(fecha.slice(0, 4)), mes = Number(fecha.slice(5, 7));
  if (mes >= 3 && mes <= 8) return 'OI-' + anio;
  return 'PV-' + (mes <= 2 ? anio - 1 : anio);
}

/** Campaña que está "pasos" campañas después (o antes, si es negativo). */
function moverCampania(clave, pasos) {
  const m = /^(OI|PV)-(\d{4})$/.exec(clave || '');
  if (!m) return '';
  const indice = Number(m[2]) * 2 + (m[1] === 'PV' ? 1 : 0) + pasos;
  return (indice % 2 ? 'PV-' : 'OI-') + Math.floor(indice / 2);
}

function tituloCampania(clave) {
  const c = campaniaPorClave(clave);
  return c ? c.titulo : (clave || '');
}

/** Lista de campañas alrededor de la actual: "futuras" hacia adelante y "pasadas" hacia atrás (la más nueva primero). */
function listaCampanias(futuras, pasadas) {
  const actual = claveCampaniaDeFecha(hoyTexto());
  const lista = [];
  for (let i = futuras; i >= -pasadas; i--) lista.push(moverCampania(actual, i));
  return lista;
}

/** Período de un lado de la comparación ("a" = la campaña que se mira, "b" = con cuál se compara). */
function periodoBalance(lado) {
  const eb = estadoBalance;
  if (eb[lado] === 'manual') {
    const p = calcularPeriodo('rango', eb[lado + 'Desde'], eb[lado + 'Hasta']);
    return { clave: '', desde: p.desde, hasta: p.hasta, titulo: p.titulo };
  }
  return campaniaPorClave(eb[lado]);
}

function cambiarCampaniaBalance(lado, valor) {
  const eb = estadoBalance;
  if (valor === 'manual' && !eb[lado + 'Desde']) {
    const base = campaniaPorClave(eb[lado]) || campaniaPorClave(claveCampaniaDeFecha(hoyTexto()));
    eb[lado + 'Desde'] = base.desde;
    eb[lado + 'Hasta'] = base.hasta;
  }
  eb[lado] = valor;
  dibujarBalance();
}

/* ---------- Números de una campaña ---------- */

function sumaBalance(lista, valor) {
  return lista.reduce(function (t, x) { return t + (valor(x) || 0); }, 0);
}

/** { nombre: total } */
function agruparBalance(lista, clave, valor) {
  const grupos = {};
  lista.forEach(function (x) {
    const k = clave(x) || 'Sin dato';
    grupos[k] = (grupos[k] || 0) + (valor(x) || 0);
  });
  return grupos;
}

function lluviaPluviometroBalance(lecturas) {
  const porDia = {};
  lecturas.forEach(function (r) { porDia[r.fecha] = Math.max(porDia[r.fecha] || 0, Number(r.cantidadMm) || 0); });
  return Object.keys(porDia).reduce(function (t, d) { return t + porDia[d]; }, 0);
}

/**
 * Devuelve { secciones: [{ titulo, filas: [{ nombre, valor, formato, mejor }] }], detalles: [{ titulo, columna, formato, mejor, valores }] }.
 * mejor: 'mas' (conviene que suba), 'menos' (conviene que baje) o nada (solo informativo).
 */
async function numerosBalance(entorno, p) {
  const r = entorno.clave === 'forrajes' ? await numerosBalanceForrajes(p)
    : entorno.clave === 'maquinaria' ? await numerosBalanceMaquinaria(p)
    : entorno.clave === 'taller' ? await numerosBalanceTaller(p) : await numerosBalanceHuerta(p);

  // Tareas de la semana del entorno
  const tareas = (await Datos.listar('Tareas')).filter(function (t) { return t.entorno === entorno.nombre && enPeriodo(t.fecha, p); });
  const hechas = tareas.filter(function (t) { return t.estado === 'Realizada'; }).length;
  r.secciones.push({ titulo: 'Tareas de la semana', filas: [
    { nombre: 'Tareas programadas', valor: tareas.length, formato: 'n' },
    { nombre: 'Tareas realizadas', valor: hechas, formato: 'n', mejor: 'mas' },
    { nombre: 'Cumplimiento', valor: tareas.length ? hechas * 100 / tareas.length : null, formato: 'pct', mejor: 'mas' }
  ] });

  // Economía del entorno
  const tablas = await Promise.all(['Ingresos', 'Egresos', 'Remitos'].map(function (t) { return Datos.listar(t); }));
  const delEntorno = function (lista) { return lista.filter(function (m) { return m.entorno === entorno.nombre && enPeriodo(m.fecha, p); }); };
  const valor = function (m) { return Number(m.valor) || 0; };
  const ingresos = delEntorno(tablas[0]), egresos = delEntorno(tablas[1]), remitos = delEntorno(tablas[2]);
  r.secciones.push({ titulo: 'Economía', filas: [
    { nombre: 'Ingresos', valor: sumaBalance(ingresos, valor), formato: 'pesos', mejor: 'mas' },
    { nombre: 'Cantidad de ventas', valor: ingresos.length, formato: 'n', mejor: 'mas' },
    { nombre: 'Egresos', valor: sumaBalance(egresos, valor), formato: 'pesos' },
    { nombre: 'Resultado (ingresos − egresos)', valor: sumaBalance(ingresos, valor) - sumaBalance(egresos, valor), formato: 'pesos', mejor: 'mas' },
    { nombre: 'Remitos internos', valor: sumaBalance(remitos, valor), formato: 'pesos' }
  ] });
  const producto = function (m) { return normalizarNombre(m.producto); };
  r.detalles.push({ titulo: 'Ingresos por producto', columna: 'Producto', formato: 'pesos', mejor: 'mas', valores: agruparBalance(ingresos, producto, valor) });
  r.detalles.push({ titulo: 'Egresos por producto', columna: 'Producto', formato: 'pesos', valores: agruparBalance(egresos, producto, valor) });
  return r;
}

async function numerosBalanceHuerta(p) {
  const h = await cargarHuerta();
  const kg = function (c) { return Number(c.kg) || 0; };
  const siembraDe = function (id) { return h.siembrasPorId[id]; };
  const cultivoDe = function (s) { return s ? nombreCultivo(h, s.cultivoId) : 'Sin cultivo'; };
  const cosechas = h.cosechas.filter(function (c) { return enPeriodo(c.fecha, p); });
  const totalKg = sumaBalance(cosechas, kg);

  // Rendimiento: kg cosechados sobre la superficie de las siembras cosechadas (solo las que tienen superficie)
  const superficies = {};
  let kgConSuperficie = 0;
  cosechas.forEach(function (c) {
    const s = siembraDe(c.siembraId);
    const m2 = s ? superficieSiembraM2(h, s) : 0;
    if (m2 > 0) { superficies[s.id] = m2; kgConSuperficie += kg(c); }
  });
  const m2Total = Object.keys(superficies).reduce(function (t, id) { return t + superficies[id]; }, 0);

  const nuevas = h.siembras.filter(function (s) { return enPeriodo(s.fechaSiembra, p); });
  const almacigos = h.almacigos.filter(function (a) { return enPeriodo(a.fechaSiembra, p); });
  const propios = almacigos.filter(function (a) { return a.origen !== 'Comprado'; });
  const germinaciones = propios.map(porcentajeGerminacion).filter(function (x) { return x !== null; });
  const riegos = h.riegos.filter(function (x) { return enPeriodo(x.fecha, p); });
  const tratamientos = h.tratamientos.filter(function (t) { return enPeriodo(t.fecha, p); });
  const lluvias = h.lluviasHuerta.filter(function (x) { return enPeriodo(x.fecha, p) && !estaBajoCubierta(h, x.parcelaId); });

  return {
    secciones: [
      { titulo: 'Producción', filas: [
        { nombre: 'Kg cosechados', valor: totalKg, formato: 'kg', mejor: 'mas' },
        { nombre: 'Cosechas registradas', valor: cosechas.length, formato: 'n' },
        { nombre: 'Cultivos cosechados', valor: Object.keys(agruparBalance(cosechas, function (c) { return cultivoDe(siembraDe(c.siembraId)); }, kg)).length, formato: 'n', mejor: 'mas' },
        { nombre: 'Rendimiento (kg por m² cosechado)', valor: m2Total ? kgConSuperficie / m2Total : null, formato: 'dec', mejor: 'mas' }
      ] },
      { titulo: 'Trabajo realizado', filas: [
        { nombre: 'Siembras y trasplantes', valor: nuevas.length, formato: 'n' },
        { nombre: 'Siembras perdidas', valor: nuevas.filter(function (s) { return s.estado === 'Perdida'; }).length, formato: 'n', mejor: 'menos' },
        { nombre: 'Almácigos propios', valor: propios.length, formato: 'n' },
        { nombre: 'Compras de plantines', valor: almacigos.length - propios.length, formato: 'n' },
        { nombre: 'Germinación promedio de almácigos', valor: germinaciones.length ? sumaBalance(germinaciones, function (x) { return x; }) / germinaciones.length : null, formato: 'pct', mejor: 'mas' },
        { nombre: 'Riegos', valor: contarRiegos(riegos), formato: 'n' },
        { nombre: 'Litros regados', valor: sumaBalance(riegos, function (x) { return Number(x.litros); }), formato: 'litros' },
        { nombre: 'Tratamientos', valor: tratamientos.length, formato: 'n' },
        { nombre: 'Lluvia del pluviómetro', valor: lluviaPluviometroBalance(lluvias), formato: 'mm' }
      ] }
    ],
    detalles: [
      { titulo: 'Kg cosechados por cultivo', columna: 'Cultivo', formato: 'kg', mejor: 'mas',
        valores: agruparBalance(cosechas, function (c) { return cultivoDe(siembraDe(c.siembraId)); }, kg) },
      { titulo: 'Kg cosechados por parcela', columna: 'Parcela', formato: 'kg', mejor: 'mas',
        valores: agruparBalance(cosechas, function (c) { const s = siembraDe(c.siembraId); return s ? nombreParcela(h, s.parcelaId) : ''; }, kg) },
      { titulo: 'Tratamientos por cultivo', columna: 'Cultivo', formato: 'n',
        valores: agruparBalance(tratamientos, function (t) { return cultivoDe(siembraDe(t.siembraId)); }, function () { return 1; }) }
    ]
  };
}

async function numerosBalanceForrajes(p) {
  const f = await cargarForrajes();
  const kg = function (c) { return Number(c.cantidadTotalKg) || 0; };
  const siembraDe = function (id) { return f.siembrasForrajePorId[id]; };
  const especieDe = function (c) {
    return c.especieId ? nombreEspecie(f, c.especieId) : (siembraDe(c.siembraId) ? resumenEspecies(f, c.siembraId) : 'Sin especie');
  };
  const cosechas = f.cosechasForraje.filter(function (c) { return enPeriodo(c.fecha, p); });
  const nuevas = f.siembrasForraje.filter(function (s) { return enPeriodo(s.fechaSiembra, p); });
  const cortes = f.cortesForraje.filter(function (c) { return enPeriodo(c.fechaCorte, p); });
  // Pastoreos: solo los días que caen dentro de la campaña
  const hoy = hoyTexto();
  const pastoreos = f.pastoreosForraje.map(function (x) {
    const entrada = x.fechaEntrada > p.desde ? x.fechaEntrada : p.desde;
    const salida = x.fechaSalida || hoy;
    const fin = salida < p.hasta ? salida : p.hasta;
    return { cabezas: Number(x.cabezas) || 0, dias: x.fechaEntrada && entrada <= fin ? diasEntre(entrada, fin) + 1 : 0 };
  }).filter(function (x) { return x.dias > 0; });
  const lluvias = f.lluviasManuales.filter(function (x) { return enPeriodo(x.fecha, p); });

  return {
    secciones: [
      { titulo: 'Producción', filas: [
        { nombre: 'Kg cosechados', valor: sumaBalance(cosechas, kg), formato: 'kg', mejor: 'mas' },
        { nombre: 'Rollos y fardos', valor: sumaBalance(cosechas, function (c) { return Number(c.cantidadRollos); }), formato: 'n', mejor: 'mas' },
        { nombre: 'Cosechas registradas', valor: cosechas.length, formato: 'n' },
        { nombre: 'Días de pastoreo', valor: sumaBalance(pastoreos, function (x) { return x.dias; }), formato: 'n', mejor: 'mas' },
        { nombre: 'Días-animal de pastoreo', valor: sumaBalance(pastoreos, function (x) { return x.dias * x.cabezas; }), formato: 'n', mejor: 'mas' }
      ] },
      { titulo: 'Trabajo realizado', filas: [
        { nombre: 'Siembras nuevas', valor: nuevas.length, formato: 'n' },
        { nombre: 'Siembras perdidas', valor: nuevas.filter(function (s) { return s.estado === 'Perdida'; }).length, formato: 'n', mejor: 'menos' },
        { nombre: 'Cortes para henificar', valor: cortes.length, formato: 'n' },
        { nombre: 'Pastoreos', valor: pastoreos.length, formato: 'n' },
        { nombre: 'Muestreos de crecimiento', valor: f.muestreosCrecimiento.filter(function (m) { return enPeriodo(m.fecha, p); }).length, formato: 'n' },
        { nombre: 'Lluvia del pluviómetro', valor: lluviaPluviometroBalance(lluvias), formato: 'mm' }
      ] }
    ],
    detalles: [
      { titulo: 'Kg cosechados por especie', columna: 'Especie', formato: 'kg', mejor: 'mas', valores: agruparBalance(cosechas, especieDe, kg) },
      { titulo: 'Kg cosechados por lote', columna: 'Lote', formato: 'kg', mejor: 'mas',
        valores: agruparBalance(cosechas, function (c) { const s = siembraDe(c.siembraId); return s ? lugarTexto(f, s.loteId, s.cuadroId) : 'Sin lote'; }, kg) }
    ]
  };
}

async function numerosBalanceMaquinaria(p) {
  const d = await datosProductivosMaquinaria(p);
  const horasPorMaquina = {};
  d.porMaquina.forEach(function (x) { if (x.horas) horasPorMaquina[x.maquina.nombre] = x.horas; });
  const costoPorMaquina = {};
  d.porMaquina.forEach(function (x) { if (x.costo) costoPorMaquina[x.maquina.nombre] = x.costo; });
  return {
    secciones: [
      { titulo: 'Uso y mantenimiento', filas: [
        { nombre: 'Horas de uso', valor: d.totalHoras, formato: 'horas' },
        { nombre: 'Usos registrados', valor: d.usos.length, formato: 'n' },
        { nombre: 'Usos con falla en el chequeo', valor: d.conFalla.length, formato: 'n', mejor: 'menos' },
        { nombre: 'Servicios del plan hechos', valor: d.serviciosPlan.length, formato: 'n', mejor: 'mas' },
        { nombre: 'Reparaciones', valor: d.reparaciones.length, formato: 'n', mejor: 'menos' },
        { nombre: 'Costo de servicios y reparaciones', valor: d.totalCosto, formato: 'pesos', mejor: 'menos' }
      ] }
    ],
    detalles: [
      { titulo: 'Horas de uso por máquina', columna: 'Máquina', formato: 'horas', valores: horasPorMaquina },
      { titulo: 'Costo de servicios por máquina', columna: 'Máquina', formato: 'pesos', mejor: 'menos', valores: costoPorMaquina }
    ]
  };
}

async function numerosBalanceTaller(p) {
  const d = await datosProductivosTaller(p);
  return {
    secciones: [
      { titulo: 'Trabajo del taller', filas: [
        { nombre: 'Proyectos terminados', valor: d.terminados.length, formato: 'n', mejor: 'mas' },
        { nombre: 'Proyectos con actividad', valor: d.proyectos.length, formato: 'n' },
        { nombre: 'Pedidos recibidos', valor: d.pedidos.length, formato: 'n' },
        { nombre: 'Pedidos atendidos', valor: d.atendidos.length, formato: 'n', mejor: 'mas' },
        { nombre: 'Demora promedio (días, del pedido a hecho)', valor: d.demoraPromedio, formato: 'n', mejor: 'menos' },
        { nombre: 'Compras de materiales', valor: d.totalCompras, formato: 'pesos' },
        { nombre: 'Materiales usados (valor estimado)', valor: d.totalUsado, formato: 'pesos' },
        { nombre: 'Préstamos de herramientas', valor: d.prestamos.length, formato: 'n' }
      ] }
    ],
    detalles: [
      { titulo: 'Pedidos por entorno', columna: 'Entorno', formato: 'n',
        valores: agruparBalance(d.pedidos, function (x) { return x.entorno; }, function () { return 1; }) },
      { titulo: 'Materiales usados (valor estimado)', columna: 'Material', formato: 'pesos',
        valores: agruparBalance(d.usos, function (mv) { return nombreMaterial(d.t, mv.materialId); }, d.costoUso) }
    ]
  };
}

/* ---------- Comparación ---------- */

function formatoBalance(valor, formato) {
  if (valor === null || valor === undefined || isNaN(valor)) return '—';
  const redondo = function (decimales) { const f = Math.pow(10, decimales); return numero(Math.round(valor * f) / f); };
  if (formato === 'pesos') return pesos(valor);
  if (formato === 'kg') return redondo(1) + ' kg';
  if (formato === 'pct') return redondo(1) + ' %';
  if (formato === 'horas') return redondo(1) + ' h';
  if (formato === 'litros') return redondo(0) + ' L';
  if (formato === 'mm') return redondo(1) + ' mm';
  if (formato === 'dec') return redondo(2);
  return redondo(1);
}

/** a = la campaña que se mira, b = con cuál se compara. Devuelve { texto, clase: 'bien' | 'mal' | '' }. */
function cambioBalance(a, b, mejor, formato) {
  if (a === null || b === null || a === undefined || b === undefined) return { texto: '—', clase: '' };
  const tono = function (sube) { return !mejor ? '' : (sube === (mejor === 'mas') ? 'bien' : 'mal'); };
  if (Math.abs(a - b) < 0.0001) return { texto: '=', clase: '' };
  if (formato === 'pct') {
    // Un porcentaje se compara en puntos (de 50 % a 60 % = 10 puntos más)
    const puntos = Math.round((a - b) * 10) / 10;
    return puntos ? { texto: (puntos > 0 ? '▲ ' : '▼ ') + numero(Math.abs(puntos)) + ' puntos', clase: tono(puntos > 0) } : { texto: '=', clase: '' };
  }
  if (!b) return { texto: '▲ antes no había', clase: tono(a > 0) };
  if (!a) return { texto: '▼ ahora no hay', clase: tono(false) };
  const pct = Math.round((a - b) * 100 / Math.abs(b));
  if (pct === 0) return { texto: '=', clase: '' };
  return { texto: (a > b ? '▲ ' : '▼ ') + numero(Math.abs(pct)) + ' %', clase: tono(a > b) };
}

/** Junta los números de las dos campañas, las anotaciones y lo más destacado. */
async function datosBalance() {
  const entorno = entornoPorClave(estadoBalance.entorno) || ENTORNOS[0];
  const A = periodoBalance('a'), B = periodoBalance('b');
  const na = await numerosBalance(entorno, A), nb = await numerosBalance(entorno, B);

  const secciones = na.secciones.map(function (s, i) {
    return { titulo: s.titulo, filas: s.filas.map(function (f, j) {
      const antes = nb.secciones[i].filas[j].valor;
      return { nombre: f.nombre, a: f.valor, b: antes, formato: f.formato, mejor: f.mejor, cambio: cambioBalance(f.valor, antes, f.mejor, f.formato) };
    }) };
  });
  const detalles = na.detalles.map(function (d, i) {
    const otros = nb.detalles[i].valores;
    const nombres = Object.keys(d.valores).concat(Object.keys(otros).filter(function (n) { return !(n in d.valores); }));
    const filas = nombres.map(function (n) {
      const a = d.valores[n] || 0, b = otros[n] || 0;
      return { nombre: n, a: a, b: b, formato: d.formato, mejor: d.mejor, cambio: cambioBalance(a, b, d.mejor, d.formato) };
    }).sort(function (x, y) { return Math.max(y.a, y.b) - Math.max(x.a, x.b) || x.nombre.localeCompare(y.nombre, 'es'); });
    return { titulo: d.titulo, columna: d.columna, filas: filas };
  });

  const principales = secciones.reduce(function (t, s) { return t.concat(s.filas); }, []);
  const hayA = principales.some(function (f) { return f.a; }), hayB = principales.some(function (f) { return f.b; });
  const texto = function (f) { return f.nombre + ': ' + formatoBalance(f.b, f.formato) + ' → ' + formatoBalance(f.a, f.formato) + ' (' + f.cambio.texto + ')'; };
  const todas = (await Datos.listar('MejorasCampania')).filter(function (n) { return n.entorno === entorno.nombre; });
  const toca = function (clave) {
    if (A.clave) return clave === A.clave;
    const c = campaniaPorClave(clave);
    return !!c && c.desde <= A.hasta && c.hasta >= A.desde;
  };
  const orden = function (x, y) { return String(x.creadoEn).localeCompare(String(y.creadoEn)); };
  return {
    entorno: entorno, A: A, B: B, secciones: secciones, detalles: detalles, hayA: hayA, hayB: hayB,
    enCurso: A.desde <= hoyTexto() && A.hasta >= hoyTexto(),
    mejoraron: hayA && hayB ? principales.filter(function (f) { return f.cambio.clase === 'bien'; }).map(texto) : [],
    empeoraron: hayA && hayB ? principales.filter(function (f) { return f.cambio.clase === 'mal'; }).map(texto) : [],
    notas: todas.filter(function (n) { return toca(n.campania); }).sort(orden),
    aAplicar: todas.filter(function (n) { return n.mejora && toca(n.aplicarEn); }).sort(orden),
    todasLasNotas: todas.sort(function (x, y) { return String(y.campania).slice(3).localeCompare(String(x.campania).slice(3)) || String(y.campania).localeCompare(String(x.campania)) || orden(x, y); })
  };
}

function htmlTablaBalance(titulo, primeraColumna, filas, d) {
  if (!filas.length) return '';
  return '<section class="seccion-informe"><h3>' + esc(titulo) + '</h3>' +
    '<div class="tabla-desplazable"><table class="tabla tabla-balance"><thead><tr>' +
      '<th>' + esc(primeraColumna) + '</th><th>' + esc(d.B.titulo) + '</th><th>' + esc(d.A.titulo) + '</th><th>Cambio</th>' +
    '</tr></thead><tbody>' + filas.map(function (f) {
      return '<tr><td>' + esc(f.nombre) + '</td><td>' + esc(formatoBalance(f.b, f.formato)) + '</td><td><b>' + esc(formatoBalance(f.a, f.formato)) + '</b></td>' +
        '<td class="cambio ' + f.cambio.clase + '">' + esc(f.cambio.texto) + '</td></tr>';
    }).join('') + '</tbody></table></div></section>';
}

function htmlComparacionBalance(d) {
  let html = '';
  if (!d.hayA && !d.hayB) {
    return '<p class="vacio">No hay datos cargados de ' + esc(d.entorno.nombre) + ' en ninguna de las dos campañas.</p>';
  }
  if (d.enCurso) {
    const largo = diasEntre(d.A.desde, d.A.hasta) + 1, van = diasEntre(d.A.desde, hoyTexto()) + 1;
    html += '<p class="aviso">La campaña “' + esc(d.A.titulo) + '” todavía está en curso (van ' + van + ' de ' + largo +
      ' días). Los números se comparan contra una campaña completa: es normal que ahora parezcan más bajos.</p>';
  }
  if (!d.hayB) html += '<p class="aviso">No hay datos cargados en “' + esc(d.B.titulo) + '”: todavía no hay contra qué comparar.</p>';
  if (!d.hayA) html += '<p class="aviso">Todavía no hay datos cargados en “' + esc(d.A.titulo) + '”.</p>';
  if (d.mejoraron.length || d.empeoraron.length) {
    html += '<section class="seccion-informe destacado-balance"><h3>Lo más destacado</h3>' +
      (d.mejoraron.length ? '<p class="cambio bien"><b>Mejoró</b></p><ul>' + d.mejoraron.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' : '') +
      (d.empeoraron.length ? '<p class="cambio mal"><b>Empeoró</b></p><ul>' + d.empeoraron.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' : '') +
      '</section>';
  }
  d.secciones.forEach(function (s) { html += htmlTablaBalance(s.titulo, 'Indicador', s.filas, d); });
  d.detalles.forEach(function (x) { html += htmlTablaBalance(x.titulo, x.columna, x.filas, d); });
  html += '<p class="ayuda">Verde = cambió para bien · rojo = cambió para mal · sin color = solo informativo. ' +
    'La app muestra qué cambió; el porqué (clima, semilla, manejo) lo anotás vos en “Qué funcionó”.</p>';
  return html;
}

/* ---------- Anotaciones: qué funcionó y mejoras ---------- */

function htmlNotaBalance(n, editable, conCampania) {
  const id = esc(n.id);
  const pendiente = !n.estadoMejora || n.estadoMejora === 'Pendiente';
  return '<div class="nota-balance ' + (BALANCE.claseResultado[n.resultado] || '') + '">' +
    '<div class="nota-balance-texto">' +
      '<strong>' + (BALANCE.iconoResultado[n.resultado] || '•') + ' ' + esc(n.resultado || 'Sin resultado') + (n.tema ? ' · ' + esc(n.tema) : '') + '</strong>' +
      (conCampania ? '<span class="ayuda">' + esc(tituloCampania(n.campania)) + '</span>' : '') +
      '<span><b>Qué se hizo:</b> ' + esc(n.accion) + '</span>' +
      (n.mejora ? '<span><b>Mejora' + (n.aplicarEn ? ' para ' + esc(tituloCampania(n.aplicarEn)) : '') + ':</b> ' + esc(n.mejora) + '</span>' +
        '<span class="ayuda">' + (pendiente ? 'Todavía sin aplicar' : esc(n.estadoMejora) +
          (n.estadoMejora === 'Aplicada' ? (n.resultadoMejora ? ' · resultado: ' + (BALANCE.iconoResultado[n.resultadoMejora] || '') + ' ' + esc(n.resultadoMejora) : ' · falta anotar si dio resultado') : '')) + '</span>' : '') +
      (n.notas ? '<span class="ayuda notas">' + esc(n.notas) + '</span>' : '') +
    '</div>' +
    (editable ? '<div class="movimiento-acciones"><button class="boton chico secundario" onclick="formularioNotaBalance(\'' + id + '\')" aria-label="Editar">✎</button></div>' : '') +
  '</div>';
}

/** Una mejora que venía anotada para aplicar en esta campaña: se tilda y después se anota si dio resultado. */
function htmlMejoraAAplicar(n, editable) {
  const id = esc(n.id);
  const pendiente = !n.estadoMejora || n.estadoMejora === 'Pendiente';
  const aplicada = n.estadoMejora === 'Aplicada';
  let botones = '';
  if (editable && pendiente) {
    botones = '<button class="boton chico" onclick="marcarMejoraBalance(\'' + id + '\', \'Aplicada\')">✓ La apliqué</button>' +
      '<button class="boton chico secundario" onclick="marcarMejoraBalance(\'' + id + '\', \'No se aplicó\')">No se aplicó</button>';
  } else if (editable && aplicada && !n.resultadoMejora) {
    botones = '<span class="ayuda">¿Dio resultado?</span>' + BALANCE.resultados.map(function (r) {
      return '<button class="boton chico secundario" onclick="resultadoMejoraBalance(\'' + id + '\', \'' + r + '\')">' + BALANCE.iconoResultado[r] + ' ' + r + '</button>';
    }).join('');
  } else if (editable) {
    botones = '<button class="boton chico secundario" onclick="marcarMejoraBalance(\'' + id + '\', \'Pendiente\')">Deshacer</button>';
  }
  return '<div class="nota-balance ' + (pendiente ? 'pendiente' : aplicada ? (BALANCE.claseResultado[n.resultadoMejora] || 'bien') : 'gris') + '">' +
    '<div class="nota-balance-texto">' +
      '<strong>' + (pendiente ? '☐' : aplicada ? '☑' : '✗') + ' ' + esc(n.mejora) + '</strong>' +
      '<span class="ayuda">Viene de ' + esc(tituloCampania(n.campania)) + (n.tema ? ' · ' + esc(n.tema) : '') + ': ' + esc(n.accion) +
        ' (' + esc(String(n.resultado || '').toLowerCase()) + ')</span>' +
      (pendiente ? '' : '<span class="ayuda">' + esc(n.estadoMejora) + (n.resultadoMejora ? ' · resultado: ' + (BALANCE.iconoResultado[n.resultadoMejora] || '') + ' ' + esc(n.resultadoMejora) : '') + '</span>') +
    '</div>' +
    (botones ? '<div class="movimiento-acciones">' + botones + '</div>' : '') +
  '</div>';
}

function htmlMejorasBalance(d, editable) {
  if (editable && estadoBalance.todas) {
    return '<h3 class="form-seccion">Todas las anotaciones de ' + esc(d.entorno.nombre) + ' <span class="contador">' + d.todasLasNotas.length + '</span></h3>' +
      (d.todasLasNotas.length ? d.todasLasNotas.map(function (n) { return htmlNotaBalance(n, true, true); }).join('')
        : '<p class="vacio">Todavía no hay anotaciones de este entorno.</p>');
  }
  return '<section class="seccion-informe"><h3>Mejoras para aplicar en esta campaña <span class="contador">' + d.aAplicar.length + '</span></h3>' +
      (d.aAplicar.length ? d.aAplicar.map(function (n) { return htmlMejoraAAplicar(n, editable); }).join('')
        : '<p class="ayuda">No hay mejoras anotadas para esta campaña. Aparecen acá cuando cargás una anotación de otra campaña con una mejora “para aplicar en” esta.</p>') +
    '</section>' +
    '<section class="seccion-informe"><h3>Qué se hizo en esta campaña y cómo resultó <span class="contador">' + d.notas.length + '</span></h3>' +
      (d.notas.length ? d.notas.map(function (n) { return htmlNotaBalance(n, editable, !d.A.clave); }).join('')
        : '<p class="ayuda">Todavía no hay anotaciones de esta campaña.</p>') +
    '</section>';
}

async function marcarMejoraBalance(id, estado) {
  await Datos.guardar('MejorasCampania', { id: id, estadoMejora: estado, resultadoMejora: '' });
}

async function resultadoMejoraBalance(id, resultado) {
  await Datos.guardar('MejorasCampania', { id: id, resultadoMejora: resultado });
}

async function formularioNotaBalance(id) {
  const n = id ? await Datos.obtener('MejorasCampania', id) : null;
  const entorno = entornoPorClave(estadoBalance.entorno) || ENTORNOS[0];
  const actual = estadoBalance.a !== 'manual' ? estadoBalance.a : claveCampaniaDeFecha(hoyTexto());
  const opcionesCampania = function (futuras, pasadas, extra) {
    const claves = listaCampanias(futuras, pasadas);
    if (extra && claves.indexOf(extra) === -1) claves.push(extra);
    return claves.map(function (c) { return { valor: c, texto: tituloCampania(c) }; });
  };
  const campos = [
    { nombre: 'entorno', etiqueta: 'Entorno', tipo: 'select', requerido: true, medio: true,
      opciones: ENTORNOS.filter(function (e) { return e.activo; }).map(function (e) { return e.nombre; }) },
    { nombre: 'campania', etiqueta: 'Campaña', tipo: 'select', requerido: true, medio: true, opciones: opcionesCampania(0, 9, n && n.campania) },
    { nombre: 'tema', etiqueta: 'Cultivo o tema (opcional)', tipo: 'texto', ayuda: 'Ej.: Lechuga, riego del macrotúnel, Hanomag, alambrado' },
    { nombre: 'accion', etiqueta: 'Qué se hizo', tipo: 'area', requerido: true, ayuda: 'Ej.: Sembramos con plantines comprados en vez de almácigo propio' },
    { nombre: 'resultado', etiqueta: 'Resultado', tipo: 'select', requerido: true, vacio: 'Elegí…', opciones: BALANCE.resultados },
    { nombre: 'mejora', etiqueta: 'Mejora para la próxima campaña', tipo: 'area', seccion: 'Para la próxima vez',
      ayuda: 'Ej.: Volver al almácigo propio y sembrar 15 días antes. Dejalo vacío si no hay nada para cambiar' },
    { nombre: 'aplicarEn', etiqueta: 'Aplicar en la campaña', tipo: 'select', opciones: opcionesCampania(4, 2, n && n.aplicarEn),
      ayuda: 'En esa campaña te va a aparecer en “Mejoras para aplicar”' },
    { nombre: 'notas', etiqueta: 'Notas', tipo: 'area' }
  ];
  if (n && n.mejora) {
    campos.splice(7, 0,
      { nombre: 'estadoMejora', etiqueta: 'La mejora…', tipo: 'select', medio: true, opciones: ['Pendiente', 'Aplicada', 'No se aplicó'] },
      { nombre: 'resultadoMejora', etiqueta: '¿Dio resultado?', tipo: 'select', medio: true, vacio: 'Todavía no se sabe', opciones: BALANCE.resultados });
  }
  await abrirFormulario({
    tabla: 'MejorasCampania',
    titulo: n ? 'Editar anotación' : 'Agregar anotación',
    registro: n,
    // Por defecto la mejora se aplica en la misma época del año siguiente (otoño-invierno con otoño-invierno)
    valores: { entorno: entorno.nombre, campania: actual, aplicarEn: moverCampania(actual, 2), estadoMejora: 'Pendiente' },
    campos: campos,
    preguntaEliminar: '¿Eliminar esta anotación?'
  });
}

/* ---------- Pantalla ---------- */

let turnoBalance = 0;

async function dibujarBalance() {
  const lugar = document.getElementById('pantalla-balance');
  if (!lugar) return;
  const eb = estadoBalance;
  const turno = ++turnoBalance;
  const d = await datosBalance();
  if (turno !== turnoBalance || !document.getElementById('pantalla-balance')) return;

  const opcion = function (valor, texto, elegido) {
    return '<option value="' + esc(valor) + '"' + (valor === elegido ? ' selected' : '') + '>' + esc(texto) + '</option>';
  };
  const selectorCampania = function (lado, etiqueta) {
    return '<label>' + etiqueta + '<select onchange="cambiarCampaniaBalance(\'' + lado + '\', this.value)">' +
        listaCampanias(0, 9).map(function (c) { return opcion(c, tituloCampania(c), eb[lado]); }).join('') +
        opcion('manual', 'Elegir fechas a mano', eb[lado]) + '</select></label>' +
      (eb[lado] === 'manual'
        ? '<div class="dos-columnas"><label>Desde<input type="date" value="' + esc(eb[lado + 'Desde']) + '" onchange="estadoBalance.' + lado + 'Desde = this.value; dibujarBalance()"></label>' +
          '<label>Hasta<input type="date" value="' + esc(eb[lado + 'Hasta']) + '" onchange="estadoBalance.' + lado + 'Hasta = this.value; dibujarBalance()"></label></div>' : '');
  };
  const pendientes = d.aAplicar.filter(function (n) { return !n.estadoMejora || n.estadoMejora === 'Pendiente'; }).length;

  lugar.innerHTML =
    '<h1>📈 BALANCE DE CAMPAÑA</h1>' +
    '<p class="saludo">Comparar campañas y anotar qué funcionó. Solo lo ves vos</p>' +
    '<div class="tarjeta-opciones-informe">' +
      '<label>Entorno<select onchange="estadoBalance.entorno = this.value; dibujarBalance()">' +
        ENTORNOS.filter(function (e) { return e.activo; }).map(function (e) { return opcion(e.clave, e.nombre, eb.entorno); }).join('') +
      '</select></label>' +
      selectorCampania('a', 'Campaña') +
      selectorCampania('b', 'Comparar con') +
      '<p class="ayuda">Otoño-invierno: 1 de marzo al 31 de agosto · Primavera-verano: 1 de septiembre a fin de febrero.</p>' +
    '</div>' +
    '<div class="botones-exportar"><span>Descargar el balance y las anotaciones:</span>' +
      '<button class="boton chico" onclick="exportarBalanceExcel(this)">⬇ Excel</button>' +
      '<button class="boton chico" onclick="exportarBalancePdf(this)">⬇ PDF</button></div>' +
    '<div class="pestanas">' +
      '<button class="pestana' + (eb.pestana === 'comparar' ? ' activa' : '') + '" onclick="estadoBalance.pestana = \'comparar\'; dibujarBalance()">📊 Comparación</button>' +
      '<button class="pestana' + (eb.pestana === 'mejoras' ? ' activa' : '') + '" onclick="estadoBalance.pestana = \'mejoras\'; dibujarBalance()">📝 Qué funcionó' +
        (pendientes ? ' <span class="contador">' + pendientes + '</span>' : '') + '</button>' +
    '</div>' +
    (eb.pestana === 'mejoras'
      ? '<div class="botones-alta"><button class="boton" onclick="formularioNotaBalance()">+ Agregar anotación</button>' +
          '<button class="boton secundario" onclick="estadoBalance.todas = !estadoBalance.todas; dibujarBalance()">' +
            (eb.todas ? 'Ver solo esta campaña' : 'Ver todas las campañas') + '</button></div>' +
        htmlMejorasBalance(d, true)
      : htmlComparacionBalance(d));
}

/* ---------- Descargas ---------- */

function exportarBalancePdf(boton) {
  conBotonOcupado(boton, async function () {
    const d = await datosBalance();
    imprimirInforme('Balance de campaña · ' + d.entorno.nombre,
      'Escuela Agraria Parque Pereyra Iraola · ' + d.A.titulo + ' comparada con ' + d.B.titulo,
      htmlComparacionBalance(d) + htmlMejorasBalance(d, false));
  });
}

function exportarBalanceExcel(boton) {
  conBotonOcupado(boton, async function () {
    const d = await datosBalance();
    const titulo = 'Balance de campaña · ' + d.entorno.nombre;
    const numeroCelda = function (v, formato) { return v === null || v === undefined ? '' : celdaNumero(v, formato === 'dec' ? 2 : 1); };
    const filasDe = function (filas) {
      return filas.map(function (f) { return [f.nombre, numeroCelda(f.b, f.formato), numeroCelda(f.a, f.formato), f.cambio.texto]; });
    };
    let comparacion = [[titulo], [d.A.titulo + ' comparada con ' + d.B.titulo + ' · Generado el ' + formatearFecha(hoyTexto())], [],
      ['Indicador', d.B.titulo, d.A.titulo, 'Cambio']];
    d.secciones.forEach(function (s) { comparacion = comparacion.concat([[s.titulo.toUpperCase()]], filasDe(s.filas)); });
    const hojas = [{ nombre: 'Comparación', encabezado: 3, anchos: [42, 24, 24, 20], filas: comparacion }];
    d.detalles.forEach(function (x) {
      if (!x.filas.length) return;
      hojas.push({ nombre: x.titulo.replace(/[()]/g, '').slice(0, 30), encabezado: 1, anchos: [34, 24, 24, 20],
        filas: [[x.titulo], [x.columna, d.B.titulo, d.A.titulo, 'Cambio']].concat(filasDe(x.filas)) });
    });
    const filaNota = function (n) {
      return [tituloCampania(n.campania), n.tema || '', n.accion || '', n.resultado || '', n.mejora || '', n.mejora ? tituloCampania(n.aplicarEn) : '',
        n.mejora ? (n.estadoMejora || 'Pendiente') : '', n.resultadoMejora || '', n.notas || ''];
    };
    const cabeceraNotas = ['Campaña', 'Cultivo o tema', 'Qué se hizo', 'Resultado', 'Mejora', 'Aplicar en', 'Estado de la mejora', '¿Dio resultado?', 'Notas'];
    const anchosNotas = [24, 20, 50, 14, 50, 24, 18, 16, 30];
    hojas.push({ nombre: 'Qué funcionó', encabezado: 1, anchos: anchosNotas,
      filas: [['Qué se hizo en ' + d.A.titulo + ' y cómo resultó'], cabeceraNotas].concat(d.notas.map(filaNota)) });
    hojas.push({ nombre: 'Mejoras a aplicar', encabezado: 1, anchos: anchosNotas,
      filas: [['Mejoras para aplicar en ' + d.A.titulo], cabeceraNotas].concat(d.aAplicar.map(filaNota)) });
    hojas.push({ nombre: 'Todas las anotaciones', encabezado: 1, anchos: anchosNotas,
      filas: [['Todas las anotaciones de ' + d.entorno.nombre], cabeceraNotas].concat(d.todasLasNotas.map(filaNota)) });
    descargarArchivo(crearExcel(hojas), nombreArchivo('Balance de campana ' + d.entorno.nombre, 'xlsx'));
  });
}

/** En el inicio: cuántas mejoras quedan por aplicar en la campaña actual (todos los entornos). */
async function contarMejorasPorAplicar() {
  const actual = claveCampaniaDeFecha(hoyTexto());
  const cantidad = (await Datos.listar('MejorasCampania')).filter(function (n) {
    return n.mejora && n.aplicarEn === actual && (!n.estadoMejora || n.estadoMejora === 'Pendiente');
  }).length;
  const insignia = document.getElementById('insignia-balance');
  if (insignia && cantidad) {
    insignia.textContent = cantidad === 1 ? '1 mejora por aplicar' : cantidad + ' mejoras por aplicar';
    insignia.hidden = false;
  }
}
