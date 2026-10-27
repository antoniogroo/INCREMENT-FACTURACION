/* ============ CONFIGURACIÓN Y DESGLOSE DE IMPUESTOS (sugerido vs. manual) Y EMISIÓN ESPECIAL ============ */
const IMP_TXT = {'001': 'ISR', '002': 'IVA', '003': 'IEPS'};
const LOCAL_PRESETS = [
  {tipo: 'Retenido', nombre: '5 al millar (inspección y vigilancia de obra pública)', pct: '0.50'},
  {tipo: 'Trasladado', nombre: 'ISH (Impuesto sobre hospedaje)', pct: '3.00'},
  {tipo: 'Retenido', nombre: '2 al millar (ICIC)', pct: '0.20'}
];
const isSet = v => v !== '' && v !== null && v !== undefined;
const pctTxt = dec => { const v = r2(num(dec) * 100 * 10000) / 10000; return String(v); };

/* Pasa la sugerencia actual de un concepto al formato editable */
function taxManDesde(c) {
  const T = {tras: [], ret: []};
  if (c.iepsCat && c.iepsFactor && isSet(c.iepsValor)) T.tras.push({imp: '003', factor: c.iepsFactor, valor: c.iepsFactor === 'Cuota' ? String(c.iepsValor) : pctTxt(c.iepsValor), base: '', importe: ''});
  if (c.iva === 'Exento') T.tras.push({imp: '002', factor: 'Exento', valor: '', base: '', importe: ''});
  else if (isSet(c.iva)) T.tras.push({imp: '002', factor: 'Tasa', valor: pctTxt(c.iva), base: '', importe: ''});
  if (num(c.retIsr) > 0) T.ret.push({imp: '001', factor: 'Tasa', valor: pctTxt(c.retIsr), base: '', importe: '', on: true});
  if (num(c.retIva) > 0) T.ret.push({imp: '002', factor: 'Tasa', valor: pctTxt(c.retIva), base: '', importe: '', on: true});
  return T;
}

/* ---- Motor: impuestos manuales por concepto ---- */
const _calcConceptoTax = calcConcepto;
calcConcepto = function (c, tipo) {
  if (!c._tm || !c.taxMan || tipo === 'T') return _calcConceptoTax(c, tipo);
  const k = _calcConceptoTax(Object.assign({}, c, {iva: '', retIsr: '', retIva: '', iepsCat: '', iepsFactor: '', iepsValor: ''}), tipo);
  k.tras = []; k.ret = []; if (!['02', '05', '07'].includes(c.objeto)) return k;
  const cant = num(c.cantidad); let ieps = 0;
  const ord = c.taxMan.tras.map((t, j) => [t, j]).sort((a, b) => (a[0].imp === '003' ? 0 : 1) - (b[0].imp === '003' ? 0 : 1));
  ord.forEach(([t, j]) => {
    const dec = t.factor === 'Tasa' ? num(t.valor) / 100 : num(t.valor);
    const bCalc = t.factor === 'Cuota' ? cant : (t.imp === '002' ? r2(k.base + ieps) : k.base), b = isSet(t.base) ? r2(num(t.base)) : bCalc;
    const iCalc = t.factor === 'Exento' ? 0 : r2(b * dec), imp = t.factor === 'Exento' ? 0 : isSet(t.importe) ? r2(num(t.importe)) : iCalc;
    if (t.imp === '003') ieps += imp;
    k.tras.push({imp: t.imp, base: b, factor: t.factor, tasa: t.factor === 'Exento' ? '' : f6(dec), importe: imp, man: true, j, bCalc, iCalc});
  });
  c.taxMan.ret.forEach((t, j) => {
    if (t.on === false) return;
    const dec = t.factor === 'Cuota' ? num(t.valor) : num(t.valor) / 100, bCalc = t.factor === 'Cuota' ? cant : k.base, b = isSet(t.base) ? r2(num(t.base)) : bCalc;
    const iCalc = r2(b * dec), imp = isSet(t.importe) ? r2(num(t.importe)) : iCalc;
    k.ret.push({imp: t.imp, base: b, factor: t.factor || 'Tasa', tasa: f6(dec), importe: imp, man: true, j, bCalc, iCalc});
  });
  return k;
};
/* Impuestos locales (complemento implocal 1.0) y marca de modo manual */
const _calcDocTax = calcDoc;
calcDoc = function (d) {
  const man = d.taxMode === 'manual'; (d.conceptos || []).forEach(c => { c._tm = man; });
  const k = _calcDocTax(d); const L = (d.locales || []).filter(l => l && (num(l.pct) > 0 || isSet(l.importe)));
  if (!L.length || d.tipo === 'T' || d.tipo === 'P') return k;
  const baseDef = r2(k.sub - k.des); k.loc = {tras: [], ret: [], totTras: 0, totRet: 0};
  L.forEach(l => { const b = isSet(l.base) ? r2(num(l.base)) : baseDef, iCalc = r2(b * num(l.pct) / 100), imp = isSet(l.importe) ? r2(num(l.importe)) : iCalc; const o = {nombre: l.nombre || 'Impuesto local', pct: num(l.pct), base: b, importe: imp, iCalc}; if (l.tipo === 'Retenido') k.loc.ret.push(o); else k.loc.tras.push(o); });
  k.loc.totTras = r2(k.loc.tras.reduce((a, x) => a + x.importe, 0)); k.loc.totRet = r2(k.loc.ret.reduce((a, x) => a + x.importe, 0));
  k.total = r2(k.total + k.loc.totTras - k.loc.totRet);
  return k;
};
const _xmlCFDITax = xmlCFDI;
xmlCFDI = function (d, em, k, extra = {}) {
  let x = _xmlCFDITax(d, em, k, extra);
  if (!k || !k.loc || !(k.loc.tras.length || k.loc.ret.length)) return x;
  x = x.replace('xmlns:cfdi="http://www.sat.gob.mx/cfd/4"', 'xmlns:cfdi="http://www.sat.gob.mx/cfd/4" xmlns:implocal="http://www.sat.gob.mx/implocal"')
    .replace('http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd', 'http://www.sat.gob.mx/sitio_internet/cfd/4/cfdv40.xsd http://www.sat.gob.mx/implocal http://www.sat.gob.mx/sitio_internet/cfd/implocal/implocal.xsd');
  const il = `    <implocal:ImpuestosLocales version="1.0" TotaldeRetenciones="${f2(k.loc.totRet)}" TotaldeTraslados="${f2(k.loc.totTras)}">\n` +
    k.loc.ret.map(r => `      <implocal:RetencionesLocales ImpLocRetenido="${xa(r.nombre)}" TasadeRetencion="${r.pct.toFixed(2)}" Importe="${f2(r.importe)}"/>\n`).join('') +
    k.loc.tras.map(t => `      <implocal:TrasladosLocales ImpLocTrasladado="${xa(t.nombre)}" TasadeTraslado="${t.pct.toFixed(2)}" Importe="${f2(t.importe)}"/>\n`).join('') + '    </implocal:ImpuestosLocales>';
  return x.includes('<cfdi:Complemento>') ? x.replace('<cfdi:Complemento>\n', `<cfdi:Complemento>\n${il}\n`) : x.replace('</cfdi:Comprobante>', `  <cfdi:Complemento>\n${il}\n  </cfdi:Complemento>\n</cfdi:Comprobante>`);
};

/* ---- Excepciones: diferencias contra la sugerencia y reglas relajadas en emisión especial ---- */
const PAC_RULE = new Set(['CFDI40158', 'USO_REGIMEN_REC', 'FORMA_PPD', 'FORMA_PUE']);
function esRelajable(e) {
  if (['CFDI40158', 'CFDI40161', 'CFDI40159', 'CFDI40149', 'CFDI40105', 'FOLIO_INTERNO_DUPLICADO', 'CP143', 'CP144', 'CP145', 'CP146', 'CP147', 'CP107', 'CP109', 'CP184', 'CP155'].includes(e.code)) return true;
  if (['regimenRec', 'usoRec', 'pgDatos', 'cpExp', 'forma99', 'formaReal', 'egresoPUE', 'usoS01', 'relSust', 'objeto02', 'sinIva8', 'quitarRetIsr', 'globalClave'].includes(e.fix) && !['CfdiRelacionado', 'TipoRelacion'].includes(e.attr)) return true;
  if (e.fix === 'f_rel' && e.attr === 'CfdiRelacionados') return true;
  return /01010101|objeto de impuesto debe ser 01|exportación definitiva|factura global solo se emite/.test(e.m);
}
function difImpuestos(d) {
  const out = []; if (d.taxMode !== 'manual' || d.tipo === 'T') return out;
  const fmtT = t => t ? (t.factor === 'Exento' ? 'exento' : t.factor === 'Cuota' ? `cuota $${num(t.tasa)}` : `${r2(num(t.tasa) * 100 * 10000) / 10000}%`) : 'sin impuesto';
  d.conceptos.forEach((c, i) => {
    const n = `Concepto ${i + 1}`;
    const sug = _calcConceptoTax(Object.assign({}, c, {_tm: false}), d.tipo), man = calcConcepto(Object.assign({}, c, {_tm: true}), d.tipo);
    const pr = PRESETS[d.preset] || PRESETS.normal;
    if (c.objeto !== pr.obj && c.taxMan) out.push(`${n}: ObjetoImp ${c.objeto} distinto al sugerido (${pr.obj}).`);
    [['tras', '002', 'el IVA trasladado'], ['tras', '003', 'el IEPS'], ['ret', '001', 'la retención de ISR'], ['ret', '002', 'la retención de IVA']].forEach(([g, imp, txt]) => {
      const a = sug[g].find(t => t.imp === imp), b = man[g].find(t => t.imp === imp);
      if (!a && !b) return; if (a && b && a.factor === b.factor && a.tasa === b.tasa) return;
      out.push(`Se modificó manualmente ${txt} respecto a la sugerencia del régimen en ${n} (sugerido: ${fmtT(a)}; configurado: ${b ? fmtT(b) : g === 'ret' ? 'desactivada' : 'sin impuesto'}).`);
    });
    man.tras.concat(man.ret).forEach(t => {
      const g = man.ret.includes(t) ? 'retención' : 'traslado';
      if (Math.abs(t.base - t.bCalc) > 0.0049) out.push(`${n}: base de ${g} de ${IMP_TXT[t.imp]} ajustada a mano a ${money(t.base)} (calculada ${money(t.bCalc)}).`);
      if (t.factor !== 'Exento' && Math.abs(t.importe - r2(t.base * num(t.tasa))) > 0.0049) {
        const lim = Math.abs(t.importe - t.base * num(t.tasa)) > 0.01 + 1e-9;
        out.push(`${n}: importe de ${g} de ${IMP_TXT[t.imp]} ajustado a mano a ${money(t.importe)} (Base × Tasa = ${money(r2(t.base * num(t.tasa)))}).${lim ? ' Supera el margen de redondeo que valida el PAC (límites inferior y superior del Anexo 20): el timbrado podría rechazarse.' : ''}`);
      }
    });
  });
  const k = calcDoc(d); if (k.loc) out.push(`Se agregaron impuestos locales (complemento implocal 1.0): ${k.loc.tras.concat(k.loc.ret).map(l => `${l.nombre} ${l.pct}% = ${money(l.importe)}`).join('; ')}. Verifica que la autoridad local los exija.`);
  return out;
}
const _validarTax = validar;
validar = function (d, em) {
  const v = _validarTax(d, em); if (!d || S._enDry) return v;
  if (d.especial) {
    const keep = [];
    v.E.forEach(e => { if (esRelajable(e)) v.W.push(Object.assign({}, e, {m: 'Advertencia: ' + e.m + (['CFDI40158'].includes(e.code) || ['forma99', 'formaReal', 'usoRec', 'regimenRec', 'pgDatos'].includes(e.fix) ? ' El PAC valida esta regla y puede rechazar el timbrado.' : ''), exc: true, sev: 'warn'})); else keep.push(e); });
    v.E.length = 0; keep.forEach(e => v.E.push(e));
    if (!v.W.some(w => w.exc)) v.W.push({m: 'Emisión especial activa: los parámetros se respetan tal como los configuraste.', ley: 'Requerimiento de autoridad o cliente', exc: true});
  }
  difImpuestos(d).forEach(m => v.W.push({m: 'Advertencia: ' + m, ley: 'Configuración manual de impuestos', attr: 'Impuestos', exc: true}));
  if (['I', 'E', 'T'].includes(d.tipo) && String(d.folio || '').trim() && !folioUsado(d.serie, d.folio)) { const nf = nextFree(d.serie), n = folioNum(d.folio); if (n !== null && n > nf) v.W.push({m: `Advertencia: folio interno ${fmtSF(d.serie, d.folio)} capturado fuera del consecutivo (siguiente libre ${fmtSF(d.serie, nf)}); quedarían sin usar ${fmtRangos([[nf, n - 1]], 1)}.`, ley: 'Control interno de folios', attr: 'Folio', exc: true}); }
  return v;
};

/* ---- Sección "Configuración y desglose de impuestos" ---- */
function resumenImpHTML(k, d) {
  const rows = [];
  k.tras.forEach(t => rows.push([`${IMP_TXT[t.imp]} trasladado`, t.factor === 'Exento' ? 'Exento' : t.factor === 'Cuota' ? `Cuota $${num(t.tasa)}` : `${r2(num(t.tasa) * 100 * 10000) / 10000}%`, t.base, t.importe, 1]));
  k.ret.forEach(t => rows.push([`${IMP_TXT[t.imp]} retenido`, t.factor === 'Cuota' ? `Cuota $${num(t.tasa)}` : `${r2(num(t.tasa) * 100 * 10000) / 10000}%`, t.base, -t.importe, 1]));
  if (k.loc) { k.loc.tras.forEach(l => rows.push([`Local trasladado: ${l.nombre}`, l.pct + '%', l.base, l.importe])); k.loc.ret.forEach(l => rows.push([`Local retenido: ${l.nombre}`, l.pct + '%', l.base, -l.importe])); }
  return `<div class="tw"><table class="taxsum"><thead><tr><th>Impuesto</th><th>Tasa o cuota</th><th class="n">Base</th><th class="n">Importe</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r[0])}</td><td class="mono">${esc(r[1])}</td><td class="n">${money(r[2], d.moneda)}</td><td class="n">${r[3] < 0 ? '−' : ''}${money(Math.abs(r[3]), d.moneda)}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Sin impuestos (objeto de impuesto 01, 03 o 04).</td></tr>'}</tbody>
  <tfoot><tr><td colspan="3">Subtotal ${money(k.sub - k.des, d.moneda)} · Total</td><td class="n"><b>${money(k.total, d.moneda)}</b></td></tr></tfoot></table></div>`;
}
function taxRowHTML(i, g, j, t, calc) {
  const id = `${i}|${g}|${j}`, impOpts = g === 'tras' ? [['002', 'IVA'], ['003', 'IEPS']] : [['001', 'ISR'], ['002', 'IVA'], ['003', 'IEPS']], facOpts = g === 'tras' ? ['Tasa', 'Cuota', 'Exento'] : ['Tasa', 'Cuota'];
  return `<tr>${g === 'ret' ? `<td><input type="checkbox" data-tmc="${id}|on" ${t.on !== false ? 'checked' : ''} aria-label="Aplicar retención"></td>` : '<td></td>'}
  <td><select data-tms="${id}|imp" aria-label="Impuesto">${impOpts.map(([v, l]) => `<option value="${v}"${t.imp === v ? ' selected' : ''}>${l} (${v})</option>`).join('')}</select></td>
  <td><select data-tms="${id}|factor" aria-label="Tipo de factor">${facOpts.map(v => `<option${t.factor === v ? ' selected' : ''}>${v}</option>`).join('')}</select></td>
  <td>${t.factor === 'Exento' ? '<span class="muted small">—</span>' : `<div class="unit"><input class="mono r" data-tm="${id}|valor" value="${esc(t.valor)}" inputmode="decimal" aria-label="${t.factor === 'Cuota' ? 'Cuota por unidad' : 'Tasa en porcentaje'}"><span>${t.factor === 'Cuota' ? '$/u' : '%'}</span></div>`}</td>
  <td><input class="mono r" data-tm="${id}|base" value="${esc(t.base)}" placeholder="${calc ? f2(calc.bCalc) : ''}" inputmode="decimal" aria-label="Base (vacío = calculada)"></td>
  <td>${t.factor === 'Exento' ? '<span class="muted small">—</span>' : `<input class="mono r" data-tm="${id}|importe" value="${esc(t.importe)}" placeholder="${calc ? f2(calc.iCalc) : ''}" inputmode="decimal" aria-label="Importe (vacío = calculado)">`}</td>
  <td><button class="x" data-a="taxDel" data-id="${id}" aria-label="Quitar">×</button></td></tr>`;
}
function taxCardHTML(d) {
  const k = calcDoc(d), sug = sugerir(d), man = d.taxMode === 'manual';
  const head = `<section class="card taxcard" id="taxcard"><div class="bh"><h2><span class="n">3</span>Configuración y desglose de impuestos</h2></div>
  <div class="seg" role="radiogroup" aria-label="Modo de impuestos"><button class="${man ? '' : 'on'}" data-a="taxMode" data-v="auto" role="radio" aria-checked="${!man}">Aceptar sugerencia de impuestos</button><button class="${man ? 'on' : ''}" data-a="taxMode" data-v="manual" role="radio" aria-checked="${man}">Modificar impuestos de forma manual</button></div>`;
  if (!man) return head + `
  ${sug && sug !== d.preset ? `<div class="alert info"><span>Por tu régimen (${esc(EM().regimen)}) y el de tu cliente${d.receptor.regimen ? ` (${esc(d.receptor.regimen)})` : ''}, te sugerimos: <b>${esc(PRESETS[sug].t)}</b>.</span><button class="btn sm" data-a="applyPreset" data-p="${sug}">Aplicar</button></div>` : ''}
  <div class="fld"><label for="presetSel">Situación fiscal: aplica IVA y retenciones a todos los conceptos</label><select id="presetSel" data-a2="preset">${Object.entries(PRESETS).map(([key, p]) => `<option value="${key}"${key === d.preset ? ' selected' : ''}>${esc(p.t)}</option>`).join('')}</select><small>Fundamento: ${esc(PRESETS[d.preset] ? PRESETS[d.preset].ley : '')}</small></div>
  <p class="eyebrow">Impuestos sugeridos</p><div id="taxsum">${resumenImpHTML(k, d)}</div></section>`;
  const blocks = d.conceptos.map((c, i) => {
    const T = c.taxMan || (c.taxMan = taxManDesde(c)), kl = k.lines[i] || {tras: [], ret: []}, conImp = ['02', '05', '07'].includes(c.objeto);
    const calcOf = (g, j) => kl[g].find(t => t.j === j);
    return `<div class="taxcon"><div class="chead"><b>${i + 1}</b><span class="small">${esc(c.descripcion || 'Concepto sin descripción')} · base ${money(kl.base || 0, d.moneda)}</span></div>
    <div class="row wrap"><div class="fld"><label>ObjetoImp</label><select data-tmo="${i}">${CAT.objetoImp.map(o => `<option value="${o[0]}"${c.objeto === o[0] ? ' selected' : ''}>${o[0]} - ${esc(o[1])}</option>`).join('')}</select></div></div>
    ${conImp ? `<div class="tw"><table class="taxman"><thead><tr><th></th><th>Impuesto</th><th>Factor</th><th>Tasa o cuota</th><th>Base (override)</th><th>Importe (override)</th><th></th></tr></thead><tbody>
      <tr class="grp"><td colspan="7">Traslados</td></tr>${T.tras.map((t, j) => taxRowHTML(i, 'tras', j, t, calcOf('tras', j))).join('') || '<tr><td colspan="7" class="muted small">Sin traslados.</td></tr>'}
      <tr class="grp"><td colspan="7">Retenciones</td></tr>${T.ret.map((t, j) => taxRowHTML(i, 'ret', j, t, calcOf('ret', j))).join('') || '<tr><td colspan="7" class="muted small">Sin retenciones.</td></tr>'}
    </tbody></table></div>
    <div class="row wrap"><button class="btn ghost sm" data-a="taxAdd" data-i="${i}" data-g="tras">+ Traslado</button><button class="btn ghost sm" data-a="taxAdd" data-i="${i}" data-g="ret">+ Retención</button>${d.conceptos.length > 1 ? `<button class="btn ghost sm" data-a="taxCopy" data-i="${i}">Copiar a todos los conceptos</button>` : ''}</div>` : '<p class="muted small">Con este ObjetoImp el concepto no desglosa impuestos.</p>'}</div>`;
  }).join('');
  const L = d.locales || [];
  return head + `<div class="alert warn"><span><b>Modo manual.</b> Tú defines ObjetoImp, factor, tasas y retenciones. Deja Base o Importe vacíos para que se calculen; escribe un monto solo si te piden un cuadre al centavo. Las diferencias contra la sugerencia aparecerán en el monitoreo de excepciones antes de emitir.</span><button class="btn sm ghost" data-a="taxMode" data-v="auto">Volver a la sugerencia</button></div>
  ${blocks}
  <div class="taxcon"><div class="chead"><b>L</b><span class="small">Impuestos locales (estatales o municipales) · complemento implocal 1.0</span></div>
  ${L.length ? `<div class="tw"><table class="taxman"><thead><tr><th>Tipo</th><th>Nombre del impuesto</th><th>Tasa %</th><th>Base (override)</th><th>Importe (override)</th><th></th></tr></thead><tbody>${L.map((l, j) => { const c = k.loc ? k.loc.tras.concat(k.loc.ret).find(x => x.nombre === (l.nombre || 'Impuesto local') && x.pct === num(l.pct)) : null; return `<tr><td><select data-tls="${j}|tipo" aria-label="Tipo">${['Trasladado', 'Retenido'].map(v => `<option${l.tipo === v ? ' selected' : ''}>${v}</option>`).join('')}</select></td><td><input data-tl="${j}|nombre" value="${esc(l.nombre)}" aria-label="Nombre"></td><td><input class="mono r" data-tl="${j}|pct" value="${esc(l.pct)}" inputmode="decimal" aria-label="Tasa"></td><td><input class="mono r" data-tl="${j}|base" value="${esc(l.base)}" placeholder="${f2(k.sub - k.des)}" inputmode="decimal" aria-label="Base"></td><td><input class="mono r" data-tl="${j}|importe" value="${esc(l.importe)}" placeholder="${c ? f2(c.iCalc) : ''}" inputmode="decimal" aria-label="Importe"></td><td><button class="x" data-a="locDel" data-j="${j}" aria-label="Quitar">×</button></td></tr>`; }).join('')}</tbody></table></div>` : '<p class="muted small">Sin impuestos locales.</p>'}
  <div class="row wrap">${LOCAL_PRESETS.map((p, j) => `<button class="btn ghost sm" data-a="locAdd" data-j="${j}">+ ${esc(p.nombre.split(' (')[0])} ${p.pct}%</button>`).join('')}<button class="btn ghost sm" data-a="locAdd" data-j="-1">+ Otro impuesto local</button></div></div>
  <p class="eyebrow">Desglose resultante</p><div id="taxsum">${resumenImpHTML(k, d)}</div></section>`;
}
const TAX_RE = /<section class="card"><h2><span class="n">3<\/span>Situación fiscal e impuestos<\/h2>[\s\S]*?<\/section>/;
function especialHTML(d) {
  return `<div class="especial${d.especial ? ' on' : ''}"><label class="check"><input type="checkbox" data-a2="especial" ${d.especial ? 'checked' : ''}> <b>Emisión especial / requerimiento de autoridad</b></label><small>${d.especial ? 'Puedes combinar libremente forma y método de pago, uso, régimen, folio, relación e impuestos. Las reglas que no se cumplan pasan a advertencias y se confirman antes de emitir.' : 'Actívalo cuando una autoridad, dependencia o cliente te exija una configuración fuera del estándar.'}</small></div>`;
}
['factura', 'cartaporte'].forEach(v => { const f = VIEWS[v]; VIEWS[v] = () => { let h = f(); const d = S.draft; if (!d) return h; h = h.replace(TAX_RE, () => taxCardHTML(d)); return h.replace('<section class="card"><h2><span class="n">1</span>Datos del comprobante</h2>', () => `<section class="card"><h2><span class="n">1</span>Datos del comprobante</h2>${especialHTML(d)}`); }; });

function refreshTax() {
  const d = S.draft; if (!d) return; const k = calcDoc(d), box = $('#taxsum'); if (box) box.innerHTML = resumenImpHTML(k, d);
  $$('[data-tm]').forEach(el => { const [i, g, j, f] = el.dataset.tm.split('|'), t = (k.lines[+i] || {})[g] && k.lines[+i][g].find(x => x.j === +j); if (t && f === 'base') el.placeholder = f2(t.bCalc); if (t && f === 'importe') el.placeholder = f2(t.iCalc); });
  updateSide();
}
Object.assign(A, {
  taxMode: el => {
    const d = S.draft; if (!d) return; const v = el.dataset.v;
    if (v === 'manual' && d.taxMode !== 'manual') d.conceptos.forEach(c => { c.taxMan = taxManDesde(c); });
    if (v === 'auto') { d.conceptos.forEach(c => { delete c.taxMan; }); applyPreset(d, d.preset || 'normal'); }
    d.taxMode = v; render();
  },
  taxAdd: el => { const c = S.draft.conceptos[+el.dataset.i], T = c.taxMan || (c.taxMan = taxManDesde(c)); if (el.dataset.g === 'tras') T.tras.push({imp: '002', factor: 'Tasa', valor: '16', base: '', importe: ''}); else T.ret.push({imp: '001', factor: 'Tasa', valor: '10', base: '', importe: '', on: true}); render(); },
  taxDel: el => { const [i, g, j] = el.dataset.id.split('|'); S.draft.conceptos[+i].taxMan[g].splice(+j, 1); render(); },
  taxCopy: el => { const d = S.draft, src = d.conceptos[+el.dataset.i]; d.conceptos.forEach(c => { if (c !== src) { c.objeto = src.objeto; c.taxMan = clone({tras: src.taxMan.tras.map(t => Object.assign({}, t, {base: '', importe: ''})), ret: src.taxMan.ret.map(t => Object.assign({}, t, {base: '', importe: ''}))}); } }); render(); toast('Configuración copiada a todos los conceptos (sin los montos ajustados a mano).', 'ok'); },
  locAdd: el => { const d = S.draft, p = LOCAL_PRESETS[+el.dataset.j]; d.locales = (d.locales || []).concat([p ? Object.assign({base: '', importe: ''}, p) : {tipo: 'Trasladado', nombre: '', pct: '', base: '', importe: ''}]); if (d.taxMode !== 'manual') { d.conceptos.forEach(c => { c.taxMan = taxManDesde(c); }); d.taxMode = 'manual'; } render(); },
  locDel: el => { S.draft.locales.splice(+el.dataset.j, 1); render(); }
});
Object.assign(A2, {
  especial: el => { const d = S.draft; if (!d) return; d.especial = el.checked; render(); toast(el.checked ? 'Emisión especial activa: las reglas no se fuerzan; se mostrarán como advertencias.' : 'Emisión especial desactivada: vuelven los candados estándar.', el.checked ? 'warn' : ''); }
});
document.addEventListener('input', e => {
  const el = e.target, d = S.draft; if (!d) return;
  if (el.dataset.tm) { const [i, g, j, f] = el.dataset.tm.split('|'); const t = d.conceptos[+i].taxMan[g][+j]; t[f] = el.value.trim(); refreshTax(); }
  else if (el.dataset.tl) { const [j, f] = el.dataset.tl.split('|'); d.locales[+j][f] = el.value; refreshTax(); }
});
document.addEventListener('change', e => {
  const el = e.target, d = S.draft; if (!d) return;
  if (el.dataset.tms) { const [i, g, j, f] = el.dataset.tms.split('|'); const t = d.conceptos[+i].taxMan[g][+j]; t[f] = el.value; if (f === 'factor' && el.value === 'Exento') { t.valor = ''; t.importe = ''; } if (f === 'factor' && el.value !== 'Exento' && !t.valor) t.valor = el.value === 'Tasa' ? '16' : ''; render(); }
  else if (el.dataset.tmc) { const [i, g, j] = el.dataset.tmc.split('|'); d.conceptos[+i].taxMan[g][+j].on = el.checked; refreshTax(); }
  else if (el.dataset.tmo !== undefined) { const c = d.conceptos[+el.dataset.tmo]; c.objeto = el.value; if (['02', '05', '07'].includes(el.value) && !c.taxMan) c.taxMan = taxManDesde(c); render(); }
  else if (el.dataset.tls) { const [j, f] = el.dataset.tls.split('|'); d.locales[+j][f] = el.value; refreshTax(); }
  else if (d.taxMode !== 'manual' && /^conceptos\.\d+\.(iva|retIsr|retIva)$/.test(el.dataset.b || '')) {
    const pr = PRESETS[d.preset] || {}, f = el.dataset.b.split('.')[2], key = {iva: 'iva', retIsr: 'isr', retIva: 'riva'}[f];
    if ((pr[key] ?? '') !== el.value) setTimeout(() => { d.conceptos.forEach(c => { c.taxMan = taxManDesde(c); }); d.taxMode = 'manual'; render(); toast('Cambiaste un impuesto respecto a la sugerencia: pasamos a modo manual para que lo controles.'); }, 0);
  }
});
/* En modo manual la cuadrícula muestra el resumen, no los selectores sugeridos */
const _conceptGridTax = conceptGrid;
conceptGrid = function (d) {
  const h = _conceptGridTax(d); if (d.taxMode !== 'manual' || d.tipo === 'T') return h;
  return h.replace(/<td><select id="b_conceptos_(\d+)_iva"[\s\S]*?<\/select><\/td><td><select id="b_conceptos_\1_retIsr"[\s\S]*?<\/select><\/td><td><select id="b_conceptos_\1_retIva"[\s\S]*?<\/select><\/td>/g, (m, i) => { const k = calcConcepto(Object.assign({}, d.conceptos[+i], {_tm: true}), d.tipo); return `<td colspan="3" class="small"><button class="link" data-a="taxGo">${esc(k.tras.map(t => `${IMP_TXT[t.imp]} ${t.factor === 'Exento' ? 'exento' : t.factor === 'Cuota' ? '$' + num(t.tasa) : r2(num(t.tasa) * 1e6) / 1e4 + '%'}`).concat(k.ret.map(t => `Ret. ${IMP_TXT[t.imp]} ${r2(num(t.tasa) * 1e6) / 1e4}%`)).join(' · ') || 'Sin impuestos')}</button><br><span class="muted">Manual</span></td>`; });
};
A.taxGo = () => { const n = $('#taxcard'); if (n) n.scrollIntoView({block: 'start', behavior: 'smooth'}); };

/* ---- Revisión antes de emitir: Monitoreo de Excepciones y Advertencias ---- */
function excepcionesHTML(X) {
  return `<div class="excbox" role="alert"><h4>Monitoreo de Excepciones y Advertencias</h4><p class="small">Esta factura difiere de la sugerencia estándar. No se bloquea: revisa cada punto y confirma si así la necesitas.</p>
  <ul>${X.map(w => `<li>${esc(w.m)}${w.ley ? `<small>${esc(w.ley)}</small>` : ''}</li>`).join('')}</ul>
  <label class="check"><input type="checkbox" id="ck4"> <b>Confirmar y emitir con configuración especial del usuario</b></label></div>`;
}
const _reviewTax = review;
review = function () {
  _reviewTax(); const d = S.draft, em = EM(); if (!d || $('#modal').hidden) return;
  const v = validar(d, em), X = v.W.filter(w => w.exc); if (!X.length) return;
  const mf = $('#modal .mf'); if (mf) mf.insertAdjacentHTML('beforebegin', excepcionesHTML(X));
};
A.review = review;
const _emitirTax = A.emitir;
A.emitir = async el => {
  const c4 = $('#ck4'); if (c4 && !c4.checked) { c4.closest('.excbox').classList.add('shake'); return toast('Confirma la emisión con configuración especial en el recuadro ámbar.', 'warn'); }
  const d = S.draft, X = d ? validar(d, EM()).W.filter(w => w.exc) : [];
  await _emitirTax(el);
  if (X.length) bitaLog({fuente: 'timbrado', sev: 'warn', origen: `Editor · ${d.serie}${d.folio}`, ref: d.receptor.rfc, code: 'EMISION_ESPECIAL', diag: `Emitido con configuración especial confirmada por el usuario: ${X.map(w => w.m.replace(/^Advertencia: /, '')).join(' | ')}`});
};
