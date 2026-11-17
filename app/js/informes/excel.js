/**
 * EXPORTAR A EXCEL (.xlsx) sin programas externos: la app arma el archivo ella misma.
 * Un .xlsx es un ZIP con archivos XML adentro; acá se generan esos XML y se empaquetan.
 *
 * crearExcel([{ nombre: 'Resumen', filas: [['Título'], ['Col 1', 'Col 2'], [1, 'texto']], anchos: [20, 12],
 *               encabezado: 1 (índice de la fila de títulos de columna, en negrita) }])
 */

function crearExcel(hojas) {
  const xml = function (texto) {
    return String(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  };
  const columna = function (n) {
    let s = '';
    n += 1;
    while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
    return s;
  };
  const nombresUsados = {};
  const nombreHoja = function (nombre) {
    let n = String(nombre).replace(/[\\\/?*\[\]:]/g, ' ').slice(0, 31) || 'Hoja';
    let base = n, i = 2;
    while (nombresUsados[n.toLowerCase()]) { n = base.slice(0, 28) + ' ' + i++; }
    nombresUsados[n.toLowerCase()] = true;
    return n;
  };

  const archivos = {};
  const nombres = hojas.map(function (h) { return nombreHoja(h.nombre); });

  hojas.forEach(function (hoja, indice) {
    const filas = hoja.filas || [];
    const columnasMax = filas.reduce(function (m, f) { return Math.max(m, f.length); }, 1);
    const anchos = hoja.anchos || [];
    let cols = '<cols>';
    for (let c = 0; c < columnasMax; c++) {
      const ancho = anchos[c] || Math.min(50, Math.max(10, ...filas.map(function (f) { return String(f[c] === undefined || f[c] === null ? '' : f[c]).length + 2; })));
      cols += '<col min="' + (c + 1) + '" max="' + (c + 1) + '" width="' + ancho + '" customWidth="1"/>';
    }
    cols += '</cols>';
    let datos = '<sheetData>';
    filas.forEach(function (fila, r) {
      const estilo = r === 0 && hoja.titulo !== false ? 2 : (r === hoja.encabezado ? 1 : 0);
      datos += '<row r="' + (r + 1) + '">';
      fila.forEach(function (valor, c) {
        if (valor === undefined || valor === null || valor === '') return;
        const ref = columna(c) + (r + 1);
        const s = estilo ? ' s="' + estilo + '"' : '';
        if (typeof valor === 'number' && isFinite(valor)) {
          datos += '<c r="' + ref + '"' + s + '><v>' + valor + '</v></c>';
        } else {
          datos += '<c r="' + ref + '" t="inlineStr"' + s + '><is><t xml:space="preserve">' + xml(valor) + '</t></is></c>';
        }
      });
      datos += '</row>';
    });
    datos += '</sheetData>';
    const congelar = hoja.encabezado !== undefined
      ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="' + (hoja.encabezado + 1) + '" topLeftCell="A' + (hoja.encabezado + 2) + '" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
      : '';
    archivos['xl/worksheets/sheet' + (indice + 1) + '.xml'] =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' + congelar + cols + datos + '</worksheet>';
  });

  archivos['[Content_Types].xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    hojas.map(function (h, i) {
      return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
    }).join('') + '</Types>';
  archivos['_rels/.rels'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
  archivos['xl/workbook.xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' +
    nombres.map(function (n, i) { return '<sheet name="' + xml(n) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('') +
    '</sheets></workbook>';
  archivos['xl/_rels/workbook.xml.rels'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    hojas.map(function (h, i) {
      return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>';
    }).join('') +
    '<Relationship Id="rId' + (hojas.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
  // Estilos: 0 normal · 1 encabezado (negrita, fondo verde claro) · 2 título (negrita grande)
  archivos['xl/styles.xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="14"/><color rgb="FF1B5E20"/><name val="Calibri"/></font></fonts>' +
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFE8F5E9"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
    '<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';

  return new Blob([crearZip(archivos)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/* ---------- ZIP (sin compresión, suficiente para Excel) ---------- */

const TABLA_CRC = (function () {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = TABLA_CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function crearZip(archivos) {
  const codificador = new TextEncoder();
  const partes = [];
  const central = [];
  let desplazamiento = 0;
  const entero = function (valor, bytes) {
    const a = new Uint8Array(bytes);
    for (let i = 0; i < bytes; i++) a[i] = (valor >>> (8 * i)) & 0xFF;
    return a;
  };
  Object.keys(archivos).forEach(function (nombre) {
    const datos = codificador.encode(archivos[nombre]);
    const nombreBytes = codificador.encode(nombre);
    const crc = crc32(datos);
    const local = [entero(0x04034b50, 4), entero(20, 2), entero(0x0800, 2), entero(0, 2), entero(0, 2), entero(0x21, 2),
      entero(crc, 4), entero(datos.length, 4), entero(datos.length, 4), entero(nombreBytes.length, 2), entero(0, 2), nombreBytes, datos];
    const centralEntrada = [entero(0x02014b50, 4), entero(20, 2), entero(20, 2), entero(0x0800, 2), entero(0, 2), entero(0, 2), entero(0x21, 2),
      entero(crc, 4), entero(datos.length, 4), entero(datos.length, 4), entero(nombreBytes.length, 2), entero(0, 2), entero(0, 2),
      entero(0, 2), entero(0, 2), entero(0, 4), entero(desplazamiento, 4), nombreBytes];
    local.forEach(function (p) { partes.push(p); desplazamiento += p.length; });
    centralEntrada.forEach(function (p) { central.push(p); });
  });
  const tamanoCentral = central.reduce(function (t, p) { return t + p.length; }, 0);
  const fin = [entero(0x06054b50, 4), entero(0, 2), entero(0, 2), entero(Object.keys(archivos).length, 2), entero(Object.keys(archivos).length, 2),
    entero(tamanoCentral, 4), entero(desplazamiento, 4), entero(0, 2)];
  return new Blob(partes.concat(central, fin));
}

/** Hace que el navegador descargue el archivo. */
function descargarArchivo(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  setTimeout(function () { URL.revokeObjectURL(url); enlace.remove(); }, 1000);
}

/** "Informe económico Huerta 2026-10-03.xlsx" sin caracteres raros. */
function nombreArchivo(texto, extension) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-') +
    '-' + hoyTexto() + '.' + extension;
}
