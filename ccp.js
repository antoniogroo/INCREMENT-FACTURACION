/* ============ CARTA PORTE 3.1, PAGOS 2.0, PLATAFORMAS Y MATRICES DE ERRORES OFICIALES ============ */
/* ---- Carga de c_ClaveProdServCP y c_MaterialPeligroso ---- */
function pscpLoad() {
  if (PSCP.list || PSCP.loading) return PSCP.loading;
  PSCP.loading = Promise.all([fetch('data/prodservcp.json').then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }), fetch('data/ccp_mp.json').then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })])
    .then(([ps, mp]) => {
      PSCP.list = ps.map(x => [x[0], x[1], x[2], x[3], (x[0] + ' ' + x[1] + ' ' + x[3]).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')]); PSCP.map = new Map(PSCP.list.map(x => [x[0], x]));
      PSCP.mp = new Map(mp.map(x => [x[0], x]));
      if (S.acct && S.view === 'cartaporte') render();
    }).catch(e => { PSCP.err = 'No se pudo leer el catálogo de Carta Porte en este visor (' + (e.message || e) + ').'; PSCP.loading = null; });
  return PSCP.loading;
}
function mpNombre(k) { const o = PSCP.mp && PSCP.mp.get(String(k || '').trim().toUpperCase().replace(/^UN/, '').padStart(4, '0')); return o ? `${o[1]} · clase ${o[2]}${o[3] ? ' · peligro secundario ' + o[3] : ''}` : ''; }
const mpKey = k => String(k || '').trim().toUpperCase().replace(/^UN/, '').padStart(4, '0');

/* ---- Validaciones del complemento contra sus catálogos (Matriz de errores Carta Porte 3.1) ---- */
const _validarCPccp = validarCP;
validarCP = function (d, em, err, warn) {
  _validarCPccp(d, em, err, warn);
  const L = 'Complemento Carta Porte 3.1';
  if (!PSCP.list && !PSCP.err) pscpLoad();
  d.cp.merc.forEach((m, i) => {
    const n = `Mercancía ${i + 1}: `, fl = ccpFlag(m.bien);
    if (PSCP.map && /^\d{8}$/.test(m.bien || '') && !PSCP.map.has(m.bien)) err(n + `la clave ${m.bien} no existe en c_ClaveProdServCP.`, 'catCartaPorte:c_ClaveProdServCP', null, 'BienesTransp', 'CP999');
    if (m.peligroso === 'Sí' && fl === '0') err(n + `la clave ${m.bien} no es material peligroso en c_ClaveProdServCP (columna = 0): el atributo MaterialPeligroso debe omitirse.`, L, null, 'MaterialPeligroso', 'CP155');
    if (fl === '1' && m.peligroso !== 'Sí') warn(n + `c_ClaveProdServCP marca la clave ${m.bien} como material peligroso. Confírmalo con quien te envía la mercancía (instructivo, nota 8).`, L, null, 'MaterialPeligroso');
    if (m.peligroso === 'Sí' && m.cvePel && PSCP.mp && !PSCP.mp.has(mpKey(m.cvePel))) err(n + `la clave ${m.cvePel} no existe en c_MaterialPeligroso.`, 'catCartaPorte:c_MaterialPeligroso', null, 'CveMaterialPeligroso', 'CP156');
    if (m.peligroso === 'Sí' && m.embalaje && !CAT.embalaje.some(e => e[0] === m.embalaje)) err(n + `el embalaje ${m.embalaje} no existe en c_TipoEmbalaje.`, 'catCartaPorte:c_TipoEmbalaje', null, 'Embalaje', 'CP157');
    if (m.unidad && !UNIDAD_MAP.has(m.unidad)) err(n + `la unidad ${m.unidad} no existe en c_ClaveUnidad. Elige una del catálogo (H87 Pieza, KGM Kilogramo, XBX Caja…) o sube el catálogo c_ClaveUnidad actualizado.`, 'catCFDI:c_ClaveUnidad · Instructivo Carta Porte 3.1, Mercancia@ClaveUnidad', null, 'ClaveUnidad', 'CP999');
  });
  const v = d.cp.veh;
  if (v.config && !CAT.configMeta[v.config]) err(`La configuración vehicular ${v.config} no existe en c_ConfigAutotransporte.`, 'catCartaPorte:c_ConfigAutotransporte', null, 'ConfigVehicular', 'CP999');
  if (v.perm && !CAT.permSCT.some(p => p[0] === v.perm)) err(`El permiso ${v.perm} no existe en c_TipoPermiso para autotransporte.`, 'catCartaPorte:c_TipoPermiso', null, 'PermSCT', 'CP999');
  if (v.remSub && !CAT.subTipoRem.some(r => r[0] === v.remSub)) err(`El subtipo de remolque ${v.remSub} no existe en c_SubTipoRem.`, 'catCartaPorte:c_SubTipoRem', null, 'SubTipoRem', 'CP999');
  d.cp.ops.forEach((o, i) => { if (o.parte && !CAT.parteTransporte.some(p => p[0] === o.parte)) err(`Figura ${i + 1}: la parte ${o.parte} no existe en c_ParteTransporte.`, 'catCartaPorte:c_ParteTransporte', null, 'ParteTransporte', 'CP999'); });
  if (d.tipo === 'T' && d.conceptos.some(c => ['31181701', '24112700'].includes(c.clave))) warn('Con claves de empaques (31181701) o estibas (24112700) en un traslado, el SAT pide el nodo GuiasIdentificacion por mercancía (CP177), que este sistema aún no captura.', L, null, 'GuiasIdentificacion');
};
FIXES.recPropio = {l: 'Usar mi RFC como receptor (S01)', run: d => { const em = EM(); Object.assign(d.receptor, {rfc: em.rfc, nombre: em.nombre, regimen: em.regimen, cp: em.cp, uso: 'S01'}); }};
/* Datalist de materiales peligrosos y catálogo de bienes transportados */
const _cartaPorteHTMLccp = cartaPorteHTML;
cartaPorteHTML = function (d) {
  pscpLoad();
  const h = _cartaPorteHTMLccp(d), need = d.cp.merc.some(m => m.peligroso === 'Sí');
  return h + (need && PSCP.mp ? `<datalist id="dlmp">${[...PSCP.mp.values()].map(x => `<option value="${x[0]}">${esc(x[1].slice(0, 80))}</option>`).join('')}</datalist>` : '') + (PSCP.err ? `<div class="alert warn"><span>${esc(PSCP.err)}</span></div>` : '');
};
function psCpBuscar(q, n = 60) {
  const ws = normQ(q).split(/\s+/).filter(Boolean); if (!PSCP.list) return [];
  const out = [];
  if (ws.length === 1 && /^\d{2,8}$/.test(ws[0])) { for (const p of PSCP.list) { if (out.length >= n) break; if (p[0].startsWith(ws[0])) out.push(p); } return out; }
  for (const p of PSCP.list) { if (out.length >= n) break; if (!ws.length || ws.every(w => p[4].includes(w))) out.push(p); }
  return out;
}
function openCatalogCP(onPick) {
  pscpLoad();
  const m2 = $('#modal2'); m2.hidden = false; m2.innerHTML = `<div class="sheet wide" role="dialog" aria-modal="true"><header class="mh"><h3>Catálogo c_ClaveProdServCP (bienes transportados)</h3><button class="x" data-a="close2" aria-label="Cerrar">×</button></header>
  <div class="fld"><label for="catq">Busca por palabra, sinónimo o clave</label><input id="catq" placeholder="ej. cemento, gasolina, 1211…" autocomplete="off"></div><p class="muted small" id="catinfo"></p><div id="catres" class="catres"></div></div>`; $('#catq').focus();
  const flagChip = f => f === '1' ? chip('Material peligroso', 'bad') : f === '0,1' ? chip('Puede ser peligroso', 'warn') : '';
  const run = () => {
    $('#catinfo').textContent = PSCP.list ? `Catálogo oficial de Carta Porte: ${PSCP.list.length.toLocaleString('es-MX')} claves, con la columna “Material peligroso”.` : PSCP.err || 'Cargando el catálogo…';
    const res = psCpBuscar($('#catq').value, 60);
    $('#catres').innerHTML = res.length ? res.map(p => `<button type="button" class="catrow" data-k="${p[0]}" data-d="${esc(p[1])}"><span class="mono">${p[0]}</span><span>${esc(p[1])}${p[3] ? `<small class="muted"> · ${esc(p[3].slice(0, 80))}</small>` : ''}</span>${flagChip(p[2])}</button>`).join('') : '<p class="muted">Sin resultados.</p>';
  };
  $('#catq').addEventListener('input', run); run(); if (!PSCP.list && PSCP.loading) PSCP.loading.then(() => { if (!m2.hidden && $('#catq')) run(); });
  $('#catres').addEventListener('click', e => { const b = e.target.closest('.catrow'); if (b) { close2(); onPick(b.dataset.k, b.dataset.d); } });
}
A.pickCatMerc = el => openCatalogCP((k, d) => { const m = S.draft.cp.merc[+el.dataset.i]; m.bien = k; if (!m.desc) m.desc = d; const f = ccpFlag(k); m.peligroso = f === '1' ? 'Sí' : f === '0' ? 'No' : m.peligroso; render(); });
document.addEventListener('change', e => {
  const el = e.target, mm = /^cp\.merc\.(\d+)\.bien$/.exec(el.dataset.b || ''); if (!mm || !S.draft || !S.draft.cp) return;
  setTimeout(async () => { await pscpLoad(); const m = S.draft && S.draft.cp && S.draft.cp.merc[+mm[1]]; if (!m) return; const f = ccpFlag(m.bien), o = PSCP.map && PSCP.map.get(m.bien); if (f === '1') m.peligroso = 'Sí'; if (f === '0') m.peligroso = 'No'; if (o && !m.desc) m.desc = o[1]; render(); }, 0);
});
document.addEventListener('input', e => { const el = e.target, mm = /^cp\.merc\.(\d+)\.cvePel$/.exec(el.dataset.b || ''); if (mm) { const s = $('#mpd_' + mm[1]); if (s) s.textContent = mpNombre(el.value); } });
/* Excel Carta Porte: unidades y bienes contra el catálogo del complemento */
(function ccpLayout() {
  const merc = LAYOUTS.cp.sections.find(s => s.k === 'merc'), u = merc.fields.find(f => f.k === 'Clave_Unidad');
  XLC.UnidadPeso = CAT.unidadPeso; XLC_TITLE.UnidadPeso = 'c_ClaveUnidadPeso'; FULLCAT.UnidadPeso = CAT.unidadPeso;
  Object.assign(u, {cat: 'Unidad', open: false, d: 'Clave de c_ClaveUnidad (catCFDI), como pide el instructivo de Carta Porte 3.1: KGM, H87, XBX, LTR, TNE…'});
  ['Config', 'Perm', 'Remolque', 'Embalaje'].forEach(k => { XLC[k] = ({Config: CAT.configVeh, Perm: CAT.permSCT, Remolque: CAT.subTipoRem, Embalaje: CAT.embalaje})[k]; FULLCAT[k] = XLC[k]; });
})();
const _candadosCcp = candados;
candados = function (sec, row, errs, warns) {
  _candadosCcp(sec, row, errs, warns);
  if (sec === 'merc' && PSCP.map) { const k = pad0(row.BienesTransp, 8); if (/^\d{8}$/.test(k) && !PSCP.map.has(k)) addErr(errs, `La clave ${k} no existe en c_ClaveProdServCP.`, sec, row, 'BienesTransp', 'cell', 'CP999'); if (siNo(row.MaterialPeligroso) && ccpFlag(k) === '0') addErr(errs, `La clave ${k} no es material peligroso en c_ClaveProdServCP: deja MaterialPeligroso en “No”.`, sec, row, 'MaterialPeligroso', 'cell', 'CP155'); if (siNo(row.MaterialPeligroso) && row.Cve_Material_Peligroso && PSCP.mp && !PSCP.mp.has(mpKey(row.Cve_Material_Peligroso))) addErr(errs, `La clave UN ${row.Cve_Material_Peligroso} no existe en c_MaterialPeligroso.`, sec, row, 'Cve_Material_Peligroso', 'cell', 'CP156'); }
};
const _aplicarCcp = aplicarConProgreso;
aplicarConProgreso = async function (o = {}) { if (S.mas.layout === 'cp') await pscpLoad(); return _aplicarCcp(o); };

/* ---- Reglas adicionales del CFDI 4.0 (matriz de errores) ---- */
const _validarMat = validar;
validar = function (d, em) {
  const v = _validarMat(d, em); if (!d || !em) return v;
  const err = (m, ley, fix, attr, code) => v.E.push({m, ley, fix, attr, code});
  if (d.global && d.global.on && d.tipo === 'I') {
    const p = d.global.periodicidad, mes = d.global.meses, an = num(d.global.anio), y = new Date().getFullYear();
    if (p === '05' && em.regimen !== '621') err('La periodicidad bimestral (05) en la factura global solo aplica al régimen 621 (Incorporación Fiscal).', 'Anexo 20, InformacionGlobal', null, 'Periodicidad', 'CFDI40132');
    if (p !== '05' && !/^(0[1-9]|1[0-2])$/.test(mes)) err('Con periodicidad distinta de bimestral, el mes de la factura global debe ser 01 a 12.', 'Anexo 20, InformacionGlobal', null, 'Meses', 'CFDI40134');
    if (p === '05' && !/^1[3-8]$/.test(mes)) err('Con periodicidad bimestral, el campo Meses debe ser 13 a 18 (bimestre).', 'Anexo 20, InformacionGlobal', null, 'Meses', 'CFDI40135');
    if (!(an === y || an === y - 1)) err('El año de la factura global debe ser el ejercicio en curso o el anterior.', 'Anexo 20, InformacionGlobal', null, 'Año', 'CFDI40136');
  }
  if (['I', 'E'].includes(d.tipo)) d.conceptos.forEach((c, i) => {
    if (['15101505', '15101514', '15101515'].includes(c.clave)) err(`Concepto ${i + 1}: la clave ${c.clave} (combustible) exige el Complemento Concepto de Hidrocarburos y Petrolíferos, que este sistema no genera.`, 'Anexo 20', null, 'ClaveProdServ', 'CFDI140228');
    const l = (v.k.lines || [])[i] || {tras: [], ret: []};
    if (['06', '08'].includes(c.objeto) && l.tras.concat(l.ret).some(t => ['002', '003'].includes(t.imp))) err(`Concepto ${i + 1}: con ObjetoImp ${c.objeto} no se trasladan ni retienen IVA ni IEPS (solo puede haber retención de ISR).`, 'c_ObjetoImp', null, 'ObjetoImp', 'CFDI140226');
    if (c.objeto === '07' && (l.tras.concat(l.ret).some(t => t.imp === '002') || !l.tras.some(t => t.imp === '003'))) err(`Concepto ${i + 1}: con ObjetoImp 07 no va IVA y sí debe trasladarse IEPS.`, 'c_ObjetoImp', null, 'ObjetoImp', 'CFDI140227');
  });
  if (d.especial) { const keep = []; v.E.forEach(e => { if (['CFDI40132', 'CFDI40134', 'CFDI40135', 'CFDI40136', 'CFDI140226', 'CFDI140227', 'CP107', 'CP109', 'CP184', 'CP155', 'CP182', 'CP199'].includes(e.code)) v.W.push(Object.assign({}, e, {m: 'Advertencia: ' + e.m + ' El PAC valida esta regla y puede rechazar el timbrado.', exc: true})); else keep.push(e); }); v.E.length = 0; keep.forEach(e => v.E.push(e)); }
  return v;
};
/* En modo manual de impuestos, ObjetoImp 06 y 08 admiten retención de ISR; 07 admite IEPS */
const _calcConceptoMat = calcConcepto;
calcConcepto = function (c, tipo) {
  if (c._tm && c.taxMan && ['06', '08'].includes(c.objeto) && tipo !== 'T') { const k = _calcConceptoMat(Object.assign({}, c, {objeto: '02', taxMan: {tras: [], ret: c.taxMan.ret.filter(t => t.imp === '001')}}), tipo); return k; }
  return _calcConceptoMat(c, tipo);
};

/* ---- Complemento de pagos 2.0: códigos de la matriz ---- */
const _validarPagoMat = validarPago;
validarPago = function (P) {
  return _validarPagoMat(P).map(m => /monto recibido/.test(m) ? 'CRP20218 · ' + m : /tipo de cambio/.test(m) ? 'CRP20214 · ' + m : /saldo|pagas/i.test(m) ? 'CRP20244 · ' + m : /mayor a cero/.test(m) ? 'CRP20241 · ' + m : m).concat(P.forma === '99' ? ['CRP20212 · La forma de pago de un complemento no puede ser 99: indica cómo te pagaron.'] : []);
};

/* ---- Plataformas tecnológicas: c_TipoDeServ 2026 y reglas SPT ---- */
XLC.TipoServ = PLATSAT.tipoServ.map(t => [t[0], t[1].replace(/\.$/, '')]); FULLCAT.TipoServ = XLC.TipoServ; XLC.SubTipoServ = PLATSAT.subTipo.map(s => [s[0], `${s[1]} (tipo ${s[2]})`]); XLC_TITLE.SubTipoServ = 'c_SubTipoServ'; FULLCAT.SubTipoServ = XLC.SubTipoServ;
Object.keys(SERV_TXT).forEach(k => delete SERV_TXT[k]);
Object.assign(SERV_TXT, {pasajeros: '01', transporte: '01', alimentos: '02', comida: '02', entrega: '03', hospedaje: '04', alojamiento: '04', comercio: '05', bienes: '05', enajenacion: '05', venta: '05', servicios: '06', otro: '06', digital: '07', descarga: '07', clubes: '08', citas: '08', ensenanza: '09', educacion: '09', apuestas: '11', juegos: '11', sorteos: '11'});
(function platLayout() {
  const s = LAYOUTS.plat.sections[0], t = s.fields.find(f => f.k === 'Tipo_De_Servicio');
  t.d = 'Clave c_TipoDeServ: 01 Transporte de pasajeros, 02 Entrega de alimentos, 03 Entrega de bienes, 04 Hospedaje, 05 Comercio de bienes, 06 Otros servicios, 07-09 servicios digitales, 11 Juegos y sorteos.';
  s.fields.find(f => f.k === 'Mes_Final').d = 'Debe ser igual al mes inicial (regla SPT105): una constancia por mes.';
  s.fields.push(Object.assign(fld('Sub_Tipo_Servicio', 0, 'Solo tipo 01 (01 Personal, 02 Compartido, 03 Plus, 04 Cancelación) o tipo 11 (08 Juegos con apuestas, 09 Sorteos).', ['subtipo', 'sub tipo servicio']), {cat: 'SubTipoServ'}));
})();
const PLAT_ISR_PF = Object.fromEntries(PLATSAT.tipoServ.map(t => [t[0], t[2] === '-' ? 0 : num(t[2])]));
const PLAT_IVA100 = new Set(PLATSAT.tipoServ.filter(t => /^100%/.test(t[3])).map(t => t[0]));
dryPLAT = function () {
  const em = EM(), docs = [], tol = num(S.mas.tol), emPF = rfcTipo(em.rfc) === 'F';
  (S.mas.rows.socios || []).forEach(r => {
    const errs = [], warns = []; candados('socios', r, errs, warns);
    const tiene = siNo(r.Tiene_RFC) || /^SI\b/i.test(String(r.Tiene_RFC || '')), rfc = String(r.RFC || '').trim().toUpperCase(), curp = String(r.CURP || '').trim().toUpperCase(), rt = rfcTipo(rfc);
    if (!String(r.Nombre || '').trim()) addErr(errs, 'Escribe el nombre.', 'socios', r, 'Nombre');
    if (tiene && (!rt || ['PG', 'EXT'].includes(rt))) addErr(errs, 'RFC inválido. Si el socio no dio RFC, pon Tiene_RFC = NO y su CURP.', 'socios', r, 'RFC', null, 'SPT103');
    if (!tiene && !CURP_RE.test(curp)) addErr(errs, 'Sin RFC necesitas una CURP válida de 18 caracteres.', 'socios', r, 'CURP');
    const cp = pad0(r.CP_Fiscal || (tiene ? '' : em.cp), 5); if (tiene && !/^\d{5}$/.test(cp)) addErr(errs, 'CP fiscal de 5 dígitos.', 'socios', r, 'CP_Fiscal');
    const mi = num(r.Mes_Inicial), mf = num(r.Mes_Final || r.Mes_Inicial), ej = num(r.Ejercicio);
    if (!(mi >= 1 && mi <= 12)) addErr(errs, 'Mes inicial de 1 a 12.', 'socios', r, 'Mes_Inicial');
    if (mf !== mi) addErr(errs, 'El mes final debe ser igual al mes inicial: la constancia de plataformas es mensual.', 'socios', r, 'Mes_Final', null, 'SPT105');
    if (!(ej >= 2019 && ej <= new Date().getFullYear())) addErr(errs, 'El ejercicio debe ser mayor a 2018 y no posterior al año en curso.', 'socios', r, 'Ejercicio', null, 'SPT106');
    let tk = parseClave(r.Tipo_De_Servicio); if (!/^\d{2}$/.test(tk)) { const h = normH(r.Tipo_De_Servicio), k = Object.keys(SERV_TXT).find(x => h.includes(x)); tk = k ? SERV_TXT[k] : ''; }
    if (!(tk in PLAT_ISR_PF)) addErr(errs, 'Tipo de servicio fuera de c_TipoDeServ (01 a 09 u 11).', 'socios', r, 'Tipo_De_Servicio', null, 'SPT136');
    const st = parseClave(r.Sub_Tipo_Servicio || ''); if (st && !PLATSAT.subTipo.some(s => s[0] === st && s[2] === tk)) addErr(errs, `El subtipo ${st} no corresponde al tipo de servicio ${tk} (c_SubTipoServ).`, 'socios', r, 'Sub_Tipo_Servicio', null, 'SPT138');
    const base = r2(num(r.Subtotal_Sin_IVA)); if (!(base > 0)) addErr(errs, 'El subtotal debe ser mayor a cero.', 'socios', r, 'Subtotal_Sin_IVA');
    let tIsr = !tiene ? 0.20 : ['07', '08', '09'].includes(tk) ? 0 : rt === 'M' ? 0.025 : (PLAT_ISR_PF[tk] || 0);
    if (emPF && tIsr) { tIsr = 0; warns.push({m: 'La plataforma (emisor) es persona física: no puede retener ISR (regla SPT111). Solo se retiene IVA.', cell: `socios|${r._i}|Tipo_De_Servicio`, code: 'SPT111', sev: 'warn'}); }
    const tIva = !tiene || PLAT_IVA100.has(tk) ? 0.16 : 0.08;
    if (tk === '11') warns.push({m: 'Juegos con apuestas y sorteos (tipo 11) también retienen el 100% del IEPS (regla SPT149); captúralo en la constancia antes de emitir.', cell: `socios|${r._i}|Tipo_De_Servicio`, code: 'SPT149', sev: 'warn'});
    const isr = Math.floor(base * tIsr * 100 + 1e-6) / 100, iva = Math.floor(base * tIva * 100 + 1e-6) / 100, tot = r2(isr + iva);
    if (String(r.Total_Retenido_Esperado || '').trim() !== '') { const diff = r2(tot - num(r.Total_Retenido_Esperado)); if (Math.abs(diff) > tol + 1e-9) addErr(errs, `La retención calculada (${money(tot)}) no cuadra con la esperada (${money(num(r.Total_Retenido_Esperado))}).`, 'socios', r, 'Total_Retenido_Esperado'); }
    const imps = []; if (isr > 0) imps.push({imp: '001', base: f2(base), monto: f2(isr), tipo: '05'}); imps.push({imp: '002', base: f2(r2(base * 0.16)), monto: f2(iva), tipo: '01'});
    const R = {cve: '26', desc: '', rfc: tiene ? rfc : 'XAXX010101000', curp: tiene ? '' : curp, nombre: String(r.Nombre || '').toUpperCase().trim(), cp, mesIni: pad(mi || 1), mesFin: pad(mi || 1), ejercicio: String(ej), montoOp: f2(base), montoExent: '0', imps, tipoServ: tk};
    docs.push({key: `${R.nombre || 'Fila ' + (r._i + 2)}`, rows: [{sec: 'socios', i: r._i}], ok: !errs.length, errs, warns, note: `Tipo ${tk} · ISR ${r2(tIsr * 1000) / 10}% ${money(isr)} · IVA ${tIva === 0.16 ? '100%' : '50%'} ${money(iva)} (truncado a 2 decimales)`, R, isr, iva, base, sinRfc: !tiene, resumen: `${tiene ? rfc : 'Sin RFC'} · ret. ${money(tot)}`});
  });
  const ok = docs.filter(d => d.ok);
  return {docs, poliza: [['Constancias a emitir', `${ok.length} de ${docs.length}`, true], ['Ingresos (base)', money(r2(ok.reduce((a, d) => a + d.base, 0)))], ['ISR retenido', money(r2(ok.reduce((a, d) => a + d.isr, 0)))], ['IVA retenido', money(r2(ok.reduce((a, d) => a + d.iva, 0)))], ['Sin RFC (ISR 20%, IVA 100%)', String(ok.filter(d => d.sinRfc).length)], ['Total retenido', money(r2(ok.reduce((a, d) => a + d.isr + d.iva, 0))), true]]};
};

/* ---- Traductor de errores del PAC con las matrices oficiales ---- */
PAC_FAM.unshift([/^CP\d{3}$/i, 'Complemento Carta Porte 3.1'], [/^SPT\d{3}$/i, 'Complemento Servicios de Plataformas Tecnológicas'], [/^CFDI1\d{5}$/i, 'Validación del comprobante CFDI 4.0 (Anexo 20)']);
const _traducirMat = traducir;
traducir = function (txt) {
  const t = _traducirMat(txt), m = String(txt).match(/\b(CFDI1?\d{5}|CRP\d{5}|CP\d{3}|SPT\d{3})\b/i);
  if (m) { const code = m[1].toUpperCase(); t.code = code; t.fam = (PAC_FAM.find(f => f[0].test(code)) || [])[1] || t.fam; t.mat = MATRIZ[code] || null; }
  return t;
};
const _traduccionHTMLMat = traduccionHTML;
traduccionHTML = function (t) {
  let h = _traduccionHTMLMat(t);
  if (t.mat) h = h.replace('<div class="trad">', `<div class="trad"><div class="matriz"><p class="eyebrow">Regla oficial · ${esc(t.mat[4])}</p><p><b>${esc(t.mat[0])}${t.mat[1] ? ' · ' + esc(t.mat[1]) : ''}</b></p><p class="small">${esc(t.mat[2])}</p><p class="small muted">Mensaje: ${esc(t.mat[3])}</p></div>`);
  else if (t.code && /^(CFDI|CRP|CP|SPT)/.test(t.code)) h = h.replace('<div class="trad">', `<div class="trad"><p class="muted small">El código ${esc(t.code)} no aparece en las matrices de errores cargadas (CFDI 4.0, Pagos 2.0, Carta Porte 3.1 y Plataformas).</p>`);
  return h;
};
/* Bitácora y panel de validación: la regla oficial al pasar el cursor por el código */
const _bitaHTMLMat = bitaHTML;
bitaHTML = function () { return _bitaHTMLMat().replace(/<span class="chip mono">([A-Z0-9_]+)<\/span>/g, (m, c) => MATRIZ[c] ? `<span class="chip mono" title="${esc(MATRIZ[c][3])}">${c}</span>` : m); };
