/**
 * ECONOMÍA DE UN ENTORNO: ingresos (ventas), egresos (compras) y remitos internos.
 * Igual que en Sistema control vegetal, más cantidad/unidad y número de remito automático.
 * Dirección: #/economia/huerta
 */

const TIPOS_MOVIMIENTO = {
  Ingresos: {
    singular: 'ingreso', icono: '⬆', titulo: 'Ingresos',
    persona: 'cliente', etiquetaPersona: 'Cliente (nombre y apellido)', personaObligatoria: false
  },
  Egresos: {
    singular: 'egreso', icono: '⬇', titulo: 'Egresos',
    persona: 'proveedor', etiquetaPersona: 'Proveedor / vendedor', personaObligatoria: true
  },
  Remitos: {
    singular: 'remito', icono: '📦', titulo: 'Remitos',
    persona: 'destino', etiquetaPersona: 'Destino (a qué área va)', personaObligatoria: true
  }
};

const estadoEconomia = { pestana: 'Ingresos', periodo: 'anio', desde: '', hasta: '', buscar: '' };
let entornoEconomia = null;

PANTALLAS.economia = function (clave) {
  const entorno = entornoPorClave(clave);
  if (!entorno) return ir('inicio');
  entornoEconomia = entorno;

  render(
    htmlBarra('Economía · ' + entorno.nombre, 'entorno/' + entorno.clave) +
    '<main class="contenido">' +
      '<div class="selector-periodo" id="selector-periodo"></div>' +
      '<div id="totales-economia"></div>' +
      (puedeEditar()
        ? '<div class="botones-alta">' +
            '<button class="boton chico" onclick="formularioMovimiento(\'Ingresos\')">+ Ingreso</button>' +
            '<button class="boton chico" onclick="formularioMovimiento(\'Egresos\')">+ Egreso</button>' +
            '<button class="boton chico" onclick="formularioMovimiento(\'Remitos\')">+ Remito</button>' +
          '</div>'
        : '') +
      '<div class="pestanas" id="pestanas-economia" role="tablist"></div>' +
      '<input type="search" class="buscador" placeholder="Buscar por producto, persona, factura…" ' +
        'value="' + esc(estadoEconomia.buscar) + '" oninput="estadoEconomia.buscar = this.value; dibujarListaEconomia()">' +
      '<div id="lista-economia"><p class="vacio">Cargando…</p></div>' +
    '</main>'
  );

  dibujarSelectorPeriodo();
  alActualizarDatos = dibujarEconomia;
  dibujarEconomia();
};

/* ---------- Período ---------- */

function dibujarSelectorPeriodo() {
  const lugar = document.getElementById('selector-periodo');
  if (!lugar) return;
  const opciones = [['mes', 'Este mes'], ['mesAnterior', 'Mes anterior'], ['anio', 'Este año'], ['todo', 'Todo'], ['rango', 'Elegir fechas']];
  lugar.innerHTML =
    '<label>Período<select onchange="cambiarPeriodo(this.value)">' +
      opciones.map(function (o) {
        return '<option value="' + o[0] + '"' + (estadoEconomia.periodo === o[0] ? ' selected' : '') + '>' + o[1] + '</option>';
      }).join('') +
    '</select></label>' +
    (estadoEconomia.periodo === 'rango'
      ? '<div class="dos-columnas">' +
          '<label>Desde<input type="date" value="' + esc(estadoEconomia.desde) + '" onchange="estadoEconomia.desde = this.value; dibujarEconomia()"></label>' +
          '<label>Hasta<input type="date" value="' + esc(estadoEconomia.hasta) + '" onchange="estadoEconomia.hasta = this.value; dibujarEconomia()"></label>' +
        '</div>'
      : '');
}

function cambiarPeriodo(valor) {
  estadoEconomia.periodo = valor;
  if (valor === 'rango' && !estadoEconomia.desde) {
    const mes = calcularPeriodo('mes');
    estadoEconomia.desde = mes.desde;
    estadoEconomia.hasta = mes.hasta;
  }
  dibujarSelectorPeriodo();
  dibujarEconomia();
}

function periodoEconomia() {
  return calcularPeriodo(estadoEconomia.periodo, estadoEconomia.desde, estadoEconomia.hasta);
}

/* ---------- Datos ---------- */

async function movimientosDelPeriodo(tabla, nombreEntorno, periodo) {
  return (await Datos.listar(tabla)).filter(function (m) {
    return m.entorno === nombreEntorno && m.fecha >= periodo.desde && m.fecha <= periodo.hasta;
  });
}

function sumarValores(movimientos) {
  return movimientos.reduce(function (total, m) { return total + (Number(m.valor) || 0); }, 0);
}

/* ---------- Dibujo ---------- */

async function dibujarEconomia() {
  if (!document.getElementById('totales-economia')) return;
  const periodo = periodoEconomia();
  const nombre = entornoEconomia.nombre;
  const [ingresos, egresos, remitos] = await Promise.all([
    movimientosDelPeriodo('Ingresos', nombre, periodo),
    movimientosDelPeriodo('Egresos', nombre, periodo),
    movimientosDelPeriodo('Remitos', nombre, periodo)
  ]);
  const lugar = document.getElementById('totales-economia');
  if (!lugar) return;

  const totalIngresos = sumarValores(ingresos);
  const totalEgresos = sumarValores(egresos);
  const balance = totalIngresos - totalEgresos;
  lugar.innerHTML =
    '<p class="ayuda centrado">' + esc(periodo.titulo) + '</p>' +
    '<div class="totales">' +
      '<div class="ok"><span>Ingresos</span><b>' + pesos(totalIngresos) + '</b><small>' + ingresos.length + ' movimientos</small></div>' +
      '<div class="mal"><span>Egresos</span><b>' + pesos(totalEgresos) + '</b><small>' + egresos.length + ' movimientos</small></div>' +
      '<div class="' + (balance >= 0 ? 'ok' : 'mal') + '"><span>Balance</span><b>' + pesos(balance) + '</b><small>ingresos − egresos</small></div>' +
      '<div><span>Remitos</span><b>' + pesos(sumarValores(remitos)) + '</b><small>' + remitos.length + ' entregas internas</small></div>' +
    '</div>';

  const pestanas = [['Ingresos', ingresos.length], ['Egresos', egresos.length], ['Remitos', remitos.length]];
  if (puedeEditar()) pestanas.push(['Papelera', '']);
  document.getElementById('pestanas-economia').innerHTML = pestanas.map(function (p) {
    return '<button role="tab" aria-selected="' + (estadoEconomia.pestana === p[0]) + '" class="pestana' + (estadoEconomia.pestana === p[0] ? ' activa' : '') + '" ' +
      'onclick="estadoEconomia.pestana = \'' + p[0] + '\'; dibujarEconomia()">' +
      (p[0] === 'Papelera' ? '🗑 ' : '') + p[0] + (p[1] !== '' ? ' <span class="contador">' + p[1] + '</span>' : '') + '</button>';
  }).join('');

  dibujarListaEconomia();
}

async function dibujarListaEconomia() {
  const lugar = document.getElementById('lista-economia');
  if (!lugar) return;
  const pestana = estadoEconomia.pestana;
  const texto = estadoEconomia.buscar.trim().toLowerCase();
  const coincide = function (m) {
    if (!texto) return true;
    return [m.producto, m.cliente, m.proveedor, m.destino, m.numeroFactura, m.numero, m.notas, m.tipoPago]
      .some(function (v) { return v && String(v).toLowerCase().indexOf(texto) !== -1; });
  };

  if (pestana === 'Papelera') {
    const eliminados = [];
    for (const tabla of Object.keys(TIPOS_MOVIMIENTO)) {
      (await Datos.listarEliminados(tabla)).forEach(function (m) {
        if (m.entorno === entornoEconomia.nombre && coincide(m)) eliminados.push(Object.assign({ _tabla: tabla }, m));
      });
    }
    eliminados.sort(function (a, b) { return String(b.modificadoEn).localeCompare(String(a.modificadoEn)); });
    lugar.innerHTML = '<p class="ayuda">Lo que se elimina queda acá. Podés restaurarlo cuando quieras.</p>' +
      (eliminados.length ? eliminados.map(htmlMovimientoEliminado).join('') : '<p class="vacio">La papelera está vacía.</p>');
    return;
  }

  const lista = (await movimientosDelPeriodo(pestana, entornoEconomia.nombre, periodoEconomia()))
    .filter(coincide)
    .sort(function (a, b) {
      return b.fecha.localeCompare(a.fecha) || String(b.numero || '').localeCompare(String(a.numero || '')) ||
        String(b.creadoEn).localeCompare(String(a.creadoEn));
    });
  if (!document.getElementById('lista-economia')) return;
  lugar.innerHTML = lista.length
    ? '<p class="ayuda">' + lista.length + ' ' + (lista.length === 1 ? TIPOS_MOVIMIENTO[pestana].singular : pestana.toLowerCase()) +
        ' · Total ' + pesos(sumarValores(lista)) + '</p>' +
      lista.map(function (m) { return htmlMovimiento(pestana, m); }).join('')
    : '<p class="vacio">No hay ' + pestana.toLowerCase() + ' en este período' + (texto ? ' con esa búsqueda' : '') + '.</p>';
}

function htmlMovimiento(tabla, m) {
  const tipo = TIPOS_MOVIMIENTO[tabla];
  const id = esc(m.id);
  const cantidad = m.cantidad ? numero(m.cantidad) + (m.unidad ? ' ' + esc(m.unidad) : '') : '';
  const detalles = [
    formatearFecha(m.fecha),
    tabla === 'Remitos' ? (m.numero ? esc(m.numero) : 'N° a asignar') : '',
    cantidad,
    m[tipo.persona] ? (tabla === 'Remitos' ? '→ ' : '') + esc(m[tipo.persona]) : '',
    tabla === 'Ingresos' && m.tipoPago ? esc(m.tipoPago) : '',
    tabla === 'Egresos' && m.numeroFactura ? 'Fact. ' + esc(m.numeroFactura) : ''
  ].filter(Boolean).join(' · ');

  return '<div class="movimiento mov-' + tabla.toLowerCase() + '">' +
    '<div class="movimiento-texto">' +
      '<strong>' + esc(m.producto) + '</strong>' +
      '<span class="ayuda">' + detalles + '</span>' +
      (m.notas ? '<span class="ayuda notas">' + esc(m.notas) + '</span>' : '') +
    '</div>' +
    '<div class="movimiento-valor">' + pesos(Number(m.valor) || 0) + '</div>' +
    '<div class="movimiento-acciones">' +
      (tabla === 'Remitos' ? '<button class="boton chico secundario" onclick="imprimirRemito(\'' + id + '\')" title="Imprimir remito">🖨</button>' : '') +
      (puedeEditar() ? '<button class="boton chico secundario" onclick="formularioMovimiento(\'' + tabla + '\', \'' + id + '\')" aria-label="Editar">✎</button>' : '') +
    '</div>' +
  '</div>';
}

function htmlMovimientoEliminado(m) {
  const tipo = TIPOS_MOVIMIENTO[m._tabla];
  return '<div class="movimiento eliminado">' +
    '<div class="movimiento-texto">' +
      '<strong>' + esc(m.producto) + '</strong>' +
      '<span class="ayuda">' + tipo.singular.charAt(0).toUpperCase() + tipo.singular.slice(1) + ' del ' + formatearFecha(m.fecha) +
        ' · ' + pesos(Number(m.valor) || 0) + ' · eliminado por ' + esc(m.modificadoPor || '') + '</span>' +
    '</div>' +
    '<div class="movimiento-acciones">' +
      '<button class="boton chico" onclick="restaurarMovimiento(\'' + m._tabla + '\', \'' + esc(m.id) + '\')">Restaurar</button>' +
    '</div>' +
  '</div>';
}

async function restaurarMovimiento(tabla, id) {
  await Datos.guardar(tabla, { id: id, eliminado: 'false' });
}

/* ---------- Formulario de alta / edición ---------- */

async function formularioMovimiento(tabla, id) {
  if (!puedeEditar()) return;
  const tipo = TIPOS_MOVIMIENTO[tabla];
  const m = id ? await Datos.obtener(tabla, id) : null;
  const [unidades, tiposPago, todos] = await Promise.all([
    Datos.lista('Unidad'), Datos.lista('TipoPago'), Datos.listar(tabla)
  ]);

  // Sugerencias con lo que ya se cargó antes en este entorno
  const delEntorno = todos.filter(function (x) { return x.entorno === entornoEconomia.nombre; });
  const sugerencias = function (campo) {
    const vistos = {};
    delEntorno.forEach(function (x) { if (x[campo]) vistos[String(x[campo]).trim()] = true; });
    return Object.keys(vistos).sort().map(function (v) { return '<option value="' + esc(v) + '">'; }).join('');
  };

  const valor = function (campo) { return m && m[campo] !== undefined ? m[campo] : ''; };
  const titulo = (m ? 'Editar ' : 'Nuevo ') + tipo.singular + (tabla === 'Remitos' && m && m.numero ? ' ' + m.numero : '');

  abrirModal(
    '<form id="form-movimiento" novalidate>' +
      '<h2>' + tipo.icono + ' ' + esc(titulo) + '</h2>' +
      (tabla === 'Remitos' && !(m && m.numero)
        ? '<p class="ayuda">El número de remito (R-0001, R-0002…) lo pone el sistema al sincronizar.</p>' : '') +
      '<div class="dos-columnas">' +
        '<label>Fecha<input name="fecha" type="date" required value="' + esc(valor('fecha') || hoyTexto()) + '"></label>' +
        '<label>Valor $<input name="valor" inputmode="decimal" required placeholder="0" value="' + esc(valor('valor')) + '"></label>' +
      '</div>' +
      '<label>Producto<input name="producto" list="sug-producto" maxlength="200" required value="' + esc(valor('producto')) + '">' +
        '<datalist id="sug-producto">' + sugerencias('producto') + '</datalist></label>' +
      '<div class="dos-columnas">' +
        '<label>Cantidad' + (tabla === 'Remitos' ? '' : ' <span class="ayuda">(opcional)</span>') +
          '<input name="cantidad" inputmode="decimal" placeholder="0" value="' + esc(valor('cantidad')) + '"></label>' +
        '<label>Unidad<select name="unidad">' + opcionesSelect(unidades, valor('unidad'), '—') + '</select></label>' +
      '</div>' +
      (tabla === 'Ingresos'
        ? '<label>Forma de pago<select name="tipoPago">' + opcionesSelect(tiposPago, valor('tipoPago') || tiposPago[0]) + '</select></label>'
        : '') +
      '<label>' + esc(tipo.etiquetaPersona) +
        '<input name="persona" list="sug-persona" maxlength="200" value="' + esc(valor(tipo.persona)) + '">' +
        '<datalist id="sug-persona">' + sugerencias(tipo.persona) + '</datalist></label>' +
      (tabla === 'Egresos'
        ? '<label>N° de factura <span class="ayuda">(opcional)</span><input name="numeroFactura" maxlength="50" value="' + esc(valor('numeroFactura')) + '"></label>'
        : '') +
      '<label>Notas <span class="ayuda">(opcional)</span><textarea name="notas" rows="2" maxlength="1000">' + esc(valor('notas')) + '</textarea></label>' +
      '<p class="mensaje" id="mensaje-movimiento"></p>' +
      '<div class="modal-botones">' +
        (m ? '<button type="button" class="boton chico peligro" onclick="eliminarMovimiento(\'' + tabla + '\', \'' + esc(m.id) + '\')">Eliminar</button>' : '') +
        '<span class="espacio"></span>' +
        '<button type="button" class="boton chico secundario" onclick="cerrarModal()">Cancelar</button>' +
        '<button type="submit" class="boton chico">Guardar</button>' +
      '</div>' +
    '</form>'
  );

  document.getElementById('form-movimiento').addEventListener('submit', async function (evento) {
    evento.preventDefault();
    const f = evento.target;
    const valorNumero = parsearNumero(f.valor.value);
    const cantidad = f.cantidad.value.trim() ? parsearNumero(f.cantidad.value) : '';
    const datos = {
      entorno: entornoEconomia.nombre,
      fecha: f.fecha.value,
      producto: f.producto.value.trim(),
      cantidad: cantidad === '' ? '' : String(cantidad),
      unidad: f.unidad.value,
      valor: String(valorNumero),
      notas: f.notas.value.trim()
    };
    datos[tipo.persona] = f.persona.value.trim();
    if (tabla === 'Ingresos') datos.tipoPago = f.tipoPago.value;
    if (tabla === 'Egresos') datos.numeroFactura = f.numeroFactura.value.trim();

    const error = function (texto) { mostrarMensaje('mensaje-movimiento', texto, 'error'); };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datos.fecha)) return error('Elegí la fecha.');
    if (!datos.producto) return error('Escribí el producto.');
    if (isNaN(valorNumero) || valorNumero < 0 || (tabla !== 'Remitos' && valorNumero === 0)) {
      return error('Escribí un valor válido' + (tabla !== 'Remitos' ? ' (mayor a 0).' : '.'));
    }
    if (cantidad !== '' && (isNaN(cantidad) || cantidad <= 0)) return error('La cantidad tiene que ser un número mayor a 0.');
    if (tabla === 'Remitos' && cantidad === '') return error('Escribí la cantidad que se entrega.');
    if (tipo.personaObligatoria && !datos[tipo.persona]) return error('Completá: ' + tipo.etiquetaPersona.toLowerCase() + '.');

    if (m) datos.id = m.id;
    else if (tabla === 'Remitos') datos.numero = '';
    await Datos.guardar(tabla, datos);
    cerrarModal();
    estadoEconomia.pestana = tabla;
    // Si quedó fuera del período que se está viendo, se pasa a "Todo" para que se vea
    const periodo = periodoEconomia();
    if (datos.fecha < periodo.desde || datos.fecha > periodo.hasta) {
      estadoEconomia.periodo = 'todo';
      dibujarSelectorPeriodo();
    }
    dibujarEconomia();
  });
}

async function eliminarMovimiento(tabla, id) {
  if (!confirm('¿Eliminar este ' + TIPOS_MOVIMIENTO[tabla].singular + '? Va a quedar en la papelera.')) return;
  await Datos.eliminar(tabla, id);
  cerrarModal();
}

/* ---------- Impresión de remito ---------- */

async function imprimirRemito(id) {
  const r = await Datos.obtener('Remitos', id);
  if (!r) return;
  const html =
    '<div class="remito-impreso">' +
      '<div class="remito-cabecera">' +
        '<div><h1>Remito interno</h1><p>Entornos Formativos · ' + esc(r.entorno) + '</p></div>' +
        '<div class="remito-numero"><b>' + esc(r.numero || 'Sin número') + '</b><span>Fecha: ' + formatearFecha(r.fecha) + '</span></div>' +
      '</div>' +
      '<table>' +
        '<tr><th>Origen</th><td>' + esc(r.entorno) + '</td></tr>' +
        '<tr><th>Destino</th><td>' + esc(r.destino) + '</td></tr>' +
        '<tr><th>Producto</th><td>' + esc(r.producto) + '</td></tr>' +
        '<tr><th>Cantidad</th><td>' + (r.cantidad ? numero(r.cantidad) + ' ' + esc(r.unidad || '') : '—') + '</td></tr>' +
        '<tr><th>Valor</th><td>' + pesos(Number(r.valor) || 0) + '</td></tr>' +
        (r.notas ? '<tr><th>Notas</th><td>' + esc(r.notas) + '</td></tr>' : '') +
      '</table>' +
      '<div class="firmas">' +
        '<div><span></span>Entrega · Firma y aclaración</div>' +
        '<div><span></span>Recibe · Firma y aclaración</div>' +
      '</div>' +
    '</div>';
  imprimirHtml(html);
}
