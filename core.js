/* ============ UTILIDADES ============ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const xa = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const r2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const f2 = n => r2(n).toFixed(2);
const f6 = n => (Math.round(Number(n) * 1e6) / 1e6).toFixed(6);
const num = v => { const n = parseFloat(String(v ?? '').replace(/,/g, '')); return isFinite(n) ? n : 0; };
const money = (n, m = 'MXN') => { try { return Number(n || 0).toLocaleString('es-MX', {style:'currency', currency: m === 'XXX' ? 'MXN' : m}); } catch (e) { return '$' + f2(n); } };
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random()*16|0; return (c === 'x' ? r : (r&3|8)).toString(16); }));
const sid = () => uid().replace(/-/g, '').slice(0, 16);
const clone = o => JSON.parse(JSON.stringify(o));
const lbl = (list, k) => { const r = list.find(x => x[0] === k); return r ? r[1] : ''; };
const opts = (list, sel, withCode = true, empty) => (empty !== undefined ? `<option value="">${esc(empty)}</option>` : '') + list.map(x => `<option value="${esc(x[0])}"${x[0] === sel ? ' selected' : ''}>${withCode ? esc(x[0]) + ' · ' : ''}${esc(x[1])}</option>`).join('');
const pad = n => String(n).padStart(2, '0');
const nowLocal = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const fmtDate = s => { if (!s) return ''; const d = new Date(s); return isNaN(d) ? s : d.toLocaleDateString('es-MX', {day:'2-digit', month:'short', year:'numeric'}); };
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

const RFC_PM = /^[A-ZÑ&]{3}[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[A-Z0-9]{2}[0-9A]$/;
const RFC_PF = /^[A-ZÑ&]{4}[0-9]{2}(0[1-9]|1[0-2])(0[1-9]|[12][0-9]|3[01])[A-Z0-9]{2}[0-9A]$/;
const RFC_PG = 'XAXX010101000', RFC_EXT = 'XEXX010101000';
const rfcTipo = r => { r = (r || '').toUpperCase(); if (r === RFC_PG) return 'PG'; if (r === RFC_EXT) return 'EXT'; if (RFC_PF.test(r)) return 'F'; if (RFC_PM.test(r)) return 'M'; return ''; };
const SOCIETARIO = /\b(S\.?\s?A\.?|S\.?\s?DE\s?R\.?\s?L\.?|S\.?\s?A\.?\s?P\.?\s?I\.?|S\.?\s?C\.?|A\.?\s?C\.?)\s*(DE\s*C\.?\s?V\.?)?\s*$/i;

async function sha256(t) {
  try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)); return Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2,'0')).join(''); }
  catch (e) { let h = 5381; for (const c of t) h = ((h << 5) + h + c.charCodeAt(0)) >>> 0; return 'x' + h.toString(16); }
}

const session = { get() { try { return localStorage.getItem('cfdi26:session'); } catch (e) { return null; } }, set(v) { try { v ? localStorage.setItem('cfdi26:session', v) : localStorage.removeItem('cfdi26:session'); } catch (e) {} } };

/* ============ MOTOR DE IMPUESTOS ============ */
function calcConcepto(c, tipo) {
  const cant = num(c.cantidad), vu = tipo === 'T' ? 0 : num(c.vu);
  const importe = r2(cant * vu), desc = r2(Math.min(num(c.descuento), importe)), base = r2(importe - desc);
  const tras = [], ret = [];
  const conImp = ['02', '05'].includes(c.objeto) && tipo !== 'T';
  if (conImp) {
    let iepsImp = 0;
    if (c.iepsCat && c.iepsFactor && c.iepsValor !== '') {
      if (c.iepsFactor === 'Cuota') { iepsImp = r2(cant * num(c.iepsValor)); tras.push({imp:'003', base: cant, factor:'Cuota', tasa: f6(c.iepsValor), importe: iepsImp}); }
      else { iepsImp = r2(base * num(c.iepsValor)); tras.push({imp:'003', base, factor:'Tasa', tasa: f6(c.iepsValor), importe: iepsImp}); }
    }
    if (c.iva === 'Exento') tras.push({imp:'002', base: r2(base + iepsImp), factor:'Exento', tasa:'', importe: 0});
    else if (c.iva !== '' && c.iva != null) tras.push({imp:'002', base: r2(base + iepsImp), factor:'Tasa', tasa: f6(c.iva), importe: r2((base + iepsImp) * num(c.iva))});
    if (num(c.retIsr) > 0) ret.push({imp:'001', base, factor:'Tasa', tasa: f6(c.retIsr), importe: r2(base * num(c.retIsr))});
    if (num(c.retIva) > 0) ret.push({imp:'002', base, factor:'Tasa', tasa: f6(c.retIva), importe: r2(base * num(c.retIva))});
  }
  return {importe, desc, base, tras, ret};
}
function calcDoc(d) {
  let sub = 0, des = 0; const T = {}, R = {};
  const lines = d.conceptos.map(c => {
    const k = calcConcepto(c, d.tipo); sub += k.importe; des += k.desc;
    k.tras.forEach(t => { const key = t.imp + '|' + t.factor + '|' + t.tasa; T[key] = T[key] || {imp:t.imp, factor:t.factor, tasa:t.tasa, base:0, importe:0}; T[key].base += t.base; T[key].importe += t.importe; });
    k.ret.forEach(t => { R[t.imp] = R[t.imp] || {imp:t.imp, importe:0, base:0, tasa:t.tasa}; R[t.imp].importe += t.importe; R[t.imp].base += t.base; });
    return k;
  });
  const tras = Object.values(T).map(t => ({...t, base: r2(t.base), importe: r2(t.importe)}));
  const ret = Object.values(R).map(t => ({...t, base: r2(t.base), importe: r2(t.importe)}));
  const totT = r2(tras.reduce((a, t) => a + t.importe, 0)), totR = r2(ret.reduce((a, t) => a + t.importe, 0));
  sub = r2(sub); des = r2(des);
  const total = d.tipo === 'T' ? 0 : r2(sub - des + totT - totR);
  return {lines, sub, des, tras, ret, totT, totR, total, hayImp: tras.length + ret.length > 0};
}

/* ============ VALIDACIONES LEGALES (bloquean la emisión) ============ */
function validar(d, em) {
  const E = [], W = [];
  const err = (m, ley, fix, attr, code) => E.push({m, ley, fix, attr, code}); const warn = (m, ley, fix, attr) => W.push({m, ley, fix, attr});
  if (!em) { err('Configura un perfil de emisor antes de facturar.', 'CFF art. 29-A fr. I'); return {E, W, k: calcDoc(d)}; }
  const rt = rfcTipo(d.receptor.rfc), et = rfcTipo(em.rfc), R = d.receptor;
  if (!em.csdNo) warn('Tu perfil no tiene número de certificado (CSD). Lo necesitarás para timbrar con tu PAC.', 'CFF art. 29 fr. II', null, 'NoCertificado');
  if (em.csdVence && new Date(em.csdVence) < new Date()) err('Tu CSD está vencido. Renuévalo en el SAT antes de emitir.', 'CFF art. 17-H', null, 'NoCertificado');
  if (!/^\d{5}$/.test(d.lugarExp || '')) err('El lugar de expedición debe ser un código postal de 5 dígitos.', 'Anexo 20, LugarExpedicion', 'f_lugar', 'LugarExpedicion', 'CFDI40126');
  if (!rt) err('El RFC del receptor no tiene un formato válido.', 'Anexo 20, Receptor/Rfc', 'f_rfc', 'Rfc');
  if (!R.nombre.trim()) err('Escribe el nombre o razón social del receptor tal como aparece en su Constancia de Situación Fiscal.', 'CFF art. 29-A fr. IV', 'f_nombre', 'Nombre');
  else if (SOCIETARIO.test(R.nombre.trim())) warn('El nombre del receptor parece incluir el régimen societario (S.A. de C.V., etc.). En CFDI 4.0 se escribe sin él.', 'Guía de llenado Anexo 20', 'quitarSoc', 'Nombre');
  if (!/^\d{5}$/.test(R.cp || '')) err('El código postal del receptor debe tener 5 dígitos.', 'Anexo 20, DomicilioFiscalReceptor', 'f_cp', 'DomicilioFiscalReceptor');
  if (!R.regimen) err('Selecciona el régimen fiscal del receptor.', 'Anexo 20, RegimenFiscalReceptor', 'regimenRec', 'RegimenFiscalReceptor');
  const reg = CAT.regimen.find(x => x[0] === R.regimen);
  if (reg && (rt === 'F' || rt === 'M') && !reg[2].includes(rt)) err(`El régimen ${R.regimen} no corresponde a una persona ${rt === 'F' ? 'física' : 'moral'}.`, 'c_RegimenFiscal', 'regimenRec', 'RegimenFiscalReceptor', 'CFDI40158');
  const uso = CAT.uso.find(x => x[0] === R.uso);
  if (!uso) err('Selecciona el uso del CFDI.', 'Anexo 20, UsoCFDI', 'usoRec', 'UsoCFDI');
  else if (R.regimen && !uso[2].includes(R.regimen)) err(`El uso ${R.uso} no es válido para el régimen ${R.regimen} del receptor.`, 'c_UsoCFDI', 'usoRec', 'UsoCFDI', 'CFDI40161');
  if (rt === 'PG') {
    if (R.regimen !== '616') err('Para público en general el régimen debe ser 616.', 'Guía de llenado, público en general', 'pgDatos', 'RegimenFiscalReceptor', 'CFDI40159');
    if (R.uso !== 'S01') err('Para público en general el uso debe ser S01.', 'Guía de llenado', 'pgDatos', 'UsoCFDI', 'CFDI40161');
    if (R.cp !== d.lugarExp) err('Para público en general el CP del receptor debe ser igual al lugar de expedición.', 'Anexo 20, DomicilioFiscalReceptor', 'cpExp', 'DomicilioFiscalReceptor', 'CFDI40149');
    if (d.global.on && R.nombre.trim().toUpperCase() !== 'PUBLICO EN GENERAL') err('En la factura global el nombre del receptor debe ser PUBLICO EN GENERAL.', 'Guía de llenado', 'pgDatos', 'Nombre');
  }
  if (rt === 'EXT') {
    if (!R.residencia || !R.numRegId) err('Para extranjeros captura residencia fiscal y número de registro tributario.', 'Anexo 20, ResidenciaFiscal', 'f_res', 'ResidenciaFiscal', 'CFDI40153');
    if (R.cp !== d.lugarExp) err('Para extranjeros el CP del receptor debe ser igual al lugar de expedición.', 'Anexo 20, DomicilioFiscalReceptor', 'cpExp', 'DomicilioFiscalReceptor', 'CFDI40149');
  }
  if (d.global.on && rt !== 'PG') err('La factura global solo se emite a XAXX010101000 (público en general).', 'RMF 2026, CFDI global', 'f_rfc', 'Rfc');
  if (d.tipo === 'T') {
    if (R.uso !== 'S01') err('En un CFDI de traslado el uso debe ser S01 (sin efectos fiscales).', 'Guía de llenado, traslado', 'usoS01', 'UsoCFDI', d.cp ? 'CP111' : '');
    if (d.receptor.rfc.toUpperCase() !== em.rfc.toUpperCase() && !d.cp) warn('En traslado de mercancía propia el receptor suele ser tu mismo RFC.', 'Guía Carta Porte');
  }
  if (d.tipo === 'I' || d.tipo === 'E') {
    if (!d.metodoPago) err('Selecciona el método de pago.', 'Anexo 20, MetodoPago', 'f_metodo', 'MetodoPago');
    if (d.metodoPago === 'PPD' && d.formaPago !== '99') err('Con método PPD la forma de pago debe ser 99 (por definir). El pago real se reporta en el complemento de pagos.', 'Anexo 20; CFF art. 29 fr. VI', 'forma99', 'FormaPago', 'CFDI40105');
    if (d.metodoPago === 'PUE' && d.formaPago === '99') err('Con método PUE la forma de pago no puede ser 99. Indica cómo te pagaron.', 'Anexo 20', 'formaReal', 'FormaPago');
    if (d.tipo === 'E' && d.metodoPago !== 'PUE') err('Un CFDI de egreso se emite con método PUE.', 'Guía de llenado, egreso', 'egresoPUE', 'MetodoPago');
    if (d.tipo === 'E' && !(d.relacion.tipo && d.relacion.uuids.trim())) err('Relaciona la factura de ingreso que corriges (tipo 01, 03 o 07).', 'Anexo 20, CfdiRelacionados', 'f_rel', 'CfdiRelacionados');
  }
  if (d.relacion.tipo || d.relacion.uuids.trim()) {
    const us = d.relacion.uuids.split(/[\s,]+/).filter(Boolean);
    if (!d.relacion.tipo) err('Selecciona el tipo de relación del CFDI relacionado.', 'c_TipoRelacion', 'f_rel', 'TipoRelacion');
    us.forEach(u => { if (!/^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/i.test(u)) err(`El folio fiscal ${u.slice(0, 13)}… no es un UUID válido.`, 'Anexo 20, CfdiRelacionado', 'f_rel', 'CfdiRelacionado'); });
  }
  if (d.sustituye) {
    const o = S.cfdis.find(x => x.id === d.sustituye);
    if (!o || o.estado === 'Cancelado') err('El CFDI que ibas a sustituir ya no está vigente.', 'CFF art. 29-A');
    else {
      if (d.relacion.tipo !== '04' || !d.relacion.uuids.toUpperCase().includes(o.uuid)) err(`Para sustituir ${o.serie}${o.folio} relaciónalo con tipo 04 (sustitución).`, 'CFF art. 29-A; motivo de cancelación 01', 'relSust', 'CfdiRelacionados');
      if (o.receptor.rfc !== d.receptor.rfc.toUpperCase()) warn('Cambiaste el RFC del receptor. Si el error del CFDI original era el RFC, cancela con motivo 02 y emite uno nuevo sin relación.', 'Guía de cancelación');
      const b = bloqueoCancelacion(o); if (b) err(b, 'CFF art. 29-A');
    }
  }
  if (d.moneda !== 'MXN' && d.tipo !== 'T' && !(num(d.tipoCambio) > 0)) err('Captura el tipo de cambio del día (DOF) para facturar en ' + d.moneda + '.', 'Anexo 20, TipoCambio; CFF art. 20', 'f_tc', 'TipoCambio', 'CFDI40115');
  if (d.exportacion === '02') err('La exportación definitiva A1 requiere el complemento de Comercio Exterior, que este sistema aún no genera.', 'RMF 2026, CCE 2.0', null, 'Exportacion', 'CFDI40122');
  if (!d.conceptos.length) err('Agrega al menos un concepto.', 'Anexo 20, Conceptos');
  const k = calcDoc(d);
  d.conceptos.forEach((c, i) => {
    const n = `Concepto ${i + 1}: `;
    if (!/^\d{8}$/.test(c.clave || '')) err(n + 'la clave de producto o servicio debe tener 8 dígitos.', 'c_ClaveProdServ', null, 'ClaveProdServ', 'CFDI40162');
    else if (c.clave === '01010101' && !d.global.on) err(n + 'la clave 01010101 solo se permite en la factura global.', 'Guía de llenado', null, 'ClaveProdServ');
    if (!CAT.unidad.some(u => u[0] === c.unidad) && !/^[A-Z0-9]{1,3}$/.test(c.unidad || '')) err(n + 'selecciona la clave de unidad.', 'c_ClaveUnidad', null, 'ClaveUnidad', 'CFDI40165');
    if (!(num(c.cantidad) > 0)) err(n + 'la cantidad debe ser mayor a cero.', 'Anexo 20, Cantidad', null, 'Cantidad');
    if (!String(c.descripcion || '').trim()) err(n + 'escribe la descripción.', 'CFF art. 29-A fr. V', null, 'Descripcion');
    if (d.tipo !== 'T' && !(num(c.vu) > 0)) err(n + 'el valor unitario debe ser mayor a cero.', 'Anexo 20, ValorUnitario', null, 'ValorUnitario', 'CFDI40166');
    if (num(c.descuento) > k.lines[i].importe) err(n + 'el descuento no puede ser mayor al importe.', 'Anexo 20, Descuento', null, 'Descuento', 'CFDI40169');
    if (d.tipo === 'T' && c.objeto !== '01') err(n + 'en traslado el objeto de impuesto debe ser 01.', 'Guía de llenado, traslado', null, 'ObjetoImp');
    if (c.objeto === '02' && d.tipo !== 'T' && !k.lines[i].tras.length && !k.lines[i].ret.length) err(n + 'con objeto 02 debes desglosar al menos un impuesto.', 'c_ObjetoImp', 'objeto02', 'ObjetoImp', 'CFDI40171');
    if (c.iva === '0.080000' && !em.frontera) err(n + 'IVA 8% solo si estás inscrito en el padrón de la región fronteriza.', 'Decreto región fronteriza (DOF 31/12/2025)', 'sinIva8', 'Impuestos');
    if ((num(c.retIsr) > 0 || num(c.retIva) > 0) && rt === 'F' && !['612', '606', '626', '625'].includes(R.regimen)) warn(n + 'las retenciones normalmente las hace una persona moral; revisa si tu cliente está obligado a retener.', 'LIVA art. 1-A');
    if (num(c.retIsr) === 0.10 && et === 'M') err(n + 'la retención de ISR del 10% aplica a personas físicas (honorarios/arrendamiento), no a personas morales.', 'LISR arts. 106 y 116', 'quitarRetIsr', 'Impuestos');
    if (num(c.retIsr) === 0.0125 && em.regimen !== '626') err(n + 'la retención de ISR del 1.25% aplica solo a emisores RESICO persona física.', 'LISR art. 113-J', 'quitarRetIsr', 'Impuestos');
  });
  if (d.global.on && d.conceptos.some(c => c.clave !== '01010101' || c.unidad !== 'ACT')) err('En factura global usa clave 01010101 y unidad ACT en todos los conceptos.', 'Guía de llenado, factura global', 'globalClave', 'ClaveProdServ');
  if (d.tipo === 'I' && d.formaPago === '01' && k.total > 2000) warn('Pagos en efectivo mayores a $2,000 no son deducibles para tu cliente.', 'LISR art. 27 fr. III');
  if (d.tipo === 'I' && d.formaPago === '01' && d.conceptos.some(c => /^151015/.test(c.clave))) warn('La compra de combustible pagada en efectivo no es deducible.', 'LISR art. 27 fr. III');
  if (d.tipo !== 'T' && k.total <= 0) err('El total del comprobante debe ser mayor a cero.', 'Anexo 20, Total', null, 'Total');
  if (d.cp) validarCP(d, em, err, warn);
  return {E, W, k};
}

function validarCP(d, em, err, warn) {
  const cp = d.cp, L = 'Complemento Carta Porte 3.1';
  const orig = cp.ubic.filter(u => u.tipo === 'Origen'), dest = cp.ubic.filter(u => u.tipo === 'Destino');
  if (!orig.length || !dest.length) err('La Carta Porte necesita al menos un origen y un destino.', L + ', Ubicaciones', null, 'Ubicacion', 'CP130');
  cp.ubic.forEach((u, i) => {
    const n = `${u.tipo} ${i + 1}: `;
    if (!rfcTipo(u.rfc)) err(n + 'RFC del remitente o destinatario inválido.', L);
    if (!/^\d{5}$/.test(u.cp || '')) err(n + 'código postal de 5 dígitos.', L);
    if (!u.estado) err(n + 'selecciona el estado.', L);
    if (!u.fecha) err(n + 'captura fecha y hora de ' + (u.tipo === 'Origen' ? 'salida.' : 'llegada.'), L);
    if (u.tipo === 'Destino' && !(num(u.dist) > 0)) err(n + 'captura la distancia recorrida en km.', L + ', DistanciaRecorrida', null, 'DistanciaRecorrida', 'CP141');
  });
  if (orig[0] && dest.length && orig[0].fecha && dest[0].fecha && new Date(dest[0].fecha) <= new Date(orig[0].fecha)) err('La fecha de llegada debe ser posterior a la de salida.', L);
  if (!cp.merc.length) err('Agrega al menos una mercancía transportada.', L + ', Mercancias');
  cp.merc.forEach((m, i) => {
    const n = `Mercancía ${i + 1}: `;
    if (!/^\d{8}$/.test(m.bien || '')) err(n + 'clave de bienes transportados de 8 dígitos.', 'c_ClaveProdServCP');
    if (!String(m.desc || '').trim()) err(n + 'escribe la descripción.', L);
    if (!(num(m.cant) > 0)) err(n + 'cantidad mayor a cero.', L);
    if (!(num(m.peso) > 0)) err(n + 'peso en kg mayor a cero.', L + ', PesoEnKg');
    if (m.peligroso === 'Sí' && !m.cvePel) err(n + 'para material peligroso captura la clave UN (c_MaterialPeligroso).', L + '; NOM-002-SCT', null, 'CveMaterialPeligroso', 'CP156');
    if (m.peligroso === 'Sí' && !m.embalaje) err(n + 'para material peligroso captura el tipo de embalaje (c_TipoEmbalaje).', L + '; NOM-002-SCT', null, 'Embalaje', 'CP157');
  });
  const v = cp.veh;
  if (!v.perm) err('Selecciona el tipo de permiso SCT (usa TPAF02 si es transporte privado).', L + ', PermSCT');
  if (!String(v.numPerm || '').trim()) err('Captura el número de permiso SCT.', L + ', NumPermisoSCT');
  if (!v.config) err('Selecciona la configuración vehicular.', 'c_ConfigAutotransporte');
  if (!/^[A-Z0-9]{5,7}$/.test(String(v.placa || '').toUpperCase())) err('La placa debe tener de 5 a 7 letras o números, sin guiones ni espacios.', L + ', PlacaVM');
  if (!/^(19|20)\d{2}$/.test(String(v.anio || '')) || num(v.anio) > new Date().getFullYear() + 1) err('Año del modelo del vehículo inválido.', L + ', AnioModeloVM');
  if (!(num(v.pesoVeh) > 0)) err('Captura el peso bruto vehicular en toneladas.', L + ', PesoBrutoVehicular');
  if (!String(v.aseg || '').trim() || !String(v.poliza || '').trim()) err('Captura aseguradora y póliza de responsabilidad civil.', L + ', Seguros');
  const rq = (CAT.configMeta[v.config] || {}).rem;
  if (rq === '1' && (!v.remSub || !/^[A-Z0-9]{5,7}$/.test(String(v.remPlaca || '').toUpperCase()))) err(`La configuración ${v.config} requiere el remolque o semirremolque con su placa (c_ConfigAutotransporte, Remolque = 1).`, L + ', Remolques', null, 'Remolques', 'CP184');
  if (rq === '0' && v.remSub) err(`La configuración ${v.config} no lleva remolque: quita el remolque (c_ConfigAutotransporte, Remolque = 0).`, L + ', Remolques', null, 'Remolques', 'CP184');
  if (v.config === 'VL' && num(v.pesoVeh) > 4.5) err('La configuración VL es para vehículos de hasta 4.5 t de peso bruto.', 'c_ConfigAutotransporte');
  if (!cp.ops.length || !cp.ops.some(o => o.tipo === '01')) err('Agrega al operador del vehículo (figura 01).', L + ', FiguraTransporte', null, 'TiposFigura', 'CP194');
  cp.ops.forEach((o, i) => { if (!rfcTipo(o.rfc) || rfcTipo(o.rfc) === 'PG') err(`Figura ${i + 1}: RFC inválido.`, L); if (o.tipo === '01' && !String(o.licencia || '').trim()) err(`Figura ${i + 1}: el operador necesita número de licencia federal.`, L, null, 'NumLicencia', 'CP196'); if (['02', '03'].includes(o.tipo) && !o.parte) err(`Figura ${i + 1}: el propietario o arrendador debe indicar la parte del transporte que no es tuya (c_ParteTransporte).`, L, null, 'PartesTransporte', 'CP199'); });
  if (d.tipo === 'I' && !d.conceptos.some(c => CCPSAT.fleteClaves.includes(c.clave))) err('Una Carta Porte de ingreso debe facturar una clave de servicio de transporte autorizada (78101802 flete nacional, 78101801 local, 78121603 tarifa de fletes, etc.).', L + ', ClaveProdServ', null, 'ClaveProdServ', 'CP109');
  if (d.tipo === 'T' && String(d.receptor.rfc || '').toUpperCase() !== String(em.rfc).toUpperCase()) err('En un traslado con Carta Porte el RFC del receptor debe ser tu propio RFC.', L + ', Receptor:Rfc', 'recPropio', 'Rfc', 'CP107');
  if (cp.merc.some(m => m.peligroso === 'Sí') && (!String(v.asegMA || '').trim() || !String(v.polizaMA || '').trim())) err('Con material peligroso captura la aseguradora y la póliza de daños al medio ambiente.', L + ', Seguros', null, 'AseguraMedAmbiente', 'CP182');
}

/* ============ XML CFDI 4.0 ============ */
function attrs(o) { return Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => ` ${k}="${xa(v)}"`).join(''); }
function xmlCFDI(d, em, k, extra = {}) {
  const loc = ['http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd'];
  const ns = ['xmlns:cfdi="http://www.sat.gob.mx/cfd/4"', 'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"'];
  if (d.cp) { ns.push('xmlns:cartaporte31="http://www.sat.gob.mx/CartaPorte31"'); loc.push('http://www.sat.gob.mx/CartaPorte31 http://www.sat.gob.mx/sitio_internet/cfd/CartaPorte/CartaPorte31.xsd'); }
  if (extra.pagos) { ns.push('xmlns:pago20="http://www.sat.gob.mx/Pagos20"'); loc.push('http://www.sat.gob.mx/Pagos20 http://www.sat.gob.mx/sitio_internet/cfd/Pagos/Pagos20.xsd'); }
  if (extra.tfd) { ns.push('xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital"'); }
  const isP = d.tipo === 'P', isT = d.tipo === 'T';
  let x = `<?xml version="1.0" encoding="UTF-8"?>\n<cfdi:Comprobante ${ns.join(' ')} xsi:schemaLocation="${loc.join(' ')}"` + attrs({
    Version: '4.0', Serie: d.serie, Folio: d.folio, Fecha: d.fecha, Sello: extra.tfd ? 'DEMO' : '', FormaPago: (isP || isT) ? '' : d.formaPago,
    NoCertificado: em.csdNo || '00000000000000000000', Certificado: '', CondicionesDePago: (isP || isT) ? '' : d.condiciones,
    SubTotal: isP || isT ? '0' : f2(k.sub), Descuento: !isP && !isT && k.des > 0 ? f2(k.des) : '', Moneda: isP ? 'XXX' : (isT ? 'XXX' : d.moneda),
    TipoCambio: !isP && !isT && d.moneda !== 'MXN' ? f6(d.tipoCambio) : '', Total: isP || isT ? '0' : f2(k.total), TipoDeComprobante: d.tipo,
    Exportacion: d.exportacion, MetodoPago: (isP || isT) ? '' : d.metodoPago, LugarExpedicion: d.lugarExp
  }) + '>\n';
  if (d.global.on) x += `  <cfdi:InformacionGlobal${attrs({Periodicidad: d.global.periodicidad, Meses: d.global.meses, 'Año': d.global.anio})}/>\n`;
  if (d.relacion.tipo && d.relacion.uuids.trim()) {
    x += `  <cfdi:CfdiRelacionados TipoRelacion="${xa(d.relacion.tipo)}">\n` + d.relacion.uuids.split(/[\s,]+/).filter(Boolean).map(u => `    <cfdi:CfdiRelacionado UUID="${xa(u.toUpperCase())}"/>\n`).join('') + '  </cfdi:CfdiRelacionados>\n';
  }
  x += `  <cfdi:Emisor${attrs({Rfc: em.rfc, Nombre: em.nombre, RegimenFiscal: em.regimen})}/>\n`;
  const R = d.receptor, rt = rfcTipo(R.rfc);
  x += `  <cfdi:Receptor${attrs({Rfc: R.rfc.toUpperCase(), Nombre: R.nombre.toUpperCase(), DomicilioFiscalReceptor: R.cp, ResidenciaFiscal: rt === 'EXT' ? R.residencia : '', NumRegIdTrib: rt === 'EXT' ? R.numRegId : '', RegimenFiscalReceptor: R.regimen, UsoCFDI: R.uso})}/>\n`;
  x += '  <cfdi:Conceptos>\n';
  d.conceptos.forEach((c, i) => {
    const l = k.lines[i];
    x += `    <cfdi:Concepto${attrs({ClaveProdServ: c.clave, NoIdentificacion: c.noIdent, Cantidad: String(num(c.cantidad)), ClaveUnidad: c.unidad, Unidad: isP ? '' : (UNIDAD_MAP.get(c.unidad) || lbl(CAT.unidad, c.unidad)), Descripcion: c.descripcion, ValorUnitario: isT || isP ? '0' : fmtVUs(c.vu), Importe: isP ? '0' : f2(l.importe), Descuento: l.desc > 0 ? f2(l.desc) : '', ObjetoImp: c.objeto})}`;
    if (l.tras.length || l.ret.length) {
      x += '>\n      <cfdi:Impuestos>\n';
      if (l.tras.length) x += '        <cfdi:Traslados>\n' + l.tras.map(t => `          <cfdi:Traslado${attrs({Base: t.factor === 'Cuota' ? f6(t.base) : f2(t.base), Impuesto: t.imp, TipoFactor: t.factor, TasaOCuota: t.factor === 'Exento' ? '' : t.tasa, Importe: t.factor === 'Exento' ? '' : f2(t.importe)})}/>\n`).join('') + '        </cfdi:Traslados>\n';
      if (l.ret.length) x += '        <cfdi:Retenciones>\n' + l.ret.map(t => `          <cfdi:Retencion${attrs({Base: t.factor === 'Cuota' ? f6(t.base) : f2(t.base), Impuesto: t.imp, TipoFactor: t.factor || 'Tasa', TasaOCuota: t.tasa, Importe: f2(t.importe)})}/>\n`).join('') + '        </cfdi:Retenciones>\n';
      x += '      </cfdi:Impuestos>\n    </cfdi:Concepto>\n';
    } else x += '/>\n';
  });
  x += '  </cfdi:Conceptos>\n';
  if (k.hayImp && !isP && !isT) {
    x += `  <cfdi:Impuestos${attrs({TotalImpuestosRetenidos: k.ret.length ? f2(k.totR) : '', TotalImpuestosTrasladados: k.tras.some(t => t.factor !== 'Exento') ? f2(k.totT) : ''})}>\n`;
    if (k.ret.length) x += '    <cfdi:Retenciones>\n' + k.ret.map(t => `      <cfdi:Retencion Impuesto="${t.imp}" Importe="${f2(t.importe)}"/>\n`).join('') + '    </cfdi:Retenciones>\n';
    if (k.tras.length) x += '    <cfdi:Traslados>\n' + k.tras.map(t => `      <cfdi:Traslado${attrs({Base: t.factor === 'Cuota' ? f6(t.base) : f2(t.base), Impuesto: t.imp, TipoFactor: t.factor, TasaOCuota: t.factor === 'Exento' ? '' : t.tasa, Importe: t.factor === 'Exento' ? '' : f2(t.importe)})}/>\n`).join('') + '    </cfdi:Traslados>\n';
    x += '  </cfdi:Impuestos>\n';
  }
  const comp = [];
  if (d.cp) comp.push(xmlCP(d));
  if (extra.pagos) comp.push(extra.pagos);
  if (extra.tfd) comp.push(`    <tfd:TimbreFiscalDigital xsi:schemaLocation="http://www.sat.gob.mx/TimbreFiscalDigital http://www.sat.gob.mx/sitio_internet/cfd/TimbreFiscalDigital/TimbreFiscalDigitalv11.xsd" Version="1.1" UUID="${extra.tfd.uuid}" FechaTimbrado="${extra.tfd.fecha}" RfcProvCertif="DEMO000000000" SelloCFD="DEMO" NoCertificadoSAT="00000000000000000000" SelloSAT="DEMO-SIN-VALIDEZ-FISCAL"/>`);
  if (comp.length) x += '  <cfdi:Complemento>\n' + comp.join('\n') + '\n  </cfdi:Complemento>\n';
  return x + '</cfdi:Comprobante>\n';
}
function xmlCP(d) {
  const cp = d.cp, P = 'cartaporte31';
  const tot = r2(cp.ubic.filter(u => u.tipo === 'Destino').reduce((a, u) => a + num(u.dist), 0));
  const peso = cp.merc.reduce((a, m) => a + num(m.peso), 0);
  let io = 0, id = 0;
  let x = `    <${P}:CartaPorte${attrs({Version: '3.1', IdCCP: cp.idccp, TranspInternac: 'No', TotalDistRec: f2(tot)})}>\n      <${P}:Ubicaciones>\n`;
  cp.ubic.forEach(u => {
    const idu = (u.tipo === 'Origen' ? 'OR' : 'DE') + String(u.tipo === 'Origen' ? ++io : ++id).padStart(6, '0');
    x += `        <${P}:Ubicacion${attrs({TipoUbicacion: u.tipo, IDUbicacion: idu, RFCRemitenteDestinatario: u.rfc.toUpperCase(), NombreRemitenteDestinatario: u.nombre, FechaHoraSalidaLlegada: (u.fecha || '').length === 16 ? u.fecha + ':00' : u.fecha, DistanciaRecorrida: u.tipo === 'Destino' ? f2(u.dist) : ''})}>\n`;
    x += `          <${P}:Domicilio${attrs({Calle: u.calle, Colonia: u.colonia, Localidad: u.localidad, Municipio: u.municipio, Estado: u.estado, Pais: u.pais || 'MEX', CodigoPostal: u.cp})}/>\n        </${P}:Ubicacion>\n`;
  });
  x += `      </${P}:Ubicaciones>\n      <${P}:Mercancias${attrs({PesoBrutoTotal: (Math.round(peso * 1000) / 1000).toFixed(3), UnidadPeso: 'KGM', NumTotalMercancias: cp.merc.length})}>\n`;
  cp.merc.forEach(m => {
    const pc = PRODSERV.find(p => p[0] === m.bien);
    x += `        <${P}:Mercancia${attrs({BienesTransp: m.bien, Descripcion: m.desc, Cantidad: String(num(m.cant)), ClaveUnidad: m.unidad, MaterialPeligroso: (m.peligroso === 'Sí' || ['1', '0,1'].includes(ccpFlag(m.bien))) ? (m.peligroso === 'Sí' ? 'Sí' : 'No') : '', CveMaterialPeligroso: m.peligroso === 'Sí' ? m.cvePel : '', Embalaje: m.peligroso === 'Sí' ? m.embalaje : '', PesoEnKg: String(num(m.peso)), ValorMercancia: num(m.valor) > 0 ? f2(m.valor) : '', Moneda: num(m.valor) > 0 ? 'MXN' : ''})}/>\n`;
  });
  const v = cp.veh;
  x += `        <${P}:Autotransporte${attrs({PermSCT: v.perm, NumPermisoSCT: v.numPerm})}>\n          <${P}:IdentificacionVehicular${attrs({ConfigVehicular: v.config, PesoBrutoVehicular: String(num(v.pesoVeh)), PlacaVM: String(v.placa).toUpperCase(), AnioModeloVM: v.anio})}/>\n          <${P}:Seguros${attrs({AseguraRespCivil: v.aseg, PolizaRespCivil: v.poliza, AseguraMedAmbiente: cp.merc.some(m => m.peligroso === 'Sí') ? v.asegMA : '', PolizaMedAmbiente: cp.merc.some(m => m.peligroso === 'Sí') ? v.polizaMA : '', AseguraCarga: v.asegCarga, PolizaCarga: v.polizaCarga, PrimaSeguro: num(v.prima) > 0 ? f2(v.prima) : ''})}/>\n`;
  if (((CAT.configMeta[v.config] || {}).rem !== '0') && v.remSub) x += `          <${P}:Remolques>\n            <${P}:Remolque${attrs({SubTipoRem: v.remSub, Placa: String(v.remPlaca || '').toUpperCase()})}/>\n          </${P}:Remolques>\n`;
  x += `        </${P}:Autotransporte>\n      </${P}:Mercancias>\n      <${P}:FiguraTransporte>\n`;
  cp.ops.forEach(o => { const pt = ['02', '03'].includes(o.tipo) && o.parte; x += `        <${P}:TiposFigura${attrs({TipoFigura: o.tipo, RFCFigura: o.rfc.toUpperCase(), NumLicencia: o.tipo === '01' ? o.licencia : '', NombreFigura: o.nombre})}${pt ? `>\n          <${P}:PartesTransporte ParteTransporte="${xa(o.parte)}"/>\n        </${P}:TiposFigura>` : '/>'}\n`; });
  return x + `      </${P}:FiguraTransporte>\n    </${P}:CartaPorte>`;
}
const idCCP = () => 'CCC' + uid().toUpperCase().slice(3);

/* ZIP sin compresión (para entregar el XML; el visor solo permite ciertas extensiones) */
const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function makeZip(files) {
  const enc = new TextEncoder(), parts = [], cen = []; let off = 0;
  files.forEach(f => {
    const name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, name.length, true);
    parts.push(new Uint8Array(h.buffer), name, data);
    const c = new DataView(new ArrayBuffer(46)); c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, name.length, true); c.setUint32(42, off, true);
    cen.push(new Uint8Array(c.buffer), name); off += 30 + name.length + data.length;
  });
  const csize = cen.reduce((a, b) => a + b.length, 0);
  const e = new DataView(new ArrayBuffer(22)); e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, csize, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...cen, new Uint8Array(e.buffer)], {type: 'application/zip'});
}
/* Descarga estándar del navegador (fuera de claude.ai) */
const MIME_EXT = {xml: 'application/xml', pdf: 'application/pdf', zip: 'application/zip', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', csv: 'text/csv;charset=utf-8', txt: 'text/plain;charset=utf-8', json: 'application/json', html: 'text/html;charset=utf-8'};
function descargarNavegador(filename, data) {
  const ext = String(filename).split('.').pop().toLowerCase(), blob = data instanceof Blob ? data : new Blob([data], {type: MIME_EXT[ext] || 'application/octet-stream'});
  const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = filename; a.rel = 'noopener'; a.style.display = 'none';
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
}
async function ofrecerArchivo(filename, data) {
  try {
    const dl = enClaude() ? await window.claude.use('downloads').catch(() => null) : null;
    if (!dl) { descargarNavegador(filename, data); toast('Archivo listo: ' + filename, 'ok'); return true; }
    await dl.save({filename, data}); toast('Archivo listo: ' + filename, 'ok'); return true;
  } catch (e) { if (e && e.code !== 'declined') toast('No se pudo descargar (' + (e.code || e) + ').', 'bad'); return false; }
}
