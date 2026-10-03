/**
 * FORRAJES: datos y cálculos (la misma lógica que el programa Forrajes).
 */
const FORRAJES = {
  estadosSiembra: ['En crecimiento', 'Cosechada', 'Perdida'],
  usosPrevistos: ['Pastoreo', 'Heno', 'Ambas'],
  aprovechamientos: ['Pastoreo directo', 'Corte para heno', 'Corte para silo', 'Corte en verde'],
  tiposForraje: ['Pastura perenne', 'Verdeo de invierno', 'Verdeo de verano', 'Cultivo para silo', 'Concentrado / grano', 'Heno', 'Subproducto'],
  tiposAlmacenamiento: ['Silo bolsa', 'Silo torre', 'Fardera', 'Rollos', 'Galpón', 'Aire libre'],
  origenes: ['Producción propia', 'Compra'],
  tiposMovimiento: ['Entrada', 'Salida', 'Merma', 'Ajuste'],
  diasAlertaStock: 14,     // igual que el Dashboard de Forrajes
  tolerancia: 0.05         // ±5% para "Cumple" en raciones
};

async function cargarForrajes() {
  const nombres = ['Lotes', 'Cuadros', 'EspeciesForraje', 'SiembrasForraje', 'SiembraEspecies', 'CosechasForraje',
    'MuestreosCrecimiento', 'LluviasManuales', 'CategoriasAnimales', 'LotesConsumo', 'Raciones', 'RacionIngredientes',
    'AsignacionesRacion', 'UbicacionesAlmacenamiento', 'LotesInventario', 'MovimientosInventario', 'AnalisisNutricionales',
    'CortesForraje', 'VolteosForraje', 'PastoreosForraje'];
  const listas = await Promise.all(nombres.map(function (t) { return Datos.listar(t); }));
  const f = {};
  nombres.forEach(function (t, i) {
    const clave = t.charAt(0).toLowerCase() + t.slice(1);
    f[clave] = listas[i];
    const porId = {};
    listas[i].forEach(function (r) { porId[r.id] = r; });
    f[clave + 'PorId'] = porId;
  });
  f.lotes.sort(function (a, b) { return a.nombre.localeCompare(b.nombre, 'es', { numeric: true }); });
  f.cuadros.sort(function (a, b) { return Number(a.numero) - Number(b.numero); });
  f.especiesForraje.sort(function (a, b) { return a.nombre.localeCompare(b.nombre); });
  f.categoriasAnimales.sort(function (a, b) { return a.nombre.localeCompare(b.nombre); });
  return f;
}

function nombreLote(f, id) {
  const l = f.lotesPorId[id];
  return l ? l.nombre : '(lote eliminado)';
}

function etiquetaCuadro(c) {
  if (!c) return '';
  return 'Cuadro ' + c.numero + (c.superficieHa ? ' (' + numero(c.superficieHa) + ' ha)' : '');
}

function nombreEspecie(f, id) {
  const e = f.especiesForrajePorId[id];
  return e ? e.nombre : '(especie eliminada)';
}

function lugarTexto(f, loteId, cuadroId) {
  const c = f.cuadrosPorId[cuadroId];
  return nombreLote(f, loteId) + (c ? ' · Cuadro ' + c.numero : '');
}

function especiesDeSiembra(f, siembraId) {
  return f.siembraEspecies.filter(function (se) { return se.siembraId === siembraId; });
}

/** "Trébol rojo, Cebadilla criolla" (como EspeciesResumen de Forrajes) */
function resumenEspecies(f, siembraId) {
  return especiesDeSiembra(f, siembraId).map(function (se) { return nombreEspecie(f, se.especieId); }).join(', ') || 'Sin especies';
}

function descripcionSiembraForraje(f, s) {
  return lugarTexto(f, s.loteId, s.cuadroId) + ' · ' + resumenEspecies(f, s.id) + ' (' + formatearFecha(s.fechaSiembra) + ')';
}

/** Superficie (m²) del cuadro o, si no tiene, del lote. */
function superficieReferenciaM2(f, loteId, cuadroId) {
  const c = f.cuadrosPorId[cuadroId];
  if (c && Number(c.superficieHa) > 0) return Number(c.superficieHa) * 10000;
  const l = f.lotesPorId[loteId];
  if (!l) return null;
  if (c && Number(l.superficiePorCuadroHa) > 0) return Number(l.superficiePorCuadroHa) * 10000;
  return Number(l.superficieHa) > 0 ? Number(l.superficieHa) * 10000 : null;
}

/** Lluvia caída en un lote/cuadro entre dos fechas (lecturas del pluviómetro). */
function lluviaEntre(f, loteId, cuadroId, desde, hasta) {
  return f.lluviasManuales
    .filter(function (r) {
      return r.loteId === loteId && (!cuadroId || !r.cuadroId || r.cuadroId === cuadroId) &&
        r.fecha >= desde && (!hasta || r.fecha <= hasta);
    })
    .reduce(function (t, r) { return t + (Number(r.cantidadMm) || 0); }, 0);
}

/* ---------- Inventario ---------- */

/** Signo de cada tipo de movimiento (igual que Forrajes: Entrada y Ajuste suman; Salida y Merma restan). */
function signoMovimiento(m) {
  if (m.tipoMovimiento === 'Salida' || m.tipoMovimiento === 'Merma') return -1;
  return 1;
}

/** Stock actual de un lote de inventario = ingreso ± movimientos. */
function stockLote(f, lote) {
  const movimientos = f.movimientosInventario.filter(function (m) { return m.loteInventarioId === lote.id; });
  let kg = Number(lote.kgIngreso) || 0;
  let unidades = lote.unidadesIngreso === '' ? null : Number(lote.unidadesIngreso) || 0;
  movimientos.forEach(function (m) {
    kg += signoMovimiento(m) * (Number(m.cantidadKg) || 0);
    if (m.cantidadUnidades !== '' && m.cantidadUnidades !== undefined) {
      unidades = (unidades || 0) + signoMovimiento(m) * (Number(m.cantidadUnidades) || 0);
    }
  });
  return { kg: Math.round(kg * 100) / 100, unidades: unidades === null ? null : Math.round(unidades * 100) / 100 };
}

/** Perfil nutritivo de un lote: catálogo, reemplazado campo por campo por el análisis más reciente (como Forrajes). */
function perfilNutricional(f, especieId, loteInventarioId) {
  const e = f.especiesForrajePorId[especieId] || {};
  const analisis = loteInventarioId
    ? f.analisisNutricionales.filter(function (a) { return a.loteInventarioId === loteInventarioId; })
        .sort(function (a, b) { return b.fecha.localeCompare(a.fecha); })[0]
    : null;
  const valor = function (campo) {
    return analisis && analisis[campo] !== '' && analisis[campo] !== undefined ? Number(analisis[campo]) : Number(e[campo]) || 0;
  };
  return {
    materiaSecaPct: valor('materiaSecaPct'), proteinaBrutaPct: valor('proteinaBrutaPct'),
    energiaMetabolizableMcalKgMs: valor('energiaMetabolizableMcalKgMs'), calcioPct: valor('calcioPct'), fosforoPct: valor('fosforoPct'),
    conAnalisis: !!analisis
  };
}

/* ---------- Raciones (igual que CalculoRacionService de Forrajes) ---------- */

function estadoCumplimiento(valor, requerido) {
  if (!(requerido > 0)) return 'Cumple';
  const razon = valor / requerido;
  if (razon < 1 - FORRAJES.tolerancia) return 'Déficit';
  if (razon > 1 + FORRAJES.tolerancia) return 'Exceso';
  return 'Cumple';
}

/**
 * Totales nutricionales por cabeza/día de una ración y su comparación con la categoría animal.
 * ingredientes: [{ nombre, kgMs (por cabeza/día), perfil }]
 */
function calcularRacion(ingredientes, categoria, cabezas, pesoPromedioKg) {
  const ms = ingredientes.reduce(function (t, i) { return t + i.kgMs; }, 0);
  let pb = 0, em = 0, ca = 0, p = 0, tal = 0;
  if (ms > 0) {
    pb = ingredientes.reduce(function (t, i) { return t + i.kgMs * i.perfil.proteinaBrutaPct / 100; }, 0) / ms * 100;
    em = ingredientes.reduce(function (t, i) { return t + i.kgMs * i.perfil.energiaMetabolizableMcalKgMs; }, 0) / ms;
    ca = ingredientes.reduce(function (t, i) { return t + i.kgMs * 1000 * i.perfil.calcioPct / 100; }, 0) / 1000 / ms * 100;
    p = ingredientes.reduce(function (t, i) { return t + i.kgMs * 1000 * i.perfil.fosforoPct / 100; }, 0) / 1000 / ms * 100;
    tal = ingredientes.reduce(function (t, i) { return t + (i.perfil.materiaSecaPct > 0 ? i.kgMs / (i.perfil.materiaSecaPct / 100) : 0); }, 0);
  }
  const req = function (c) { return Number(categoria[c]) || 0; };
  const capacidadIngesta = pesoPromedioKg * req('requerimientoMsPctPesoVivo') / 100;
  return {
    ms: ms, pb: pb, em: em, ca: ca, p: p,
    capacidadIngesta: capacidadIngesta,
    estadoMs: estadoCumplimiento(ms, capacidadIngesta),
    estadoPb: estadoCumplimiento(pb, req('requerimientoProteinaBrutaPctMs')),
    estadoEm: estadoCumplimiento(em, req('requerimientoEnergiaMetabolizableMcalKgMs')),
    estadoCa: estadoCumplimiento(ca, req('requerimientoCalcioPctMs')),
    estadoP: estadoCumplimiento(p, req('requerimientoFosforoPctMs')),
    grupoKgMsDia: ms * cabezas,
    grupoKgTalCualDia: tal * cabezas
  };
}

function ingredientesDeRacion(f, racionId) {
  return f.racionIngredientes
    .filter(function (i) { return i.racionId === racionId; })
    .map(function (i) {
      return { id: i.id, especieId: i.especieId, nombre: nombreEspecie(f, i.especieId),
        kgMs: Number(i.cantidadKgMsCabezaDia) || 0, perfil: perfilNutricional(f, i.especieId, null) };
    });
}

function pesoPromedioLoteConsumo(f, loteConsumo) {
  const cat = f.categoriasAnimalesPorId[loteConsumo.categoriaId];
  return Number(loteConsumo.pesoPromedioKg) || (cat ? Number(cat.pesoVivoReferenciaKg) : 0) || 0;
}

/** Consumo diario "tal cual" (kg) por especie de todas las asignaciones activas (para los días de stock). */
function consumoDiarioPorEspecie(f) {
  const consumo = {};
  f.asignacionesRacion.filter(function (a) { return a.activa !== 'false'; }).forEach(function (a) {
    const lc = f.lotesConsumoPorId[a.loteConsumoId];
    if (!lc) return;
    f.racionIngredientes.filter(function (i) { return i.racionId === a.racionId; }).forEach(function (i) {
      const e = f.especiesForrajePorId[i.especieId];
      if (!e || !(Number(e.materiaSecaPct) > 0)) return;
      const kg = Number(i.cantidadKgMsCabezaDia) / (Number(e.materiaSecaPct) / 100) * (Number(lc.cantidadCabezas) || 0);
      consumo[i.especieId] = (consumo[i.especieId] || 0) + kg;
    });
  });
  return consumo;
}

/** Stock, consumo y días restantes por especie (ProyeccionStockService de Forrajes). */
function proyeccionStock(f) {
  const stock = {};
  f.lotesInventario.forEach(function (l) {
    const kg = stockLote(f, l).kg;
    if (kg > 0) stock[l.especieId] = (stock[l.especieId] || 0) + kg;
  });
  const consumo = consumoDiarioPorEspecie(f);
  return Object.keys(stock).map(function (especieId) {
    const c = consumo[especieId] || 0;
    return { especieId: especieId, nombre: nombreEspecie(f, especieId), stockKg: stock[especieId], consumoKgDia: c, dias: c > 0 ? stock[especieId] / c : null };
  }).sort(function (a, b) { return (a.dias === null ? Infinity : a.dias) - (b.dias === null ? Infinity : b.dias); });
}
