/* ============ FACTURACIÓN MASIVA, PLANTILLAS EXCEL E IMPORTADOR DE XML ============ */
const fld = (k, req, d, al = []) => ({k, req: !!req, d, al});
const LAYOUTS = {
  ie: {t: 'Ingresos y Egresos (I / E)', file: 'layout_ingresos_egresos', d: 'Varias filas con el mismo ID_Documento forman un solo CFDI con varios conceptos. Los datos del receptor que falten se toman de tu catálogo de clientes.',
    sections: [{k: 'docs', sheet: 'Comprobantes', t: 'Comprobantes', fields: [
      fld('ID_Documento', 1, 'Identificador interno. Filas con el mismo ID se agrupan en un CFDI.', ['folio', 'documento', 'factura', 'folio venta', 'ticket', 'pedido', 'id']),
      fld('Tipo', 0, 'I = ingreso, E = egreso. Vacío = I.', ['tipo comprobante']), fld('Serie', 0, 'Vacío = serie del emisor.'),
      fld('RFC_Receptor', 1, 'RFC del cliente (12 o 13 caracteres).', ['rfc', 'rfc cliente', 'rfc receptor']),
      fld('Nombre_Receptor', 0, 'Igual que en la Constancia, sin S.A. de C.V. Vacío = catálogo de clientes.', ['nombre', 'razon social', 'cliente', 'nombre cliente']),
      fld('Regimen_Receptor', 0, 'Clave c_RegimenFiscal (601, 612, 626…).', ['regimen', 'regimen fiscal']), fld('CP_Receptor', 0, 'CP del domicilio fiscal.', ['cp', 'codigo postal', 'domicilio fiscal']),
      fld('Uso_CFDI', 0, 'G01, G03, S01… Vacío = G03 (egreso G02).', ['uso', 'uso cfdi']), fld('Metodo_Pago', 0, 'PUE o PPD. Vacío = PUE.', ['metodo', 'metodo de pago']),
      fld('Forma_Pago', 0, 'Clave c_FormaPago. PPD siempre 99.', ['forma', 'forma de pago']), fld('Moneda', 0, 'MXN, USD, EUR… Vacío = MXN.', ['moneda']), fld('Tipo_Cambio', 0, 'Obligatorio si la moneda no es MXN.', ['tc', 'tipo de cambio']),
      fld('Tipo_Relacion', 0, '01 nota de crédito, 04 sustitución, 07 anticipo…', ['tipo relacion']), fld('UUID_Relacionado', 0, 'Folio fiscal relacionado (obligatorio en egresos).', ['uuid relacionado', 'folio fiscal relacionado']),
      fld('Clave_ProdServ', 1, 'Clave SAT de 8 dígitos.', ['clave sat', 'clave producto', 'producto sat', 'clave prodserv', 'clave']), fld('Clave_Unidad', 1, 'E48, H87, ACT, KGM…', ['unidad sat', 'clave unidad', 'um', 'u m', 'unidad']),
      fld('Descripcion', 1, 'Descripción del concepto.', ['descripcion', 'concepto', 'articulo', 'producto']), fld('Cantidad', 1, 'Mayor a cero.', ['cantidad', 'cant', 'piezas']),
      fld('Valor_Unitario', 1, 'Precio unitario sin IVA (hasta 6 decimales).', ['precio', 'valor unitario', 'precio unitario', 'pu', 'precio s/iva', 'precio sin iva']), fld('Descuento', 0, 'Importe de descuento del concepto.', ['descuento', 'desc']),
      fld('Perfil_Impuestos', 0, 'normal, frontera, tasa0, exento, honor_pm, arrend_pm, resico_serv, resico_bien, flete, personal, no_objeto. Vacío = perfil del cliente o normal.', ['impuestos', 'perfil', 'perfil impuestos']),
      fld('Total_Esperado', 0, 'Total de tu ERP para cuadrar con tolerancia de centavos (en la primera fila del documento).', ['total', 'importe total', 'total documento']), fld('Condiciones_Pago', 0, 'Texto libre, por ejemplo Crédito 30 días.', ['condiciones'])]}]},
  rep: {t: 'Complementos de pago (REP 2.0)', file: 'layout_complementos_pago', d: 'Solo capturas el pago y la factura PPD que cubre. El sistema calcula la parcialidad, los saldos y los impuestos proporcionales. Filas con el mismo ID_Pago se agrupan en un complemento.',
    sections: [{k: 'pagos', sheet: 'Pagos', t: 'Pagos', fields: [
      fld('ID_Pago', 1, 'Identificador del pago. Filas con el mismo ID = un complemento con varias facturas.', ['id pago', 'pago', 'folio pago', 'referencia pago']),
      fld('Fecha_Pago', 1, 'AAAA-MM-DD o AAAA-MM-DDTHH:MM.', ['fecha', 'fecha pago', 'fecha de pago']), fld('Forma_Pago', 1, 'Clave c_FormaPago (no 99).', ['forma', 'forma de pago']),
      fld('Moneda', 0, 'Vacío = MXN.', ['moneda']), fld('Tipo_Cambio', 0, 'Si el pago no es en MXN.', ['tc', 'tipo de cambio']),
      fld('RFC_Receptor', 1, 'RFC del cliente que pagó.', ['rfc', 'rfc cliente']), fld('UUID_Factura_PPD', 1, 'Folio fiscal de la factura PPD.', ['uuid', 'folio fiscal', 'uuid factura']),
      fld('Importe_Pagado', 1, 'Monto aplicado a esa factura.', ['importe', 'monto', 'pagado', 'importe pagado', 'abono']), fld('Num_Operacion', 0, 'Referencia bancaria (opcional).', ['operacion', 'referencia', 'num operacion'])]}]},
  cp: {t: 'Carta Porte 3.1 (Traslado T / Ingreso I)', file: 'Layout_CartaPorte_31', d: 'Tres hojas ligadas por ID_Viaje: datos del viaje, ubicaciones y mercancías. Si la placa o el RFC del operador ya están en tu flota, los demás datos se llenan solos.',
    sections: [
      {k: 'viajes', sheet: '1_Datos_Viaje', t: 'Datos del viaje', fields: [
        fld('ID_Viaje', 1, 'Identificador del viaje.', ['viaje', 'id viaje', 'folio viaje']), fld('Tipo', 1, 'T traslado propio, I ingreso por flete.', ['tipo']),
        fld('RFC_Receptor', 0, 'En T vacío = tu RFC. En I, el cliente del flete.', ['rfc', 'rfc cliente']), fld('Nombre_Receptor', 0, ''), fld('Regimen_Receptor', 0, ''), fld('CP_Receptor', 0, ''), fld('Uso_CFDI', 0, ''),
        fld('Importe_Flete', 0, 'Solo en tipo I: precio del flete sin IVA.', ['flete', 'importe flete', 'tarifa']), fld('Perfil_Impuestos', 0, 'Vacío = flete (ret. IVA 4%) si el cliente es persona moral.'), fld('Metodo_Pago', 0, ''), fld('Forma_Pago', 0, ''),
        fld('Placa', 1, 'Placa del vehículo, sin guiones.', ['placa', 'placas']), fld('Config_Vehicular', 0, 'C2, C3, T3S2… Vacío = de tu flota.'), fld('Anio_Modelo', 0, ''), fld('Peso_Bruto_Vehicular', 0, 'Toneladas.'),
        fld('Perm_SCT', 0, 'TPAF01, TPAF02…'), fld('Num_Permiso_SCT', 0, ''), fld('Aseguradora', 0, ''), fld('Poliza', 0, ''), fld('Remolque_SubTipo', 0, 'CTR007…'), fld('Remolque_Placa', 0, ''),
        fld('RFC_Operador', 1, 'RFC del operador.', ['operador', 'rfc operador']), fld('Nombre_Operador', 0, ''), fld('Licencia_Operador', 0, 'Licencia federal.')]},
      {k: 'ubic', sheet: '2_Ubicaciones', t: 'Ubicaciones', fields: [
        fld('ID_Viaje', 1, ''), fld('Tipo_Ubicacion', 1, 'Origen o Destino.', ['tipo']), fld('RFC', 1, 'Remitente o destinatario.'), fld('Nombre', 1, ''),
        fld('Fecha_Hora', 1, 'AAAA-MM-DDTHH:MM (salida en origen, llegada en destino).', ['fecha', 'fecha hora']), fld('Codigo_Postal', 1, 'Único dato de domicilio obligatorio: con él se completan las claves SAT.', ['cp', 'codigo postal', 'c p']), fld('Colonia', 0, 'Clave c_Colonia de 4 dígitos que pertenezca al CP (o “0001 - Nombre”). Si el CP tiene una sola colonia se llena sola.', ['colonia']), fld('Calle', 0, ''), fld('Distancia_Km', 0, 'Obligatoria en destinos.', ['distancia', 'km']),
        fld('Pais', 0, 'AUTOCALCULADA por el sistema (MEX). Puedes dejarla vacía.', ['pais']), fld('Clave_Estado', 0, 'AUTOCALCULADA por el sistema desde el CP (c_Estado). Puedes dejarla vacía.', ['estado', 'clave estado']), fld('Clave_Municipio', 0, 'AUTOCALCULADA por el sistema desde el CP (c_Municipio). Puedes dejarla vacía.', ['municipio', 'clave municipio']), fld('Clave_Localidad', 0, 'AUTOCALCULADA por el sistema desde el CP (c_Localidad). Vacía si el CP es rural.', ['localidad', 'ciudad', 'clave localidad'])]},
      {k: 'merc', sheet: '3_Mercancias', t: 'Mercancías', fields: [
        fld('ID_Viaje', 1, ''), fld('BienesTransp', 1, 'Clave SAT de 8 dígitos.', ['clave', 'clave sat', 'bienes']), fld('Descripcion', 1, ''), fld('Cantidad', 1, ''), fld('Clave_Unidad', 1, 'KGM, XBX, H87…', ['unidad']),
        fld('PesoKg', 1, 'Peso en kilogramos.', ['peso', 'peso kg']), fld('MaterialPeligroso', 0, 'Sí o No.', ['peligroso']), fld('Cve_Material_Peligroso', 0, 'Clave UN.'), fld('Embalaje', 0, '4G, 1A1…'), fld('Valor_Mercancia', 0, '')]}]},
  plat: {t: 'Retenciones a plataformas tecnológicas', file: 'layout_retenciones_plataformas', d: 'Una fila por socio, conductor o vendedor y periodo. Calcula ISR e IVA retenidos y emite una constancia de retenciones 2.0 por fila.',
    sections: [{k: 'socios', sheet: 'Socios', t: 'Socios', fields: [
      fld('Nombre', 1, 'Nombre o razón social.', ['nombre', 'socio', 'conductor', 'vendedor']), fld('RFC', 0, 'Obligatorio si Tiene_RFC = Sí.', ['rfc']), fld('CURP', 0, 'Obligatoria si Tiene_RFC = No.', ['curp']),
      fld('CP_Fiscal', 0, 'CP del domicilio fiscal.', ['cp', 'codigo postal']), fld('Tiene_RFC', 1, 'Sí o No.', ['tiene rfc']),
      fld('Mes_Inicial', 1, '1 a 12.', ['mes', 'mes inicial', 'periodo']), fld('Mes_Final', 0, 'Vacío = mes inicial.'), fld('Ejercicio', 1, 'Año, por ejemplo 2026.', ['ejercicio', 'anio', 'año']),
      fld('Tipo_De_Servicio', 1, 'Transporte, Hospedaje o Bienes y servicios.', ['servicio', 'tipo servicio', 'tipo de servicio']), fld('Subtotal_Sin_IVA', 1, 'Ingresos del periodo sin IVA.', ['subtotal', 'ingresos', 'monto', 'base']),
      fld('Total_Retenido_Esperado', 0, 'Para cuadrar con tu reporte (tolerancia de centavos).', ['retenido', 'total retenido'])]}]}
};
const PLAT_TASAS = {
  lif: {t: 'Ley de Ingresos 2026', transporte: 0.025, hospedaje: 0.04, bienes: 0.025},
  lisr: {t: 'Texto del art. 113-A LISR', transporte: 0.021, hospedaje: 0.04, bienes: 0.01}
};
const LAYOUT_EJ = {
  ie: () => ({docs: [
    ['F-1001', 'I', '', 'XIA190128J61', 'XENON INDUSTRIAL ARTICLES', '601', '76343', 'G03', 'PPD', '99', 'MXN', '', '', '', '78101802', 'E48', 'Flete Monterrey - Querétaro, caja seca 53 pies', 1, 28500, '', 'flete', 35840, 'Crédito 30 días'],
    ['F-1001', 'I', '', 'XIA190128J61', 'XENON INDUSTRIAL ARTICLES', '601', '76343', 'G03', 'PPD', '99', 'MXN', '', '', '', '78121603', 'E48', 'Maniobras de carga y descarga', 1, 3500, '', 'flete', '', 'Crédito 30 días'],
    ['F-1002', 'I', '', 'URE180429TM6', 'UNIVERSIDAD ROBOTICA ESPAÑOLA', '601', '86991', 'G03', 'PUE', '03', 'MXN', '', '', '', '80101504', 'E48', 'Consultoría en planeación estratégica (hora)', 20, 1850, '', 'normal', 42920, ''],
    ['F-1003', 'I', '', 'CACX7605101P8', 'XOCHILT CASAS CHAVEZ', '612', '36257', 'G03', 'PUE', '28', 'MXN', '', '', '', '14111507', 'XBX', 'Caja de papel bond carta', 3, 689, 50, 'normal', 2339.72, '']]}),
  rep: () => ({pagos: [['PAG-01', '2026-10-21T12:30', '03', 'MXN', '', 'XIA190128J61', '5FB2822E-396D-4725-8521-CDC4BDD20CCF', 20000, 'SPEI 0981234']]}),
  cp: () => ({viajes: [['V-01', 'T', '', '', '', '', '', '', '', '', '', '84AB3C', 'T3S2', '2022', '36', 'TPAF01', 'SCT-0751-NL', 'Seguros del Norte', 'RC-2026-44871', 'CTR007', '9KX441', 'MOSR800101AB3', 'RAUL MORALES SOTO', 'NL0457821'],
    ['V-02', 'I', 'XIA190128J61', 'XENON INDUSTRIAL ARTICLES', '601', '76343', 'G03', 28500, 'flete', 'PPD', '99', '84AB3C', '', '', '', '', '', '', '', '', '', 'MOSR800101AB3', '', '']],
    ubic: [['V-01', 'Origen', 'EKU9003173C9', 'ESCUELA KEMPER URGATE', '2026-10-23T06:00', '66600', '1354', 'Av. Miguel Alemán 1200', ''], ['V-01', 'Destino', 'XIA190128J61', 'XENON INDUSTRIAL ARTICLES', '2026-10-23T16:30', '76343', '', '', 725],
      ['V-02', 'Origen', 'XIA190128J61', 'XENON INDUSTRIAL ARTICLES', '2026-10-24T07:00', '76343', '', '', ''], ['V-02', 'Destino', 'XIA190128J61', 'XENON INDUSTRIAL ARTICLES', '2026-10-24T19:00', '66600', '1355', '', 725]],
    merc: [['V-01', '14111507', 'Caja de papel bond carta', 120, 'XBX', 2760, 'No', '', '', 82680], ['V-02', '31201500', 'Cinta adhesiva industrial', 400, 'XBX', 3200, 'No', '', '', '']]}),
  plat: () => ({socios: [['JUAN PEREZ LOPEZ', 'PELJ800101AB1', '', '64000', 'Sí', 10, 10, 2026, '01', 18500, ''], ['MARIA GOMEZ RUIZ', '', 'GORM900215MNLMZR03', '', 'No', 10, 10, 2026, '05', 7200, ''], ['HOSPEDAJE LA LOMA', 'HLL150310QK5', '', '37700', 'Sí', 10, 10, 2026, '04', 24000, '']]})
};
const normH = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
const pad0 = (v, n) => { const s = String(v ?? '').trim(); return /^\d+$/.test(s) && s.length < n ? s.padStart(n, '0') : s; };
function normFecha(v) {
  let s = String(v ?? '').trim(); if (!s) return '';
  if (/^\d+(\.\d+)?$/.test(s) && num(s) > 30000) s = serialToDate(num(s));
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2})(?::\d{2})?)?$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}T${pad(m[4] || 12)}:${m[5] || '00'}`;
  m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}T${pad(m[4] || 12)}:${m[5] || '00'}`;
  return '';
}
const siNo = v => /^(s|si|sí|1|true|x|yes)\b/i.test(String(v ?? '').trim());
const PERFIL_AL = {normal: 'normal', general: 'normal', iva16: 'normal', '16': 'normal', frontera: 'frontera', iva8: 'frontera', tasa0: 'tasa0', iva0: 'tasa0', exento: 'exento', honorarios: 'honor_pm', honorpm: 'honor_pm', arrendamiento: 'arrend_pm', arrendpm: 'arrend_pm', resico: 'resico_serv', resicoserv: 'resico_serv', resicobien: 'resico_bien', resicobienes: 'resico_bien', flete: 'flete', fletes: 'flete', personal: 'personal', noobjeto: 'no_objeto'};
const perfilKey = v => { const s = String(v ?? '').trim(); if (!s) return 'normal'; if (PRESETS[s]) return s; return PERFIL_AL[normH(s)] || null; };
const estadoClave = v => { const s = String(v || '').trim(); if (CAT.estados.some(e => e[0] === s.toUpperCase())) return s.toUpperCase(); const e = CAT.estados.find(x => normH(x[1]) === normH(s)); return e ? e[0] : s.toUpperCase(); };

S.mas = {tab: 'plantillas', layout: 'ie', step: 'upload', tables: [], map: {}, rows: {}, tol: '0.01', filter: 'all', sec: '', dry: null, plat: 'lif', xi: {items: []}};
COLL.mapeo = 'mapeos'; S.mapeos = [];

/* ---- Plantillas ---- */
function layoutSheets(key, withEj = true) {
  const L = LAYOUTS[key], ej = withEj ? LAYOUT_EJ[key]() : {};
  const sheets = L.sections.map(s => ({name: s.sheet, rows: [s.fields.map(f => f.k)].concat(ej[s.k] || [])}));
  const ins = [['Hoja', 'Columna', 'Obligatoria', 'Descripción']];
  L.sections.forEach(s => s.fields.forEach(f => ins.push([s.sheet, f.k, f.req ? 'Sí' : 'No', f.d])));
  ins.push([], ['Perfiles de impuestos', 'Clave', '', 'Qué aplica']); Object.entries(PRESETS).forEach(([k, p]) => ins.push(['', k, '', `${p.t} — ${p.ley}`]));
  if (key === 'plat') { ins.push([], ['Tasas de retención', 'Servicio', '', 'ISR con RFC (LIF 2026) · sin RFC 20% · IVA 8% (50%) con RFC, 16% sin RFC']); ins.push(['', 'Transporte', '', '2.5%'], ['', 'Hospedaje', '', '4%'], ['', 'Bienes y servicios', '', '2.5%']); }
  sheets.push({name: 'Instrucciones', rows: ins, widths: [16, 26, 12, 90]});
  return sheets;
}
function viewPlantillas() {
  return `<div class="tplgrid">${Object.entries(LAYOUTS).map(([k, L]) => `<article class="tpl"><header><p class="eyebrow">${L.sections.map(s => s.sheet).join(' · ')}</p><h3>${esc(L.t)}</h3></header><p class="small">${esc(L.d)}</p>
  <details><summary>Ver columnas (${L.sections.reduce((a, s) => a + s.fields.length, 0)})</summary>${L.sections.map(s => `<p class="eyebrow">${esc(s.sheet)}</p><ul class="cols">${s.fields.map(f => `<li><span class="mono">${f.k}</span>${f.req ? '<b class="req">*</b>' : ''}${f.d ? `<small>${esc(f.d)}</small>` : ''}</li>`).join('')}</ul>`).join('')}</details>
  <div class="row wrap"><button class="btn sm" data-a="tplXlsx" data-k="${k}">Descargar Excel</button>${L.sections.length === 1 ? `<button class="btn ghost sm" data-a="tplCsv" data-k="${k}">Descargar CSV</button>` : ''}<button class="btn ghost sm" data-a="masEjemplo" data-k="${k}">Probar con datos de ejemplo</button></div></article>`).join('')}</div>`;
}

/* ---- Carga, mapeo y simulación ---- */
function autoMap(key) {
  const L = LAYOUTS[key], T = S.mas.tables, map = {};
  L.sections.forEach((s, si) => {
    let ti = T.findIndex(t => normH(t.name) === normH(s.sheet));
    if (ti < 0) { const score = T.map(t => s.fields.filter(f => t.headers.some(h => normH(h) === normH(f.k))).length); ti = L.sections.length === 1 ? 0 : score.indexOf(Math.max(...score)); if (L.sections.length > 1 && Math.max(...score) === 0) ti = Math.min(si, T.length - 1); }
    const t = T[ti] || {headers: []}, used = new Set(), cols = {};
    s.fields.forEach(f => { const cands = [f.k, ...f.al].map(normH); const h = t.headers.find(h => !used.has(h) && cands.includes(normH(h))); if (h) { cols[f.k] = h; used.add(h); } });
    s.fields.forEach(f => { if (cols[f.k]) return; const cands = [f.k, ...f.al].map(normH).filter(c => c.length >= 4); const h = t.headers.find(h => !used.has(h) && cands.some(c => normH(h).includes(c))); if (h) { cols[f.k] = h; used.add(h); } });
    map[s.k] = {sheet: ti, cols, fixed: {}};
  });
  return map;
}
function applyMap(run = true) {
  const L = LAYOUTS[S.mas.layout]; S.mas.rows = {};
  L.sections.forEach(s => {
    const m = S.mas.map[s.k] || {cols: {}, fixed: {}}, t = S.mas.tables[m.sheet] || {rows: []};
    S.mas.rows[s.k] = t.rows.map((r, i) => { const o = {_i: i}; s.fields.forEach(f => { const src = m.cols[f.k]; let v = src === '=fijo' ? (m.fixed[f.k] || '') : src ? String(r[src] ?? '') : ''; if (f.cat && f.cat !== 'TieneRFC') v = parseClave(v); o[f.k] = v; }); return o; });
  });
  S.mas.sec = L.sections[0].k; if (run) { S.mas.step = 'review'; runDry(); }
}
function loadTables(tables, label) {
  S.mas.tables = tables; S.mas.file = label; S.mas.map = autoMap(S.mas.layout); S.mas.step = 'map';
  const L = LAYOUTS[S.mas.layout];
  const saved = S.mapeos.filter(m => m.layout === S.mas.layout).find(m => L.sections.every(s => { const mm = m.map[s.k]; const t = tables[mm ? mm.sheet : 0]; return mm && t && Object.values(mm.cols).every(h => h === '=fijo' || t.headers.includes(h)); }));
  if (saved) { S.mas.map = clone(saved.map); toast(`Se aplicó tu mapeo guardado “${saved.nombre}”.`, 'ok'); }
}
function sampleTables(key, erp) {
  if (key === 'ie' && erp) {
    const h = ['Folio venta', 'Fecha', 'RFC Cliente', 'Razón social', 'Régimen', 'C.P.', 'Uso', 'Producto SAT', 'U.M.', 'Concepto', 'Cant.', 'Precio s/IVA', 'Total'];
    const rows = [['V-88231', '2026-10-21', 'URE180429TM6', 'UNIVERSIDAD ROBOTICA ESPAÑOLA', '601', '86991', 'G03', '43211503', 'H87', 'Laptop 14 pulgadas 16 GB', '2', '18990', '45170.40'], ['V-88231', '2026-10-21', 'URE180429TM6', 'UNIVERSIDAD ROBOTICA ESPAÑOLA', '601', '86991', 'G03', '43211708', 'H87', 'Mouse inalámbrico', '2', '480', ''],
      ['V-88232', '2026-10-21', 'IIA040805DZ4', 'INDISTRIA ILUMINADORA DE ALMACENES S.A. DE C.V.', '601', '62661', 'G03', '44103103', 'H87', 'Tóner láser negro', '6', '1290', '8978.40'], ['V-88233', '2026-10-21', 'CACX7605101P8', 'XOCHILT CASAS CHAVEZ', '612', '36257', 'G03', '14111507', 'XBX', 'Papel bond carta', '4', '689', '3196.96']];
    return [{name: 'Ventas ERP', headers: h, rows: rows.map(r => Object.fromEntries(h.map((k, i) => [k, r[i]])))}];
  }
  const ej = LAYOUT_EJ[key](), L = LAYOUTS[key], em = EM();
  if (key === 'ie') { ej.docs.push(['F-1004', 'I', '', 'CACX7605101P8', 'XOCHILT CASAS CHAVEZ', '601', '36257', 'G03', 'PUE', '03', 'MXN', '', '', '', '80101504', 'E48', 'Asesoría fiscal mensual', 1, 5000, '', 'normal', '', 5800, '']); ej.docs.push(['F-1005', 'I', '', 'URE180429TM6', '', '', '', '', 'PUE', '03', 'MXN', '', '', '', '84111502', 'E48', 'Contabilidad financiera octubre', 1, 12000, '', 'normal', '', 13920.30, '']); }
  if (key === 'rep') {
    const pend = pendientes();
    if (!pend.length) { ej.pagos = [['PAG-01', '2026-10-21T12:30', '03', 'MXN', '', 'XIA190128J61', 'AAAAAAAA-0000-4000-8000-000000000000', 1000, '']]; toast('No tienes facturas PPD con saldo. Importa los XML de ejemplo en “Importar XML PPD” para probar este layout.', 'warn'); }
    else { const a = pend[0], b = pend[1]; ej.pagos = [['PAG-01', nowLocal().slice(0, 10) + 'T10:15', '03', a.moneda, '', a.receptor.rfc, a.uuid, r2(Math.min(a.saldo, 10000)), 'SPEI 0981234']]; if (b) ej.pagos.push(['PAG-02', nowLocal().slice(0, 10) + 'T11:40', '28', b.moneda, '', b.receptor.rfc, b.uuid, b.saldo, 'TDD 4421']); ej.pagos.push(['PAG-03', nowLocal().slice(0, 10) + 'T12:00', '03', 'MXN', '', a.receptor.rfc, '0F4E1C2A-1B3D-4E5F-8A9B-112233445566', 1500, '']); }
  }
  if (key === 'cp') { ej.viajes.forEach(v => { if (v[1] === 'T') v[2] = ''; }); ej.ubic[0][2] = em.rfc; ej.ubic[0][3] = em.nombre; ej.ubic[3][8] = ''; ej.ubic[2][10] = 'Querétaro'; ej.ubic[2][11] = 'El Marqués'; }
  if (key === 'plat') ej.socios.push(['PEDRO RAMIREZ', 'RAPE85O7O1', '', '64000', 'Sí', 10, 10, 2026, '01', 9300, ''], ['LUIS TORRES VEGA', 'TOVL750505RT2', '', '66220', 'Sí', 10, 10, 2026, '06', 15000, 1575]);
  return L.sections.map(s => ({name: s.sheet, headers: s.fields.map(f => f.k), rows: (ej[s.k] || []).map(r => Object.fromEntries(s.fields.map((f, i) => [f.k, String(r[i] ?? '')])))}));
}

function runDry() {
  const k = S.mas.layout; let res;
  try { res = ({ie: dryIE, rep: dryREP, cp: dryCP, plat: dryPLAT})[k](); } catch (e) { console.error(e); res = {docs: [], poliza: [], err: e.message}; }
  res.cell = new Set(); res.wcell = new Set(); res.rowDoc = new Map();
  res.docs.forEach((d, di) => { d.errs.forEach(e => { if (e.cell) res.cell.add(e.cell); }); (d.warns || []).forEach(w => { if (w && w.cell) res.wcell.add(w.cell); }); d.rows.forEach(r => res.rowDoc.set(r.sec + '|' + r.i, di)); });
  S.mas.dry = res; bitaSyncExcel();
}
const addErr = (errs, m, sec, row, f, fix, code) => { const cell = row && f ? `${sec}|${row._i}|${f}` : null; if (cell && errs.some(e => e.cell === cell)) return; errs.push({m, cell, fix, code, sev: 'crit'}); };
const ATTR_IE = {Rfc: 'RFC_Receptor', Nombre: 'Nombre_Receptor', RegimenFiscalReceptor: 'Regimen_Receptor', DomicilioFiscalReceptor: 'CP_Receptor', UsoCFDI: 'Uso_CFDI', FormaPago: 'Forma_Pago', MetodoPago: 'Metodo_Pago', TipoCambio: 'Tipo_Cambio', CfdiRelacionados: 'UUID_Relacionado', CfdiRelacionado: 'UUID_Relacionado', ClaveProdServ: 'Clave_ProdServ', ClaveUnidad: 'Clave_Unidad', Cantidad: 'Cantidad', Descripcion: 'Descripcion', ValorUnitario: 'Valor_Unitario', Descuento: 'Descuento', ObjetoImp: 'Perfil_Impuestos', Impuestos: 'Perfil_Impuestos', Total: 'Valor_Unitario'};
function groupBy(rows, key) { const g = new Map(); rows.forEach(r => { const k = String(r[key] || '').trim() || `(fila ${r._i + 2})`; if (!g.has(k)) g.set(k, []); g.get(k).push(r); }); return g; }
function receptorDesde(d, h, tipoDef) {
  const rfc = String(h.RFC_Receptor || '').trim().toUpperCase(), cli = S.clientes.find(c => c.rfc === rfc);
  Object.assign(d.receptor, {rfc, nombre: String(h.Nombre_Receptor || (cli && cli.nombre) || '').toUpperCase().trim(), regimen: pad0(h.Regimen_Receptor || (cli && cli.regimen) || '', 3), cp: pad0(h.CP_Receptor || (cli && cli.cp) || '', 5), uso: String(h.Uso_CFDI || (cli && cli.uso) || tipoDef).toUpperCase().trim()});
  return cli;
}
function polizaIE(docs) {
  const ok = docs.filter(d => d.ok), s = ok.reduce((a, d) => { const sg = d.tipo === 'E' ? -1 : 1; a.sub += sg * (d.k.sub - d.k.des); a.iva += sg * d.k.tras.filter(t => t.imp === '002').reduce((x, t) => x + t.importe, 0); a.ieps += sg * d.k.tras.filter(t => t.imp === '003').reduce((x, t) => x + t.importe, 0); a.risr += sg * d.k.ret.filter(t => t.imp === '001').reduce((x, t) => x + t.importe, 0); a.riva += sg * d.k.ret.filter(t => t.imp === '002').reduce((x, t) => x + t.importe, 0); a.tot += sg * d.k.total; return a; }, {sub: 0, iva: 0, ieps: 0, risr: 0, riva: 0, tot: 0});
  return [['Comprobantes a emitir', `${ok.length} de ${docs.length}`, true], ['Suma de subtotales', money(r2(s.sub))], ['IVA trasladado', money(r2(s.iva))], s.ieps ? ['IEPS trasladado', money(r2(s.ieps))] : null, ['Retenciones ISR', money(r2(s.risr))], ['Retenciones IVA', money(r2(s.riva))], ['Gran total', money(r2(s.tot)), true]].filter(Boolean);
}
function dryIE() {
  const em = EM(), docs = [];
  for (const [key, rs] of groupBy(S.mas.rows.docs || [], 'ID_Documento')) {
    const errs = [], warns = [], h = rs[0]; rs.forEach(r => candados('docs', r, errs, warns)); const tipo = String(h.Tipo || 'I').trim().toUpperCase() || 'I';
    if (!['I', 'E'].includes(tipo)) addErr(errs, 'Tipo debe ser I o E.', 'docs', h, 'Tipo');
    const d = newDraft(tipo === 'E' ? 'E' : 'I'); d.saveCliente = false;
    if (String(h.Serie || '').trim()) d.serie = String(h.Serie).trim().toUpperCase();
    const cli = receptorDesde(d, h, tipo === 'E' ? 'G02' : 'G03');
    d.metodoPago = String(h.Metodo_Pago || 'PUE').trim().toUpperCase(); d.formaPago = h.Forma_Pago ? pad0(h.Forma_Pago, 2) : (d.metodoPago === 'PPD' ? '99' : '03');
    d.moneda = String(h.Moneda || 'MXN').trim().toUpperCase(); d.tipoCambio = String(h.Tipo_Cambio || ''); d.condiciones = h.Condiciones_Pago || '';
    if (String(h.UUID_Relacionado || '').trim()) d.relacion = {tipo: pad0(h.Tipo_Relacion || (tipo === 'E' ? '01' : '04'), 2), uuids: String(h.UUID_Relacionado).trim().toUpperCase()};
    else if (tipo === 'E') d.relacion = {tipo: '', uuids: ''};
    cruzados(d, h, errs, warns, 'docs');
    const pDef = (cli && cli.preset) || 'normal';
    d.conceptos = rs.map(r => {
      const c = newConcepto(); Object.assign(c, {clave: pad0(r.Clave_ProdServ, 8), unidad: String(r.Clave_Unidad || '').toUpperCase().trim(), descripcion: String(r.Descripcion || '').trim(), cantidad: String(r.Cantidad || '').trim(), vu: String(r.Valor_Unitario || '').trim(), descuento: String(r.Descuento || '').trim()});
      const pk = String(r.Perfil_Impuestos || '').trim() ? perfilKey(r.Perfil_Impuestos) : pDef;
      if (!pk) addErr(errs, `Perfil de impuestos “${r.Perfil_Impuestos}” desconocido. Usa uno de la hoja Instrucciones.`, 'docs', r, 'Perfil_Impuestos');
      else { const p = PRESETS[pk]; Object.assign(c, {objeto: p.obj, iva: p.iva, retIsr: p.isr, retIva: p.riva}); }
      const ob = String(r.Objeto_Imp || '').trim(); if (ob) { c.objeto = ob; if (!['02', '05'].includes(ob)) Object.assign(c, {iva: '', retIsr: '', retIva: ''}); else if (!c.iva && !num(c.retIsr) && !num(c.retIva)) c.iva = '0.160000'; }
      return c;
    });
    d.preset = perfilKey(h.Perfil_Impuestos) || pDef;
    const v = validar(d, em);
    v.E.forEach(e => { const mc = e.m.match(/^Concepto (\d+):/); addErr(errs, e.m, 'docs', mc ? rs[+mc[1] - 1] : h, ATTR_IE[e.attr] || (mc ? 'Clave_ProdServ' : 'RFC_Receptor'), e.fix, codeOf(e)); });
    let note = '';
    const espRow = rs.find(r => String(r.Total_Esperado || '').trim() !== '');
    if (espRow) { const diff = r2(v.k.total - num(espRow.Total_Esperado)); if (Math.abs(diff) > num(S.mas.tol) + 1e-9) addErr(errs, `El total calculado (${money(v.k.total)}) no cuadra con el esperado (${money(num(espRow.Total_Esperado))}): diferencia de ${money(diff)}.`, 'docs', espRow, 'Total_Esperado', rs.length === 1 ? 'netoLote' : null, 'TOTAL_NO_CUADRA'); else if (Math.abs(diff) >= 0.005) addWarn(warns, `Diferencia de ${money(diff)} entre el total calculado y el esperado: se ajustó por tolerancia de centavos.`, 'docs', espRow, 'Total_Esperado', 'TOLERANCIA'); }
    docs.push({key, rows: rs.map(r => ({sec: 'docs', i: r._i})), ok: !errs.length, errs, warns: warns.concat(v.W.map(w => ({m: w.m, cell: ATTR_IE[w.attr] ? `docs|${h._i}|${ATTR_IE[w.attr]}` : null, code: codeOf(w), sev: 'warn'}))), note, d, k: v.k, tipo, resumen: `${tipo} · ${d.receptor.rfc} · ${money(v.k.total, d.moneda)}`});
  }
  return {docs, poliza: polizaIE(docs)};
}
function dryREP() {
  const em = EM(), docs = [], run = new Map(), parc = new Map(), tol = num(S.mas.tol);
  for (const [key, rs] of groupBy(S.mas.rows.pagos || [], 'ID_Pago')) {
    const errs = [], warns = [], h = rs[0]; rs.forEach(r => candados('pagos', r, errs, warns)); const fecha = normFecha(h.Fecha_Pago), forma = pad0(h.Forma_Pago, 2), rfc = String(h.RFC_Receptor || '').trim().toUpperCase(), moneda = String(h.Moneda || 'MXN').trim().toUpperCase();
    if (!fecha) addErr(errs, 'Fecha de pago inválida. Usa AAAA-MM-DD o AAAA-MM-DDTHH:MM.', 'pagos', h, 'Fecha_Pago'); else if (new Date(fecha) > new Date()) addErr(errs, 'La fecha del pago no puede ser futura.', 'pagos', h, 'Fecha_Pago');
    if (!CAT.formaPago.some(f => f[0] === forma) || forma === '99') addErr(errs, 'Forma de pago inválida: usa la clave real (03, 01, 28…), nunca 99.', 'pagos', h, 'Forma_Pago');
    if (!rfcTipo(rfc)) addErr(errs, 'RFC del receptor inválido.', 'pagos', h, 'RFC_Receptor');
    if (moneda !== 'MXN' && !(num(h.Tipo_Cambio) > 0)) addErr(errs, 'Captura el tipo de cambio del día del pago.', 'pagos', h, 'Tipo_Cambio');
    const P = {rfc, fecha, forma, moneda, tc: String(h.Tipo_Cambio || ''), numOp: String(h.Num_Operacion || ''), monto: '0', sel: {}}; const det = []; let iva = 0, ret = 0;
    rs.forEach(r => {
      const u = String(r.UUID_Factura_PPD || '').trim().toUpperCase(), inv = S.cfdis.find(c => c.uuid === u && c.emisorId === em.id);
      let imp = r2(num(r.Importe_Pagado));
      if (!inv) return addErr(errs, `No encontramos la factura PPD ${u.slice(0, 8)}… en tu base. Si se emitió en otro sistema, súbela en “Importar XML PPD”.`, 'pagos', r, 'UUID_Factura_PPD', 'irXml', 'UUID_NO_ENCONTRADO');
      if (inv.tipo !== 'I' || inv.metodo !== 'PPD') return addErr(errs, `La factura ${inv.serie}${inv.folio} no es PPD: no lleva complemento de pago.`, 'pagos', r, 'UUID_Factura_PPD');
      if (inv.estado === 'Cancelado') return addErr(errs, `La factura ${inv.serie}${inv.folio} está cancelada.`, 'pagos', r, 'UUID_Factura_PPD');
      if (rfc && inv.receptor.rfc !== rfc) addErr(errs, `La factura ${inv.serie}${inv.folio} es de ${inv.receptor.rfc}, no de ${rfc}.`, 'pagos', r, 'RFC_Receptor');
      if (inv.moneda !== moneda) addErr(errs, `La factura está en ${inv.moneda}; registra el pago en la misma moneda.`, 'pagos', r, 'Moneda');
      if (!(imp > 0)) return addErr(errs, 'El importe pagado debe ser mayor a cero.', 'pagos', r, 'Importe_Pagado');
      const saldo = run.has(inv.id) ? run.get(inv.id) : inv.saldo;
      if (imp - saldo > tol + 1e-9) addErr(errs, `Pagas ${money(imp)} pero el saldo de ${inv.serie}${inv.folio} es ${money(saldo)}.`, 'pagos', r, 'Importe_Pagado');
      else if (imp > saldo) imp = saldo;
      const n = (inv.pagos || []).length + (parc.get(inv.id) || 0) + 1; parc.set(inv.id, (parc.get(inv.id) || 0) + 1); run.set(inv.id, r2(Math.max(0, saldo - imp)));
      P.sel[inv.id] = f2(num(P.sel[inv.id]) + imp); det.push(`${inv.serie}${inv.folio}: parcialidad ${n}, saldo ${money(saldo)} → ${money(r2(saldo - imp))}`);
      const p = imp / inv.total; iva += inv.imp.tras.filter(t => t.imp === '002').reduce((a, t) => a + t.importe * p, 0); ret += inv.imp.ret.reduce((a, t) => a + t.importe * p, 0);
    });
    P.monto = f2(Object.values(P.sel).reduce((a, v) => a + num(v), 0));
    docs.push({key, rows: rs.map(r => ({sec: 'pagos', i: r._i})), ok: !errs.length, errs, warns, note: det.join(' · '), P, iva: r2(iva), ret: r2(ret), resumen: `${rfc} · ${money(num(P.monto))}`});
  }
  const ok = docs.filter(d => d.ok), facturas = new Set(ok.flatMap(d => Object.keys(d.P.sel)));
  return {docs, poliza: [['Complementos a emitir', `${ok.length} de ${docs.length}`, true], ['Facturas afectadas', String(facturas.size)], ['IVA cobrado (proporcional)', money(r2(ok.reduce((a, d) => a + d.iva, 0)))], ['Retenciones (proporcional)', money(r2(ok.reduce((a, d) => a + d.ret, 0)))], ['Monto total cobrado', money(r2(ok.reduce((a, d) => a + num(d.P.monto), 0))), true]]};
}
function dryCP() {
  const em = EM(), docs = [], U = groupBy(S.mas.rows.ubic || [], 'ID_Viaje'), Mx = groupBy(S.mas.rows.merc || [], 'ID_Viaje');
  for (const [key, vs] of groupBy(S.mas.rows.viajes || [], 'ID_Viaje')) {
    const errs = [], warns = [], h = vs[0]; vs.forEach(r => candados('viajes', r, errs, warns)); (U.get(key) || []).forEach(r => candados('ubic', r, errs, warns)); (Mx.get(key) || []).forEach(r => candados('merc', r, errs, warns)); const tipo = String(h.Tipo || 'T').trim().toUpperCase(), us = U.get(key) || [], ms = Mx.get(key) || [];
    if (vs.length > 1) addErr(errs, 'El ID_Viaje está repetido en Datos_Viaje.', 'viajes', vs[1], 'ID_Viaje');
    if (!['T', 'I'].includes(tipo)) addErr(errs, 'Tipo debe ser T o I.', 'viajes', h, 'Tipo');
    const d = newDraft(tipo === 'I' ? 'I' : 'T', {cp: true}); d.saveCliente = false;
    if (tipo === 'I') {
      const cli = receptorDesde(d, h, 'G03'); d.conceptos = [Object.assign(fleteConcepto(), {vu: String(h.Importe_Flete || '')})];
      const pk = String(h.Perfil_Impuestos || '').trim() ? perfilKey(h.Perfil_Impuestos) : ((cli && cli.preset) || (rfcTipo(d.receptor.rfc) === 'M' ? 'flete' : 'normal'));
      if (!pk) addErr(errs, 'Perfil de impuestos desconocido.', 'viajes', h, 'Perfil_Impuestos'); else applyPreset(d, pk);
      d.metodoPago = String(h.Metodo_Pago || 'PUE').toUpperCase(); d.formaPago = h.Forma_Pago ? pad0(h.Forma_Pago, 2) : (d.metodoPago === 'PPD' ? '99' : '03');
      cruzados(d, h, errs, warns, 'viajes');
    } else {
      const rfc = String(h.RFC_Receptor || '').trim().toUpperCase(); if (rfc && rfc !== em.rfc) { receptorDesde(d, h, 'S01'); d.receptor.uso = 'S01'; }
      d.conceptos = ms.map(r => Object.assign(newConcepto(), {clave: pad0(r.BienesTransp, 8), unidad: String(r.Clave_Unidad || '').toUpperCase(), cantidad: String(r.Cantidad || ''), descripcion: String(r.Descripcion || ''), objeto: '01', vu: '0'}));
      if (!d.conceptos.length) d.conceptos = [Object.assign(newConcepto(), {objeto: '01', vu: '0'})];
    }
    d.cp.ubic = us.map(r => { const t = /^d/i.test(String(r.Tipo_Ubicacion || '')) ? 'Destino' : 'Origen'; const u = {tipo: t, rfc: String(r.RFC || '').trim().toUpperCase(), nombre: String(r.Nombre || '').toUpperCase(), fecha: normFecha(r.Fecha_Hora), cp: pad0(r.Codigo_Postal, 5), pais: String(r.Pais || '').trim(), estado: String(r.Clave_Estado || '').trim(), municipio: String(r.Clave_Municipio || '').trim(), localidad: String(r.Clave_Localidad || '').trim(), colonia: String(r.Colonia || '').trim(), calle: r.Calle || '', dist: String(r.Distancia_Km || '')}; geoCompletarFila(r, u); return u; });
    d.cp.merc = ms.map(r => ({bien: pad0(r.BienesTransp, 8), desc: String(r.Descripcion || ''), cant: String(r.Cantidad || ''), unidad: String(r.Clave_Unidad || '').toUpperCase(), peso: String(r.PesoKg || ''), valor: String(r.Valor_Mercancia || ''), peligroso: siNo(r.MaterialPeligroso) ? 'Sí' : 'No', cvePel: String(r.Cve_Material_Peligroso || '').toUpperCase(), embalaje: String(r.Embalaje || '').toUpperCase()}));
    const placa = String(h.Placa || '').trim().toUpperCase().replace(/[-\s]/g, ''), fv = S.vehiculos.find(v => v.placa === placa) || {};
    const pick = (col, k) => String(h[col] || '').trim() || fv[k] || '';
    d.cp.veh = {perm: pick('Perm_SCT', 'perm').toUpperCase(), numPerm: pick('Num_Permiso_SCT', 'numPerm'), config: pick('Config_Vehicular', 'config').toUpperCase(), placa, anio: pick('Anio_Modelo', 'anio'), pesoVeh: pick('Peso_Bruto_Vehicular', 'pesoVeh'), aseg: pick('Aseguradora', 'aseg'), poliza: pick('Poliza', 'poliza'), remSub: pick('Remolque_SubTipo', 'remSub').toUpperCase(), remPlaca: pick('Remolque_Placa', 'remPlaca').toUpperCase()};
    const orfc = String(h.RFC_Operador || '').trim().toUpperCase(), op = S.operadores.find(o => o.rfc === orfc) || {};
    d.cp.ops = orfc ? [{tipo: '01', rfc: orfc, nombre: String(h.Nombre_Operador || op.nombre || '').toUpperCase(), licencia: String(h.Licencia_Operador || op.licencia || '').toUpperCase()}] : [];
    if (!us.length) addErr(errs, 'Este viaje no tiene filas en la hoja Ubicaciones.', 'viajes', h, 'ID_Viaje');
    if (!ms.length) addErr(errs, 'Este viaje no tiene filas en la hoja Mercancias.', 'viajes', h, 'ID_Viaje');
    const v = validar(d, em);
    v.E.forEach(e => {
      let m;
      if ((m = e.m.match(/^(Origen|Destino) (\d+):/))) { const r = us[+m[2] - 1]; const f = GEO_CODES.has(e.code) && e.fix === 'geoFix' ? ({Estado: 'Clave_Estado', Municipio: 'Clave_Municipio', Localidad: 'Clave_Localidad', Colonia: 'Colonia', Pais: 'Pais'})[e.attr] || 'Codigo_Postal' : /RFC/.test(e.m) ? 'RFC' : /postal/.test(e.m) ? 'Codigo_Postal' : /estado/.test(e.m) ? 'Clave_Estado' : /fecha/i.test(e.m) ? 'Fecha_Hora' : /distancia/i.test(e.m) ? 'Distancia_Km' : 'Nombre'; return addErr(errs, e.m, 'ubic', r, f, e.fix, codeOf(e)); }
      if ((m = e.m.match(/^Mercancía (\d+):/))) { const r = ms[+m[1] - 1]; const f = /clave UN|embalaje/i.test(e.m) ? 'Cve_Material_Peligroso' : /peso/i.test(e.m) ? 'PesoKg' : /cantidad/i.test(e.m) ? 'Cantidad' : /descripci/i.test(e.m) ? 'Descripcion' : 'BienesTransp'; return addErr(errs, e.m, 'merc', r, f); }
      if (/llegada debe ser posterior/.test(e.m)) return addErr(errs, e.m, 'ubic', us[us.length - 1], 'Fecha_Hora');
      const f = /placa del remolque|remolque/i.test(e.m) ? 'Remolque_Placa' : /placa/i.test(e.m) ? 'Placa' : /número de permiso/i.test(e.m) ? 'Num_Permiso_SCT' : /permiso/i.test(e.m) ? 'Perm_SCT' : /configuraci/i.test(e.m) ? 'Config_Vehicular' : /año/i.test(e.m) ? 'Anio_Modelo' : /peso bruto vehicular|4\.5 t/i.test(e.m) ? 'Peso_Bruto_Vehicular' : /aseguradora|póliza/i.test(e.m) ? 'Aseguradora' : /operador|licencia/i.test(e.m) ? 'Licencia_Operador' : /^Figura/.test(e.m) ? 'RFC_Operador' : /valor unitario|total del comprobante/i.test(e.m) ? 'Importe_Flete' : (ATTR_IE[e.attr] || 'ID_Viaje');
      addErr(errs, e.m, 'viajes', h, f);
    });
    const km = d.cp.ubic.filter(u => u.tipo === 'Destino').reduce((a, u) => a + num(u.dist), 0), kg = d.cp.merc.reduce((a, x) => a + num(x.peso), 0);
    docs.push({key, rows: vs.map(r => ({sec: 'viajes', i: r._i})).concat(us.map(r => ({sec: 'ubic', i: r._i})), ms.map(r => ({sec: 'merc', i: r._i}))), ok: !errs.length, errs, warns: warns.concat(v.W.map(w => ({m: w.m, cell: null, code: codeOf(w), sev: 'warn'}))), note: `${f2(km)} km · ${kg.toLocaleString('es-MX')} kg`, d, k: v.k, km, kg, tipo, resumen: `${tipo === 'I' ? 'Ingreso (flete)' : 'Traslado'} · ${d.cp.veh.placa}`});
  }
  const ok = docs.filter(d => d.ok), fl = ok.filter(d => d.tipo === 'I');
  return {docs, poliza: [['Cartas porte a emitir', `${ok.length} de ${docs.length}`, true], ['Kilómetros', f2(ok.reduce((a, d) => a + d.km, 0))], ['Peso transportado (kg)', ok.reduce((a, d) => a + d.kg, 0).toLocaleString('es-MX')], ['Fletes facturados (subtotal)', money(r2(fl.reduce((a, d) => a + d.k.sub, 0)))], ['IVA trasladado', money(r2(fl.reduce((a, d) => a + d.k.tras.filter(t => t.imp === '002').reduce((x, t) => x + t.importe, 0), 0)))], ['Retención IVA', money(r2(fl.reduce((a, d) => a + d.k.totR, 0)))], ['Total de fletes', money(r2(fl.reduce((a, d) => a + d.k.total, 0))), true]]};
}
const CURP_RE = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[0-9A-Z]\d$/;
function dryPLAT() {
  const em = EM(), docs = [], T = PLAT_TASAS[S.mas.plat] || PLAT_TASAS.lif, tol = num(S.mas.tol);
  (S.mas.rows.socios || []).forEach(r => {
    const errs = [], warns = []; candados('socios', r, errs, warns); const tiene = siNo(r.Tiene_RFC), rfc = String(r.RFC || '').trim().toUpperCase(), curp = String(r.CURP || '').trim().toUpperCase();
    if (!String(r.Nombre || '').trim()) addErr(errs, 'Escribe el nombre.', 'socios', r, 'Nombre');
    if (tiene && (!rfcTipo(rfc) || ['PG', 'EXT'].includes(rfcTipo(rfc)))) addErr(errs, 'RFC inválido. Si el socio no dio RFC, pon Tiene_RFC = No y su CURP.', 'socios', r, 'RFC');
    if (!tiene && !CURP_RE.test(curp)) addErr(errs, 'Sin RFC necesitas una CURP válida de 18 caracteres.', 'socios', r, 'CURP');
    const cp = pad0(r.CP_Fiscal || (tiene ? '' : em.cp), 5); if (tiene && !/^\d{5}$/.test(cp)) addErr(errs, 'CP fiscal de 5 dígitos.', 'socios', r, 'CP_Fiscal');
    const mi = num(r.Mes_Inicial), mf = num(r.Mes_Final || r.Mes_Inicial), ej = num(r.Ejercicio);
    if (!(mi >= 1 && mi <= 12)) addErr(errs, 'Mes inicial de 1 a 12.', 'socios', r, 'Mes_Inicial');
    if (!(mf >= mi && mf <= 12)) addErr(errs, 'Mes final inválido.', 'socios', r, 'Mes_Final');
    if (!(ej >= 2019 && ej <= new Date().getFullYear())) addErr(errs, 'Ejercicio inválido.', 'socios', r, 'Ejercicio');
    const sc = parseClave(r.Tipo_De_Servicio), sv = normH(r.Tipo_De_Servicio), tipoS = ['01', '02'].includes(sc) ? 'transporte' : sc === '03' ? 'hospedaje' : sc === '04' ? 'bienes' : /transp|entreg|viaj/.test(sv) ? 'transporte' : /hosped|aloj/.test(sv) ? 'hospedaje' : /bien|serv|enaj|venta/.test(sv) ? 'bienes' : '';
    if (!tipoS) addErr(errs, 'Tipo de servicio: Transporte, Hospedaje o Bienes y servicios.', 'socios', r, 'Tipo_De_Servicio');
    const base = r2(num(r.Subtotal_Sin_IVA)); if (!(base > 0)) addErr(errs, 'El subtotal debe ser mayor a cero.', 'socios', r, 'Subtotal_Sin_IVA');
    const tIsr = tiene ? (T[tipoS] || 0) : 0.20, tIva = tiene ? 0.08 : 0.16;
    const isr = r2(base * tIsr), iva = r2(base * tIva), tot = r2(isr + iva);
    if (String(r.Total_Retenido_Esperado || '').trim() !== '') { const diff = r2(tot - num(r.Total_Retenido_Esperado)); if (Math.abs(diff) > tol + 1e-9) addErr(errs, `La retención calculada (${money(tot)}) no cuadra con la esperada (${money(num(r.Total_Retenido_Esperado))}).`, 'socios', r, 'Total_Retenido_Esperado'); }
    const R = {cve: '26', desc: '', rfc: tiene ? rfc : 'XAXX010101000', curp: tiene ? '' : curp, nombre: String(r.Nombre || '').toUpperCase().trim(), cp, mesIni: pad(mi || 1), mesFin: pad(mf || mi || 1), ejercicio: String(ej), montoOp: f2(base), montoExent: '0', imps: [{imp: '001', base: f2(base), monto: f2(isr), tipo: '05'}, {imp: '002', base: f2(base), monto: f2(iva), tipo: '01'}]};
    docs.push({key: `${R.nombre || 'Fila ' + (r._i + 2)}`, rows: [{sec: 'socios', i: r._i}], ok: !errs.length, errs, warns, note: `ISR ${r2(tIsr * 100)}% ${money(isr)} · IVA ${r2(tIva * 100)}% ${money(iva)}`, R, isr, iva, base, sinRfc: !tiene, resumen: `${tiene ? rfc : 'Sin RFC'} · ret. ${money(tot)}`});
  });
  const ok = docs.filter(d => d.ok);
  return {docs, poliza: [['Constancias a emitir', `${ok.length} de ${docs.length}`, true], ['Ingresos (base)', money(r2(ok.reduce((a, d) => a + d.base, 0)))], ['ISR retenido', money(r2(ok.reduce((a, d) => a + d.isr, 0)))], ['IVA retenido', money(r2(ok.reduce((a, d) => a + d.iva, 0)))], ['Sin RFC (tasas 20% y 16%)', String(ok.filter(d => d.sinRfc).length)], ['Total retenido', money(r2(ok.reduce((a, d) => a + d.isr + d.iva, 0))), true]]};
}

function viewCarga() {
  const M = S.mas, L = LAYOUTS[M.layout];
  if (M.step === 'upload') return `<section class="card"><h2><span class="n">1</span>¿Qué vas a cargar?</h2><div class="quick small">${Object.entries(LAYOUTS).map(([k, l]) => `<button class="qcard ${M.layout === k ? 'on' : ''}" data-a="masLayout" data-k="${k}"><b>${esc(l.t)}</b><span>${l.sections.map(s => s.sheet).join(' · ')}</span></button>`).join('')}</div>
    <h2><span class="n">2</span>Sube tu archivo</h2>
    <label class="drop" id="dzlote" for="lotefile"><b>Arrastra aquí tu Excel (.xlsx) o CSV</b><span>Puede ser nuestra plantilla o el reporte de tu ERP, punto de venta o plataforma: después eliges qué columna corresponde a cada campo.</span><input type="file" id="lotefile" accept=".xlsx,.csv,.txt,.xls" data-a2="loteFile" hidden></label>
    <div class="row wrap"><button class="btn ghost sm" data-a="masEjemplo" data-k="${M.layout}">Probar con datos de ejemplo</button>${M.layout === 'ie' ? '<button class="btn ghost sm" data-a="masErp">Probar con un reporte de ERP (mapeo)</button>' : ''}<button class="btn sm" data-a="simExcel">Simular carga masiva de Excel</button><button class="btn ghost sm" data-a="tplXlsx" data-k="${M.layout}">Descargar plantilla</button></div>
    ${S.mapeos.length ? `<p class="muted small">Mapeos guardados: ${S.mapeos.map(m => `${esc(m.nombre)} (${esc(LAYOUTS[m.layout].t)})`).join(', ')}. Se aplican solos cuando las columnas coinciden.</p>` : ''}</section>`;
  if (M.step === 'map') return `<section class="card"><div class="bh"><h2><span class="n">3</span>Asocia tus columnas</h2><span class="muted small">${esc(M.file || '')}</span></div>
    <p class="muted small">Ya asociamos las columnas que reconocimos. Revisa las demás o asigna un valor fijo (por ejemplo, el mismo uso del CFDI para todo el lote).</p>
    ${L.sections.map(s => { const m = M.map[s.k], t = M.tables[m.sheet] || {headers: [], rows: []}; return `<h3 class="sub">${esc(s.t)}</h3>${M.tables.length > 1 ? `<div class="fld"><label>Hoja de tu archivo</label><select data-mapsheet="${s.k}">${M.tables.map((x, i) => `<option value="${i}"${i === m.sheet ? ' selected' : ''}>${esc(x.name)} (${x.rows.length} filas)</option>`).join('')}</select></div>` : ''}
      <div class="tw"><table class="maptbl"><thead><tr><th>Campo del CFDI</th><th>Columna de tu archivo</th><th>Ejemplo</th></tr></thead><tbody>${s.fields.map(f => { const src = m.cols[f.k] || ''; const ex = src === '=fijo' ? (m.fixed[f.k] || '') : src ? (t.rows[0] || {})[src] : ''; return `<tr class="${f.req && !src ? 'need' : ''}"><td><span class="mono">${f.k}</span>${f.req ? ' <b class="req">*</b>' : ''}<br><small class="muted">${esc(f.d)}</small></td><td><select data-mapcol="${s.k}|${f.k}" aria-label="Columna para ${f.k}"><option value="">— Sin asignar —</option>${t.headers.map(h => `<option${h === src ? ' selected' : ''}>${esc(h)}</option>`).join('')}<option value="=fijo"${src === '=fijo' ? ' selected' : ''}>Valor fijo…</option></select>${src === '=fijo' ? `<input data-mapfix="${s.k}|${f.k}" value="${esc(m.fixed[f.k] || '')}" placeholder="Valor para todas las filas" aria-label="Valor fijo para ${f.k}">` : ''}</td><td class="small mono">${esc(String(ex ?? '').slice(0, 40))}</td></tr>`; }).join('')}</tbody></table></div>`; }).join('')}
    <div class="row wrap"><input id="mapname" class="grow" placeholder="Nombre del mapeo, ej. Ventas ERP de Xenon" aria-label="Nombre del mapeo"><select id="mapcli" aria-label="Cliente del mapeo">${opts(S.clientes.map(c => [c.rfc, c.rfc + ' · ' + c.nombre]), '', false, 'Sin cliente específico')}</select><button class="btn ghost sm" data-a="mapSave">Guardar mapeo como plantilla del cliente</button></div>
    <footer class="mf"><button class="btn ghost" data-a="masStep" data-s="upload">Cambiar archivo</button><button class="btn" data-a="mapApply">Simular el lote</button></footer></section>`;
  return reviewHTML();
}
function reviewHTML() {
  const M = S.mas, L = LAYOUTS[M.layout], R = M.dry || {docs: [], poliza: []};
  const nOk = R.docs.filter(d => d.ok).length, nBad = R.docs.length - nOk;
  const sec = L.sections.find(s => s.k === M.sec) || L.sections[0];
  const rows = (M.rows[sec.k] || []).filter(r => { const di = R.rowDoc.get(sec.k + '|' + r._i); const ok = di !== undefined && R.docs[di].ok; return M.filter === 'all' || (M.filter === 'ok' ? ok : !ok); });
  const shown = rows.slice(0, 200), firstOf = new Set(); const seen = new Set();
  shown.forEach(r => { const di = R.rowDoc.get(sec.k + '|' + r._i); if (!seen.has(di)) { seen.add(di); firstOf.add(r._i); } });
  return `<section class="card"><div class="bh"><h2><span class="n">4</span>Póliza resumen del lote</h2><span class="muted small">${esc(M.file || '')} · Simulación: aún no se timbra nada</span></div>
  ${R.err ? `<div class="alert bad"><span>${esc(R.err)}</span></div>` : ''}
  <div class="poliza">${R.poliza.map(p => `<div class="pz${p[2] ? ' strong' : ''}"><span>${esc(p[0])}</span><b>${esc(p[1])}</b></div>`).join('')}</div>
  <div class="row wrap"><div class="fld"><label for="loteTol">Tolerancia de cuadre</label><select id="loteTol" data-a2="loteTol">${opts([['0.00', 'Exacto'], ['0.01', '± 1 centavo'], ['0.05', '± 5 centavos'], ['0.10', '± 10 centavos'], ['1.00', '± 1 peso']], M.tol, false)}</select></div>
  ${M.layout === 'plat' ? '<p class="note small">Tasas según el catálogo c_TipoDeServ 2026 del SAT y la matriz de errores del complemento de Plataformas Tecnológicas (persona moral: ISR 2.5%; sin RFC: ISR 20% e IVA 100%).</p>' : ''}</div></section>
  <section class="card"><div class="bh"><h2><span class="n">5</span>Pre-validación</h2><div class="seg">${[['all', `Todas (${R.docs.length})`], ['ok', `Listas (${nOk})`], ['bad', `Con errores (${nBad})`]].map(([k, t]) => `<button class="${M.filter === k ? 'on' : ''}" data-a="loteFiltro" data-k="${k}">${t}</button>`).join('')}</div></div>
  ${L.sections.length > 1 ? `<div class="seg">${L.sections.map(s => `<button class="${s.k === sec.k ? 'on' : ''}" data-a="loteSec" data-k="${s.k}">${esc(s.t)} (${(M.rows[s.k] || []).length})</button>`).join('')}</div>` : ''}
  <p class="muted small">Corrige cualquier celda directamente: la validación se repite al instante. Las celdas en rojo son las que causan el error.</p>
  <div class="tw lotewrap"><table class="lote"><thead><tr><th>Estado</th><th>Documento</th>${sec.fields.map(f => `<th>${f.k}</th>`).join('')}</tr></thead><tbody>
  ${shown.map(r => { const di = R.rowDoc.get(sec.k + '|' + r._i), doc = R.docs[di]; const ok = doc && doc.ok;
    let tr = `<tr class="${ok ? 'rok' : 'rbad'}"><td>${ok ? (doc.warns.length ? chip('Lista · ajustada', 'warn') : chip('Lista', 'ok')) : chip('Error', 'bad')}</td><td class="mono small">${esc(doc ? doc.key : '')}</td>${sec.fields.map(f => `<td><input id="mc_${sec.k}_${r._i}_${f.k}" class="cell${R.cell.has(`${sec.k}|${r._i}|${f.k}`) ? ' bad' : R.wcell && R.wcell.has(`${sec.k}|${r._i}|${f.k}`) ? ' warn' : ''}" data-mc="${sec.k}|${r._i}|${f.k}" value="${esc(r[f.k])}" aria-label="${f.k} fila ${r._i + 2}"></td>`).join('')}</tr>`;
    if (doc && firstOf.has(r._i) && (doc.errs.length || doc.note || doc.warns.length)) tr += `<tr class="msg"><td colspan="${sec.fields.length + 2}">${doc.errs.map(e => `<span class="e">${esc(e.m)}${e.fix === 'netoLote' ? ` <button class="btn sm" data-a="netoLote" data-key="${esc(doc.key)}">Recalcular el valor unitario desde el total esperado</button>` : ''}${e.fix === 'geoFix' ? ` <button class="btn sm" data-a="geoFixLote" data-cell="${esc(e.cell)}">Autocorregir claves según Código Postal SAT</button>` : ''}${e.fix === 'folioLote' ? ` <button class="btn sm" data-a="folioLote" data-cell="${esc(e.cell)}">Reasignar al siguiente folio libre (${esc(folioLoteLabel(e.cell))})</button>` : ''}${e.fix === 'irXml' ? ' <button class="btn sm ghost" data-a="masTab" data-k="xml">Importar XML PPD</button>' : ''}</span>`).join('')}${doc.warns.map(w => `<span class="w">${esc(w.m)}</span>`).join('')}${doc.note ? `<span class="i">${esc(doc.note)}</span>` : ''}</td></tr>`;
    return tr; }).join('') || `<tr><td colspan="${sec.fields.length + 2}" class="muted">Sin filas en este filtro.</td></tr>`}
  </tbody></table></div>${rows.length > 200 ? `<p class="muted small">Se muestran las primeras 200 de ${rows.length} filas.</p>` : ''}
  <footer class="mf"><button class="btn ghost" data-a="masStep" data-s="map">Volver al mapeo</button><button class="btn ghost" data-a="masStep" data-s="upload">Otro archivo</button><button class="btn" data-a="loteReview" ${nOk ? '' : 'disabled'}>Timbrar ${nOk} ${M.layout === 'rep' ? 'complementos' : M.layout === 'plat' ? 'constancias' : 'comprobantes'} listos</button></footer></section>`;
}
async function emitirLote(onProg) {
  const M = S.mas, docs = M.dry.docs.filter(d => d.ok), out = [], fails = [];
  for (let i = 0; i < docs.length; i++) {
    const d = docs[i]; onProg(i, docs.length, d.key);
    try {
      let rec;
      if (M.layout === 'ie' || M.layout === 'cp') { if (!String(d.d.folio || '').trim() || folioUsado(d.d.serie, d.d.folio)) d.d.folio = String(nextFree(d.d.serie)); rec = await emitirDraft(d.d, {silent: true}); }
      else if (M.layout === 'rep') rec = await emitirPago(d.P);
      else rec = await emitirRet(d.R);
      out.push({key: d.key, rec});
    } catch (e) { fails.push({key: d.key, m: e.message || String(e)}); }
  }
  const done = new Set(out.map(o => o.key));
  const keepRows = new Set(); M.dry.docs.filter(d => done.has(d.key)).forEach(d => d.rows.forEach(r => keepRows.add(r.sec + '|' + r.i)));
  Object.keys(M.rows).forEach(s => { M.rows[s] = M.rows[s].filter(r => !keepRows.has(s + '|' + r._i)); });
  runDry(); return {out, fails};
}

/* ---- Importador de XML externos (facturas PPD y sus complementos de pago) ---- */
function viewXml() {
  const X = S.mas.xi, em = EM();
  const inv = X.items.filter(i => i.kind === 'I'), pays = X.items.filter(i => i.kind === 'P');
  return `<section class="card"><h2><span class="n">1</span>Sube los XML</h2>
  <p class="muted small">Facturas PPD emitidas por ${esc(em.rfc)} en otro sistema o en el portal del SAT. Si también subes sus complementos de pago, reconstruimos el saldo insoluto y la última parcialidad.</p>
  <label class="drop" id="dzxml" for="xmlfiles"><b>Arrastra aquí tus archivos .xml</b><span>Puedes soltar muchos a la vez, incluidos complementos de pago.</span><input type="file" id="xmlfiles" accept=".xml" multiple data-a2="xmlFiles" hidden></label>
  <div class="row wrap"><button class="btn ghost sm" data-a="xmlEjemplo">Cargar XML de ejemplo</button><button class="btn sm" data-a="simXml">Simular carga masiva de XMLs (50 archivos)</button>${X.items.length ? '<button class="btn ghost sm" data-a="xmlLimpiar">Quitar todos</button>' : ''}</div></section>
  ${X.items.length ? `<section class="card"><h2><span class="n">2</span>Revisa antes de importar</h2>
  <div class="tw"><table><thead><tr><th></th><th>Archivo</th><th>Tipo</th><th>Folio</th><th>Receptor</th><th class="n">Total</th><th>Pagos detectados</th><th class="n">Saldo insoluto</th><th>Estado</th></tr></thead><tbody>
  ${inv.concat(pays).concat(X.items.filter(i => !['I', 'P'].includes(i.kind))).map(i => `<tr><td>${i.kind === 'I' && i.ok ? `<input type="checkbox" data-xinc="${i.id}" ${i.include ? 'checked' : ''} aria-label="Importar ${esc(i.name)}">` : ''}</td><td class="small">${esc(i.name)}</td><td>${i.kind === 'I' ? 'Factura PPD' : i.kind === 'P' ? 'Complemento de pago' : esc(i.kind || '—')}</td><td class="mono small">${esc(i.folio || '')}<br>${esc((i.uuid || '').slice(0, 8))}</td><td class="small">${esc(i.receptor || '')}</td><td class="n">${i.total !== undefined ? money(i.total, i.moneda) : ''}</td><td class="small">${i.kind === 'I' ? (i.pagos.length ? i.pagos.map(p => `Parc. ${p.parc}: ${money(p.monto)}`).join('<br>') : 'Ninguno') : i.kind === 'P' ? esc(i.det || '') : ''}</td><td class="n">${i.kind === 'I' && i.ok ? `<input class="mono num" data-xsaldo="${i.id}" value="${f2(i.saldo)}" aria-label="Saldo insoluto">` : ''}</td><td>${i.ok ? chip(i.kind === 'P' ? 'Se aplicará' : i.warn ? 'Lista con aviso' : 'Lista', i.warn ? 'warn' : 'ok') : chip(i.msg || 'Omitida', i.kind === 'I' || i.kind === 'P' ? 'bad' : '')}${i.sat ? '<br>' + satMini(i.sat) : ''}${i.reg ? '<br><small class="muted">Folio registrado</small>' : ''}</td></tr>`).join('')}
  </tbody></table></div>
  <footer class="mf"><button class="btn" data-a="xmlImport" ${inv.some(i => i.ok && i.include) || pays.some(p => p.ok) ? '' : 'disabled'}>Importar ${inv.filter(i => i.ok && i.include).length} facturas</button></footer></section>` : ''}`;
}
async function xmlProcess(files) {
  const em = EM(), X = S.mas.xi;
  for (const f of files) {
    const it = {id: sid(), name: f.name, include: true, pagos: []};
    try {
      const txt = typeof f.text === 'function' ? await f.text() : f.data; const m = modelCFDI(txt);
      it.xml = txt; it.m = m; it.kind = m.tipo; it.uuid = String((m.tfd || {}).UUID || '').toUpperCase(); it.folio = (m.serie || '') + (m.folio || ''); it.receptor = m.receptor ? `${m.receptor.rfc} · ${m.receptor.nombre || ''}` : ''; it.moneda = m.moneda;
      if (m.kind === 'ret') { it.kind = 'Retenciones'; it.ok = false; it.msg = 'No aplica'; }
      else if (!it.uuid) { it.ok = false; it.msg = 'Sin timbre'; }
      else if (m.emisor.rfc !== em.rfc) { it.ok = false; it.msg = `Es de ${m.emisor.rfc}`; }
      else if (m.tipo === 'I') { it.total = m.total; if (m.metodoPago !== 'PPD') { it.ok = false; it.msg = 'Es PUE'; } else if (S.cfdis.some(c => c.uuid === it.uuid)) { it.ok = false; it.msg = 'Ya existe'; } else it.ok = true; }
      else if (m.tipo === 'P') { const n = m.pagos ? m.pagos.pagos.reduce((a, p) => a + p.doctos.length, 0) : 0; it.det = `${n} documento(s) · ${money(m.pagos ? num(m.pagos.totales.MontoTotalPagos) : 0)}`; it.ok = !S.cfdis.some(c => c.uuid === it.uuid); if (!it.ok) it.msg = 'Ya existe'; }
      else { it.ok = false; it.msg = 'No es PPD'; }
    } catch (e) { it.ok = false; it.kind = 'Error'; it.msg = e.message; }
    if (!X.items.some(x => x.uuid && x.uuid === it.uuid)) X.items.push(it);
  }
  xmlRecalc();
}
function xmlRecalc() {
  const X = S.mas.xi, pagos = {};
  X.items.filter(i => i.kind === 'P' && i.m && i.m.pagos).forEach(p => p.m.pagos.pagos.forEach(pg => pg.doctos.forEach(d => { const u = String(d.IdDocumento).toUpperCase(); (pagos[u] = pagos[u] || []).push({uuid: p.uuid, monto: num(d.ImpPagado), parc: num(d.NumParcialidad), saldo: num(d.ImpSaldoInsoluto), fecha: pg.FechaPago}); })));
  X.items.filter(i => i.kind === 'I').forEach(i => { i.pagos = (pagos[i.uuid] || []).sort((a, b) => a.parc - b.parc); if (!i.saldoManual) i.saldo = i.pagos.length ? i.pagos[i.pagos.length - 1].saldo : i.total; });
}
function recFromModel(m, xml, extra = {}) {
  const em = EM(), d = newDraft('I');
  Object.assign(d, {serie: m.serie, folio: m.folio, moneda: m.moneda, tipoCambio: m.tipoCambio, formaPago: m.formaPago, metodoPago: m.metodoPago, exportacion: m.exportacion || '01', lugarExp: m.lugar, condiciones: m.condiciones, preset: 'normal'});
  Object.assign(d.receptor, {rfc: m.receptor.rfc, nombre: m.receptor.nombre, regimen: m.receptor.regimen, cp: m.receptor.cp, uso: m.receptor.uso, residencia: m.receptor.residencia, numRegId: m.receptor.numRegId});
  d.conceptos = m.conceptos.map(c => { const iv = c.tras.find(t => t.imp === '002'), ie = c.tras.find(t => t.imp === '003'); return Object.assign(newConcepto(), {clave: c.clave, unidad: c.claveUnidad, cantidad: c.cantidad, descripcion: c.desc, noIdent: c.noIdent, vu: c.vu, descuento: c.descuento ? String(c.descuento) : '', objeto: c.objeto || '02', iva: iv ? (iv.factor === 'Exento' ? 'Exento' : iv.tasa) : '', retIsr: (c.ret.find(t => t.imp === '001') || {}).tasa || '', retIva: (c.ret.find(t => t.imp === '002') || {}).tasa || '', iepsCat: ie ? 'otro' : '', iepsFactor: ie ? ie.factor : '', iepsValor: ie ? ie.tasa : ''}); });
  const T = {}, Rt = {};
  m.conceptos.forEach(c => { c.tras.forEach(t => { const k = t.imp + '|' + t.factor + '|' + t.tasa; T[k] = T[k] || {imp: t.imp, factor: t.factor, tasa: t.tasa, base: 0, importe: 0}; T[k].base += t.base; T[k].importe += t.importe; }); c.ret.forEach(t => { Rt[t.imp] = Rt[t.imp] || {imp: t.imp, tasa: t.tasa, base: 0, importe: 0}; Rt[t.imp].base += t.base; Rt[t.imp].importe += t.importe; }); });
  return Object.assign({emisorId: em.id, tipo: m.tipo, serie: m.serie, folio: m.folio, fecha: m.fecha, uuid: String(m.tfd.UUID).toUpperCase(), estado: 'Vigente', receptor: {...m.receptor}, moneda: m.moneda, tc: num(m.tipoCambio) || 1, total: m.total, subtotal: m.subtotal, metodo: m.metodoPago, forma: m.formaPago, cp: !!m.cp, saldo: 0, pagos: [],
    imp: {tras: Object.values(T).map(t => ({...t, base: r2(t.base), importe: r2(t.importe)})), ret: Object.values(Rt).map(t => ({...t, base: r2(t.base), importe: r2(t.importe)})), total: m.total}, relacion: {tipo: '', uuids: ''}, draft: d, xml, externo: true}, extra);
}
function xmlEjemplos() {
  const em = EM(), mk = (serie, folio, rec, conceptos, fecha) => {
    const d = newDraft('I'); Object.assign(d, {serie, folio, metodoPago: 'PPD', formaPago: '99', condiciones: 'Crédito 30 días'}); Object.assign(d.receptor, rec); d.conceptos = conceptos.map(c => Object.assign(newConcepto(), c)); d.fecha = fecha;
    const k = calcDoc(d); return {xml: xmlCFDI(d, em, k, {tfd: {uuid: uid().toUpperCase(), fecha}}), k, d};
  };
  const a = mk('EXT', '501', {rfc: 'IIA040805DZ4', nombre: 'INDISTRIA ILUMINADORA DE ALMACENES', regimen: '601', cp: '62661', uso: 'G03'}, [{clave: '39121004', unidad: 'H87', cantidad: '8', descripcion: 'Tablero de distribución eléctrica', vu: '5000'}], '2026-09-12T10:20:00');
  const b = mk('EXT', '502', {rfc: 'KIJ0906199R1', nombre: 'KERNEL INDUSTIA JUGUETERA', regimen: '601', cp: '30230', uso: 'G01'}, [{clave: '24112700', unidad: 'H87', cantidad: '40', descripcion: 'Tarima de madera 1.20 x 1.00 m', vu: '400'}], '2026-09-19T16:05:00');
  const c = mk('EXT', '503', {rfc: 'URE180429TM6', nombre: 'UNIVERSIDAD ROBOTICA ESPAÑOLA', regimen: '601', cp: '86991', uso: 'G03'}, [{clave: '81111811', unidad: 'E48', cantidad: '1', descripcion: 'Soporte técnico mensual septiembre', vu: '8500'}], '2026-09-30T09:00:00');
  const ua = (a.xml.match(/UUID="([^"]+)"/) || [])[1], pay = 20000, p = pay / a.k.total;
  const base = r2(a.k.tras[0].base * p), iva = r2(a.k.tras[0].importe * p), pu = uid().toUpperCase(), fp = '2026-10-10T11:30:00';
  const pxml = `<?xml version="1.0" encoding="UTF-8"?>\n<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:pago20="http://www.sat.gob.mx/Pagos20" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" Version="4.0" Serie="EXTP" Folio="88" Fecha="${fp}" Sello="DEMO" NoCertificado="${em.csdNo || '00000000000000000000'}" Certificado="" SubTotal="0" Moneda="XXX" Total="0" TipoDeComprobante="P" Exportacion="01" LugarExpedicion="${em.cp}">
  <cfdi:Emisor Rfc="${xa(em.rfc)}" Nombre="${xa(em.nombre)}" RegimenFiscal="${em.regimen}"/>
  <cfdi:Receptor Rfc="IIA040805DZ4" Nombre="INDISTRIA ILUMINADORA DE ALMACENES" DomicilioFiscalReceptor="62661" RegimenFiscalReceptor="601" UsoCFDI="CP01"/>
  <cfdi:Conceptos><cfdi:Concepto ClaveProdServ="84111506" Cantidad="1" ClaveUnidad="ACT" Descripcion="Pago" ValorUnitario="0" Importe="0" ObjetoImp="01"/></cfdi:Conceptos>
  <cfdi:Complemento>
    <pago20:Pagos Version="2.0"><pago20:Totales TotalTrasladosBaseIVA16="${f2(base)}" TotalTrasladosImpuestoIVA16="${f2(iva)}" MontoTotalPagos="${f2(pay)}"/>
      <pago20:Pago FechaPago="${fp}" FormaDePagoP="03" MonedaP="MXN" TipoCambioP="1" Monto="${f2(pay)}">
        <pago20:DoctoRelacionado IdDocumento="${ua}" Serie="EXT" Folio="501" MonedaDR="MXN" EquivalenciaDR="1" NumParcialidad="1" ImpSaldoAnt="${f2(a.k.total)}" ImpPagado="${f2(pay)}" ImpSaldoInsoluto="${f2(a.k.total - pay)}" ObjetoImpDR="02"><pago20:ImpuestosDR><pago20:TrasladosDR><pago20:TrasladoDR BaseDR="${f2(base)}" ImpuestoDR="002" TipoFactorDR="Tasa" TasaOCuotaDR="0.160000" ImporteDR="${f2(iva)}"/></pago20:TrasladosDR></pago20:ImpuestosDR></pago20:DoctoRelacionado>
        <pago20:ImpuestosP><pago20:TrasladosP><pago20:TrasladoP BaseP="${f2(base)}" ImpuestoP="002" TipoFactorP="Tasa" TasaOCuotaP="0.160000" ImporteP="${f2(iva)}"/></pago20:TrasladosP></pago20:ImpuestosP>
      </pago20:Pago></pago20:Pagos>
    <tfd:TimbreFiscalDigital Version="1.1" UUID="${pu}" FechaTimbrado="${fp}" RfcProvCertif="DEMO000000000" SelloCFD="DEMO" NoCertificadoSAT="00000000000000000000" SelloSAT="DEMO-SIN-VALIDEZ-FISCAL"/>
  </cfdi:Complemento>
</cfdi:Comprobante>\n`;
  return [{name: 'EXT501_iluminadora.xml', data: a.xml}, {name: 'EXT502_kernel.xml', data: b.xml}, {name: 'EXT503_robotica.xml', data: c.xml}, {name: 'EXTP88_pago_parcial.xml', data: pxml}];
}
async function xmlImportar() {
  const X = S.mas.xi, em = EM(); let ni = 0, np = 0; const byUuid = {};
  for (const i of X.items.filter(i => i.kind === 'I' && i.ok && i.include)) {
    const rec = recFromModel(i.m, i.xml, {sat: i.sat || null, saldo: r2(num(i.saldo)), pagos: i.pagos.map(p => ({uuid: p.uuid, monto: p.monto, parc: p.parc, saldo: p.saldo, fecha: p.fecha}))});
    await saveRec('cfdi', rec); byUuid[rec.uuid] = rec; ni++;
  }
  for (const p of X.items.filter(i => i.kind === 'P' && i.ok)) {
    const m = p.m, pagosDe = [];
    for (const pg of m.pagos.pagos) for (const d of pg.doctos) {
      const u = String(d.IdDocumento).toUpperCase(), inv = byUuid[u] || S.cfdis.find(c => c.uuid === u && c.emisorId === em.id);
      if (inv) { pagosDe.push({id: inv.id, folio: (inv.serie || '') + (inv.folio || ''), monto: num(d.ImpPagado), parc: num(d.NumParcialidad)}); if (!byUuid[u] && !(inv.pagos || []).some(x => x.uuid === p.uuid)) { inv.pagos = (inv.pagos || []).concat([{uuid: p.uuid, monto: num(d.ImpPagado), parc: num(d.NumParcialidad), saldo: num(d.ImpSaldoInsoluto), fecha: pg.FechaPago}]); inv.saldo = num(d.ImpSaldoInsoluto); await saveRec('cfdi', inv); } }
    }
    await saveRec('cfdi', {emisorId: em.id, tipo: 'P', serie: m.serie, folio: m.folio, fecha: m.fecha, uuid: p.uuid, estado: 'Vigente', receptor: {...m.receptor}, moneda: m.pagos.pagos[0] ? m.pagos.pagos[0].MonedaP : 'MXN', total: 0, montoPago: num(m.pagos.totales.MontoTotalPagos), pagosDe, xml: p.xml, externo: true, sat: p.sat || null}); np++;
  }
  X.items = []; return {ni, np};
}

VIEWS.masiva = () => {
  const t = S.mas.tab;
  return `<header class="ph"><div><p class="eyebrow">Para despachos y áreas de facturación</p><h1>Facturación masiva y plantillas Excel</h1></div></header>
  <div class="seg tabs">${[['plantillas', 'Plantillas Excel'], ['carga', 'Carga masiva'], ['xml', 'Importar XML PPD']].map(([k, n]) => `<button class="${t === k ? 'on' : ''}" data-a="masTab" data-k="${k}">${n}</button>`).join('')}</div>
  <div id="prog">${S.mas.prog && t !== 'plantillas' && (S.mas.prog.kind === 'xml') === (t === 'xml') ? progHTML() : ''}</div>
  <div class="masbody">${t === 'plantillas' ? viewPlantillas() : t === 'carga' ? viewCarga() : viewXml()}</div>
  ${bitaHTML()}`;
};
function bindDrop(id, onFiles) {
  const z = document.getElementById(id); if (!z) return;
  ['dragenter', 'dragover'].forEach(ev => z.addEventListener(ev, e => { e.preventDefault(); z.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(ev => z.addEventListener(ev, e => { e.preventDefault(); z.classList.remove('over'); }));
  z.addEventListener('drop', e => { const fs = Array.from(e.dataTransfer.files || []); if (fs.length) onFiles(fs); });
}
const AFTER = {masiva: () => { bindDrop('dzlote', fs => A2.loteFile({files: fs})); bindDrop('dzxml', fs => A2.xmlFiles({files: fs})); const b = $('#bitadet'); if (b) b.addEventListener('toggle', () => { S._bitaOpen = b.open; }); }};
