/**
 * INFORME ESCRITO (solo el dueño): la app redacta un informe en párrafos con los datos cargados.
 * Se elige el entorno, el tipo (producción o económico) y el período. Los números se listan completos
 * (por ejemplo, la cosecha de cada cultivo), sin resumir.
 * Dirección: #/informe-escrito
 */
const informeEscrito = { entorno: 'huerta', tipo: 'productivo', periodo: 'mesAnterior', mes: '', desde: '', hasta: '' };
let ultimoInformeEscrito = null;

PANTALLAS['informe-escrito'] = function () {
  if (!esDueno()) return ir('inicio');
  render(htmlBarra('Generar informe escrito', 'inicio') +
    '<main class="contenido" id="pantalla-informe-escrito"></main>');
  dibujarFormularioInformeEscrito();
};

function dibujarFormularioInformeEscrito() {
  const lugar = document.getElementById('pantalla-informe-escrito');
  if (!lugar) return;
  const ie = informeEscrito;
  if (!ie.mes) ie.mes = hoyTexto().slice(0, 7);
  if (!ie.desde) { ie.desde = hoyTexto().slice(0, 8) + '01'; ie.hasta = hoyTexto(); }
  const opcion = function (valor, texto, elegido) {
    return '<option value="' + valor + '"' + (valor === elegido ? ' selected' : '') + '>' + texto + '</option>';
  };
  lugar.innerHTML =
    '<h1>📝 INFORME ESCRITO</h1>' +
    '<p class="saludo">La app redacta el informe con los datos cargados</p>' +
    '<div class="tarjeta-opciones-informe">' +
      '<div class="dos-columnas">' +
        '<label>Entorno<select onchange="informeEscrito.entorno = this.value">' +
          ENTORNOS.filter(function (e) { return e.activo; }).map(function (e) { return opcion(e.clave, e.nombre, ie.entorno); }).join('') +
        '</select></label>' +
        '<label>Informe<select onchange="informeEscrito.tipo = this.value">' +
          opcion('productivo', 'De producción', ie.tipo) + opcion('economico', 'Económico', ie.tipo) +
        '</select></label>' +
      '</div>' +
      '<label>Período<select onchange="informeEscrito.periodo = this.value; dibujarFormularioInformeEscrito()">' +
        opcion('mes', 'Este mes', ie.periodo) + opcion('mesAnterior', 'Mes anterior', ie.periodo) +
        opcion('mesElegido', 'Elegir un mes', ie.periodo) + opcion('anio', 'Este año', ie.periodo) +
        opcion('todo', 'Todo', ie.periodo) + opcion('rango', 'Entre fechas', ie.periodo) +
      '</select></label>' +
      (ie.periodo === 'mesElegido'
        ? '<label>Mes<input type="month" value="' + esc(ie.mes) + '" onchange="informeEscrito.mes = this.value"></label>' : '') +
      (ie.periodo === 'rango'
        ? '<div class="dos-columnas"><label>Desde<input type="date" value="' + esc(ie.desde) + '" onchange="informeEscrito.desde = this.value"></label>' +
          '<label>Hasta<input type="date" value="' + esc(ie.hasta) + '" onchange="informeEscrito.hasta = this.value"></label></div>' : '') +
      '<button class="boton" onclick="generarInformeEscrito(this)">📝 Generar informe</button>' +
    '</div>' +
    '<div id="resultado-informe-escrito"></div>';
}

/** Período elegido: { desde, hasta, titulo } */
function periodoInformeEscrito() {
  const ie = informeEscrito;
  if (ie.periodo === 'mesElegido' && /^\d{4}-\d{2}$/.test(ie.mes)) {
    const anio = Number(ie.mes.slice(0, 4)), mes = Number(ie.mes.slice(5, 7)) - 1;
    return { desde: ie.mes + '-01', hasta: fechaATexto(new Date(anio, mes + 1, 0)), titulo: 'Mes de ' + NOMBRES_MESES[mes] + ' ' + anio };
  }
  return calcularPeriodo(ie.periodo, ie.desde, ie.hasta);
}

async function generarInformeEscrito(boton) {
  const entorno = entornoPorClave(informeEscrito.entorno);
  const periodo = periodoInformeEscrito();
  const lugar = document.getElementById('resultado-informe-escrito');
  if (!entorno || !lugar) return;
  if (boton) ocupado(boton, true, 'Redactando…');
  try {
    const cuerpo = informeEscrito.tipo === 'economico'
      ? await redactarEconomico(entorno, periodo)
      : entorno.clave === 'forrajes' ? await redactarProductivoForrajes(periodo) : await redactarProductivoHuerta(periodo);
    const titulo = 'Informe ' + (informeEscrito.tipo === 'economico' ? 'económico' : 'de producción') + ' · ' + entorno.nombre;
    const subtitulo = 'Escuela Agraria Parque Pereyra Iraola · ' + periodo.titulo;
    ultimoInformeEscrito = { titulo: titulo, subtitulo: subtitulo, cuerpo: cuerpo };
    lugar.innerHTML =
      '<div class="botones-exportar"><span>Este informe:</span>' +
        '<button class="boton chico" onclick="imprimirInformeEscrito()">🖨 Imprimir / PDF</button>' +
        '<button class="boton chico secundario" onclick="copiarInformeEscrito()">📋 Copiar texto</button></div>' +
      '<article class="informe-escrito" id="texto-informe-escrito">' +
        '<h2>' + esc(titulo) + '</h2><p class="ayuda">' + esc(subtitulo) + '</p>' + cuerpo +
      '</article>';
    lugar.scrollIntoView({ behavior: 'smooth' });
  } catch (e) {
    lugar.innerHTML = '<p class="mensaje error">No se pudo armar el informe: ' + esc(e.message) + '</p>';
  }
  if (boton) ocupado(boton, false);
}

function imprimirInformeEscrito() {
  if (!ultimoInformeEscrito) return;
  imprimirInforme(ultimoInformeEscrito.titulo, ultimoInformeEscrito.subtitulo,
    '<div class="informe-escrito">' + ultimoInformeEscrito.cuerpo + '</div>');
}

async function copiarInformeEscrito() {
  const texto = document.getElementById('texto-informe-escrito');
  if (!texto) return;
  try {
    await navigator.clipboard.writeText(texto.innerText);
    alert('Informe copiado. Pegalo en un documento de Word o Google Docs.');
  } catch (e) {
    alert('No se pudo copiar. Seleccioná el texto con el dedo o el mouse y copialo.');
  }
}

/* ---------- Redacción: ayudas ---------- */

/**
 * ["a", "b", "c"] → "a, b y c". Si algún elemento ya tiene comas o "y" (ej. "Lechuga y escarola en lomo 1 y lomo 2"),
 * se separan con punto y coma para que se entienda: "a; b; y c".
 */
function unirTexto(lista) {
  if (!lista.length) return '';
  if (lista.length === 1) return lista[0];
  const compuesto = lista.some(function (x) { return / y |, /.test(x); });
  return compuesto
    ? lista.slice(0, -1).join('; ') + '; y ' + lista[lista.length - 1]
    : lista.slice(0, -1).join(', ') + ' y ' + lista[lista.length - 1];
}

/** Verbo en singular o plural según la cantidad: verboSegun(1, 'Se realizó', 'Se realizaron') */
function verboSegun(n, singular, pluralTexto) {
  return Number(n) === 1 ? singular : pluralTexto;
}

function cantidadTexto(n, singular, pluralTexto) {
  return numero(n) + ' ' + (Number(n) === 1 ? singular : (pluralTexto || singular + 's'));
}

function kgTexto(v) {
  return numero(Math.round((Number(v) || 0) * 10) / 10) + ' kg';
}

/** "atado" → "atados", "cajón" → "cajones", "kg" → "kg" */
function unidadTexto(n, unidad) {
  const u = String(unidad || '').trim();
  if (!u || Number(n) === 1 || /^(kg|g|l|lt|ml|cc|m2|m²|ha|mm)$/i.test(u) || /s$/i.test(u)) return u;
  if (/ón$/.test(u)) return u.slice(0, -2) + 'ones';
  if (/ín$/.test(u)) return u.slice(0, -2) + 'ines';
  return /[aeiou]$/i.test(u) ? u + 's' : u + 'es';
}

function parrafo(texto) {
  return '<p>' + esc(texto) + '</p>';
}

function tituloSeccion(texto) {
  return '<h3>' + esc(texto) + '</h3>';
}

function listaPuntos(items) {
  return items.length ? '<ul>' + items.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') + '</ul>' : '';
}

/** Agrupa y suma: [{ nombre, total, cantidad, registros }] de mayor a menor. */
function agruparSuma(registros, clave, valor) {
  const grupos = {};
  registros.forEach(function (r) {
    const k = clave(r) || 'Sin dato';
    if (!grupos[k]) grupos[k] = { nombre: k, total: 0, cantidad: 0, registros: [] };
    grupos[k].total += valor(r);
    grupos[k].cantidad++;
    grupos[k].registros.push(r);
  });
  return Object.keys(grupos).map(function (k) { return grupos[k]; })
    .sort(function (a, b) { return b.total - a.total || a.nombre.localeCompare(b.nombre, 'es'); });
}

function porcentajeDe(parte, total) {
  return total ? numero(Math.round(parte * 1000 / total) / 10) + '%' : '—';
}

/** Hasta qué fecha mirar "lo que está en el suelo": el fin del período, o hoy si el período sigue. */
function fechaCorteInforme(periodo) {
  return periodo.hasta < hoyTexto() ? periodo.hasta : hoyTexto();
}

/* ---------- Tareas del entorno (en todos los informes de producción) ---------- */

async function seccionTareasInforme(nombreEntorno, periodo) {
  const corte = fechaCorteInforme(periodo);
  const tareas = (await Datos.listar('Tareas')).filter(function (t) { return t.entorno === nombreEntorno; })
    .sort(function (a, b) { return a.fecha.localeCompare(b.fecha) || String(a.tarea).localeCompare(String(b.tarea)); });
  const curso = function (t) {
    const c = t.curso ? t.curso + (t.grupo ? ' ' + t.grupo : '') : (t.grupo ? 'grupo ' + t.grupo : '');
    return c ? ' (' + c + ')' : '';
  };
  const renglon = function (t) {
    return formatearFecha(t.fecha) + ' · ' + t.tarea + curso(t) + (t.estado && t.estado !== 'Pendiente' && t.estado !== 'Realizada' ? ' · ' + t.estado.toLowerCase() : '');
  };
  const realizadas = tareas.filter(function (t) { return t.estado === 'Realizada' && enPeriodo(t.fecha, periodo); });
  const pendientes = tareas.filter(function (t) { return t.estado !== 'Realizada' && t.fecha >= periodo.desde && t.fecha <= corte; });
  const programadas = tareas.filter(function (t) { return t.estado !== 'Realizada' && t.fecha > corte; });

  let html = tituloSeccion('Tareas');
  if (!realizadas.length && !pendientes.length && !programadas.length) {
    return html + parrafo('No hay tareas de ' + nombreEntorno + ' cargadas para este período.');
  }
  html += parrafo(realizadas.length
    ? verboSegun(realizadas.length, 'Se realizó ', 'Se realizaron ') + cantidadTexto(realizadas.length, 'tarea') + ' en el período:'
    : 'No se registraron tareas realizadas en el período.');
  html += listaPuntos(realizadas.map(renglon));
  html += parrafo('Tareas en carpeta:');
  if (pendientes.length) {
    html += parrafo(verboSegun(pendientes.length, 'Quedó pendiente ', 'Quedaron pendientes ') + cantidadTexto(pendientes.length, 'tarea') + ' del período:') +
      listaPuntos(pendientes.map(renglon));
  }
  if (programadas.length) {
    html += parrafo('Hay ' + cantidadTexto(programadas.length, 'tarea programada', 'tareas programadas') + ' para después del ' + formatearFecha(corte) + ':') +
      listaPuntos(programadas.map(renglon));
  }
  if (!pendientes.length && !programadas.length) html += parrafo('No quedan tareas pendientes ni programadas.');
  return html;
}

/* ---------- Producción · Huerta ---------- */

async function redactarProductivoHuerta(periodo) {
  const h = await cargarHuerta();
  const corte = fechaCorteInforme(periodo);
  const siembraDe = function (id) { return h.siembrasPorId[id]; };
  const cultivoDe = function (s) { return s ? nombreCultivo(h, s.cultivoId) : 'Sin cultivo'; };
  const lugarDe = function (s) {
    if (!s) return '';
    const lomo = h.lomosPorId[s.lomoId];
    return nombreParcela(h, s.parcelaId) + (lomo ? ' lomo ' + lomo.numero : '');
  };
  const kg = function (c) { return Number(c.kg) || 0; };
  let html = '';

  // Cosechas
  const cosechas = h.cosechas.filter(function (c) { return enPeriodo(c.fecha, periodo); })
    .sort(function (a, b) { return a.fecha.localeCompare(b.fecha); });
  const totalKg = cosechas.reduce(function (t, c) { return t + kg(c); }, 0);
  const porCultivo = agruparSuma(cosechas, function (c) { return cultivoDe(siembraDe(c.siembraId)); }, kg);
  const porParcela = agruparSuma(cosechas, function (c) { const s = siembraDe(c.siembraId); return s ? nombreParcela(h, s.parcelaId) : ''; }, kg);

  // Lo que está en el suelo a la fecha de corte
  const finDeSiembra = function (s) {
    if (HUERTA.activas.indexOf(s.estado) !== -1) return null;
    const fechas = h.cosechas.filter(function (c) { return c.siembraId === s.id; }).map(function (c) { return c.fecha; }).sort();
    return fechas.length ? fechas[fechas.length - 1] : (String(s.modificadoEn || '').slice(0, 10) || s.fechaSiembra);
  };
  const enSuelo = h.siembras.filter(function (s) {
    const fin = finDeSiembra(s);
    return s.fechaSiembra && s.fechaSiembra <= corte && (fin === null || fin > corte);
  }).sort(function (a, b) { return lugarDe(a).localeCompare(lugarDe(b), 'es', { numeric: true }); });
  const nuevas = h.siembras.filter(function (s) { return enPeriodo(s.fechaSiembra, periodo); })
    .sort(function (a, b) { return a.fechaSiembra.localeCompare(b.fechaSiembra); });

  const riegos = h.riegos.filter(function (r) { return enPeriodo(r.fecha, periodo); });
  const tratamientos = h.tratamientos.filter(function (t) { return enPeriodo(t.fecha, periodo); })
    .sort(function (a, b) { return a.fecha.localeCompare(b.fecha); });
  const almacigos = h.almacigos.filter(function (a) { return enPeriodo(a.fechaSiembra, periodo); })
    .sort(function (a, b) { return a.fechaSiembra.localeCompare(b.fechaSiembra); });

  // Resumen
  html += tituloSeccion('Resumen');
  html += parrafo('En el período (' + periodo.titulo.charAt(0).toLowerCase() + periodo.titulo.slice(1) + ') la huerta registró ' +
    (cosechas.length ? cantidadTexto(cosechas.length, 'cosecha') + ' por un total de ' + kgTexto(totalKg) + ' de ' + cantidadTexto(porCultivo.length, 'cultivo') : 'ninguna cosecha') + ', ' +
    cantidadTexto(contarRiegos(riegos), 'riego') + ', ' + cantidadTexto(tratamientos.length, 'tratamiento') + ', ' +
    cantidadTexto(nuevas.length, 'siembra o trasplante', 'siembras o trasplantes') + ' y ' + cantidadTexto(almacigos.length, 'almácigo') + '. ' +
    'Al ' + formatearFecha(corte) + ' había ' + cantidadTexto(enSuelo.length, 'siembra') + ' en el suelo.');

  // Cosechas: todos los cultivos, con su peso exacto
  html += tituloSeccion('Cosecha');
  if (cosechas.length) {
    html += parrafo('Se cosecharon ' + kgTexto(totalKg) + ' en total. Por cultivo: ' +
      unirTexto(porCultivo.map(function (g) { return g.nombre + ' ' + kgTexto(g.total); })) + '.');
    if (porParcela.length > 1) {
      html += parrafo('Por parcela: ' + unirTexto(porParcela.map(function (g) { return g.nombre + ' ' + kgTexto(g.total) + ' (' + porcentajeDe(g.total, totalKg) + ')'; })) + '.');
    }
    html += htmlTablaInforme('Cosecha por cultivo', ['Cultivo', 'Kg', 'Cosechas', '% del total'],
      porCultivo.map(function (g) { return [g.nombre, numero(Math.round(g.total * 10) / 10), g.cantidad, porcentajeDe(g.total, totalKg)]; })
        .concat([['Total', numero(Math.round(totalKg * 10) / 10), cosechas.length, '100%']]));
    html += htmlTablaInforme('Detalle de cosechas', ['Fecha', 'Cultivo', 'Lugar', 'Kg', 'Calidad'],
      cosechas.map(function (c) { const s = siembraDe(c.siembraId); return [formatearFecha(c.fecha), cultivoDe(s), lugarDe(s), numero(kg(c)), c.calidad || '']; }));
  } else {
    html += parrafo('No se registraron cosechas en el período.');
  }

  // En el suelo
  html += tituloSeccion('Lo que está en el suelo al ' + formatearFecha(corte));
  if (enSuelo.length) {
    const porCultivoSuelo = agruparSuma(enSuelo, cultivoDe, function (s) { return Number(s.cantidadPlantas) || 0; });
    const plantas = enSuelo.reduce(function (t, s) { return t + (Number(s.cantidadPlantas) || 0); }, 0);
    html += parrafo('Hay ' + cantidadTexto(enSuelo.length, 'siembra') + ' en el suelo' + (plantas ? ', con ' + cantidadTexto(plantas, 'planta') + ' en total' : '') + ': ' +
      unirTexto(porCultivoSuelo.map(function (g) {
        return g.nombre + ' en ' + unirTexto(g.registros.map(lugarDe)) + (g.total ? ' (' + cantidadTexto(g.total, 'planta') + ')' : '');
      })) + '.');
    html += htmlTablaInforme('Siembras en el suelo', ['Lugar', 'Cultivo', 'Sembrada', 'Días', 'Plantas', 'Kg cosechados', 'Estado'],
      enSuelo.map(function (s) {
        const kgHasta = h.cosechas.filter(function (c) { return c.siembraId === s.id && c.fecha <= corte; }).reduce(function (t, c) { return t + kg(c); }, 0);
        return [lugarDe(s), cultivoDe(s), formatearFecha(s.fechaSiembra), diasEntre(s.fechaSiembra, corte), s.cantidadPlantas || '',
          kgHasta ? numero(Math.round(kgHasta * 10) / 10) : '', corte === hoyTexto() ? s.estado : ''];
      }));
  } else {
    html += parrafo('No había siembras en el suelo a esa fecha.');
  }
  if (nuevas.length) {
    html += parrafo('En el período se sembraron o trasplantaron ' + cantidadTexto(nuevas.length, 'lugar', 'lugares') + ': ' +
      unirTexto(nuevas.map(function (s) {
        return cultivoDe(s) + ' en ' + lugarDe(s) + ' el ' + diaMes(s.fechaSiembra) + (s.cantidadPlantas ? ' (' + cantidadTexto(s.cantidadPlantas, 'planta') + ')' : '');
      })) + '.');
  }

  // Agua
  html += tituloSeccion('Riego y lluvia');
  const cubierta = function (r) { const s = siembraDe(r.siembraId); return s && estaBajoCubierta(h, s.parcelaId); };
  const litros = function (r) { return Number(r.litros) || 0; };
  const riegosCubierta = riegos.filter(cubierta);
  const riegosAire = riegos.filter(function (r) { return !cubierta(r); });
  const textoRiego = function (lista, donde) {
    if (!lista.length) return 'No se registraron riegos ' + donde + '.';
    const total = lista.reduce(function (t, r) { return t + litros(r); }, 0);
    const veces = 'Se regó ' + cantidadTexto(contarRiegos(lista), 'vez', 'veces') + ' ' + donde;
    if (!total) {
      // Riegos cargados solo en milímetros (sin litros): cada riego con su lámina
      const porRiego = {};
      lista.forEach(function (r) {
        const k = r.grupoId || r.id;
        porRiego[k] = { fecha: r.fecha, mm: Math.max(porRiego[k] ? porRiego[k].mm : 0, Number(r.laminaMm) || 0) };
      });
      const conMm = Object.keys(porRiego).map(function (k) { return porRiego[k]; }).filter(function (x) { return x.mm; })
        .sort(function (a, b) { return a.fecha.localeCompare(b.fecha); });
      return veces + (conMm.length ? ', cargado en milímetros: ' + unirTexto(conMm.map(function (x) { return diaMes(x.fecha) + ' ' + numero(x.mm) + ' mm'; }))
        : ', sin cantidad de agua cargada') + '.';
    }
    const porParcelaRiego = agruparSuma(lista, function (r) { const s = siembraDe(r.siembraId); return s ? nombreParcela(h, s.parcelaId) : ''; }, litros);
    return veces + ', con un total de ' + numero(Math.round(total)) + ' litros' +
      (porParcelaRiego.length > 1 ? ' (' + unirTexto(porParcelaRiego.map(function (g) { return g.nombre + ' ' + numero(Math.round(g.total)) + ' L'; })) + ')' : '') + '.';
  };
  html += parrafo(textoRiego(riegosCubierta, 'bajo cubierta'));
  html += parrafo(textoRiego(riegosAire, 'a cielo abierto'));
  const lluvias = h.lluviasHuerta.filter(function (r) { return enPeriodo(r.fecha, periodo) && !estaBajoCubierta(h, r.parcelaId); });
  const lluviaPorDia = {};
  lluvias.forEach(function (r) { lluviaPorDia[r.fecha] = Math.max(lluviaPorDia[r.fecha] || 0, Number(r.cantidadMm) || 0); });
  const dias = Object.keys(lluviaPorDia).sort();
  html += parrafo(dias.length
    ? 'El pluviómetro registró ' + numero(dias.reduce(function (t, d) { return t + lluviaPorDia[d]; }, 0)) + ' mm de lluvia en ' + cantidadTexto(dias.length, 'día') + ': ' +
      unirTexto(dias.map(function (d) { return diaMes(d) + ' ' + numero(lluviaPorDia[d]) + ' mm'; })) + '.'
    : 'No se cargaron lecturas del pluviómetro en el período.');

  // Almácigos
  html += tituloSeccion('Almácigos');
  const propios = almacigos.filter(function (a) { return a.origen !== 'Comprado'; });
  const comprados = almacigos.filter(function (a) { return a.origen === 'Comprado'; });
  if (!almacigos.length) html += parrafo('No se hicieron ni se compraron almácigos en el período.');
  if (propios.length) {
    html += parrafo('Se hicieron ' + cantidadTexto(propios.length, 'almácigo propio', 'almácigos propios') + ': ' +
      unirTexto(propios.map(function (a) {
        const celdas = (Number(a.cantidadCeldas) || 0) * (Number(a.cantidadBandejas) || 1);
        const pct = porcentajeGerminacion(a);
        return nombreCultivo(h, a.cultivoId) + ' el ' + diaMes(a.fechaSiembra) + ' (' + cantidadTexto(celdas, 'celda') +
          (pct === null ? ', sin conteo de germinación' : ', ' + numero(pct) + '% de germinación') + ')';
      })) + '.');
  }
  if (comprados.length) {
    html += parrafo('Se compraron plantines: ' + unirTexto(comprados.map(function (a) {
      return (a.cantidadPlantines ? cantidadTexto(a.cantidadPlantines, 'plantín', 'plantines') + ' de ' : '') + nombreCultivo(h, a.cultivoId) +
        ' el ' + diaMes(a.fechaSiembra) + (a.proveedor ? ' a ' + a.proveedor : '');
    })) + '.');
  }

  // Tratamientos
  html += tituloSeccion('Tratamientos');
  html += tratamientos.length
    ? parrafo('Se aplicaron ' + cantidadTexto(tratamientos.length, 'tratamiento') + ':') + listaPuntos(tratamientos.map(function (t) {
        const s = siembraDe(t.siembraId);
        return formatearFecha(t.fecha) + ' · ' + t.producto + (t.tipo ? ' (' + t.tipo.toLowerCase() + ')' : '') + ' en ' + cultivoDe(s) + ' – ' + lugarDe(s) +
          (t.dosis ? ' · dosis ' + t.dosis + (t.unidadDosis ? ' ' + t.unidadDosis : '') : '') + (Number(t.carenciaDias) ? ' · carencia ' + t.carenciaDias + ' días' : '');
      }))
    : parrafo('No se aplicaron tratamientos en el período.');

  html += await seccionTareasInforme('Huerta', periodo);
  return html;
}

/* ---------- Producción · Forrajes ---------- */

async function redactarProductivoForrajes(periodo) {
  const f = await cargarForrajes();
  const corte = fechaCorteInforme(periodo);
  const kg = function (c) { return Number(c.cantidadTotalKg) || 0; };
  const rollos = function (c) { return Number(c.cantidadRollos) || 0; };
  const siembraDe = function (id) { return f.siembrasForrajePorId[id]; };
  const lugarDe = function (s) { return s ? lugarTexto(f, s.loteId, s.cuadroId) : 'Sin lote'; };
  const especiesDe = function (s) {
    const nombres = especiesDeSiembra(f, s.id).map(function (se) { return nombreEspecie(f, se.especieId); });
    return nombres.length ? unirTexto(nombres) : 'Sin especies';
  };
  const especieDeCosecha = function (c) {
    return c.especieId ? nombreEspecie(f, c.especieId) : (siembraDe(c.siembraId) ? resumenEspecies(f, c.siembraId) : 'Sin especie');
  };
  let html = '';

  const cosechas = f.cosechasForraje.filter(function (c) { return enPeriodo(c.fecha, periodo); })
    .sort(function (a, b) { return a.fecha.localeCompare(b.fecha); });
  const totalKg = cosechas.reduce(function (t, c) { return t + kg(c); }, 0);
  const totalRollos = cosechas.reduce(function (t, c) { return t + rollos(c); }, 0);
  const porEspecie = agruparSuma(cosechas, especieDeCosecha, kg);

  const finDeSiembra = function (s) {
    if (s.estado === 'En crecimiento') return null;
    const fechas = f.cosechasForraje.filter(function (c) { return c.siembraId === s.id; }).map(function (c) { return c.fecha; }).sort();
    return fechas.length ? fechas[fechas.length - 1] : (String(s.modificadoEn || '').slice(0, 10) || s.fechaSiembra);
  };
  const enSuelo = f.siembrasForraje.filter(function (s) {
    const fin = finDeSiembra(s);
    return s.fechaSiembra && s.fechaSiembra <= corte && (fin === null || fin > corte);
  }).sort(function (a, b) { return lugarDe(a).localeCompare(lugarDe(b), 'es', { numeric: true }); });
  const nuevas = f.siembrasForraje.filter(function (s) { return enPeriodo(s.fechaSiembra, periodo); })
    .sort(function (a, b) { return a.fechaSiembra.localeCompare(b.fechaSiembra); });
  const cortes = f.cortesForraje.filter(function (c) { return enPeriodo(c.fechaCorte, periodo); })
    .sort(function (a, b) { return a.fechaCorte.localeCompare(b.fechaCorte); });
  const pastoreos = f.pastoreosForraje.filter(function (p) {
    return p.fechaEntrada <= periodo.hasta && (!p.fechaSalida || p.fechaSalida >= periodo.desde);
  }).sort(function (a, b) { return a.fechaEntrada.localeCompare(b.fechaEntrada); });
  const muestreos = f.muestreosCrecimiento.filter(function (m) { return enPeriodo(m.fecha, periodo); });

  html += tituloSeccion('Resumen');
  html += parrafo('En el período (' + periodo.titulo.charAt(0).toLowerCase() + periodo.titulo.slice(1) + ') hubo ' +
    (cosechas.length ? cantidadTexto(cosechas.length, 'cosecha') + ' por ' + kgTexto(totalKg) + (totalRollos ? ' (' + cantidadTexto(totalRollos, 'rollo o fardo', 'rollos o fardos') + ')' : '') : 'ninguna cosecha') + ', ' +
    cantidadTexto(cortes.length, 'corte para henificar', 'cortes para henificar') + ', ' + cantidadTexto(pastoreos.length, 'pastoreo') + ', ' +
    cantidadTexto(nuevas.length, 'siembra nueva', 'siembras nuevas') + ' y ' + cantidadTexto(muestreos.length, 'muestreo de crecimiento', 'muestreos de crecimiento') + '. ' +
    'Al ' + formatearFecha(corte) + ' había ' + cantidadTexto(enSuelo.length, 'siembra') + ' en el suelo.');

  html += tituloSeccion('Cosecha');
  if (cosechas.length) {
    html += parrafo('Se cosecharon ' + kgTexto(totalKg) + ' en total. Por especie: ' + unirTexto(porEspecie.map(function (g) {
      const r = g.registros.reduce(function (t, c) { return t + rollos(c); }, 0);
      return g.nombre + ' ' + kgTexto(g.total) + (r ? ' (' + cantidadTexto(r, 'rollo') + ')' : '');
    })) + '.');
    html += htmlTablaInforme('Detalle de cosechas', ['Fecha', 'Lugar', 'Especie', 'Aprovechamiento', 'Kg', 'Rollos/fardos', 'Humedad'],
      cosechas.map(function (c) {
        return [formatearFecha(c.fecha), lugarDe(siembraDe(c.siembraId)), especieDeCosecha(c), c.tipoAprovechamiento || '', numero(kg(c)),
          c.cantidadRollos || '', c.humedadPct ? c.humedadPct + '%' : ''];
      }));
  } else {
    html += parrafo('No se registraron cosechas en el período.');
  }

  html += tituloSeccion('Lo que está en el suelo al ' + formatearFecha(corte));
  if (enSuelo.length) {
    const ultimoMuestreo = function (s) {
      const ms = f.muestreosCrecimiento.filter(function (m) {
        return m.loteId === s.loteId && (!s.cuadroId || !m.cuadroId || m.cuadroId === s.cuadroId) && m.fecha >= s.fechaSiembra && m.fecha <= corte;
      }).sort(function (a, b) { return a.fecha.localeCompare(b.fecha); });
      return ms.length ? ms[ms.length - 1] : null;
    };
    html += parrafo('Hay ' + cantidadTexto(enSuelo.length, 'siembra') + ' en el suelo: ' + unirTexto(enSuelo.map(function (s) {
      return especiesDe(s) + ' en ' + lugarDe(s) + ' (sembrada el ' + formatearFecha(s.fechaSiembra) + ', ' + cantidadTexto(diasEntre(s.fechaSiembra, corte), 'día') + ')';
    })) + '.');
    html += htmlTablaInforme('Siembras en el suelo', ['Lugar', 'Especies', 'Sembrada', 'Días', 'Uso previsto', 'Último muestreo'],
      enSuelo.map(function (s) {
        const m = ultimoMuestreo(s);
        return [lugarDe(s), resumenEspecies(f, s.id), formatearFecha(s.fechaSiembra), diasEntre(s.fechaSiembra, corte), s.usoPrevisto || '',
          m ? numero(m.materiaVerdeTotalKg) + ' kg MV (' + diaMes(m.fecha) + ')' : ''];
      }));
  } else {
    html += parrafo('No había siembras en el suelo a esa fecha.');
  }
  if (nuevas.length) {
    html += parrafo('En el período se sembraron ' + cantidadTexto(nuevas.length, 'lote o cuadro', 'lotes o cuadros') + ': ' + unirTexto(nuevas.map(function (s) {
      return especiesDe(s) + ' en ' + lugarDe(s) + ' el ' + diaMes(s.fechaSiembra) + (s.usoPrevisto ? ' (para ' + s.usoPrevisto.toLowerCase() + ')' : '');
    })) + '.');
  }

  html += tituloSeccion('Henificación');
  html += cortes.length
    ? parrafo('Se hicieron ' + cantidadTexto(cortes.length, 'corte') + ':') + listaPuntos(cortes.map(function (c) {
        const volteos = f.volteosForraje.filter(function (v) { return v.corteId === c.id; }).sort(function (a, b) { return a.fecha.localeCompare(b.fecha); });
        const ultimo = volteos.length ? volteos[volteos.length - 1] : null;
        return formatearFecha(c.fechaCorte) + ' · ' + lugarDe(siembraDe(c.siembraId)) + (c.especieId ? ' (' + nombreEspecie(f, c.especieId) + ')' : '') +
          (Number(c.superficieHa) ? ' · ' + numero(c.superficieHa) + ' ha' : '') +
          (volteos.length ? ' · ' + cantidadTexto(volteos.length, 'volteo') + (ultimo && ultimo.humedadPct ? ', última humedad ' + ultimo.humedadPct + '%' : '') : '') +
          (c.enrollado === 'true' ? ' · enrollado' + (c.fechaEnrollado ? ' el ' + diaMes(c.fechaEnrollado) : '') : ' · todavía sin enrollar');
      }))
    : parrafo('No hubo cortes para henificar en el período.');

  html += tituloSeccion('Pastoreo');
  html += pastoreos.length
    ? parrafo('Hubo ' + cantidadTexto(pastoreos.length, 'pastoreo') + ':') + listaPuntos(pastoreos.map(function (p) {
        const info = infoPastoreo(f, p);
        return info.lugar + ' · ' + info.animales + (info.cabezas ? ', ' + cantidadTexto(info.cabezas, 'cabeza') : '') +
          ' · entraron el ' + formatearFecha(p.fechaEntrada) + (p.fechaSalida ? ' y salieron el ' + formatearFecha(p.fechaSalida) : ' y siguen adentro') +
          ' · ' + cantidadTexto(info.dias, 'día') + (info.diasAnimal ? ' (' + numero(info.diasAnimal) + ' días-animal)' : '');
      }))
    : parrafo('No hubo pastoreos en el período.');

  html += tituloSeccion('Lluvia y crecimiento');
  const lluviaPorDia = {};
  f.lluviasManuales.filter(function (r) { return enPeriodo(r.fecha, periodo); }).forEach(function (r) {
    lluviaPorDia[r.fecha] = Math.max(lluviaPorDia[r.fecha] || 0, Number(r.cantidadMm) || 0);
  });
  const dias = Object.keys(lluviaPorDia).sort();
  html += parrafo(dias.length
    ? 'El pluviómetro registró ' + numero(dias.reduce(function (t, d) { return t + lluviaPorDia[d]; }, 0)) + ' mm de lluvia en ' + cantidadTexto(dias.length, 'día') + ': ' +
      unirTexto(dias.map(function (d) { return diaMes(d) + ' ' + numero(lluviaPorDia[d]) + ' mm'; })) + '.'
    : 'No se cargaron lecturas del pluviómetro en el período.');
  if (muestreos.length) {
    const porLugar = agruparSuma(muestreos, function (m) { return lugarTexto(f, m.loteId, m.cuadroId); }, function () { return 1; });
    html += parrafo('Muestreos de materia verde: ' + unirTexto(porLugar.map(function (g) {
      const orden = g.registros.slice().sort(function (a, b) { return a.fecha.localeCompare(b.fecha); });
      const ultimo = orden[orden.length - 1];
      return g.nombre + ': ' + cantidadTexto(g.cantidad, 'muestreo') + ', el último el ' + diaMes(ultimo.fecha) + ' con ' + numero(ultimo.materiaVerdeTotalKg) + ' kg';
    })) + '.');
  }

  html += tituloSeccion('Reservas en stock (hoy)');
  const stock = proyeccionStock(f);
  html += stock.length
    ? parrafo('Stock actual: ' + unirTexto(stock.map(function (p) {
        return p.nombre + ' ' + kgTexto(p.stockKg) + (p.dias !== null ? ' (alcanza para unos ' + cantidadTexto(Math.floor(p.dias), 'día') + ')' : '');
      })) + '.')
    : parrafo('No hay reservas en stock.');

  html += await seccionTareasInforme('Forrajes', periodo);
  return html;
}

/* ---------- Económico (Huerta o Forrajes) ---------- */

/** Período anterior para comparar: el mes anterior si es un mes completo; si no, la misma cantidad de días antes. */
function periodoAnteriorInforme(periodo) {
  if (periodo.desde === '0000-01-01') return null;
  const desde = textoAFecha(periodo.desde);
  const finDeMes = fechaATexto(new Date(desde.getFullYear(), desde.getMonth() + 1, 0));
  if (periodo.desde.slice(8) === '01' && periodo.hasta === finDeMes) {
    const inicio = new Date(desde.getFullYear(), desde.getMonth() - 1, 1);
    return { desde: fechaATexto(inicio), hasta: fechaATexto(new Date(inicio.getFullYear(), inicio.getMonth() + 1, 0)),
      titulo: NOMBRES_MESES[inicio.getMonth()] + ' ' + inicio.getFullYear() };
  }
  if (periodo.desde.slice(5) === '01-01' && periodo.hasta === periodo.desde.slice(0, 4) + '-12-31') {
    const anioAnterior = Number(periodo.desde.slice(0, 4)) - 1;
    return { desde: anioAnterior + '-01-01', hasta: anioAnterior + '-12-31', titulo: 'el año ' + anioAnterior };
  }
  const largo = diasEntre(periodo.desde, periodo.hasta) + 1;
  return { desde: sumarDias(periodo.desde, -largo), hasta: sumarDias(periodo.desde, -1), titulo: 'el período anterior de ' + cantidadTexto(largo, 'día') };
}

/** "Lechuga $ 45.000 (12 ventas: 60 atados)" para cada producto, con todas las cantidades. */
function textoProductosEconomicos(grupos, palabraMovimiento, pluralMovimiento) {
  return unirTexto(grupos.map(function (g) {
    const porUnidad = {};
    g.registros.forEach(function (m) {
      if (Number(m.cantidad)) porUnidad[m.unidad || ''] = (porUnidad[m.unidad || ''] || 0) + Number(m.cantidad);
    });
    const cantidades = Object.keys(porUnidad).map(function (u) {
      return u ? numero(porUnidad[u]) + ' ' + unidadTexto(porUnidad[u], u) : 'cantidad ' + numero(porUnidad[u]) + ' sin unidad';
    });
    return g.nombre + ' ' + pesos(g.total) + ' (' + cantidadTexto(g.cantidad, palabraMovimiento, pluralMovimiento) +
      (cantidades.length ? ': ' + unirTexto(cantidades) : '') + ')';
  }));
}

async function redactarEconomico(entorno, periodo) {
  const todos = await Promise.all(['Ingresos', 'Egresos', 'Remitos'].map(function (t) { return Datos.listar(t); }));
  const delEntorno = function (lista, p) {
    return lista.filter(function (m) { return m.entorno === entorno.nombre && enPeriodo(m.fecha, p); })
      .sort(function (a, b) { return a.fecha.localeCompare(b.fecha); });
  };
  const valor = function (m) { return Number(m.valor) || 0; };
  const suma = function (lista) { return lista.reduce(function (t, m) { return t + valor(m); }, 0); };
  const ingresos = delEntorno(todos[0], periodo), egresos = delEntorno(todos[1], periodo), remitos = delEntorno(todos[2], periodo);
  const totalIngresos = suma(ingresos), totalEgresos = suma(egresos), balance = totalIngresos - totalEgresos;
  const producto = function (m) { return normalizarNombre(m.producto); };
  let html = '';

  html += tituloSeccion('Resumen');
  html += parrafo('En el período (' + periodo.titulo.charAt(0).toLowerCase() + periodo.titulo.slice(1) + ') el entorno ' + entorno.nombre + ' tuvo ingresos por ' + pesos(totalIngresos) +
    ' (' + cantidadTexto(ingresos.length, 'venta') + ') y egresos por ' + pesos(totalEgresos) + ' (' + cantidadTexto(egresos.length, 'compra') + '). ' +
    'El resultado fue ' + (balance >= 0 ? 'positivo, de ' + pesos(balance) : 'negativo, de ' + pesos(-balance)) + '.' +
    (remitos.length ? ' Además se hicieron ' + cantidadTexto(remitos.length, 'remito interno', 'remitos internos') + ' por ' + pesos(suma(remitos)) + '.' : ''));
  const anterior = periodoAnteriorInforme(periodo);
  const ia = anterior ? suma(delEntorno(todos[0], anterior)) : 0;
  const ea = anterior ? suma(delEntorno(todos[1], anterior)) : 0;
  if (anterior && (ia || ea)) {
    const cambio = function (actual, antes) {
      if (!antes) return 'no hubo en ' + anterior.titulo;
      const pct = Math.round((actual - antes) * 100 / antes);
      return (pct === 0 ? 'igual que' : pct > 0 ? pct + '% más que' : Math.abs(pct) + '% menos que') + ' en ' + anterior.titulo + ' (' + pesos(antes) + ')';
    };
    html += parrafo('Comparado con ' + anterior.titulo + ': ingresos ' + cambio(totalIngresos, ia) + '; egresos ' + cambio(totalEgresos, ea) + '.');
  }

  html += tituloSeccion('Ingresos');
  if (ingresos.length) {
    const productos = agruparSuma(ingresos, producto, valor);
    html += parrafo('Ventas por producto: ' + textoProductosEconomicos(productos, 'venta') + '.');
    const pagos = agruparSuma(ingresos, function (m) { return m.tipoPago; }, valor);
    html += parrafo('Formas de pago: ' + unirTexto(pagos.map(function (g) { return g.nombre + ' ' + pesos(g.total) + ' (' + porcentajeDe(g.total, totalIngresos) + ')'; })) + '.');
    html += htmlTablaInforme('Detalle de ingresos', ['Fecha', 'Producto', 'Cantidad', 'Valor', 'Pago', 'Cliente'],
      ingresos.map(function (m) { return [formatearFecha(m.fecha), m.producto, m.cantidad ? numero(m.cantidad) + ' ' + (m.unidad || '') : '', pesos(valor(m)), m.tipoPago || '', m.cliente || '']; }));
  } else {
    html += parrafo('No hubo ingresos en el período.');
  }

  html += tituloSeccion('Egresos');
  if (egresos.length) {
    html += parrafo('Gastos por producto: ' + textoProductosEconomicos(agruparSuma(egresos, producto, valor), 'compra') + '.');
    const proveedores = agruparSuma(egresos.filter(function (m) { return m.proveedor; }), function (m) { return normalizarNombre(m.proveedor); }, valor);
    if (proveedores.length) {
      html += parrafo('Por proveedor: ' + unirTexto(proveedores.map(function (g) { return g.nombre + ' ' + pesos(g.total); })) + '.');
    }
    html += htmlTablaInforme('Detalle de egresos', ['Fecha', 'Producto', 'Cantidad', 'Valor', 'Proveedor', 'Factura'],
      egresos.map(function (m) { return [formatearFecha(m.fecha), m.producto, m.cantidad ? numero(m.cantidad) + ' ' + (m.unidad || '') : '', pesos(valor(m)), m.proveedor || '', m.numeroFactura || '']; }));
  } else {
    html += parrafo('No hubo egresos en el período.');
  }

  html += tituloSeccion('Remitos internos');
  if (remitos.length) {
    const destinos = agruparSuma(remitos, function (m) { return normalizarNombre(m.destino); }, valor);
    html += parrafo('Entregas por destino: ' + unirTexto(destinos.map(function (g) {
      return g.nombre + ' ' + pesos(g.total) + ' (' + cantidadTexto(g.cantidad, 'remito') + ')';
    })) + '. Por producto: ' + textoProductosEconomicos(agruparSuma(remitos, producto, valor), 'remito') + '.');
    html += htmlTablaInforme('Detalle de remitos', ['N°', 'Fecha', 'Producto', 'Cantidad', 'Valor', 'Destino'],
      remitos.map(function (m) { return [m.numero || '', formatearFecha(m.fecha), m.producto, m.cantidad ? numero(m.cantidad) + ' ' + (m.unidad || '') : '', pesos(valor(m)), m.destino || '']; }));
  } else {
    html += parrafo('No hubo remitos internos en el período.');
  }
  return html;
}
