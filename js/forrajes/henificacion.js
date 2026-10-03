/**
 * FORRAJES · HENIFICACIÓN: corte → volteos (secado) → enrollado.
 * Un corte puede ser una parte del lote: la siembra sigue "En crecimiento" con lo que queda en pie.
 * Al enrollar se crea la cosecha (rollos y kg) y se ofrece ingresarla al stock.
 */
let verCortes = 'pendientes';

function pantallaHenificacion() {
  marcoForrajes('Henificación · Forrajes', 'forrajes', function (f) {
    const cortes = f.cortesForraje.filter(function (c) { return verCortes === 'todos' || c.enrollado !== 'true'; })
      .sort(function (a, b) { return b.fechaCorte.localeCompare(a.fechaCorte); });
    const editar = puedeEditar();
    return '<label>Mostrar<select onchange="verCortes = this.value; alActualizarDatos()">' +
        '<option value="pendientes"' + (verCortes === 'pendientes' ? ' selected' : '') + '>En el campo (sin enrollar)</option>' +
        '<option value="todos"' + (verCortes === 'todos' ? ' selected' : '') + '>Todos (también enrollados)</option>' +
      '</select></label>' +
      (editar ? '<button class="boton" onclick="formularioCorte()">✂ Registrar corte</button>' : '') +
      '<p class="ayuda">Cada corte pasa por tres etapas: ✂ corte → 🔄 volteos (para que pierda humedad) → ✅ enrollado. ' +
        'Si cortás solo una parte, la siembra sigue en crecimiento con lo que queda en pie.</p>' +
      (cortes.length ? cortes.map(function (c) { return htmlTarjetaCorte(f, c, editar); }).join('')
        : '<p class="vacio">' + (verCortes === 'todos' ? 'Todavía no hay cortes registrados.' : 'No hay forraje cortado en el campo.') + '</p>');
  });
}

function htmlTarjetaCorte(f, c, editar) {
  const s = f.siembrasForrajePorId[c.siembraId];
  const volteos = f.volteosForraje.filter(function (v) { return v.corteId === c.id; }).sort(function (a, b) { return a.fecha.localeCompare(b.fecha); });
  const ultimaHumedad = volteos.filter(function (v) { return v.humedadPct !== ''; }).pop();
  const enrollado = c.enrollado === 'true';
  const cosecha = f.cosechasForrajePorId[c.cosechaId];
  const dias = diasEntre(c.fechaCorte, enrollado && c.fechaEnrollado ? c.fechaEnrollado : hoyTexto());
  const id = esc(c.id);
  const etapa = function (activa, hecha, texto) {
    return '<span class="etapa' + (hecha ? ' hecha' : activa ? ' activa' : '') + '">' + texto + '</span>';
  };
  return '<div class="tarjeta-corte' + (enrollado ? ' enrollado' : '') + '">' +
    '<div class="tarjeta-corte-cabecera"><div><strong>' + esc(c.especieId ? nombreEspecie(f, c.especieId) : (s ? resumenEspecies(f, s.id) : 'Sin especie')) + '</strong>' +
      '<span class="ayuda">' + (s ? esc(lugarTexto(f, s.loteId, s.cuadroId)) : 'Sin siembra') +
        (c.superficieHa ? ' · ' + numero(c.superficieHa) + ' ha cortadas' : '') + '</span></div>' +
      (editar ? '<button class="boton chico secundario" onclick="formularioCorte(\'' + id + '\')" aria-label="Editar">✎</button>' : '') +
    '</div>' +
    '<div class="etapas">' +
      etapa(false, true, '✂ Corte ' + diaMes(c.fechaCorte)) +
      etapa(!enrollado, enrollado || volteos.length > 0, '🔄 ' + volteos.length + ' volteo' + (volteos.length === 1 ? '' : 's')) +
      etapa(false, enrollado, enrollado ? '✅ Enrollado ' + diaMes(c.fechaEnrollado) : '✅ Enrollado') +
    '</div>' +
    '<p class="ayuda">' + (enrollado ? 'Se secó ' + dias + ' días en el campo.' : 'Hace ' + dias + ' días que está cortado.') +
      (ultimaHumedad ? ' Última humedad medida: <b>' + numero(ultimaHumedad.humedadPct) + '%</b> (' + diaMes(ultimaHumedad.fecha) + ')' +
        (!enrollado && Number(ultimaHumedad.humedadPct) <= 20 ? ' · ya está para enrollar (≤ 20%).' : '.') : '') + '</p>' +
    (volteos.length ? '<div class="lista-volteos">' + volteos.map(function (v, i) {
      return '<button class="chip-lomo" ' + (editar ? 'onclick="formularioVolteo(\'' + esc(v.id) + '\')"' : 'disabled') + '>Volteo ' + (i + 1) + ' · ' + diaMes(v.fecha) +
        (v.humedadPct !== '' ? ' · ' + numero(v.humedadPct) + '%' : '') + '</button>';
    }).join('') + '</div>' : '') +
    (enrollado && cosecha
      ? '<p class="ayuda">Cosecha: <b>' + numero(cosecha.cantidadRollos) + ' rollos · ' + numero(cosecha.cantidadTotalKg) + ' kg</b>' +
          (cosecha.ingresadaAInventario === 'true' ? ' · en stock' : '') + '</p>' +
        (editar && cosecha.ingresadaAInventario !== 'true' ? '<button class="boton chico" onclick="ingresarCosechaAlStock(\'' + esc(cosecha.id) + '\')">Ingresar al stock</button>' : '')
      : '') +
    (editar && !enrollado
      ? '<div class="botones-alta"><button class="boton chico secundario" onclick="formularioVolteo(null, \'' + id + '\')">🔄 + Volteo</button>' +
        '<button class="boton chico" onclick="formularioEnrollado(\'' + id + '\')">✅ Enrollado</button></div>'
      : '') +
    (c.notas ? '<p class="ayuda notas">' + esc(c.notas) + '</p>' : '') +
  '</div>';
}

async function formularioCorte(id, siembraId) {
  const f = await cargarForrajes();
  const c = id ? f.cortesForrajePorId[id] : null;
  const siembraInicial = c ? c.siembraId : siembraId;
  const especies = siembraInicial ? especiesDeSiembra(f, siembraInicial) : [];
  await abrirFormulario({
    tabla: 'CortesForraje',
    titulo: c ? 'Editar corte' : 'Registrar corte',
    registro: c,
    valores: { fechaCorte: hoyTexto(), siembraId: siembraId || '', enrollado: 'false', especieId: especies.length === 1 ? especies[0].especieId : '' },
    campos: [
      { nombre: 'siembraId', etiqueta: 'Siembra', tipo: 'select', requerido: true, vacio: 'Elegí…',
        opciones: f.siembrasForraje.filter(function (s) { return s.estado === 'En crecimiento' || s.id === siembraInicial; })
          .map(function (s) { return { valor: s.id, texto: descripcionSiembraForraje(f, s) }; }) },
      { nombre: 'especieId', etiqueta: 'Especie cortada', tipo: 'select', vacio: '—',
        opciones: f.especiesForraje.map(function (e) { return { valor: e.id, texto: e.nombre }; }) },
      { nombre: 'fechaCorte', etiqueta: 'Fecha de corte', tipo: 'fecha', requerido: true, medio: true },
      { nombre: 'superficieHa', etiqueta: 'Superficie cortada (ha)', tipo: 'numero', minimo: 0, medio: true, ayuda: 'Si cortaste solo una parte' },
      { nombre: 'notas', etiqueta: 'Notas', tipo: 'area' }
    ],
    preguntaEliminar: '¿Eliminar este corte y sus volteos?' + (c && c.cosechaId ? ' (La cosecha que generó queda guardada.)' : ''),
    eliminar: async function (corte) {
      for (const v of f.volteosForraje.filter(function (x) { return x.corteId === corte.id; })) await Datos.eliminar('VolteosForraje', v.id);
      await Datos.eliminar('CortesForraje', corte.id);
    }
  });
}

async function formularioVolteo(id, corteId) {
  const f = await cargarForrajes();
  const v = id ? f.volteosForrajePorId[id] : null;
  await abrirFormulario({
    tabla: 'VolteosForraje',
    titulo: v ? 'Editar volteo' : 'Registrar volteo',
    registro: v,
    valores: { fecha: hoyTexto(), corteId: corteId },
    ayuda: 'El heno se enrolla cuando baja a 18–20% de humedad.',
    campos: [
      { nombre: 'fecha', etiqueta: 'Fecha', tipo: 'fecha', requerido: true, medio: true },
      { nombre: 'humedadPct', etiqueta: 'Humedad %', tipo: 'numero', minimo: 0, medio: true, ayuda: 'Si la mediste' },
      { nombre: 'notas', etiqueta: 'Notas', tipo: 'area' }
    ],
    antesDeGuardar: function (d) { d.corteId = v ? v.corteId : corteId; },
    validar: function (d) {
      const corte = f.cortesForrajePorId[d.corteId];
      return corte && d.fecha < corte.fechaCorte ? 'El volteo no puede ser antes del corte (' + formatearFecha(corte.fechaCorte) + ').' : null;
    },
    preguntaEliminar: '¿Eliminar este volteo?'
  });
}

/** Enrollado: crea la cosecha con los rollos y ofrece ingresarla al stock. */
async function formularioEnrollado(corteId) {
  const f = await cargarForrajes();
  const c = f.cortesForrajePorId[corteId];
  if (!c) return;
  const volteos = f.volteosForraje.filter(function (v) { return v.corteId === corteId && v.humedadPct !== ''; }).sort(function (a, b) { return a.fecha.localeCompare(b.fecha); });
  let cosechaCreada = null;
  await abrirFormulario({
    tabla: 'CosechasForraje',
    titulo: '✅ Enrollado',
    valores: { fechaEnrollado: hoyTexto(), humedadPct: volteos.length ? volteos[volteos.length - 1].humedadPct : '' },
    ayuda: 'Se registra la cosecha con los rollos. La siembra sigue en crecimiento si quedó forraje sin cortar.',
    campos: [
      { nombre: 'fechaEnrollado', etiqueta: 'Fecha de enrollado', tipo: 'fecha', requerido: true },
      { nombre: 'cantidadRollos', etiqueta: 'Cantidad de rollos', tipo: 'entero', requerido: true, minimo: 1, medio: true },
      { nombre: 'pesoPromedioRolloKg', etiqueta: 'Peso promedio (kg)', tipo: 'numero', requerido: true, minimo: 0, medio: true },
      { nombre: 'humedadPct', etiqueta: 'Humedad al enrollar %', tipo: 'numero', minimo: 0, medio: true },
      { nombre: 'calidadObservaciones', etiqueta: 'Calidad / observaciones', tipo: 'area' },
      { nombre: 'terminoSiembra', etiqueta: 'Con este corte se terminó la siembra (no queda forraje en pie)', tipo: 'sino' }
    ],
    validar: function (d) { return d.fechaEnrollado < c.fechaCorte ? 'El enrollado no puede ser antes del corte.' : null; },
    guardar: async function (d) {
      const total = Number(d.cantidadRollos) * Number(d.pesoPromedioRolloKg);
      const s = f.siembrasForrajePorId[c.siembraId];
      const ha = Number(c.superficieHa);
      cosechaCreada = await Datos.guardar('CosechasForraje', {
        siembraId: c.siembraId, especieId: c.especieId, fecha: d.fechaEnrollado, tipoAprovechamiento: 'Corte para heno',
        cantidadTotalKg: String(total), cantidadRollos: d.cantidadRollos, pesoPromedioRolloKg: d.pesoPromedioRolloKg,
        humedadPct: d.humedadPct, rendimientoKgMsHa: '', calidadObservaciones: [d.calidadObservaciones, ha ? 'Corte de ' + numero(ha) + ' ha' : ''].filter(Boolean).join(' · '),
        ingresadaAInventario: 'false'
      });
      await Datos.guardar('CortesForraje', { id: c.id, enrollado: 'true', fechaEnrollado: d.fechaEnrollado, cosechaId: cosechaCreada.id });
      if (d.terminoSiembra === 'true' && s) await Datos.guardar('SiembrasForraje', { id: s.id, estado: 'Cosechada' });
      return cosechaCreada;
    },
    despuesDeGuardar: async function (g) {
      if (confirm('Se registraron ' + numero(g.cantidadRollos) + ' rollos (' + numero(g.cantidadTotalKg) + ' kg). ¿Ingresarlos al stock ahora?')) {
        await ingresarCosechaAlStock(g.id);
      }
    }
  });
}
