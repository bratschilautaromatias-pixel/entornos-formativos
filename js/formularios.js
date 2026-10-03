/**
 * FORMULARIOS GENÉRICOS
 * Arma la ventana de alta/edición a partir de una lista de campos, valida y guarda.
 *
 * Cada campo: {
 *   nombre: 'fechaSiembra', etiqueta: 'Fecha de siembra',
 *   tipo: 'texto' | 'area' | 'numero' | 'entero' | 'fecha' | 'select' | 'sino',
 *   opciones: ['A', 'B'] | [{ valor, texto }] | async function (valores) → lista   (para select),
 *   vacio: 'texto de la opción vacía' (select opcional),
 *   requerido: true, minimo: 0, ayuda: 'texto chico', medio: true (ocupa media fila),
 *   recalcularCon: ['parcelaId'] (vuelve a pedir las opciones cuando cambia otro campo),
 *   seccion: 'Título de grupo' (muestra un subtítulo antes del campo)
 * }
 * Opciones del formulario: tabla, titulo, registro, valores, campos, ayuda, validar, antesDeGuardar,
 * guardar (reemplaza el guardado común), despuesDeGuardar, alEliminar (devuelve un error o nada),
 * eliminar (reemplaza el borrado común), preguntaEliminar, textoEliminar.
 */

async function abrirFormulario(op) {
  if (!puedeEditar()) return;
  const existente = op.registro || null;
  const valores = Object.assign({}, op.valores || {}, existente || {});
  const campos = op.campos;

  for (const campo of campos) campo._opciones = await opcionesDeCampo(campo, valores);

  let html = '<form id="form-generico" novalidate><h2>' + esc(op.titulo) + '</h2>' +
    (op.ayuda ? '<p class="ayuda">' + esc(op.ayuda) + '</p>' : '');
  let i = 0;
  while (i < campos.length) {
    const campo = campos[i];
    if (campo.seccion) html += '<h3 class="form-seccion">' + esc(campo.seccion) + '</h3>';
    const siguiente = campos[i + 1];
    if (campo.medio && siguiente && siguiente.medio && !siguiente.seccion) {
      html += '<div class="dos-columnas">' + htmlCampo(campo, valores) + htmlCampo(siguiente, valores) + '</div>';
      i += 2;
    } else {
      html += htmlCampo(campo, valores);
      i += 1;
    }
  }
  html += '<p class="mensaje" id="mensaje-generico"></p>' +
    '<div class="modal-botones">' +
      (existente && op.alEliminar !== false
        ? '<button type="button" class="boton chico peligro" id="boton-eliminar">' + esc(op.textoEliminar || 'Eliminar') + '</button>' : '') +
      '<span class="espacio"></span>' +
      '<button type="button" class="boton chico secundario" onclick="cerrarModal()">Cancelar</button>' +
      '<button type="submit" class="boton chico">Guardar</button>' +
    '</div></form>';
  abrirModal(html);

  const form = document.getElementById('form-generico');

  // Campos que dependen de otros (ej. lomos de la parcela elegida)
  campos.filter(function (c) { return c.recalcularCon; }).forEach(function (campo) {
    campo.recalcularCon.forEach(function (otro) {
      const control = campoDelFormulario(form, otro);
      if (!control) return;
      control.addEventListener('change', async function () {
        const actuales = leerValoresFormulario(form, campos, true).datos;
        campo._opciones = await opcionesDeCampo(campo, actuales);
        const select = campoDelFormulario(form, campo.nombre);
        select.innerHTML = htmlOpciones(campo, '');
      });
    });
  });

  if (existente && op.alEliminar !== false) {
    document.getElementById('boton-eliminar').addEventListener('click', async function () {
      if (!confirm(op.preguntaEliminar || '¿Eliminar este registro?')) return;
      if (typeof op.alEliminar === 'function') {
        const error = await op.alEliminar(existente);
        if (error) return mostrarMensaje('mensaje-generico', error, 'error');
      }
      if (op.eliminar) await op.eliminar(existente);
      else await Datos.eliminar(op.tabla, existente.id);
      cerrarModal();
    });
  }

  form.addEventListener('submit', async function (evento) {
    evento.preventDefault();
    const leido = leerValoresFormulario(form, campos, false);
    if (leido.error) return mostrarMensaje('mensaje-generico', leido.error, 'error');
    const datos = leido.datos;
    if (op.validar) {
      const error = await op.validar(datos, existente);
      if (error) return mostrarMensaje('mensaje-generico', error, 'error');
    }
    if (op.antesDeGuardar) await op.antesDeGuardar(datos, existente);
    if (existente) datos.id = existente.id;
    let guardado;
    try {
      // "guardar" permite reemplazar el guardado común (por ejemplo, cuando un formulario crea varios registros)
      guardado = op.guardar ? await op.guardar(datos, existente) : await Datos.guardar(op.tabla, datos);
    } catch (e) {
      return mostrarMensaje('mensaje-generico', e.message, 'error');
    }
    cerrarModal();
    if (op.despuesDeGuardar) await op.despuesDeGuardar(guardado, existente);
  });
}

function marcarTodasCasillas(boton) {
  const casillas = boton.closest('fieldset').querySelectorAll('input[type=checkbox]');
  const marcar = Array.prototype.some.call(casillas, function (c) { return !c.checked; });
  casillas.forEach(function (c) { c.checked = marcar; });
}

async function opcionesDeCampo(campo, valores) {
  if (campo.tipo !== 'select' && campo.tipo !== 'casillas') return [];
  const lista = typeof campo.opciones === 'function' ? await campo.opciones(valores) : (campo.opciones || []);
  return lista.map(function (o) { return typeof o === 'object' ? o : { valor: o, texto: o }; });
}

function htmlOpciones(campo, elegido) {
  return (campo.vacio !== undefined ? '<option value="">' + esc(campo.vacio) + '</option>' : '') +
    campo._opciones.map(function (o) {
      return '<option value="' + esc(o.valor) + '"' + (String(o.valor) === String(elegido) ? ' selected' : '') + '>' + esc(o.texto) + '</option>';
    }).join('');
}

function htmlCampo(campo, valores) {
  const valor = valores[campo.nombre] !== undefined && valores[campo.nombre] !== null ? valores[campo.nombre] : '';
  const etiqueta = esc(campo.etiqueta) + (campo.requerido ? '' : (campo.tipo === 'sino' ? '' : ' <span class="ayuda">(opcional)</span>'));
  const ayuda = campo.ayuda ? '<span class="ayuda">' + esc(campo.ayuda) + '</span>' : '';
  const nombre = 'name="' + esc(campo.nombre) + '"';

  switch (campo.tipo) {
    case 'area':
      return '<label>' + etiqueta + '<textarea ' + nombre + ' rows="2" maxlength="2000">' + esc(valor) + '</textarea>' + ayuda + '</label>';
    case 'fecha':
      return '<label>' + etiqueta + '<input ' + nombre + ' type="date" value="' + esc(valor) + '">' + ayuda + '</label>';
    case 'numero':
    case 'entero':
      return '<label>' + etiqueta + '<input ' + nombre + ' inputmode="' + (campo.tipo === 'entero' ? 'numeric' : 'decimal') + '" value="' +
        esc(valor === '' ? '' : String(valor).replace('.', ',')) + '">' + ayuda + '</label>';
    case 'select':
      return '<label>' + etiqueta + '<select ' + nombre + '>' + htmlOpciones(campo, valor) + '</select>' + ayuda + '</label>';
    case 'sino':
      return '<label class="casilla"><input ' + nombre + ' type="checkbox"' + (valor === 'true' ? ' checked' : '') + '> ' +
        esc(campo.etiqueta) + '</label>' + (ayuda ? '<p>' + ayuda + '</p>' : '');
    case 'casillas': {
      // Varias opciones a la vez. El valor se guarda como lista separada por comas.
      const elegidos = String(valor).split(',').filter(Boolean);
      return '<fieldset class="casillas" data-campo="' + esc(campo.nombre) + '"><legend>' + etiqueta + '</legend>' +
        (campo.botonTodos ? '<button type="button" class="boton chico secundario" onclick="marcarTodasCasillas(this)">Marcar todos</button>' : '') +
        campo._opciones.map(function (o) {
          return '<label class="casilla' + (o.sangria ? ' sangria' : '') + '"><input type="checkbox" value="' + esc(o.valor) + '"' +
            (elegidos.indexOf(String(o.valor)) !== -1 ? ' checked' : '') + '> ' + esc(o.texto) + '</label>';
        }).join('') + ayuda + '</fieldset>';
    }
    default:
      return '<label>' + etiqueta + '<input ' + nombre + ' maxlength="300" value="' + esc(valor) + '">' + ayuda + '</label>';
  }
}

/** Lee el formulario. Con "sinValidar" no corta por errores (sirve para recalcular opciones). */
function leerValoresFormulario(form, campos, sinValidar) {
  const datos = {};
  for (const campo of campos) {
    if (campo.tipo === 'casillas') {
      const grupo = form.querySelector('fieldset[data-campo="' + campo.nombre + '"]');
      const valor = grupo ? Array.prototype.filter.call(grupo.querySelectorAll('input:checked'), function () { return true; })
        .map(function (c) { return c.value; }).join(',') : '';
      if (!sinValidar && campo.requerido && !valor) return { error: 'Elegí al menos una opción en "' + campo.etiqueta + '".' };
      datos[campo.nombre] = valor;
      continue;
    }
    const control = campoDelFormulario(form, campo.nombre);
    if (!control) continue;
    let valor;
    if (campo.tipo === 'sino') {
      valor = control.checked ? 'true' : 'false';
    } else if (campo.tipo === 'numero' || campo.tipo === 'entero') {
      const texto = control.value.trim();
      if (!texto) valor = '';
      else {
        const n = parsearNumero(texto);
        if (!sinValidar) {
          if (isNaN(n)) return { error: '"' + campo.etiqueta + '" tiene que ser un número.' };
          if (campo.tipo === 'entero' && !Number.isInteger(n)) return { error: '"' + campo.etiqueta + '" tiene que ser un número entero.' };
          if (campo.minimo !== undefined && n < campo.minimo) return { error: '"' + campo.etiqueta + '" no puede ser menor a ' + campo.minimo + '.' };
        }
        valor = isNaN(n) ? '' : String(n);
      }
    } else {
      valor = control.value.trim();
    }
    if (!sinValidar && campo.requerido && valor === '') return { error: 'Completá "' + campo.etiqueta + '".' };
    datos[campo.nombre] = valor;
  }
  return { datos: datos };
}

/** Busca un campo por nombre (sin chocar con nombres reservados del navegador como "item" o "length"). */
function campoDelFormulario(form, nombre) {
  return form.querySelector('[name="' + nombre + '"]');
}
