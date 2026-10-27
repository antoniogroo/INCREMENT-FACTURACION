/* ============ CANDADOS DEL SAT, BARRA DE PROGRESO Y BITÁCORA ============ */
/* Catálogos cerrados de las plantillas (hoja _Catalogos_SAT), formato "CLAVE - Descripción" */
const XLC = {
  Regimen: [['601', 'General de Ley Personas Morales'], ['603', 'Personas Morales con Fines no Lucrativos'], ['605', 'Sueldos y Salarios'], ['606', 'Arrendamiento'], ['612', 'Personas Físicas con Actividades Empresariales y Profesionales'], ['616', 'Sin obligaciones fiscales'], ['621', 'Incorporación Fiscal'], ['625', 'Plataformas Tecnológicas'], ['626', 'RESICO']],
  Uso: [['G01', 'Adquisición de mercancías'], ['G02', 'Devoluciones, descuentos o bonificaciones'], ['G03', 'Gastos en general'], ['I01', 'Construcciones'], ['I02', 'Mobiliario y equipo de oficina'], ['I03', 'Equipo de transporte'], ['I04', 'Equipo de cómputo y accesorios'], ['D01', 'Honorarios médicos'], ['S01', 'Sin efectos fiscales'], ['CP01', 'Pagos']],
  Metodo: [['PUE', 'Pago en una sola exhibición'], ['PPD', 'Pago en parcialidades o diferido']],
  Forma: [['01', 'Efectivo'], ['02', 'Cheque nominativo'], ['03', 'Transferencia electrónica de fondos'], ['04', 'Tarjeta de crédito'], ['28', 'Tarjeta de débito'], ['15', 'Condonación'], ['17', 'Compensación'], ['30', 'Aplicación de anticipos'], ['99', 'Por definir']],
  Objeto: [['01', 'No objeto de impuesto'], ['02', 'Sí objeto de impuesto'], ['03', 'Sí objeto del impuesto y no obligado al desglose'], ['04', 'Sí objeto del impuesto y no causa impuesto']],
  Moneda: [['MXN', 'Peso Mexicano'], ['USD', 'Dólar americano'], ['EUR', 'Euro'], ['XXX', 'Sin moneda (Pagos/Traslados)']],
  TipoRel: [['01', 'Nota de crédito'], ['02', 'Nota de débito'], ['03', 'Devolución de mercancía'], ['04', 'Sustitución de CFDI previos'], ['07', 'Aplicación de anticipo']],
  TipoServ: [['01', 'Transporte terrestre de pasajeros'], ['02', 'Entrega de bienes'], ['03', 'Hospedaje'], ['04', 'Enajenación de bienes y prestación de servicios']],
  TieneRFC: [['SI', '', 'SI (Retención reducida Art. 113-A)'], ['NO', '', 'NO (Retención máxima 20% ISR y 16% IVA)']],
  TipoIE: [['I', 'Ingreso'], ['E', 'Egreso']], TipoCP: [['T', 'Traslado'], ['I', 'Ingreso por flete']],
  Perfil: Object.entries(PRESETS).map(([k, p]) => [k, p.t]), Unidad: CAT.unidad, TipoUbic: [['Origen'], ['Destino']], Estado: CAT.estados, SiNo: [['Sí'], ['No']],
  Perm: CAT.permSCT, Config: CAT.configVeh, Remolque: CAT.subTipoRem, Embalaje: CAT.embalaje
};
const XLC_TITLE = {Regimen: 'c_RegimenFiscal', Uso: 'c_UsoCFDI', Metodo: 'c_MetodoPago', Forma: 'c_FormaPago', Objeto: 'c_ObjetoImp', Moneda: 'c_Moneda', TipoRel: 'c_TipoRelacion', TipoServ: 'Tipo_De_Servicio', TieneRFC: 'Tiene_RFC', TipoIE: 'Tipo (I/E)', TipoCP: 'Tipo (T/I)', Perfil: 'Perfil_Impuestos', Unidad: 'c_ClaveUnidad', TipoUbic: 'Tipo_Ubicacion', Estado: 'c_Estado', SiNo: 'Sí/No', Perm: 'c_TipoPermiso', Config: 'c_ConfigAutotransporte', Remolque: 'c_SubTipoRem', Embalaje: 'c_TipoEmbalaje'};
/* Catálogo completo del SAT con el que se valida cada clave al cargar */
const FULLCAT = {Regimen: CAT.regimen, Uso: CAT.uso, Metodo: CAT.metodoPago, Forma: CAT.formaPago, Objeto: CAT.objetoImp, Moneda: CAT.moneda.concat([['XXX', 'Sin moneda']]), TipoRel: CAT.tipoRelacion, TipoServ: XLC.TipoServ, TipoIE: XLC.TipoIE, TipoCP: XLC.TipoCP, Estado: CAT.estados, Perm: CAT.permSCT, Config: CAT.configVeh, Remolque: CAT.subTipoRem, Embalaje: CAT.embalaje};
const xlLabel = it => it[2] || (it[1] ? `${it[0]} - ${it[1]}` : it[0]);
const parseClave = v => { const s = String(v ?? '').trim(); const m = s.match(/^([^\s]{1,14})\s+[-–]\s+\S/); if (m) return m[1]; const p = s.match(/^(SI|SÍ|NO)\s*\(/i); return p ? p[1].toUpperCase().replace('Í', 'I') : s; };
const UUID_RE = /^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i;
const SERV_TXT = {transporte: '01', pasajeros: '01', entrega: '02', hospedaje: '03', bienes: '04', servicios: '04', enajenacion: '04'};
function labelize(f, v) {
  if (!f.cat || v === '' || v == null) return v;
  const list = XLC[f.cat] || [];
  let code = parseClave(v);
  if (f.cat === 'TipoServ' && !/^0\d$/.test(code)) { const h = normH(v); const k = Object.keys(SERV_TXT).find(x => h.includes(x)); if (k) code = SERV_TXT[k]; }
  if (f.cat === 'TieneRFC') code = siNo(v) ? 'SI' : 'NO';
  const it = list.find(x => String(x[0]).toUpperCase() === String(code).toUpperCase());
  return it ? xlLabel(it) : v;
}
/* Catálogo y máscara de cada columna de las plantillas */
const FIELD_META = {
  ie: {Tipo: {cat: 'TipoIE'}, RFC_Receptor: {mask: 'rfc'}, Regimen_Receptor: {cat: 'Regimen'}, CP_Receptor: {mask: 'cp'}, Uso_CFDI: {cat: 'Uso'}, Metodo_Pago: {cat: 'Metodo'}, Forma_Pago: {cat: 'Forma'}, Moneda: {cat: 'Moneda'}, Tipo_Cambio: {mask: 'dec6'}, Tipo_Relacion: {cat: 'TipoRel'}, UUID_Relacionado: {mask: 'uuid'}, Clave_ProdServ: {mask: 'clave'}, Clave_Unidad: {cat: 'Unidad', open: true}, Cantidad: {mask: 'dec6'}, Valor_Unitario: {mask: 'dec6'}, Descuento: {mask: 'dec6z'}, Perfil_Impuestos: {cat: 'Perfil'}, Objeto_Imp: {cat: 'Objeto'}, Total_Esperado: {mask: 'dec6'}},
  rep: {Fecha_Pago: {mask: 'fecha'}, Forma_Pago: {cat: 'Forma'}, Moneda: {cat: 'Moneda'}, Tipo_Cambio: {mask: 'dec6'}, RFC_Receptor: {mask: 'rfc'}, UUID_Factura_PPD: {mask: 'uuid'}, Importe_Pagado: {mask: 'dec6'}},
  cp: {Tipo: {cat: 'TipoCP'}, RFC_Receptor: {mask: 'rfc'}, Regimen_Receptor: {cat: 'Regimen'}, CP_Receptor: {mask: 'cp'}, Uso_CFDI: {cat: 'Uso'}, Importe_Flete: {mask: 'dec6'}, Perfil_Impuestos: {cat: 'Perfil'}, Metodo_Pago: {cat: 'Metodo'}, Forma_Pago: {cat: 'Forma'}, Config_Vehicular: {cat: 'Config'}, Peso_Bruto_Vehicular: {mask: 'dec6'}, Perm_SCT: {cat: 'Perm'}, Remolque_SubTipo: {cat: 'Remolque'}, RFC_Operador: {mask: 'rfc'},
    Tipo_Ubicacion: {cat: 'TipoUbic'}, RFC: {mask: 'rfc'}, Fecha_Hora: {mask: 'fecha'}, Codigo_Postal: {mask: 'cp'}, Distancia_Km: {mask: 'dec6'}, BienesTransp: {mask: 'clave'}, Cantidad: {mask: 'dec6'}, Clave_Unidad: {cat: 'Unidad', open: true}, PesoKg: {mask: 'dec6'}, MaterialPeligroso: {cat: 'SiNo'}, Embalaje: {cat: 'Embalaje'}, Valor_Mercancia: {mask: 'dec6'}},
  plat: {RFC: {mask: 'rfc'}, CURP: {mask: 'curp'}, CP_Fiscal: {mask: 'cp'}, Tiene_RFC: {cat: 'TieneRFC'}, Tipo_De_Servicio: {cat: 'TipoServ'}, Subtotal_Sin_IVA: {mask: 'dec6'}, Total_Retenido_Esperado: {mask: 'dec6'}}
};
(function ajustarLayouts() {
  const ie = LAYOUTS.ie.sections[0].fields, ip = ie.findIndex(f => f.k === 'Perfil_Impuestos');
  ie.splice(ip + 1, 0, fld('Objeto_Imp', 0, 'Opcional: 01, 02, 03 o 04. Si lo llenas, manda sobre el perfil de impuestos.', ['objeto', 'objeto impuesto', 'objeto imp']));
  const ts = LAYOUTS.plat.sections[0].fields.find(f => f.k === 'Tipo_De_Servicio'); ts.d = '01 Transporte de pasajeros, 02 Entrega de bienes, 03 Hospedaje, 04 Enajenación de bienes y servicios.'; ts.al.push('tipo servicio');
  Object.entries(FIELD_META).forEach(([lk, meta]) => LAYOUTS[lk].sections.forEach(s => s.fields.forEach(f => Object.assign(f, meta[f.k] || {}))));
  const _ie = LAYOUT_EJ.ie; LAYOUT_EJ.ie = () => { const e = _ie(); e.docs.forEach(r => { if (r.length === 23) r.splice(21, 0, ''); }); return e; };
})();
const fieldOf = (sec, k) => { for (const L of Object.values(LAYOUTS)) for (const s of L.sections) if (s.k === sec) return s.fields.find(f => f.k === k); return null; };
const secOf = k => { for (const L of Object.values(LAYOUTS)) for (const s of L.sections) if (s.k === k) return s; return null; };

/* ---- Plantillas Excel con listas cerradas y máscaras ---- */
function layoutSheets(key, withEj = true) {
  const L = LAYOUTS[key], ej = withEj ? LAYOUT_EJ[key]() : {};
  const cats = []; L.sections.forEach(s => s.fields.forEach(f => { if (f.cat && !cats.includes(f.cat)) cats.push(f.cat); }));
  const catRows = [cats.map(c => XLC_TITLE[c] || c)]; const maxN = Math.max(...cats.map(c => XLC[c].length));
  for (let i = 0; i < maxN; i++) catRows.push(cats.map(c => XLC[c][i] ? xlLabel(XLC[c][i]) : ''));
  const sheets = L.sections.map(s => {
    const rows = [s.fields.map(f => f.k)].concat((ej[s.k] || []).map(r => s.fields.map((f, i) => labelize(f, r[i] ?? ''))).map(r => r.map((v, i) => ['rfc', 'cp', 'uuid', 'curp', 'clave', 'fecha'].includes(s.fields[i].mask) ? String(v) : v)));
    const val = [], textCols = [];
    s.fields.forEach((f, ci) => {
      const col = colName(ci), sq = `${col}2:${col}2000`;
      if (f.cat) { const cc = colName(cats.indexOf(f.cat)); val.push({sq, type: 'list', f1: `'_Catalogos_SAT'!$${cc}$2:$${cc}$${XLC[f.cat].length + 1}`, strict: !f.open, title: XLC_TITLE[f.cat] || f.k, msg: f.open ? 'Elige de la lista o escribe otra clave oficial del SAT.' : 'Elige una opción de la lista. No se permite texto libre.'}); }
      if (['rfc', 'cp', 'uuid', 'curp', 'clave', 'fecha'].includes(f.mask) || ['ID_Documento', 'ID_Pago', 'ID_Viaje', 'Serie', 'Num_Operacion', 'Placa', 'Remolque_Placa', 'Num_Permiso_SCT', 'Poliza', 'Licencia_Operador', 'Cve_Material_Peligroso', 'Colonia', 'Clave_Municipio', 'Clave_Localidad'].includes(f.k)) textCols.push(ci);
      if (f.mask === 'rfc') val.push({sq, type: 'textLength', op: 'between', f1: 12, f2: 13, title: 'RFC', msg: 'El RFC lleva 12 caracteres (persona moral) o 13 (persona física).'});
      if (f.mask === 'cp') val.push({sq, type: 'textLength', op: 'equal', f1: 5, title: 'Código postal', msg: 'Escribe 5 dígitos; conserva los ceros a la izquierda (ej. 06600).'});
      if (f.mask === 'uuid') val.push({sq, type: 'textLength', op: 'equal', f1: 36, title: 'Folio fiscal (UUID)', msg: '36 caracteres con formato 8-4-4-4-12.'});
      if (f.mask === 'curp') val.push({sq, type: 'textLength', op: 'equal', f1: 18, title: 'CURP', msg: 'La CURP tiene 18 caracteres.'});
      if (f.mask === 'clave') val.push({sq, type: 'textLength', op: 'equal', f1: 8, title: 'Clave SAT', msg: 'La clave de producto o servicio tiene 8 dígitos.'});
      if (f.mask === 'dec6' || f.mask === 'dec6z') val.push({sq, type: 'custom', f1: `AND(ISNUMBER(${col}2),${col}2${f.mask === 'dec6z' ? '>=' : '>'}0,ROUND(${col}2,6)=${col}2)`, title: f.k, msg: `Número ${f.mask === 'dec6z' ? 'mayor o igual a cero' : 'positivo'} con hasta 6 decimales.`});
    });
    return {name: s.sheet, rows, validations: val, textCols};
  });
  const ins = [['Hoja', 'Columna', 'Obligatoria', 'Lista o formato', 'Descripción']];
  L.sections.forEach(s => s.fields.forEach(f => ins.push([s.sheet, f.k, f.req ? 'Sí' : 'No', f.cat ? `Lista ${XLC_TITLE[f.cat]}${f.open ? ' (abierta)' : ' (cerrada)'}` : ({rfc: '12 o 13 caracteres', cp: '5 dígitos, texto', uuid: '36 caracteres 8-4-4-4-12', curp: '18 caracteres', clave: '8 dígitos', dec6: 'Número > 0, hasta 6 decimales', dec6z: 'Número ≥ 0, hasta 6 decimales', fecha: 'AAAA-MM-DD o AAAA-MM-DDTHH:MM'})[f.mask] || 'Texto', f.d])));
  ins.push([], ['Candados al cargar', '', '', '', 'PPD fuerza la forma de pago 99; PUE con 99 es error. Un RFC de 12 caracteres no acepta regímenes 605, 606, 612 ni 625 ni usos D01 a D10. XAXX010101000 fuerza régimen 616, uso S01 y el CP del emisor. Las listas muestran “CLAVE - Descripción”; al cargar se toma solo la clave.']);
  if (key === 'plat') ins.push(['Tasas', '', '', '', 'Según c_TipoDeServ 2026 del SAT. Persona física con RFC: 01-03 ISR 2.1%, 04 hospedaje 4%, 05-06 y 11 ISR 2.5%; IVA 50% (8%), o 100% en 07-09 y 11. Persona moral: ISR 2.5%. Sin RFC: ISR 20% e IVA 100% (16%).']);
  sheets.push({name: 'Instrucciones', rows: ins, widths: [16, 24, 12, 30, 90]});
  sheets.push({name: '_Catalogos_SAT', rows: catRows, hidden: true, widths: cats.map(c => Math.min(70, Math.max(18, ...XLC[c].map(x => xlLabel(x).length + 2))))});
  return sheets;
}

/* ---- Candados por fila y validación cruzada ---- */
const addWarn = (warns, m, sec, row, f, code) => warns.push({m, cell: row && f ? `${sec}|${row._i}|${f}` : null, code, sev: 'warn'});
const PF_ONLY = ['605', '606', '612', '625'];
function candados(sec, row, errs, warns) {
  const s = secOf(sec); if (!s) return;
  s.fields.forEach(f => {
    let v = String(row[f.k] ?? '').trim(); if (!v) return;
    if (f.cat) { const c = f.cat === 'TieneRFC' ? (siNo(v) ? 'SI' : /^no\b/i.test(v) ? 'NO' : v) : parseClave(v); if (c !== v) { row[f.k] = c; v = c; } }
    if (f.cat === 'TipoServ' && !/^\d{2}$/.test(v)) { const h = normH(v), k = Object.keys(SERV_TXT).find(x => h.includes(x)); if (k) { row[f.k] = SERV_TXT[k]; v = SERV_TXT[k]; } }
    if (f.cat && FULLCAT[f.cat] && !FULLCAT[f.cat].some(x => String(x[0]).toUpperCase() === v.toUpperCase())) addErr(errs, `${f.k}: “${v}” no existe en el catálogo ${XLC_TITLE[f.cat]} del SAT.`, sec, row, f.k, 'cell', 'CATALOGO_' + f.cat.toUpperCase());
    if (f.cat === 'Perfil' && !perfilKey(v)) addErr(errs, `Perfil de impuestos “${v}” desconocido.`, sec, row, f.k, 'cell', 'PERFIL_IMPUESTOS');
    if (f.mask === 'rfc') { const u = v.toUpperCase(); if (u !== v) row[f.k] = u; if (!/^[A-ZÑ&0-9]{12,13}$/.test(u) || !rfcTipo(u)) addErr(errs, `El RFC “${v}” no es válido: debe tener 12 caracteres (persona moral) o 13 (persona física) con fecha válida.`, sec, row, f.k, 'cell', 'RFC_FORMATO'); }
    if (f.mask === 'cp') { if (/^\d{1,4}$/.test(v)) addWarn(warns, `El código postal ${v} perdió ceros a la izquierda en Excel; se usará ${v.padStart(5, '0')}.`, sec, row, f.k, 'CP_CEROS'); else if (!/^\d{5}$/.test(v)) addErr(errs, `El código postal “${v}” debe tener 5 dígitos.`, sec, row, f.k, 'cell', 'CP_FORMATO'); }
    if (f.mask === 'uuid' && !UUID_RE.test(v)) addErr(errs, `El folio fiscal “${v.slice(0, 40)}” no tiene el formato de 36 caracteres 8-4-4-4-12.`, sec, row, f.k, 'cell', 'UUID_FORMATO');
    if (f.mask === 'curp' && !CURP_RE.test(v.toUpperCase())) addErr(errs, `La CURP “${v}” no es válida (18 caracteres).`, sec, row, f.k, 'cell', 'CURP_FORMATO');
    if (f.mask === 'clave') { const p = pad0(v, 8); if (p !== v) row[f.k] = p; if (!/^\d{8}$/.test(p)) addErr(errs, `La clave SAT “${v}” debe tener 8 dígitos.`, sec, row, f.k, 'cell', 'CLAVE_PRODSERV'); }
    if (f.mask === 'dec6' || f.mask === 'dec6z') { const c = v.replace(/[$,\s]/g, ''); if (!/^\d+(\.\d{1,6})?$/.test(c) || (f.mask === 'dec6' && !(num(c) > 0))) addErr(errs, `${f.k}: “${v}” debe ser un número ${f.mask === 'dec6z' ? 'mayor o igual a cero' : 'positivo'} con máximo 6 decimales.`, sec, row, f.k, 'cell', 'DECIMALES'); else if (c !== v) row[f.k] = c; }
    if (f.mask === 'fecha' && !normFecha(v)) addErr(errs, `${f.k}: “${v}” no es una fecha válida (AAAA-MM-DD o AAAA-MM-DDTHH:MM).`, sec, row, f.k, 'cell', 'FECHA_FORMATO');
  });
}
function cruzados(d, h, errs, warns, sec) {
  const em = EM(), R = d.receptor, rt = rfcTipo(R.rfc);
  if (rt === 'M' && PF_ONLY.includes(R.regimen)) addErr(errs, `El RFC ${R.rfc} es de persona moral (12 caracteres) y el régimen ${R.regimen} es exclusivo de personas físicas.`, sec, h, 'Regimen_Receptor', 'cell', 'CFDI40158');
  if (rt === 'M' && /^D(0[1-9]|10)$/.test(R.uso)) addErr(errs, `El uso ${R.uso} es una deducción personal y no aplica a una persona moral (RFC de 12 caracteres).`, sec, h, 'Uso_CFDI', 'cell', 'USO_PERSONA_FISICA');
  if (rt === 'PG') {
    const ch = []; if (R.regimen !== '616') { R.regimen = '616'; ch.push('régimen 616'); } if (R.uso !== 'S01') { R.uso = 'S01'; ch.push('uso S01'); } if (R.cp !== em.cp) { R.cp = em.cp; ch.push(`CP ${em.cp} del emisor`); }
    if (!R.nombre) R.nombre = 'PUBLICO EN GENERAL';
    if (ch.length) addWarn(warns, `Receptor XAXX010101000 (público en general): se forzó ${ch.join(', ')}.`, sec, h, 'Regimen_Receptor', 'PG_AJUSTE');
  }
  if (d.metodoPago === 'PPD' && d.formaPago !== '99') { addWarn(warns, `Método PPD con forma de pago ${d.formaPago}: se forzó la forma 99 (por definir). El pago real va en el complemento.`, sec, h, 'Forma_Pago', 'PPD_FORMA99'); d.formaPago = '99'; }
  if (d.metodoPago === 'PUE' && d.formaPago === '99') addErr(errs, 'Método PUE con forma de pago 99: indica cómo te pagaron (03 transferencia, 01 efectivo…).', sec, h, 'Forma_Pago', 'cell', 'PUE_FORMA99');
}
const ATTR_CODE = {RegimenFiscalReceptor: 'REGIMEN_RECEPTOR', UsoCFDI: 'USO_REGIMEN', DomicilioFiscalReceptor: 'CP_RECEPTOR', Rfc: 'RFC_RECEPTOR', Nombre: 'NOMBRE_RECEPTOR', FormaPago: 'FORMA_PAGO', MetodoPago: 'METODO_PAGO', TipoCambio: 'TIPO_CAMBIO', CfdiRelacionados: 'CFDI_RELACIONADO', CfdiRelacionado: 'UUID_FORMATO', ClaveProdServ: 'CLAVE_PRODSERV', ClaveUnidad: 'CLAVE_UNIDAD', Cantidad: 'CANTIDAD', Descripcion: 'DESCRIPCION', ValorUnitario: 'VALOR_UNITARIO', Descuento: 'DESCUENTO', ObjetoImp: 'OBJETO_IMP', Impuestos: 'IMPUESTOS', Total: 'TOTAL'};
const codeOf = e => e.code || (e.attr ? ATTR_CODE[e.attr] || e.attr.toUpperCase() : 'CARTA_PORTE');

/* ---- Barra de progreso por etapas ---- */
const PROG_ST = {
  xml: ['Extrayendo Serie, Folio y TipoDeComprobante y actualizando el consecutivo de folios internos…', 'Validando la vigencia de cada UUID en el SAT (Estado, EsCancelable, EFOS)…', 'Integrando saldos PPD y enviando incidencias a la bitácora de errores…'],
  sat: ['Construyendo la expresión impresa (re, rr, tt, id, fe) de cada CFDI…', 'Consultando ConsultaCFDIService: Estado, EsCancelable y EstatusCancelacion…', 'Validando EFOS (69-B), actualizando el semáforo y enviando incidencias a la bitácora…'],
  excel: ['Leyendo hojas, encabezados y filas del Excel…', 'Aplicando candados del SAT y catálogos fila por fila…', 'Agrupando comprobantes y cuadrando totales con tolerancia…']
};
const tick = ms => new Promise(r => setTimeout(r, ms || 0));
function progStart(kind, total, label) { S.mas.prog = {kind, total: Math.max(1, total), done: 0, stage: 0, ok: 0, warn: 0, bad: 0, label, fin: false}; progDraw(); }
function progHTML(P = S.mas.prog) {
  if (!P) return '';
  const pct = P.fin ? 100 : Math.min(99, Math.floor(((P.stage * P.total + P.done) / (3 * P.total)) * 100));
  const unit = P.kind === 'xml' ? 'archivos XML' : P.kind === 'sat' ? 'comprobantes' : 'filas';
  return `<div class="prog${P.fin ? ' fin' : ''}" role="status" aria-live="polite"><div class="pghead"><b>${P.fin ? `Proceso terminado: ${P.total} ${unit}` : `Procesando: ${Math.min(P.done, P.total)} de ${P.total} ${unit}…`}</b><span class="pgpct mono">${pct}%</span></div>
  <div class="pgbar"><span style="width:${pct}%"></span></div>
  <ol class="pgst">${PROG_ST[P.kind].map((t, i) => `<li class="${P.fin || i < P.stage ? 'done' : i === P.stage ? 'on' : ''}"><span>${i + 1}</span>${esc(t)}</li>`).join('')}</ol>
  <div class="pgcnt"><div class="ok"><b>${P.ok}</b><span>Exitosos</span></div><div class="warn"><b>${P.warn}</b><span>Advertencias</span></div><div class="bad"><b>${P.bad}</b><span>Fallidos / rechazados</span></div></div>
  ${P.label ? `<p class="muted small">${esc(P.label)}</p>` : ''}</div>`;
}
function progDraw() { const el = $('#prog'); if (el) el.innerHTML = progHTML(); const sp = $('#satprog'); if (sp) sp.innerHTML = progHTML(S.satProg); }

/* ---- Bitácora de errores y validaciones ---- */
S.bita = []; S.bf = {fuente: '', sev: '', code: '', q: ''};
const BITA_FUENTE = {xml: 'Carga de XML', excel: 'Excel / lote', timbrado: 'Timbrado', cancelacion: 'Cancelación'};
let bitaSaveT;
function bitaLog(e) {
  S.bita.unshift(Object.assign({id: sid(), ts: new Date().toISOString(), sev: 'crit'}, e));
  if (e.fuente !== 'excel') { clearTimeout(bitaSaveT); bitaSaveT = setTimeout(bitaSave, 600); }
}
function bitaSave() { if (!S.acct) return; Store.put(docId('bitacora', 'log'), {acct: S.acct, coll: 'bitacora', items: S.bita.filter(e => e.fuente !== 'excel').slice(0, 300)}); }
async function bitaLoad(acct) { try { const d = (await Store.list(acct, 'bitacora'))[0]; S.bita = d && d.items ? d.items : []; } catch (e) { S.bita = []; } }
function bitaSyncExcel() {
  const R = S.mas.dry, L = LAYOUTS[S.mas.layout]; if (!R) return;
  const prev = new Map(S.bita.filter(e => e.fuente === 'excel').map(e => [e.key, e.ts]));
  const rows = []; const now = new Date().toISOString();
  R.docs.forEach(doc => [...doc.errs.map(e => ({...e, sev: 'crit'})), ...doc.warns.map(w => ({...w, sev: 'warn'}))].forEach(e => {
    let origen = `Documento ${doc.key}`, act = null, ref = '';
    if (e.cell) {
      const [sec, i, f] = e.cell.split('|'), s = L.sections.find(x => x.k === sec), m = S.mas.map[sec] || {}, t = S.mas.tables[m.sheet] || {}, row = (S.mas.rows[sec] || []).find(r => r._i === +i) || {};
      origen = `${t.name || s.sheet} · Fila ${(t.headerRow || 0) + 2 + +i} - Columna ${f}`; act = {kind: 'cell', sec, i: +i, f};
      ref = row.RFC_Receptor || row.UUID_Factura_PPD || row.RFC || row.CURP || row.Placa || '';
      const rfc = String(row.RFC_Receptor || '').toUpperCase(), cli = S.clientes.find(c => c.rfc === rfc);
      if (cli && ['Regimen_Receptor', 'CP_Receptor', 'Uso_CFDI', 'Nombre_Receptor'].includes(f)) act.cliente = cli.id;
    }
    const key = `${e.cell || doc.key}|${codeOf(e)}|${e.m}`;
    rows.push({id: 'x' + rows.length, key, ts: prev.get(key) || now, fuente: 'excel', sev: e.sev, origen, ref: ref || doc.key, code: codeOf(e), diag: e.m, action: act});
  }));
  S.bita = S.bita.filter(e => e.fuente !== 'excel').concat(rows);
}
const SEV_AUTO = new Set(['PPD_FORMA99', 'PG_AJUSTE', 'CP_CEROS', 'DIF_CENTAVOS']);
const sevTxt = e => e.sev === 'crit' ? (e.fuente === 'sat' ? 'Crítico · alerta fiscal' : e.fuente === 'folios' ? 'Crítico · folio bloqueado' : 'Crítico · bloquea timbrado') : SEV_AUTO.has(e.code) ? 'Advertencia · auto-ajustado' : 'Advertencia';
function bitaFiltered() {
  const f = S.bf, q = normH(f.q);
  return S.bita.filter(e => (!f.fuente || e.fuente === f.fuente) && (!f.sev || e.sev === f.sev) && (!f.code || e.code === f.code) && (!q || normH([e.origen, e.ref, e.code, e.diag].join(' ')).includes(q))).sort((a, b) => b.ts.localeCompare(a.ts));
}
const fmtTs = ts => { const d = new Date(ts); return isNaN(d) ? ts : `${d.toLocaleDateString('es-MX', {day: '2-digit', month: 'short'})} ${d.toLocaleTimeString('es-MX', {hour: '2-digit', minute: '2-digit', second: '2-digit'})}`; };
function bitaActions(e) {
  const a = e.action || {}, b = [];
  if (a.kind === 'cell') { b.push(`<button class="btn sm" data-a="bitaFix" data-id="${e.id}">Corregir en línea</button>`); if (a.cliente) b.push(`<button class="btn sm ghost" data-a="bitaCli" data-id="${e.id}">Actualizar con datos del cliente</button>`); }
  if (a.kind === 'skip') b.push(`<button class="btn sm ghost" data-a="bitaSkip" data-id="${e.id}">Omitir archivo</button>`);
  if (a.kind === 'emisor') b.push(`<button class="btn sm ghost" data-a="bitaEm" data-id="${e.id}">Cambiar a ese emisor</button>`);
  if (a.kind === 'fix') b.push(`<button class="btn sm" data-a="bitaEd" data-id="${e.id}">Corregir en línea</button>`);
  if (a.kind === 'ver') b.push(`<button class="btn sm ghost" data-a="ver" data-id="${a.id}">Ver comprobante</button>`);
  if (a.kind === 'xml') b.push('<button class="btn sm ghost" data-a="masTab" data-k="xml">Importar XML</button>');
  return b.join('') || '<span class="muted small">—</span>';
}
function bitaHTML() {
  const all = S.bita, list = bitaFiltered(), nC = all.filter(e => e.sev === 'crit').length, nW = all.length - nC, codes = [...new Set(all.map(e => e.code))].sort();
  return `<details class="bita" id="bitadet"${S._bitaOpen ? ' open' : ''}><summary><h2>Bitácora de errores y validaciones</h2>${chip(nC + ' críticos', nC ? 'bad' : '')}${chip(nW + ' advertencias', nW ? 'warn' : '')}</summary>
  <div class="bitabody"><div class="filters">
    <div class="fld"><label for="bf_fuente">Origen</label><select id="bf_fuente" data-bf="fuente">${opts(Object.entries(BITA_FUENTE), S.bf.fuente, false, 'Todos')}</select></div>
    <div class="fld"><label for="bf_sev">Severidad</label><select id="bf_sev" data-bf="sev">${opts([['crit', 'Crítico'], ['warn', 'Advertencia']], S.bf.sev, false, 'Todas')}</select></div>
    <div class="fld"><label for="bf_code">Código</label><select id="bf_code" data-bf="code">${opts(codes.map(c => [c, c]), S.bf.code, false, 'Todos')}</select></div>
    <div class="fld grow"><label for="bf_q">Buscar</label><input id="bf_q" data-bf="q" value="${esc(S.bf.q)}" placeholder="RFC, UUID, archivo, fila…"></div>
    <div class="row wrap"><button class="btn ghost sm" data-a="bitaExp" data-k="csv">Descargar CSV</button><button class="btn ghost sm" data-a="bitaExp" data-k="xlsx">Descargar XLSX</button><button class="btn ghost sm" data-a="bitaClear">Vaciar historial</button></div></div>
  ${list.length ? `<div class="tw bitawrap"><table class="bitat"><thead><tr><th>Hora</th><th>Origen</th><th>RFC / UUID</th><th>Código SAT / PAC</th><th>Diagnóstico contable</th><th>Severidad</th><th>Acción rápida</th></tr></thead><tbody>
  ${list.slice(0, 300).map(e => `<tr><td class="small mono">${esc(fmtTs(e.ts))}</td><td class="small"><span class="muted">${esc(BITA_FUENTE[e.fuente] || '')}</span><br>${esc(e.origen)}</td><td class="mono small">${esc(e.ref || '—')}</td><td><span class="chip mono">${esc(e.code)}</span></td><td class="small">${esc(e.diag)}</td><td>${chip(sevTxt(e), e.sev === 'crit' ? 'bad' : 'warn')}</td><td class="acts">${bitaActions(e)}</td></tr>`).join('')}</tbody></table></div>${list.length > 300 ? `<p class="muted small">Se muestran 300 de ${list.length} registros. Descarga la bitácora para verlos todos.</p>` : ''}`
    : '<p class="empty">Sin registros con estos filtros. Aquí aparecen los rechazos de XML, los errores de las filas de Excel y los intentos de timbrado o cancelación bloqueados.</p>'}</div></details>`;
}
function bitaExport(kind) {
  const rows = [['Fecha y hora', 'Origen', 'Ubicación', 'RFC / UUID', 'Código', 'Diagnóstico', 'Severidad']].concat(bitaFiltered().map(e => [new Date(e.ts).toLocaleString('es-MX'), BITA_FUENTE[e.fuente] || e.fuente, e.origen, e.ref || '', e.code, e.diag, sevTxt(e)]));
  const n = `bitacora_${(EM() || {}).rfc || 'folia'}_${nowLocal().slice(0, 10)}`;
  if (kind === 'csv') ofrecerArchivo(n + '.csv', toCSV(rows)); else ofrecerArchivo(n + '.xlsx', makeXlsx([{name: 'Bitacora', rows, widths: [20, 16, 40, 40, 22, 80, 26]}]));
}
/* Opciones válidas para corregir una celda en un clic */
function opcionesValidas(sec, row, f) {
  const fd = fieldOf(sec, f) || {}, rt = rfcTipo(String(row.RFC_Receptor || row.RFC || '').toUpperCase()), em = EM();
  const fmt = l => l.map(x => [String(x[0]), x[1] ? `${x[0]} - ${x[1]}` : String(x[0])]);
  if (f === 'Regimen_Receptor') return rt === 'PG' || rt === 'EXT' ? [['616', '616 - Sin obligaciones fiscales']] : fmt(CAT.regimen.filter(r => !rt || r[2].includes(rt)));
  if (f === 'Uso_CFDI') { const reg = parseClave(row.Regimen_Receptor); if (rt === 'PG') return [['S01', 'S01 - Sin efectos fiscales']]; return fmt(CAT.uso.filter(u => u[0] !== 'CN01' && u[0] !== 'CP01' && (!reg || u[2].includes(reg)) && !(rt === 'M' && /^D/.test(u[0])))); }
  if (f === 'Forma_Pago') { const mp = parseClave(row.Metodo_Pago) || 'PUE'; return mp === 'PPD' ? [['99', '99 - Por definir']] : fmt(CAT.formaPago.filter(x => x[0] !== '99')); }
  if (f === 'CP_Receptor') { if (rt === 'PG' || rt === 'EXT') return [[em.cp, em.cp + ' - CP del emisor']]; const c = S.clientes.find(x => x.rfc === String(row.RFC_Receptor || '').toUpperCase()); return c ? [[c.cp, c.cp + ' - CP registrado del cliente']] : null; }
  if (f === 'Perfil_Impuestos') return Object.entries(PRESETS).map(([k, p]) => [k, `${k} - ${p.t}`]);
  if (f === 'Tiene_RFC') return [['SI', 'SI (Retención reducida Art. 113-A)'], ['NO', 'NO (Retención máxima 20% ISR y 16% IVA)']];
  if (fd.cat && FULLCAT[fd.cat]) return fmt(FULLCAT[fd.cat]);
  if (fd.cat && XLC[fd.cat]) return fmt(XLC[fd.cat]);
  return null;
}
function openCellFix(e) {
  const a = e.action, row = (S.mas.rows[a.sec] || []).find(r => r._i === a.i);
  if (!row) return toast('Esa fila ya no está en el lote (quizá ya se timbró o cambiaste de archivo).', 'warn');
  const op = opcionesValidas(a.sec, row, a.f), cur = String(row[a.f] ?? '');
  openModal(`<header class="mh"><div><p class="eyebrow">${esc(e.origen)}</p><h3>Corregir ${esc(a.f)}</h3></div><button class="x" data-a="close" aria-label="Cerrar">×</button></header>
  <div class="alert ${e.sev === 'crit' ? 'bad' : 'warn'}"><span><b class="mono">${esc(e.code)}</b> · ${esc(e.diag)}</span></div>
  <p class="small">Valor actual: <span class="mono">${esc(cur || '(vacío)')}</span></p>
  <div class="fld"><label for="cellval">${op ? 'Elige una opción válida para esta fila' : 'Nuevo valor'}</label>${op ? `<select id="cellval">${op.map(([v, l]) => `<option value="${esc(v)}"${v === parseClave(cur) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>` : `<input id="cellval" value="${esc(cur)}">`}</div>
  <footer class="mf"><button class="btn ghost" data-a="cellGo" data-id="${e.id}">Ir a la celda</button><button class="btn" data-a="cellApply" data-id="${e.id}">Aplicar y revalidar</button></footer>`);
}

/* ---- Lectura de XML con etapas y contadores ---- */
async function xmlProcess(files, o = {}) {
  const em = EM(), X = S.mas.xi, d = o.sim ? 45 : 6, n = files.length, items = [];
  progStart('xml', n, o.sim ? 'Simulación con archivos de prueba: las facturas no se importan hasta que pulses Importar; las series y folios detectados sí se registran (puedes quitarlos en Series y folios).' : '');
  const fail = (it, code, diag, extra = {}) => { it.ok = false; it.bad = true; it.msg = it.msg || code; bitaLog({fuente: 'xml', sev: 'crit', origen: it.name, ref: it.uuid || (it.m && it.m.receptor ? it.m.receptor.rfc : ''), code, diag, action: {kind: 'skip', item: it.id}, ...extra}); S.mas.prog.bad++; };
  const wrn = (it, code, diag, extra = {}) => { it.warn = true; it.warns = (it.warns || []).concat(diag); bitaLog({fuente: 'xml', sev: 'warn', origen: it.name, ref: it.uuid || '', code, diag, action: {kind: 'skip', item: it.id}, ...extra}); };
  const regNote = it => it.reg ? ' Su serie y folio sí se registraron en el control de consecutivos.' : '';
  // Etapa 1: estructura, series y consecutivo de folios internos
  const reg = [];
  for (const f of files) {
    const it = {id: sid(), name: f.name, include: true, pagos: [], warns: []};
    try {
      const txt = typeof f.text === 'function' ? await f.text() : f.data; it.xml = txt;
      const root = parseXML(txt);
      if (!['Comprobante', 'Retenciones'].includes(root.localName)) throw Object.assign(new Error('El archivo no es un CFDI (no tiene el nodo cfdi:Comprobante ni retenciones:Retenciones).'), {code: 'NO_ES_CFDI'});
      const m = modelCFDI(txt); it.m = m; it.kind = m.kind === 'ret' ? 'Retenciones' : m.tipo;
      it.uuid = String((m.tfd || {}).UUID || '').toUpperCase(); it.folio = (m.serie || '') + (m.folio || ''); it.receptor = m.receptor ? `${m.receptor.rfc} · ${m.receptor.nombre || ''}` : ''; it.moneda = m.moneda; it.total = m.kind === 'ret' ? undefined : m.total;
      if (!it.uuid) fail(it, 'SIN_TIMBRE', 'El XML no tiene TimbreFiscalDigital: es un comprobante sin timbrar y no tiene validez fiscal.');
      else if (!UUID_RE.test(it.uuid)) fail(it, 'UUID_FORMATO', `El folio fiscal ${it.uuid.slice(0, 20)}… no tiene el formato 8-4-4-4-12.`);
      else if (m.emisor.rfc !== em.rfc) { const otro = S.emisores.find(e => e.rfc === m.emisor.rfc); fail(it, 'OTRO_EMISOR', `El XML lo emitió ${m.emisor.rfc}, no ${em.rfc}. Solo se registran series y saldos de la empresa activa.`, otro ? {action: {kind: 'emisor', emisor: otro.id, item: it.id}} : {}); }
      else if (!m.sello) fail(it, 'SIN_SELLO', 'El comprobante no tiene sello digital del emisor.');
      else {
        let serie = m.serie || '', folio = m.folio || '';
        if (m.kind === 'ret' && !serie) { const mm = String(folio).match(/^(.*?)(\d+)$/); if (mm) { serie = mm[1]; folio = mm[2]; } }
        it.reg = true; reg.push({uuid: it.uuid, serie, folio, tipo: m.kind === 'ret' ? 'R' : m.tipo, fecha: m.fecha, it});
      }
    } catch (e) { it.kind = 'Error'; fail(it, e.code || 'XML_MALFORMED', e.code ? e.message : 'El XML está dañado o incompleto: no se pudo leer su estructura. Pide al emisor que lo descargue de nuevo del portal del SAT.'); }
    items.push(it); S.mas.prog.done++; progDraw(); await tick(d);
  }
  const fr = folRegistrar(reg, {sim: o.sim});
  fr.dups.forEach(({x, u}) => wrn(x.it, 'FOLIO_INTERNO_DUPLICADO', `La serie y folio ${fmtSF(x.serie, x.folio)} de este XML ya los usa otro CFDI (${describeUso(u)}). Dos comprobantes no deben compartir folio interno.`, {fuente: 'folios', action: {kind: 'series'}}));
  fr.touched.forEach(s => { if (s.huecos.length) bitaLog({fuente: 'folios', sev: 'warn', origen: `Serie ${s.key}`, ref: s.key, code: 'SALTO_FOLIO', diag: `Folios faltantes detectados en Serie ${s.key}: ${fmtRangos(s.huecos)}. Verifica si se timbraron en otro sistema, se perdieron o se saltaron por error.`, action: {kind: 'series'}}); });
  X.serieRes = {ts: nowLocal(), list: fr.touched.map(s => ({key: s.key, nueva: fr.nuevas.includes(s.key), tipo: s.tipo, count: s.count, ult: s.ult, next: nextFree(s.serie), huecos: s.huecos}))};
  S.mas.prog.label = fr.touched.length ? 'Series: ' + X.serieRes.list.map(s => `${s.key}${s.nueva ? ' (nueva)' : ''} → siguiente folio disponible ${s.next}`).join(' · ') : S.mas.prog.label;
  // Etapa 2: vigencia del UUID en el SAT
  S.mas.prog.stage = 1; S.mas.prog.done = 0; progDraw();
  for (const it of items) {
    if (!it.bad) {
      const r = satConsultaModel(it.m), nv = satNivel(r); it.sat = r;
      if (nv === 'nf') fail(it, 'SAT_NO_ENCONTRADO', `${r.CodigoEstatus} El UUID no existe en el SAT con esa expresión impresa (re, rr, tt, id, fe): no lo integres.${regNote(it)}`, {fuente: 'sat'});
      else if (nv === 'cancel') fail(it, 'SAT_CANCELADO', `El SAT reporta el UUID como Cancelado (${r.EstatusCancelacion}). No se integra ni admite complementos de pago; su serie y folio quedan bloqueados.`, {fuente: 'sat'});
      else {
        if (nv === 'proc') wrn(it, 'SAT_EN_PROCESO', 'El UUID tiene una cancelación en proceso ante el SAT: se integra, pero no podrás registrarle pagos hasta que el receptor responda.', {fuente: 'sat'});
        if (r.ValidacionEFOS === '100') { it.warn = true; bitaLog({fuente: 'sat', sev: 'crit', origen: it.name, ref: it.uuid, code: 'EFOS_69B', diag: 'ValidacionEFOS = 100: el emisor aparece en el listado del art. 69-B del CFF (operaciones presuntamente inexistentes). Revisa el caso antes de seguir.', action: {kind: 'skip', item: it.id}}); }
      }
    }
    S.mas.prog.done++; progDraw(); await tick(d);
  }
  // Etapa 3: reglas de integración, duplicados y saldos PPD
  S.mas.prog.stage = 2; S.mas.prog.done = 0; progDraw();
  const seen = new Set(X.items.map(x => x.uuid).filter(Boolean));
  for (const it of items) {
    if (!it.bad) {
      const m = it.m;
      if (m.cp && m.cp.ubic) m.cp.ubic.forEach((u, i) => { const dm = u.dom || {}; const pr = geoProblemas({cp: dm.CodigoPostal, pais: dm.Pais, estado: dm.Estado, municipio: dm.Municipio, localidad: dm.Localidad, colonia: dm.Colonia}); if (pr.length) wrn(it, GEO_CODE[pr[0].attr] || 'CP147', `Carta Porte, ${u.TipoUbicacion || 'ubicación'} ${u.IDUbicacion || i + 1} (CP ${dm.CodigoPostal}): ${pr.map(p => p.m).join('; ')}. El XML ya está timbrado: corrige las claves en la Carta Porte sustituta.`, {fuente: 'xml'}); });
      if (m.kind === 'ret') fail(it, 'RETENCIONES_NO_APLICA', 'Es un CFDI de retenciones: no genera saldo PPD ni complementos de pago.' + regNote(it));
      else if (m.tipo === 'I' && m.metodoPago !== 'PPD') fail(it, 'NO_PPD', 'El XML cargado corresponde a una factura tipo PUE; solo se permiten facturas PPD para generar complementos de pago.' + regNote(it));
      else if (!['I', 'P'].includes(m.tipo)) fail(it, 'TIPO_NO_SOPORTADO', `Comprobante tipo ${m.tipo}: el importador solo integra facturas PPD (I) y complementos de pago (P).` + regNote(it));
      else {
        const R = m.receptor, rg = CAT.regimen.find(r => r[0] === R.regimen), uso = CAT.uso.find(u => u[0] === R.uso), rt = rfcTipo(R.rfc);
        if (!rg) wrn(it, 'CATALOGO_REGIMEN', `El régimen ${R.regimen} del receptor no está en c_RegimenFiscal.`);
        else if ((rt === 'F' || rt === 'M') && !rg[2].includes(rt)) wrn(it, 'CFDI40158', `El régimen ${R.regimen} no corresponde al tipo de persona de ${R.rfc}. El CFDI ya está timbrado; revisa si conviene sustituirlo.`);
        if (uso && R.regimen && !uso[2].includes(R.regimen)) wrn(it, 'USO_REGIMEN', `El UsoCFDI ${R.uso} no es compatible con el régimen ${R.regimen} del receptor.`);
        if (m.tipo === 'I') { const calc = r2(m.subtotal - m.descuento + m.impuestos.totTras - m.impuestos.totRet), diff = r2(m.total - calc); if (Math.abs(diff) > 0 && Math.abs(diff) <= 0.01) wrn(it, 'DIF_CENTAVOS', `El total timbrado difiere ${money(diff)} de la suma de conceptos e impuestos; se respeta el total del XML.`); else if (Math.abs(diff) > 0.01) fail(it, 'TOTAL_NO_CUADRA', `El total del XML (${money(m.total)}) no cuadra con subtotal, descuento e impuestos (${money(calc)}).`); }
      }
    }
    if (!it.bad) {
      if (S.cfdis.some(c => c.uuid === it.uuid)) fail(it, 'UUID_DUPLICADO', `El folio fiscal ${it.uuid.slice(0, 8)}… ya está en tu base de datos.`);
      else if (seen.has(it.uuid)) fail(it, 'UUID_DUPLICADO', `El folio fiscal ${it.uuid.slice(0, 8)}… viene repetido en esta carga.`);
      else { it.ok = true; seen.add(it.uuid); if (it.kind === 'P') { const nd = it.m.pagos ? it.m.pagos.pagos.reduce((a, p) => a + p.doctos.length, 0) : 0; it.det = `${nd} documento(s) · ${money(it.m.pagos ? num(it.m.pagos.totales.MontoTotalPagos) : 0)}`; } if (it.warn) S.mas.prog.warn++; else S.mas.prog.ok++; }
    }
    if (!it.ok) it.ok = false;
    X.items.push(it); S.mas.prog.done++; progDraw(); await tick(d);
  }
  xmlRecalc(); S.mas.prog.fin = true; progDraw();
}

/* ---- Excel: lectura y simulación con etapas ---- */
async function loteConProgreso(tables, label, o = {}) {
  const total = tables.reduce((a, t) => a + t.rows.length, 0), d = o.sim ? 30 : 0;
  progStart('excel', total, o.sim ? `Simulación con un archivo de prueba de ${total} filas: no se timbra nada hasta que lo confirmes.` : '');
  for (let i = 0; i < total; i += o.sim ? 1 : 25) { S.mas.prog.done = Math.min(total, i + (o.sim ? 1 : 25)); progDraw(); await tick(d); }
  loadTables(tables, label);
  if (o.directo) await aplicarConProgreso(o); else { S.mas.prog.stage = 1; S.mas.prog.done = 0; S.mas.prog.label = 'Archivo leído. Revisa el mapeo de columnas y pulsa “Simular el lote” para aplicar los candados del SAT.'; progDraw(); }
}
async function aplicarConProgreso(o = {}) {
  const L = LAYOUTS[S.mas.layout], d = o.sim ? 60 : 0;
  if (!S.mas.prog || S.mas.prog.fin) progStart('excel', 1, '');
  const P = S.mas.prog;
  applyMap(false);
  const all = L.sections.flatMap(s => (S.mas.rows[s.k] || []).map(r => [s.k, r])); P.total = Math.max(1, all.length);
  P.stage = 1; P.done = 0; P.ok = P.warn = P.bad = 0; progDraw();
  for (let i = 0; i < all.length; i++) { const e = [], w = []; candados(all[i][0], all[i][1], e, w); if (e.length) P.bad++; else if (w.length) P.warn++; else P.ok++; P.done = i + 1; if (o.sim || i % 10 === 9 || i === all.length - 1) { progDraw(); await tick(d); } }
  P.stage = 2; P.done = 0; progDraw(); await tick(d * 10);
  runDry();
  const R = S.mas.dry; P.ok = P.warn = P.bad = 0;
  all.forEach(([sec, r]) => { const di = R.rowDoc.get(sec + '|' + r._i), doc = R.docs[di]; if (!doc || !doc.ok) P.bad++; else if (L.sections.find(s => s.k === sec).fields.some(f => R.wcell.has(`${sec}|${r._i}|${f.k}`))) P.warn++; else P.ok++; });
  P.done = P.total; P.fin = true; S.mas.step = 'review'; render();
}
function simExcelTable() {
  const em = EM(), H = LAYOUTS.ie.sections[0].fields.map(f => f.k), rows = [];
  const R = [['XIA190128J61', 'XENON INDUSTRIAL ARTICLES', '601', '76343'], ['URE180429TM6', 'UNIVERSIDAD ROBOTICA ESPAÑOLA', '601', '86991'], ['IIA040805DZ4', 'INDISTRIA ILUMINADORA DE ALMACENES', '601', '62661'], ['KIJ0906199R1', 'KERNEL INDUSTIA JUGUETERA', '601', '30230'], ['CACX7605101P8', 'XOCHILT CASAS CHAVEZ', '612', '36257']];
  const P = [['80101504', 'E48', 'Consultoría en planeación estratégica', 1850], ['84111502', 'E48', 'Contabilidad financiera mensual', 9500], ['43211503', 'H87', 'Laptop 14 pulgadas', 18990], ['44103103', 'H87', 'Tóner láser negro', 1290], ['14111507', 'XBX', 'Papel bond carta', 689]];
  const L = (cat, v) => labelize({cat}, v), serA = (em.series || {}).I || 'A', nfA = nextFree(serA);
  const usado = S.cfdis.filter(c => c.emisorId === em.id && serieKey(c.serie) === serieKey(serA) && folioNum(c.folio) !== null).sort((a, b) => folioNum(a.folio) - folioNum(b.folio))[0];
  S.mas.simFallas = new Set(['SIM-014']);
  for (let n = 1; n <= 25; n++) {
    const r = R[n % 5], conc = 1 + (n % 3), id = `SIM-${String(n).padStart(3, '0')}`;
    let rfc = r[0], nom = r[1], reg = r[2], cp = r[3], uso = 'G03', met = n % 4 === 0 ? 'PPD' : 'PUE', forma = met === 'PPD' ? '99' : '03', esperado = '';
    if (n === 3) { rfc = 'EJE140915AB1'; nom = 'EJEMPLOS DEL CENTRO'; reg = '601'; cp = '6600'; }
    if (n === 5) { met = 'PPD'; forma = '03'; }
    if (n === 7) { met = 'PUE'; forma = '99'; }
    if (n === 9) { rfc = 'XIA190128J61'; nom = 'XENON INDUSTRIAL ARTICLES'; reg = '612'; cp = '76343'; }
    if (n === 11) { uso = 'D01'; }
    if (n === 13) { rfc = 'XAXX010101000'; nom = 'PUBLICO EN GENERAL'; reg = '601'; cp = '01000'; uso = 'G03'; }
    if (n === 15) rfc = 'XIA19012J61';
    if (n === 23) { rfc = 'CACX7605101P8'; nom = 'XOCHILT CASAS CHAVEZ'; reg = '616'; uso = 'G03'; }
    const folio = n === 6 && usado ? usado.folio : n === 8 || n === 10 ? String(nfA + 30) : '';
    for (let c = 0; c < conc; c++) {
      const p = P[(n + c) % 5]; let cant = String(1 + ((n + c) % 4)); if (n === 17 && c === 0) cant = '1.1234567';
      rows.push([id, L('TipoIE', 'I'), '', c === 0 ? folio : '', rfc, nom, L('Regimen', reg), cp, L('Uso', uso), L('Metodo', met), L('Forma', forma), L('Moneda', 'MXN'), '', '', '', p[0], L('Unidad', p[1]), p[2], cant, p[3], '', L('Perfil', 'normal'), '', '', met === 'PPD' ? 'Crédito 30 días' : '']);
    }
  }
  const setEsp = (id, delta) => { const rs = rows.filter(x => x[0] === id); const t = r2(rs.reduce((a, x) => a + r2(num(x[18]) * num(x[19])) * 1.16, 0)); rs[0][23] = (t + delta).toFixed(2); };
  setEsp('SIM-019', 0.01); setEsp('SIM-021', 5); setEsp('SIM-002', 0);
  return [{name: 'Ventas_octubre', headers: H, headerRow: 0, rows: rows.map(r => Object.fromEntries(H.map((k, i) => [k, String(r[i] ?? '')])))}];
}
function simXmlFiles() {
  const em = EM(), out = [], recs = [['XIA190128J61', 'XENON INDUSTRIAL ARTICLES', '601', '76343'], ['URE180429TM6', 'UNIVERSIDAD ROBOTICA ESPAÑOLA', '601', '86991'], ['IIA040805DZ4', 'INDISTRIA ILUMINADORA DE ALMACENES', '601', '62661'], ['KIJ0906199R1', 'KERNEL INDUSTIA JUGUETERA', '601', '30230']];
  const prods = [['39121004', 'H87', 'Tablero de distribución eléctrica', 5000], ['24112700', 'H87', 'Tarima de madera', 400], ['81111811', 'E48', 'Soporte técnico mensual', 8500], ['72101507', 'E48', 'Mantenimiento de edificio', 12500]];
  const mk = (n, metodo, tfd = true) => { const r = recs[n % 4], p = prods[n % 4], d = newDraft('I'); Object.assign(d, {serie: 'SIM', folio: String(700 + n), metodoPago: metodo, formaPago: metodo === 'PPD' ? '99' : '03'}); Object.assign(d.receptor, {rfc: r[0], nombre: r[1], regimen: r[2], cp: r[3], uso: 'G03'}); d.conceptos = [Object.assign(newConcepto(), {clave: p[0], unidad: p[1], cantidad: String(1 + n % 5), descripcion: p[2], vu: String(p[3])})]; d.fecha = `2026-09-${pad(1 + n % 28)}T10:${pad(n % 60)}:00`; const k = calcDoc(d), u = uid().toUpperCase(); return {xml: xmlCFDI(d, em, k, tfd ? {tfd: {uuid: u, fecha: d.fecha}} : {}), k, u}; };
  const ppd = [];
  for (let n = 1; n <= 32; n++) { const f = mk(n, 'PPD'); ppd.push(f); out.push({name: `Factura_SIM${700 + n}.xml`, data: f.xml}); }
  out[4].data = out[4].data.replace(/Total="([\d.]+)"/, (m, t) => `Total="${(num(t) + 0.01).toFixed(2)}"`);
  out[9].data = out[9].data.replace(/Total="([\d.]+)"/, (m, t) => `Total="${(num(t) + 0.01).toFixed(2)}"`);
  Object.assign(S.satSim, {[ppd[11].u]: {estado: 'cancelado', est: 'Cancelado sin aceptación', motivo: '02'}, [ppd[12].u]: {estado: 'cancelado', est: 'Cancelado con aceptación', motivo: '01'}, [ppd[13].u]: {efos: true}, [ppd[14].u]: {estado: 'nf'}, [ppd[15].u]: {estado: 'proceso'}});
  for (let n = 33; n <= 37; n++) { const x = mk(n, 'PUE').xml; out.push({name: `Factura_SIM${n === 37 ? 739 : 700 + n}_PUE.xml`, data: n === 37 ? x.replace('Folio="737"', 'Folio="739"') : x}); }
  for (let n = 38; n <= 40; n++) { const x = mk(n, 'PPD').xml; out.push({name: `Factura_SIM${700 + n}_dañado.xml`, data: x.slice(0, Math.floor(x.length * 0.6))}); }
  for (let n = 41; n <= 43; n++) out.push({name: `Factura_SIM${700 + n}_otro_emisor.xml`, data: mk(n, 'PPD').xml.replace(`Rfc="${em.rfc}"`, 'Rfc="AAA010101AAA"')});
  for (let n = 0; n < 3; n++) out.push({name: `Factura_SIM${701 + n}_copia.xml`, data: ppd[n].xml});
  for (let n = 44; n <= 45; n++) out.push({name: `Factura_SIM${700 + n}_sin_timbre.xml`, data: mk(n, 'PPD', false).xml});
  [0, 1].forEach(i => { const x = ppd[i], u = (x.xml.match(/UUID="([^"]+)"/) || [])[1], pay = r2(x.k.total / 2), base = r2(x.k.tras[0].base / 2), iva = r2(x.k.tras[0].importe / 2), fp = '2026-10-15T12:00:00';
    out.push({name: `Pago_SIM${i + 1}.xml`, data: `<?xml version="1.0" encoding="UTF-8"?>\n<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:pago20="http://www.sat.gob.mx/Pagos20" xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="4.0" Serie="SIMP" Folio="${i + 1}" Fecha="${fp}" Sello="DEMO" NoCertificado="${em.csdNo || '00000000000000000000'}" SubTotal="0" Moneda="XXX" Total="0" TipoDeComprobante="P" Exportacion="01" LugarExpedicion="${em.cp}"><cfdi:Emisor Rfc="${xa(em.rfc)}" Nombre="${xa(em.nombre)}" RegimenFiscal="${em.regimen}"/><cfdi:Receptor Rfc="${recs[(i + 1) % 4][0]}" Nombre="${xa(recs[(i + 1) % 4][1])}" DomicilioFiscalReceptor="${recs[(i + 1) % 4][3]}" RegimenFiscalReceptor="601" UsoCFDI="CP01"/><cfdi:Conceptos><cfdi:Concepto ClaveProdServ="84111506" Cantidad="1" ClaveUnidad="ACT" Descripcion="Pago" ValorUnitario="0" Importe="0" ObjetoImp="01"/></cfdi:Conceptos><cfdi:Complemento><pago20:Pagos Version="2.0"><pago20:Totales TotalTrasladosBaseIVA16="${f2(base)}" TotalTrasladosImpuestoIVA16="${f2(iva)}" MontoTotalPagos="${f2(pay)}"/><pago20:Pago FechaPago="${fp}" FormaDePagoP="03" MonedaP="MXN" TipoCambioP="1" Monto="${f2(pay)}"><pago20:DoctoRelacionado IdDocumento="${u}" Serie="SIM" Folio="${701 + i}" MonedaDR="MXN" EquivalenciaDR="1" NumParcialidad="1" ImpSaldoAnt="${f2(x.k.total)}" ImpPagado="${f2(pay)}" ImpSaldoInsoluto="${f2(x.k.total - pay)}" ObjetoImpDR="02"/></pago20:Pago></pago20:Pagos><tfd:TimbreFiscalDigital Version="1.1" UUID="${uid().toUpperCase()}" FechaTimbrado="${fp}" RfcProvCertif="DEMO000000000" SelloCFD="DEMO" NoCertificadoSAT="00000000000000000000" SelloSAT="DEMO"/></cfdi:Complemento></cfdi:Comprobante>`}); });
  return out;
}
