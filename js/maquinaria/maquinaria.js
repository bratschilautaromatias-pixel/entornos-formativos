/**
 * MAQUINARIA: máquinas, plan de servicios, registro de uso con chequeo diario e historial de servicios.
 * Igual que la planilla Mantenimiento_Hanomag_Stark_AG2, pero para todas las máquinas.
 * Ninguna máquina tiene cuentahoras: las horas actuales = horas iniciales + horas trabajadas en cada uso.
 * Direcciones: #/maquinaria · #/maquinaria/maquina/<id> · #/maquinaria/usos · #/maquinaria/servicios
 */
const MAQUINARIA = {
  tipos: ['Tractor', 'Motocultor', 'Implemento', 'Herramienta a motor', 'Otra'],
  combustibles: ['Gasoil', 'Nafta', 'Sin motor'],
  iconos: { 'Tractor': '🚜', 'Motocultor': '🚜', 'Implemento': '⚙', 'Herramienta a motor': '⛏', 'Otra': '🔩' },
  // Avisos como la planilla: PRÓXIMO si faltan 20 h o 15 días o menos (en tareas cortas, un cuarto del intervalo)
  avisoHoras: 20,
  avisoDias: 15,
  chequeoPorTipo: {
    'Tractor': ['Aceite motor', 'Agua radiador', 'Gasoil', 'Filtro de aire', 'Neumáticos', 'Pérdidas', 'Correa', 'Frenos / embrague', 'Presión aceite y carga'],
    'Motocultor': ['Aceite motor', 'Combustible', 'Filtro de aire', 'Correas', 'Cuchillas / fresas', 'Neumáticos', 'Tornillería y pérdidas'],
    'Implemento': ['Estado general', 'Tornillería', 'Engrase', 'Cuchillas / piezas de desgaste'],
    'Herramienta a motor': ['Aceite / mezcla', 'Combustible', 'Filtro de aire', 'Elemento de corte', 'Protecciones'],
    'Otra': ['Estado general']
  }
};

/* ---------- Máquinas de la escuela, con su plan (de tu planilla y de las guías) ---------- */

const MAQUINAS_ESCUELA = [
  {
    id: 'maq-hanomag-stark-ag2', nombre: 'Tractor Hanomag Stark AG2', tipo: 'Tractor', marca: 'Hanomag', modelo: 'Stark AG 2', anio: '2017',
    motor: 'Hanomag KM385B, 3 cilindros, 1.532 cc, 25 HP (confirmar con chapa)', combustible: 'Gasoil',
    aceiteMotor: 'SAE 15W-40 API CH-4 o superior', filtros: 'Filtro de aceite FRAM PH4456',
    chequeo: ['Aceite motor', 'Agua radiador', 'Gasoil', 'Filtro de aire', 'Neumáticos', 'Pérdidas', 'Correa', 'Frenos / embrague', 'Presión aceite y carga'],
    notas: 'De la planilla Mantenimiento_Hanomag_Stark_AG2. Intervalos de referencia: confirmar con el concesionario (Casa Porcar).',
    plan: [
      ['Engrase (eje delantero, dirección, 3 puntos)', 10, 1, 'Grasa a alemite'],
      ['Limpieza prefiltro y vaso filtro de aire', 50, 1, 'Aceite de motor para el vaso'],
      ['Purga de agua del filtro de gasoil', 50, 1, ''],
      ['Tensión de correa y bornes de batería', 100, 3, ''],
      ['Nivel aceite caja / diferencial / hidráulico', 100, 3, ''],
      ['Cambio aceite de motor + filtro', 200, 12, '15W-40 CH-4 + FRAM PH4456'],
      ['Cambio filtro de gasoil', 200, 12, 'Purgar aire después'],
      ['Cambio filtro hidráulico', 400, 12, 'Cartucho azul'],
      ['Juego de válvulas', 500, 24, 'Taller'],
      ['Cambio aceite caja / diferencial / hidráulico', 800, 24, 'Confirmar especificación'],
      ['Cambio de líquido refrigerante', 2000, 12, 'Refrigerante con anticongelante'],
      ['Revisión inyectores / bomba inyectora', 1000, 36, 'Taller especializado']
    ]
  },
  {
    id: 'maq-massey-ferguson-165', nombre: 'Tractor Massey Ferguson 165', tipo: 'Tractor', marca: 'Massey Ferguson', modelo: '165', anio: '',
    motor: 'Perkins diésel 4 cilindros (confirmar con chapa)', combustible: 'Gasoil', aceiteMotor: 'SAE 15W-40 diésel (confirmar con el manual)', filtros: '',
    chequeo: ['Aceite motor', 'Agua radiador', 'Gasoil', 'Filtro de aire', 'Neumáticos', 'Pérdidas', 'Correa', 'Frenos / embrague', 'Presión aceite y carga'],
    notas: 'Plan de REFERENCIA para tractores diésel de esta época: confirmá cada intervalo con el manual del MF 165 y corregilo con ✎.',
    plan: [
      ['Engrase general (alemites)', 10, 1, 'Grasa a alemite'],
      ['Limpieza filtro de aire (baño de aceite)', 50, 1, 'Aceite de motor para el vaso'],
      ['Purga de agua del filtro de gasoil', 50, 1, ''],
      ['Tensión de correa y bornes de batería', 100, 3, ''],
      ['Nivel aceite caja / diferencial / hidráulico', 100, 3, ''],
      ['Cambio aceite de motor + filtro', 250, 12, ''],
      ['Cambio filtros de gasoil', 400, 12, 'Purgar aire después'],
      ['Juego de válvulas', 500, 24, 'Taller'],
      ['Cambio aceite caja / diferencial / hidráulico', 800, 24, 'Confirmar especificación'],
      ['Cambio de líquido refrigerante', 2000, 12, 'Refrigerante con anticongelante'],
      ['Revisión inyectores / bomba inyectora', 1000, 36, 'Taller especializado']
    ]
  },
  {
    id: 'maq-motocultor-changchai-zs1100', nombre: 'Motocultor Changchai ZS1100 (diésel)', tipo: 'Motocultor', marca: 'Dongfeng / Changchai', modelo: 'DF-12L o DF-15L (confirmar)', anio: '',
    motor: 'Changchai ZS1100, diésel 1 cilindro, 0,903 L, 16 CV a 2200 rpm, refrigerado por agua', combustible: 'Gasoil',
    aceiteMotor: 'SAE 15W-40 diésel API CF o superior', filtros: 'Filtro de aire en baño de aceite (mismo aceite de motor). Caja y rotocultivador: SAE 80W-90',
    chequeo: ['Aceite motor', 'Agua radiador', 'Gasoil', 'Aceite filtro de aire', 'Correas y protección', 'Cuchillas', 'Neumáticos', 'Bornes de batería', 'Tuercas y pérdidas'],
    notas: 'Del Manual del motocultor con rotocultivador – Motor Changchai ZS1100. En suelo muy polvoriento los intervalos se acortan a la mitad. Primer cambio de aceite a las 50 h (motor nuevo o reparado).',
    plan: [
      ['Lavado filtro de aire y cambio de su aceite', 50, 0, 'Aceite de motor'],
      ['Tensión de correas y engrase', 50, 0, ''],
      ['Nivel aceite de caja y rotocultivador', 50, 0, 'SAE 80W-90'],
      ['Cambio aceite de motor y colador', 100, 0, 'SAE 15W-40 (manual: 100–150 h)'],
      ['Limpieza filtro y tanque de gasoil', 100, 0, 'Purgar agua y sedimento'],
      ['Luz de válvulas (en frío)', 200, 0, ''],
      ['Revisión y cambio de cuchillas', 200, 0, ''],
      ['Cambio aceite de caja y rotocultivador', 500, 12, 'SAE 80W-90'],
      ['Cambio de agua del radiador', 0, 12, 'Agua limpia con anticongelante'],
      ['Control de inyector', 500, 12, 'Taller']
    ]
  },
  {
    id: 'maq-motocultor-shimaha', nombre: 'Motocultor Shimaha (nafta)', tipo: 'Motocultor', marca: 'Shimaha', modelo: 'Rotocultivador, motor GT212C', anio: '',
    motor: 'GT212C nafta 4 tiempos, arranque a cuerda', combustible: 'Nafta',
    aceiteMotor: 'SAE 10W-30 o 15W-40, unos 0,6 L', filtros: 'Caja: SAE 80W-90. Bujía: luz 0,7–0,8 mm',
    chequeo: ['Aceite motor', 'Nafta limpia', 'Filtro de aire', 'Tornillería', 'Cables y palancas', 'Fresas'],
    notas: 'De la Guía de uso y mantenimiento del motocultor Shimaha (valores típicos: confirmar con el manual). Primer cambio de aceite entre las 5 y 10 h. Service: Taller dos Tiempos (11 7604-1264 / 11 3351-8143).',
    plan: [
      ['Limpiar el filtro de aire', 25, 0, 'Más seguido con polvo'],
      ['Revisar la bujía', 25, 0, ''],
      ['Engrasar puntos móviles', 25, 0, ''],
      ['Cambiar aceite del motor', 50, 0, 'SAE 10W-30 o 15W-40, ~0,6 L'],
      ['Revisar aceite de la caja', 50, 0, 'SAE 80W-90'],
      ['Revisar estado y filo de las fresas', 50, 0, ''],
      ['Cambiar la bujía', 100, 12, 'Luz 0,7–0,8 mm'],
      ['Revisar juego de válvulas', 100, 12, ''],
      ['Cambiar aceite de la caja', 100, 12, 'SAE 80W-90'],
      ['Limpiar tanque y filtro de nafta', 100, 12, '']
    ]
  }
];

/** Carga las 4 máquinas con su plan. Ids fijos: si se toca dos veces (o en dos equipos), no se duplica. */
async function cargarMaquinasEscuela() {
  if (!confirm('Se cargan el Hanomag, el Massey Ferguson 165 y los dos motocultores, cada uno con su plan de servicios. ¿Seguir?')) return;
  for (const m of MAQUINAS_ESCUELA) {
    if (!(await Datos.obtener('Maquinas', m.id))) {
      await Datos.guardar('Maquinas', {
        id: m.id, nombre: m.nombre, tipo: m.tipo, marca: m.marca, modelo: m.modelo, anio: m.anio, motor: m.motor, combustible: m.combustible,
        horasIniciales: '0', aceiteMotor: m.aceiteMotor, filtros: m.filtros, chequeo: m.chequeo.join('\n'), activa: 'true', notas: m.notas
      });
    }
    for (let i = 0; i < m.plan.length; i++) {
      const id = m.id.replace('maq-', 'plan-') + '-' + String(i + 1).padStart(2, '0');
      if (await Datos.obtener('PlanServicios', id)) continue;
      const p = m.plan[i];
      await Datos.guardar('PlanServicios', {
        id: id, maquinaId: m.id, tarea: p[0], cadaHoras: p[1] ? String(p[1]) : '', cadaMeses: p[2] ? String(p[2]) : '',
        insumo: p[3], orden: String(i + 1), ultimoHoras: '', ultimaFecha: '', activo: 'true', notas: ''
      });
    }
  }
}

/* ---------- Datos y cálculos ---------- */

async function cargarMaquinaria() {
  const nombres = ['Maquinas', 'PlanServicios', 'UsosMaquina', 'ServiciosMaquina', 'Fotos'];
  const [listas, cursos] = await Promise.all([Promise.all(nombres.map(function (t) { return Datos.listar(t); })), Datos.listar('Cursos')]);
  // { cursoId: "2° 2° grupo B" } para mostrar en los usos
  const q = { cursos: {} };
  cursos.forEach(function (c) { q.cursos[c.id] = nombreCurso(c); });
  nombres.forEach(function (t, i) {
    const clave = t.charAt(0).toLowerCase() + t.slice(1);
    q[clave] = listas[i];
    const porId = {};
    listas[i].forEach(function (r) { porId[r.id] = r; });
    q[clave + 'PorId'] = porId;
  });
  q.maquinas.sort(function (a, b) {
    return MAQUINARIA.tipos.indexOf(a.tipo) - MAQUINARIA.tipos.indexOf(b.tipo) || String(a.nombre).localeCompare(String(b.nombre));
  });
  q.usosMaquina.sort(function (a, b) { return b.fecha.localeCompare(a.fecha) || String(b.creadoEn).localeCompare(String(a.creadoEn)); });
  q.serviciosMaquina.sort(function (a, b) { return b.fecha.localeCompare(a.fecha) || String(b.creadoEn).localeCompare(String(a.creadoEn)); });
  return q;
}

function nombreMaquina(q, id) {
  const m = q.maquinasPorId[id];
  return m ? m.nombre : '(máquina eliminada)';
}

/** Horas actuales: las que tenía al empezar + todas las horas trabajadas (hasta una fecha, si se pide). */
function horasMaquina(q, maquinaId, hastaFecha) {
  const m = q.maquinasPorId[maquinaId];
  const iniciales = m ? Number(m.horasIniciales) || 0 : 0;
  return iniciales + q.usosMaquina.filter(function (u) {
    return u.maquinaId === maquinaId && (!hastaFecha || u.fecha <= hastaFecha);
  }).reduce(function (t, u) { return t + (Number(u.horas) || 0); }, 0);
}

function sumarMeses(fecha, meses) {
  const d = textoAFecha(fecha);
  const dia = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + meses);
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(dia, ultimo));
  return fechaATexto(d);
}

function horasTexto(h) {
  return numero(Math.round((Number(h) || 0) * 10) / 10) + ' h';
}

function itemsChequeo(m) {
  const lista = String(m && m.chequeo || '').split(/\r?\n/).map(function (x) { return x.replace(/,/g, ' -').trim(); }).filter(Boolean);
  return lista.length ? lista : (MAQUINARIA.chequeoPorTipo[m && m.tipo] || MAQUINARIA.chequeoPorTipo.Otra);
}

/**
 * Estado de una tarea del plan: último servicio (el más nuevo entre lo registrado en la app y el dato inicial),
 * próximo por horas y por fecha, cuánto falta, y OK / PRÓXIMO / VENCIDO / SIN DATO.
 */
function estadoPlan(q, p) {
  const actuales = horasMaquina(q, p.maquinaId);
  const hechos = q.serviciosMaquina.filter(function (s) { return s.planId === p.id; });
  let ultimo = null;
  hechos.forEach(function (s) { if (!ultimo || s.fecha > ultimo.fecha) ultimo = { fecha: s.fecha, horas: Number(s.horas) || 0 }; });
  if (p.ultimaFecha && (!ultimo || p.ultimaFecha > ultimo.fecha)) ultimo = { fecha: p.ultimaFecha, horas: Number(p.ultimoHoras) || 0 };
  const cadaHoras = Number(p.cadaHoras) || 0;
  const cadaMeses = Number(p.cadaMeses) || 0;
  const e = { plan: p, actuales: actuales, ultimo: ultimo, proximoHoras: null, proximaFecha: null, faltanHoras: null, faltanDias: null, estado: 'SIN DATO' };
  if (!ultimo) return e;
  if (cadaHoras) {
    e.proximoHoras = ultimo.horas + cadaHoras;
    e.faltanHoras = e.proximoHoras - actuales;
  }
  if (cadaMeses) {
    e.proximaFecha = sumarMeses(ultimo.fecha, cadaMeses);
    e.faltanDias = diasEntre(hoyTexto(), e.proximaFecha);
  }
  const avisoHoras = Math.min(MAQUINARIA.avisoHoras, cadaHoras / 4);
  if ((e.faltanHoras !== null && e.faltanHoras <= 0) || (e.faltanDias !== null && e.faltanDias < 0)) e.estado = 'VENCIDO';
  else if ((e.faltanHoras !== null && e.faltanHoras <= avisoHoras) || (e.faltanDias !== null && e.faltanDias <= MAQUINARIA.avisoDias)) e.estado = 'PRÓXIMO';
  else e.estado = 'OK';
  return e;
}

function planDeMaquina(q, maquinaId) {
  return q.planServicios.filter(function (p) { return p.maquinaId === maquinaId && p.activo !== 'false'; })
    .sort(function (a, b) { return (Number(a.orden) || 999) - (Number(b.orden) || 999) || String(a.tarea).localeCompare(String(b.tarea)); })
    .map(function (p) { return estadoPlan(q, p); });
}

/** Resumen de alertas de una máquina (o de todas). */
function alertasMaquinaria(q, maquinaId) {
  const r = { vencidos: [], proximos: [], sinDato: 0 };
  q.maquinas.filter(function (m) { return m.activa !== 'false' && (!maquinaId || m.id === maquinaId); }).forEach(function (m) {
    planDeMaquina(q, m.id).forEach(function (e) {
      if (e.estado === 'VENCIDO') r.vencidos.push(e);
      else if (e.estado === 'PRÓXIMO') r.proximos.push(e);
      else if (e.estado === 'SIN DATO') r.sinDato++;
    });
  });
  return r;
}

function textoFaltan(e) {
  const partes = [];
  if (e.faltanHoras !== null) partes.push(e.faltanHoras <= 0 ? 'pasada por ' + horasTexto(-e.faltanHoras) : 'faltan ' + horasTexto(e.faltanHoras));
  if (e.faltanDias !== null) partes.push(e.faltanDias < 0 ? 'vencida hace ' + cantidadDias(-e.faltanDias) : 'faltan ' + cantidadDias(e.faltanDias));
  return partes.join(' · ');
}

function cantidadDias(n) {
  return n + (n === 1 ? ' día' : ' días');
}

function claseEstadoPlan(estado) {
  return { 'OK': 'ok', 'PRÓXIMO': 'proximo', 'VENCIDO': 'vencido' }[estado] || 'sin-dato';
}

/** Cuadro del inicio: cuántos servicios vencidos hay. */
async function contarServiciosVencidos() {
  const insignia = document.getElementById('insignia-maquinaria');
  if (!insignia) return;
  const a = alertasMaquinaria(await cargarMaquinaria());
  if (a.vencidos.length) {
    insignia.textContent = a.vencidos.length === 1 ? '1 servicio vencido' : a.vencidos.length + ' servicios vencidos';
    insignia.hidden = false;
  }
}

/* ---------- Pantallas ---------- */

PANTALLAS.maquinaria = function (parametro) {
  const partes = String(parametro || '').split('/');
  if (partes[0] === 'maquina' && partes[1]) return pantallaFichaMaquina(partes[1]);
  if (partes[0] === 'usos') return pantallaUsosMaquinaria();
  if (partes[0] === 'servicios') return pantallaServiciosMaquinaria();
  pantallaMenuMaquinaria();
};

/** Desde "Producción" de Maquinaria se va a su menú. */
const produccionSinMaquinaria = PANTALLAS.produccion;
PANTALLAS.produccion = function (clave) {
  if (clave === 'maquinaria') return ir('maquinaria');
  return produccionSinMaquinaria(clave);
};

function marcoMaquinaria(titulo, volverA, dibujar) {
  render(htmlBarra(titulo, volverA) + '<main class="contenido" id="contenido-maquinaria"><p class="vacio">Cargando…</p></main>');
  const redibujar = async function () {
    if (!document.getElementById('contenido-maquinaria')) return;
    const q = await cargarMaquinaria();
    const lugar = document.getElementById('contenido-maquinaria');
    if (!lugar) return;
    lugar.innerHTML = await dibujar(q);
    pintarFotosEnPantalla(lugar);
  };
  alActualizarDatos = redibujar;
  redibujar();
}

function htmlAlertaPlan(q, e, conMaquina) {
  return '<div class="alerta-servicio ' + claseEstadoPlan(e.estado) + '">' +
    '<div><strong>' + (conMaquina ? esc(nombreMaquina(q, e.plan.maquinaId)) + ': ' : '') + esc(e.plan.tarea) + '</strong>' +
      '<span class="ayuda">' + esc(e.estado) + ' · ' + esc(textoFaltan(e)) + '</span></div>' +
    (puedeEditar() ? '<button class="boton chico" onclick="formularioServicio(\'' + esc(e.plan.maquinaId) + '\', null, \'' + esc(e.plan.id) + '\')">✓ Hecho</button>' : '') +
  '</div>';
}

function pantallaMenuMaquinaria() {
  marcoMaquinaria('Máquinas y mantenimiento', 'entorno/maquinaria', function (q) {
    const editar = puedeEditar();
    const activas = q.maquinas.filter(function (m) { return m.activa !== 'false'; });
    const alertas = alertasMaquinaria(q);
    const mes = hoyTexto().slice(0, 7);
    const horasMes = q.usosMaquina.filter(function (u) { return u.fecha.slice(0, 7) === mes; }).reduce(function (t, u) { return t + (Number(u.horas) || 0); }, 0);
    let html = '<h1>🚜 MÁQUINAS Y MANTENIMIENTO</h1>' +
      '<div class="resumen">' +
        '<div><b>' + activas.length + '</b><span>Máquinas</span></div>' +
        '<div class="mal"><b>' + alertas.vencidos.length + '</b><span>Servicios vencidos</span></div>' +
        '<div><b>' + alertas.proximos.length + '</b><span>Próximos</span></div>' +
        '<div class="ok"><b>' + numero(horasMes) + '</b><span>Horas de uso este mes</span></div>' +
      '</div>';

    if (!q.maquinas.length) {
      return html + '<p class="vacio">Todavía no hay máquinas cargadas.</p>' +
        (editar ? '<button class="boton" onclick="cargarMaquinasEscuela()">🚜 Cargar las máquinas de la escuela (Hanomag, MF 165 y los dos motocultores)</button>' +
          '<button class="boton secundario" style="margin-top:8px" onclick="formularioMaquina()">+ Cargar otra máquina</button>' : '');
    }

    if (editar) {
      html += '<div class="acciones-curso">' +
        '<button class="boton chico" onclick="elegirMaquinaPara(\'uso\')">+ Registrar uso</button>' +
        '<button class="boton chico secundario" onclick="elegirMaquinaPara(\'servicio\')">+ Servicio o reparación</button>' +
        '<button class="boton chico secundario" onclick="formularioMaquina()">+ Máquina</button></div>';
    }
    if (alertas.vencidos.length || alertas.proximos.length) {
      html += '<section class="bloque-curso"><h2 class="grupo-titulo">Para hacer</h2>' +
        alertas.vencidos.concat(alertas.proximos).map(function (e) { return htmlAlertaPlan(q, e, true); }).join('') + '</section>';
    }
    if (alertas.sinDato) {
      html += '<p class="aviso-lista">ℹ Hay ' + alertas.sinDato + ' tareas del plan sin dato del último servicio. Entrá a cada máquina y cargá cuándo se hizo por última vez (o registralo al hacerlo): desde ahí la app empieza a avisar.</p>';
    }

    html += '<section class="bloque-curso"><h2 class="grupo-titulo">Máquinas</h2><div class="lista-cursos">' +
      q.maquinas.map(function (m) {
        const a = alertasMaquinaria(q, m.id);
        const ultimoUso = q.usosMaquina.find(function (u) { return u.maquinaId === m.id; });
        return '<button class="tarjeta-curso' + (m.activa === 'false' ? ' baja' : '') + '" onclick="ir(\'maquinaria/maquina/' + esc(m.id) + '\')">' +
          '<span class="tarjeta-curso-nombre">' + (MAQUINARIA.iconos[m.tipo] || '🔩') + '</span>' +
          '<span class="tarjeta-curso-datos"><span><b>' + esc(m.nombre) + '</b>' + (m.activa === 'false' ? ' (fuera de uso)' : '') + '</span>' +
            '<span class="ayuda">' + horasTexto(horasMaquina(q, m.id)) + ' de uso' + (ultimoUso ? ' · último uso ' + formatearFecha(ultimoUso.fecha) : '') + '</span>' +
            (a.vencidos.length ? '<span class="estado-plan vencido">' + a.vencidos.length + ' vencido' + (a.vencidos.length === 1 ? '' : 's') + '</span>'
              : a.proximos.length ? '<span class="estado-plan proximo">' + a.proximos.length + ' próximo' + (a.proximos.length === 1 ? '' : 's') + '</span>'
              : '<span class="estado-plan ok">Al día</span>') +
          '</span></button>';
      }).join('') + '</div></section>' +
      '<div class="grilla grilla-secciones">' +
        '<button class="cuadro" onclick="ir(\'maquinaria/usos\')"><span class="icono">📒</span><span class="nombre">Registro de uso</span><span class="detalle">Todos los usos con su chequeo diario</span></button>' +
        '<button class="cuadro" onclick="ir(\'maquinaria/servicios\')"><span class="icono">🔧</span><span class="nombre">Servicios y reparaciones</span><span class="detalle">Historial con repuestos y costos</span></button>' +
      '</div>';
    return html;
  });
}

function pantallaFichaMaquina(id) {
  marcoMaquinaria('Máquina', 'maquinaria', function (q) {
    const m = q.maquinasPorId[id];
    if (!m) return '<p class="vacio">No se encontró la máquina.</p>';
    const editar = puedeEditar();
    const plan = planDeMaquina(q, id);
    const usos = q.usosMaquina.filter(function (u) { return u.maquinaId === id; });
    const servicios = q.serviciosMaquina.filter(function (s) { return s.maquinaId === id; });
    const costo = servicios.reduce(function (t, s) { return t + (Number(s.costo) || 0); }, 0);

    let html = '<h1>' + (MAQUINARIA.iconos[m.tipo] || '🔩') + ' ' + esc(m.nombre) + '</h1>' +
      '<div class="resumen">' +
        '<div><b>' + horasTexto(horasMaquina(q, id)) + '</b><span>Horas de uso</span></div>' +
        '<div><b>' + usos.length + '</b><span>Usos registrados</span></div>' +
        '<div class="mal"><b>' + plan.filter(function (e) { return e.estado === 'VENCIDO'; }).length + '</b><span>Vencidos</span></div>' +
        '<div><b>' + pesos(costo) + '</b><span>Gastado en servicios</span></div>' +
      '</div>' +
      (editar ? '<div class="acciones-curso">' +
        '<button class="boton chico" onclick="formularioUso(\'' + esc(id) + '\')">+ Registrar uso</button>' +
        '<button class="boton chico secundario" onclick="formularioServicio(\'' + esc(id) + '\')">+ Servicio o reparación</button>' +
        '<button class="boton chico secundario" onclick="formularioMaquina(\'' + esc(id) + '\')">✎ Datos de la máquina</button></div>' : '') +
      '<div class="tarjeta-info">' +
        dato('Tipo', m.tipo) + dato('Marca y modelo', [m.marca, m.modelo].filter(Boolean).join(' ')) + dato('Año', m.anio) + dato('Motor', m.motor) +
        dato('Combustible', m.combustible) + dato('Aceite de motor', m.aceiteMotor) + dato('Filtros y otros', m.filtros) +
        dato('Horas al empezar a usar la app', Number(m.horasIniciales) ? horasTexto(m.horasIniciales) : '') + dato('Notas', m.notas) +
      '</div>' +
      htmlBloqueFotos(q.fotos, 'Maquinas', id, 'Maquinaria', m.nombre);

    // Plan de servicios
    html += '<section class="bloque-curso"><div class="lista-necesidades-cabecera"><h2 class="grupo-titulo">Plan de servicios</h2>' +
      (editar ? '<div class="acciones"><button class="boton chico secundario" onclick="formularioPlan(\'' + esc(id) + '\')">+ Tarea</button></div>' : '') + '</div>' +
      '<p class="ayuda">Cada tarea se hace cada X horas o cada X meses (lo que llegue primero). PRÓXIMO = faltan 20 h o 15 días o menos.</p>' +
      (plan.length ? plan.map(function (e) {
        const p = e.plan;
        return '<div class="fila-plan ' + claseEstadoPlan(e.estado) + '">' +
          '<div class="estudiante-texto"><strong>' + esc(p.tarea) + '</strong>' +
            '<span class="ayuda">Cada ' + [p.cadaHoras ? p.cadaHoras + ' h' : '', p.cadaMeses ? p.cadaMeses + (Number(p.cadaMeses) === 1 ? ' mes' : ' meses') : ''].filter(Boolean).join(' o ') +
              (p.insumo ? ' · ' + esc(p.insumo) : '') + '</span>' +
            '<span class="ayuda">' + (e.ultimo ? 'Último: ' + formatearFecha(e.ultimo.fecha) + ' a las ' + horasTexto(e.ultimo.horas) +
              ' · Próximo: ' + [e.proximoHoras !== null ? horasTexto(e.proximoHoras) : '', e.proximaFecha ? formatearFecha(e.proximaFecha) : ''].filter(Boolean).join(' o ') +
              ' · ' + esc(textoFaltan(e)) : 'Sin dato del último servicio') + '</span></div>' +
          '<span class="estado-plan ' + claseEstadoPlan(e.estado) + '">' + esc(e.estado) + '</span>' +
          (editar ? '<span class="movimiento-acciones"><button class="boton chico" onclick="formularioServicio(\'' + esc(id) + '\', null, \'' + esc(p.id) + '\')">✓ Hecho</button>' +
            '<button class="boton chico secundario" onclick="formularioPlan(\'' + esc(id) + '\', \'' + esc(p.id) + '\')" aria-label="Editar">✎</button></span>' : '') +
        '</div>';
      }).join('') : '<p class="vacio">Esta máquina no tiene plan de servicios.</p>') +
      '</section>';

    html += '<section class="bloque-curso"><h2 class="grupo-titulo">Últimos usos <span class="contador">' + usos.length + '</span></h2>' +
      (usos.length ? usos.slice(0, 15).map(function (u) { return htmlUsoMaquina(q, u, false, editar); }).join('') : '<p class="vacio">Todavía no se registró ningún uso.</p>') +
      (usos.length > 15 ? '<p class="centrado"><a href="#/maquinaria/usos">Ver todos</a></p>' : '') + '</section>';
    html += '<section class="bloque-curso"><h2 class="grupo-titulo">Servicios y reparaciones <span class="contador">' + servicios.length + '</span></h2>' +
      (servicios.length ? servicios.map(function (s) { return htmlServicioMaquina(q, s, false, editar); }).join('') : '<p class="vacio">Todavía no se registró ningún servicio.</p>') + '</section>';
    return html;
  });
}

function htmlUsoMaquina(q, u, conMaquina, editar) {
  const fallas = String(u.fallas || '').split(',').filter(Boolean);
  return '<div class="movimiento' + (fallas.length ? ' mov-egresos' : '') + '">' +
    '<div class="movimiento-texto"><strong>' + (conMaquina ? esc(nombreMaquina(q, u.maquinaId)) + ' · ' : '') + esc(u.tarea || 'Uso') + '</strong>' +
      '<span class="ayuda">' + [formatearFecha(u.fecha), u.entorno, cursoDe(u, q.cursos), u.operador].filter(Boolean).map(esc).join(' · ') + '</span>' +
      '<span class="ayuda">' + (u.chequeoHecho === 'false' ? '⚠ Sin chequeo diario' : fallas.length ? '❌ Falla: ' + esc(fallas.join(', ')) : '✓ Chequeo OK') + '</span>' +
      (u.observaciones ? '<span class="ayuda notas">' + esc(u.observaciones) + '</span>' : '') +
    '</div>' +
    '<div class="movimiento-valor">' + horasTexto(u.horas) + '</div>' +
    '<div class="movimiento-acciones">' +
      htmlBotonFotos(q.fotos, 'UsosMaquina', u.id, 'Maquinaria', nombreMaquina(q, u.maquinaId) + ' · uso del ' + formatearFecha(u.fecha) + (u.tarea ? ' (' + u.tarea + ')' : '')) +
      (editar ? '<button class="boton chico secundario" onclick="formularioUso(\'' + esc(u.maquinaId) + '\', \'' + esc(u.id) + '\')" aria-label="Editar">✎</button>' : '') +
    '</div>' +
  '</div>';
}

function htmlServicioMaquina(q, s, conMaquina, editar) {
  const p = q.planServiciosPorId[s.planId];
  return '<div class="movimiento' + (s.tipo === 'Reparación' ? ' mov-egresos' : ' mov-ingresos') + '">' +
    '<div class="movimiento-texto"><strong>' + (conMaquina ? esc(nombreMaquina(q, s.maquinaId)) + ' · ' : '') + esc(p ? p.tarea : (s.descripcion || s.tipo)) + '</strong>' +
      '<span class="ayuda">' + [formatearFecha(s.fecha), 'a las ' + horasTexto(s.horas), s.tipo, s.realizadoPor].filter(Boolean).map(esc).join(' · ') + '</span>' +
      (p && s.descripcion ? '<span class="ayuda">' + esc(s.descripcion) + '</span>' : '') +
      (s.repuestos ? '<span class="ayuda">Repuestos: ' + esc(s.repuestos) + (s.cantidad ? ' (' + esc(s.cantidad) + ')' : '') + '</span>' : '') +
      (s.notas ? '<span class="ayuda notas">' + esc(s.notas) + '</span>' : '') +
    '</div>' +
    '<div class="movimiento-valor">' + (Number(s.costo) ? pesos(s.costo) : '—') + (s.egresoId ? '<br><span class="ayuda">en Economía</span>' : '') + '</div>' +
    '<div class="movimiento-acciones">' +
      htmlBotonFotos(q.fotos, 'ServiciosMaquina', s.id, 'Maquinaria', nombreMaquina(q, s.maquinaId) + ' · ' + (p ? p.tarea : (s.descripcion || s.tipo))) +
      (editar ? '<button class="boton chico secundario" onclick="formularioServicio(\'' + esc(s.maquinaId) + '\', \'' + esc(s.id) + '\')" aria-label="Editar">✎</button>' : '') +
    '</div>' +
  '</div>';
}

let filtroMaquinaListas = '';

function selectorMaquinaListas(q) {
  return '<label>Máquina<select onchange="filtroMaquinaListas = this.value; alActualizarDatos()"><option value="">Todas</option>' +
    q.maquinas.map(function (m) { return '<option value="' + esc(m.id) + '"' + (filtroMaquinaListas === m.id ? ' selected' : '') + '>' + esc(m.nombre) + '</option>'; }).join('') +
  '</select></label>';
}

function pantallaUsosMaquinaria() {
  marcoMaquinaria('Registro de uso', 'maquinaria', function (q) {
    const usos = q.usosMaquina.filter(function (u) { return !filtroMaquinaListas || u.maquinaId === filtroMaquinaListas; });
    const conFalla = usos.filter(function (u) { return u.fallas; }).length;
    return '<h1>📒 REGISTRO DE USO</h1>' + selectorMaquinaListas(q) +
      '<div class="resumen"><div><b>' + usos.length + '</b><span>Usos</span></div>' +
        '<div class="ok"><b>' + numero(usos.reduce(function (t, u) { return t + (Number(u.horas) || 0); }, 0)) + '</b><span>Horas</span></div>' +
        '<div class="mal"><b>' + conFalla + '</b><span>Con fallas</span></div></div>' +
      (puedeEditar() ? '<button class="boton" onclick="elegirMaquinaPara(\'uso\')">+ Registrar uso</button>' : '') +
      (usos.length ? usos.map(function (u) { return htmlUsoMaquina(q, u, true, puedeEditar()); }).join('') : '<p class="vacio">No hay usos registrados.</p>');
  });
}

function pantallaServiciosMaquinaria() {
  marcoMaquinaria('Servicios y reparaciones', 'maquinaria', function (q) {
    const servicios = q.serviciosMaquina.filter(function (s) { return !filtroMaquinaListas || s.maquinaId === filtroMaquinaListas; });
    return '<h1>🔧 SERVICIOS Y REPARACIONES</h1>' + selectorMaquinaListas(q) +
      '<div class="resumen"><div><b>' + servicios.filter(function (s) { return s.tipo !== 'Reparación'; }).length + '</b><span>Servicios</span></div>' +
        '<div class="mal"><b>' + servicios.filter(function (s) { return s.tipo === 'Reparación'; }).length + '</b><span>Reparaciones</span></div>' +
        '<div><b>' + pesos(servicios.reduce(function (t, s) { return t + (Number(s.costo) || 0); }, 0)) + '</b><span>Costo total</span></div></div>' +
      (puedeEditar() ? '<button class="boton" onclick="elegirMaquinaPara(\'servicio\')">+ Servicio o reparación</button>' : '') +
      (servicios.length ? servicios.map(function (s) { return htmlServicioMaquina(q, s, true, puedeEditar()); }).join('') : '<p class="vacio">No hay servicios registrados.</p>');
  });
}

/* ---------- Formularios ---------- */

/** Antes de registrar un uso o un servicio desde el menú, se elige la máquina. */
async function elegirMaquinaPara(que) {
  const q = await cargarMaquinaria();
  const activas = q.maquinas.filter(function (m) { return m.activa !== 'false'; });
  if (activas.length === 1) return que === 'uso' ? formularioUso(activas[0].id) : formularioServicio(activas[0].id);
  abrirModal('<h2>' + (que === 'uso' ? 'Registrar uso' : 'Servicio o reparación') + '</h2><p class="ayuda">¿De qué máquina?</p>' +
    '<div class="lista-cursos">' + activas.map(function (m) {
      return '<button class="tarjeta-curso" onclick="cerrarModal(); ' + (que === 'uso' ? 'formularioUso' : 'formularioServicio') + '(\'' + esc(m.id) + '\')">' +
        '<span class="tarjeta-curso-nombre">' + (MAQUINARIA.iconos[m.tipo] || '🔩') + '</span>' +
        '<span class="tarjeta-curso-datos"><b>' + esc(m.nombre) + '</b><span class="ayuda">' + horasTexto(horasMaquina(q, m.id)) + '</span></span></button>';
    }).join('') + '</div>' +
    '<div class="modal-botones"><span class="espacio"></span><button type="button" class="boton chico secundario" onclick="cerrarModal()">Cancelar</button></div>');
}

async function formularioMaquina(id) {
  const m = id ? await Datos.obtener('Maquinas', id) : null;
  await abrirFormulario({
    tabla: 'Maquinas',
    titulo: m ? 'Datos de la máquina' : 'Nueva máquina',
    registro: m ? Object.assign({}, m) : null,
    valores: { tipo: 'Tractor', combustible: 'Gasoil', horasIniciales: '0', activa: 'true' },
    campos: [
      { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', requerido: true, ayuda: 'Ej: "Tractor Fiat 780" o "Rotativa"' },
      { nombre: 'tipo', etiqueta: 'Tipo', tipo: 'select', opciones: MAQUINARIA.tipos, medio: true },
      { nombre: 'combustible', etiqueta: 'Combustible', tipo: 'select', opciones: MAQUINARIA.combustibles, medio: true },
      { nombre: 'marca', etiqueta: 'Marca', tipo: 'texto', medio: true },
      { nombre: 'modelo', etiqueta: 'Modelo', tipo: 'texto', medio: true },
      { nombre: 'anio', etiqueta: 'Año', tipo: 'texto', medio: true },
      { nombre: 'horasIniciales', etiqueta: 'Horas que ya tenía', tipo: 'numero', minimo: 0, medio: true,
        ayuda: 'Al empezar a usar la app (estimadas: no hay cuentahoras). Después se suman las de cada uso.' },
      { nombre: 'motor', etiqueta: 'Motor', tipo: 'texto' },
      { nombre: 'aceiteMotor', etiqueta: 'Aceite de motor', tipo: 'texto' },
      { nombre: 'filtros', etiqueta: 'Filtros y otros insumos', tipo: 'texto' },
      { nombre: 'chequeo', etiqueta: 'Ítems del chequeo diario', tipo: 'area',
        ayuda: 'Uno por renglón. Si lo dejás vacío se usan los típicos según el tipo de máquina.' },
      { nombre: 'activa', etiqueta: 'En uso (destildá si se vendió o está fuera de servicio)', tipo: 'sino' },
      { nombre: 'notas', etiqueta: 'Notas', tipo: 'area' }
    ],
    antesDeGuardar: function (datos) {
      if (!datos.chequeo) datos.chequeo = (MAQUINARIA.chequeoPorTipo[datos.tipo] || MAQUINARIA.chequeoPorTipo.Otra).join('\n');
    },
    alEliminar: async function (registro) {
      const q = await cargarMaquinaria();
      if (q.usosMaquina.some(function (u) { return u.maquinaId === registro.id; }) || q.serviciosMaquina.some(function (s) { return s.maquinaId === registro.id; })) {
        return 'Tiene usos o servicios registrados. Si ya no se usa, destildá "En uso".';
      }
    },
    eliminar: async function (registro) {
      const q = await cargarMaquinaria();
      for (const p of q.planServicios.filter(function (x) { return x.maquinaId === registro.id; })) await Datos.eliminar('PlanServicios', p.id);
      await Datos.eliminar('Maquinas', registro.id);
      ir('maquinaria');
    },
    despuesDeGuardar: function (guardada, anterior) { if (!anterior) ir('maquinaria/maquina/' + guardada.id); },
    preguntaEliminar: '¿Eliminar esta máquina y su plan de servicios?'
  });
}

async function formularioPlan(maquinaId, id) {
  const p = id ? await Datos.obtener('PlanServicios', id) : null;
  const orden = (await Datos.listar('PlanServicios')).filter(function (x) { return x.maquinaId === maquinaId; }).length + 1;
  await abrirFormulario({
    tabla: 'PlanServicios',
    titulo: p ? 'Tarea del plan' : 'Nueva tarea del plan',
    registro: p,
    valores: { activo: 'true' },
    ayuda: 'Se hace cada X horas o cada X meses: lo que llegue primero. Podés completar uno solo.',
    campos: [
      { nombre: 'tarea', etiqueta: 'Tarea', tipo: 'texto', requerido: true, ayuda: 'Ej: "Cambio aceite de motor + filtro"' },
      { nombre: 'cadaHoras', etiqueta: 'Cada (horas)', tipo: 'numero', minimo: 0, medio: true },
      { nombre: 'cadaMeses', etiqueta: 'Cada (meses)', tipo: 'numero', minimo: 0, medio: true },
      { nombre: 'insumo', etiqueta: 'Insumo / observación', tipo: 'texto' },
      { nombre: 'ultimaFecha', etiqueta: 'Última vez que se hizo (antes de usar la app)', tipo: 'fecha', medio: true, seccion: 'Dato inicial (opcional)' },
      { nombre: 'ultimoHoras', etiqueta: 'A las (horas)', tipo: 'numero', minimo: 0, medio: true },
      { nombre: 'activo', etiqueta: 'Activa (destildá para dejar de controlarla)', tipo: 'sino' },
      { nombre: 'notas', etiqueta: 'Notas', tipo: 'area' }
    ],
    validar: function (d) {
      if (!Number(d.cadaHoras) && !Number(d.cadaMeses)) return 'Completá cada cuántas horas o cada cuántos meses.';
      if (d.ultimoHoras && !d.ultimaFecha) return 'Si cargás las horas del último servicio, poné también la fecha.';
    },
    antesDeGuardar: function (d) { if (!p) { d.maquinaId = maquinaId; d.orden = String(orden); } },
    preguntaEliminar: '¿Eliminar esta tarea del plan? Los servicios ya registrados quedan guardados.'
  });
}

async function formularioUso(maquinaId, id) {
  const [q, entornos, campoCurso] = await Promise.all([cargarMaquinaria(), Datos.lista('Entorno'), campoCursoSugerido()]);
  const m = q.maquinasPorId[maquinaId];
  if (!m) return;
  const u = id ? q.usosMaquinaPorId[id] : null;
  const items = itemsChequeo(m);
  await abrirFormulario({
    tabla: 'UsosMaquina',
    titulo: (u ? 'Editar uso · ' : 'Uso · ') + m.nombre,
    registro: u ? Object.assign({}, u, { curso: cursoDe(u, q.cursos) }) : null,
    valores: { fecha: hoyTexto(), chequeoHecho: 'true', operador: '' },
    ayuda: 'Lleva ' + horasTexto(horasMaquina(q, maquinaId)) + ' de uso.',
    campos: [
      { nombre: 'fecha', etiqueta: 'Fecha', tipo: 'fecha', requerido: true, medio: true },
      { nombre: 'horas', etiqueta: 'Horas trabajadas', tipo: 'numero', minimo: 0, requerido: true, medio: true, ayuda: 'Ej: 1,5' },
      { nombre: 'tarea', etiqueta: 'Tarea realizada', tipo: 'texto', requerido: true, ayuda: 'Ej: "Desmalezado con rotativa"' },
      { nombre: 'entorno', etiqueta: 'Dónde se usó', tipo: 'select', vacio: '—', opciones: entornos, medio: true },
      campoCurso,
      { nombre: 'operador', etiqueta: 'Operador', tipo: 'texto', ayuda: 'Ej: "Docente + 3 estudiantes"' },
      { nombre: 'chequeoHecho', etiqueta: 'Se hizo el chequeo diario', tipo: 'sino', seccion: 'Chequeo diario' },
      { nombre: 'fallas', etiqueta: 'Marcá solo lo que dio FALLA (lo que no marques queda OK)', tipo: 'casillas',
        opciones: items.map(function (i) { return { valor: i, texto: i }; }) },
      { nombre: 'observaciones', etiqueta: 'Observaciones', tipo: 'area', ayuda: 'Si hubo una falla, describila acá.' }
    ],
    validar: function (d) {
      if (!(Number(d.horas) > 0)) return 'Las horas trabajadas tienen que ser más que cero.';
      if (d.fallas && !d.observaciones) return 'Hubo una falla: describila en Observaciones.';
      if (d.fecha > hoyTexto()) return 'La fecha no puede ser futura.';
    },
    antesDeGuardar: function (d) { if (!u) d.maquinaId = maquinaId; d.cursoId = ''; },
    despuesDeGuardar: async function (guardado, anterior) {
      const nuevas = String(guardado.fallas || '').split(',').filter(Boolean);
      const antes = anterior ? String(anterior.fallas || '').split(',').filter(Boolean) : [];
      if (nuevas.length && nuevas.some(function (f) { return antes.indexOf(f) === -1; }) &&
          confirm('Se anotó una falla en ' + m.nombre + ' (' + nuevas.join(', ') + ').\n\n¿Hace falta comprar algún repuesto? Si tocás Aceptar, se abre Necesidades de los entornos para anotarlo.')) {
        formularioNecesidad(null, { entorno: 'Maquinaria', tipo: 'Repuesto', prioridad: 'Urgente',
          notas: m.nombre + ' · falla del ' + formatearFecha(guardado.fecha) + ': ' + nuevas.join(', ') + (guardado.observaciones ? ' — ' + guardado.observaciones : '') });
      }
    },
    preguntaEliminar: '¿Eliminar este uso? Se descuentan sus horas.'
  });
}

async function formularioServicio(maquinaId, id, planId) {
  const q = await cargarMaquinaria();
  const m = q.maquinasPorId[maquinaId];
  if (!m) return;
  const s = id ? q.serviciosMaquinaPorId[id] : null;
  const plan = q.planServicios.filter(function (p) { return p.maquinaId === maquinaId && (p.activo !== 'false' || (s && s.planId === p.id)); })
    .sort(function (a, b) { return (Number(a.orden) || 999) - (Number(b.orden) || 999); });
  const elegido = q.planServiciosPorId[planId];
  await abrirFormulario({
    tabla: 'ServiciosMaquina',
    titulo: (s ? 'Editar · ' : '') + (elegido ? '✓ ' + elegido.tarea : 'Servicio o reparación') + ' · ' + m.nombre,
    registro: s ? Object.assign({}, s, { registrarEgreso: 'false' }) : null,
    valores: { fecha: hoyTexto(), horas: String(Math.round(horasMaquina(q, maquinaId) * 10) / 10), planId: planId || '',
      repuestos: elegido ? elegido.insumo : '', registrarEgreso: 'true', realizadoPor: '' },
    ayuda: 'Si es una tarea del plan, al guardarlo se actualiza el próximo servicio. Si es un arreglo, elegí "Reparación u otro trabajo".',
    campos: [
      { nombre: 'planId', etiqueta: 'Qué se hizo', tipo: 'select', vacio: 'Reparación u otro trabajo (fuera del plan)',
        opciones: plan.map(function (p) { return { valor: p.id, texto: p.tarea }; }) },
      { nombre: 'fecha', etiqueta: 'Fecha', tipo: 'fecha', requerido: true, medio: true },
      { nombre: 'horas', etiqueta: 'Horas de la máquina', tipo: 'numero', minimo: 0, medio: true, ayuda: 'Se completa con las horas de uso acumuladas' },
      { nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'texto', ayuda: 'Obligatoria si es una reparación. Ej: "Cambio de correa del ventilador"' },
      { nombre: 'repuestos', etiqueta: 'Repuestos / insumos usados', tipo: 'texto', medio: true },
      { nombre: 'cantidad', etiqueta: 'Cantidad', tipo: 'texto', medio: true },
      { nombre: 'costo', etiqueta: 'Costo $', tipo: 'numero', minimo: 0, medio: true },
      { nombre: 'realizadoPor', etiqueta: 'Realizado por', tipo: 'texto', medio: true, ayuda: 'Docente, curso o taller' }
    ].concat(s && s.egresoId ? [] : [{ nombre: 'registrarEgreso', etiqueta: 'Registrar el costo también como egreso en Economía de Maquinaria', tipo: 'sino' }])
      .concat([{ nombre: 'notas', etiqueta: 'Notas', tipo: 'area' }]),
    validar: function (d) {
      if (!d.planId && !d.descripcion) return 'Es una reparación u otro trabajo: escribí qué se hizo en "Descripción".';
      if (d.fecha > hoyTexto()) return 'La fecha no puede ser futura.';
    },
    guardar: async function (d, anterior) {
      const p = q.planServiciosPorId[d.planId];
      const registro = {
        maquinaId: maquinaId, planId: d.planId, tipo: d.planId ? 'Servicio' : 'Reparación', fecha: d.fecha, horas: d.horas,
        descripcion: d.descripcion, repuestos: d.repuestos, cantidad: d.cantidad, costo: d.costo, realizadoPor: d.realizadoPor, notas: d.notas
      };
      if (anterior) registro.id = anterior.id;
      let egresoId = anterior ? anterior.egresoId || '' : '';
      if (d.registrarEgreso === 'true' && Number(d.costo) > 0 && !egresoId) {
        const egreso = await Datos.guardar('Egresos', {
          entorno: 'Maquinaria', fecha: d.fecha, producto: (p ? p.tarea : d.descripcion) + ' · ' + m.nombre, cantidad: '', unidad: '',
          valor: d.costo, proveedor: d.realizadoPor || '', numeroFactura: '', notas: 'Desde Maquinaria' + (d.repuestos ? ': ' + d.repuestos : '')
        });
        egresoId = egreso.id;
      }
      registro.egresoId = egresoId;
      return Datos.guardar('ServiciosMaquina', registro);
    },
    preguntaEliminar: '¿Eliminar este servicio? (Si se registró como egreso, el egreso queda en Economía.)'
  });
}
