/**
 * CONEXIÓN CON EL SERVIDOR (Apps Script) Y SESIÓN DEL USUARIO
 */
const SERVIDOR = 'https://script.google.com/macros/s/AKfycbxIg5K975zPHK1SN5YO2FufA_quqVqD6jzO8etDK49NeqjJNKyQSc5zTPH-fgVBaLec/exec';

/* La sesión abierta en este equipo: { token, usuario: {id, usuario, nombre, rol}, sinConexion } */
const Sesion = {
  leer() {
    try { return JSON.parse(localStorage.getItem('ef_sesion')); } catch (e) { return null; }
  },
  guardar(sesion) {
    try { localStorage.setItem('ef_sesion', JSON.stringify(sesion)); } catch (e) { /* almacenamiento bloqueado */ }
  },
  borrar() {
    try { localStorage.removeItem('ef_sesion'); } catch (e) { /* nada */ }
  }
};

/**
 * Le pide algo al servidor. Ejemplo: await llamar('ingresar', { usuario, clave })
 * Si falla, lanza un error con .codigo = 'RED' (sin internet) o 'SESION' (hay que volver a ingresar).
 */
async function llamar(accion, datos) {
  const pedido = Object.assign({ accion: accion }, datos || {});
  const sesion = Sesion.leer();
  if (sesion && sesion.token && !pedido.token) pedido.token = sesion.token;

  let json;
  try {
    const respuesta = await fetch(SERVIDOR, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(pedido)
    });
    json = await respuesta.json();
  } catch (e) {
    const error = new Error('No hay conexión con el servidor. Revisá tu internet.');
    error.codigo = 'RED';
    throw error;
  }
  if (!json.ok) {
    const error = new Error(json.error || 'Error desconocido');
    error.codigo = json.codigo || '';
    throw error;
  }
  return json.datos;
}

/**
 * INGRESO SIN CONEXIÓN
 * Cuando alguien entra con internet, se guarda en este equipo un "verificador"
 * de su contraseña (no la contraseña). Así, sin internet, se puede comprobar
 * que la escribió bien y dejarlo entrar con los datos que ya tiene el equipo.
 */
const AccesoLocal = {
  leerTodos() {
    try { return JSON.parse(localStorage.getItem('ef_acceso_local')) || {}; } catch (e) { return {}; }
  },
  async guardar(usuario, clave, datosUsuario, token) {
    const todos = this.leerTodos();
    const sal = crypto.getRandomValues(new Uint32Array(4)).join('-');
    todos[usuario] = { sal: sal, verificador: await verificadorClave(clave, sal), usuario: datosUsuario, token: token };
    try { localStorage.setItem('ef_acceso_local', JSON.stringify(todos)); } catch (e) { /* nada */ }
  },
  async comprobar(usuario, clave) {
    const guardado = this.leerTodos()[usuario];
    if (!guardado) return null;
    const verificador = await verificadorClave(clave, guardado.sal);
    return verificador === guardado.verificador ? guardado : null;
  },
  olvidar(usuario) {
    const todos = this.leerTodos();
    delete todos[usuario];
    try { localStorage.setItem('ef_acceso_local', JSON.stringify(todos)); } catch (e) { /* nada */ }
  }
};

async function verificadorClave(clave, sal) {
  const codificador = new TextEncoder();
  const material = await crypto.subtle.importKey('raw', codificador.encode(clave), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: codificador.encode(sal), iterations: 100000, hash: 'SHA-256' },
    material,
    256
  );
  return btoa(String.fromCharCode.apply(null, new Uint8Array(bits)));
}
