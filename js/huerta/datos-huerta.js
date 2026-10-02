/**
 * HUERTA: datos, cálculos y clima (la misma lógica que el programa Surco).
 */
const HUERTA = {
  estadosSiembra: ['En curso', 'En cosecha', 'Cosechada', 'Perdida'],
  estadosAlmacigo: ['En almácigo', 'Trasplantado', 'Descartado'],
  metodosRiego: ['Goteo', 'Surco / inundación', 'Aspersión', 'Manual', 'Otro'],
  tiposTratamiento: ['Fitosanitario', 'Fertilización', 'Otro'],
  tiposSuelo: ['Arenoso', 'Franco arenoso', 'Franco', 'Franco arcilloso', 'Arcilloso'],
  tolerancias: ['Resistente', 'Sensible', 'Muy sensible'],
  ciclos: ['Anual', 'Bianual', 'Perenne'],
  espacios: ['Poco', 'Medio', 'Mucho'],
  activas: ['En curso', 'En cosecha']
};

/** Trae todas las tablas de Huerta del equipo, con índices por id. */
async function cargarHuerta() {
  const nombres = ['Parcelas', 'Lomos', 'Cultivos', 'Almacigos', 'Siembras', 'Riegos', 'Tratamientos', 'Cosechas', 'AnalisisSuelo'];
  const listas = await Promise.all(nombres.map(function (t) { return Datos.listar(t); }));
  const h = {};
  nombres.forEach(function (t, i) {
    const clave = t.charAt(0).toLowerCase() + t.slice(1);
    h[clave] = listas[i];
    const porId = {};
    listas[i].forEach(function (r) { porId[r.id] = r; });
    h[clave + 'PorId'] = porId;
  });
  h.parcelas.sort(function (a, b) { return a.nombre.localeCompare(b.nombre); });
  h.lomos.sort(function (a, b) { return Number(a.numero) - Number(b.numero); });
  h.cultivos.sort(function (a, b) { return a.nombre.localeCompare(b.nombre); });
  return h;
}

function nombreParcela(h, id) {
  const p = h.parcelasPorId[id];
  return p ? p.nombre : '(parcela eliminada)';
}

function etiquetaLomo(l) {
  if (!l) return '';
  return 'Lomo ' + l.numero + (l.superficieM2 ? ' (' + numero(l.superficieM2) + ' m²)' : '');
}

function nombreCultivo(h, id) {
  const c = h.cultivosPorId[id];
  return c ? c.nombre : '(cultivo eliminado)';
}

/** "Macrotunel · Lomo 3 · Tomate (27/08/2026)" */
function descripcionSiembra(h, s, conFecha) {
  const lomo = h.lomosPorId[s.lomoId];
  return nombreParcela(h, s.parcelaId) + (lomo ? ' · Lomo ' + lomo.numero : '') + ' · ' + nombreCultivo(h, s.cultivoId) +
    (conFecha === false ? '' : ' (' + formatearFecha(s.fechaSiembra) + ')');
}

/** Superficie que ocupa la siembra, en m² (se usa para pasar de litros a mm de riego). */
function superficieSiembraM2(h, s) {
  if (Number(s.superficieM2) > 0) return Number(s.superficieM2);
  const lomo = h.lomosPorId[s.lomoId];
  if (lomo && Number(lomo.superficieM2) > 0) return Number(lomo.superficieM2);
  const p = h.parcelasPorId[s.parcelaId];
  if (!p) return 0;
  if (lomo && Number(p.superficiePorLomoM2) > 0) return Number(p.superficiePorLomoM2);
  if (lomo && Number(p.superficieM2) > 0 && Number(p.cantidadLomos) > 0) return Number(p.superficieM2) / Number(p.cantidadLomos);
  return Number(p.superficieM2) || 0;
}

function diasEntre(desde, hasta) {
  return Math.round((textoAFecha(hasta) - textoAFecha(desde)) / 86400000);
}

/**
 * Etapa del cultivo y Kc según los días desde la siembra (modelo de 4 etapas FAO-56, igual que Surco).
 */
function etapaYKc(cultivo, dias) {
  const n = function (v) { return Number(v) || 0; };
  if (!cultivo) return { etapa: 'Sin datos', kc: 0 };
  const fin1 = n(cultivo.diasEtapaInicial);
  const fin2 = fin1 + n(cultivo.diasEtapaDesarrollo);
  const fin3 = fin2 + n(cultivo.diasEtapaMedia);
  const fin4 = fin3 + n(cultivo.diasEtapaFinal);
  const interpolar = function (desde, hasta, enEtapa, duracion) {
    if (duracion <= 0) return hasta;
    return desde + (hasta - desde) * Math.min(1, Math.max(0, enEtapa / duracion));
  };
  if (dias <= fin1) return { etapa: 'Inicial', kc: n(cultivo.kcInicial) };
  if (dias <= fin2) return { etapa: 'Desarrollo', kc: interpolar(n(cultivo.kcInicial), n(cultivo.kcMedio), dias - fin1, n(cultivo.diasEtapaDesarrollo)) };
  if (dias <= fin3) return { etapa: 'Media', kc: n(cultivo.kcMedio) };
  if (dias <= fin4) return { etapa: 'Final', kc: interpolar(n(cultivo.kcMedio), n(cultivo.kcFinal), dias - fin3, n(cultivo.diasEtapaFinal)) };
  return { etapa: 'Ciclo cumplido', kc: n(cultivo.kcFinal) };
}

function duracionCicloDias(cultivo) {
  if (!cultivo) return 0;
  return ['diasEtapaInicial', 'diasEtapaDesarrollo', 'diasEtapaMedia', 'diasEtapaFinal']
    .reduce(function (t, c) { return t + (Number(cultivo[c]) || 0); }, 0);
}

/** Último día de carencia de un tratamiento (hasta ese día no se cosecha). */
function finCarencia(t) {
  return Number(t.carenciaDias) > 0 ? sumarDias(t.fecha, Number(t.carenciaDias)) : '';
}

/** Tratamientos de la siembra que todavía están en período de carencia. */
function carenciasActivas(h, siembraId) {
  const hoy = hoyTexto();
  return h.tratamientos.filter(function (t) {
    return t.siembraId === siembraId && finCarencia(t) && finCarencia(t) >= hoy;
  });
}

function porcentajeGerminacion(a) {
  const total = (Number(a.cantidadCeldas) || 0) * (Number(a.cantidadBandejas) || 1);
  const germinadas = Math.max(Number(a.germinadasDia7) || 0, Number(a.germinadasDia10) || 0, Number(a.germinadasDia14) || 0);
  return total > 0 && germinadas > 0 ? Math.round(germinadas * 100 / total) : null;
}

/* ---------- Clima (Open-Meteo, gratuito) ---------- */

async function ubicacionClima(parcela) {
  if (parcela && Number(parcela.latitud) && Number(parcela.longitud)) {
    return { latitud: Number(parcela.latitud), longitud: Number(parcela.longitud), origen: parcela.nombre };
  }
  const config = (await BaseLocal.leerMeta('config')) || {};
  return {
    latitud: Number(config.latitud) || -34.86,
    longitud: Number(config.longitud) || -58.11,
    origen: 'la escuela'
  };
}

/**
 * Clima diario (últimos días + pronóstico). Se guarda en el equipo para verlo sin internet.
 * Devuelve { dias: [{fecha, max, min, lluvia, et0}], actualizado, sinConexion }
 */
async function obtenerClima(ubicacion) {
  const clave = 'clima:' + ubicacion.latitud.toFixed(2) + ',' + ubicacion.longitud.toFixed(2);
  const guardado = await BaseLocal.leerMeta(clave);
  const reciente = guardado && (Date.now() - new Date(guardado.actualizado).getTime()) < 3 * 3600 * 1000;
  if (reciente) return guardado;
  try {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + ubicacion.latitud + '&longitude=' + ubicacion.longitud +
      '&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration' +
      '&past_days=30&forecast_days=7&timezone=auto';
    const respuesta = await fetch(url);
    if (!respuesta.ok) throw new Error('Open-Meteo respondió ' + respuesta.status);
    const json = await respuesta.json();
    const d = json.daily;
    const resultado = {
      actualizado: new Date().toISOString(),
      dias: d.time.map(function (fecha, i) {
        return {
          fecha: fecha,
          max: d.temperature_2m_max[i], min: d.temperature_2m_min[i],
          lluvia: d.precipitation_sum[i] || 0, et0: d.et0_fao_evapotranspiration[i] || 0
        };
      })
    };
    await BaseLocal.escribirMeta(clave, resultado);
    return resultado;
  } catch (e) {
    if (guardado) return Object.assign({ sinConexion: true }, guardado);
    throw new Error('No se pudo consultar el clima (hace falta internet la primera vez).');
  }
}

/**
 * Necesidad de riego por día para una siembra (igual que Surco):
 * ETc = ET0 × Kc · lluvia efectiva = 80% de la lluvia · lámina neta = ETc − lluvia efectiva − riego aplicado.
 */
function calcularRiegoSiembra(h, s, diasClima) {
  const cultivo = h.cultivosPorId[s.cultivoId];
  const superficie = superficieSiembraM2(h, s);
  const aplicadoPorFecha = {};
  h.riegos.filter(function (r) { return r.siembraId === s.id; }).forEach(function (r) {
    aplicadoPorFecha[r.fecha] = (aplicadoPorFecha[r.fecha] || 0) + (Number(r.laminaMm) || 0);
  });
  return diasClima
    .filter(function (d) { return d.fecha >= s.fechaSiembra; })
    .map(function (d) {
      const dias = diasEntre(s.fechaSiembra, d.fecha);
      const ek = etapaYKc(cultivo, dias);
      const etc = d.et0 * ek.kc;
      const lluviaEfectiva = d.lluvia * 0.8;
      const aplicado = aplicadoPorFecha[d.fecha] || 0;
      const lamina = Math.max(0, etc - lluviaEfectiva - aplicado);
      return {
        fecha: d.fecha, dias: dias, etapa: ek.etapa, kc: ek.kc, et0: d.et0, etc: etc,
        lluviaEfectiva: lluviaEfectiva, aplicado: aplicado, lamina: lamina,
        litros: superficie > 0 ? lamina * superficie : null,
        pronostico: d.fecha > hoyTexto()
      };
    });
}
