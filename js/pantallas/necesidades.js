/**
 * NECESIDADES DE LOS ENTORNOS: lista de compras (insumos y herramientas) por entorno.
 * Se marca "comprado" y, si se carga el costo, se puede registrar como egreso en Economía.
 * Direcciones: #/necesidades (lo que falta comprar) y #/necesidades/compradas (lo que ya se compró)
 */
const NECESIDADES = {
  tipos: ['Insumo', 'Herramienta', 'Repuesto', 'Otro'],
  prioridades: ['Urgente', 'Normal', 'Cuando se pueda'],
  iconoTipo: { 'Insumo': '🧴', 'Herramienta': '🛠', 'Repuesto': '⚙', 'Otro': '📦' }
};
const filtroNecesidades = { entorno: '' };
let vistaNecesidades = 'pendientes'; // 'pendientes' o 'compradas'

PANTALLAS.necesidades = function (parametro) {
  vistaNecesidades = parametro === 'compradas' ? 'compradas' : 'pendientes';
  const compradas = vistaNecesidades === 'compradas';
  render(htmlBarra(compradas ? 'Lo comprado' : 'Necesidades de los entornos', compradas ? 'necesidades' : 'inicio') +
    '<main class="contenido" id="contenido-necesidades"><p class="vacio">Cargando…</p></main>');
  alActualizarDatos = dibujarNecesidades;
  dibujarNecesidades();
};

function ordenPrioridad(n) {
  const i = NECESIDADES.prioridades.indexOf(n.prioridad);
  return i === -1 ? 1 : i;
}

/** Pendientes: por prioridad. Compradas: lo último comprado arriba. */
function ordenarNecesidades(lista, compradas) {
  return lista.sort(compradas
    ? function (a, b) { return String(b.fechaCompra).localeCompare(String(a.fechaCompra)); }
    : function (a, b) { return ordenPrioridad(a) - ordenPrioridad(b) || String(a.creadoEn).localeCompare(String(b.creadoEn)); });
}

function gastoNecesidades(lista) {
  return lista.reduce(function (s, n) { return s + (Number(n.costo) || 0); }, 0);
}

async function dibujarNecesidades() {
  const lugar = document.getElementById('contenido-necesidades');
  if (!lugar) return;
  const [todas, entornos] = await Promise.all([Datos.listar('Necesidades'), Datos.lista('Entorno')]);
  if (!document.getElementById('contenido-necesidades')) return;
  const compradas = vistaNecesidades === 'compradas';
  const deLaVista = todas.filter(function (n) { return (n.estado === 'Comprado') === compradas; });
  const editar = puedeEditar();

  let html =
    '<h1>' + (compradas ? '✓ LO COMPRADO' : '🛒 NECESIDADES DE LOS ENTORNOS') + '</h1>' +
    '<p class="saludo">' + (compradas ? 'Insumos y herramientas que ya se compraron' : 'Insumos y herramientas que hay que comprar') + '</p>' +
    '<div class="resumen">' + entornos.map(function (e) {
      const delEntorno = deLaVista.filter(function (x) { return x.entorno === e; });
      if (compradas) {
        const gasto = gastoNecesidades(delEntorno);
        return '<div class="ok"><b>' + delEntorno.length + '</b><span>' + esc(e) + (gasto ? ' · ' + pesos(gasto) : '') + '</span></div>';
      }
      const urgentes = delEntorno.filter(function (x) { return x.prioridad === 'Urgente'; }).length;
      return '<div class="' + (urgentes ? 'mal' : '') + '"><b>' + delEntorno.length + '</b><span>' + esc(e) + (urgentes ? ' · ' + urgentes + ' urgente' + (urgentes === 1 ? '' : 's') : '') + '</span></div>';
    }).join('') + '</div>' +
    '<div class="filtros">' +
      '<label>Entorno<select onchange="filtroNecesidades.entorno = this.value; dibujarNecesidades()"><option value="">Todos</option>' +
        opcionesSelect(entornos, filtroNecesidades.entorno) + '</select></label>' +
    '</div>' +
    (compradas
      ? '<button class="boton secundario" onclick="ir(\'necesidades\')">🛒 Volver a lo que falta comprar</button>'
      : (editar ? '<button class="boton" onclick="formularioNecesidad()">+ Agregar necesidad</button>' : '') +
        '<button class="boton secundario" onclick="ir(\'necesidades/compradas\')">✓ Ver lo comprado</button>');

  const visibles = entornos.filter(function (e) { return !filtroNecesidades.entorno || e === filtroNecesidades.entorno; });
  let algo = false;
  visibles.forEach(function (entorno) {
    const lista = ordenarNecesidades(deLaVista.filter(function (n) { return n.entorno === entorno; }), compradas);
    if (!lista.length) return;
    algo = true;
    const gasto = gastoNecesidades(lista);
    html += '<section class="lista-necesidades">' +
      '<div class="lista-necesidades-cabecera"><h2 class="grupo-titulo">' + (ICONOS_ENTORNO[entorno] || '•') + ' ' + esc(entorno) +
        ' <span class="contador">' + lista.length + '</span>' +
        (compradas && gasto ? ' <span class="ayuda">gastado ' + pesos(gasto) + '</span>' : '') + '</h2>' +
        '<div class="acciones">' +
          (compradas ? '' : '<button class="boton chico secundario" onclick="compartirNecesidades(\'' + esc(entorno) + '\')">📤 Compartir</button>') +
          '<button class="boton chico secundario" onclick="imprimirNecesidades(\'' + esc(entorno) + '\')">🖨 Imprimir</button></div>' +
      '</div>' +
      lista.map(function (n) { return htmlNecesidad(n, editar); }).join('') +
    '</section>';
  });
  if (!algo) {
    html += '<p class="vacio">' + (compradas ? 'No hay compras registradas para mostrar.'
      : filtroNecesidades.entorno || deLaVista.length ? 'No hay necesidades para mostrar.' : 'No hay nada pendiente de compra. 🎉') + '</p>';
  }
  lugar.innerHTML = html;
}

function htmlNecesidad(n, editar) {
  const comprado = n.estado === 'Comprado';
  const id = esc(n.id);
  return '<div class="necesidad' + (comprado ? ' comprada' : '') + (n.prioridad === 'Urgente' && !comprado ? ' urgente' : '') + '">' +
    '<div class="necesidad-texto"><strong>' + (NECESIDADES.iconoTipo[n.tipo] || '📦') + ' ' + esc(n.articulo) +
      (n.cantidad ? ' <span class="necesidad-cantidad">× ' + numero(n.cantidad) + (n.unidad ? ' ' + esc(n.unidad) : '') + '</span>' : '') + '</strong>' +
      '<span class="ayuda">' + [n.tipo, comprado ? '' : n.prioridad, 'pidió ' + (n.creadoPor || '?') + ' el ' + formatearFecha(String(n.creadoEn).slice(0, 10))].filter(Boolean).map(esc).join(' · ') + '</span>' +
      (comprado ? '<span class="ayuda">✓ Comprado el ' + formatearFecha(n.fechaCompra) + (Number(n.costo) ? ' · ' + pesos(n.costo) : '') +
        (n.proveedor ? ' · ' + esc(n.proveedor) : '') + (n.egresoId ? ' · registrado en Economía' : '') + '</span>' : '') +
      (n.notas ? '<span class="ayuda notas">' + esc(n.notas) + '</span>' : '') +
    '</div>' +
    (editar ? '<div class="movimiento-acciones">' +
      (comprado ? '' : '<button class="boton chico" onclick="marcarComprado(\'' + id + '\')">✓ Comprado</button>') +
      '<button class="boton chico secundario" onclick="formularioNecesidad(\'' + id + '\')" aria-label="Editar">✎</button></div>' : '') +
  '</div>';
}

async function formularioNecesidad(id) {
  const [n, entornos, unidades] = await Promise.all([id ? Datos.obtener('Necesidades', id) : null, Datos.lista('Entorno'), Datos.lista('Unidad')]);
  await abrirFormulario({
    tabla: 'Necesidades',
    titulo: n ? 'Editar necesidad' : 'Agregar necesidad',
    registro: n,
    valores: { entorno: filtroNecesidades.entorno || '', tipo: 'Insumo', prioridad: 'Normal', estado: 'Pendiente' },
    campos: [
      { nombre: 'entorno', etiqueta: 'Entorno', tipo: 'select', requerido: true, vacio: 'Elegí…', opciones: entornos },
      { nombre: 'articulo', etiqueta: '¿Qué hace falta?', tipo: 'texto', requerido: true, ayuda: 'Ej: "Cinta de goteo 16 mm", "Pala de punta", "Filtro de aceite MF165"' },
      { nombre: 'tipo', etiqueta: 'Tipo', tipo: 'select', opciones: NECESIDADES.tipos, medio: true },
      { nombre: 'prioridad', etiqueta: 'Prioridad', tipo: 'select', opciones: NECESIDADES.prioridades, medio: true },
      { nombre: 'cantidad', etiqueta: 'Cantidad', tipo: 'numero', minimo: 0, medio: true },
      { nombre: 'unidad', etiqueta: 'Unidad', tipo: 'select', vacio: '—', opciones: unidades.concat(['metro', 'rollo', 'paquete', 'caja']).filter(function (u, i, a) { return a.indexOf(u) === i; }), medio: true },
      { nombre: 'notas', etiqueta: 'Notas', tipo: 'area', ayuda: 'Para qué es, marca o medida, dónde conseguirlo…' }
    ].concat(n && n.estado === 'Comprado' ? [
      { nombre: 'estado', etiqueta: 'Estado', tipo: 'select', opciones: ['Pendiente', 'Comprado'], seccion: 'Compra', medio: true, ayuda: 'Pendiente = vuelve a la lista de compras' },
      { nombre: 'fechaCompra', etiqueta: 'Fecha de compra', tipo: 'fecha', medio: true },
      { nombre: 'costo', etiqueta: 'Costo $', tipo: 'numero', minimo: 0, medio: true },
      { nombre: 'proveedor', etiqueta: 'Dónde se compró', tipo: 'texto', medio: true }
    ] : []),
    preguntaEliminar: '¿Eliminar esta necesidad de la lista?'
  });
}

/** Marca como comprado; si se carga el costo, ofrece registrarlo como egreso del entorno en Economía. */
async function marcarComprado(id) {
  const n = await Datos.obtener('Necesidades', id);
  if (!n) return;
  // Solo Huerta y Forrajes tienen Economía por ahora
  const conEconomia = ENTORNOS.some(function (e) { return e.activo && e.nombre === n.entorno; });
  await abrirFormulario({
    tabla: 'Necesidades',
    titulo: '✓ Comprado: ' + n.articulo,
    registro: Object.assign({}, n, { fechaCompra: hoyTexto(), registrarEgreso: conEconomia ? 'true' : 'false' }),
    alEliminar: false,
    ayuda: 'El costo y dónde se compró son opcionales.',
    campos: [
      { nombre: 'fechaCompra', etiqueta: 'Fecha de compra', tipo: 'fecha', requerido: true },
      { nombre: 'costo', etiqueta: 'Costo $', tipo: 'numero', minimo: 0, medio: true },
      { nombre: 'proveedor', etiqueta: 'Dónde se compró', tipo: 'texto', medio: true }
    ].concat(conEconomia ? [{ nombre: 'registrarEgreso', etiqueta: 'Registrar también como egreso en Economía de ' + n.entorno + ' (si cargaste el costo)', tipo: 'sino' }] : []),
    guardar: async function (d) {
      let egresoId = n.egresoId || '';
      if (d.registrarEgreso === 'true' && Number(d.costo) > 0 && !egresoId) {
        const egreso = await Datos.guardar('Egresos', {
          entorno: n.entorno, fecha: d.fechaCompra, producto: n.articulo, cantidad: n.cantidad || '', unidad: n.unidad || '',
          valor: d.costo, proveedor: d.proveedor || '', numeroFactura: '', notas: 'Desde Necesidades de los entornos'
        });
        egresoId = egreso.id;
      }
      return Datos.guardar('Necesidades', { id: n.id, estado: 'Comprado', fechaCompra: d.fechaCompra, costo: d.costo, proveedor: d.proveedor, egresoId: egresoId });
    }
  });
}

async function listaNecesidadesEntorno(entorno, compradas) {
  return ordenarNecesidades((await Datos.listar('Necesidades'))
    .filter(function (n) { return n.entorno === entorno && (n.estado === 'Comprado') === !!compradas; }), compradas);
}

async function compartirNecesidades(entorno) {
  const lista = await listaNecesidadesEntorno(entorno, false);
  const texto = '🛒 Necesidades · ' + entorno + ' (' + formatearFecha(hoyTexto()) + ')\n' +
    lista.map(function (n) {
      return '• ' + n.articulo + (n.cantidad ? ' × ' + numero(n.cantidad) + (n.unidad ? ' ' + n.unidad : '') : '') + (n.prioridad === 'Urgente' ? ' (URGENTE)' : '') + (n.notas ? ' — ' + n.notas : '');
    }).join('\n');
  try {
    if (navigator.share) { await navigator.share({ title: 'Necesidades · ' + entorno, text: texto }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  try {
    await navigator.clipboard.writeText(texto);
    alert('Lista copiada. Pegala en WhatsApp, un mail o donde quieras.');
  } catch (e) {
    prompt('Copiá la lista:', texto);
  }
}

async function imprimirNecesidades(entorno) {
  const compradas = vistaNecesidades === 'compradas';
  const lista = await listaNecesidadesEntorno(entorno, compradas);
  const cantidad = function (n) { return n.cantidad ? numero(n.cantidad) + (n.unidad ? ' ' + n.unidad : '') : ''; };
  if (compradas) {
    const gasto = gastoNecesidades(lista);
    imprimirInforme('Lo comprado · ' + entorno, 'Al ' + formatearFecha(hoyTexto()) + (gasto ? ' · Total gastado ' + pesos(gasto) : ''),
      htmlTablaInforme(lista.length + ' compras', ['Fecha', 'Qué se compró', 'Cantidad', 'Tipo', 'Costo', 'Dónde', 'Notas'],
        lista.map(function (n) {
          return [formatearFecha(n.fechaCompra), n.articulo, cantidad(n), n.tipo, Number(n.costo) ? pesos(n.costo) : '', n.proveedor, n.notas];
        })));
    return;
  }
  imprimirInforme('Necesidades · ' + entorno, 'Lista de compras al ' + formatearFecha(hoyTexto()),
    htmlTablaInforme(lista.length + ' pendientes', ['', 'Qué hace falta', 'Cantidad', 'Tipo', 'Prioridad', 'Notas'],
      lista.map(function (n) {
        return ['☐', n.articulo, cantidad(n), n.tipo, n.prioridad, n.notas];
      })));
}
