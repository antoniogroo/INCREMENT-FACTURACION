/* ============ COMPROBANTES ============ */
VIEWS.comprobantes = () => {
  const em = EM(), f = S.f;
  const q = f.q.trim().toLowerCase();
  const rows = S.cfdis.filter(c => c.emisorId === em.id)
    .filter(c => !f.tipo || (f.tipo === 'CP' ? c.cp : c.tipo === f.tipo))
    .filter(c => !f.estado || (f.estado === 'PPD' ? c.metodo === 'PPD' && c.saldo > 0.009 && c.estado !== 'Cancelado' : c.estado === f.estado))
    .filter(c => !q || [c.serie + c.folio, c.uuid, c.receptor.rfc, c.receptor.nombre, f2(c.total)].join(' ').toLowerCase().includes(q))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  return `<header class="ph"><div><p class="eyebrow">Base de datos de CFDI</p><h1>Comprobantes</h1></div><button class="btn ghost" data-a="exportCSV">Exportar a CSV</button></header>
  <div class="filters"><div class="fld grow"><label for="fq">Buscar</label><input id="fq" data-f="q" value="${esc(f.q)}" placeholder="Folio, UUID, RFC, cliente o monto"></div>
  <div class="fld"><label for="ft">Tipo</label><select id="ft" data-f="tipo">${opts([['I', 'Ingreso'], ['E', 'Egreso'], ['T', 'Traslado'], ['P', 'Pago'], ['R', 'Retenciones'], ['CP', 'Con Carta Porte']], f.tipo, false, 'Todos')}</select></div>
  <div class="fld"><label for="fe">Estado</label><select id="fe" data-f="estado">${opts([['Vigente', 'Vigentes'], ['Cancelado', 'Cancelados'], ['PPD', 'Por cobrar (PPD)']], f.estado, false, 'Todos')}</select></div></div>
  ${rows.length ? `<div class="tw"><table><thead><tr><th>Folio</th><th>Tipo</th><th>Receptor</th><th>Fecha</th><th class="n">Total</th><th>Estado</th><th></th></tr></thead><tbody>
  ${rows.map(c => `<tr class="click" data-a="ver" data-id="${c.id}" tabindex="0"><td class="mono">${esc(c.serie)}${esc(c.folio)}${c.demo ? ' ' + chip('Ejemplo') : ''}</td><td>${esc(tipoNombre(c))}</td><td><span class="mono small">${esc(c.receptor.rfc)}</span><br>${esc(c.receptor.nombre)}</td><td>${fmtDate(c.fecha)}</td><td class="n">${c.tipo === 'P' ? money(c.montoPago, c.moneda) : c.tipo === 'R' ? money(c.totalRet) : money(c.total, c.moneda)}</td><td>${estadoChip(c)}</td><td class="acts"><button class="btn sm ghost" data-a="verPDF" data-id="${c.id}">PDF</button>${['I', 'E', 'T'].includes(c.tipo) && c.estado !== 'Cancelado' && c.draft ? `<button class="btn sm ghost" data-a="sustituir" data-id="${c.id}" title="Abre una copia editable; al timbrarla se cancela esta con motivo 01">Corregir y sustituir</button>` : ''}</td></tr>`).join('')}
  </tbody></table></div>` : '<p class="empty">No hay comprobantes con estos filtros.</p>'}`;
};
function verCFDI(id, tab = 'res') {
  const c = S.cfdis.find(x => x.id === id); if (!c) return;
  const rel = S.cfdis.filter(x => (x.pagosDe || []).some(p => p.id === c.id));
  openModal(`<header class="mh"><div><p class="eyebrow">${esc(tipoNombre(c))} · ${esc(c.serie)}${esc(c.folio)}</p><h3 class="mono uuid">${esc(c.uuid)}</h3></div><button class="x" data-a="close" aria-label="Cerrar">×</button></header>
  <div class="seg"><button class="${tab === 'res' ? 'on' : ''}" data-a="ver" data-id="${c.id}" data-tab="res">Resumen</button><button class="${tab === 'xml' ? 'on' : ''}" data-a="ver" data-id="${c.id}" data-tab="xml">XML</button></div>
  ${tab === 'xml' ? `<pre class="xml" id="xmlpre">${esc(c.xml)}</pre>` : `<div class="revgrid">
    <div><p class="eyebrow">Receptor</p><p><b>${esc(c.receptor.nombre)}</b><br><span class="mono">${esc(c.receptor.rfc)}</span>${c.receptor.uso ? ' · Uso ' + esc(c.receptor.uso) : ''}</p></div>
    <div><p class="eyebrow">Fecha</p><p>${esc(c.fecha.replace('T', ' '))}</p></div>
    <div><p class="eyebrow">${c.tipo === 'P' ? 'Monto del pago' : c.tipo === 'R' ? 'Total retenido' : 'Total'}</p><p class="big">${c.tipo === 'P' ? money(c.montoPago, c.moneda) : c.tipo === 'R' ? money(c.totalRet) : money(c.total, c.moneda)}</p></div>
    <div><p class="eyebrow">Estado</p><p>${estadoChip(c)}${c.cancel ? `<br><small>Motivo ${esc(c.cancel.motivo)} · ${esc(c.cancel.fecha)}</small>` : ''}</p></div></div>
    ${c.tipo === 'I' && c.metodo === 'PPD' ? `<h4 class="sub">Historial de cobro</h4>${(c.pagos || []).length ? `<div class="tw"><table><thead><tr><th>Parcialidad</th><th>Complemento</th><th class="n">Pagado</th><th class="n">Saldo</th></tr></thead><tbody>${c.pagos.map(p => `<tr><td>${p.parc}</td><td class="mono small">${esc(p.uuid.slice(0, 8))}…</td><td class="n">${money(p.monto, c.moneda)}</td><td class="n">${money(p.saldo, c.moneda)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">Sin pagos registrados.</p>'}` : ''}
    ${c.tipo === 'P' ? `<h4 class="sub">Facturas pagadas</h4><ul class="plain">${(c.pagosDe || []).map(p => `<li><span class="mono">${esc(p.folio)}</span> · parcialidad ${p.parc} · ${money(p.monto, c.moneda)}</li>`).join('')}</ul>` : ''}`}
  <footer class="mf wrap"><button class="btn" data-a="verPDF" data-id="${c.id}">Ver PDF</button><button class="btn ghost" data-a="dlPDF" data-id="${c.id}">Descargar PDF</button><button class="btn ghost" data-a="zipXML" data-id="${c.id}">Descargar XML (.zip)</button>
  ${['I', 'E', 'T'].includes(c.tipo) && c.estado !== 'Cancelado' && c.draft ? `<button class="btn ghost" data-a="sustituir" data-id="${c.id}">Corregir y sustituir (motivo 01)</button>` : ''}<button class="btn ghost" data-a="copyXML" data-id="${c.id}">Copiar XML</button>
  ${c.tipo !== 'P' && c.tipo !== 'R' ? `<button class="btn ghost" data-a="duplicar" data-id="${c.id}">Duplicar</button>` : ''}
  ${c.tipo === 'I' && c.estado !== 'Cancelado' ? `<button class="btn ghost" data-a="notaCredito" data-id="${c.id}">Nota de crédito</button>` : ''}
  ${c.tipo === 'I' && c.metodo === 'PPD' && c.saldo > 0.009 && c.estado !== 'Cancelado' ? `<button class="btn ghost" data-a="pagarDesde" data-id="${c.id}">Registrar pago</button>` : ''}
  ${c.estado !== 'Cancelado' ? `<button class="btn danger" data-a="cancelar" data-id="${c.id}">Cancelar</button>` : ''}</footer>`, true);
}
function plazoCancelacion(c, em) {
  const y = num(c.fecha.slice(0, 4)) + 1; return new Date(`${y}-${rfcTipo(em.rfc) === 'M' ? '03-31' : '04-30'}T23:59:59`);
}
function cancelar(id) {
  const c = S.cfdis.find(x => x.id === id), em = EM();
  const lim = plazoCancelacion(c, em), vencido = new Date() > lim;
  const pagosVig = (c.pagos || []).some(p => { const pc = S.cfdis.find(x => x.uuid === p.uuid); return pc && pc.estado !== 'Cancelado'; });
  const sinAcept = c.total <= 1000 || ['E', 'T', 'P'].includes(c.tipo) || rfcTipo(c.receptor.rfc) === 'PG' || rfcTipo(c.receptor.rfc) === 'EXT';
  const blocked = vencido ? `El plazo para cancelar este CFDI venció el ${fmtDate(lim)} (fecha límite de tu declaración anual del ejercicio en que se emitió).` : pagosVig ? 'Esta factura tiene complementos de pago vigentes. Cancela primero esos complementos.' : '';
  openModal(`<header class="mh"><h3>Cancelar ${esc(c.serie)}${esc(c.folio)}</h3><button class="x" data-a="close" aria-label="Cerrar">×</button></header>
  ${blocked ? `<div class="alert bad"><span>${esc(blocked)}</span></div><p class="muted small">Fundamento: CFF art. 29-A, reforma 2026.</p><footer class="mf"><button class="btn ghost" data-a="close">Entendido</button></footer>` : `
  <div class="fld"><label for="cmot">Motivo de cancelación</label><select id="cmot" data-a2="cmot">${opts(CAT.motivoCancel, '02')}</select></div>
  <div class="fld" id="csustw" hidden><label for="csust">Folio fiscal del CFDI que lo sustituye</label><select id="csust">${opts(S.cfdis.filter(x => x.id !== c.id && x.tipo === c.tipo && x.estado !== 'Cancelado' && x.receptor.rfc === c.receptor.rfc).map(x => [x.uuid, `${x.serie}${x.folio} · ${x.uuid.slice(0, 8)}… · ${money(x.total)}`]), '', false, 'Selecciona el CFDI sustituto…')}</select><small>Con motivo 01 primero emite el CFDI correcto relacionado con tipo 04 (sustitución).</small></div>
  <p class="note">${sinAcept ? 'Este CFDI se cancela sin aceptación del receptor.' : 'Este CFDI requiere que el receptor acepte la cancelación en el buzón del SAT (tiene 3 días hábiles; si no responde, se considera aceptada).'} Puedes cancelar hasta el ${fmtDate(lim)}.</p>
  <p class="ferr" id="cerr" hidden></p>
  <footer class="mf"><button class="btn ghost" data-a="close">No cancelar</button><button class="btn danger" data-a="doCancel" data-id="${c.id}">Cancelar CFDI</button></footer>`}`);
}

/* ============ COMPLEMENTO DE PAGOS 2.0 ============ */
function pendientes(rfc) { const em = EM(); return S.cfdis.filter(c => c.emisorId === em.id && c.tipo === 'I' && c.metodo === 'PPD' && c.estado !== 'Cancelado' && c.saldo > 0.009 && (!rfc || c.receptor.rfc === rfc)).sort((a, b) => a.fecha.localeCompare(b.fecha)); }
function newPago(rfc) { return {rfc: rfc || '', fecha: nowLocal().slice(0, 16), forma: '03', monto: '', numOp: '', tc: '', sel: {}}; }
VIEWS.pagos = () => {
  const P = S.pago || (S.pago = newPago());
  const all = pendientes(), clientes = [...new Map(all.map(c => [c.receptor.rfc, c.receptor.nombre])).entries()];
  const list = P.rfc ? pendientes(P.rfc) : [];
  const moneda = list[0] ? list[0].moneda : 'MXN';
  return `<header class="ph"><div><p class="eyebrow">Complemento para recepción de pagos 2.0</p><h1>Registrar un pago recibido</h1></div></header>
  <div class="editor"><div class="ecol">
  <section class="card"><h2><span class="n">1</span>¿Quién te pagó?</h2>
  ${clientes.length ? `<div class="fld"><label for="pcli">Cliente con facturas PPD pendientes</label><select id="pcli" data-a2="pagoCli">${opts(clientes.map(([r, n]) => [r, `${r} · ${n} · ${all.filter(c => c.receptor.rfc === r).length} facturas`]), P.rfc, false, 'Selecciona el cliente…')}</select></div>`
    : '<p class="empty">No tienes facturas PPD con saldo. Las facturas a crédito que emitas aparecerán aquí automáticamente.</p>'}
  </section>
  ${P.rfc ? `<section class="card"><h2><span class="n">2</span>Datos del pago</h2><div class="grid3">
    ${F('Fecha y hora en que recibiste el pago', `<input id="p_fecha" type="datetime-local" data-p="fecha" value="${esc(P.fecha)}">`)}
    ${F('Forma de pago', `<select id="p_forma" data-p="forma">${opts(CAT.formaPago.filter(x => x[0] !== '99'), P.forma)}</select>`)}
    ${F('Monto recibido (' + moneda + ')', `<input id="p_monto" data-p="monto" value="${esc(P.monto)}" inputmode="decimal" class="mono">`)}
    ${F('Número de operación o referencia', `<input id="p_numOp" data-p="numOp" value="${esc(P.numOp)}" placeholder="opcional">`)}
    ${moneda !== 'MXN' ? F('Tipo de cambio del día del pago', `<input id="p_tc" data-p="tc" value="${esc(P.tc)}" inputmode="decimal" class="mono">`) : ''}
  </div><button class="btn ghost sm" data-a="repartir">Repartir el monto entre las facturas más antiguas</button></section>
  <section class="card"><h2><span class="n">3</span>Facturas que cubre este pago</h2>
  <div class="tw"><table><thead><tr><th></th><th>Folio</th><th>Fecha</th><th class="n">Saldo anterior</th><th class="n">Monto pagado</th><th class="n">Saldo insoluto</th><th>Parc.</th></tr></thead><tbody>
  ${list.map(c => { const s = P.sel[c.id]; const on = s !== undefined; return `<tr><td><input type="checkbox" aria-label="Incluir ${esc(c.serie + c.folio)}" data-a2="pagoSel" data-id="${c.id}" ${on ? 'checked' : ''}></td><td class="mono">${esc(c.serie)}${esc(c.folio)}</td><td>${fmtDate(c.fecha)}</td><td class="n">${money(c.saldo, c.moneda)}</td><td class="n">${on ? `<input class="mono num" data-ps="${c.id}" value="${esc(s)}" inputmode="decimal" aria-label="Monto pagado">` : '—'}</td><td class="n" id="ins_${c.id}">${on ? money(r2(c.saldo - num(s)), c.moneda) : '—'}</td><td>${(c.pagos || []).length + 1}</td></tr>`; }).join('')}
  </tbody></table></div></section>` : ''}
  </div><aside class="eside"><div class="sticky" id="pside">${pagoSide()}</div></aside></div>`;
};
function validarPago(P) {
  const E = []; const list = pendientes(P.rfc); const sel = Object.entries(P.sel);
  if (!P.rfc) E.push('Selecciona el cliente que pagó.');
  if (!P.fecha) E.push('Captura la fecha del pago.'); else if (new Date(P.fecha) > new Date()) E.push('La fecha del pago no puede ser futura.');
  if (!(num(P.monto) > 0)) E.push('Captura el monto recibido.');
  if (!sel.length) E.push('Marca al menos una factura.');
  let suma = 0;
  sel.forEach(([id, v]) => { const c = list.find(x => x.id === id); if (!c) return; suma += num(v); if (!(num(v) > 0)) E.push(`${c.serie}${c.folio}: el monto pagado debe ser mayor a cero.`); if (num(v) - c.saldo > 0.009) E.push(`${c.serie}${c.folio}: pagas más que el saldo pendiente.`); });
  if (sel.length && Math.abs(r2(suma) - r2(num(P.monto))) > 0.009) E.push(`La suma aplicada (${money(suma)}) no coincide con el monto recibido (${money(num(P.monto))}).`);
  const mons = new Set(sel.map(([id]) => (list.find(x => x.id === id) || {}).moneda)); if (mons.size > 1) E.push('Registra por separado los pagos de facturas en monedas distintas.');
  if ([...mons][0] && [...mons][0] !== 'MXN' && !(num(P.tc) > 0)) E.push('Captura el tipo de cambio del día del pago.');
  return E;
}
function pagoSide() {
  const P = S.pago; if (!P) return '';
  const E = validarPago(P), f = P.fecha ? new Date(P.fecha) : new Date();
  const lim = new Date(f.getFullYear(), f.getMonth() + 1, 5);
  return `<div class="sumcard"><p class="eyebrow">CFDI tipo P · Pagos 2.0</p><dl class="tot"><div><dt>Monto recibido</dt><dd>${money(num(P.monto))}</dd></div><div><dt>Facturas</dt><dd>${Object.keys(P.sel).length}</dd></div><div class="grand"><dt>Total del CFDI</dt><dd>$0.00</dd></div></dl>
  <p class="muted small">Emite este complemento a más tardar el <b>5 de ${MESES[lim.getMonth()]} de ${lim.getFullYear()}</b> (día 5 del mes siguiente al cobro). CFF art. 29 fr. VI y RMF 2026.</p></div>
  <div class="valid"><h3>${E.length ? 'Falta completar' : 'Listo para emitir'}</h3><ul>${E.map(e => `<li class="e"><span>${esc(e)}</span></li>`).join('')}</ul></div>
  <button class="btn block" data-a="reviewPago" ${E.length ? 'disabled' : ''}>Revisar y emitir complemento</button>`;
}
function buildPago(P) {
  const em = EM(), list = pendientes(P.rfc), sel = Object.entries(P.sel).map(([id, v]) => ({c: list.find(x => x.id === id), monto: r2(num(v))})).filter(x => x.c);
  const moneda = sel[0].c.moneda, tcP = moneda === 'MXN' ? 1 : num(P.tc);
  const TP = {}, RP = {}, tot = {};
  let doctos = '';
  sel.forEach(({c, monto}) => {
    const p = monto / c.total, parc = (c.pagos || []).length + 1, ins = r2(c.saldo - monto);
    const tras = c.imp.tras.map(t => ({...t, b: r2(t.base * p), i: r2(t.importe * p)})), ret = c.imp.ret.map(t => ({...t, b: r2(t.base * p), i: r2(t.importe * p)}));
    const obj = tras.length || ret.length ? '02' : '01';
    doctos += `      <pago20:DoctoRelacionado${attrs({IdDocumento: c.uuid, Serie: c.serie, Folio: c.folio, MonedaDR: c.moneda, EquivalenciaDR: '1', NumParcialidad: parc, ImpSaldoAnt: f2(c.saldo), ImpPagado: f2(monto), ImpSaldoInsoluto: f2(ins), ObjetoImpDR: obj})}>\n`;
    if (obj === '02') {
      doctos += '        <pago20:ImpuestosDR>\n';
      if (ret.length) doctos += '          <pago20:RetencionesDR>\n' + ret.map(t => `            <pago20:RetencionDR${attrs({BaseDR: f2(t.b), ImpuestoDR: t.imp, TipoFactorDR: 'Tasa', TasaOCuotaDR: t.tasa, ImporteDR: f2(t.i)})}/>\n`).join('') + '          </pago20:RetencionesDR>\n';
      if (tras.length) doctos += '          <pago20:TrasladosDR>\n' + tras.map(t => `            <pago20:TrasladoDR${attrs({BaseDR: f2(t.b), ImpuestoDR: t.imp, TipoFactorDR: t.factor, TasaOCuotaDR: t.factor === 'Exento' ? '' : t.tasa, ImporteDR: t.factor === 'Exento' ? '' : f2(t.i)})}/>\n`).join('') + '          </pago20:TrasladosDR>\n';
      doctos += '        </pago20:ImpuestosDR>\n';
    }
    doctos += '      </pago20:DoctoRelacionado>\n';
    tras.forEach(t => { const k = t.imp + t.factor + t.tasa; TP[k] = TP[k] || {imp: t.imp, factor: t.factor, tasa: t.tasa, b: 0, i: 0}; TP[k].b += t.b; TP[k].i += t.i; });
    ret.forEach(t => { RP[t.imp] = (RP[t.imp] || 0) + t.i; });
  });
  Object.values(TP).forEach(t => { if (t.imp !== '002') return; const key = t.factor === 'Exento' ? 'Exento' : (num(t.tasa) === 0.16 ? '16' : num(t.tasa) === 0.08 ? '8' : num(t.tasa) === 0 ? '0' : ''); if (!key) return;
    tot['TotalTrasladosBaseIVA' + key] = f2(r2(t.b * tcP)); if (key !== 'Exento') tot['TotalTrasladosImpuestoIVA' + key] = f2(r2(t.i * tcP)); });
  if (RP['002']) tot.TotalRetencionesIVA = f2(r2(RP['002'] * tcP)); if (RP['001']) tot.TotalRetencionesISR = f2(r2(RP['001'] * tcP)); if (RP['003']) tot.TotalRetencionesIEPS = f2(r2(RP['003'] * tcP));
  tot.MontoTotalPagos = f2(r2(num(P.monto) * tcP));
  let impP = '';
  if (Object.keys(RP).length || Object.keys(TP).length) {
    impP = '      <pago20:ImpuestosP>\n';
    if (Object.keys(RP).length) impP += '        <pago20:RetencionesP>\n' + Object.entries(RP).map(([k, v]) => `          <pago20:RetencionP ImpuestoP="${k}" ImporteP="${f2(v)}"/>\n`).join('') + '        </pago20:RetencionesP>\n';
    if (Object.keys(TP).length) impP += '        <pago20:TrasladosP>\n' + Object.values(TP).map(t => `          <pago20:TrasladoP${attrs({BaseP: f2(t.b), ImpuestoP: t.imp, TipoFactorP: t.factor, TasaOCuotaP: t.factor === 'Exento' ? '' : t.tasa, ImporteP: t.factor === 'Exento' ? '' : f2(t.i)})}/>\n`).join('') + '        </pago20:TrasladosP>\n';
    impP += '      </pago20:ImpuestosP>\n';
  }
  const fechaPago = P.fecha.length === 16 ? P.fecha + ':00' : P.fecha;
  const xml = `    <pago20:Pagos Version="2.0">\n      <pago20:Totales${attrs(tot)}/>\n      <pago20:Pago${attrs({FechaPago: fechaPago, FormaDePagoP: P.forma, MonedaP: moneda, TipoCambioP: moneda === 'MXN' ? '1' : f6(tcP), Monto: f2(num(P.monto)), NumOperacion: P.numOp})}>\n${doctos}${impP}      </pago20:Pago>\n    </pago20:Pagos>`;
  const c0 = sel[0].c;
  const d = {tipo: 'P', serie: (em.series || {}).P || 'P', folio: String((em.folios || {}).P || 1), lugarExp: em.cp, moneda: 'XXX', exportacion: '01', global: {on: false}, relacion: {tipo: '', uuids: ''},
    receptor: {rfc: c0.receptor.rfc, nombre: c0.receptor.nombre, regimen: c0.receptor.regimen, cp: c0.receptor.cp, uso: 'CP01', residencia: c0.receptor.residencia || '', numRegId: c0.receptor.numRegId || ''},
    conceptos: [{clave: '84111506', unidad: 'ACT', cantidad: '1', descripcion: 'Pago', vu: '0', objeto: '01'}]};
  return {d, xml, sel, moneda};
}
async function emitirPago(P) {
  const em = EM(), {d, xml, sel, moneda} = buildPago(P);
  d.fecha = nowLocal(); const uuid = uid().toUpperCase();
  const full = xmlCFDI(d, em, calcDoc(d), {pagos: xml, tfd: {uuid, fecha: d.fecha}});
  const rec = await saveRec('cfdi', {emisorId: em.id, tipo: 'P', serie: d.serie, folio: d.folio, fecha: d.fecha, uuid, estado: 'Vigente', receptor: d.receptor, moneda, total: 0, montoPago: r2(num(P.monto)), fechaPago: P.fecha, forma: P.forma,
    pagosDe: sel.map(({c, monto}) => ({id: c.id, folio: c.serie + c.folio, monto, parc: (c.pagos || []).length + 1})), xml: full});
  for (const {c, monto} of sel) { c.pagos = (c.pagos || []).concat([{uuid, monto, parc: (c.pagos || []).length + 1, saldo: r2(c.saldo - monto), fecha: P.fecha}]); c.saldo = r2(c.saldo - monto); await saveRec('cfdi', c); }
  em.folios = em.folios || {}; em.folios.P = num(d.folio) + 1; await saveRec('emisor', em);
  return rec;
}

/* ============ CFDI DE RETENCIONES 2.0 ============ */
const RET_PRESETS = {
  '01': {t: 'Servicios profesionales (honorarios)', imps: [['001', 0.10, '05'], ['002', 0.106667, '01']], ley: 'LISR art. 106; LIVA art. 1-A fr. II a)'},
  '05': {t: 'Arrendamiento', imps: [['001', 0.10, '05'], ['002', 0.106667, '01']], ley: 'LISR art. 116; LIVA art. 1-A fr. II a)'},
  '03': {t: 'Autotransporte terrestre de carga', imps: [['002', 0.04, '01']], ley: 'LIVA art. 1-A fr. II c)'},
  '04': {t: 'Comisionistas personas físicas', imps: [['001', 0.10, '05'], ['002', 0.106667, '01']], ley: 'LISR art. 106; LIVA art. 1-A fr. II a)'},
  '26': {t: 'Plataformas tecnológicas (transporte, c_TipoDeServ 01)', imps: [['001', 0.021, '05'], ['002', 0.08, '01']], ley: 'LISR arts. 113-A y 113-C; LIVA art. 18-J; c_TipoDeServ 2026: 01-03 ISR 2.1%, 04 hospedaje 4%, 05-06 2.5%; persona moral 2.5%; IVA 50%'},
  '14': {t: 'Dividendos a personas físicas', imps: [['001', 0.10, '02']], ley: 'LISR art. 140 (10% adicional)'},
  '25': {t: 'RESICO persona física (servicios)', imps: [['001', 0.0125, '05'], ['002', 0.106667, '01']], ley: 'LISR art. 113-J'}
};
function newRet() { const d = new Date(); return {cve: '01', desc: '', rfc: '', nombre: '', cp: '', nac: 'Nacional', mesIni: pad(d.getMonth() + 1), mesFin: pad(d.getMonth() + 1), ejercicio: String(d.getFullYear()), montoOp: '', montoExent: '0', auto: true, imps: []}; }
function recalcRet(R) { if (!R.auto) return; const p = RET_PRESETS[R.cve]; const base = r2(num(R.montoOp) - num(R.montoExent)); R.imps = p ? p.imps.map(([imp, t, tp]) => ({imp, base: f2(base), monto: f2(r2(base * t)), tipo: tp})) : R.imps; }
VIEWS.retenciones = () => {
  const R = S.ret || (S.ret = newRet());
  const p = RET_PRESETS[R.cve];
  return `<header class="ph"><div><p class="eyebrow">CFDI de retenciones e información de pagos 2.0</p><h1>Constancia de retenciones</h1></div></header>
  <div class="editor"><div class="ecol">
  <section class="card"><h2><span class="n">1</span>¿Qué retuviste?</h2>
  <div class="quick small">${Object.entries(RET_PRESETS).map(([k, v]) => `<button class="qcard ${R.cve === k ? 'on' : ''}" data-a="retPreset" data-k="${k}"><b>${esc(v.t)}</b><em>${v.imps.map(i => (i[0] === '001' ? 'ISR ' : 'IVA ') + r2(i[1] * 100) + '%').join(' + ')}</em></button>`).join('')}</div>
  <div class="grid3">${F('Clave de retención', `<select id="r_cve" data-rt="cve" data-r="1">${opts(CAT.cveRetenc, R.cve)}</select>`, 'span2')}
  ${R.cve === '25' ? F('Descripción de la retención', `<input id="r_desc" data-rt="desc" value="${esc(R.desc)}">`) : ''}</div>
  ${p ? `<p class="muted small">Fundamento: ${esc(p.ley)}</p>` : ''}
  ${R.cve === '26' ? '<p class="note">Desde 2026 las plataformas retienen ISR 2.5% también a personas morales; si el vendedor no da su RFC, la retención es ISR 20% e IVA 100%. Puede requerir el complemento de servicios de plataformas tecnológicas.</p>' : ''}
  </section>
  <section class="card"><h2><span class="n">2</span>¿A quién le retuviste?</h2>
  ${S.clientes.length ? `<div class="fld"><label for="rcli">Elegir de mis contactos</label><select id="rcli" data-a2="retCli">${opts(S.clientes.map(c => [c.id, c.rfc + ' · ' + c.nombre]), '', false, 'Selecciona…')}</select></div>` : ''}
  <div class="grid3">${F('RFC', `<input id="r_rfc" data-rt="rfc" value="${esc(R.rfc)}" class="mono up" maxlength="13">`)}${F('Nombre o razón social', `<input id="r_nombre" data-rt="nombre" value="${esc(R.nombre)}" class="up">`, 'span2')}${F('CP del domicilio fiscal', `<input id="r_cp" data-rt="cp" value="${esc(R.cp)}" class="mono" maxlength="5">`)}</div></section>
  <section class="card"><h2><span class="n">3</span>Periodo y montos</h2><div class="grid4">
    ${F('Mes inicial', `<select id="r_mi" data-rt="mesIni">${opts(CAT.meses.slice(0, 12), R.mesIni, false)}</select>`)}${F('Mes final', `<select id="r_mf" data-rt="mesFin">${opts(CAT.meses.slice(0, 12), R.mesFin, false)}</select>`)}
    ${F('Ejercicio', `<input id="r_ej" data-rt="ejercicio" value="${esc(R.ejercicio)}" class="mono" maxlength="4">`)}<div></div>
    ${F('Monto total de la operación', `<input id="r_mo" data-rt="montoOp" value="${esc(R.montoOp)}" class="mono" inputmode="decimal">`)}${F('Monto exento', `<input id="r_me" data-rt="montoExent" value="${esc(R.montoExent)}" class="mono" inputmode="decimal">`)}
  </div>
  <h3 class="sub">Impuestos retenidos ${R.auto ? chip('Cálculo automático', 'ok') : chip('Captura manual')}</h3>
  <div class="tw"><table><thead><tr><th>Impuesto</th><th class="n">Base</th><th class="n">Monto retenido</th><th>Tipo de pago</th><th></th></tr></thead><tbody id="rimps">${retImpsHTML(R)}</tbody></table></div>
  <div class="row wrap"><button class="btn ghost sm" data-a="retAdd">Agregar impuesto</button>${R.auto ? '<button class="btn ghost sm" data-a="retManual">Editar a mano</button>' : '<button class="btn ghost sm" data-a="retAuto">Volver al cálculo automático</button>'}</div>
  </section></div><aside class="eside"><div class="sticky" id="rside">${retSide()}</div></aside></div>`;
};
function retImpsHTML(R) { return R.imps.map((m, i) => `<tr><td><select data-ri="${i}.imp" ${R.auto ? 'disabled' : ''} aria-label="Impuesto">${opts(CAT.impuesto, m.imp, false)}</select></td><td class="n"><input class="mono num" data-ri="${i}.base" value="${esc(m.base)}" ${R.auto ? 'disabled' : ''} aria-label="Base"></td><td class="n"><input class="mono num" data-ri="${i}.monto" value="${esc(m.monto)}" ${R.auto ? 'disabled' : ''} aria-label="Monto"></td><td><select data-ri="${i}.tipo" aria-label="Tipo de pago">${opts(CAT.tipoPagoRet, m.tipo, true)}</select></td><td>${R.auto ? '' : `<button class="x" data-a="retDel" data-i="${i}" aria-label="Quitar">×</button>`}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Captura el monto de la operación para calcular.</td></tr>'; }
function validarRet(R) {
  const E = []; const em = EM();
  if (!rfcTipo(R.rfc) || rfcTipo(R.rfc) === 'PG') E.push('RFC del receptor inválido.');
  if (!R.nombre.trim()) E.push('Escribe el nombre del receptor.');
  if (!/^\d{5}$/.test(R.cp)) E.push('CP del receptor de 5 dígitos.');
  if (num(R.mesIni) > num(R.mesFin)) E.push('El mes inicial no puede ser posterior al final.');
  if (!(num(R.ejercicio) >= 2019 && num(R.ejercicio) <= new Date().getFullYear())) E.push('Ejercicio inválido.');
  if (!(num(R.montoOp) > 0)) E.push('Captura el monto de la operación.');
  if (num(R.montoExent) > num(R.montoOp)) E.push('El monto exento no puede superar la operación.');
  if (!R.imps.length) E.push('Agrega al menos un impuesto retenido.');
  R.imps.forEach((m, i) => { if (num(m.monto) > num(m.base) && num(m.base) > 0) E.push(`Impuesto ${i + 1}: el monto retenido supera la base.`); });
  if (R.cve === '25' && !R.desc.trim()) E.push('Con clave 25 describe el tipo de retención.');
  if (R.cve === '14' && rfcTipo(R.rfc) === 'M') E.push('La retención de 10% sobre dividendos aplica a personas físicas.');
  if (!em) E.push('Configura tu perfil de emisor.');
  return E;
}
function retSide() {
  const R = S.ret; if (!R) return ''; const E = validarRet(R), tot = r2(R.imps.reduce((a, m) => a + num(m.monto), 0));
  return `<div class="sumcard"><p class="eyebrow">Retenciones 2.0 · ${esc(lbl(CAT.cveRetenc, R.cve))}</p><dl class="tot"><div><dt>Operación</dt><dd>${money(num(R.montoOp))}</dd></div><div><dt>Gravado</dt><dd>${money(r2(num(R.montoOp) - num(R.montoExent)))}</dd></div><div class="grand"><dt>Total retenido</dt><dd>${money(tot)}</dd></div></dl></div>
  <div class="valid"><h3>${E.length ? 'Falta completar' : 'Listo para emitir'}</h3><ul>${E.map(e => `<li class="e"><span>${esc(e)}</span></li>`).join('')}</ul></div>
  <button class="btn block" data-a="reviewRet" ${E.length ? 'disabled' : ''}>Revisar y emitir</button>`;
}
async function emitirRet(R) {
  const em = EM(), fecha = nowLocal() + '-06:00', uuid = uid().toUpperCase(), folio = String((em.folios || {}).R || 1);
  const tot = r2(R.imps.reduce((a, m) => a + num(m.monto), 0)), grav = r2(num(R.montoOp) - num(R.montoExent));
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<retenciones:Retenciones xmlns:retenciones="http://www.sat.gob.mx/esquemas/retencionpago/2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sat.gob.mx/esquemas/retencionpago/2 http://www.sat.gob.mx/esquemas/retencionpago/2/retencionpagov2.xsd"${attrs({Version: '2.0', FolioInt: ((em.series || {}).R || 'R') + folio, Sello: 'DEMO', NoCertificado: em.csdNo || '00000000000000000000', Certificado: '', FechaExp: fecha, LugarExpRetenc: em.cp, CveRetenc: R.cve, DescRetenc: R.cve === '25' ? R.desc : ''})}>
  <retenciones:Emisor${attrs({RfcE: em.rfc, NomDenRazSocE: em.nombre, RegimenFiscalE: em.regimen})}/>
  <retenciones:Receptor NacionalidadR="Nacional">
    <retenciones:Nacional${attrs({RfcR: R.rfc.toUpperCase(), NomDenRazSocR: R.nombre.toUpperCase(), CurpR: R.curp || '', DomicilioFiscalR: R.cp})}/>
  </retenciones:Receptor>
  <retenciones:Periodo${attrs({MesIni: R.mesIni, MesFin: R.mesFin, Ejercicio: R.ejercicio})}/>
  <retenciones:Totales${attrs({MontoTotOperacion: f2(R.montoOp), MontoTotGrav: f2(grav), MontoTotExent: f2(R.montoExent), MontoTotRet: f2(tot)})}>
${R.imps.map(m => `    <retenciones:ImpRetenidos${attrs({BaseRet: f2(m.base), ImpuestoRet: m.imp, MontoRet: f2(m.monto), TipoPagoRet: m.tipo})}/>`).join('\n')}
  </retenciones:Totales>
  <retenciones:Complemento>
    <tfd:TimbreFiscalDigital xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" Version="1.1" UUID="${uuid}" FechaTimbrado="${nowLocal()}" RfcProvCertif="DEMO000000000" SelloCFD="DEMO" NoCertificadoSAT="00000000000000000000" SelloSAT="DEMO-SIN-VALIDEZ-FISCAL"/>
  </retenciones:Complemento>
</retenciones:Retenciones>\n`;
  const rec = await saveRec('cfdi', {emisorId: em.id, tipo: 'R', serie: (em.series || {}).R || 'R', folio, fecha: nowLocal(), uuid, estado: 'Vigente', receptor: {rfc: R.rfc.toUpperCase(), nombre: R.nombre.toUpperCase(), cp: R.cp, curp: R.curp || ''}, moneda: 'MXN', total: 0, totalRet: tot, cve: R.cve, periodo: `${R.mesIni}-${R.mesFin}/${R.ejercicio}`, xml});
  em.folios = em.folios || {}; em.folios.R = num(folio) + 1; await saveRec('emisor', em); return rec;
}

/* ============ CLIENTES, PRODUCTOS, FLOTA ============ */
const FIELDS = {
  cliente: () => [
    {k: 'rfc', l: 'RFC', req: 1, up: 1}, {k: 'nombre', l: 'Nombre o razón social (sin régimen societario)', req: 1, up: 1, wide: 1},
    {k: 'regimen', l: 'Régimen fiscal', t: 'select', o: CAT.regimen, req: 1, wide: 1}, {k: 'cp', l: 'Código postal fiscal', req: 1},
    {k: 'uso', l: 'Uso del CFDI habitual', t: 'select', o: CAT.uso.filter(u => !['CP01', 'CN01'].includes(u[0]))},
    {k: 'preset', l: 'Situación fiscal habitual', t: 'select', o: Object.entries(PRESETS).map(([k, p]) => [k, p.t]), code: false, wide: 1},
    {k: 'email', l: 'Correo para enviar facturas', t: 'email'}, {k: 'credito', l: 'Días de crédito', t: 'number'}],
  producto: () => [
    {k: 'clave', l: 'Clave SAT de producto o servicio', t: 'prodserv', req: 1}, {k: 'unidad', l: 'Clave de unidad', t: 'select', o: CAT.unidad, req: 1},
    {k: 'descripcion', l: 'Descripción', req: 1, wide: 1}, {k: 'precio', l: 'Precio unitario (sin IVA)', t: 'number', step: '0.01'}, {k: 'noIdent', l: 'SKU o número de identificación'},
    {k: 'objeto', l: 'Objeto de impuesto', t: 'select', o: CAT.objetoImp.slice(0, 5)}, {k: 'iva', l: 'IVA', t: 'select', o: IVA_O, code: false, empty: 'Según situación fiscal'}],
  vehiculo: () => [
    {k: 'alias', l: 'Nombre corto', req: 1, ph: 'Tracto 07'}, {k: 'config', l: 'Configuración vehicular', t: 'select', o: CAT.configVeh, req: 1, wide: 1},
    {k: 'placa', l: 'Placa', req: 1, up: 1}, {k: 'anio', l: 'Año modelo', req: 1}, {k: 'pesoVeh', l: 'Peso bruto vehicular (t)', req: 1},
    {k: 'perm', l: 'Permiso SCT', t: 'select', o: CAT.permSCT, req: 1, wide: 1}, {k: 'numPerm', l: 'Número de permiso', req: 1, up: 1},
    {k: 'aseg', l: 'Aseguradora resp. civil', req: 1}, {k: 'poliza', l: 'Póliza', req: 1, up: 1},
    {k: 'remSub', l: 'Remolque (si aplica)', t: 'select', o: CAT.subTipoRem, empty: 'Sin remolque'}, {k: 'remPlaca', l: 'Placa del remolque', up: 1}],
  operador: () => [{k: 'nombre', l: 'Nombre completo', req: 1, up: 1, wide: 1}, {k: 'rfc', l: 'RFC', req: 1, up: 1}, {k: 'licencia', l: 'Número de licencia federal', req: 1, up: 1}],
  ubicacion: () => [{k: 'alias', l: 'Nombre corto', req: 1, ph: 'CEDIS Apodaca'}, {k: 'rfc', l: 'RFC del remitente o destinatario', req: 1, up: 1}, {k: 'nombre', l: 'Nombre', req: 1, up: 1, wide: 1},
    {k: 'cp', l: 'Código postal', req: 1}, {k: 'estado', l: 'Estado', t: 'select', o: CAT.estados, code: false, req: 1}, {k: 'municipio', l: 'Municipio'}, {k: 'calle', l: 'Calle y número'}]
};
function checkRec(coll, o) {
  if ('rfc' in o && !rfcTipo(o.rfc)) return {error: 'El RFC no tiene un formato válido (12 caracteres persona moral, 13 persona física).'};
  if ('cp' in o && o.cp && !/^\d{5}$/.test(o.cp)) return {error: 'El código postal debe tener 5 dígitos.'};
  if (coll === 'cliente') { const r = CAT.regimen.find(x => x[0] === o.regimen), t = rfcTipo(o.rfc); if (r && (t === 'F' || t === 'M') && !r[2].includes(t)) return {error: `El régimen ${o.regimen} no corresponde a una persona ${t === 'F' ? 'física' : 'moral'}.`}; if (SOCIETARIO.test(o.nombre)) return {error: 'Quita el régimen societario del nombre (S.A. de C.V., etc.), como pide el CFDI 4.0.'}; }
  if (coll === 'producto' && !/^\d{8}$/.test(o.clave)) return {error: 'La clave SAT debe tener 8 dígitos.'};
  if (coll === 'vehiculo') { if (!/^[A-Z0-9]{5,7}$/.test(o.placa)) return {error: 'Placa de 5 a 7 letras o números, sin guiones.'}; if (!/^(19|20)\d{2}$/.test(o.anio)) return {error: 'Año de modelo inválido.'}; }
  return null;
}
function editRec(coll, id, title) { const r = id ? S[COLL[coll]].find(x => x.id === id) : {}; openForm(title, FIELDS[coll](), r || {}, async o => { const e = checkRec(coll, o); if (e) return e; await saveRec(coll, o); toast('Guardado.', 'ok'); }); }
function tablaRec(coll, cols, empty) {
  const rows = S[COLL[coll]];
  return rows.length ? `<div class="tw"><table><thead><tr>${cols.map(c => `<th>${c[1]}</th>`).join('')}<th></th></tr></thead><tbody>${rows.map(r => `<tr>${cols.map(c => `<td class="${c[2] || ''}">${esc(typeof c[0] === 'function' ? c[0](r) : r[c[0]])}</td>`).join('')}<td class="acts"><button class="btn sm ghost" data-a="edit" data-c="${coll}" data-id="${r.id}">Editar</button><button class="btn sm ghost" data-a="del" data-c="${coll}" data-id="${r.id}">Borrar</button></td></tr>`).join('')}</tbody></table></div>` : `<p class="empty">${empty}</p>`;
}
VIEWS.clientes = () => `<header class="ph"><div><p class="eyebrow">Base de datos de receptores</p><h1>Clientes</h1></div><button class="btn" data-a="edit" data-c="cliente">Agregar cliente</button></header>
  <p class="muted">Guarda los datos tal como aparecen en la Constancia de Situación Fiscal de cada cliente. Al facturar, se llenan solos y se aplica su situación fiscal habitual.</p>
  ${tablaRec('cliente', [['rfc', 'RFC', 'mono'], ['nombre', 'Nombre'], [r => r.regimen + ' · ' + lbl(CAT.regimen, r.regimen), 'Régimen'], ['cp', 'CP', 'mono'], [r => r.preset ? PRESETS[r.preset].t : '', 'Situación habitual']], 'Aún no tienes clientes. Agrega uno o guárdalo al emitir tu primera factura.')}`;
VIEWS.productos = () => `<header class="ph"><div><p class="eyebrow">Catálogo propio y catálogo SAT</p><h1>Productos y catálogo</h1></div><button class="btn" data-a="edit" data-c="producto">Agregar producto</button></header>
  ${tablaRec('producto', [['clave', 'Clave SAT', 'mono'], ['descripcion', 'Descripción'], ['unidad', 'Unidad', 'mono'], [r => money(num(r.precio)), 'Precio', 'n']], 'Registra los productos o servicios que facturas seguido y agrégalos a una factura con un clic.')}
  <section class="block"><div class="bh"><h2>Catálogo c_ClaveProdServ</h2><button class="btn ghost sm" data-a="openCat">Buscar en el catálogo</button></div>
  <p class="muted">Incluimos ${PRODSERV.length} claves frecuentes. Para tener las más de 50 mil claves vigentes en 2026, descarga el catálogo de CFDI 4.0 desde el portal del SAT, guarda la hoja c_ClaveProdServ como CSV e impórtala aquí. Se guarda en tu base de datos.</p>
  <div class="row wrap"><label class="btn ghost" for="catfile">Importar catálogo oficial (CSV)</label><input type="file" id="catfile" accept=".csv,.txt" hidden data-a2="importCat">
  ${S.catImport.length ? `${chip(S.catImport.length.toLocaleString('es-MX') + ' claves importadas', 'ok')}<button class="btn sm ghost" data-a="clearCat">Quitar catálogo importado</button>` : ''}</div></section>`;
VIEWS.flota = () => `<header class="ph"><div><p class="eyebrow">Base de datos para Carta Porte</p><h1>Flota y rutas</h1></div><button class="btn" data-a="go" data-v="cartaporte">Nueva Carta Porte</button></header>
  <section class="block"><div class="bh"><h2>Vehículos</h2><button class="btn ghost sm" data-a="edit" data-c="vehiculo">Agregar vehículo</button></div>${tablaRec('vehiculo', [['alias', 'Vehículo'], ['config', 'Config.', 'mono'], ['placa', 'Placa', 'mono'], ['perm', 'Permiso', 'mono'], ['poliza', 'Póliza', 'mono']], 'Registra tractos y camiones con su permiso SCT y seguro para no capturarlos en cada viaje.')}</section>
  <section class="block"><div class="bh"><h2>Operadores</h2><button class="btn ghost sm" data-a="edit" data-c="operador">Agregar operador</button></div>${tablaRec('operador', [['nombre', 'Nombre'], ['rfc', 'RFC', 'mono'], ['licencia', 'Licencia', 'mono']], 'Agrega a tus operadores con su licencia federal.')}</section>
  <section class="block"><div class="bh"><h2>Ubicaciones frecuentes</h2><button class="btn ghost sm" data-a="edit" data-c="ubicacion">Agregar ubicación</button></div>${tablaRec('ubicacion', [['alias', 'Lugar'], ['rfc', 'RFC', 'mono'], ['cp', 'CP', 'mono'], [r => lbl(CAT.estados, r.estado), 'Estado']], 'Guarda bodegas, plantas y clientes a los que entregas.')}</section>`;

/* ============ GUÍA ============ */
VIEWS.guia = () => `<header class="ph"><div><p class="eyebrow">Marco legal vigente en 2026</p><h1>Guía y fundamentos</h1></div><button class="btn ghost" data-a="traductor">Traducir un error del PAC</button></header>
  <section class="block"><h2>¿Qué comprobante necesito?</h2><div class="quick">${QUICK.map((q, i) => `<button class="qcard" data-a="quick" data-i="${i}"><b>${q[0]}</b><span>${q[1]}</span></button>`).join('')}</div></section>
  <section class="block"><h2>Reglas que el sistema revisa por ti</h2><div class="tw"><table class="legal"><thead><tr><th>Tema</th><th>Regla</th><th>Fundamento</th></tr></thead><tbody>
  ${[
    ['Requisitos del CFDI', 'RFC, nombre, régimen y CP del receptor deben coincidir con su Constancia de Situación Fiscal; nombre sin régimen societario.', 'CFF arts. 29 y 29-A; Anexo 20 (actualizado 1/1/2026)'],
    ['PUE / PPD', 'PPD obliga a forma de pago 99 y a emitir complemento de pago por cada cobro, a más tardar el día 5 del mes siguiente.', 'CFF art. 29 fr. VI; RMF 2026'],
    ['Retención IVA 2/3', 'Personas morales que reciben servicios profesionales o arrendamiento de personas físicas retienen 10.6667%.', 'LIVA art. 1-A fr. II a); RLIVA art. 3'],
    ['Retención ISR 10%', 'Honorarios y arrendamiento de personas físicas pagados por personas morales.', 'LISR arts. 106 y 116'],
    ['RESICO', 'Personas morales retienen 1.25% de ISR a personas físicas en RESICO.', 'LISR art. 113-J'],
    ['Fletes', 'Retención de IVA 4% en autotransporte terrestre de bienes.', 'LIVA art. 1-A fr. II c)'],
    ['Personal a disposición', 'Retención de IVA 6% cuando el personal queda bajo dirección del cliente.', 'LIVA art. 1-A fr. IV'],
    ['Plataformas digitales 2026', 'Retención ISR 2.5% a personas físicas y morales que venden por plataformas; IVA 50%. Sin RFC: ISR 20%, IVA 100%.', 'LIF 2026; LISR 113-A; LIVA 18-J'],
    ['IVA región fronteriza', 'IVA 8% solo para contribuyentes inscritos en el padrón, vigente hasta el 31/12/2026.', 'Decreto de estímulos fiscales, DOF 31/12/2025'],
    ['IEPS 2026', 'Bebidas azucaradas $3.0818/L, con edulcorantes $1.50/L, tabacos 200%, apuestas 50%, videojuegos violentos 8%.', 'LIEPS art. 2, reforma 2026'],
    ['Efectivo', 'Pagos de más de $2,000 en efectivo y combustible pagado en efectivo no son deducibles para quien compra.', 'LISR art. 27 fr. III'],
    ['Carta Porte 3.1', 'Obligatoria para el traslado de bienes en tramos federales; requiere ruta, mercancías, vehículo, seguro y operador.', 'CFF art. 29; RMF 2026; Complemento Carta Porte 3.1'],
    ['Cancelación', 'Se cancela hasta la fecha límite de la declaración anual del ejercicio de emisión (PM 31 de marzo, PF 30 de abril) con motivo 01 a 04.', 'CFF art. 29-A, reforma 2026'],
    ['Factura global', 'Solo a XAXX010101000, régimen 616, uso S01, clave 01010101 y unidad ACT, con periodicidad, mes y año.', 'Anexo 20; Guía de llenado'],
    ['CFDI de retenciones', 'Constancia con clave de retención, periodo, montos y tipo de pago de cada impuesto.', 'LISR; RMF 2026; Retenciones 2.0']
  ].map(r => `<tr><td><b>${r[0]}</b></td><td>${r[1]}</td><td class="small">${r[2]}</td></tr>`).join('')}</tbody></table></div>
  <p class="muted small">Las tasas y reglas se tomaron de la Ley de Ingresos 2026, la reforma fiscal 2026, la RMF 2026 (DOF 28/12/2025) y el Anexo 20 vigente. Confirma casos particulares con tu contador.</p></section>
  <section class="block"><h2>Calendario de cumplimiento</h2><ul class="cal"><li><b>Día 5</b><span>Último día para emitir complementos de pago de cobros del mes anterior.</span></li><li><b>Día 17</b><span>Pago provisional de ISR, IVA y retenciones del mes anterior.</span></li><li><b>31 de marzo</b><span>Declaración anual de personas morales y último día para cancelar sus CFDI del año anterior.</span></li><li><b>30 de abril</b><span>Declaración anual de personas físicas y último día para cancelar sus CFDI del año anterior.</span></li><li><b>Cada 4 años</b><span>Renovación del certificado de sello digital (CSD).</span></li></ul></section>`;

/* ============ PERFIL FISCAL ============ */
const EM_FIELDS = () => [
  {k: 'rfc', l: 'RFC', req: 1, up: 1}, {k: 'nombre', l: 'Nombre o razón social (sin régimen societario)', req: 1, up: 1, wide: 1},
  {k: 'regimen', l: 'Régimen fiscal', t: 'select', o: CAT.regimen, req: 1, wide: 1}, {k: 'cp', l: 'CP de expedición', req: 1},
  {k: 'csdNo', l: 'Número de certificado (CSD)', hint: '20 dígitos, viene en tu archivo .cer'}, {k: 'csdVence', l: 'Vigencia del CSD', t: 'date'},
  {k: 'serieI', l: 'Serie para facturas', ph: 'A'}, {k: 'serieP', l: 'Serie para pagos', ph: 'P'},
  {k: 'frontera', l: 'Estoy inscrito en el padrón de beneficiarios de la región fronteriza (IVA 8%)', t: 'check', wide: 1}
];
VIEWS.perfil = () => `<header class="ph"><div><p class="eyebrow">Cuenta de ${esc(S.user.email)}</p><h1>Perfil fiscal</h1></div><button class="btn" data-a="addEm">Agregar emisor</button></header>
  ${!S.emisores.length ? '<div class="alert info"><span>Para empezar, agrega los datos fiscales de quien emite las facturas. Si eres contador, agrega un emisor por cada cliente que atiendes y cambia entre ellos desde el menú.</span></div>' : ''}
  <div class="emgrid">${S.emisores.map(e => `<article class="emcard${EM() && e.id === EM().id ? ' on' : ''}"><p class="eyebrow mono">${esc(e.rfc)}</p><h3>${esc(e.nombre)}</h3><p class="small">Régimen ${esc(e.regimen)} · ${esc(lbl(CAT.regimen, e.regimen))}<br>CP ${esc(e.cp)}${e.frontera ? ' · IVA 8% frontera' : ''}</p>
  <p class="small">${e.csdNo ? `CSD <span class="mono">${esc(e.csdNo)}</span>${e.csdVence ? ' · vence ' + fmtDate(e.csdVence) : ''}` : chip('Sin CSD registrado', 'warn')}</p>
  <div class="row wrap"><button class="btn sm ghost" data-a="editEm" data-id="${e.id}">Editar</button>${EM() && e.id !== EM().id ? `<button class="btn sm ghost" data-a="useEm" data-id="${e.id}">Usar este emisor</button>` : ''}</div></article>`).join('')}</div>
  ${EM() ? pdfCustomHTML() : ''}
  <section class="block"><h2>Timbrado ante el SAT</h2><p>Este sistema arma el XML con la estructura del Anexo 20 y revisa las reglas fiscales antes de emitir. Para que un CFDI tenga validez, un Proveedor de Certificación (PAC) autorizado debe sellarlo con tu CSD (.cer y .key) y timbrarlo. En esta versión el timbre es de demostración: el folio fiscal se genera aquí y lleva la marca DEMO.</p></section>
  <section class="block"><h2>Tus datos</h2><p class="muted">${Store.adapter !== Store.primary ? 'La cuenta de ejemplo se guarda solo en este navegador.' : Store.mode === 'db' ? 'Se guardan en una base de datos privada ligada a tu cuenta de Claude: solo tú los ves.' : `Se guardan en ${esc(Store.label)}.`}</p>
  <div class="row wrap"><button class="btn ghost" data-a="backup">Descargar respaldo (JSON)</button><button class="btn ghost" data-a="logout">Cerrar sesión</button></div></section>`;
function editEm(id) {
  const e = id ? S.emisores.find(x => x.id === id) : {};
  const v = Object.assign({}, e, {serieI: (e.series || {}).I || 'A', serieP: (e.series || {}).P || 'P'});
  openForm(id ? 'Editar emisor' : 'Nuevo emisor', EM_FIELDS(), v, async o => {
    const t = rfcTipo(o.rfc); if (!t || t === 'PG' || t === 'EXT') return {error: 'El RFC no tiene un formato válido.'};
    if (!/^\d{5}$/.test(o.cp)) return {error: 'El CP debe tener 5 dígitos.'};
    const r = CAT.regimen.find(x => x[0] === o.regimen); if (r && !r[2].includes(t)) return {error: `El régimen ${o.regimen} no aplica a personas ${t === 'F' ? 'físicas' : 'morales'}.`};
    if (SOCIETARIO.test(o.nombre)) return {error: 'Quita el régimen societario del nombre (S.A. de C.V., etc.).'};
    if (o.csdNo && !/^\d{20}$/.test(o.csdNo)) return {error: 'El número de certificado tiene 20 dígitos.'};
    o.series = Object.assign({I: 'A', E: 'NC', T: 'T', P: 'P', R: 'R'}, e.series || {}, {I: o.serieI || 'A', P: o.serieP || 'P'}); delete o.serieI; delete o.serieP;
    o.folios = e.folios || {}; const saved = await saveRec('emisor', o);
    if (!S.user.activeEmisor || !id) { S.user.activeEmisor = saved.id; await saveUser(); }
    toast('Perfil fiscal guardado.', 'ok'); if (!id && S.emisores.length === 1) S.view = 'inicio';
  }, 'Copia los datos de tu Constancia de Situación Fiscal.');
}

/* ============ PERSONALIZACIÓN DEL PDF ============ */
const PDF_PALETTES = [['#24365c', '#eef1f6', 'Azul institucional'], ['#1f5c4a', '#eaf3ef', 'Verde'], ['#5b2333', '#f6edef', 'Vino'], ['#3a3f47', '#f0f1f3', 'Grafito'], ['#7a4b10', '#f7f0e6', 'Ocre']];
function pdfEdit() { const em = EM(); if (!S.pdfEd || S.pdfEd.id !== em.id) S.pdfEd = {id: em.id, st: Object.assign(clone(PDF_DEF), clone(em.pdf || {}), {card: Object.assign({}, (em.pdf || {}).card || {})}), imgs: Object.assign({}, S.pdfimg[em.id] || {}), dirty: false}; return S.pdfEd; }
function pdfCustomHTML() {
  const E = pdfEdit(), st = E.st, c = st.card || {};
  return `<section class="block"><div class="bh"><h2>Diseño del PDF de tus CFDI</h2>${E.dirty ? chip('Cambios sin guardar', 'warn') : ''}</div>
  <p class="muted">Personaliza colores, logotipo, tarjeta de presentación y un sello o imagen. La estructura y el orden de la información fiscal no se pueden modificar: siguen el formato de la representación impresa del SAT.</p>
  <div class="pdfcfg"><div class="card">
    <div class="fld"><label>Paleta</label><div class="row wrap">${PDF_PALETTES.map(p => `<button class="swatch${st.primary === p[0] ? ' on' : ''}" data-a="pdfPal" data-p="${p[0]}" data-s="${p[1]}" title="${p[2]}" aria-label="Paleta ${p[2]}" style="--sw:${p[0]};--sw2:${p[1]}"></button>`).join('')}</div></div>
    <div class="grid2"><div class="fld"><label for="pdf_primary">Color principal</label><input type="color" id="pdf_primary" data-pdf="primary" value="${esc(st.primary)}"></div><div class="fld"><label for="pdf_secondary">Color de fondo de tablas</label><input type="color" id="pdf_secondary" data-pdf="secondary" value="${esc(st.secondary)}"></div></div>
    <div class="grid2"><div class="fld"><label>Logotipo</label><div class="row wrap"><label class="btn ghost sm" for="pdflogo">${E.imgs.logo ? 'Cambiar logo' : 'Subir logo'}</label><input type="file" id="pdflogo" accept="image/png,image/jpeg,image/webp,image/svg+xml" data-a2="pdfImg" data-slot="logo" hidden>${E.imgs.logo ? '<button class="btn sm ghost" data-a="pdfQuitar" data-slot="logo">Quitar</button>' : ''}</div><small>PNG con fondo transparente se ve mejor.</small></div>
    <div class="fld"><label>Sello o imagen adicional</label><div class="row wrap"><label class="btn ghost sm" for="pdfstamp">${E.imgs.stamp ? 'Cambiar imagen' : 'Subir imagen'}</label><input type="file" id="pdfstamp" accept="image/png,image/jpeg,image/webp,image/svg+xml" data-a2="pdfImg" data-slot="stamp" hidden>${E.imgs.stamp ? '<button class="btn sm ghost" data-a="pdfQuitar" data-slot="stamp">Quitar</button>' : ''}</div><small>Aparece junto al importe con letra.</small></div></div>
    ${E.imgs.stamp ? `<div class="fld"><label for="pdf_op">Opacidad del sello: ${Math.round((st.stampOpacity ?? 0.9) * 100)}%</label><input type="range" id="pdf_op" min="0.2" max="1" step="0.05" data-pdf="stampOpacity" value="${st.stampOpacity ?? 0.9}"></div>` : ''}
    <h3 class="sub">Tarjeta de presentación</h3>
    <div class="grid2">${[['direccion', 'Dirección', 'Av. Constitución 400 Pte., Centro, Monterrey, N.L.'], ['telefono', 'Teléfono', '81 8000 0000'], ['email', 'Correo', 'facturacion@empresa.mx'], ['web', 'Sitio web', 'www.empresa.mx'], ['leyenda', 'Mensaje breve', 'Gracias por su preferencia']].map(([k, l, ph]) => `<div class="fld${k === 'direccion' || k === 'leyenda' ? ' wide' : ''}"><label for="pdfc_${k}">${l}</label><input id="pdfc_${k}" data-pdfc="${k}" value="${esc(c[k] || '')}" placeholder="${esc(ph)}" maxlength="${k === 'direccion' ? 140 : 80}"></div>`).join('')}</div>
    <div class="row wrap"><button class="btn" data-a="pdfSave">Guardar diseño</button><button class="btn ghost" data-a="pdfDemo">Usar logo y sello de muestra</button><button class="btn ghost" data-a="pdfReset">Restablecer</button></div>
  </div><div class="pdfprev"><p class="eyebrow">Vista previa</p><div id="pdfprev" class="pdfpages"><p class="muted">Generando…</p></div></div></div></section>`;
}
function muestraRec() {
  const em = EM(), last = S.cfdis.filter(c => c.emisorId === em.id && c.tipo === 'I').sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
  if (last) return last;
  const d = newDraft('I'); Object.assign(d.receptor, {rfc: 'XIA190128J61', nombre: 'XENON INDUSTRIAL ARTICLES', regimen: '601', cp: '76343', uso: 'G03'});
  d.conceptos = [Object.assign(newConcepto(), {clave: '80101504', unidad: 'E48', cantidad: '10', descripcion: 'Consultoría en planeación estratégica (hora)', vu: '1850'}), Object.assign(newConcepto(), {clave: '84111502', unidad: 'E48', cantidad: '1', descripcion: 'Contabilidad financiera mensual', vu: '9500'})];
  d.fecha = nowLocal(); return {emisorId: em.id, xml: xmlCFDI(d, em, calcDoc(d), {tfd: {uuid: '5FB2822E-396D-4725-8521-CDC4BDD20CCF', fecha: d.fecha}})};
}
let pdfPrevT;
function pdfPreview() {
  clearTimeout(pdfPrevT);
  pdfPrevT = setTimeout(async () => { const box = $('#pdfprev'); if (!box) return; const E = pdfEdit(), tok = S._prevTok = Symbol('prev'); try { const P = await renderRec(muestraRec(), new CanvasPainter(1.3), {st: E.st, imgs: E.imgs}); if (!$('#pdfprev') || S._prevTok !== tok || box !== $('#pdfprev')) return; box.innerHTML = ''; P.pages[0].className = 'pdfpage'; box.appendChild(P.pages[0]); } catch (e) { box.innerHTML = `<p class="ferr">${esc(e.message)}</p>`; } }, 120);
}
function muestraImg(kind) {
  const cv = document.createElement('canvas'), x = cv.getContext('2d'), em = EM(), col = pdfEdit().st.primary;
  if (kind === 'logo') { cv.width = 320; cv.height = 180; x.fillStyle = col; x.beginPath(); x.arc(90, 90, 70, 0, Math.PI * 2); x.fill(); x.fillStyle = '#fff'; x.font = 'bold 64px Arial'; x.textAlign = 'center'; x.fillText((em.nombre.match(/\b\w/g) || ['E']).slice(0, 2).join(''), 90, 112); x.fillStyle = col; x.textAlign = 'left'; const w0 = em.nombre.split(' ')[0].slice(0, 12); let fs = 34; x.font = `bold ${fs}px Arial`; while (x.measureText(w0).width > 140 && fs > 14) { fs--; x.font = `bold ${fs}px Arial`; } x.fillText(w0, 172, 84); x.font = '22px Arial'; x.fillText('Servicios', 174, 114); }
  else { cv.width = 260; cv.height = 260; x.strokeStyle = '#1f6f4a'; x.fillStyle = '#1f6f4a'; x.lineWidth = 8; x.beginPath(); x.arc(130, 130, 118, 0, Math.PI * 2); x.stroke(); x.lineWidth = 3; x.beginPath(); x.arc(130, 130, 100, 0, Math.PI * 2); x.stroke(); x.font = 'bold 40px Arial'; x.textAlign = 'center'; x.fillText('REVISADO', 130, 128); x.font = 'bold 22px Arial'; x.fillText('CONTABILIDAD', 130, 160); x.font = '18px Arial'; x.fillText(nowLocal().slice(0, 10), 130, 190); }
  return {png: cv.toDataURL('image/png'), w: cv.width, h: cv.height};
}
