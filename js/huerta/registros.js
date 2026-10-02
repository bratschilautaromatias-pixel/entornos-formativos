/**
 * HUERTA: riego (con cálculo de necesidad), tratamientos, cosechas y análisis de suelo.
 */

function opcionesSiembras(h, incluirId) {
  return h.siembras
    .filter(function (s) { return HUERTA.activas.indexOf(s.estado) !== -1 || s.id === incluirId; })
    .sort(function (a, b) { return descripcionSiembra(h, a).localeCompare(descripcionSiembra(h, b)); })
    .map(function (s) { return { valor: s.id, texto: descripcionSiembra(h, s) }; });
}

/* ---------- Riego ---------- */

let siembraRiego = '';

function pantallaRiego() {
  marcoHuerta('Riego · Huerta', 'huerta', async function (h) {
    const opciones = opcionesSiembras(h);
    if (!siembraRiego || !h.siembrasPorId[siembraRiego]) siembraRiego = opciones.length ? opciones[0].valor : '';
    let html =
      '<label>Siembra<select onchange="siembraRiego = this.value; alActualizarDatos()">' +
        opciones.map(function (o) { return '<option value="' + esc(o.valor) + '"' + (o.valor === siembraRiego ? ' selected' : '') + '>' + esc(o.texto) + '</option>'; }).join('') +
      '</select></label>';
    if (!siembraRiego) return html + '<p class="vacio">No hay siembras activas.</p>';

    const s = h.siembrasPorId[siembraRiego];
    const superficie = superficieSiembraM2(h, s);
    if (puedeEditar()) html += '<button class="boton" onclick="formularioRiego(null, siembraRiego)">💧 Registrar riego</button>';

    try {
      const ubicacion = await ubicacionClima(h.parcelasPorId[s.parcelaId]);
      const clima = await obtenerClima(ubicacion);
      const calculo = calcularRiegoSiembra(h, s, clima.dias);
      const hoy = calculo.find(function (d) { return d.fecha === hoyTexto(); });
      const ultimos = calculo.filter(function (d) { return !d.pronostico; }).slice(-7);
      const deficit7 = ultimos.reduce(function (t, d) { return t + d.lamina; }, 0);
      const proximos = calculo.filter(function (d) { return d.pronostico; });

      html += (clima.sinConexion ? '<div class="aviso">Sin conexión: se muestra el último clima guardado (' + formatearFecha(clima.actualizado) + ').</div>' : '') +
        '<div class="resumen">' +
          '<div><b>' + (hoy ? hoy.lamina.toFixed(1) : '—') + '</b><span>mm a reponer hoy</span></div>' +
          '<div><b>' + (hoy && hoy.litros !== null ? numero(Math.round(hoy.litros)) : '—') + '</b><span>litros hoy</span></div>' +
          '<div class="' + (deficit7 > 10 ? 'mal' : '') + '"><b>' + deficit7.toFixed(1) + '</b><span>mm faltantes (7 días)</span></div>' +
          '<div><b>' + (hoy ? esc(hoy.etapa) : '—') + '</b><span>Etapa' + (hoy ? ' · Kc ' + hoy.kc.toFixed(2) : '') + '</span></div>' +
        '</div>' +
        '<p class="ayuda">Superficie usada: ' + (superficie ? numero(superficie) + ' m²' : '<b>sin dato</b> (cargá la superficie del lomo o de la siembra para calcular litros)') +
        ' · Clima de ' + esc(ubicacion.origen) + ' (Open-Meteo). Cálculo: ETc = ET0 × Kc; se descuenta el 80% de la lluvia y el riego ya registrado.</p>' +
        '<div class="tabla-desplazable"><table class="tabla">' +
          '<thead><tr><th>Día</th><th>ET0</th><th>Kc</th><th>ETc</th><th>Lluvia ef.</th><th>Regado</th><th>Falta (mm)</th><th>Litros</th></tr></thead><tbody>' +
          ultimos.concat(proximos).map(function (d) {
            return '<tr class="' + (d.pronostico ? 'pronostico' : '') + (d.fecha === hoyTexto() ? ' hoy' : '') + '">' +
              '<td>' + diaMes(d.fecha) + (d.pronostico ? ' *' : '') + '</td><td>' + d.et0.toFixed(1) + '</td><td>' + d.kc.toFixed(2) + '</td>' +
              '<td>' + d.etc.toFixed(1) + '</td><td>' + d.lluviaEfectiva.toFixed(1) + '</td><td>' + d.aplicado.toFixed(1) + '</td>' +
              '<td><b>' + d.lamina.toFixed(1) + '</b></td><td>' + (d.litros === null ? '—' : numero(Math.round(d.litros))) + '</td></tr>';
          }).join('') +
        '</tbody></table></div>' +
        '<p class="ayuda">* Pronóstico. ET0 = evapotranspiración de referencia (mm/día).</p>';
    } catch (e) {
      html += '<div class="aviso error">' + esc(e.message) + '</div>';
    }

    const riegos = h.riegos.filter(function (r) { return r.siembraId === siembraRiego; }).sort(porFechaDesc);
    return html + htmlHistorial('💧 Riegos registrados', riegos, htmlLineaRiego, 'formularioRiego');
  });
}

async function formularioRiego(id, siembraId) {
  const h = await cargarHuerta();
  const r = id ? h.riegosPorId[id] : null;
  const valores = r
    ? Object.assign({}, r, { cantidad: r.unidadCarga === 'mm' ? r.laminaMm : r.litros })
    : { fecha: hoyTexto(), siembraId: siembraId || siembraRiego || '', metodo: 'Manual', unidadCarga: 'litros' };
  await abrirFormulario({
    tabla: 'Riegos',
    titulo: r ? 'Editar riego' : 'Registrar riego',
    registro: r,
    valores: valores,
    ayuda: 'Cargá la cantidad en litros o en milímetros: la otra medida se calcula con la superficie.',
    campos: [
      { nombre: 'siembraId', etiqueta: 'Siembra', tipo: 'select', requerido: true, vacio: 'Elegí…', opciones: opcionesSiembras(h, r ? r.siembraId : siembraId) },
      { nombre: 'fecha', etiqueta: 'Fecha', tipo: 'fecha', requerido: true, medio: true },
      { nombre: 'metodo', etiqueta: 'Método', tipo: 'select', opciones: HUERTA.metodosRiego, requerido: true, medio: true },
      { nombre: 'cantidad', etiqueta: 'Cantidad', tipo: 'numero', requerido: true, minimo: 0, medio: true },
      { nombre: 'unidadCarga', etiqueta: 'Unidad', tipo: 'select', opciones: [{ valor: 'litros', texto: 'Litros' }, { valor: 'mm', texto: 'Milímetros (mm)' }], requerido: true, medio: true },
      { nombre: 'notas', etiqueta: 'Notas', tipo: 'area' }
    ],
    preguntaEliminar: '¿Eliminar este riego?',
    antesDeGuardar: function (datos) {
      const s = h.siembrasPorId[datos.siembraId];
      const superficie = s ? superficieSiembraM2(h, s) : 0;
      const cantidad = Number(datos.cantidad) || 0;
      // 1 mm de agua sobre 1 m² = 1 litro
      if (datos.unidadCarga === 'mm') {
        datos.laminaMm = String(cantidad);
        datos.litros = superficie ? String(Math.round(cantidad * superficie * 100) / 100) : '';
      } else {
        datos.litros = String(cantidad);
        datos.laminaMm = superficie ? String(Math.round(cantidad / superficie * 100) / 100) : '';
      }
      delete datos.cantidad;
    }
  });
}

/* ---------- Tratamientos ---------- */

function pantallaTratamientos() {
  marcoHuerta('Tratamientos · Huerta', 'huerta', function (h) {
    const lista = h.tratamientos.slice().sort(porFechaDesc);
    const hoy = hoyTexto();
    return (puedeEditar() ? '<button class="boton" onclick="formularioTratamiento()">🧪 Registrar tratamiento</button>' : '') +
      '<p class="ayuda">El período de carencia es el tiempo que hay que esperar después de aplicar un producto antes de cosechar.</p>' +
      (lista.length ? lista.map(function (t) {
        const s = h.siembrasPorId[t.siembraId];
        const fin = finCarencia(t);
        return '<div class="movimiento' + (fin && fin >= hoy ? ' mov-egresos' : '') + '">' +
          '<div class="movimiento-texto"><strong>' + esc(t.producto) + ' · ' + esc(t.tipo) + '</strong>' +
            '<span class="ayuda">' + formatearFecha(t.fecha) + ' · ' + (s ? esc(descripcionSiembra(h, s, false)) : 'Siembra eliminada') +
              (t.dosis ? ' · ' + numero(t.dosis) + ' ' + esc(t.unidadDosis || '') : '') + (Number(t.costo) ? ' · ' + pesos(t.costo) : '') + '</span>' +
            (fin ? '<span class="ayuda">' + (fin >= hoy ? '⚠ En carencia hasta el ' : 'Carencia cumplida el ') + formatearFecha(fin) + '</span>' : '') +
          '</div>' +
          (puedeEditar() ? '<div class="movimiento-acciones"><button class="boton chico secundario" onclick="formularioTratamiento(\'' + esc(t.id) + '\')" aria-label="Editar">✎</button></div>' : '') +
        '</div>';
      }).join('') : '<p class="vacio">Todavía no hay tratamientos registrados.</p>');
  });
}

async function formularioTratamiento(id, siembraId) {
  const h = await cargarHuerta();
  const t = id ? h.tratamientosPorId[id] : null;
  await abrirFormulario({
    tabla: 'Tratamientos',
    titulo: t ? 'Editar tratamiento' : 'Registrar tratamiento',
    registro: t,
    valores: { fecha: hoyTexto(), siembraId: siembraId || '', tipo: 'Fitosanitario' },
    campos: [
      { nombre: 'siembraId', etiqueta: 'Siembra', tipo: 'select', requerido: true, vacio: 'Elegí…', opciones: opcionesSiembras(h, t ? t.siembraId : siembraId) },
      { nombre: 'producto', etiqueta: 'Producto', tipo: 'texto', requerido: true },
      { nombre: 'tipo', etiqueta: 'Tipo', tipo: 'select', opciones: HUERTA.tiposTratamiento, requerido: true, medio: true },
      { nombre: 'fecha', etiqueta: 'Fecha de aplicación', tipo: 'fecha', requerido: true, medio: true },
      { nombre: 'dosis', etiqueta: 'Dosis', tipo: 'numero', minimo: 0, medio: true },
      { nombre: 'unidadDosis', etiqueta: 'Unidad de la dosis', tipo: 'texto', medio: true, ayuda: 'Ej: cc/10 L, g/m², kg/ha' },
      { nombre: 'carenciaDias', etiqueta: 'Carencia (días)', tipo: 'entero', minimo: 0, medio: true },
      { nombre: 'costo', etiqueta: 'Costo total $', tipo: 'numero', minimo: 0, medio: true },
      { nombre: 'notas', etiqueta: 'Notas', tipo: 'area' }
    ],
    preguntaEliminar: '¿Eliminar este tratamiento?'
  });
}

/* ---------- Cosechas ---------- */

let periodoCosechas = 'anio';

function pantallaCosechas() {
  marcoHuerta('Cosechas · Huerta', 'huerta', function (h) {
    const periodo = calcularPeriodo(periodoCosechas);
    const lista = h.cosechas.filter(function (c) { return c.fecha >= periodo.desde && c.fecha <= periodo.hasta; }).sort(porFechaDesc);
    const total = lista.reduce(function (t, c) { return t + (Number(c.kg) || 0); }, 0);

    // Kilos por cultivo
    const porCultivo = {};
    lista.forEach(function (c) {
      const s = h.siembrasPorId[c.siembraId];
      const nombre = s ? nombreCultivo(h, s.cultivoId) : 'Sin siembra';
      porCultivo[nombre] = (porCultivo[nombre] || 0) + (Number(c.kg) || 0);
    });
    const ranking = Object.keys(porCultivo).sort(function (a, b) { return porCultivo[b] - porCultivo[a]; });

    return '<label>Período<select onchange="periodoCosechas = this.value; alActualizarDatos()">' +
        [['mes', 'Este mes'], ['mesAnterior', 'Mes anterior'], ['anio', 'Este año'], ['todo', 'Todo']].map(function (o) {
          return '<option value="' + o[0] + '"' + (periodoCosechas === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
        }).join('') + '</select></label>' +
      '<div class="totales"><div class="ok"><span>Total cosechado</span><b>' + numero(total) + ' kg</b><small>' + lista.length + ' cosechas · ' + esc(periodo.titulo) + '</small></div></div>' +
      (ranking.length ? '<div class="tarjeta-info"><strong>Por cultivo</strong>' + ranking.map(function (n) {
        return '<div class="barra-dato"><span>' + esc(n) + '</span><div><i style="width:' + Math.round(porCultivo[n] * 100 / porCultivo[ranking[0]]) + '%"></i></div><b>' + numero(porCultivo[n]) + ' kg</b></div>';
      }).join('') + '</div>' : '') +
      (puedeEditar() ? '<button class="boton" onclick="formularioCosecha()">🧺 Registrar cosecha</button>' : '') +
      (lista.length ? lista.map(function (c) {
        const s = h.siembrasPorId[c.siembraId];
        return '<div class="movimiento mov-ingresos">' +
          '<div class="movimiento-texto"><strong>' + (s ? esc(nombreCultivo(h, s.cultivoId)) : 'Siembra eliminada') + '</strong>' +
            '<span class="ayuda">' + formatearFecha(c.fecha) + (s ? ' · ' + esc(nombreParcela(h, s.parcelaId)) + (h.lomosPorId[s.lomoId] ? ' · Lomo ' + esc(h.lomosPorId[s.lomoId].numero) : '') : '') +
              (c.cosechaTerminada === 'true' ? ' · terminada' : '') + '</span>' +
            (c.calidad || c.notas ? '<span class="ayuda notas">' + esc([c.calidad, c.notas].filter(Boolean).join(' · ')) + '</span>' : '') +
          '</div>' +
          '<div class="movimiento-valor">' + numero(c.kg) + ' kg</div>' +
          (puedeEditar() ? '<div class="movimiento-acciones"><button class="boton chico secundario" onclick="formularioCosecha(\'' + esc(c.id) + '\')" aria-label="Editar">✎</button></div>' : '') +
        '</div>';
      }).join('') : '<p class="vacio">No hay cosechas en este período.</p>');
  });
}

async function formularioCosecha(id, siembraId) {
  const h = await cargarHuerta();
  const c = id ? h.cosechasPorId[id] : null;
  await abrirFormulario({
    tabla: 'Cosechas',
    titulo: c ? 'Editar cosecha' : 'Registrar cosecha',
    registro: c,
    valores: { fecha: hoyTexto(), siembraId: siembraId || '', cosechaTerminada: 'false' },
    campos: [
      { nombre: 'siembraId', etiqueta: 'Siembra', tipo: 'select', requerido: true, vacio: 'Elegí…', opciones: opcionesSiembras(h, c ? c.siembraId : siembraId) },
      { nombre: 'fecha', etiqueta: 'Fecha', tipo: 'fecha', requerido: true, medio: true },
      { nombre: 'kg', etiqueta: 'Kilos cosechados', tipo: 'numero', requerido: true, minimo: 0, medio: true },
      { nombre: 'cosechaTerminada', etiqueta: 'Con esta cosecha se terminó la siembra', tipo: 'sino' },
      { nombre: 'calidad', etiqueta: 'Calidad / observaciones', tipo: 'texto' },
      { nombre: 'notas', etiqueta: 'Notas', tipo: 'area' }
    ],
    preguntaEliminar: '¿Eliminar esta cosecha?',
    validar: function (datos) {
      const activas = carenciasActivas(h, datos.siembraId).filter(function (t) { return datos.fecha <= finCarencia(t); });
      if (activas.length && !confirm('⚠ Esta siembra está en carencia hasta el ' + formatearFecha(finCarencia(activas[0])) +
          ' (' + activas[0].producto + '). ¿Registrar la cosecha igual?')) return 'Cosecha no registrada.';
      return null;
    },
    despuesDeGuardar: async function (guardada) {
      // La siembra pasa a "En cosecha" o, si terminó, a "Cosechada"
      const s = h.siembrasPorId[guardada.siembraId];
      if (!s) return;
      const nuevo = guardada.cosechaTerminada === 'true' ? 'Cosechada' : (s.estado === 'En curso' ? 'En cosecha' : s.estado);
      if (nuevo !== s.estado) await Datos.guardar('Siembras', { id: s.id, estado: nuevo });
    }
  });
}

/* ---------- Análisis de suelo ---------- */

function pantallaSuelo() {
  marcoHuerta('Análisis de suelo · Huerta', 'huerta', function (h) {
    const lista = h.analisisSuelo.slice().sort(porFechaDesc);
    return (puedeEditar() ? '<button class="boton" onclick="formularioSuelo()">🧫 Registrar análisis</button>' : '') +
      '<p class="ayuda">pH ideal para la mayoría de las hortalizas: 6 a 7. Conductividad eléctrica (salinidad): mejor por debajo de 2 dS/m.</p>' +
      (lista.length ? lista.map(function (a) {
        const lomo = h.lomosPorId[a.lomoId];
        const ph = Number(a.ph);
        const ce = Number(a.conductividad);
        return '<div class="movimiento">' +
          '<div class="movimiento-texto"><strong>' + esc(nombreParcela(h, a.parcelaId)) + (lomo ? ' · Lomo ' + esc(lomo.numero) : '') + '</strong>' +
            '<span class="ayuda">' + formatearFecha(a.fecha) +
              (a.ph ? ' · pH ' + numero(ph) + (ph < 6 ? ' (ácido)' : ph > 7.5 ? ' (alcalino)' : ' (bien)') : '') +
              (a.conductividad ? ' · CE ' + numero(ce) + ' dS/m' + (ce > 2 ? ' (salino)' : '') : '') + '</span>' +
            (a.notas ? '<span class="ayuda notas">' + esc(a.notas) + '</span>' : '') +
          '</div>' +
          (puedeEditar() ? '<div class="movimiento-acciones"><button class="boton chico secundario" onclick="formularioSuelo(\'' + esc(a.id) + '\')" aria-label="Editar">✎</button></div>' : '') +
        '</div>';
      }).join('') : '<p class="vacio">Todavía no hay análisis cargados.</p>');
  });
}

async function formularioSuelo(id) {
  const h = await cargarHuerta();
  const a = id ? h.analisisSueloPorId[id] : null;
  await abrirFormulario({
    tabla: 'AnalisisSuelo',
    titulo: a ? 'Editar análisis de suelo' : 'Registrar análisis de suelo',
    registro: a,
    valores: { fecha: hoyTexto() },
    campos: [
      { nombre: 'parcelaId', etiqueta: 'Parcela', tipo: 'select', requerido: true, vacio: 'Elegí…', medio: true,
        opciones: h.parcelas.map(function (p) { return { valor: p.id, texto: p.nombre }; }) },
      { nombre: 'lomoId', etiqueta: 'Lomo', tipo: 'select', vacio: 'Toda la parcela', medio: true, recalcularCon: ['parcelaId'],
        opciones: function (v) { return h.lomos.filter(function (l) { return l.parcelaId === v.parcelaId; }).map(function (l) { return { valor: l.id, texto: etiquetaLomo(l) }; }); } },
      { nombre: 'fecha', etiqueta: 'Fecha', tipo: 'fecha', requerido: true },
      { nombre: 'ph', etiqueta: 'pH', tipo: 'numero', minimo: 0, medio: true },
      { nombre: 'conductividad', etiqueta: 'Conductividad (dS/m)', tipo: 'numero', minimo: 0, medio: true },
      { nombre: 'notas', etiqueta: 'Notas', tipo: 'area' }
    ],
    validar: function (d) { return !d.ph && !d.conductividad ? 'Cargá al menos el pH o la conductividad.' : null; },
    preguntaEliminar: '¿Eliminar este análisis?'
  });
}
