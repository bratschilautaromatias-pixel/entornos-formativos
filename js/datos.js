/**
 * DATOS EN EL EQUIPO Y SINCRONIZACIÓN
 * Todo lo que se carga se guarda primero en este equipo (IndexedDB), así funciona sin internet.
 * Cada registro guardado queda "pendiente" hasta que el Sincronizador lo manda al servidor.
 * El Sincronizador también baja lo que cargaron los demás.
 */
const BaseLocal = (function () {
  let conexion = null;

  function abrir() {
    if (!conexion) {
      conexion = new Promise(function (resolver, rechazar) {
        const pedido = indexedDB.open('entornos-formativos', 2);
        pedido.onupgradeneeded = function () {
          // Crea lo que falte (sirve tanto para equipos nuevos como para reparar uno incompleto)
          const db = pedido.result;
          if (!db.objectStoreNames.contains('registros')) {
            db.createObjectStore('registros', { keyPath: 'clave' }).createIndex('tabla', 'tabla');
          }
          if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'clave' });
        };
        pedido.onsuccess = function () { resolver(pedido.result); };
        pedido.onerror = function () { rechazar(pedido.error); };
      });
    }
    return conexion;
  }

  /** Ejecuta fn(almacen) dentro de una transacción y devuelve lo que fn haya pedido. */
  async function transaccion(nombreAlmacen, modo, fn) {
    const db = await abrir();
    return new Promise(function (resolver, rechazar) {
      const tx = db.transaction(nombreAlmacen, modo);
      const pedido = fn(tx.objectStore(nombreAlmacen));
      tx.oncomplete = function () { resolver(pedido ? pedido.result : undefined); };
      tx.onerror = function () { rechazar(tx.error); };
      tx.onabort = function () { rechazar(tx.error); };
    });
  }

  return {
    leerTabla: function (tabla) {
      return transaccion('registros', 'readonly', function (almacen) {
        return almacen.index('tabla').getAll(tabla);
      });
    },
    leerTodos: function () {
      return transaccion('registros', 'readonly', function (almacen) { return almacen.getAll(); });
    },
    leer: function (tabla, id) {
      return transaccion('registros', 'readonly', function (almacen) { return almacen.get(tabla + '|' + id); });
    },
    escribir: function (elementos) {
      return transaccion('registros', 'readwrite', function (almacen) {
        elementos.forEach(function (e) { almacen.put(e); });
      });
    },
    /** Saca registros del equipo (solo para reparar registros que el servidor nunca aceptó). */
    borrar: function (claves) {
      return transaccion('registros', 'readwrite', function (almacen) {
        claves.forEach(function (c) { almacen.delete(c); });
      });
    },
    leerMeta: async function (clave) {
      const fila = await transaccion('meta', 'readonly', function (almacen) { return almacen.get(clave); });
      return fila ? fila.valor : null;
    },
    escribirMeta: function (clave, valor) {
      return transaccion('meta', 'readwrite', function (almacen) { almacen.put({ clave: clave, valor: valor }); });
    }
  };
})();

const Datos = {
  /** Registros de una tabla que no están eliminados. */
  listar: async function (tabla) {
    const filas = await BaseLocal.leerTabla(tabla);
    return filas
      .map(function (f) { return f.datos; })
      .filter(function (d) { return d.eliminado !== 'true'; });
  },

  /** Registros eliminados de una tabla (la papelera). */
  listarEliminados: async function (tabla) {
    const filas = await BaseLocal.leerTabla(tabla);
    return filas
      .map(function (f) { return f.datos; })
      .filter(function (d) { return d.eliminado === 'true'; });
  },

  obtener: async function (tabla, id) {
    const fila = await BaseLocal.leer(tabla, id);
    return fila ? fila.datos : null;
  },

  /** Crea o modifica un registro. Devuelve el registro guardado. */
  guardar: async function (tabla, cambios) {
    if (!puedeEditar()) throw new Error('Tu usuario es solo visor: no puede guardar cambios.');
    const sesion = Sesion.leer();
    const ahora = new Date().toISOString();
    const anterior = cambios.id ? await Datos.obtener(tabla, cambios.id) : null;
    const registro = Object.assign({}, anterior || {}, cambios);
    if (!registro.id) registro.id = crypto.randomUUID ? crypto.randomUUID() : idAlAzar();
    if (!anterior) {
      registro.creadoPor = sesion.usuario.usuario;
      registro.creadoEn = ahora;
      if (registro.eliminado === undefined) registro.eliminado = 'false';
    }
    registro.modificadoPor = sesion.usuario.usuario;
    registro.modificadoEn = ahora;

    await BaseLocal.escribir([{ clave: tabla + '|' + registro.id, tabla: tabla, datos: registro, pendiente: 1 }]);
    avisarCambioDeDatos();
    Sincronizador.programar();
    return registro;
  },

  eliminar: function (tabla, id) {
    return Datos.guardar(tabla, { id: id, eliminado: 'true' });
  },

  /** Valores activos de una lista (Entorno, Curso, EstadoTarea), en orden. */
  lista: async function (tipo) {
    const filas = (await Datos.listar('Listas'))
      .filter(function (f) { return f.tipo === tipo && f.activo !== 'false'; })
      .sort(function (a, b) { return Number(a.orden) - Number(b.orden); })
      .map(function (f) { return f.valor; });
    return filas.length ? filas : (LISTAS_POR_DEFECTO[tipo] || []);
  }
};

/* Por si todavía no se bajaron las listas del servidor */
const LISTAS_POR_DEFECTO = {
  Entorno: ['Huerta', 'Forrajes', 'Taller rural', 'Maquinaria'],
  Curso: ['1°', '2°', '3°', '4°', '5°', '6°', '7°', 'Todos'],
  EstadoTarea: ['Pendiente', 'Realizada', 'Incompleta']
};

function idAlAzar() {
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, function (x) { return x.toString(16).padStart(2, '0'); }).join('');
  return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
}

function avisarCambioDeDatos() {
  window.dispatchEvent(new CustomEvent('ef-datos'));
}

const Sincronizador = {
  estado: 'ok',       // ok | pendiente | sincronizando | sin-red | error
  pendientes: 0,
  mensajeError: '',
  enCurso: null,
  repetir: false,
  temporizador: null,

  iniciar: function () {
    window.addEventListener('online', function () { Sincronizador.sincronizar(); });
    window.addEventListener('offline', function () { Sincronizador.actualizarEstado(); });
    setInterval(function () { Sincronizador.sincronizar(); }, 2 * 60 * 1000);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') Sincronizador.sincronizar();
    });
  },

  /** Sincroniza en un ratito (junta varios cambios seguidos en un solo envío). */
  programar: function () {
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(function () { Sincronizador.sincronizar(); }, 1500);
    if (!this.enCurso) this.actualizarEstado();
  },

  sincronizar: function () {
    if (!Sesion.leer()) return Promise.resolve();
    if (this.enCurso) {
      this.repetir = true; // hubo cambios mientras sincronizaba: otra vuelta al terminar
      return this.enCurso;
    }
    this.repetir = false;
    this.enCurso = this.ejecutar().finally(function () {
      Sincronizador.enCurso = null;
      if (Sincronizador.repetir) Sincronizador.sincronizar();
    });
    return this.enCurso;
  },

  ejecutar: async function () {
    if (!navigator.onLine) return this.actualizarEstado();

    // Listas tomadas con la versión anterior: tenían un id que el servidor no aceptaba
    if (typeof repararAsistenciasViejas === 'function') await repararAsistenciasViejas();

    const pendientes = (await BaseLocal.leerTodos()).filter(function (f) { return f.pendiente; });
    this.estado = 'sincronizando';
    this.notificar();

    try {
      const desde = await BaseLocal.leerMeta('ultimaSincronizacion');
      const respuesta = await llamar('sincronizar', {
        desde: desde || '',
        cambios: pendientes.map(function (f) { return { tabla: f.tabla, registro: f.datos }; })
      });

      // Lo enviado ya no está pendiente (salvo que se haya vuelto a modificar mientras tanto,
      // o que el servidor lo haya rechazado: en ese caso queda guardado en el equipo y se avisa)
      const rechazados = respuesta.rechazados || [];
      const enviados = {};
      pendientes.forEach(function (f) {
        if (rechazados.indexOf(f.clave) === -1) enviados[f.clave] = f.datos.modificadoEn;
      });

      const locales = {};
      (await BaseLocal.leerTodos()).forEach(function (f) { locales[f.clave] = f; });

      const aEscribir = [];
      Object.keys(locales).forEach(function (clave) {
        const local = locales[clave];
        if (local.pendiente && enviados[clave] === local.datos.modificadoEn) {
          local.pendiente = 0;
          aEscribir.push(local);
        }
      });

      // Lo que llegó del servidor reemplaza a lo local, salvo cambios locales más nuevos aún no enviados
      Object.keys(respuesta.registros || {}).forEach(function (tabla) {
        respuesta.registros[tabla].forEach(function (remoto) {
          const clave = tabla + '|' + remoto.id;
          const local = locales[clave];
          if (local && local.pendiente && local.datos.modificadoEn > remoto.modificadoEn) return;
          aEscribir.push({ clave: clave, tabla: tabla, datos: remoto, pendiente: 0 });
        });
      });

      await BaseLocal.escribir(aEscribir);
      if (respuesta.config) await BaseLocal.escribirMeta('config', respuesta.config);

      // Si el servidor tiene tablas que este equipo no conocía (por ejemplo, se agregó Economía),
      // hay que bajarlas completas: se vuelve a sincronizar todo desde cero una vez.
      const tablasServidor = Object.keys(respuesta.registros || {});
      const conocidas = await BaseLocal.leerMeta('tablasConocidas');
      const hayNuevas = desde && (!conocidas || tablasServidor.some(function (t) { return conocidas.indexOf(t) === -1; }));
      await BaseLocal.escribirMeta('tablasConocidas', tablasServidor);
      await BaseLocal.escribirMeta('ultimaSincronizacion', hayNuevas ? '' : respuesta.servidorEn);
      if (hayNuevas) this.repetir = true;
      this.mensajeError = rechazados.length
        ? 'El servidor no aceptó ' + rechazados.length + ' registro' + (rechazados.length === 1 ? '' : 's') + '. Quedan guardados en este equipo; avisá para revisarlo.'
        : '';
      if (aEscribir.length) avisarCambioDeDatos();
    } catch (e) {
      if (e.codigo === 'SESION') {
        cerrarSesion(e.message + ' Tus cambios quedan guardados en este equipo.');
      } else if (e.codigo !== 'RED') {
        this.mensajeError = e.message;
      }
    }
    await this.actualizarEstado();
  },

  actualizarEstado: async function () {
    const todos = await BaseLocal.leerTodos();
    this.pendientes = todos.filter(function (f) { return f.pendiente; }).length;
    if (!navigator.onLine) this.estado = 'sin-red';
    else if (this.mensajeError) this.estado = 'error';
    else this.estado = this.pendientes ? 'pendiente' : 'ok';
    this.notificar();
  },

  notificar: function () {
    window.dispatchEvent(new CustomEvent('ef-sync'));
  }
};
