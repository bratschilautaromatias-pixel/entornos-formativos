/**
 * PANTALLAS DE ACCESO: ingresar y crear cuenta
 */

PANTALLAS.ingresar = function () {
  render(
    '<main class="centro">' +
      '<form class="tarjeta" id="formulario" novalidate>' +
        '<div class="logo">🌱</div>' +
        '<h1>Entornos Formativos</h1>' +
        '<p class="sub">Ingresá con tu usuario</p>' +
        htmlAviso() +
        '<label>Usuario<input name="usuario" autocomplete="username" autocapitalize="none" spellcheck="false" required></label>' +
        '<label>Contraseña<input name="clave" type="password" autocomplete="current-password" required></label>' +
        '<p class="mensaje" id="mensaje"></p>' +
        '<button class="boton" type="submit" id="boton">Ingresar</button>' +
        '<p class="pie">¿No tenés cuenta? <a href="#/registro">Crear cuenta</a></p>' +
      '</form>' +
    '</main>'
  );

  const formulario = document.getElementById('formulario');
  formulario.usuario.focus();
  formulario.addEventListener('submit', async function (evento) {
    evento.preventDefault();
    const usuario = formulario.usuario.value.trim().toLowerCase();
    const clave = formulario.clave.value;
    if (!usuario || !clave) return mostrarMensaje('mensaje', 'Completá usuario y contraseña.', 'error');

    const boton = document.getElementById('boton');
    ocupado(boton, true, 'Ingresando…');
    mostrarMensaje('mensaje', '');
    try {
      const datos = await llamar('ingresar', { usuario: usuario, clave: clave });
      Sesion.guardar({ token: datos.token, usuario: datos.usuario, sinConexion: false });
      await AccesoLocal.guardar(usuario, clave, datos.usuario, datos.token);
      ir('inicio');
    } catch (e) {
      if (e.codigo === 'RED') {
        const local = await AccesoLocal.comprobar(usuario, clave);
        if (local) {
          Sesion.guardar({ token: local.token, usuario: local.usuario, sinConexion: true });
          avisoPendiente = { texto: 'Entraste sin conexión. Lo que cargues se va a sincronizar cuando vuelva internet.' };
          ir('inicio');
          return;
        }
        mostrarMensaje('mensaje', 'Sin internet. La primera vez que entrás en este equipo necesitás conexión.', 'error');
      } else {
        if (e.codigo === 'SESION') AccesoLocal.olvidar(usuario); // pendiente o bloqueado
        mostrarMensaje('mensaje', e.message, 'error');
      }
      ocupado(boton, false);
    }
  });
};

PANTALLAS.registro = function () {
  render(
    '<main class="centro">' +
      '<form class="tarjeta" id="formulario" novalidate>' +
        '<div class="logo">🌱</div>' +
        '<h1>Crear cuenta</h1>' +
        '<p class="sub">Después de crearla, el dueño de la app tiene que aprobarla.</p>' +
        '<label>Nombre y apellido<input name="nombre" autocomplete="name" required></label>' +
        '<label>Usuario<input name="usuario" autocomplete="username" autocapitalize="none" spellcheck="false" required>' +
          '<span class="ayuda">Sin espacios ni acentos. Ej: juan.perez</span></label>' +
        '<label>Contraseña<input name="clave" type="password" autocomplete="new-password" required>' +
          '<span class="ayuda">Al menos 6 caracteres.</span></label>' +
        '<label>Repetir contraseña<input name="clave2" type="password" autocomplete="new-password" required></label>' +
        '<p class="mensaje" id="mensaje"></p>' +
        '<button class="boton" type="submit" id="boton">Crear cuenta</button>' +
        '<p class="pie">¿Ya tenés cuenta? <a href="#/ingresar">Ingresar</a></p>' +
      '</form>' +
    '</main>'
  );

  const formulario = document.getElementById('formulario');
  formulario.nombre.focus();
  formulario.addEventListener('submit', async function (evento) {
    evento.preventDefault();
    const nombre = formulario.nombre.value.trim();
    const usuario = formulario.usuario.value.trim().toLowerCase();
    const clave = formulario.clave.value;

    if (nombre.length < 2) return mostrarMensaje('mensaje', 'Escribí tu nombre y apellido.', 'error');
    if (!/^[a-z0-9._-]{3,30}$/.test(usuario)) {
      return mostrarMensaje('mensaje', 'El usuario debe tener entre 3 y 30 caracteres, sin espacios ni acentos.', 'error');
    }
    if (clave.length < 6) return mostrarMensaje('mensaje', 'La contraseña debe tener al menos 6 caracteres.', 'error');
    if (clave !== formulario.clave2.value) return mostrarMensaje('mensaje', 'Las contraseñas no coinciden.', 'error');

    const boton = document.getElementById('boton');
    ocupado(boton, true, 'Creando cuenta…');
    mostrarMensaje('mensaje', '');
    try {
      const resultado = await llamar('registrar', { nombre: nombre, usuario: usuario, clave: clave });
      if (resultado.estado === 'activo') {
        // Es el dueño (primera cuenta): entra directamente
        const datos = await llamar('ingresar', { usuario: usuario, clave: clave });
        Sesion.guardar({ token: datos.token, usuario: datos.usuario, sinConexion: false });
        await AccesoLocal.guardar(usuario, clave, datos.usuario, datos.token);
        avisoPendiente = { texto: resultado.mensaje };
        ir('inicio');
      } else {
        avisoPendiente = { texto: resultado.mensaje };
        ir('ingresar');
      }
    } catch (e) {
      mostrarMensaje('mensaje', e.message, 'error');
      ocupado(boton, false);
    }
  });
};
