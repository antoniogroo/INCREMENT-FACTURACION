/* ============ ACCIONES: series, folios y estatus SAT ============ */
const _loginF = login;
login = async function (id, u, keep) { await folLoad(id); return _loginF(id, u, keep); };
const _logoutF = logout;
logout = function () { S.folReg = {}; S.satProg = null; _logoutF(); };

/* Emisión: folio libre, reservas, sustitución con aceptación y verificación SAT inmediata */
const _emitirDraftF = emitirDraft;
emitirDraft = async function (d, o = {}) {
  if (d._simFalla) throw Object.assign(new Error('CFDI40102 - El resultado de la digestión debe ser igual al resultado de la desencripción del sello (rechazo simulado del PAC).'), {code: 'CFDI40102'});
  if (['I', 'E', 'T'].includes(d.tipo) && (!String(d.folio ?? '').trim() || folioUsado(d.serie, d.folio))) d.folio = String(nextFree(d.serie));
  const rec = await _emitirDraftF(d, o);
  const em = EM(), R = folReg(em.id), k = serieKey(rec.serie), n = folioNum(rec.folio);
  if (R.reservas[k]) R.reservas[k] = R.reservas[k].filter(x => x.folio !== n);
  if (R.libres[k]) R.libres[k] = R.libres[k].filter(x => x !== n);
  folSave(em.id);
  if (d.sustituye) {
    const og = S.cfdis.find(x => x.id === d.sustituye);
    if (og && og.cancel && og.cancel.auto) {
      if (!motivoSinAceptacion(og)) {
        og.estado = 'Vigente'; og.saldo = saldoVivo(og); og.cancel = Object.assign(og.cancel, {est: 'En proceso', limite: sumarDiasHabiles(new Date(), 3).toISOString()});
        const s = rec.sustituyo; delete rec.sustituyo; setTimeout(() => toast(`La cancelación de ${s} requiere aceptación del receptor: quedó en proceso (3 días hábiles en su Buzón Tributario).`, 'warn'), 50);
      } else og.cancel.est = 'Cancelado sin aceptación';
      await satVerificar(og);
    }
  }
  rec.sat = satConsulta(rec); await saveRec('cfdi', rec);
  return rec;
};
const _emitirPagoF = emitirPago;
emitirPago = async function (P) { const rec = await _emitirPagoF(P); rec.sat = satConsulta(rec); await saveRec('cfdi', rec); return rec; };
const _emitirRetF2 = emitirRet;
emitirRet = async function (R) { const rec = await _emitirRetF2(R); rec.sat = satConsulta(rec); await saveRec('cfdi', rec); return rec; };

/* Lote: guardar serie y folio de lo que falle para reservarlo o liberarlo */
const _emitirLoteF2 = emitirLote;
emitirLote = async function (onProg) {
  const pre = new Map((S.mas.dry ? S.mas.dry.docs : []).filter(d => d.ok && d.d).map(d => [d.key, {serie: d.d.serie, folio: d.d.folio, rows: d.rows}]));
  const r = await _emitirLoteF2(onProg);
  r.fails.forEach(f => { const p = pre.get(f.key); if (p) Object.assign(f, p); });
  return r;
};
function failsFolHTML(res) {
  const fs = res.fails.filter(f => f.folio); if (!fs.length) return '';
  return `<div class="foliofails"><p class="eyebrow">Folios de los documentos que no se timbraron</p>${fs.map(f => `<div class="alert warn"><span><b>${esc(f.key)}</b>: ${esc(f.m)} Su folio <b class="mono">${esc(fmtSF(f.serie, f.folio))}</b> quedó sin usar.</span><div class="row wrap"><button class="btn sm" data-a="folReservar" data-key="${esc(f.key)}" data-s="${esc(f.serie)}" data-f="${esc(f.folio)}">Reservar ${esc(fmtSF(f.serie, f.folio))} para corregirla</button><button class="btn sm ghost" data-a="folLiberar" data-key="${esc(f.key)}" data-s="${esc(f.serie)}" data-f="${esc(f.folio)}">Liberar y reajustar el consecutivo</button></div></div>`).join('')}</div>`;
}
const _doLoteF = A.doLote;

/* Cancelación con reglas de aceptación del SAT */
const _bloqueoF = bloqueoCancelacion;
bloqueoCancelacion = function (c) { const b = _bloqueoF(c); if (b) return b; const h = hijosVigentes(c); return h.length ? `No cancelable: ${h.map(x => `${x.tipo} ${x.folio}`).join(', ')} lo relaciona${h.length > 1 ? 'n' : ''} y sigue vigente. Cancela primero ese documento.` : ''; };
const _cancelarF = cancelar;
cancelar = function (id) {
  const c = S.cfdis.find(x => x.id === id); if (!c) return;
  if ((c.cancel || {}).est === 'En proceso') return abrirAcuse(id);
  const h = hijosVigentes(c).filter(x => !(c.pagos || []).some(p => p.uuid === x.uuid));
  if (h.length) { bitaLog({fuente: 'cancelacion', origen: `${c.serie}${c.folio}`, ref: c.uuid, code: 'NO_CANCELABLE', diag: bloqueoCancelacion(c), action: {kind: 'acuse', id: c.id}}); return openModal(`<header class="mh"><h3>No se puede cancelar ${esc(c.serie)}${esc(c.folio)}</h3><button class="x" data-a="close" aria-label="Cerrar">×</button></header><div class="alert bad"><span>${LOCK} ${esc(bloqueoCancelacion(c))}</span></div><p class="muted small">El SAT responde EsCancelable = “No cancelable” mientras existan CFDI relacionados vigentes.</p><footer class="mf"><button class="btn ghost" data-a="close">Entendido</button></footer>`); }
  _cancelarF(id);
  const note = $('#modal .note'); if (note) { const sa = motivoSinAceptacion(c); note.innerHTML = sa ? `<b>Cancelable sin aceptación</b> (RMF 2026, regla 2.7.1.35): ${esc(sa)}. Se cancela al momento.` : '<b>Cancelable con aceptación</b>: la solicitud queda <b>en proceso</b> y el receptor tiene 3 días hábiles para aceptarla o rechazarla en su Buzón Tributario; si no responde, procede por plazo vencido.'; }
};

Object.assign(A, {
  doCancel: async el => {
    const c = S.cfdis.find(x => x.id === el.dataset.id), mot = $('#cmot').value, sust = $('#csust') ? $('#csust').value : '';
    if (mot === '01' && !sust) { const e = $('#cerr'); e.hidden = false; e.textContent = 'Con motivo 01 selecciona el CFDI que lo sustituye.'; return; }
    const r = satConsulta(c);
    if (r.EsCancelable === 'No cancelable') { const e = $('#cerr'); e.hidden = false; e.textContent = bloqueoCancelacion(c); return; }
    el.disabled = true;
    if (r.EsCancelable === 'Cancelable sin aceptación') { c.cancel = {motivo: mot, sust, fecha: nowLocal(), sinAcept: r.motivoSinA}; await aplicarCancelacion(c, 'Cancelado sin aceptación'); }
    else { c.cancel = {motivo: mot, sust, fecha: nowLocal(), est: 'En proceso', limite: sumarDiasHabiles(new Date(), 3).toISOString()}; await saveRec('cfdi', c); }
    await satVerificar(c); closeModal(); render();
    toast(r.EsCancelable === 'Cancelable sin aceptación' ? `CFDI ${c.serie}${c.folio} cancelado con motivo ${mot}. Su folio queda bloqueado.` : `Solicitud de cancelación de ${c.serie}${c.folio} enviada: en proceso hasta que el receptor responda (3 días hábiles).`, 'ok');
  },
  doLote: async el => { await _doLoteF(el); const res = S.mas.result; if (res && res.fails && res.fails.length) { const mf = $('#modal .mf'); if (mf) mf.insertAdjacentHTML('beforebegin', failsFolHTML(res)); } },
  folReservar: el => {
    const em = EM(), R = folReg(em.id), k = serieKey(el.dataset.s), n = folioNum(el.dataset.f), key = el.dataset.key;
    if (n !== null) { R.reservas[k] = (R.reservas[k] || []).filter(x => x.folio !== n).concat([{folio: n, ref: key, ts: nowLocal()}]); folSave(em.id); }
    const row = (S.mas.rows.docs || []).find(r => String(r.ID_Documento || '').trim() === key); if (row) { row.Folio = el.dataset.f; runDry(); }
    bitaLog({fuente: 'folios', sev: 'warn', origen: `Lote · ${key}`, ref: fmtSF(el.dataset.s, el.dataset.f), code: 'FOLIO_RESERVADO', diag: `Folio ${fmtSF(el.dataset.s, el.dataset.f)} reservado para el documento ${key}: el consecutivo lo salta hasta que lo timbres.`, action: {kind: 'series'}});
    el.closest('.alert').innerHTML = `<span>${chip('Reservado', 'ok')} ${esc(fmtSF(el.dataset.s, el.dataset.f))} queda apartado para ${esc(key)}${row ? '; ya lo pusimos en su columna Folio' : ''}. Corrige el documento en la tabla y vuelve a timbrar.</span>`;
  },
  folLiberar: el => {
    const em = EM(), R = folReg(em.id), k = serieKey(el.dataset.s), n = folioNum(el.dataset.f);
    if (n !== null) { R.libres[k] = [...new Set((R.libres[k] || []).concat([n]))]; folSave(em.id); }
    el.closest('.alert').innerHTML = `<span>${chip('Liberado')} ${esc(fmtSF(el.dataset.s, el.dataset.f))} será el próximo folio que se asigne en la serie ${esc(k)}, para no dejar hueco.</span>`;
  },
  folioLote: el => {
    const [sec, i] = el.dataset.cell.split('|'), row = (S.mas.rows[sec] || []).find(r => r._i === +i); if (!row) return;
    const x = folioLoteSiguiente(el.dataset.cell); row.Folio = String(x.n); runDry(); closeModal(); render(); toast(`Folio reasignado a ${fmtSF(x.serie, x.n)}. Lote revalidado.`, 'ok');
  },
  bitaFolioDraft: () => { if (!S.draft) return toast('Ese borrador ya no está abierto.', 'warn'); FIXES.folioLibre.run(S.draft); S.view = S.draft.cp ? 'cartaporte' : 'factura'; closeModal(); render(); toast(`Folio ${fmtSF(S.draft.serie, S.draft.folio)} asignado.`, 'ok'); },
  serieNueva: () => serieNuevaModal(),
  serieGuardar: async () => {
    const s = $('#sn_s').value.trim().toUpperCase(), t = $('#sn_t').value, f = num($('#sn_f').value), err = $('#sn_err'), em = EM();
    if (!/^[A-Z0-9Ñ&-]{1,25}$/i.test(s)) { err.hidden = false; err.textContent = 'La serie admite hasta 25 letras o números.'; return; }
    if (!(f >= 1 && Number.isInteger(f))) { err.hidden = false; err.textContent = 'El folio inicial debe ser un número entero mayor a cero.'; return; }
    const R = folReg(em.id), k = serieKey(s); R.tipos[k] = t; if (f > 1 || !seriesInfo(em).get(k)) R.ajustes[k] = f;
    if ($('#sn_def').checked) { em.series = Object.assign({}, em.series || {}, {[t]: s}); await saveRec('emisor', em); }
    folSave(em.id); closeModal(); render(); toast(`Serie ${k} lista: el próximo folio es ${nextFree(s)}.`, 'ok');
  },
  folAjustar: el => {
    const em = EM(), k = el.dataset.k, v = num($('#' + el.dataset.in).value);
    if (!(v >= 1 && Number.isInteger(v))) return toast('Escribe un folio entero mayor a cero.', 'warn');
    folReg(em.id).ajustes[k] = v; folSave(em.id); const nf = nextFree(serieDe(k)); render();
    toast(nf !== v ? `El folio ${v} ya está usado o reservado: el próximo libre de ${k} es ${nf}.` : `Próximo folio de ${k}: ${v}.`, nf !== v ? 'warn' : 'ok');
  },
  folAjQuitar: el => { const em = EM(); delete folReg(em.id).ajustes[el.dataset.k]; folSave(em.id); render(); },
  folDefault: async el => { const em = EM(); em.series = Object.assign({}, em.series || {}, {[el.dataset.t]: serieDe(el.dataset.k)}); await saveRec('emisor', em); render(); toast(`Serie ${el.dataset.k} predeterminada para ${TIPO_TXT[el.dataset.t] || el.dataset.t}.`, 'ok'); },
  folQuitarXml: el => { const em = EM(), R = folReg(em.id), k = el.dataset.k; R.xml = R.xml.filter(x => serieKey(x[1]) !== k); delete R.tipos[k]; delete R.ajustes[k]; folSave(em.id); render(); toast(`Se quitaron los folios de XML de la serie ${k}.`); },
  acuse: el => abrirAcuse(el.dataset.id),
  satUno: async el => {
    const c = S.cfdis.find(x => x.id === el.dataset.id); if (!c) return; el.disabled = true; const t = el.textContent; el.textContent = 'Consultando…';
    await tick(300); const r = await satVerificar(c);
    if (el.dataset.modal) openModal(acuseHTML(c), true); else render();
    toast(`${c.serie}${c.folio}: ${r.Estado}${r.EsCancelable ? ' · ' + r.EsCancelable : ''}${r.ValidacionEFOS === '100' ? ' · ALERTA EFOS 69-B' : ''}`, satNivel(r) === 'vig' && r.ValidacionEFOS !== '100' ? 'ok' : 'warn');
    if (!el.dataset.modal && el.isConnected) { el.disabled = false; el.textContent = t; }
  },
  satSync: async el => {
    const rows = comprobantesFiltrados(); if (!rows.length) return; el.disabled = true;
    const P = S.satProg = {kind: 'sat', total: rows.length, done: 0, stage: 0, ok: 0, warn: 0, bad: 0, label: `${SAT_FUENTE}: ${rows.length} comprobantes del filtro actual.`, fin: false}; progDraw();
    const d = rows.length > 80 ? 4 : 18;
    for (const c of rows) { c._expr = expresionImpresa(c); P.done++; progDraw(); await tick(d); }
    P.stage = 1; P.done = 0; progDraw();
    const res = new Map();
    for (const c of rows) { res.set(c.id, await satVerificar(c, {noSave: true})); P.done++; progDraw(); await tick(d * 1.5); }
    P.stage = 2; P.done = 0; progDraw();
    for (const c of rows) {
      const r = res.get(c.id), n = satNivel(r); delete c._expr; await saveRec('cfdi', c);
      if (n === 'nf' || r.ValidacionEFOS === '100') P.bad++; else if (n === 'proc' || r.EsCancelable === 'No cancelable') P.warn++; else P.ok++;
      P.done++; progDraw(); await tick(d);
    }
    P.fin = true; P.label = `Sincronizado: ${rows.filter(c => satNivel(c.sat) === 'vig').length} vigentes, ${rows.filter(c => satNivel(c.sat) === 'proc').length} en proceso, ${rows.filter(c => satNivel(c.sat) === 'cancel').length} cancelados, ${rows.filter(c => satNivel(c.sat) === 'nf').length} no encontrados. Las incidencias quedaron en la bitácora de Facturación masiva.`;
    render();
  },
  satSim: async el => {
    const c = S.cfdis.find(x => x.id === el.dataset.id); if (!c) return; const v = el.dataset.v; c.satSim = Object.assign({}, c.satSim || {}); delete c.satSim.estado;
    if (v === 'vigente') await reactivar(c);
    if (v === 'proceso') { await reactivar(c); c.cancel = {motivo: '02', sust: '', fecha: nowLocal(), est: 'En proceso', limite: sumarDiasHabiles(new Date(), 3).toISOString(), sim: true}; }
    if (v === 'cancelado') { const r = satConsulta(c); c.cancel = Object.assign({motivo: '02', fecha: nowLocal(), sim: true}, c.cancel || {}); await aplicarCancelacion(c, r.EsCancelable === 'Cancelable con aceptación' ? 'Cancelado con aceptación' : 'Cancelado sin aceptación'); }
    if (v === 'nf') c.satSim.estado = 'nf';
    await satVerificar(c); openModal(acuseHTML(c), true); render();
  },
  satResp: async el => {
    const c = S.cfdis.find(x => x.id === el.dataset.id); if (!c || !c.cancel) return; const v = el.dataset.v;
    if (v === 'acepta') await aplicarCancelacion(c, 'Cancelado con aceptación');
    if (v === 'vence') await aplicarCancelacion(c, 'Plazo vencido');
    if (v === 'rechaza') { c.cancel.est = 'Solicitud rechazada'; c.cancel.resp = nowLocal(); await saveRec('cfdi', c); bitaLog({fuente: 'cancelacion', sev: 'warn', origen: `${c.serie}${c.folio}`, ref: c.uuid, code: 'SOLICITUD_RECHAZADA', diag: 'El receptor rechazó la cancelación en su Buzón Tributario: el CFDI sigue vigente. Aclara con el cliente o emite una nota de crédito.', action: {kind: 'acuse', id: c.id}}); }
    await satVerificar(c); openModal(acuseHTML(c), true); render();
    toast(v === 'rechaza' ? 'Solicitud rechazada: el CFDI sigue vigente.' : `CFDI ${c.serie}${c.folio} cancelado (${c.cancel.est}).`, v === 'rechaza' ? 'warn' : 'ok');
  },
  copyExpr: async () => { const t = $('#exprpre').textContent; try { await navigator.clipboard.writeText(t); toast('Expresión impresa copiada.', 'ok'); } catch (e) { const r = document.createRange(); r.selectNodeContents($('#exprpre')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast('Texto seleccionado: cópialo con Ctrl+C.'); } }
});
/* Bloqueos sobre UUID cancelados o en proceso */
const bloqueoUUID = c => c.estado === 'Cancelado' ? `El CFDI ${c.serie}${c.folio} está cancelado ante el SAT: no admite complementos de pago ni notas de crédito.` : (c.cancel || {}).est === 'En proceso' ? `El CFDI ${c.serie}${c.folio} tiene una cancelación en proceso: espera la respuesta del receptor antes de registrar pagos o notas.` : '';
['notaCredito', 'pagarDesde'].forEach(k => { const f = A[k]; A[k] = el => { const c = S.cfdis.find(x => x.id === el.dataset.id), b = c && bloqueoUUID(c); if (b) { bitaLog({fuente: 'sat', sev: 'crit', origen: `${c.serie}${c.folio}`, ref: c.uuid, code: c.estado === 'Cancelado' ? 'UUID_CANCELADO' : 'CANCELACION_EN_PROCESO', diag: b, action: {kind: 'acuse', id: c.id}}); return toast(b, 'bad'); } f(el); }; });
const _pendientesF = pendientes;
pendientes = function (rfc) { return _pendientesF(rfc).filter(c => (c.cancel || {}).est !== 'En proceso'); };
const _dryREPF = dryREP;
dryREP = function () {
  const res = _dryREPF();
  res.docs.forEach(doc => { Object.keys((doc.P || {}).sel || {}).forEach(id => { const c = S.cfdis.find(x => x.id === id); if (c && (c.cancel || {}).est === 'En proceso') { const row = (S.mas.rows.pagos || []).find(r => String(r.UUID_Factura_PPD || '').trim().toUpperCase() === c.uuid); addErr(doc.errs, bloqueoUUID(c), 'pagos', row, 'UUID_Factura_PPD', null, 'CANCELACION_EN_PROCESO'); doc.ok = false; } }); });
  return res;
};

/* Visor del CFDI: semáforo y expresión impresa */
const _verCFDIF = verCFDI;
verCFDI = function (id, tab = 'res') {
  _verCFDIF(id, tab); const c = S.cfdis.find(x => x.id === id); if (!c) return;
  if (tab === 'xml') { const pre = $('#xmlpre'); if (pre) pre.insertAdjacentHTML('beforebegin', `<div class="fld"><label>ExpresionImpresa (ConsultaCFDIService)</label><pre class="xml expr">${esc(expresionImpresa(c))}</pre></div>`); }
  else { const g = $('#modal .revgrid'); if (g) g.insertAdjacentHTML('beforeend', `<div><p class="eyebrow">Estatus SAT</p>${satBadge(c)}</div>`); }
  if ((c.cancel || {}).est === 'En proceso') { const b = $('#modal [data-a="cancelar"]'); if (b) b.textContent = 'Ver solicitud de cancelación'; }
};

/* Bitácora: nuevos orígenes y acciones */
Object.assign(BITA_FUENTE, {sat: 'Verificación SAT', folios: 'Control de folios'});
const _bitaActionsF = bitaActions;
bitaActions = function (e) {
  const a = e.action || {}, b = [];
  if (e.code === 'FOLIO_INTERNO_DUPLICADO' && a.kind === 'cell') b.push(`<button class="btn sm" data-a="folioLote" data-cell="${a.sec}|${a.i}|Folio">Reasignar al siguiente folio libre (${esc(folioLoteLabel(`${a.sec}|${a.i}|Folio`))})</button>`);
  if (a.kind === 'folioDraft') b.push(`<button class="btn sm" data-a="bitaFolioDraft">Reasignar al siguiente folio libre${S.draft ? ` (${esc(fmtSF(S.draft.serie, nextFree(S.draft.serie)))})` : ''}</button>`);
  if (a.kind === 'acuse') b.push(`<button class="btn sm ghost" data-a="acuse" data-id="${a.id}">Ver acuse SAT</button>`);
  if (a.kind === 'series') b.push('<button class="btn sm ghost" data-a="go" data-v="series">Ver series y folios</button>');
  const base = _bitaActionsF(e); return b.join('') + (b.length && base.includes('—') ? '' : base);
};

/* Editor: selector de serie, folio en vivo y registro de duplicados */
Object.assign(A2, {
  serieSel: el => {
    const d = S.draft; if (!d) return;
    if (el.value === '__nueva') { d._serieNueva = true; d.serie = ''; } else { d._serieNueva = false; d.serie = serieDe(el.value); }
    d.folio = String(nextFree(d.serie)); d._folioAuto = true; render();
    if (d._serieNueva) { const n = $('#b_serie'); if (n) n.focus(); }
  },
  satEfos: async el => { const c = S.cfdis.find(x => x.id === el.dataset.id); if (!c) return; c.satSim = Object.assign({}, c.satSim || {}, {efos: el.checked}); await satVerificar(c); openModal(acuseHTML(c), true); render(); }
});
document.addEventListener('input', e => {
  const el = e.target, d = S.draft; if (!d) return;
  if (el.id === 'b_serie') { if (d._folioAuto !== false) { d.serie = el.value.toUpperCase(); d.folio = String(nextFree(d.serie)); const f = $('#b_folio'); if (f) f.value = d.folio; } const b = $('#folbadge'); if (b) b.innerHTML = folBadge(Object.assign({}, d, {serie: el.value.toUpperCase()})); }
  if (el.id === 'b_folio') { const nf = nextFree(d.serie); d._folioAuto = folioId(el.value) === String(nf); const tmp = Object.assign({}, d, {folio: el.value}), b = $('#folbadge'); if (b) b.innerHTML = folBadge(tmp); el.classList.toggle('bad', !!(el.value.trim() && folioUsado(d.serie, el.value))); }
}, true);
document.addEventListener('change', e => {
  const el = e.target, d = S.draft; if (!d || el.id !== 'b_folio') return;
  const u = el.value.trim() && folioUsado(d.serie, el.value);
  if (u && !(S.bita[0] && S.bita[0].code === 'FOLIO_INTERNO_DUPLICADO' && S.bita[0].ref === fmtSF(d.serie, el.value.trim()) && Date.now() - new Date(S.bita[0].ts) < 60000)) bitaLog({fuente: 'folios', sev: 'crit', origen: `Editor · ${d.cp ? 'Carta Porte' : 'Nueva factura'}`, ref: fmtSF(d.serie, el.value.trim()), code: 'FOLIO_INTERNO_DUPLICADO', diag: `Se capturó el folio ${fmtSF(d.serie, el.value.trim())}, que ya se usó (${describeUso(u)}). Quedó bloqueado para timbrar.`, action: {kind: 'folioDraft'}});
});
const _dupF = A.duplicar;
A.duplicar = el => { _dupF(el); if (S.draft) { S.draft.folio = String(nextFree(S.draft.serie)); S.draft._folioAuto = true; render(); } };
const _updateSideF = updateSide;
updateSide = function () { _updateSideF(); const d = S.draft, f = $('#b_folio'); if (d && f) f.classList.toggle('bad', !!(String(d.folio ?? '').trim() && folioUsado(d.serie, d.folio))); };

/* Importador de XML: resumen de series detectadas y estatus SAT al integrar */
const _viewXmlF = viewXml;
viewXml = function () {
  const R = S.mas.xi.serieRes, h = _viewXmlF();
  if (!R || !R.list.length) return h;
  return `<section class="card"><div class="bh"><h2>Series y folios detectados</h2><button class="btn ghost sm" data-a="go" data-v="series">Abrir control de series</button></div>
  <div class="tw"><table><thead><tr><th>Serie</th><th>Tipo</th><th class="n">CFDI registrados</th><th>Último folio</th><th>Siguiente folio disponible</th><th>Saltos</th></tr></thead><tbody>${R.list.map(s => `<tr><td><b class="mono">${esc(s.key)}</b> ${s.nueva ? chip('Nueva', 'ok') : ''}</td><td>${esc(TIPO_TXT[s.tipo] || s.tipo)}</td><td class="n">${s.count}</td><td class="mono">${esc(s.ult ? fmtSF(serieDe(s.key), s.ult) : '—')}</td><td><b class="mono">${s.next}</b></td><td>${s.huecos.length ? chip('Faltan ' + fmtRangos(s.huecos, 3), 'warn') : chip('Sin saltos', 'ok')}</td></tr>`).join('')}</tbody></table></div></section>` + h;
};
const _recFromModelF = recFromModel;
recFromModel = function (m, xml, extra = {}) {
  const r = _recFromModelF(m, xml, extra), sim = S.satSim[r.uuid];
  if (sim) r.satSim = Object.assign({}, sim);
  if (r.sat && r.sat.EstatusCancelacion === 'En proceso') r.cancel = {motivo: '02', fecha: nowLocal(), est: 'En proceso', limite: sumarDiasHabiles(new Date(), 3).toISOString()};
  return r;
};
