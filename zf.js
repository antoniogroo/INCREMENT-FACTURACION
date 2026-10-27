/* ============ FRICCIÓN CERO: calculadora inversa, grilla, atajos, traductor de errores, sustitución ============ */
const fmtVUs = v => { const n = num(v); let s = n.toFixed(6).replace(/0+$/, ''); if ((s.split('.')[1] || '').length < 2) s = n.toFixed(2); return s; };
function lineTotal(c, tipo) { const k = calcConcepto(c, tipo); return r2(k.base + k.tras.reduce((a, t) => a + t.importe, 0) - k.ret.reduce((a, t) => a + t.importe, 0)); }
/* Despeja el valor unitario (6 decimales) para que el neto del concepto cuadre al centavo */
function solveVU(c, tipo) {
  const target = r2(num(c.neto)), q = num(c.cantidad); if (!(target > 0) || !(q > 0)) return null;
  const conImp = ['02', '05'].includes(c.objeto), iva = conImp && c.iva !== 'Exento' && c.iva !== '' ? num(c.iva) : 0;
  let t = 0, cu = 0; if (conImp && c.iepsCat && c.iepsValor !== '') { if (c.iepsFactor === 'Cuota') cu = num(c.iepsValor); else t = num(c.iepsValor); }
  const ri = conImp ? num(c.retIsr) : 0, rv = conImp ? num(c.retIva) : 0, F = 1 + t + iva * (1 + t) - ri - rv;
  if (F <= 0) return null;
  const desc = num(c.descuento), b0 = (target - q * cu * (1 + iva)) / F;
  const tryVU = vu => ({vu, tot: lineTotal({...c, vu: String(vu)}, tipo)});
  let best = null;
  const consider = r => { const d = Math.abs(r.tot - target); if (!best || d < best.d - 1e-9) best = {...r, d}; return d < 0.005; };
  for (let k = 0; k <= 80; k++) for (const s of (k ? [k, -k] : [0])) { const b = r2(b0 + s * 0.01); if (b <= 0) continue; if (consider(tryVU(Math.round(((b + desc) / q) * 1e6) / 1e6))) return {vu: best.vu, tot: best.tot, diff: 0}; }
  for (let j = 1; j <= 400 && best; j++) for (const s of [j, -j]) { const vu = Math.round((best.vu + s * 1e-6) * 1e6) / 1e6; if (vu > 0 && consider(tryVU(vu))) return {vu: best.vu, tot: best.tot, diff: 0}; }
  return best ? {vu: best.vu, tot: best.tot, diff: r2(best.tot - target)} : null;
}
function resolveNetos(d) { if (!d || !d.netoMode || d.tipo === 'T') return; d.conceptos.forEach(c => { if (num(c.neto) > 0) { const r = solveVU(c, d.tipo); if (r) { c.vu = fmtVUs(r.vu); c._netoDiff = r.diff; } } }); }

/* Grilla de conceptos tipo hoja de cálculo */
const OBJ_S = [['01', '01 No objeto'], ['02', '02 Sí objeto'], ['03', '03 Sin desglose'], ['04', '04 No causa'], ['05', '05 PODEBI']];
const RISR_S = [['', '—'], ['0.100000', '10%'], ['0.012500', '1.25%']];
const RIVA_S = [['', '—'], ['0.106667', '10.6667%'], ['0.040000', '4%'], ['0.060000', '6%'], ['0.160000', '16%']];
function gin(path, v, i, col, extra = '') { return `<input id="b_${path.replace(/\./g, '_')}" data-b="${path}" data-gi="${i}" data-gc="${col}" value="${esc(v ?? '')}" ${extra}>`; }
function gsel(path, list, v, i, col, extra = '') { return `<select id="b_${path.replace(/\./g, '_')}" data-b="${path}" data-gi="${i}" data-gc="${col}" ${extra}>${opts(list, v ?? '', false)}</select>`; }
function catalogHits(q, n = 40) {
  q = String(q || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const prods = S.productos.map(p => [p.clave, p.descripcion]);
  const all = prods.concat(PRODSERV, S.catImport);
  if (!q) return all.slice(0, n);
  const ws = q.split(/\s+/), out = [], seen = new Set();
  for (const p of all) { if (out.length >= n) break; const t = (p[0] + ' ' + p[1]).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); if (ws.every(w => t.includes(w)) && !seen.has(p[0] + p[1])) { seen.add(p[0] + p[1]); out.push(p); } }
  return out;
}
const dlOptions = q => catalogHits(q).map(p => `<option value="${p[0]}">${esc(p[1])}</option>`).join('');
function conceptGrid(d) {
  const isT = d.tipo === 'T', neto = !!d.netoMode && !isT;
  const head = ['#', 'Clave SAT', 'Descripción', 'Cant.', 'Unidad'].concat(isT ? [] : ['V. unitario'].concat(neto ? ['Neto a recibir'] : []).concat(['Desc.', 'Objeto', 'IVA', 'Ret. ISR', 'Ret. IVA', 'Importe'])).concat(['', '']);
  const rows = d.conceptos.map((c, i) => {
    const p = `conceptos.${i}`, conImp = ['02', '05'].includes(c.objeto);
    let tr = `<tr><td class="gnum">${i + 1}</td><td>${gin(p + '.clave', c.clave, i, 'clave', 'class="mono" list="dlps" maxlength="60" autocomplete="off" placeholder="Clave o palabra"')}</td><td class="gdesc">${gin(p + '.descripcion', c.descripcion, i, 'descripcion')}</td><td>${gin(p + '.cantidad', c.cantidad, i, 'cantidad', 'class="mono r" inputmode="decimal"')}</td><td>${gsel(p + '.unidad', (CAT.unidad.some(u => u[0] === c.unidad) || !c.unidad ? CAT.unidad : [[c.unidad, UNIDAD_MAP.get(c.unidad) || 'Clave no encontrada en c_ClaveUnidad']].concat(CAT.unidad)).map(u => [u[0], u[0] + ' ' + u[1]]), c.unidad, i, 'unidad', 'data-combo="unidadAll"')}</td>`;
    if (!isT) {
      tr += `<td>${gin(p + '.vu', c.vu, i, 'vu', 'class="mono r" inputmode="decimal"')}</td>`;
      if (neto) tr += `<td class="gneto"><input id="nt_${i}" data-neto="${i}" data-gi="${i}" data-gc="neto" class="mono r" inputmode="decimal" value="${esc(c.neto || '')}" placeholder="0.00"><small id="nts_${i}" class="${c._netoDiff ? 'bad' : 'ok'}">${num(c.neto) > 0 ? (c._netoDiff ? 'Dif. ' + money(c._netoDiff) : 'Cuadra') : ''}</small></td>`;
      tr += `<td>${gin(p + '.descuento', c.descuento, i, 'descuento', 'class="mono r" inputmode="decimal" placeholder="0"')}</td><td>${gsel(p + '.objeto', OBJ_S, c.objeto, i, 'objeto', 'data-r="1"')}</td>`;
      tr += conImp ? `<td>${gsel(p + '.iva', IVA_O, c.iva, i, 'iva')}</td><td>${gsel(p + '.retIsr', RISR_S, c.retIsr, i, 'retIsr')}</td><td>${gsel(p + '.retIva', RIVA_S, c.retIva, i, 'retIva')}</td>` : '<td class="muted small" colspan="3">Sin impuestos</td>';
      tr += `<td class="n mono" id="lt_${i}"></td>`;
    }
    tr += `<td><button class="x sm" data-a="moreRow" data-i="${i}" title="IEPS y número de identificación" aria-label="Más campos del concepto ${i + 1}">⋯</button></td><td>${d.conceptos.length > 1 ? `<button class="x" data-a="delConcepto" data-i="${i}" aria-label="Quitar concepto ${i + 1}">×</button>` : ''}</td></tr>`;
    if (c._more) tr += `<tr class="gmore"><td></td><td colspan="${head.length - 1}"><div class="row wrap">
      ${F('No. identificación (SKU)', inp(p + '.noIdent', c.noIdent, 'placeholder="opcional"'))}
      ${!isT && conImp ? F('IEPS 2026', `<select data-a2="ieps" data-i="${i}" id="b_${p.replace(/\./g, '_')}_ieps">${IEPS26.map(x => `<option value="${x[0]}"${x[0] === c.iepsCat ? ' selected' : ''}>${esc(x[1])}${x[3] ? ` (${x[2] === 'Cuota' ? '$' + x[3] + '/u' : r2(num(x[3]) * 100) + '%'})` : ''}</option>`).join('')}</select>`) + (c.iepsCat ? F(c.iepsFactor === 'Cuota' ? 'Cuota por unidad' : 'Tasa IEPS', inp(p + '.iepsValor', c.iepsValor, 'class="mono" inputmode="decimal"')) : '') : ''}
      <button class="btn ghost sm" data-a="pickCat" data-i="${i}">Buscar en catálogo</button></div></td></tr>`;
    return tr;
  }).join('');
  return `<div class="gtools"><div class="row wrap">
    ${!isT ? `<label class="switch"><input type="checkbox" data-a2="netoMode" ${neto ? 'checked' : ''}> Calcular desde neto</label>` : ''}
    <button class="btn ghost sm" data-a="addConcepto">Agregar fila <kbd>Alt</kbd><kbd>N</kbd></button>
    ${S.productos.length ? `<select id="prodpick" data-a2="addProducto" class="sm">${opts(S.productos.map(p => [p.id, `${p.descripcion} · ${money(num(p.precio))}`]), '', false, 'Agregar desde mis productos…')}</select>` : ''}
    ${d.cp && d.tipo === 'I' ? '<button class="btn ghost sm" data-a="addFlete">Agregar flete</button>' : ''}</div>
    ${neto ? `<p class="note">Escribe en <b>Neto a recibir</b> lo que efectivamente te depositan. El sistema despeja el valor unitario (6 decimales) con el IVA y las retenciones de cada fila para que el total cuadre al centavo.</p>` : ''}</div>
  <div class="tw gridwrap"><table class="cgrid"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>
  <datalist id="dlps">${dlOptions('')}</datalist>
  <p class="kbar"><span><kbd>Enter</kbd> fila siguiente</span><span><kbd>↑</kbd><kbd>↓</kbd> moverse</span><span><kbd>Alt</kbd><kbd>N</kbd> nueva fila</span><span><kbd>Ctrl</kbd><kbd>K</kbd> cliente o emisor</span><span><kbd>Ctrl</kbd><kbd>/</kbd> buscar clave</span><span><kbd>Ctrl</kbd><kbd>Enter</kbd> revisar y timbrar</span></p>`;
}
function focusGrid(i, col) { const el = $(`[data-gi="${i}"][data-gc="${col}"]`); if (el) { el.focus(); if (el.select && el.tagName === 'INPUT') el.select(); return true; } return false; }

/* Paleta de comandos (Ctrl+K) */
function paletteItems() {
  const it = [];
  S.clientes.forEach(c => it.push({g: 'Cliente', t: `${c.rfc} · ${c.nombre}`, run: () => { if (!['factura', 'cartaporte'].includes(S.view)) go('factura'); A2.pickCliente({value: c.id}); toast('Receptor: ' + c.nombre); }}));
  S.emisores.forEach(e => it.push({g: 'Emisor', t: `${e.rfc} · ${e.nombre}`, run: () => A2.switchEm({value: e.id})}));
  S.productos.forEach(p => it.push({g: 'Producto', t: `${p.clave} · ${p.descripcion}`, run: () => { if (!['factura', 'cartaporte'].includes(S.view)) go('factura'); A2.addProducto({value: p.id}); }}));
  [['Nueva factura PUE', () => go('factura')], ['Nueva factura PPD (a crédito)', () => { go('factura'); S.draft.metodoPago = 'PPD'; S.draft.formaPago = '99'; render(); }], ['Nueva Carta Porte', () => go('cartaporte')], ['Registrar un pago', () => go('pagos')], ['Constancia de retenciones', () => go('retenciones')], ['Carga masiva desde Excel', () => { S.mas.tab = 'carga'; go('masiva'); }], ['Importar XML de facturas PPD', () => { S.mas.tab = 'xml'; go('masiva'); }], ['Traducir un error del PAC', () => openTraductor('')]].forEach(([t, run]) => it.push({g: 'Acción', t, run}));
  NAV.forEach(([k, t]) => it.push({g: 'Ir a', t, run: () => go(k)}));
  return it;
}
function openPalette() {
  if (!S.acct) return;
  const items = paletteItems(); let idx = 0, list = items;
  const m2 = $('#modal2'); m2.hidden = false;
  m2.innerHTML = `<div class="sheet palette" role="dialog" aria-modal="true" aria-label="Paleta de comandos"><input id="palq" placeholder="Busca un cliente, emisor, producto o acción…" autocomplete="off"><div id="palres" class="palres" role="listbox"></div><p class="muted small"><kbd>↑</kbd><kbd>↓</kbd> elegir · <kbd>Enter</kbd> aplicar · <kbd>Esc</kbd> cerrar</p></div>`;
  const draw = () => { const q = $('#palq').value.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); list = items.filter(i => (i.g + ' ' + i.t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q)).slice(0, 40); idx = Math.min(idx, Math.max(0, list.length - 1)); $('#palres').innerHTML = list.map((i, k) => `<button type="button" class="palrow${k === idx ? ' on' : ''}" data-k="${k}" role="option"><span class="chip">${esc(i.g)}</span><span>${esc(i.t)}</span></button>`).join('') || '<p class="muted">Sin coincidencias.</p>'; };
  const run = k => { const i = list[k]; if (!i) return; close2(); i.run(); };
  $('#palq').addEventListener('input', () => { idx = 0; draw(); });
  $('#palq').addEventListener('keydown', e => { if (e.key === 'ArrowDown') { idx = Math.min(list.length - 1, idx + 1); draw(); e.preventDefault(); } else if (e.key === 'ArrowUp') { idx = Math.max(0, idx - 1); draw(); e.preventDefault(); } else if (e.key === 'Enter') { e.preventDefault(); run(idx); } });
  $('#palres').addEventListener('click', e => { const b = e.target.closest('.palrow'); if (b) run(+b.dataset.k); });
  draw(); $('#palq').focus();
}

/* Traductor de errores del PAC a lenguaje contable */
const FIXES = {
  regimenRec: {l: 'Elegir el régimen correcto', focus: 'b_receptor_regimen'},
  usoRec: {l: 'Ajustar el uso del CFDI', run: d => { const g = d.receptor.regimen === '616' ? 'S01' : 'G03'; const u = CAT.uso.find(x => x[0] === g && x[2].includes(d.receptor.regimen)) || CAT.uso.find(x => x[2].includes(d.receptor.regimen) && !['CP01', 'CN01'].includes(x[0])); if (u) d.receptor.uso = u[0]; }},
  usoS01: {l: 'Usar S01', run: d => { d.receptor.uso = 'S01'; }},
  forma99: {l: 'Poner forma de pago 99', run: d => { d.formaPago = '99'; }},
  formaReal: {l: 'Cambiar a transferencia (03)', run: d => { d.formaPago = '03'; }},
  egresoPUE: {l: 'Cambiar a PUE', run: d => { d.metodoPago = 'PUE'; if (d.formaPago === '99') d.formaPago = '03'; }},
  quitarSoc: {l: 'Quitar el régimen societario', run: d => { d.receptor.nombre = d.receptor.nombre.replace(SOCIETARIO, '').replace(/[,\s]+$/, '').trim(); }},
  pgDatos: {l: 'Llenar datos de público en general', run: d => { Object.assign(d.receptor, {regimen: '616', uso: 'S01', cp: d.lugarExp}); if (d.global.on) d.receptor.nombre = 'PUBLICO EN GENERAL'; }},
  cpExp: {l: 'Usar el CP de expedición', run: d => { d.receptor.cp = d.lugarExp; }},
  sinIva8: {l: 'Cambiar IVA 8% a 16%', run: d => { d.conceptos.forEach(c => { if (c.iva === '0.080000') c.iva = '0.160000'; }); if (d.preset === 'frontera') d.preset = 'normal'; }},
  quitarRetIsr: {l: 'Quitar la retención de ISR', run: d => { d.conceptos.forEach(c => { c.retIsr = ''; }); }},
  objeto02: {l: 'Aplicar IVA 16%', run: d => { d.conceptos.forEach(c => { if (c.objeto === '02' && !c.iva && !num(c.retIsr) && !num(c.retIva)) c.iva = '0.160000'; }); }},
  globalClave: {l: 'Usar 01010101 y ACT', run: d => { d.conceptos.forEach(c => { c.clave = '01010101'; c.unidad = 'ACT'; }); }},
  relSust: {l: 'Relacionar con tipo 04', run: d => { const o = S.cfdis.find(x => x.id === d.sustituye); if (o) d.relacion = {tipo: '04', uuids: o.uuid}; }},
  f_rfc: {l: 'Corregir RFC', focus: 'b_receptor_rfc'}, f_nombre: {l: 'Corregir nombre', focus: 'b_receptor_nombre'}, f_cp: {l: 'Corregir CP', focus: 'b_receptor_cp'},
  f_tc: {l: 'Capturar tipo de cambio', focus: 'b_tipoCambio'}, f_rel: {l: 'Capturar UUID relacionado', focus: 'b_relacion_uuids'}, f_lugar: {l: 'Corregir lugar de expedición', focus: 'b_lugarExp'},
  f_metodo: {l: 'Revisar método de pago', focus: 'b_metodoPago'}, f_res: {l: 'Capturar residencia', focus: 'b_receptor_residencia'}
};
const PAC_KNOWN = {
  '301': 'XML mal formado: el archivo no cumple con el esquema (XSD) del SAT. Suele deberse a un atributo vacío, con espacios de más o con un valor fuera de catálogo.',
  '302': 'Sello mal formado o inválido: el XML se modificó después de sellarlo o la cadena original no coincide.',
  '303': 'El sello no corresponde al emisor: el CSD con el que se selló no pertenece al RFC emisor.',
  '304': 'Tu certificado de sello digital (CSD) está revocado o caduco.',
  '305': 'La fecha de emisión no está dentro de la vigencia de tu CSD.',
  '306': 'Se usó la e.firma en lugar del certificado de sello digital (CSD).',
  '307': 'El comprobante ya tiene un timbre fiscal: no se puede timbrar dos veces.',
  '308': 'El certificado no fue emitido por el SAT.',
  '401': 'La fecha de emisión está fuera de rango: el CFDI debe timbrarse dentro de las 72 horas siguientes a su generación.',
  '402': 'El RFC del emisor no está en la lista de contribuyentes con obligaciones (LCO) del SAT.',
  'CFDI40158': 'El régimen fiscal del receptor no corresponde a su tipo de persona (física o moral).'
};
const PAC_FAM = [[/^CFDI40/i, 'Validación del comprobante CFDI 4.0 (Anexo 20)'], [/^CRP20/i, 'Complemento para recepción de pagos 2.0'], [/^CCP/i, 'Complemento Carta Porte'], [/^(CRT|RET)/i, 'CFDI de retenciones e información de pagos'], [/^30\d$/, 'Sello o certificado del emisor'], [/^40\d$/, 'Fecha o RFC del emisor al timbrar']];
const PAC_KEYS = [
  [/ImpSaldoInsoluto|ImpSaldoAnt|ImpPagado/i, 'Saldos del complemento de pago', 'Los saldos no cuadran: el saldo insoluto debe ser el saldo anterior menos lo pagado, sin negativos, y el saldo anterior debe ser el insoluto del pago previo. Pasa al registrar dos veces un pago o al pagar más que el saldo.', null],
  [/NumParcialidad/i, 'Número de parcialidad', 'La parcialidad no sigue la secuencia: debe ser 1 en el primer pago y aumentar de uno en uno.', null],
  [/IdDocumento/i, 'Factura relacionada en el pago', 'El UUID de la factura PPD no existe, está cancelado o no es de tu RFC. Revisa que la factura sea PPD y esté vigente.', null],
  [/FechaPago/i, 'Fecha de pago', 'La fecha del pago no es válida: no puede ser futura y debe tener formato de fecha y hora.', null],
  [/MonedaP|EquivalenciaDR|TipoCambioP/i, 'Moneda del pago', 'La moneda o la equivalencia del pago no coincide con la de la factura. Si pagan en otra moneda, captura el tipo de cambio del día del pago.', null],
  [/RegimenFiscal(Receptor|R)?\b/i, 'Régimen fiscal del receptor', 'El régimen no es el que el SAT tiene registrado para tu cliente o no corresponde a su tipo de persona. Copia el régimen exacto de su Constancia de Situación Fiscal.', 'regimenRec'],
  [/UsoCFDI/i, 'Uso del CFDI', 'El uso del CFDI no es válido para el régimen del receptor (por ejemplo, un D01 a una persona moral). Elige un uso permitido para ese régimen.', 'usoRec'],
  [/DomicilioFiscalReceptor|CodigoPostal/i, 'Código postal del receptor', 'El código postal no coincide con el domicilio fiscal registrado en el SAT para ese RFC. Pide la Constancia de Situación Fiscal vigente.', 'f_cp'],
  [/Nombre/i, 'Nombre del receptor', 'El nombre no coincide con el registrado en el SAT para ese RFC. En CFDI 4.0 se escribe exactamente como en la constancia, en mayúsculas y sin “S.A. de C.V.”.', 'quitarSoc'],
  [/\bRfc\b|LRFC|lista de RFC|no se encuentra en la lista/i, 'RFC', 'El RFC no está en la lista de RFC inscritos no cancelados del SAT o tiene un error de captura.', 'f_rfc'],
  [/FormaPago/i, 'Forma de pago', 'La forma de pago no es congruente con el método: PPD siempre lleva 99; PUE lleva la forma real (03 transferencia, 01 efectivo…).', 'forma99'],
  [/MetodoPago/i, 'Método de pago', 'El método de pago no corresponde: PUE si ya te pagaron completo, PPD si es a crédito o en parcialidades. Un egreso va con PUE.', 'f_metodo'],
  [/TipoCambio/i, 'Tipo de cambio', 'Falta el tipo de cambio o está fuera del rango permitido respecto al publicado por Banxico.', 'f_tc'],
  [/LugarExpedicion/i, 'Lugar de expedición', 'El código postal de expedición no existe en el catálogo del SAT.', 'f_lugar'],
  [/TasaOCuota|TipoFactor|\bBase\b|Impuesto/i, 'Impuestos', 'Algún impuesto tiene una tasa fuera de catálogo o la base no corresponde al importe menos descuento. Revisa IVA, IEPS y retenciones del concepto.', null],
  [/ClaveProdServ/i, 'Clave de producto o servicio', 'La clave no existe en el catálogo vigente o no puede usarse en este tipo de comprobante.', null],
  [/ClaveUnidad/i, 'Clave de unidad', 'La clave de unidad no existe en el catálogo c_ClaveUnidad.', null],
  [/ObjetoImp/i, 'Objeto de impuesto', 'Con objeto 02 debes desglosar impuestos; con 01 no se desglosa ninguno.', 'objeto02'],
  [/SubTotal|Total|Importe/i, 'Totales', 'Los importes no cuadran por redondeo: el total debe ser subtotal − descuento + trasladados − retenidos, con los decimales de la moneda.', null],
  [/CfdiRelacionado|TipoRelacion|UUID/i, 'CFDI relacionado', 'El UUID relacionado no existe, está cancelado o no corresponde a tu RFC, o el tipo de relación no aplica.', 'f_rel'],
  [/Sello|Certificado|CSD/i, 'Sello y certificado', 'Hay un problema con tu CSD: vencido, revocado, de otro RFC o el XML se alteró después de sellar.', null],
  [/\bFecha\b/i, 'Fecha de emisión', 'La fecha de emisión tiene más de 72 horas o está en el futuro. Vuelve a generar el comprobante.', null],
  [/Exportacion/i, 'Exportación', 'Con clave 02 de exportación se requiere el complemento de comercio exterior.', null],
  [/IdCCP|CartaPorte|DistanciaRecorrida|PesoBruto|PesoEnKg|PlacaVM|NumLicencia|PermSCT/i, 'Carta Porte', 'Un dato de la Carta Porte no es válido: revisa IdCCP, distancias, pesos, placa (sin guiones), permiso SCT y licencia del operador.', null]
];
function traducir(txt) {
  const code = ((String(txt).match(/\b(CFDI\d{5}|CRP\d{5}|CCP\d{3,5}|CRT\d{3,5}|RET\d{3,5}|30[1-8]|40[1-2])\b/i) || [])[1] || '').toUpperCase();
  const fam = code ? (PAC_FAM.find(f => f[0].test(code)) || [])[1] : '';
  const hits = PAC_KEYS.filter(k => k[0].test(txt)).slice(0, 3);
  return {code, fam, known: PAC_KNOWN[code] || '', hits};
}
const PAC_EJEMPLOS = ['CFDI40158 - La clave del campo RegimenFiscalR debe corresponder con el tipo de persona (física o moral).', 'CRP20265 - El valor del atributo ImpSaldoInsoluto no corresponde a ImpSaldoAnt menos ImpPagado.', '401 - Fecha y hora de generación fuera de rango', 'El campo DomicilioFiscalReceptor del receptor debe pertenecer al nombre asociado al RFC registrado en el campo Rfc del Receptor.'];
function traduccionHTML(t) {
  const editing = ['factura', 'cartaporte'].includes(S.view) && S.draft;
  if (!t.code && !t.hits.length) return '<p class="muted">No reconocimos el mensaje. Pega el texto completo que te dio tu PAC (incluye el código y la descripción).</p>';
  return `<div class="trad">${t.code ? `<p><span class="chip mono">${esc(t.code)}</span> ${esc(t.fam || '')}</p>` : ''}${t.known ? `<p class="lead">${esc(t.known)}</p>` : ''}
  ${t.hits.map(h => `<div class="alert ${h[3] ? 'warn' : 'info'}"><span><b>${esc(h[1])}.</b> ${esc(h[2])}</span>${h[3] && editing ? `<button class="btn sm" data-a="fix" data-f="${h[3]}">${esc(FIXES[h[3]].l)}</button>` : ''}</div>`).join('')}
  ${!editing && t.hits.some(h => h[3]) ? '<p class="muted small">Abre la factura en el editor (por ejemplo con “Corregir y sustituir”) para aplicar la corrección con un clic.</p>' : ''}
  <p class="muted small">Explicación generada a partir del texto del error. Los códigos y su redacción pueden variar entre proveedores de certificación.</p></div>`;
}
function openTraductor(txt) {
  openModal(`<header class="mh"><div><p class="eyebrow">Traductor de errores del PAC</p><h3>¿Qué significa este rechazo?</h3></div><button class="x" data-a="close" aria-label="Cerrar">×</button></header>
  <div class="fld"><label for="tradq">Pega el mensaje de error de tu proveedor de certificación</label><textarea id="tradq" rows="3">${esc(txt || '')}</textarea></div>
  <div class="row wrap">${PAC_EJEMPLOS.map((e, i) => `<button class="btn ghost sm" data-a="tradEj" data-i="${i}">Ejemplo ${i + 1}</button>`).join('')}</div>
  <div id="tradres">${txt ? traduccionHTML(traducir(txt)) : ''}</div>`, true);
  $('#tradq').addEventListener('input', e => { $('#tradres').innerHTML = e.target.value.trim() ? traduccionHTML(traducir(e.target.value)) : ''; });
}

/* Sustitución motivo 01 en un clic */
function draftFromRec(c) {
  if (c.draft) { const d = clone(c.draft); const em = EM(); d.folio = String((em.folios || {})[d.tipo] || 1); d.serie = (em.series || {})[d.tipo] || d.serie; if (d.cp) d.cp.idccp = idCCP(); d.conceptos.forEach(k => { delete k._more; }); return d; }
  return null;
}
function bloqueoCancelacion(c) {
  const em = EM(), lim = plazoCancelacion(c, em);
  if (new Date() > lim) return `El plazo para cancelar este CFDI venció el ${fmtDate(lim)}.`;
  if ((c.pagos || []).some(p => { const pc = S.cfdis.find(x => x.uuid === p.uuid); return pc && pc.estado !== 'Cancelado'; })) return 'Esta factura tiene complementos de pago vigentes. Cancela primero esos complementos.';
  return '';
}
