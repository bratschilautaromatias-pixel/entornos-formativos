/**
 * PANTALLA DE INICIO: ENTORNOS FORMATIVOS
 */
const ENTORNOS = [
  { clave: 'huerta', nombre: 'Huerta', icono: '🥬', detalle: 'Parcelas, siembras, riego y cosechas', activo: true },
  { clave: 'forrajes', nombre: 'Forrajes', icono: '🌾', detalle: 'Pasturas, reservas y raciones', activo: true },
  { clave: 'taller', nombre: 'Taller rural', icono: '🔧', detalle: 'Próximamente', activo: false },
  { clave: 'maquinaria', nombre: 'Maquinaria', icono: '🚜', detalle: 'Próximamente', activo: false }
];

PANTALLAS.inicio = function () {
  const sesion = Sesion.leer();

  const cuadros = ENTORNOS.map(function (e) {
    return '<button class="cuadro' + (e.activo ? '' : ' inactivo') + '"' +
      (e.activo ? ' onclick="ir(\'entorno/' + e.clave + '\')"' : ' disabled') + '>' +
      '<span class="icono">' + e.icono + '</span>' +
      '<span class="nombre">' + esc(e.nombre) + '</span>' +
      '<span class="detalle">' + esc(e.detalle) + '</span>' +
    '</button>';
  }).join('');

  render(
    htmlBarra('Entornos Formativos') +
    '<main class="contenido">' +
      htmlAviso() +
      '<h1>ENTORNOS FORMATIVOS</h1>' +
      '<p class="saludo">Hola, ' + esc(sesion.usuario.nombre) + '</p>' +
      '<div class="grilla">' +
        cuadros +
        '<p class="seccion-titulo">Para todos los entornos</p>' +
        '<button class="cuadro ancho" onclick="ir(\'tareas\')">' +
          '<span class="icono">📋</span>' +
          '<span><span class="nombre">Tareas de la semana</span>' +
          '<span class="detalle">Lo que hay que hacer de lunes a viernes, por entorno y curso</span></span>' +
        '</button>' +
        (esDueno()
          ? '<button class="cuadro ancho" onclick="ir(\'usuarios\')">' +
              '<span class="icono">👥</span>' +
              '<span><span class="nombre">Usuarios <span class="insignia" id="pendientes" hidden></span></span>' +
              '<span class="detalle">Aprobar cuentas nuevas y elegir quién es editor o visor</span></span>' +
            '</button>'
          : '') +
      '</div>' +
    '</main>'
  );

  if (esDueno()) contarPendientes();
};

/** Muestra en el cuadro Usuarios cuántas cuentas esperan aprobación. */
async function contarPendientes() {
  try {
    const usuarios = await llamar('listarUsuarios');
    const cantidad = usuarios.filter(function (u) { return u.estado === 'pendiente'; }).length;
    const insignia = document.getElementById('pendientes');
    if (insignia && cantidad) {
      insignia.textContent = cantidad === 1 ? '1 nueva' : cantidad + ' nuevas';
      insignia.hidden = false;
    }
  } catch (e) {
    // sin conexión o sesión vencida: no se muestra el número
  }
}

/** Datos del entorno a partir de su clave ("huerta" → { nombre: 'Huerta', ... }). */
function entornoPorClave(clave) {
  return ENTORNOS.find(function (e) { return e.clave === clave && e.activo; }) || null;
}

/* Pantalla genérica para las secciones que se construyen en las próximas etapas */
function pantallaEnConstruccion(titulo, icono, volverA) {
  render(
    htmlBarra(titulo, volverA || 'inicio') +
    '<main class="contenido">' +
      '<div class="vacio">' +
        '<div class="icono">' + icono + '</div>' +
        '<h2>' + esc(titulo) + '</h2>' +
        '<p>Esta sección se construye en las próximas etapas.</p>' +
      '</div>' +
    '</main>'
  );
}
