/**
 * HUERTA · PRODUCCIÓN: menú, siembras y ficha de cada siembra.
 * Direcciones: #/huerta (menú) · #/huerta/siembras · #/huerta/siembra/<id> · #/huerta/<sección>
 */
const SECCIONES_HUERTA = [
  { clave: 'siembras', nombre: 'Siembras', icono: '🌱', detalle: 'Qué hay sembrado en cada parcela y lomo' },
  { clave: 'riego', nombre: 'Riego', icono: '💧', detalle: 'Cuánto regar según el clima y la etapa del cultivo' },
  { clave: 'cosechas', nombre: 'Cosechas', icono: '🧺', detalle: 'Kilos cosechados por siembra' },
  { clave: 'tratamientos', nombre: 'Tratamientos', icono: '🧪', detalle: 'Fitosanitarios, fertilización y carencias' },
  { clave: 'almacigos', nombre: 'Almácigos', icono: '🌿', detalle: 'Bandejas, germinación y trasplante' },
  { clave: 'parcelas', nombre: 'Parcelas y lomos', icono: '🗺', detalle: 'Superficies, suelo y ubicación' },
  { clave: 'suelo', nombre: 'Análisis de suelo', icono: '🧫', detalle: 'pH y conductividad por parcela o lomo' },
  { clave: 'cultivos', nombre: 'Cultivos', icono: '📖', detalle: 'Fichas: distancias, asociaciones, rotación, Kc' },
  { clave: 'clima', nombre: 'Clima', icono: '⛅', detalle: 'Temperaturas, lluvias y pronóstico' }
];

PANTALLAS.huerta = function (parametro) {
  const partes = String(parametro || '').split('/');
  const seccion = partes[0];
  const id = partes[1];
  const pantallas = {
    siembras: pantallaSiembras, siembra: pantallaFichaSiembra, riego: pantallaRiego, cosechas: pantallaCosechas,
    tratamientos: pantallaTratamientos, almacigos: pantallaAlmacigos, parcelas: pantallaParcelas,
    suelo: pantallaSuelo, cultivos: pantallaCultivos, cultivo: pantallaFichaCultivo, clima: pantallaClima
  };
  if (pantallas[seccion]) return pantallas[seccion](id);
  pantallaMenuHuerta();
};

/** Desde "Producción" de Huerta se va al menú de Huerta. */
const produccionAnterior = PANTALLAS.produccion;
PANTALLAS.produccion = function (clave) {
  if (clave === 'huerta') return ir('huerta');
  return produccionAnterior(clave);
};

/** Arma una pantalla de Huerta con su barra y un lugar para el contenido. */
function marcoHuerta(titulo, volverA, dibujar) {
  render(htmlBarra(titulo, volverA) + '<main class="contenido" id="contenido-huerta"><p class="vacio">Cargando…</p></main>');
  const redibujar = async function () {
    const lugar = document.getElementById('contenido-huerta');
    if (!lugar) return;
    const h = await cargarHuerta();
    if (!document.getElementById('contenido-huerta')) return;
    lugar.innerHTML = await dibujar(h);
  };
  alActualizarDatos = redibujar;
  redibujar();
}

/* ---------- Menú ---------- */

function pantallaMenuHuerta() {
  marcoHuerta('Producción · Huerta', 'entorno/huerta', function (h) {
    const activas = h.siembras.filter(function (s) { return HUERTA.activas.indexOf(s.estado) !== -1; });
    const anio = String(new Date().getFullYear());
    const kgAnio = h.cosechas.filter(function (c) { return c.fecha.slice(0, 4) === anio; })
      .reduce(function (t, c) { return t + (Number(c.kg) || 0); }, 0);
    const enCarencia = activas.filter(function (s) { return carenciasActivas(h, s.id).length; }).length;
    const almacigos = h.almacigos.filter(function (a) { return a.activo !== 'false' && a.estado === 'En almácigo'; }).length;

    return '<h1>🌱 PRODUCCIÓN · HUERTA</h1>' +
      '<div class="resumen">' +
        '<div><b>' + activas.length + '</b><span>Siembras activas</span></div>' +
        '<div class="ok"><b>' + numero(kgAnio) + '</b><span>Kg cosechados ' + anio + '</span></div>' +
        '<div><b>' + almacigos + '</b><span>Almácigos</span></div>' +
        '<div class="' + (enCarencia ? 'mal' : '') + '"><b>' + enCarencia + '</b><span>En carencia</span></div>' +
      '</div>' +
      '<div class="grilla grilla-secciones">' +
        SECCIONES_HUERTA.map(function (s) {
          return '<button class="cuadro" onclick="ir(\'huerta/' + s.clave + '\')">' +
            '<span class="icono">' + s.icono + '</span>' +
            '<span class="nombre">' + esc(s.nombre) + '</span>' +
            '<span class="detalle">' + esc(s.detalle) + '</span>' +
          '</button>';
        }).join('') +
      '</div>';
  });
}

/* ---------- Siembras ---------- */

const filtroSiembras = { estado: 'activas', parcela: '' };

function pantallaSiembras() {
  marcoHuerta('Siembras · Huerta', 'huerta', function (h) {
    const lista = h.siembras.filter(function (s) {
      const porEstado = filtroSiembras.estado === 'todas' ? true
        : filtroSiembras.estado === 'activas' ? HUERTA.activas.indexOf(s.estado) !== -1
        : s.estado === filtroSiembras.estado;
      return porEstado && (!filtroSiembras.parcela || s.parcelaId === filtroSiembras.parcela);
    });

    let html =
      '<div class="filtros">' +
        '<label>Mostrar<select onchange="filtroSiembras.estado = this.value; alActualizarDatos()">' +
          [['activas', 'Activas (en curso o en cosecha)'], ['todas', 'Todas']].concat(HUERTA.estadosSiembra.map(function (e) { return [e, e]; }))
            .map(function (o) { return '<option value="' + o[0] + '"' + (filtroSiembras.estado === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') +
        '</select></label>' +
        '<label>Parcela<select onchange="filtroSiembras.parcela = this.value; alActualizarDatos()">' +
          '<option value="">Todas</option>' +
          h.parcelas.map(function (p) { return '<option value="' + esc(p.id) + '"' + (filtroSiembras.parcela === p.id ? ' selected' : '') + '>' + esc(p.nombre) + '</option>'; }).join('') +
        '</select></label>' +
      '</div>' +
      (puedeEditar() ? '<button class="boton" onclick="formularioSiembra()">+ Nueva siembra</button>' : '');

    if (!lista.length) return html + '<p class="vacio">No hay siembras para mostrar.</p>';

    // Agrupadas por parcela, ordenadas por lomo
    h.parcelas.concat([{ id: '__sin', nombre: 'Sin parcela' }]).forEach(function (p) {
      const dePacela = lista.filter(function (s) { return (h.parcelasPorId[s.parcelaId] ? s.parcelaId : '__sin') === p.id; })
        .sort(function (a, b) {
          const la = h.lomosPorId[a.lomoId], lb = h.lomosPorId[b.lomoId];
          return (la ? Number(la.numero) : 999) - (lb ? Number(lb.numero) : 999) || b.fechaSiembra.localeCompare(a.fechaSiembra);
        });
      if (!dePacela.length) return;
      html += '<h2 class="grupo-titulo">' + esc(p.nombre) + ' <span class="contador">' + dePacela.length + '</span></h2>' +
        dePacela.map(function (s) { return htmlTarjetaSiembra(h, s); }).join('');
    });
    return html;
  });
}

function htmlTarjetaSiembra(h, s) {
  const cultivo = h.cultivosPorId[s.cultivoId];
  const dias = diasEntre(s.fechaSiembra, hoyTexto());
  const etapa = etapaYKc(cultivo, dias).etapa;
  const lomo = h.lomosPorId[s.lomoId];
  const kg = h.cosechas.filter(function (c) { return c.siembraId === s.id; }).reduce(function (t, c) { return t + (Number(c.kg) || 0); }, 0);
  const carencia = carenciasActivas(h, s.id);
  const id = esc(s.id);
  return '<div class="tarjeta-siembra estado-' + esc(String(s.estado).toLowerCase().replace(/\s/g, '-')) + '">' +
    '<button class="tarjeta-siembra-texto" onclick="ir(\'huerta/siembra/' + id + '\')">' +
      '<strong>' + (lomo ? 'Lomo ' + esc(lomo.numero) + ' · ' : '') + esc(nombreCultivo(h, s.cultivoId)) + '</strong>' +
      '<span class="ayuda">Sembrado ' + formatearFecha(s.fechaSiembra) + ' · ' + dias + ' días · ' +
        (Number(s.cantidadPlantas) ? numero(s.cantidadPlantas) + ' plantas · ' : '') +
        (HUERTA.activas.indexOf(s.estado) !== -1 ? 'Etapa ' + esc(etapa.toLowerCase()) + ' · ' : '') + esc(s.estado) +
        (kg ? ' · ' + numero(kg) + ' kg' : '') + '</span>' +
      (carencia.length ? '<span class="aviso-carencia">⚠ En carencia hasta el ' + formatearFecha(finCarencia(carencia[0])) + '</span>' : '') +
    '</button>' +
    (puedeEditar() && HUERTA.activas.indexOf(s.estado) !== -1
      ? '<div class="acciones-siembra">' +
          '<button class="boton chico secundario" onclick="formularioRiego(null, \'' + id + '\')" title="Registrar riego">💧</button>' +
          '<button class="boton chico secundario" onclick="formularioTratamiento(null, \'' + id + '\')" title="Registrar tratamiento">🧪</button>' +
          '<button class="boton chico secundario" onclick="formularioCosecha(null, \'' + id + '\')" title="Registrar cosecha">🧺</button>' +
        '</div>'
      : '') +
  '</div>';
}

/* ---------- Ficha de una siembra ---------- */

function pantallaFichaSiembra(id) {
  marcoHuerta('Siembra · Huerta', 'huerta/siembras', function (h) {
    const s = h.siembrasPorId[id];
    if (!s) return '<p class="vacio">No se encontró la siembra (puede haber sido eliminada).</p>';
    const cultivo = h.cultivosPorId[s.cultivoId];
    const dias = diasEntre(s.fechaSiembra, hoyTexto());
    const ek = etapaYKc(cultivo, dias);
    const ciclo = duracionCicloDias(cultivo);
    const superficie = superficieSiembraM2(h, s);
    const riegos = h.riegos.filter(function (r) { return r.siembraId === id; }).sort(porFechaDesc);
    const tratamientos = h.tratamientos.filter(function (t) { return t.siembraId === id; }).sort(porFechaDesc);
    const cosechas = h.cosechas.filter(function (c) { return c.siembraId === id; }).sort(porFechaDesc);
    const kg = cosechas.reduce(function (t, c) { return t + (Number(c.kg) || 0); }, 0);
    const litros = riegos.reduce(function (t, r) { return t + (Number(r.litros) || 0); }, 0);
    const carencia = carenciasActivas(h, id);
    const almacigo = h.almacigosPorId[s.almacigoId];
    const editar = puedeEditar();

    return '<h1>' + esc(nombreCultivo(h, s.cultivoId)) + '</h1>' +
      '<p class="saludo">' + esc(descripcionSiembra(h, s, false)) + '</p>' +
      (carencia.length ? '<div class="aviso error">⚠ En período de carencia hasta el ' + formatearFecha(finCarencia(carencia[0])) +
        ' (' + esc(carencia[0].producto) + '). No cosechar antes.</div>' : '') +
      '<div class="resumen resumen-3">' +
        '<div><b>' + (Number(s.cantidadPlantas) ? numero(s.cantidadPlantas) : '—') + '</b><span>Plantas</span></div>' +
        '<div><b>' + dias + '</b><span>Días desde la siembra</span></div>' +
        '<div><b>' + esc(ek.etapa) + '</b><span>Etapa (Kc ' + ek.kc.toFixed(2) + ')</span></div>' +
        '<div class="ok"><b>' + numero(kg) + '</b><span>Kg cosechados</span></div>' +
        '<div class="ok"><b>' + (kg && Number(s.cantidadPlantas) ? numero(kg / Number(s.cantidadPlantas)) : '—') + '</b><span>Kg por planta</span></div>' +
        '<div><b>' + numero(litros) + '</b><span>Litros regados</span></div>' +
      '</div>' +
      (ciclo ? '<div class="avance"><div class="avance-barra" style="width:' + Math.min(100, Math.round(dias * 100 / ciclo)) + '%"></div></div>' +
        '<p class="ayuda centrado">Ciclo estimado: ' + ciclo + ' días' + (cultivo && cultivo.diasACosechaTexto ? ' · A cosecha: ' + esc(cultivo.diasACosechaTexto) + ' días' : '') + '</p>' : '') +

      (editar
        ? '<div class="botones-alta">' +
            '<button class="boton chico" onclick="formularioRiego(null, \'' + esc(id) + '\')">💧 Riego</button>' +
            '<button class="boton chico" onclick="formularioTratamiento(null, \'' + esc(id) + '\')">🧪 Tratamiento</button>' +
            '<button class="boton chico" onclick="formularioCosecha(null, \'' + esc(id) + '\')">🧺 Cosecha</button>' +
            '<button class="boton chico secundario" onclick="formularioSiembra(\'' + esc(id) + '\')">✎ Editar</button>' +
          '</div>'
        : '') +

      '<div class="tarjeta-info">' +
        dato('Estado', s.estado) + dato('Fecha de siembra', formatearFecha(s.fechaSiembra)) +
        dato('Superficie', superficie ? numero(superficie) + ' m²' + (Number(s.superficieM2) ? '' : ' (del lomo/parcela)') : 'Sin dato') +
        dato('Cantidad de plantas', s.cantidadPlantas) +
        dato('Vino del almácigo', almacigo ? nombreCultivo(h, almacigo.cultivoId) + ' del ' + formatearFecha(almacigo.fechaSiembra) : '') +
        dato('Notas', s.notas) +
      '</div>' +

      (cultivo
        ? '<details class="desplegable"><summary>📖 Ficha del cultivo</summary>' + htmlResumenCultivo(cultivo) +
            '<p><a href="#/huerta/cultivo/' + esc(cultivo.id) + '">Ver ficha completa</a></p></details>'
        : '') +

      htmlHistorial('🧺 Cosechas', cosechas, function (c) {
        return '<strong>' + numero(c.kg) + ' kg</strong> · ' + formatearFecha(c.fecha) + (c.cosechaTerminada === 'true' ? ' · cosecha terminada' : '') +
          (c.calidad ? '<br><span class="ayuda">' + esc(c.calidad) + '</span>' : '') + (c.notas ? '<br><span class="ayuda">' + esc(c.notas) + '</span>' : '');
      }, 'formularioCosecha') +
      htmlHistorial('💧 Riegos', riegos, htmlLineaRiego, 'formularioRiego') +
      htmlHistorial('🧪 Tratamientos', tratamientos, function (t) {
        return '<strong>' + esc(t.producto) + '</strong> · ' + esc(t.tipo) + ' · ' + formatearFecha(t.fecha) +
          (t.dosis ? ' · ' + numero(t.dosis) + ' ' + esc(t.unidadDosis || '') : '') +
          (finCarencia(t) ? '<br><span class="ayuda">Carencia hasta el ' + formatearFecha(finCarencia(t)) + '</span>' : '');
      }, 'formularioTratamiento');
  });
}

function porFechaDesc(a, b) {
  return String(b.fecha).localeCompare(String(a.fecha));
}

function dato(etiqueta, valor) {
  return valor ? '<p class="dato"><span>' + esc(etiqueta) + '</span>' + esc(valor) + '</p>' : '';
}

function htmlLineaRiego(r) {
  const cantidad = [Number(r.litros) ? numero(r.litros) + ' L' : '', Number(r.laminaMm) ? numero(r.laminaMm) + ' mm' : '']
    .filter(Boolean).join(' · ') || 'Sin cantidad';
  return '<strong>' + cantidad + '</strong> · ' + esc(r.metodo || '') + ' · ' + formatearFecha(r.fecha) +
    (r.grupoId ? '<br><span class="ayuda">Parte de un riego de toda la parcela (' + numero(r.totalGrupo) + ' ' +
      (r.unidadCarga === 'mm' ? 'mm' : 'L') + ' en total)</span>' : '') +
    (r.notas ? '<br><span class="ayuda">' + esc(r.notas) + '</span>' : '');
}

function htmlHistorial(titulo, lista, dibujarFila, funcionEditar) {
  return '<h2 class="grupo-titulo">' + titulo + ' <span class="contador">' + lista.length + '</span></h2>' +
    (lista.length
      ? lista.map(function (r) {
          return '<div class="fila-historial"><div>' + dibujarFila(r) + '</div>' +
            (puedeEditar() ? '<button class="boton chico secundario" onclick="' + funcionEditar + '(\'' + esc(r.id) + '\')" aria-label="Editar">✎</button>' : '') +
          '</div>';
        }).join('')
      : '<p class="ayuda">Todavía no hay registros.</p>');
}

/* ---------- Formulario de siembra ---------- */

async function formularioSiembra(id, valoresIniciales) {
  const h = await cargarHuerta();
  const s = id ? h.siembrasPorId[id] : null;
  await abrirFormulario({
    tabla: 'Siembras',
    titulo: s ? 'Editar siembra' : 'Nueva siembra',
    registro: s,
    valores: Object.assign({ fechaSiembra: hoyTexto(), estado: 'En curso', parcelaId: filtroSiembras.parcela || '' }, valoresIniciales || {}),
    campos: [
      { nombre: 'cultivoId', etiqueta: 'Cultivo', tipo: 'select', requerido: true, vacio: 'Elegí…',
        opciones: h.cultivos.map(function (c) { return { valor: c.id, texto: c.nombre }; }) },
      { nombre: 'parcelaId', etiqueta: 'Parcela', tipo: 'select', requerido: true, vacio: 'Elegí…', medio: true,
        opciones: h.parcelas.filter(function (p) { return p.activa !== 'false' || (s && s.parcelaId === p.id); })
          .map(function (p) { return { valor: p.id, texto: p.nombre }; }) },
      { nombre: 'lomoId', etiqueta: 'Lomo', tipo: 'select', vacio: 'Toda la parcela', medio: true, recalcularCon: ['parcelaId'],
        opciones: function (v) {
          return h.lomos.filter(function (l) { return l.parcelaId === v.parcelaId; })
            .map(function (l) { return { valor: l.id, texto: etiquetaLomo(l) }; });
        } },
      { nombre: 'fechaSiembra', etiqueta: 'Fecha de siembra o trasplante', tipo: 'fecha', requerido: true, medio: true },
      { nombre: 'cantidadPlantas', etiqueta: 'Cantidad de plantas', tipo: 'entero', minimo: 0, medio: true,
        ayuda: 'Plantas sembradas en el lomo' },
      { nombre: 'estado', etiqueta: 'Estado', tipo: 'select', requerido: true, opciones: HUERTA.estadosSiembra, medio: true },
      { nombre: 'superficieM2', etiqueta: 'Superficie (m²)', tipo: 'numero', minimo: 0, medio: true,
        ayuda: 'Si la dejás vacía se usa la del lomo' },
      { nombre: 'almacigoId', etiqueta: 'Viene del almácigo', tipo: 'select', vacio: 'No (siembra directa)',
        opciones: h.almacigos.filter(function (a) { return a.activo !== 'false' || (s && s.almacigoId === a.id); })
          .map(function (a) { return { valor: a.id, texto: nombreCultivo(h, a.cultivoId) + ' · ' + formatearFecha(a.fechaSiembra) + ' · ' + a.estado }; }) },
      { nombre: 'notas', etiqueta: 'Notas', tipo: 'area' }
    ],
    preguntaEliminar: '¿Eliminar esta siembra? Sus riegos, tratamientos y cosechas quedan guardados.',
    despuesDeGuardar: async function (guardada, anterior) {
      // Si viene de un almácigo, el almácigo pasa a "Trasplantado"
      if (guardada.almacigoId && (!anterior || anterior.almacigoId !== guardada.almacigoId)) {
        const a = h.almacigosPorId[guardada.almacigoId];
        if (a && a.estado === 'En almácigo') await Datos.guardar('Almacigos', { id: a.id, estado: 'Trasplantado' });
      }
      if (!anterior) ir('huerta/siembra/' + guardada.id);
    }
  });
}
