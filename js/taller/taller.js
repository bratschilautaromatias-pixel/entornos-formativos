/**
 * TALLER RURAL: proyectos y obras (con etapas y materiales), pedidos de los otros entornos (fabricar o reparar),
 * pañol de herramientas con préstamos, y stock de materiales.
 * Direcciones: #/taller · #/taller/proyectos · #/taller/proyecto/<id> · #/taller/pedidos · #/taller/panol
 *              #/taller/materiales · #/taller/material/<id>
 */
const TALLER = {
  tiposProyecto: ['Construcción', 'Carpintería', 'Herrería', 'Instalaciones (agua, luz)', 'Alambrados y cercos', 'Herramientas e implementos', 'Otro'],
  estadosProyecto: ['Planificado', 'En curso', 'Terminado', 'Suspendido'],
  tiposPedido: ['Fabricar', 'Reparar'],
  estadosPedido: ['Pendiente', 'En proceso', 'Hecho', 'Rechazado'],
  prioridades: ['Urgente', 'Normal', 'Cuando se pueda'],
  categoriasHerramienta: ['Manual', 'Eléctrica', 'Medición', 'Soldadura', 'Jardinería', 'Otra'],
  estadosHerramienta: ['Buena', 'Regular', 'Para reparar', 'Fuera de servicio'],
  categoriasMaterial: ['Madera', 'Hierro y chapa', 'Alambre', 'Tornillería y fijaciones', 'Pinturas', 'Eléctrico', 'Plomería y riego', 'Construcción (cemento, arena…)', 'Otro'],
  unidadesMaterial: ['unidad', 'metro', 'kg', 'litro', 'm²', 'm³', 'rollo', 'bolsa', 'caja', 'tabla', 'barra', 'chapa'],
  // Guías de la carpeta "Taller Rural" (para tenerlas de referencia en cada proyecto)
  guias: [
    'Manual de construcción con madera', 'Manual básico de carpintería', 'Capacitación de alambrados',
    'Alambrados eléctricos: instalación y uso (INTA Anguil)', 'Instalaciones rurales: apotreramiento',
    'Invernaderos (INTA Bella Vista)', 'Invernaderos de altura (ProHuerta)', 'Invernáculo para huerta comunitaria (ProHuerta)',
    'Túnel alto: manual de armado (INTA General Pico)', 'Microtúneles (INTA Bariloche)', 'Túneles para cultivo de hortalizas (ProHuerta)',
    'Construcciones rurales hortícolas en Cuyo (INTA)', 'Riego por goteo en la huerta orgánica (ProHuerta)',
    'Plantinera móvil (INTA Esquel)', 'Estaqueros (INTA Santa Cruz)', 'Comedero tolva (INTA)', 'Comedero tolva de machimbre (INTA)',
    'Bebederos pico para aves (INTA)', 'Cama profunda (INTA)', 'Limpieza de instalaciones avícolas (INTA)',
    'Deshidratador solar directo (INTA)', 'Horno de tambor (ProHuerta)', 'Biodigestor demostrativo paso a paso (INTA Pergamino)',
    'Cuchilla desmalezadora manual (INTA)', 'Fabricación casera de herramientas e implementos (ProHuerta)'
  ]
};

/* ---------- Datos y cálculos ---------- */

async function cargarTaller() {
  const nombres = ['ProyectosTaller', 'EtapasProyecto', 'PedidosTaller', 'Herramientas', 'PrestamosHerramienta', 'MaterialesTaller', 'MovimientosMaterial'];
  const [listas, cursos] = await Promise.all([Promise.all(nombres.map(function (t) { return Datos.listar(t); })), Datos.listar('Cursos')]);
  const t = { cursos: {} };
  cursos.forEach(function (c) { t.cursos[c.id] = nombreCurso(c); });
  nombres.forEach(function (n, i) {
    const clave = n.charAt(0).toLowerCase() + n.slice(1);
    t[clave] = listas[i];
    const porId = {};
    listas[i].forEach(function (r) { porId[r.id] = r; });
    t[clave + 'PorId'] = porId;
  });
  t.herramientas.sort(function (a, b) { return String(a.nombre).localeCompare(String(b.nombre), 'es'); });
  t.materialesTaller.sort(function (a, b) { return String(a.nombre).localeCompare(String(b.nombre), 'es'); });
  t.movimientosMaterial.sort(function (a, b) { return b.fecha.localeCompare(a.fecha) || String(b.creadoEn).localeCompare(String(a.creadoEn)); });
  return t;
}

function etapasDe(t, proyectoId) {
  return t.etapasProyecto.filter(function (e) { return e.proyectoId === proyectoId; })
    .sort(function (a, b) { return (Number(a.orden) || 0) - (Number(b.orden) || 0); });
}

/** Avance: terminado = 100; con etapas, el % de etapas hechas; si no, el que se cargó a mano. */
function avanceProyecto(t, p) {
  if (p.estado === 'Terminado') return 100;
  const etapas = etapasDe(t, p.id);
  if (etapas.length) return Math.round(etapas.filter(function (e) { return e.hecha === 'true'; }).length * 100 / etapas.length);
  return Math.max(0, Math.min(100, Number(p.avance) || 0));
}

/** Stock = inicial + entradas − salidas ± conteos. */
function stockMaterial(t, materialId) {
  const m = t.materialesTallerPorId[materialId];
  let stock = m ? Number(m.stockInicial) || 0 : 0;
  t.movimientosMaterial.forEach(function (mv) {
    if (mv.materialId !== materialId) return;
    const c = Number(mv.cantidad) || 0;
    stock += mv.tipo === 'Salida' ? -c : c;
  });
  return Math.round(stock * 1000) / 1000;
}

/** Costo por unidad: promedio de lo pagado en las entradas con costo. */
function costoUnitarioMaterial(t, materialId) {
  let cantidad = 0, costo = 0;
  t.movimientosMaterial.forEach(function (mv) {
    if (mv.materialId === materialId && mv.tipo === 'Entrada' && Number(mv.costo) > 0 && Number(mv.cantidad) > 0) {
      cantidad += Number(mv.cantidad);
      costo += Number(mv.costo);
    }
  });
  return cantidad ? costo / cantidad : null;
}

/** Materiales usados en un proyecto, con su costo estimado. */
function materialesDeProyecto(t, proyectoId) {
  const porMaterial = {};
  t.movimientosMaterial.filter(function (mv) { return mv.proyectoId === proyectoId && mv.tipo === 'Salida'; }).forEach(function (mv) {
    const r = porMaterial[mv.materialId] || (porMaterial[mv.materialId] = { material: t.materialesTallerPorId[mv.materialId], cantidad: 0 });
    r.cantidad += Number(mv.cantidad) || 0;
  });
  return Object.keys(porMaterial).map(function (id) {
    const r = porMaterial[id];
    const unitario = costoUnitarioMaterial(t, id);
    r.costo = unitario === null ? null : unitario * r.cantidad;
    return r;
  });
}

function prestadasDe(t, herramientaId) {
  return t.prestamosHerramienta.filter(function (p) { return p.herramientaId === herramientaId && !p.fechaDevolucion; })
    .reduce(function (s, p) { return s + (Number(p.cantidad) || 1); }, 0);
}

function nombreMaterial(t, id) { const m = t.materialesTallerPorId[id]; return m ? m.nombre : '(material eliminado)'; }
function nombreHerramienta(t, id) { const h = t.herramientasPorId[id]; return h ? h.nombre : '(herramienta eliminada)'; }
function nombreProyecto(t, id) { const p = t.proyectosTallerPorId[id]; return p ? p.nombre : ''; }

function cantidadMaterialTexto(n, m) {
  return numero(n) + ' ' + (m ? unidadTexto(n, m.unidad || 'unidad') : '');
}

function bajoMinimo(t) {
  return t.materialesTaller.filter(function (m) {
    return m.activo !== 'false' && m.stockMinimo !== '' && m.stockMinimo !== undefined && stockMaterial(t, m.id) <= Number(m.stockMinimo);
  });
}

/** Cuadro del inicio: pedidos sin atender. */
async function contarPedidosTaller() {
  const insignia = document.getElementById('insignia-taller');
  if (!insignia) return;
  const pendientes = (await Datos.listar('PedidosTaller')).filter(function (p) { return p.estado === 'Pendiente' || !p.estado; }).length;
  if (pendientes) {
    insignia.textContent = pendientes === 1 ? '1 pedido' : pendientes + ' pedidos';
    insignia.hidden = false;
  }
}

/* ---------- Pantallas ---------- */

PANTALLAS.taller = function (parametro) {
  const partes = String(parametro || '').split('/');
  const pantallas = {
    proyectos: pantallaProyectosTaller, proyecto: pantallaFichaProyecto, pedidos: pantallaPedidosTaller,
    panol: pantallaPanol, materiales: pantallaMaterialesTaller, material: pantallaFichaMaterial
  };
  if (pantallas[partes[0]]) return pantallas[partes[0]](partes[1]);
  pantallaMenuTaller();
};

/** Desde "Producción" del Taller se va a su menú. */
const produccionSinTaller = PANTALLAS.produccion;
PANTALLAS.produccion = function (clave) {
  if (clave === 'taller') return ir('taller');
  return produccionSinTaller(clave);
};

function marcoTaller(titulo, volverA, dibujar) {
  render(htmlBarra(titulo, volverA) + '<main class="contenido" id="contenido-taller"><p class="vacio">Cargando…</p></main>');
  const redibujar = async function () {
    if (!document.getElementById('contenido-taller')) return;
    const t = await cargarTaller();
    const lugar = document.getElementById('contenido-taller');
    if (!lugar) return;
    lugar.innerHTML = await dibujar(t);
  };
  alActualizarDatos = redibujar;
  redibujar();
}

function pantallaMenuTaller() {
  marcoTaller('Taller rural', 'entorno/taller', function (t) {
    const enCurso = t.proyectosTaller.filter(function (p) { return p.estado === 'En curso'; });
    const pendientes = t.pedidosTaller.filter(function (p) { return p.estado === 'Pendiente' || !p.estado; });
    const prestadas = t.prestamosHerramienta.filter(function (p) { return !p.fechaDevolucion; });
    const bajos = bajoMinimo(t);
    const secciones = [
      ['proyectos', '🏗', 'Proyectos y obras', 'Construcciones con etapas, avance, materiales y costo'],
      ['pedidos', '📨', 'Pedidos de los entornos', 'Lo que piden fabricar o reparar'],
      ['panol', '🧰', 'Pañol de herramientas', 'Inventario y préstamos a cursos'],
      ['materiales', '📦', 'Stock de materiales', 'Lo que hay, lo que entra y lo que se usa']
    ];
    let html = '<h1>🔧 TALLER RURAL</h1>' +
      '<div class="resumen">' +
        '<div><b>' + enCurso.length + '</b><span>Proyectos en curso</span></div>' +
        '<div class="' + (pendientes.length ? 'mal' : '') + '"><b>' + pendientes.length + '</b><span>Pedidos pendientes</span></div>' +
        '<div><b>' + prestadas.length + '</b><span>Préstamos sin devolver</span></div>' +
        '<div class="' + (bajos.length ? 'mal' : '') + '"><b>' + bajos.length + '</b><span>Materiales bajo mínimo</span></div>' +
      '</div>';
    if (pendientes.length) {
      html += '<section class="bloque-curso"><h2 class="grupo-titulo">Pedidos para atender</h2>' +
        pendientes.sort(ordenPedidos).slice(0, 5).map(function (p) { return htmlPedidoTaller(t, p, puedeEditar()); }).join('') +
        (pendientes.length > 5 ? '<p class="centrado"><a href="#/taller/pedidos">Ver todos</a></p>' : '') + '</section>';
    }
    if (bajos.length) {
      html += '<p class="aviso-lista">⚠ Materiales en el mínimo o por debajo: ' + esc(unirTexto(bajos.map(function (m) {
        return m.nombre + ' (' + cantidadMaterialTexto(stockMaterial(t, m.id), m) + ')';
      }))) + '. <a href="#/taller/materiales">Ver materiales</a></p>';
    }
    html += '<div class="grilla grilla-secciones">' + secciones.map(function (s) {
      return '<button class="cuadro" onclick="ir(\'taller/' + s[0] + '\')"><span class="icono">' + s[1] + '</span>' +
        '<span class="nombre">' + esc(s[2]) + '</span><span class="detalle">' + esc(s[3]) + '</span></button>';
    }).join('') + '</div>';
    return html;
  });
}

/* ----- Proyectos ----- */

let verProyectosTaller = 'activos';

function pantallaProyectosTaller() {
  marcoTaller('Proyectos y obras', 'taller', function (t) {
    const lista = t.proyectosTaller.filter(function (p) {
      return verProyectosTaller === 'todos' || p.estado === 'Planificado' || p.estado === 'En curso';
    }).sort(function (a, b) {
      return TALLER.estadosProyecto.indexOf(a.estado) - TALLER.estadosProyecto.indexOf(b.estado) || String(b.fechaInicio).localeCompare(String(a.fechaInicio));
    });
    return '<h1>🏗 PROYECTOS Y OBRAS</h1>' +
      '<label>Mostrar<select onchange="verProyectosTaller = this.value; alActualizarDatos()">' +
        '<option value="activos"' + (verProyectosTaller === 'activos' ? ' selected' : '') + '>Planificados y en curso</option>' +
        '<option value="todos"' + (verProyectosTaller === 'todos' ? ' selected' : '') + '>Todos (también terminados y suspendidos)</option></select></label>' +
      (puedeEditar() ? '<button class="boton" onclick="formularioProyecto()">+ Nuevo proyecto</button>' : '') +
      (lista.length ? '<div class="lista-cursos">' + lista.map(function (p) { return htmlTarjetaProyecto(t, p); }).join('') + '</div>'
        : '<p class="vacio">No hay proyectos para mostrar.</p>');
  });
}

function htmlTarjetaProyecto(t, p) {
  const avance = avanceProyecto(t, p);
  return '<button class="tarjeta-curso" onclick="ir(\'taller/proyecto/' + esc(p.id) + '\')">' +
    '<span class="tarjeta-curso-nombre">' + avance + '%</span>' +
    '<span class="tarjeta-curso-datos"><span><b>' + esc(p.nombre) + '</b></span>' +
      '<span class="ayuda">' + [p.estado, p.tipo, p.destino ? 'para ' + p.destino : '', cursoDe(p, t.cursos)].filter(Boolean).map(esc).join(' · ') + '</span>' +
      '<span class="barra-avance"><i style="width:' + avance + '%"></i></span>' +
    '</span></button>';
}

function pantallaFichaProyecto(id) {
  marcoTaller('Proyecto', 'taller/proyectos', function (t) {
    const p = t.proyectosTallerPorId[id];
    if (!p) return '<p class="vacio">No se encontró el proyecto.</p>';
    const editar = puedeEditar();
    const etapas = etapasDe(t, id);
    const avance = avanceProyecto(t, p);
    const materiales = materialesDeProyecto(t, id);
    const costoConocido = materiales.reduce(function (s, m) { return s + (m.costo || 0); }, 0);
    const sinCosto = materiales.filter(function (m) { return m.costo === null; }).length;
    const pedido = t.pedidosTallerPorId[p.pedidoId];

    let html = '<h1>🏗 ' + esc(p.nombre) + '</h1>' +
      '<div class="resumen">' +
        '<div class="ok"><b>' + avance + '%</b><span>Avance</span></div>' +
        '<div><b>' + esc(p.estado || '—') + '</b><span>Estado</span></div>' +
        '<div><b>' + etapas.filter(function (e) { return e.hecha === 'true'; }).length + '/' + etapas.length + '</b><span>Etapas hechas</span></div>' +
        '<div><b>' + pesos(costoConocido) + '</b><span>Materiales' + (sinCosto ? ' (sin precio: ' + sinCosto + ')' : '') + '</span></div>' +
      '</div>' +
      '<div class="barra-avance grande"><i style="width:' + avance + '%"></i></div>' +
      (editar ? '<div class="acciones-curso">' +
        '<button class="boton chico secundario" onclick="formularioProyecto(\'' + esc(id) + '\')">✎ Datos del proyecto</button>' +
        '<button class="boton chico secundario" onclick="formularioMovimientoMaterial(null, null, \'Salida\', \'' + esc(id) + '\')">+ Usar material</button></div>' : '') +
      '<div class="tarjeta-info">' +
        dato('Tipo', p.tipo) + dato('Para', p.destino) + dato('Curso', cursoDe(p, t.cursos)) +
        dato('Inicio', formatearFecha(p.fechaInicio)) + dato('Fin', formatearFecha(p.fechaFin)) + dato('Guía de referencia', p.guia) +
        dato('Pedido de origen', pedido ? pedido.entorno + ': ' + pedido.titulo : '') + dato('Descripción', p.descripcion) + dato('Notas', p.notas) +
      '</div>';

    html += '<section class="bloque-curso"><div class="lista-necesidades-cabecera"><h2 class="grupo-titulo">Etapas <span class="contador">' + etapas.length + '</span></h2>' +
      (editar ? '<div class="acciones"><button class="boton chico secundario" onclick="agregarEtapas(\'' + esc(id) + '\')">+ Etapas</button></div>' : '') + '</div>' +
      (etapas.length ? etapas.map(function (e) {
        return '<div class="fila-etapa' + (e.hecha === 'true' ? ' hecha' : '') + '">' +
          '<label class="casilla"><input type="checkbox"' + (e.hecha === 'true' ? ' checked' : '') + (editar ? ' onchange="marcarEtapa(\'' + esc(e.id) + '\', this.checked)"' : ' disabled') + '> ' +
            esc(e.nombre) + (e.hecha === 'true' && e.fecha ? ' <span class="ayuda">(' + formatearFecha(e.fecha) + ')</span>' : '') + '</label>' +
          (editar ? '<button class="boton chico secundario" onclick="quitarEtapa(\'' + esc(e.id) + '\')" aria-label="Quitar etapa">✕</button>' : '') +
        '</div>';
      }).join('') : '<p class="ayuda">Sin etapas. Cargalas (una por renglón) para que el avance se calcule solo. Ej: "Planos y lista de materiales", "Corte", "Armado", "Pintura", "Instalación".</p>') +
      '</section>';

    html += '<section class="bloque-curso"><h2 class="grupo-titulo">Materiales usados <span class="contador">' + materiales.length + '</span></h2>' +
      (materiales.length ? htmlTablaInforme('', ['Material', 'Cantidad', 'Costo estimado'], materiales.map(function (m) {
        return [m.material ? m.material.nombre : '(eliminado)', cantidadMaterialTexto(m.cantidad, m.material), m.costo === null ? 'sin precio' : pesos(m.costo)];
      }), 'El costo se estima con el precio promedio de las compras de cada material.')
        : '<p class="ayuda">Todavía no se usó material del stock en este proyecto.</p>') + '</section>';
    return html;
  });
}

async function marcarEtapa(id, hecha) {
  await Datos.guardar('EtapasProyecto', { id: id, hecha: hecha ? 'true' : 'false', fecha: hecha ? hoyTexto() : '' });
}

async function quitarEtapa(id) {
  if (!confirm('¿Quitar esta etapa?')) return;
  await Datos.eliminar('EtapasProyecto', id);
}

function agregarEtapas(proyectoId) {
  if (!puedeEditar()) return;
  abrirModal(
    '<form id="form-etapas" novalidate><h2>Agregar etapas</h2>' +
      '<p class="ayuda">Una por renglón, en el orden en que se hacen.</p>' +
      '<label>Etapas<textarea name="etapas" rows="8" placeholder="Planos y lista de materiales&#10;Corte de piezas&#10;Armado&#10;Pintura&#10;Instalación"></textarea></label>' +
      '<p class="mensaje" id="mensaje-etapas"></p>' +
      '<div class="modal-botones"><span class="espacio"></span>' +
        '<button type="button" class="boton chico secundario" onclick="cerrarModal()">Cancelar</button>' +
        '<button type="submit" class="boton chico">Agregar</button></div>' +
    '</form>'
  );
  document.getElementById('form-etapas').addEventListener('submit', async function (evento) {
    evento.preventDefault();
    const nombres = evento.target.etapas.value.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean);
    if (!nombres.length) return mostrarMensaje('mensaje-etapas', 'Escribí al menos una etapa.', 'error');
    const existentes = (await Datos.listar('EtapasProyecto')).filter(function (e) { return e.proyectoId === proyectoId; });
    let orden = existentes.reduce(function (m, e) { return Math.max(m, Number(e.orden) || 0); }, 0);
    for (const nombre of nombres) {
      orden++;
      await Datos.guardar('EtapasProyecto', { proyectoId: proyectoId, nombre: nombre, orden: String(orden), hecha: 'false', fecha: '' });
    }
    cerrarModal();
  });
}

async function formularioProyecto(id, valoresIniciales) {
  const [p, t, campoCurso] = await Promise.all([id ? Datos.obtener('ProyectosTaller', id) : null, cargarTaller(), campoCursoSugerido('Curso que lo hace')]);
  await abrirFormulario({
    tabla: 'ProyectosTaller',
    titulo: p ? 'Datos del proyecto' : 'Nuevo proyecto',
    registro: p ? Object.assign({}, p, { curso: cursoDe(p, t.cursos) }) : null,
    valores: Object.assign({ estado: 'Planificado', fechaInicio: hoyTexto(), tipo: 'Construcción' }, valoresIniciales || {}),
    campos: [
      { nombre: 'nombre', etiqueta: 'Proyecto', tipo: 'texto', requerido: true, ayuda: 'Ej: "Comedero tolva para Forrajes", "Mesa de almácigos"' },
      { nombre: 'tipo', etiqueta: 'Tipo', tipo: 'select', opciones: TALLER.tiposProyecto, medio: true },
      { nombre: 'estado', etiqueta: 'Estado', tipo: 'select', opciones: TALLER.estadosProyecto, medio: true },
      { nombre: 'destino', etiqueta: 'Para qué entorno', tipo: 'texto', medio: true, ayuda: 'Cualquier entorno o sector de la escuela' },
      campoCurso,
      { nombre: 'fechaInicio', etiqueta: 'Inicio', tipo: 'fecha', medio: true },
      { nombre: 'fechaFin', etiqueta: 'Fin', tipo: 'fecha', medio: true },
      { nombre: 'guia', etiqueta: 'Guía de referencia', tipo: 'select', vacio: 'Ninguna', opciones: TALLER.guias },
      { nombre: 'avance', etiqueta: 'Avance % (solo si no tiene etapas)', tipo: 'entero', minimo: 0 },
      { nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'area', ayuda: 'Medidas, diseño, para qué se usa…' },
      { nombre: 'notas', etiqueta: 'Notas', tipo: 'area' }
    ],
    validar: function (d) {
      if (Number(d.avance) > 100) return 'El avance no puede ser más de 100%.';
      if (d.fechaFin && d.fechaInicio && d.fechaFin < d.fechaInicio) return 'La fecha de fin no puede ser anterior al inicio.';
    },
    antesDeGuardar: function (d) {
      if (valoresIniciales && valoresIniciales.pedidoId && !p) d.pedidoId = valoresIniciales.pedidoId;
      if (d.estado === 'Terminado' && !d.fechaFin) d.fechaFin = hoyTexto();
      d.cursoId = ''; // el curso queda escrito en "curso"
    },
    despuesDeGuardar: async function (guardado, anterior) {
      // Si viene de un pedido: el pedido acompaña el estado del proyecto
      const pedidoId = guardado.pedidoId || (anterior && anterior.pedidoId);
      if (pedidoId) {
        const estadoPedido = guardado.estado === 'Terminado' ? 'Hecho' : 'En proceso';
        await Datos.guardar('PedidosTaller', { id: pedidoId, estado: estadoPedido, proyectoId: guardado.id, fechaHecho: estadoPedido === 'Hecho' ? (guardado.fechaFin || hoyTexto()) : '' });
      }
      if (!anterior) ir('taller/proyecto/' + guardado.id);
    },
    alEliminar: async function (registro) {
      const usos = (await Datos.listar('MovimientosMaterial')).some(function (m) { return m.proyectoId === registro.id; });
      if (usos) return 'Tiene materiales usados. Si no se va a hacer, ponelo en estado "Suspendido".';
    },
    eliminar: async function (registro) {
      for (const e of (await Datos.listar('EtapasProyecto')).filter(function (x) { return x.proyectoId === registro.id; })) await Datos.eliminar('EtapasProyecto', e.id);
      await Datos.eliminar('ProyectosTaller', registro.id);
      ir('taller/proyectos');
    },
    preguntaEliminar: '¿Eliminar este proyecto y sus etapas?'
  });
}

/* ----- Pedidos de los entornos ----- */

let verPedidosTaller = 'abiertos';

function ordenPedidos(a, b) {
  return TALLER.prioridades.indexOf(a.prioridad) - TALLER.prioridades.indexOf(b.prioridad) || String(a.creadoEn).localeCompare(String(b.creadoEn));
}

function pantallaPedidosTaller() {
  marcoTaller('Pedidos al taller', 'taller', function (t) {
    const lista = t.pedidosTaller.filter(function (p) {
      return verPedidosTaller === 'todos' || p.estado === 'Pendiente' || p.estado === 'En proceso' || !p.estado;
    }).sort(function (a, b) {
      return TALLER.estadosPedido.indexOf(a.estado || 'Pendiente') - TALLER.estadosPedido.indexOf(b.estado || 'Pendiente') || ordenPedidos(a, b);
    });
    return '<h1>📨 PEDIDOS DE LOS ENTORNOS</h1>' +
      '<p class="saludo">Lo que los otros entornos le piden al taller: fabricar o reparar</p>' +
      '<label>Mostrar<select onchange="verPedidosTaller = this.value; alActualizarDatos()">' +
        '<option value="abiertos"' + (verPedidosTaller === 'abiertos' ? ' selected' : '') + '>Pendientes y en proceso</option>' +
        '<option value="todos"' + (verPedidosTaller === 'todos' ? ' selected' : '') + '>Todos (también hechos y rechazados)</option></select></label>' +
      (puedeEditar() ? '<button class="boton" onclick="formularioPedidoTaller()">+ Nuevo pedido</button>' : '') +
      (lista.length ? lista.map(function (p) { return htmlPedidoTaller(t, p, puedeEditar()); }).join('') : '<p class="vacio">No hay pedidos para mostrar.</p>');
  });
}

function htmlPedidoTaller(t, p, editar) {
  const estado = p.estado || 'Pendiente';
  const abierto = estado === 'Pendiente' || estado === 'En proceso';
  return '<div class="necesidad' + (p.prioridad === 'Urgente' && abierto ? ' urgente' : '') + (estado === 'Hecho' ? ' comprada' : '') + '">' +
    '<div class="necesidad-texto"><strong>' + (p.tipo === 'Reparar' ? '🔨 Reparar: ' : '🛠 Fabricar: ') + esc(p.titulo) + '</strong>' +
      '<span class="ayuda">' + [ICONOS_ENTORNO[p.entorno] ? ICONOS_ENTORNO[p.entorno] + ' ' + p.entorno : p.entorno, p.solicitante, estado,
        abierto ? p.prioridad : '', 'pedido el ' + formatearFecha(fechaLocal(p.creadoEn))].filter(Boolean).map(esc).join(' · ') + '</span>' +
      (p.descripcion ? '<span class="ayuda">' + esc(p.descripcion) + '</span>' : '') +
      (p.proyectoId && t.proyectosTallerPorId[p.proyectoId] ? '<span class="ayuda">🏗 Proyecto: <a href="#/taller/proyecto/' + esc(p.proyectoId) + '">' + esc(nombreProyecto(t, p.proyectoId)) + '</a></span>' : '') +
      (estado === 'Hecho' && p.fechaHecho ? '<span class="ayuda">✓ Hecho el ' + formatearFecha(p.fechaHecho) + '</span>' : '') +
    '</div>' +
    (editar ? '<div class="movimiento-acciones">' +
      (abierto ? '<button class="boton chico" onclick="pedidoHecho(\'' + esc(p.id) + '\')">✓ Hecho</button>' : '') +
      (abierto && !p.proyectoId ? '<button class="boton chico secundario" onclick="pedidoAProyecto(\'' + esc(p.id) + '\')">🏗 Hacer proyecto</button>' : '') +
      '<button class="boton chico secundario" onclick="formularioPedidoTaller(\'' + esc(p.id) + '\')" aria-label="Editar">✎</button></div>' : '') +
  '</div>';
}

/** entornoPedido: para abrirlo desde un entorno (Huerta, Forrajes…) con ese entorno ya elegido. */
async function formularioPedidoTaller(id, entornoPedido) {
  const p = id ? await Datos.obtener('PedidosTaller', id) : null;
  await abrirFormulario({
    tabla: 'PedidosTaller',
    titulo: p ? 'Pedido al taller' : 'Nuevo pedido al taller',
    registro: p,
    valores: { entorno: entornoPedido || '', tipo: 'Reparar', prioridad: 'Normal', estado: 'Pendiente' },
    campos: [
      { nombre: 'entorno', etiqueta: 'Entorno que lo pide', tipo: 'texto', requerido: true, medio: true,
        ayuda: 'Cualquier entorno o sector de la escuela (ej. Vivero, Apicultura, Cocina, Dirección)' },
      { nombre: 'tipo', etiqueta: 'Qué hay que hacer', tipo: 'select', opciones: TALLER.tiposPedido, medio: true },
      { nombre: 'titulo', etiqueta: 'Pedido', tipo: 'texto', requerido: true, ayuda: 'Ej: "Arreglar la puerta del galpón", "Comedero para el lote 3"' },
      { nombre: 'descripcion', etiqueta: 'Detalle', tipo: 'area', ayuda: 'Medidas, dónde está, para cuándo se necesita…' },
      { nombre: 'prioridad', etiqueta: 'Prioridad', tipo: 'select', opciones: TALLER.prioridades, medio: true },
      { nombre: 'solicitante', etiqueta: 'Quién lo pide', tipo: 'texto', medio: true }
    ].concat(p ? [
      { nombre: 'estado', etiqueta: 'Estado', tipo: 'select', opciones: TALLER.estadosPedido, medio: true, seccion: 'Seguimiento' },
      { nombre: 'fechaHecho', etiqueta: 'Fecha en que se hizo', tipo: 'fecha', medio: true },
      { nombre: 'notas', etiqueta: 'Notas del taller', tipo: 'area' }
    ] : []),
    antesDeGuardar: function (d) {
      if (!p) d.estado = 'Pendiente';
      if (d.estado === 'Hecho' && !d.fechaHecho) d.fechaHecho = hoyTexto();
    },
    preguntaEliminar: '¿Eliminar este pedido?'
  });
}

async function pedidoHecho(id) {
  const p = await Datos.obtener('PedidosTaller', id);
  if (!p) return;
  await abrirFormulario({
    tabla: 'PedidosTaller',
    titulo: '✓ Hecho: ' + p.titulo,
    registro: Object.assign({}, p, { fechaHecho: hoyTexto() }),
    alEliminar: false,
    campos: [
      { nombre: 'fechaHecho', etiqueta: 'Fecha', tipo: 'fecha', requerido: true },
      { nombre: 'notas', etiqueta: 'Qué se hizo / notas', tipo: 'area' }
    ],
    guardar: function (d) { return Datos.guardar('PedidosTaller', { id: id, estado: 'Hecho', fechaHecho: d.fechaHecho, notas: d.notas }); }
  });
}

/** Un pedido grande se convierte en proyecto (con etapas y materiales). */
async function pedidoAProyecto(id) {
  const p = await Datos.obtener('PedidosTaller', id);
  if (!p) return;
  await formularioProyecto(null, {
    nombre: p.titulo, destino: p.entorno, pedidoId: p.id, estado: 'En curso',
    tipo: p.tipo === 'Reparar' ? 'Construcción' : 'Carpintería', descripcion: p.descripcion || ''
  });
}

/* ----- Pañol de herramientas ----- */

function pantallaPanol() {
  marcoTaller('Pañol de herramientas', 'taller', function (t) {
    const editar = puedeEditar();
    const prestamos = t.prestamosHerramienta.filter(function (p) { return !p.fechaDevolucion; })
      .sort(function (a, b) { return a.fechaSalida.localeCompare(b.fechaSalida); });
    const activas = t.herramientas.filter(function (h) { return h.activa !== 'false'; });
    const paraReparar = activas.filter(function (h) { return h.estado === 'Para reparar' || h.estado === 'Fuera de servicio'; });
    let html = '<h1>🧰 PAÑOL DE HERRAMIENTAS</h1>' +
      '<div class="resumen">' +
        '<div><b>' + activas.reduce(function (s, h) { return s + (Number(h.cantidad) || 1); }, 0) + '</b><span>Herramientas</span></div>' +
        '<div><b>' + prestamos.reduce(function (s, p) { return s + (Number(p.cantidad) || 1); }, 0) + '</b><span>Prestadas</span></div>' +
        '<div class="' + (paraReparar.length ? 'mal' : '') + '"><b>' + paraReparar.length + '</b><span>Para reparar</span></div>' +
      '</div>' +
      (editar ? '<div class="acciones-curso"><button class="boton chico" onclick="formularioPrestamo()">+ Prestar</button>' +
        '<button class="boton chico secundario" onclick="formularioHerramienta()">+ Herramienta</button>' +
        '<button class="boton chico secundario" onclick="formularioVariasHerramientas()">+ Varias</button></div>' : '');
    html += '<section class="bloque-curso"><h2 class="grupo-titulo">Prestadas ahora <span class="contador">' + prestamos.length + '</span></h2>' +
      (prestamos.length ? prestamos.map(function (p) {
        const dias = diasEntre(p.fechaSalida, hoyTexto());
        return '<div class="movimiento' + (dias > 7 ? ' mov-egresos' : '') + '">' +
          '<div class="movimiento-texto"><strong>' + esc(nombreHerramienta(t, p.herramientaId)) + (Number(p.cantidad) > 1 ? ' × ' + esc(p.cantidad) : '') + '</strong>' +
            '<span class="ayuda">' + [p.persona, cursoDe(p, t.cursos), p.destino ? 'en ' + p.destino : ''].filter(Boolean).map(esc).join(' · ') + '</span>' +
            '<span class="ayuda">Salió el ' + formatearFecha(p.fechaSalida) + ' · hace ' + cantidadDias(dias) + '</span></div>' +
          (editar ? '<div class="movimiento-acciones"><button class="boton chico" onclick="devolverPrestamo(\'' + esc(p.id) + '\')">↩ Devuelta</button></div>' : '') +
        '</div>';
      }).join('') : '<p class="ayuda">No hay herramientas prestadas.</p>') + '</section>';
    html += '<section class="bloque-curso"><h2 class="grupo-titulo">Inventario <span class="contador">' + t.herramientas.length + '</span></h2>' +
      (t.herramientas.length ? TALLER.categoriasHerramienta.map(function (cat) {
        const deCat = t.herramientas.filter(function (h) { return (h.categoria || 'Otra') === cat; });
        if (!deCat.length) return '';
        return '<h3 class="subtitulo-categoria">' + esc(cat) + '</h3>' + deCat.map(function (h) {
          const prestadas = prestadasDe(t, h.id);
          const total = Number(h.cantidad) || 1;
          return '<div class="movimiento' + (h.activa === 'false' ? ' baja' : '') + (h.estado === 'Para reparar' || h.estado === 'Fuera de servicio' ? ' mov-egresos' : '') + '">' +
            '<div class="movimiento-texto"><strong>' + esc(h.nombre) + '</strong>' +
              '<span class="ayuda">' + [h.marca, h.estado, h.ubicacion, h.activa === 'false' ? 'dada de baja' : ''].filter(Boolean).map(esc).join(' · ') + '</span></div>' +
            '<div class="movimiento-valor">' + (total - prestadas) + ' de ' + total + '<br><span class="ayuda">disponibles</span></div>' +
            (editar ? '<div class="movimiento-acciones">' +
              (h.activa !== 'false' && total - prestadas > 0 ? '<button class="boton chico secundario" onclick="formularioPrestamo(\'' + esc(h.id) + '\')">Prestar</button>' : '') +
              '<button class="boton chico secundario" onclick="formularioHerramienta(\'' + esc(h.id) + '\')" aria-label="Editar">✎</button></div>' : '') +
          '</div>';
        }).join('');
      }).join('') : '<p class="vacio">Todavía no hay herramientas cargadas. Usá "+ Varias" para cargar la lista de una vez.</p>') + '</section>';
    return html;
  });
}

async function formularioHerramienta(id) {
  const h = id ? await Datos.obtener('Herramientas', id) : null;
  await abrirFormulario({
    tabla: 'Herramientas',
    titulo: h ? 'Herramienta' : 'Nueva herramienta',
    registro: h,
    valores: { categoria: 'Manual', cantidad: '1', estado: 'Buena', activa: 'true' },
    campos: [
      { nombre: 'nombre', etiqueta: 'Herramienta', tipo: 'texto', requerido: true },
      { nombre: 'categoria', etiqueta: 'Tipo', tipo: 'select', opciones: TALLER.categoriasHerramienta, medio: true },
      { nombre: 'cantidad', etiqueta: 'Cantidad', tipo: 'entero', minimo: 1, requerido: true, medio: true },
      { nombre: 'marca', etiqueta: 'Marca / modelo', tipo: 'texto', medio: true },
      { nombre: 'estado', etiqueta: 'Estado', tipo: 'select', opciones: TALLER.estadosHerramienta, medio: true },
      { nombre: 'ubicacion', etiqueta: 'Dónde se guarda', tipo: 'texto' },
      { nombre: 'activa', etiqueta: 'En el inventario (destildá si se perdió o se dio de baja)', tipo: 'sino' },
      { nombre: 'notas', etiqueta: 'Notas', tipo: 'area' }
    ],
    alEliminar: async function (registro) {
      if ((await Datos.listar('PrestamosHerramienta')).some(function (p) { return p.herramientaId === registro.id; })) {
        return 'Tiene préstamos registrados. Si ya no está, destildá "En el inventario".';
      }
    },
    preguntaEliminar: '¿Eliminar esta herramienta?'
  });
}

/** Lista de herramientas de una vez: una por renglón, "Martillo" o "Martillo x 3". */
function formularioVariasHerramientas() {
  if (!puedeEditar()) return;
  abrirModal(
    '<form id="form-varias-herramientas" novalidate><h2>Cargar varias herramientas</h2>' +
      '<p class="ayuda">Una por renglón. Para indicar la cantidad, agregá "x" y el número: <b>Pala de punta x 4</b>.</p>' +
      '<label>Tipo<select name="categoria">' + opcionesSelect(TALLER.categoriasHerramienta, 'Manual') + '</select></label>' +
      '<label>Herramientas<textarea name="lista" rows="10"></textarea></label>' +
      '<p class="mensaje" id="mensaje-varias-herramientas"></p>' +
      '<div class="modal-botones"><span class="espacio"></span>' +
        '<button type="button" class="boton chico secundario" onclick="cerrarModal()">Cancelar</button>' +
        '<button type="submit" class="boton chico">Cargar</button></div>' +
    '</form>'
  );
  document.getElementById('form-varias-herramientas').addEventListener('submit', async function (evento) {
    evento.preventDefault();
    const f = evento.target;
    const filas = f.lista.value.split(/\r?\n/).map(function (l) { return l.trim(); }).filter(Boolean);
    if (!filas.length) return mostrarMensaje('mensaje-varias-herramientas', 'Escribí al menos una herramienta.', 'error');
    for (const linea of filas) {
      const m = linea.match(/^(.*?)\s*[x×]\s*(\d+)$/i);
      await Datos.guardar('Herramientas', { nombre: m ? m[1].trim() : linea, cantidad: m ? m[2] : '1', categoria: f.categoria.value, estado: 'Buena', activa: 'true' });
    }
    cerrarModal();
  });
}

async function formularioPrestamo(herramientaId) {
  const [t, entornos, campoCurso] = await Promise.all([cargarTaller(), Datos.lista('Entorno'), campoCursoSugerido()]);
  const disponibles = t.herramientas.filter(function (h) {
    return h.activa !== 'false' && (Number(h.cantidad) || 1) - prestadasDe(t, h.id) > 0;
  });
  if (!disponibles.length) return alert('No hay herramientas disponibles para prestar.');
  await abrirFormulario({
    tabla: 'PrestamosHerramienta',
    titulo: 'Prestar herramienta',
    valores: { herramientaId: herramientaId || '', cantidad: '1', fechaSalida: hoyTexto() },
    campos: [
      { nombre: 'herramientaId', etiqueta: 'Herramienta', tipo: 'select', requerido: true, vacio: 'Elegí…',
        opciones: disponibles.map(function (h) { return { valor: h.id, texto: h.nombre + ' (' + ((Number(h.cantidad) || 1) - prestadasDe(t, h.id)) + ' disponibles)' }; }) },
      { nombre: 'cantidad', etiqueta: 'Cantidad', tipo: 'entero', minimo: 1, requerido: true, medio: true },
      { nombre: 'fechaSalida', etiqueta: 'Fecha', tipo: 'fecha', requerido: true, medio: true },
      { nombre: 'persona', etiqueta: 'Quién la lleva', tipo: 'texto', requerido: true },
      campoCurso,
      { nombre: 'destino', etiqueta: 'Para qué entorno', tipo: 'select', vacio: '—', opciones: entornos, medio: true },
      { nombre: 'notas', etiqueta: 'Notas', tipo: 'area' }
    ],
    validar: function (d) {
      const h = t.herramientasPorId[d.herramientaId];
      const libres = h ? (Number(h.cantidad) || 1) - prestadasDe(t, h.id) : 0;
      if (Number(d.cantidad) > libres) return 'Solo hay ' + libres + ' disponible' + (libres === 1 ? '' : 's') + '.';
    }
  });
}

async function devolverPrestamo(id) {
  const p = await Datos.obtener('PrestamosHerramienta', id);
  if (!p) return;
  await abrirFormulario({
    tabla: 'PrestamosHerramienta',
    titulo: '↩ Devolución',
    registro: Object.assign({}, p, { fechaDevolucion: hoyTexto(), estadoDevolucion: 'Buena' }),
    alEliminar: false,
    campos: [
      { nombre: 'fechaDevolucion', etiqueta: 'Fecha', tipo: 'fecha', requerido: true, medio: true },
      { nombre: 'estadoDevolucion', etiqueta: 'Cómo volvió', tipo: 'select', opciones: ['Buena', 'Con daño', 'Incompleta'], medio: true },
      { nombre: 'notas', etiqueta: 'Notas', tipo: 'area' }
    ],
    guardar: async function (d) {
      if (d.estadoDevolucion !== 'Buena') await Datos.guardar('Herramientas', { id: p.herramientaId, estado: 'Para reparar' });
      return Datos.guardar('PrestamosHerramienta', { id: id, fechaDevolucion: d.fechaDevolucion, estadoDevolucion: d.estadoDevolucion, notas: d.notas });
    }
  });
}

/* ----- Stock de materiales ----- */

function pantallaMaterialesTaller() {
  marcoTaller('Stock de materiales', 'taller', function (t) {
    const editar = puedeEditar();
    const activos = t.materialesTaller.filter(function (m) { return m.activo !== 'false'; });
    const bajos = bajoMinimo(t);
    let html = '<h1>📦 STOCK DE MATERIALES</h1>' +
      '<div class="resumen">' +
        '<div><b>' + activos.length + '</b><span>Materiales</span></div>' +
        '<div class="' + (bajos.length ? 'mal' : '') + '"><b>' + bajos.length + '</b><span>En el mínimo</span></div>' +
      '</div>' +
      (editar ? '<div class="acciones-curso">' +
        '<button class="boton chico" onclick="formularioMovimientoMaterial(null, null, \'Entrada\')">+ Entrada (compra)</button>' +
        '<button class="boton chico secundario" onclick="formularioMovimientoMaterial(null, null, \'Salida\')">− Uso</button>' +
        '<button class="boton chico secundario" onclick="formularioMaterial()">+ Material</button></div>' : '');
    if (bajos.length && editar) {
      html += '<p class="aviso-lista">⚠ En el mínimo: ' + esc(unirTexto(bajos.map(function (m) { return m.nombre; }))) +
        '. <a href="javascript:void(0)" onclick="pedirMaterialesBajos()">Agregarlos a Necesidades</a></p>';
    }
    html += t.materialesTaller.length ? TALLER.categoriasMaterial.map(function (cat) {
      const deCat = t.materialesTaller.filter(function (m) { return (m.categoria || 'Otro') === cat; });
      if (!deCat.length) return '';
      return '<h3 class="subtitulo-categoria">' + esc(cat) + '</h3>' + deCat.map(function (m) {
        const stock = stockMaterial(t, m.id);
        const bajo = bajos.indexOf(m) !== -1;
        return '<button class="fila-clase' + (bajo ? ' bajo-minimo' : '') + (m.activo === 'false' ? ' baja' : '') + '" onclick="ir(\'taller/material/' + esc(m.id) + '\')">' +
          '<strong>' + esc(m.nombre) + ' · ' + esc(cantidadMaterialTexto(stock, m)) + (bajo ? ' ⚠' : '') + '</strong>' +
          '<span class="ayuda">' + [m.stockMinimo !== '' && m.stockMinimo !== undefined ? 'mínimo ' + cantidadMaterialTexto(m.stockMinimo, m) : '', m.ubicacion].filter(Boolean).map(esc).join(' · ') + '</span></button>';
      }).join('');
    }).join('') : '<p class="vacio">Todavía no hay materiales cargados.</p>';
    return html;
  });
}

function pantallaFichaMaterial(id) {
  marcoTaller('Material', 'taller/materiales', function (t) {
    const m = t.materialesTallerPorId[id];
    if (!m) return '<p class="vacio">No se encontró el material.</p>';
    const editar = puedeEditar();
    const movimientos = t.movimientosMaterial.filter(function (mv) { return mv.materialId === id; });
    const unitario = costoUnitarioMaterial(t, id);
    return '<h1>📦 ' + esc(m.nombre) + '</h1>' +
      '<div class="resumen">' +
        '<div class="ok"><b>' + esc(cantidadMaterialTexto(stockMaterial(t, id), m)) + '</b><span>En stock</span></div>' +
        '<div><b>' + (m.stockMinimo !== '' && m.stockMinimo !== undefined ? esc(cantidadMaterialTexto(m.stockMinimo, m)) : '—') + '</b><span>Mínimo</span></div>' +
        '<div><b>' + (unitario === null ? '—' : pesos(unitario)) + '</b><span>Precio promedio por ' + esc(m.unidad || 'unidad') + '</span></div>' +
      '</div>' +
      (editar ? '<div class="acciones-curso">' +
        '<button class="boton chico" onclick="formularioMovimientoMaterial(\'' + esc(id) + '\', null, \'Entrada\')">+ Entrada</button>' +
        '<button class="boton chico secundario" onclick="formularioMovimientoMaterial(\'' + esc(id) + '\', null, \'Salida\')">− Uso</button>' +
        '<button class="boton chico secundario" onclick="formularioMovimientoMaterial(\'' + esc(id) + '\', null, \'Conteo\')">Contar stock</button>' +
        '<button class="boton chico secundario" onclick="formularioMaterial(\'' + esc(id) + '\')">✎ Datos</button></div>' : '') +
      '<div class="tarjeta-info">' + dato('Tipo', m.categoria) + dato('Unidad', m.unidad) + dato('Stock al empezar', cantidadMaterialTexto(m.stockInicial || 0, m)) +
        dato('Dónde se guarda', m.ubicacion) + dato('Notas', m.notas) + '</div>' +
      '<section class="bloque-curso"><h2 class="grupo-titulo">Movimientos <span class="contador">' + movimientos.length + '</span></h2>' +
      (movimientos.length ? movimientos.map(function (mv) {
        const signo = mv.tipo === 'Salida' ? '−' : (mv.tipo === 'Conteo' && Number(mv.cantidad) < 0 ? '' : '+');
        return '<div class="movimiento ' + (mv.tipo === 'Salida' ? 'mov-egresos' : 'mov-ingresos') + '">' +
          '<div class="movimiento-texto"><strong>' + esc(mv.tipo) + (mv.proyectoId ? ' · ' + esc(nombreProyecto(t, mv.proyectoId)) : '') + '</strong>' +
            '<span class="ayuda">' + [formatearFecha(mv.fecha), mv.proveedor, Number(mv.costo) ? pesos(mv.costo) : '', mv.egresoId ? 'en Economía' : ''].filter(Boolean).map(esc).join(' · ') + '</span>' +
            (mv.notas ? '<span class="ayuda notas">' + esc(mv.notas) + '</span>' : '') + '</div>' +
          '<div class="movimiento-valor">' + signo + esc(cantidadMaterialTexto(Math.abs(Number(mv.cantidad) || 0), m)) + '</div>' +
          (editar ? '<div class="movimiento-acciones"><button class="boton chico secundario" onclick="formularioMovimientoMaterial(\'' + esc(id) + '\', \'' + esc(mv.id) + '\')" aria-label="Editar">✎</button></div>' : '') +
        '</div>';
      }).join('') : '<p class="ayuda">Sin movimientos.</p>') + '</section>';
  });
}

async function formularioMaterial(id) {
  const m = id ? await Datos.obtener('MaterialesTaller', id) : null;
  await abrirFormulario({
    tabla: 'MaterialesTaller',
    titulo: m ? 'Material' : 'Nuevo material',
    registro: m,
    valores: { categoria: 'Madera', unidad: 'unidad', stockInicial: '0', activo: 'true' },
    campos: [
      { nombre: 'nombre', etiqueta: 'Material', tipo: 'texto', requerido: true, ayuda: 'Ej: "Tabla de pino 1×6 de 3 m", "Alambre galvanizado 17/15"' },
      { nombre: 'categoria', etiqueta: 'Tipo', tipo: 'select', opciones: TALLER.categoriasMaterial, medio: true },
      { nombre: 'unidad', etiqueta: 'Unidad', tipo: 'select', opciones: TALLER.unidadesMaterial, medio: true },
      { nombre: 'stockInicial', etiqueta: 'Cantidad que hay hoy', tipo: 'numero', minimo: 0, medio: true,
        ayuda: m ? 'Stock al empezar a usar la app (para corregir el stock usá "Contar stock")' : 'Lo que hay ahora en el taller' },
      { nombre: 'stockMinimo', etiqueta: 'Avisar cuando quede', tipo: 'numero', minimo: 0, medio: true, ayuda: 'Opcional' },
      { nombre: 'ubicacion', etiqueta: 'Dónde se guarda', tipo: 'texto' },
      { nombre: 'activo', etiqueta: 'Se sigue usando', tipo: 'sino' },
      { nombre: 'notas', etiqueta: 'Notas', tipo: 'area' }
    ],
    alEliminar: async function (registro) {
      if ((await Datos.listar('MovimientosMaterial')).some(function (mv) { return mv.materialId === registro.id; })) {
        return 'Tiene movimientos. Si ya no se usa, destildá "Se sigue usando".';
      }
    },
    despuesDeGuardar: function (guardado, anterior) { if (!anterior) ir('taller/material/' + guardado.id); },
    preguntaEliminar: '¿Eliminar este material?'
  });
}

/**
 * Entrada (compra o donación), Salida (uso en un proyecto) o Conteo (se carga lo que hay de verdad y se guarda la diferencia).
 */
async function formularioMovimientoMaterial(materialId, id, tipo, proyectoId) {
  const t = await cargarTaller();
  const mv = id ? t.movimientosMaterialPorId[id] : null;
  const tipoFinal = mv ? mv.tipo : tipo || 'Entrada';
  const activos = t.materialesTaller.filter(function (m) { return m.activo !== 'false' || m.id === materialId; });
  if (!activos.length) return alert('Primero cargá el material con "+ Material".');
  const proyectos = t.proyectosTaller.filter(function (p) { return p.estado === 'En curso' || p.estado === 'Planificado' || (mv && mv.proyectoId === p.id) || p.id === proyectoId; });
  const titulos = { 'Entrada': '+ Entrada de material', 'Salida': '− Uso de material', 'Conteo': 'Contar stock' };
  const campos = [
    { nombre: 'materialId', etiqueta: 'Material', tipo: 'select', requerido: true, vacio: 'Elegí…',
      opciones: activos.map(function (m) { return { valor: m.id, texto: m.nombre + ' (hay ' + cantidadMaterialTexto(stockMaterial(t, m.id), m) + ')' }; }) },
    { nombre: 'fecha', etiqueta: 'Fecha', tipo: 'fecha', requerido: true, medio: true },
    { nombre: 'cantidad', etiqueta: tipoFinal === 'Conteo' ? 'Cantidad que hay de verdad' : 'Cantidad', tipo: 'numero', minimo: 0, requerido: true, medio: true }
  ];
  if (tipoFinal === 'Entrada') {
    campos.push(
      { nombre: 'costo', etiqueta: 'Costo total $', tipo: 'numero', minimo: 0, medio: true, ayuda: 'Vacío si fue donación' },
      { nombre: 'proveedor', etiqueta: 'Proveedor', tipo: 'texto', medio: true });
    if (!(mv && mv.egresoId)) campos.push({ nombre: 'registrarEgreso', etiqueta: 'Registrar el costo también como egreso en Economía del Taller rural', tipo: 'sino' });
  }
  if (tipoFinal === 'Salida') {
    campos.push({ nombre: 'proyectoId', etiqueta: 'Para qué proyecto', tipo: 'select', vacio: 'Ninguno (otro uso)',
      opciones: proyectos.map(function (p) { return { valor: p.id, texto: p.nombre }; }) });
  }
  campos.push({ nombre: 'notas', etiqueta: 'Notas', tipo: 'area' });
  await abrirFormulario({
    tabla: 'MovimientosMaterial',
    titulo: mv ? 'Editar movimiento' : titulos[tipoFinal],
    registro: mv ? Object.assign({}, mv, { registrarEgreso: 'false' }, tipoFinal === 'Conteo' ? { cantidad: '' } : {}) : null,
    valores: { materialId: materialId || '', fecha: hoyTexto(), proyectoId: proyectoId || '', registrarEgreso: 'true' },
    ayuda: tipoFinal === 'Conteo' ? 'Contá lo que hay en el taller: la app guarda la diferencia con lo que figuraba.' : '',
    campos: campos,
    validar: function (d) {
      if (tipoFinal !== 'Conteo' && !(Number(d.cantidad) > 0)) return 'La cantidad tiene que ser más que cero.';
      if (tipoFinal === 'Salida') {
        const disponible = stockMaterial(t, d.materialId) + (mv ? Number(mv.cantidad) || 0 : 0);
        if (Number(d.cantidad) > disponible) return 'Solo hay ' + cantidadMaterialTexto(disponible, t.materialesTallerPorId[d.materialId]) + ' en stock. Si hay más, primero corregí con "Contar stock".';
      }
    },
    guardar: async function (d, anterior) {
      const registro = { materialId: d.materialId, fecha: d.fecha, tipo: tipoFinal, cantidad: d.cantidad, notas: d.notas,
        proyectoId: d.proyectoId || '', costo: d.costo || '', proveedor: d.proveedor || '' };
      if (anterior) registro.id = anterior.id;
      if (tipoFinal === 'Conteo') {
        const material = t.materialesTallerPorId[d.materialId];
        const figuraba = stockMaterial(t, d.materialId) - (anterior ? Number(anterior.cantidad) || 0 : 0);
        registro.cantidad = String(Math.round((Number(d.cantidad) - figuraba) * 1000) / 1000);
        registro.notas = 'Conteo: había ' + cantidadMaterialTexto(d.cantidad, material) + ' (figuraba ' + cantidadMaterialTexto(figuraba, material) + ')' + (d.notas ? '. ' + d.notas : '');
      }
      let egresoId = anterior ? anterior.egresoId || '' : '';
      if (tipoFinal === 'Entrada' && d.registrarEgreso === 'true' && Number(d.costo) > 0 && !egresoId) {
        const material = t.materialesTallerPorId[d.materialId];
        const egreso = await Datos.guardar('Egresos', {
          entorno: 'Taller rural', fecha: d.fecha, producto: material ? material.nombre : 'Material', cantidad: d.cantidad,
          unidad: material ? material.unidad : '', valor: d.costo, proveedor: d.proveedor || '', numeroFactura: '', notas: 'Desde Taller rural · stock de materiales'
        });
        egresoId = egreso.id;
      }
      registro.egresoId = egresoId;
      return Datos.guardar('MovimientosMaterial', registro);
    },
    preguntaEliminar: '¿Eliminar este movimiento? El stock se recalcula.'
  });
}

/** Agrega a Necesidades del Taller los materiales que están en el mínimo (si no estaban ya pedidos). */
async function pedirMaterialesBajos() {
  const t = await cargarTaller();
  const necesidades = (await Datos.listar('Necesidades')).filter(function (n) { return n.entorno === 'Taller rural' && n.estado !== 'Comprado'; });
  const faltan = bajoMinimo(t).filter(function (m) {
    return !necesidades.some(function (n) { return String(n.articulo).toLowerCase() === String(m.nombre).toLowerCase(); });
  });
  if (!faltan.length) return alert('Esos materiales ya están en Necesidades del Taller rural.');
  if (!confirm('Se agregan a Necesidades del Taller rural: ' + faltan.map(function (m) { return m.nombre; }).join(', ') + '. ¿Seguir?')) return;
  for (const m of faltan) {
    await Datos.guardar('Necesidades', { entorno: 'Taller rural', tipo: 'Insumo', articulo: m.nombre, cantidad: '', unidad: m.unidad, prioridad: 'Normal',
      estado: 'Pendiente', notas: 'Stock en el mínimo: quedan ' + cantidadMaterialTexto(stockMaterial(t, m.id), m) });
  }
  alert('Listo: quedaron en Necesidades de los entornos.');
}
