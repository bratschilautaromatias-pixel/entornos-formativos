/**
 * HUERTA: parcelas y lomos, almácigos, catálogo de cultivos y clima.
 */

/* ---------- Parcelas y lomos ---------- */

function pantallaParcelas() {
  marcoHuerta('Parcelas y lomos · Huerta', 'huerta', function (h) {
    const editar = puedeEditar();
    return (editar ? '<button class="boton" onclick="formularioParcela()">+ Nueva parcela</button>' : '') +
      (h.parcelas.length ? h.parcelas.map(function (p) {
        const lomos = h.lomos.filter(function (l) { return l.parcelaId === p.id; });
        const activas = h.siembras.filter(function (s) { return s.parcelaId === p.id && HUERTA.activas.indexOf(s.estado) !== -1; });
        return '<div class="fila-usuario' + (p.activa === 'false' ? ' inactiva' : '') + '">' +
          '<div class="datos-usuario"><strong>' + esc(p.nombre) + (p.activa === 'false' ? ' (inactiva)' : '') + '</strong>' +
            '<span class="ayuda">' + [p.bajoCubierta === 'true' ? '🏠 Bajo cubierta' : '', p.superficieM2 ? numero(p.superficieM2) + ' m²' : 'Sin superficie', p.tipoSuelo, lomos.length + ' lomos',
              activas.length + ' siembras activas'].filter(Boolean).map(esc).join(' · ') + '</span>' +
            (lomos.length ? '<div class="chips">' + lomos.map(function (l) {
              const ocupado = h.siembras.find(function (s) { return s.lomoId === l.id && HUERTA.activas.indexOf(s.estado) !== -1; });
              return '<button class="chip-lomo' + (ocupado ? ' ocupado' : '') + '" ' + (editar ? 'onclick="formularioLomo(\'' + esc(l.id) + '\')"' : 'disabled') +
                ' title="' + esc(ocupado ? nombreCultivo(h, ocupado.cultivoId) : 'Libre') + '">' +
                esc(l.numero) + (ocupado ? ' · ' + esc(nombreCultivo(h, ocupado.cultivoId)) +
                  (Number(ocupado.cantidadPlantas) ? ' (' + numero(ocupado.cantidadPlantas) + ' pl.)' : '') : '') + '</button>';
            }).join('') + '</div>' : '') +
            (p.notas ? '<span class="ayuda notas">' + esc(p.notas) + '</span>' : '') +
          '</div>' +
          (editar ? '<div class="acciones"><button class="boton chico secundario" onclick="formularioParcela(\'' + esc(p.id) + '\')">✎ Editar</button>' +
            '<button class="boton chico secundario" onclick="formularioLomo(null, \'' + esc(p.id) + '\')">+ Lomo</button></div>' : '') +
        '</div>';
      }).join('') : '<p class="vacio">Todavía no hay parcelas.</p>') +
      '<p class="ayuda">Tocá un lomo para editarlo (por ejemplo, su superficie en m², que se usa para calcular los litros de riego).</p>';
  });
}

async function formularioParcela(id) {
  const h = await cargarHuerta();
  const p = id ? h.parcelasPorId[id] : null;
  await abrirFormulario({
    tabla: 'Parcelas',
    titulo: p ? 'Editar parcela' : 'Nueva parcela',
    registro: p,
    valores: { activa: 'true', tipoSuelo: 'Franco' },
    campos: [
      { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true },
      { nombre: 'superficieM2', etiqueta: 'Superficie (m²)', tipo: 'numero', minimo: 0, medio: true },
      { nombre: 'cantidadLomos', etiqueta: 'Cantidad de lomos', tipo: 'entero', minimo: 0, medio: true, ayuda: 'Se crean solos: Lomo 1, 2, 3…' },
      { nombre: 'superficiePorLomoM2', etiqueta: 'Superficie de cada lomo (m²)', tipo: 'numero', minimo: 0, medio: true },
      { nombre: 'tipoSuelo', etiqueta: 'Tipo de suelo', tipo: 'select', opciones: HUERTA.tiposSuelo, medio: true },
      { nombre: 'bajoCubierta', etiqueta: 'Bajo cubierta (macrotúnel / invernadero): no entra la lluvia', tipo: 'sino', seccion: 'Cubierta' },
      { nombre: 'factorCubierta', etiqueta: 'Factor de consumo bajo cubierta', tipo: 'numero', minimo: 0.3,
        ayuda: 'Parte del consumo de afuera. FAO sugiere 0,6 a 0,8. Si lo dejás vacío se usa 0,7' },
      { nombre: 'latitud', etiqueta: 'Latitud', tipo: 'numero', medio: true, seccion: 'Ubicación (opcional, para el clima)', ayuda: 'Si la dejás vacía se usa la de la escuela' },
      { nombre: 'longitud', etiqueta: 'Longitud', tipo: 'numero', medio: true },
      { nombre: 'capacidadCampoMm', etiqueta: 'Capacidad de campo (mm)', tipo: 'numero', minimo: 0, medio: true, seccion: 'Datos de suelo (opcional)',
        ayuda: 'mm de agua por metro de suelo. Si no los sabés, se estiman por el tipo de suelo' },
      { nombre: 'puntoMarchitezMm', etiqueta: 'Punto de marchitez (mm)', tipo: 'numero', minimo: 0, medio: true },
      { nombre: 'activa', etiqueta: 'Parcela activa (en uso)', tipo: 'sino' },
      { nombre: 'notas', etiqueta: 'Notas', tipo: 'area' }
    ],
    preguntaEliminar: '¿Eliminar esta parcela?',
    alEliminar: function (parcela) {
      const activas = h.siembras.filter(function (s) { return s.parcelaId === parcela.id && HUERTA.activas.indexOf(s.estado) !== -1; });
      return activas.length ? 'No se puede eliminar: tiene ' + activas.length + ' siembra(s) activa(s). Podés marcarla como inactiva.' : null;
    },
    despuesDeGuardar: async function (guardada) {
      // Crea los lomos que falten (igual que Surco)
      const cantidad = Number(guardada.cantidadLomos) || 0;
      const existentes = h.lomos.filter(function (l) { return l.parcelaId === guardada.id; }).map(function (l) { return Number(l.numero); });
      for (let n = 1; n <= cantidad; n++) {
        if (existentes.indexOf(n) === -1) {
          await Datos.guardar('Lomos', { parcelaId: guardada.id, numero: String(n), superficieM2: guardada.superficiePorLomoM2 || '', notas: '' });
        }
      }
    }
  });
}

async function formularioLomo(id, parcelaId) {
  const h = await cargarHuerta();
  const l = id ? h.lomosPorId[id] : null;
  const pid = l ? l.parcelaId : parcelaId;
  const siguiente = h.lomos.filter(function (x) { return x.parcelaId === pid; })
    .reduce(function (m, x) { return Math.max(m, Number(x.numero) || 0); }, 0) + 1;
  await abrirFormulario({
    tabla: 'Lomos',
    titulo: (l ? 'Editar lomo · ' : 'Nuevo lomo · ') + nombreParcela(h, pid),
    registro: l,
    valores: { parcelaId: pid, numero: String(siguiente) },
    campos: [
      { nombre: 'numero', etiqueta: 'Número', tipo: 'entero', requerido: true, minimo: 1, medio: true },
      { nombre: 'superficieM2', etiqueta: 'Superficie (m²)', tipo: 'numero', minimo: 0, medio: true },
      { nombre: 'notas', etiqueta: 'Notas', tipo: 'area' }
    ],
    antesDeGuardar: function (datos) { datos.parcelaId = pid; },
    validar: function (datos, anterior) {
      const repetido = h.lomos.find(function (x) { return x.parcelaId === pid && Number(x.numero) === Number(datos.numero) && (!anterior || x.id !== anterior.id); });
      return repetido ? 'Ya existe el lomo ' + datos.numero + ' en esta parcela.' : null;
    },
    preguntaEliminar: '¿Eliminar este lomo?',
    alEliminar: function (lomo) {
      const activa = h.siembras.find(function (s) { return s.lomoId === lomo.id && HUERTA.activas.indexOf(s.estado) !== -1; });
      return activa ? 'No se puede eliminar: tiene una siembra activa (' + nombreCultivo(h, activa.cultivoId) + ').' : null;
    }
  });
}

/* ---------- Almácigos ---------- */

let verAlmacigos = 'activos';

function pantallaAlmacigos() {
  marcoHuerta('Almácigos · Huerta', 'huerta', function (h) {
    const lista = h.almacigos.filter(function (a) {
      return verAlmacigos === 'todos' || (a.activo !== 'false' && a.estado === 'En almácigo');
    }).sort(function (a, b) { return b.fechaSiembra.localeCompare(a.fechaSiembra); });
    const editar = puedeEditar();
    return '<label>Mostrar<select onchange="verAlmacigos = this.value; alActualizarDatos()">' +
        '<option value="activos"' + (verAlmacigos === 'activos' ? ' selected' : '') + '>En almácigo</option>' +
        '<option value="todos"' + (verAlmacigos === 'todos' ? ' selected' : '') + '>Todos (también trasplantados y descartados)</option>' +
      '</select></label>' +
      (editar ? '<button class="boton" onclick="formularioAlmacigo()">+ Nuevo almácigo</button>' : '') +
      (lista.length ? lista.map(function (a) {
        const pct = porcentajeGerminacion(a);
        const dias = diasEntre(a.fechaSiembra, hoyTexto());
        const celdas = (Number(a.cantidadCeldas) || 0) * (Number(a.cantidadBandejas) || 1);
        return '<div class="movimiento' + (a.estado === 'En almácigo' ? ' mov-ingresos' : '') + '">' +
          '<div class="movimiento-texto"><strong>' + esc(nombreCultivo(h, a.cultivoId)) + '</strong>' +
            '<span class="ayuda">' + formatearFecha(a.fechaSiembra) + ' · ' + dias + ' días · ' + esc(a.cantidadBandejas || '1') + ' ' + esc((a.tipoBandeja || 'bandeja').toLowerCase()) +
              ' de ' + esc(a.cantidadCeldas || '?') + ' celdas (' + celdas + ') · ' + esc(a.estado) + '</span>' +
            '<span class="ayuda">Germinadas: día 7 ' + (a.germinadasDia7 || '—') + ' · día 10 ' + (a.germinadasDia10 || '—') + ' · día 14 ' + (a.germinadasDia14 || '—') + '</span>' +
            (a.notas ? '<span class="ayuda notas">' + esc(a.notas) + '</span>' : '') +
          '</div>' +
          '<div class="movimiento-valor">' + (pct === null ? '—' : String(pct).replace('.', ',') + '%') + '<br><span class="ayuda">germinación</span></div>' +
          (editar ? '<div class="movimiento-acciones">' +
            (a.estado === 'En almácigo' ? '<button class="boton chico" onclick="trasplantarAlmacigo(\'' + esc(a.id) + '\')">Trasplantar</button>' : '') +
            '<button class="boton chico secundario" onclick="formularioAlmacigo(\'' + esc(a.id) + '\')" aria-label="Editar">✎</button></div>' : '') +
        '</div>';
      }).join('') : '<p class="vacio">No hay almácigos para mostrar.</p>');
  });
}

async function formularioAlmacigo(id) {
  const h = await cargarHuerta();
  const a = id ? h.almacigosPorId[id] : null;
  await abrirFormulario({
    tabla: 'Almacigos',
    titulo: a ? 'Editar almácigo' : 'Nuevo almácigo',
    registro: a,
    valores: { fechaSiembra: hoyTexto(), tipoBandeja: 'Plantinera', cantidadCeldas: '200', cantidadBandejas: '1', estado: 'En almácigo', activo: 'true' },
    campos: [
      { nombre: 'cultivoId', etiqueta: 'Cultivo', tipo: 'select', requerido: true, vacio: 'Elegí…', opciones: h.cultivos.map(function (c) { return { valor: c.id, texto: c.nombre }; }) },
      { nombre: 'fechaSiembra', etiqueta: 'Fecha de siembra', tipo: 'fecha', requerido: true, medio: true },
      { nombre: 'estado', etiqueta: 'Estado', tipo: 'select', opciones: HUERTA.estadosAlmacigo, requerido: true, medio: true },
      { nombre: 'tipoBandeja', etiqueta: 'Tipo de bandeja', tipo: 'texto', medio: true },
      { nombre: 'cantidadBandejas', etiqueta: 'Cantidad de bandejas', tipo: 'entero', minimo: 1, medio: true },
      { nombre: 'cantidadCeldas', etiqueta: 'Celdas por bandeja', tipo: 'entero', minimo: 1, requerido: true },
      { nombre: 'germinadasDia7', etiqueta: 'Germinadas día 7', tipo: 'entero', minimo: 0, seccion: 'Germinación (plantines nuevos en cada conteo)',
        ayuda: 'El % de germinación suma los tres conteos y los divide por el total de celdas' },
      { nombre: 'germinadasDia10', etiqueta: 'Germinadas día 10', tipo: 'entero', minimo: 0, medio: true },
      { nombre: 'germinadasDia14', etiqueta: 'Germinadas día 14', tipo: 'entero', minimo: 0, medio: true },
      { nombre: 'notas', etiqueta: 'Notas', tipo: 'area' }
    ],
    antesDeGuardar: function (datos) { if (!datos.activo) datos.activo = 'true'; },
    preguntaEliminar: '¿Eliminar este almácigo?'
  });
}

/** Abre una siembra nueva con el cultivo del almácigo; al guardarla, el almácigo queda "Trasplantado". */
async function trasplantarAlmacigo(id) {
  const h = await cargarHuerta();
  const a = h.almacigosPorId[id];
  if (!a) return;
  await formularioSiembra(null, { cultivoId: a.cultivoId, almacigoId: a.id, fechaSiembra: hoyTexto() });
}

/* ---------- Cultivos (catálogo con fichas) ---------- */

let buscarCultivo = '';

function pantallaCultivos() {
  marcoHuerta('Cultivos · Huerta', 'huerta', function (h) {
    const texto = buscarCultivo.trim().toLowerCase();
    const lista = h.cultivos.filter(function (c) {
      return !texto || [c.nombre, c.nombreCientifico, c.familia].some(function (v) { return v && v.toLowerCase().indexOf(texto) !== -1; });
    });
    return '<input type="search" class="buscador" placeholder="Buscar cultivo o familia…" value="' + esc(buscarCultivo) + '" ' +
        'oninput="buscarCultivo = this.value; clearTimeout(window._tb); window._tb = setTimeout(alActualizarDatos, 250)">' +
      (puedeEditar() ? '<button class="boton" onclick="formularioCultivo()">+ Nuevo cultivo</button>' : '') +
      '<p class="ayuda">' + lista.length + ' cultivos. Fichas basadas en el Planificador ProHuerta (INTA).</p>' +
      lista.map(function (c) {
        return '<button class="fila-cultivo" onclick="ir(\'huerta/cultivo/' + esc(c.id) + '\')">' +
          '<strong>' + esc(c.nombre) + '</strong>' +
          '<span class="ayuda">' + [c.familia, c.cicloDeVida, c.fechaSiembraOPlantacion].filter(Boolean).map(esc).join(' · ') + '</span>' +
        '</button>';
      }).join('');
  });
}

function htmlResumenCultivo(c) {
  return '<div class="ficha">' +
    dato('Distancia entre plantas', c.distanciaEntrePlantasCm ? c.distanciaEntrePlantasCm + ' cm' : '') +
    dato('Distancia entre líneas', c.distanciaEntreLineasCm ? c.distanciaEntreLineasCm + ' cm' : '') +
    dato('Asociar con', c.asociarCon) + dato('Rotar con', c.rotarCon) +
    dato('Tareas especiales', c.tareasEspeciales) + dato('Período de cosecha', c.periodoPosibleCosecha) +
    dato('Recomendación de cosecha', c.recomendacionCosecha) +
  '</div>';
}

function pantallaFichaCultivo(id) {
  marcoHuerta('Cultivo · Huerta', 'huerta/cultivos', function (h) {
    const c = h.cultivosPorId[id];
    if (!c) return '<p class="vacio">No se encontró el cultivo.</p>';
    const siembras = h.siembras.filter(function (s) { return s.cultivoId === id; });
    const si = function (v) { return v === 'true' ? 'Sí' : v === 'false' ? 'No' : ''; };
    const grupo = function (titulo, contenido) { return contenido ? '<div class="tarjeta-info ficha"><strong>' + titulo + '</strong>' + contenido + '</div>' : ''; };
    return '<h1>' + esc(c.nombre) + '</h1>' +
      '<p class="saludo"><i>' + esc(c.nombreCientifico || '') + '</i></p>' +
      (puedeEditar() ? '<button class="boton chico secundario" onclick="formularioCultivo(\'' + esc(id) + '\')">✎ Editar ficha</button>' : '') +
      grupo('General', dato('Familia', c.familia) + dato('Ciclo de vida', c.cicloDeVida) + dato('Parte utilizada', c.parteUtilizada) +
        dato('Dificultad', c.dificultad) + dato('Tolerancia a heladas', c.toleranciaHeladas) + dato('Espacio que ocupa', c.espacioOcupado) +
        dato('Tolera sombra', si(c.toleraSombra)) + dato('Se puede en maceta', si(c.cultivoEnRecipiente)) + dato('Abono verde', si(c.abonoVerde))) +
      grupo('Siembra', dato('Época de siembra o plantación', c.fechaSiembraOPlantacion) + dato('Ubicación en la huerta', c.ubicacionHuerta) +
        dato('Distancia entre plantas', c.distanciaEntrePlantasCm ? c.distanciaEntrePlantasCm + ' cm' : '') +
        dato('Distancia entre líneas', c.distanciaEntreLineasCm ? c.distanciaEntreLineasCm + ' cm' : '') +
        dato('Semillas por gramo', c.semillasPorGramo) + dato('Semilla por m² (almácigo o surco)', c.semillaPorM2AlmacigoOSurco) +
        dato('Rendimiento en almácigo', c.rendimientoEnAlmacigo) + dato('Escalonamiento recomendado', c.escalonamientoRecomendado)) +
      grupo('Manejo', dato('Asociar con', c.asociarCon) + dato('Rotar con', c.rotarCon) + dato('Tareas especiales', c.tareasEspeciales)) +
      grupo('Cosecha', dato('Días a cosecha', c.diasACosechaTexto) + dato('Período posible de cosecha', c.periodoPosibleCosecha) +
        dato('Rendimiento', c.rendimientoACosechar) + dato('Recomendación', c.recomendacionCosecha)) +
      grupo('Semillas', dato('Años de buen poder germinativo', c.aniosBuenPoderGerminativo) + dato('Tipo de fecundación', c.tipoFecundacion) +
        dato('Cómo cosechar semillas', c.comoCosecharSemillas)) +
      grupo('Riego (coeficientes FAO-56)', dato('Kc inicial / medio / final', [c.kcInicial, c.kcMedio, c.kcFinal].join(' / ')) +
        dato('Días por etapa (inicial, desarrollo, media, final)', [c.diasEtapaInicial, c.diasEtapaDesarrollo, c.diasEtapaMedia, c.diasEtapaFinal].join(' · ')) +
        dato('Profundidad de raíces', c.profundidadRaicesM ? c.profundidadRaicesM + ' m' : '')) +
      grupo('Notas', dato('', c.notas)) +
      '<p class="ayuda">Siembras de este cultivo: ' + siembras.length + '</p>';
  });
}

async function formularioCultivo(id) {
  const h = await cargarHuerta();
  const c = id ? h.cultivosPorId[id] : null;
  const t = function (nombre, etiqueta, medio, seccion) { return { nombre: nombre, etiqueta: etiqueta, tipo: 'texto', medio: medio, seccion: seccion }; };
  await abrirFormulario({
    tabla: 'Cultivos',
    titulo: c ? 'Editar cultivo' : 'Nuevo cultivo',
    registro: c,
    valores: { cicloDeVida: 'Anual', toleranciaHeladas: 'Resistente', espacioOcupado: 'Medio', toleraSombra: 'false', cultivoEnRecipiente: 'false', abonoVerde: 'false',
      kcInicial: '0.5', kcMedio: '1', kcFinal: '0.8', diasEtapaInicial: '20', diasEtapaDesarrollo: '30', diasEtapaMedia: '30', diasEtapaFinal: '15' },
    campos: [
      { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true },
      t('nombreCientifico', 'Nombre científico', true), t('familia', 'Familia', true),
      { nombre: 'cicloDeVida', etiqueta: 'Ciclo de vida', tipo: 'select', opciones: HUERTA.ciclos, medio: true },
      t('parteUtilizada', 'Parte utilizada', true),
      t('dificultad', 'Dificultad', true),
      { nombre: 'toleranciaHeladas', etiqueta: 'Tolerancia a heladas', tipo: 'select', opciones: HUERTA.tolerancias, medio: true },
      { nombre: 'espacioOcupado', etiqueta: 'Espacio que ocupa', tipo: 'select', opciones: HUERTA.espacios, medio: true },
      { nombre: 'toleraSombra', etiqueta: 'Tolera sombra', tipo: 'sino' },
      { nombre: 'cultivoEnRecipiente', etiqueta: 'Se puede cultivar en maceta', tipo: 'sino' },
      { nombre: 'abonoVerde', etiqueta: 'Sirve como abono verde', tipo: 'sino' },
      t('fechaSiembraOPlantacion', 'Época de siembra o plantación', false, 'Siembra'), t('ubicacionHuerta', 'Ubicación en la huerta'),
      t('distanciaEntrePlantasCm', 'Distancia entre plantas (cm)', true), t('distanciaEntreLineasCm', 'Distancia entre líneas (cm)', true),
      t('semillasPorGramo', 'Semillas por gramo', true), t('semillaPorM2AlmacigoOSurco', 'Semilla por m²', true),
      t('rendimientoEnAlmacigo', 'Rendimiento en almácigo', true), t('escalonamientoRecomendado', 'Escalonamiento', true),
      t('asociarCon', 'Asociar con', false, 'Manejo'), t('rotarCon', 'Rotar con'), t('tareasEspeciales', 'Tareas especiales'),
      t('diasACosechaTexto', 'Días a cosecha', true, 'Cosecha'), t('periodoPosibleCosecha', 'Período de cosecha', true),
      t('rendimientoACosechar', 'Rendimiento', true), t('recomendacionCosecha', 'Recomendación', true),
      t('aniosBuenPoderGerminativo', 'Años de poder germinativo', true, 'Semillas'), t('tipoFecundacion', 'Tipo de fecundación', true),
      t('comoCosecharSemillas', 'Cómo cosechar semillas'),
      { nombre: 'kcInicial', etiqueta: 'Kc inicial', tipo: 'numero', minimo: 0, medio: true, seccion: 'Riego (FAO-56)', requerido: true },
      { nombre: 'kcMedio', etiqueta: 'Kc medio', tipo: 'numero', minimo: 0, medio: true, requerido: true },
      { nombre: 'kcFinal', etiqueta: 'Kc final', tipo: 'numero', minimo: 0, medio: true, requerido: true },
      { nombre: 'profundidadRaicesM', etiqueta: 'Profundidad de raíces (m)', tipo: 'numero', minimo: 0, medio: true },
      { nombre: 'diasEtapaInicial', etiqueta: 'Días etapa inicial', tipo: 'entero', minimo: 0, medio: true, requerido: true },
      { nombre: 'diasEtapaDesarrollo', etiqueta: 'Días etapa desarrollo', tipo: 'entero', minimo: 0, medio: true, requerido: true },
      { nombre: 'diasEtapaMedia', etiqueta: 'Días etapa media', tipo: 'entero', minimo: 0, medio: true, requerido: true },
      { nombre: 'diasEtapaFinal', etiqueta: 'Días etapa final', tipo: 'entero', minimo: 0, medio: true, requerido: true },
      { nombre: 'notas', etiqueta: 'Notas', tipo: 'area' }
    ],
    preguntaEliminar: '¿Eliminar este cultivo del catálogo?',
    alEliminar: function (cultivo) {
      const usado = h.siembras.some(function (s) { return s.cultivoId === cultivo.id; }) || h.almacigos.some(function (a) { return a.cultivoId === cultivo.id; });
      return usado ? 'No se puede eliminar: hay siembras o almácigos de este cultivo.' : null;
    },
    despuesDeGuardar: function (guardado, anterior) { if (!anterior) ir('huerta/cultivo/' + guardado.id); }
  });
}

/* ---------- Clima ---------- */

function pantallaClima() {
  marcoHuerta('Clima · Huerta', 'huerta', async function (h) {
    try {
      const ubicacion = await ubicacionClima(null);
      const clima = await obtenerClima(ubicacion);
      const hoy = hoyTexto();
      const dias = clima.dias.filter(function (d) { return d.fecha >= sumarDias(hoy, -7); });
      const lluvia7 = clima.dias.filter(function (d) { return d.fecha < hoy && d.fecha >= sumarDias(hoy, -7); }).reduce(function (t, d) { return t + d.lluvia; }, 0);
      const lluvia30 = clima.dias.filter(function (d) { return d.fecha < hoy; }).reduce(function (t, d) { return t + d.lluvia; }, 0);
      const heladas = clima.dias.filter(function (d) { return d.fecha >= hoy && d.min !== null && d.min <= 2; });
      return (clima.sinConexion ? '<div class="aviso">Sin conexión: último clima guardado (' + formatearFecha(clima.actualizado) + ').</div>' : '') +
        (heladas.length ? '<div class="aviso error">❄ Riesgo de helada: ' + heladas.map(function (d) { return diaMes(d.fecha) + ' (' + d.min.toFixed(1) + '°C)'; }).join(', ') +
          '. Protegé los cultivos sensibles.</div>' : '') +
        '<div class="resumen">' +
          '<div><b>' + lluvia7.toFixed(0) + '</b><span>mm de lluvia (7 días)</span></div>' +
          '<div><b>' + lluvia30.toFixed(0) + '</b><span>mm de lluvia (30 días)</span></div>' +
        '</div>' +
        '<div class="tabla-desplazable"><table class="tabla"><thead><tr><th>Día</th><th>Máx</th><th>Mín</th><th>Lluvia</th><th>ET0</th></tr></thead><tbody>' +
          dias.map(function (d) {
            return '<tr class="' + (d.fecha > hoy ? 'pronostico' : '') + (d.fecha === hoy ? ' hoy' : '') + '">' +
              '<td>' + NOMBRES_DIAS[textoAFecha(d.fecha).getDay()].slice(0, 3) + ' ' + diaMes(d.fecha) + (d.fecha > hoy ? ' *' : '') + '</td>' +
              '<td>' + (d.max === null ? '—' : d.max.toFixed(0) + '°') + '</td><td>' + (d.min === null ? '—' : d.min.toFixed(0) + '°') + '</td>' +
              '<td>' + (d.lluvia ? d.lluvia.toFixed(1) + ' mm' : '—') + '</td><td>' + d.et0.toFixed(1) + '</td></tr>';
          }).join('') +
        '</tbody></table></div>' +
        '<p class="ayuda">* Pronóstico. Datos de Open-Meteo para ' + esc(ubicacion.origen) + ' (' + ubicacion.latitud + ', ' + ubicacion.longitud + '). ' +
          'ET0: agua que pierde el suelo por día (mm). La ubicación se cambia en la hoja Config de la planilla.</p>';
    } catch (e) {
      return '<div class="aviso error">' + esc(e.message) + '</div>';
    }
  });
}
