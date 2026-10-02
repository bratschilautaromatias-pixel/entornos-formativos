/**
 * PANTALLA USUARIOS (solo el dueño)
 * Aprobar cuentas nuevas, elegir editor o visor, bloquear y poner contraseñas nuevas.
 */

PANTALLAS.usuarios = function () {
  if (!esDueno()) return ir('inicio');
  render(
    htmlBarra('Usuarios', 'inicio') +
    '<main class="contenido">' +
      '<h1>USUARIOS</h1>' +
      '<p class="saludo">Aprobá las cuentas nuevas y elegí qué puede hacer cada persona.</p>' +
      '<div id="aviso-usuarios"></div>' +
      '<div id="lista-usuarios"><p class="vacio">Cargando usuarios…</p></div>' +
      '<div class="tarjeta-info">' +
        '<strong>¿Qué puede hacer cada uno?</strong>' +
        '<ul>' +
          '<li><b>Editor:</b> carga, modifica y borra datos en todos los entornos.</li>' +
          '<li><b>Visor:</b> solo mira y exporta informes.</li>' +
          '<li><b>Bloqueado:</b> no puede entrar. Podés desbloquearlo cuando quieras.</li>' +
        '</ul>' +
      '</div>' +
    '</main>'
  );
  cargarUsuarios();
};

async function cargarUsuarios() {
  const contenedor = document.getElementById('lista-usuarios');
  if (!contenedor) return;
  try {
    const usuarios = await llamar('listarUsuarios');
    if (document.getElementById('lista-usuarios')) contenedor.innerHTML = htmlListaUsuarios(usuarios);
  } catch (e) {
    if (e.codigo === 'SESION') return cerrarSesion(e.message);
    contenedor.innerHTML = '<div class="aviso error">' +
      esc(e.codigo === 'RED' ? 'Para administrar usuarios necesitás conexión a internet.' : e.message) + '</div>';
  }
}

function htmlListaUsuarios(usuarios) {
  const grupos = [
    { estado: 'pendiente', titulo: 'Esperando aprobación', vacio: 'No hay cuentas nuevas para aprobar.' },
    { estado: 'activo', titulo: 'Activos', vacio: 'Todavía no hay usuarios activos.' },
    { estado: 'bloqueado', titulo: 'Bloqueados', vacio: '' }
  ];
  return grupos.map(function (grupo) {
    const lista = usuarios.filter(function (u) { return u.estado === grupo.estado; });
    if (!lista.length && !grupo.vacio) return '';
    return '<h2 class="grupo-titulo">' + grupo.titulo + ' <span class="contador">' + lista.length + '</span></h2>' +
      (lista.length
        ? lista.map(htmlFilaUsuario).join('')
        : '<p class="ayuda grupo-vacio">' + grupo.vacio + '</p>');
  }).join('');
}

function htmlFilaUsuario(u) {
  const id = esc(u.id);
  const nombreUsuario = esc(u.usuario);
  let acciones = '';

  if (u.rol === 'dueno') {
    acciones = '<span class="insignia">Dueño (vos)</span>';
  } else if (u.estado === 'pendiente' || (u.estado === 'bloqueado' && !u.rol)) {
    acciones =
      '<button class="boton chico" onclick="actualizarUsuario(this, \'' + id + '\', {estado: \'activo\', rol: \'editor\'})">Aprobar como editor</button>' +
      '<button class="boton chico" onclick="actualizarUsuario(this, \'' + id + '\', {estado: \'activo\', rol: \'visor\'})">Aprobar como visor</button>' +
      (u.estado === 'pendiente'
        ? '<button class="boton chico peligro" onclick="actualizarUsuario(this, \'' + id + '\', {estado: \'bloqueado\'}, \'¿Rechazar la cuenta de ' + nombreUsuario + '? No va a poder entrar.\')">Rechazar</button>'
        : '');
  } else if (u.estado === 'activo') {
    acciones =
      '<select onchange="actualizarUsuario(this, \'' + id + '\', {rol: this.value})" aria-label="Rol de ' + nombreUsuario + '">' +
        '<option value="editor"' + (u.rol === 'editor' ? ' selected' : '') + '>Editor</option>' +
        '<option value="visor"' + (u.rol === 'visor' ? ' selected' : '') + '>Visor</option>' +
      '</select>' +
      '<button class="boton chico secundario" onclick="nuevaClaveUsuario(this, \'' + id + '\', \'' + nombreUsuario + '\')">Nueva contraseña</button>' +
      '<button class="boton chico peligro" onclick="actualizarUsuario(this, \'' + id + '\', {estado: \'bloqueado\'}, \'¿Bloquear a ' + nombreUsuario + '? No va a poder entrar hasta que lo desbloquees.\')">Bloquear</button>';
  } else {
    acciones =
      '<button class="boton chico" onclick="actualizarUsuario(this, \'' + id + '\', {estado: \'activo\'})">Desbloquear (' + esc(NOMBRES_ROL[u.rol] || u.rol) + ')</button>';
  }

  return '<div class="fila-usuario">' +
    '<div class="datos-usuario">' +
      '<strong>' + esc(u.nombre) + '</strong>' +
      '<span class="ayuda">@' + nombreUsuario + ' · se registró el ' + esc(formatearFecha(u.fechaAlta)) +
        (u.ultimoIngreso ? ' · último ingreso ' + esc(formatearFecha(u.ultimoIngreso)) : ' · nunca ingresó') + '</span>' +
    '</div>' +
    '<div class="acciones">' + acciones + '</div>' +
  '</div>';
}

async function actualizarUsuario(control, id, cambios, pregunta) {
  if (pregunta && !confirm(pregunta)) return;
  control.disabled = true;
  try {
    const actualizado = await llamar('actualizarUsuario', Object.assign({ id: id }, cambios));
    mostrarAvisoUsuarios(actualizado.nombre + ': ' + descripcionEstado(actualizado) + '.', 'ok');
  } catch (e) {
    if (e.codigo === 'SESION') return cerrarSesion(e.message);
    mostrarAvisoUsuarios(e.message, 'error');
  }
  cargarUsuarios();
}

async function nuevaClaveUsuario(boton, id, usuario) {
  const clave = prompt('Escribí la nueva contraseña para ' + usuario + ' (al menos 6 caracteres):');
  if (clave === null) return;
  if (clave.length < 6) return mostrarAvisoUsuarios('La contraseña debe tener al menos 6 caracteres.', 'error');
  ocupado(boton, true, 'Guardando…');
  try {
    await llamar('resetearClave', { id: id, claveNueva: clave });
    mostrarAvisoUsuarios('Listo. Pasale a ' + usuario + ' su nueva contraseña.', 'ok');
  } catch (e) {
    if (e.codigo === 'SESION') return cerrarSesion(e.message);
    mostrarAvisoUsuarios(e.message, 'error');
  }
  ocupado(boton, false);
}

function descripcionEstado(u) {
  if (u.estado === 'bloqueado') return 'bloqueado';
  return 'activo como ' + (NOMBRES_ROL[u.rol] || u.rol).toLowerCase();
}

function mostrarAvisoUsuarios(texto, tipo) {
  const lugar = document.getElementById('aviso-usuarios');
  if (lugar) lugar.innerHTML = '<div class="aviso ' + (tipo === 'error' ? 'error' : '') + '">' + esc(texto) + '</div>';
}
