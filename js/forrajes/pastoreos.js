/**
 * FORRAJES · PASTOREOS: entrada y salida de animales a un lote o cuadro.
 * Calcula días de pastoreo, días-animal (cabezas × días) y carga (cabezas por hectárea).
 * No depende de Raciones: los animales se describen directamente.
 */
let verPastoreos = 'todos';

/** Datos calculados de un pastoreo. */
function infoPastoreo(f, p) {
  const s = f.siembrasForrajePorId[p.siembraId];
  const enCurso = !p.fechaSalida;
  const hasta = enCurso ? hoyTexto() : p.fechaSalida;
  const dias = Math.max(1, diasEntre(p.fechaEntrada, hasta) + (enCurso ? 0 : 1)); // entrada y salida cuentan
  const cabezas = Number(p.cabezas) || 0;
  const superficieM2 = s ? superficieReferenciaM2(f, s.loteId, s.cuadroId) : null;
  const ha = superficieM2 ? superficieM2 / 10000 : null;
  return {
    siembra: s, enCurso: enCurso, dias: dias, cabezas: cabezas, diasAnimal: dias * cabezas,
    ha: ha, carga: ha ? cabezas / ha : null,
    lugar: s ? lugarTexto(f, s.loteId, s.cuadroId) : 'Sin siembra',
    animales: [p.animales, f.categoriasAnimalesPorId[p.categoriaId] ? f.categoriasAnimalesPorId[p.categoriaId].nombre : ''].filter(Boolean).join(' · ') || 'Animales'
  };
}

function pastoreosDeSiembra(f, siembraId) {
  return f.pastoreosForraje.filter(function (p) { return p.siembraId === siembraId; });
}

function pantallaPastoreos() {
  marcoForrajes('Pastoreos · Forrajes', 'forrajes', function (f) {
    const lista = f.pastoreosForraje.filter(function (p) { return verPastoreos === 'todos' || !p.fechaSalida; })
      .sort(function (a, b) { return (a.fechaSalida ? 1 : 0) - (b.fechaSalida ? 1 : 0) || b.fechaEntrada.localeCompare(a.fechaEntrada); });
    const enCurso = f.pastoreosForraje.filter(function (p) { return !p.fechaSalida; });
    const anio = hoyTexto().slice(0, 4);
    const delAnio = f.pastoreosForraje.filter(function (p) { return p.fechaEntrada.slice(0, 4) === anio; });
    const diasAnimal = delAnio.reduce(function (t, p) { return t + infoPastoreo(f, p).diasAnimal; }, 0);
    return '<div class="resumen resumen-3">' +
        '<div class="' + (enCurso.length ? 'ok' : '') + '"><b>' + enCurso.length + '</b><span>Lotes con animales ahora</span></div>' +
        '<div><b>' + delAnio.length + '</b><span>Pastoreos ' + anio + '</span></div>' +
        '<div><b>' + numero(diasAnimal) + '</b><span>Días-animal ' + anio + '</span></div>' +
      '</div>' +
      '<label>Mostrar<select onchange="verPastoreos = this.value; alActualizarDatos()">' +
        '<option value="todos"' + (verPastoreos === 'todos' ? ' selected' : '') + '>Todos</option>' +
        '<option value="encurso"' + (verPastoreos === 'encurso' ? ' selected' : '') + '>Solo con animales adentro</option>' +
      '</select></label>' +
      (puedeEditar() ? '<button class="boton" onclick="formularioPastoreo()">🐑 Registrar entrada de animales</button>' : '') +
      '<p class="ayuda">Días-animal = cabezas × días (sirve para comparar pastoreos). Carga = cabezas por hectárea del lote o cuadro.</p>' +
      (lista.length ? lista.map(function (p) { return htmlTarjetaPastoreo(f, p); }).join('') : '<p class="vacio">Todavía no hay pastoreos registrados.</p>');
  });
}

function htmlTarjetaPastoreo(f, p) {
  const i = infoPastoreo(f, p);
  const id = esc(p.id);
  return '<div class="tarjeta-corte' + (i.enCurso ? '' : ' enrollado') + '">' +
    '<div class="tarjeta-corte-cabecera"><div><strong>' + esc(i.lugar) + (i.siembra ? ' · ' + esc(nombreCortoMezcla(f, i.siembra.id)) : '') + '</strong>' +
      '<span class="ayuda">' + numero(i.cabezas) + ' cabezas · ' + esc(i.animales) + '</span></div>' +
      (puedeEditar() ? '<button class="boton chico secundario" onclick="formularioPastoreo(\'' + id + '\')" aria-label="Editar">✎</button>' : '') +
    '</div>' +
    '<div class="etapas">' +
      '<span class="etapa hecha">⬇ Entrada ' + diaMes(p.fechaEntrada) + '</span>' +
      (i.enCurso ? '<span class="etapa activa">🐑 Adentro hace ' + i.dias + ' día' + (i.dias === 1 ? '' : 's') + '</span>'
        : '<span class="etapa hecha">⬆ Salida ' + diaMes(p.fechaSalida) + ' · ' + i.dias + ' días</span>') +
    '</div>' +
    '<p class="ayuda">' + [
      numero(i.diasAnimal) + ' días-animal',
      i.carga !== null ? numero(Math.round(i.carga * 10) / 10) + ' cabezas/ha' : 'sin superficie para calcular la carga',
      p.alturaEntradaCm ? 'altura ' + numero(p.alturaEntradaCm) + ' cm' + (p.alturaSalidaCm ? ' → ' + numero(p.alturaSalidaCm) + ' cm' : '') : '',
      p.kgEstimados ? '≈ ' + numero(p.kgEstimados) + ' kg consumidos' : ''
    ].filter(Boolean).join(' · ') + '</p>' +
    (p.notas ? '<p class="ayuda notas">' + esc(p.notas) + '</p>' : '') +
    (puedeEditar() && i.enCurso ? '<div class="botones-alta"><button class="boton chico" onclick="registrarSalidaPastoreo(\'' + id + '\')">⬆ Registrar salida</button></div>' : '') +
  '</div>';
}

async function formularioPastoreo(id, siembraId) {
  const f = await cargarForrajes();
  const p = id ? f.pastoreosForrajePorId[id] : null;
  const siembraInicial = p ? p.siembraId : siembraId;
  await abrirFormulario({
    tabla: 'PastoreosForraje',
    titulo: p ? 'Editar pastoreo' : 'Registrar entrada de animales',
    registro: p,
    valores: { fechaEntrada: hoyTexto(), siembraId: siembraId || '' },
    ayuda: 'Dejá la fecha de salida vacía mientras los animales sigan en el lote.',
    campos: [
      { nombre: 'siembraId', etiqueta: 'Lote / siembra', tipo: 'select', requerido: true, vacio: 'Elegí…',
        opciones: f.siembrasForraje.filter(function (s) { return s.estado === 'En crecimiento' || s.id === siembraInicial; })
          .map(function (s) { return { valor: s.id, texto: descripcionSiembraForraje(f, s) }; }) },
      { nombre: 'animales', etiqueta: 'Animales', tipo: 'texto', requerido: true, ayuda: 'Ej: "Ovejas", "Vacas lecheras", "Terneros de 2°"' },
      { nombre: 'cabezas', etiqueta: 'Cabezas', tipo: 'entero', requerido: true, minimo: 1, medio: true },
      { nombre: 'categoriaId', etiqueta: 'Categoría (opcional)', tipo: 'select', vacio: '—', medio: true,
        opciones: f.categoriasAnimales.filter(function (c) { return c.activo !== 'false'; }).map(function (c) { return { valor: c.id, texto: c.nombre }; }) },
      { nombre: 'fechaEntrada', etiqueta: 'Fecha de entrada', tipo: 'fecha', requerido: true, medio: true },
      { nombre: 'fechaSalida', etiqueta: 'Fecha de salida', tipo: 'fecha', medio: true },
      { nombre: 'alturaEntradaCm', etiqueta: 'Altura al entrar (cm)', tipo: 'numero', minimo: 0, medio: true, seccion: 'Opcional' },
      { nombre: 'alturaSalidaCm', etiqueta: 'Altura al salir (cm)', tipo: 'numero', minimo: 0, medio: true },
      { nombre: 'kgEstimados', etiqueta: 'Kg de forraje consumidos (estimado)', tipo: 'numero', minimo: 0 },
      { nombre: 'notas', etiqueta: 'Notas', tipo: 'area' }
    ],
    validar: function (d) {
      if (d.fechaSalida && d.fechaSalida < d.fechaEntrada) return 'La salida no puede ser antes de la entrada.';
      const otro = f.pastoreosForraje.find(function (x) { return x.siembraId === d.siembraId && !x.fechaSalida && (!p || x.id !== p.id); });
      if (otro && !d.fechaSalida && !confirm('Ese lote ya tiene animales adentro (entraron el ' + formatearFecha(otro.fechaEntrada) + '). ¿Registrar otro grupo igual?')) return 'Pastoreo no registrado.';
      return null;
    },
    preguntaEliminar: '¿Eliminar este pastoreo?'
  });
}

async function registrarSalidaPastoreo(id) {
  const f = await cargarForrajes();
  const p = f.pastoreosForrajePorId[id];
  if (!p) return;
  await abrirFormulario({
    tabla: 'PastoreosForraje',
    titulo: '⬆ Salida de los animales',
    registro: Object.assign({}, p, { fechaSalida: hoyTexto() }),
    alEliminar: false,
    campos: [
      { nombre: 'fechaSalida', etiqueta: 'Fecha de salida', tipo: 'fecha', requerido: true },
      { nombre: 'alturaSalidaCm', etiqueta: 'Altura al salir (cm)', tipo: 'numero', minimo: 0, medio: true },
      { nombre: 'kgEstimados', etiqueta: 'Kg consumidos (estimado)', tipo: 'numero', minimo: 0, medio: true },
      { nombre: 'notas', etiqueta: 'Notas', tipo: 'area' }
    ],
    validar: function (d) { return d.fechaSalida < p.fechaEntrada ? 'La salida no puede ser antes de la entrada (' + formatearFecha(p.fechaEntrada) + ').' : null; }
  });
}
