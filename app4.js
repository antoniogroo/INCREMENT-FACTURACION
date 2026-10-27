/* ============ ACCIONES NUEVAS: PDF, fricción cero, masiva ============ */
Object.assign(A, {
  fix: el => { const f = FIXES[el.dataset.f]; if (!f || !S.draft) return; if (f.run) f.run(S.draft); if (!$('#modal').hidden) closeModal(); render(); if (f.focus) { const n = document.getElementById(f.focus); if (n) { n.focus(); n.scrollIntoView({block: 'center'}); } } else toast('Listo: ' + f.l, 'ok'); },
  traductor: () => openTraductor(''),
  tradEj: el => { const t = PAC_EJEMPLOS[+el.dataset.i]; $('#tradq').value = t; $('#tradres').innerHTML = traduccionHTML(traducir(t)); },
  moreRow: el => { const c = S.draft.conceptos[+el.dataset.i]; c._more = !c._more; render(); },
  sustituir: el => {
    const c = S.cfdis.find(x => x.id === el.dataset.id); if (!c) return; const b = bloqueoCancelacion(c);
    if (b) return openModal(`<header class="mh"><h3>No se puede sustituir ${esc(c.serie)}${esc(c.folio)}</h3><button class="x" data-a="close" aria-label="Cerrar">×</button></header><div class="alert bad"><span>${esc(b)}</span></div><footer class="mf"><button class="btn ghost" data-a="close">Entendido</button></footer>`);
    const d = draftFromRec(c); if (!d) return toast('Este CFDI no tiene datos editables.', 'warn');
    d.relacion = {tipo: '04', uuids: c.uuid}; d.sustituye = c.id; d.saveCliente = false; S.draft = d; closeModal(); S.view = d.cp ? 'cartaporte' : 'factura'; render(); window.scrollTo(0, 0);
    toast(`Corrige lo necesario y timbra: ${c.serie}${c.folio} se cancelará con motivo 01.`);
  },
  cancelSust: () => { delete S.draft.sustituye; S.draft.relacion = {tipo: '', uuids: ''}; render(); },
  verPDF: el => verPDF(el.dataset.id),
  dlPDF: async el => { const c = S.cfdis.find(x => x.id === el.dataset.id); el.disabled = true; try { const b = await pdfBytes(c); await ofrecerArchivo(pdfName(c) + '.pdf', new Blob([b], {type: 'application/pdf'})); } catch (e) { toast('No se pudo generar el PDF: ' + e.message, 'bad'); } el.disabled = false; },
  tplXlsx: el => { const k = el.dataset.k; ofrecerArchivo(LAYOUTS[k].file + '.xlsx', makeXlsx(layoutSheets(k))); },
  tplCsv: el => { const k = el.dataset.k; ofrecerArchivo(LAYOUTS[k].file + '.csv', toCSV(layoutSheets(k)[0].rows)); },
  masEjemplo: el => { const k = el.dataset.k; S.mas.layout = k; S.mas.tab = 'carga'; loadTables(sampleTables(k), 'Datos de ejemplo'); applyMap(); S.view = 'masiva'; render(); window.scrollTo(0, 0); },
  masErp: () => { S.mas.layout = 'ie'; loadTables(sampleTables('ie', true), 'ventas_erp_octubre.xlsx (ejemplo)'); render(); },
  masTab: el => { S.mas.tab = el.dataset.k; closeModal(); if (S.view !== 'masiva') S.view = 'masiva'; render(); },
  masLayout: el => { S.mas.layout = el.dataset.k; render(); },
  masStep: el => { S.mas.step = el.dataset.s; render(); },
  mapApply: () => {
    const L = LAYOUTS[S.mas.layout], miss = [];
    L.sections.forEach(s => s.fields.forEach(f => { const src = S.mas.map[s.k].cols[f.k]; if (f.req && !src && !(f.k === 'Nombre_Receptor')) miss.push(f.k); }));
    if (miss.length) return toast('Asigna una columna o valor fijo a: ' + miss.join(', ') + '.', 'warn');
    applyMap(); render(); window.scrollTo(0, 0);
  },
  mapSave: async () => { const nombre = $('#mapname').value.trim() || `Mapeo ${LAYOUTS[S.mas.layout].t} ${nowLocal().slice(0, 10)}`; await saveRec('mapeo', {nombre, layout: S.mas.layout, rfc: $('#mapcli').value, map: clone(S.mas.map)}); toast(`Mapeo “${nombre}” guardado. Se aplicará solo cuando subas un archivo con las mismas columnas.`, 'ok'); },
  loteFiltro: el => { S.mas.filter = el.dataset.k; render(); },
  loteSec: el => { S.mas.sec = el.dataset.k; render(); },
  loteReview: () => {
    const R = S.mas.dry; if (!R || !R.docs.some(d => d.ok)) return;
    openModal(`<header class="mh"><h3>Confirma el timbrado del lote</h3><button class="x" data-a="close" aria-label="Cerrar">×</button></header>
    <div class="poliza">${R.poliza.map(p => `<div class="pz${p[2] ? ' strong' : ''}"><span>${esc(p[0])}</span><b>${esc(p[1])}</b></div>`).join('')}</div>
    ${R.docs.some(d => !d.ok) ? `<div class="alert warn"><span>${R.docs.filter(d => !d.ok).length} documentos con errores no se timbrarán y quedarán en la tabla para corregirlos.</span></div>` : ''}
    <label class="check"><input type="checkbox" id="lk1"> Cuadré la póliza contra mis papeles de trabajo y los datos de los receptores son correctos.</label>
    <p class="muted small" id="loteprog">Modo demostración: los folios fiscales se generan aquí, sin PAC.</p>
    <footer class="mf"><button class="btn ghost" data-a="close">Volver</button><button class="btn" data-a="doLote">Timbrar ${R.docs.filter(d => d.ok).length}</button></footer>`);
  },
  doLote: async el => {
    if (!$('#lk1').checked) return toast('Marca la confirmación para timbrar el lote.', 'warn');
    el.disabled = true; const res = await emitirLote((i, n, k) => { const p = $('#loteprog'); if (p) p.textContent = `Timbrando ${i + 1} de ${n}: ${k}`; });
    S.mas.result = res; render();
    openModal(`<header class="mh"><h3>Lote timbrado</h3><button class="x" data-a="close" aria-label="Cerrar">×</button></header>
    <p><b>${res.out.length}</b> comprobantes emitidos${res.fails.length ? ` · <b>${res.fails.length}</b> con error` : ''}.</p>
    <div class="tw"><table><tbody>${res.out.map(o => `<tr><td class="mono small">${esc(o.key)}</td><td>${esc(tipoNombre(o.rec))} ${esc(o.rec.serie)}${esc(o.rec.folio)}</td><td class="mono small">${esc(o.rec.uuid.slice(0, 8))}…</td><td><button class="btn sm ghost" data-a="verPDF" data-id="${o.rec.id}">PDF</button></td></tr>`).join('')}${res.fails.map(f => `<tr><td>${esc(f.key)}</td><td colspan="3" class="ferr">${esc(f.m)}</td></tr>`).join('')}</tbody></table></div>
    <footer class="mf"><button class="btn ghost" data-a="loteZip" data-k="xml">XML del lote (.zip)</button><button class="btn" data-a="loteZip" data-k="pdf">PDF del lote (.zip)</button></footer>`, true);
  },
  loteZip: async el => {
    const out = (S.mas.result || {}).out || []; if (!out.length) return; el.disabled = true; const files = [];
    for (const o of out) { const n = pdfName(o.rec); if (el.dataset.k === 'xml') files.push({name: n + '.xml', data: o.rec.xml}); else { el.textContent = `Generando ${files.length + 1} de ${out.length}…`; files.push({name: n + '.pdf', data: await pdfBytes(o.rec)}); } }
    await ofrecerArchivo(`lote_${EM().rfc}_${nowLocal().slice(0, 10)}_${el.dataset.k}.zip`, makeZip(files)); el.disabled = false; el.textContent = el.dataset.k === 'xml' ? 'XML del lote (.zip)' : 'PDF del lote (.zip)';
  },
  netoLote: el => {
    const doc = S.mas.dry.docs.find(d => d.key === el.dataset.key); if (!doc) return;
    const row = S.mas.rows.docs.find(r => r._i === doc.rows[0].i), c = clone(doc.d.conceptos[0]); c.neto = row.Total_Esperado;
    const r = solveVU(c, doc.d.tipo); if (!r) return toast('No se pudo despejar el valor unitario.', 'bad');
    row.Valor_Unitario = fmtVUs(r.vu); runDry(); render(); toast(`Valor unitario ajustado a ${fmtVUs(r.vu)} para cuadrar ${money(num(c.neto))}.`, 'ok');
  },
  xmlEjemplo: async () => { await xmlProcess(xmlEjemplos()); render(); },
  xmlLimpiar: () => { S.mas.xi.items = []; render(); },
  xmlImport: async el => { el.disabled = true; const r = await xmlImportar(); render(); toast(`Importamos ${r.ni} facturas PPD${r.np ? ` y ${r.np} complementos de pago` : ''}. Ya puedes registrarles pagos o notas de crédito.`, 'ok'); },
  pdfPal: el => { const E = pdfEdit(); E.st.primary = el.dataset.p; E.st.secondary = el.dataset.s; E.dirty = true; render(); },
  pdfQuitar: el => { const E = pdfEdit(); delete E.imgs[el.dataset.slot]; E.dirty = true; render(); },
  pdfDemo: () => { const E = pdfEdit(); E.imgs.logo = muestraImg('logo'); E.imgs.stamp = muestraImg('stamp'); const c = E.st.card || (E.st.card = {}); if (!c.direccion) Object.assign(c, {direccion: 'Av. Constitución 400 Pte., Centro, Monterrey, N.L.', telefono: '81 8000 0000', email: 'facturacion@empresa.mx', web: 'www.empresa.mx', leyenda: 'Gracias por su preferencia'}); E.dirty = true; render(); },
  pdfReset: () => { S.pdfEd = null; render(); },
  pdfSave: async () => {
    const E = pdfEdit(), em = EM(); em.pdf = clone(E.st); await saveRec('emisor', em);
    for (const slot of ['logo', 'stamp']) { const id = docId('pdfimg', em.id + '_' + slot); if (E.imgs[slot]) await Store.put(id, {acct: S.acct, coll: 'pdfimg', emisorId: em.id, slot, ...E.imgs[slot]}); else await Store.del(id); }
    S.pdfimg[em.id] = clone(E.imgs); E.dirty = false; render(); toast('Diseño del PDF guardado. Se aplica a todos los CFDI de este emisor.', 'ok');
  }
});
const _dup = A.duplicar; A.duplicar = el => { _dup(el); if (S.draft) { delete S.draft.sustituye; render(); } };
Object.assign(A2, {
  netoMode: el => { const d = S.draft; d.netoMode = el.checked; if (el.checked) d.conceptos.forEach(c => { if (num(c.vu) > 0 && !c.neto) c.neto = f2(lineTotal(c, d.tipo)); }); render(); },
  loteFile: async el => { const f = el.files[0]; if (!f) return; try { loadTables(await readTableFile(f), f.name); render(); } catch (e) { toast(e.message, 'bad'); } },
  xmlFiles: async el => { const fs = Array.from(el.files || []); if (!fs.length) return; await xmlProcess(fs); render(); },
  loteTol: el => { S.mas.tol = el.value; runDry(); render(); },
  platTasas: el => { S.mas.plat = el.value; runDry(); render(); },
  pdfImg: async el => { const f = el.files[0]; if (!f) return; try { const E = pdfEdit(); E.imgs[el.dataset.slot] = await fileToPng(f); E.dirty = true; render(); } catch (e) { toast(e.message, 'bad'); } }
});
AFTER.perfil = () => { if (EM()) pdfPreview(); };

/* Captura en fase de captura: neto, celdas del lote, diseño PDF y búsqueda de claves */
let mcT;
document.addEventListener('input', e => {
  const el = e.target, d = S.draft;
  if (el.dataset.neto !== undefined && d) {
    const c = d.conceptos[+el.dataset.neto]; c.neto = el.value; const r = solveVU(c, d.tipo);
    if (r) { c.vu = fmtVUs(r.vu); c._netoDiff = r.diff; const vu = $(`#b_conceptos_${el.dataset.neto}_vu`); if (vu) vu.value = c.vu; }
    const s = $('#nts_' + el.dataset.neto); if (s) { s.textContent = num(c.neto) > 0 ? (r && !r.diff ? 'Cuadra' : r ? 'Dif. ' + money(r.diff) : '') : ''; s.className = r && r.diff ? 'bad' : 'ok'; }
    updateSide(); return;
  }
  if (el.dataset.b && d && /^conceptos\.\d+\.vu$/.test(el.dataset.b)) { const i = +el.dataset.b.split('.')[1]; if (d.conceptos[i]) { d.conceptos[i].neto = ''; const n = $('#nt_' + i); if (n) n.value = ''; const s = $('#nts_' + i); if (s) s.textContent = ''; } }
  if (el.dataset.gc === 'clave' && d) {
    const i = +el.dataset.gi, v = el.value.trim();
    if (/^\d{8}$/.test(v)) { const c = d.conceptos[i], hit = catalogHits(v, 1)[0]; if (c && hit && hit[0] === v && !String(c.descripcion || '').trim()) { c.descripcion = hit[1]; const ds = $(`#b_conceptos_${i}_descripcion`); if (ds) ds.value = hit[1]; } }
    else { const dl = $('#dlps'); if (dl) dl.innerHTML = dlOptions(v); }
  }
  if (el.dataset.mc) { const [sec, i, k] = el.dataset.mc.split('|'); const row = (S.mas.rows[sec] || []).find(r => r._i === +i); if (row) row[k] = el.value; clearTimeout(mcT); mcT = setTimeout(() => { runDry(); render(); }, 450); return; }
  if (el.dataset.mapfix) { const [sec, k] = el.dataset.mapfix.split('|'); S.mas.map[sec].fixed[k] = el.value; return; }
  if (el.dataset.xsaldo) { const it = S.mas.xi.items.find(x => x.id === el.dataset.xsaldo); if (it) { it.saldo = el.value; it.saldoManual = true; } return; }
  if (el.dataset.pdf) { const E = pdfEdit(); E.st[el.dataset.pdf] = el.type === 'range' ? num(el.value) : el.value; E.dirty = true; if (el.type === 'range') { const l = $('label[for="pdf_op"]'); if (l) l.textContent = `Opacidad del sello: ${Math.round(num(el.value) * 100)}%`; } pdfPreview(); return; }
  if (el.dataset.pdfc) { const E = pdfEdit(); E.st.card[el.dataset.pdfc] = el.value; E.dirty = true; pdfPreview(); }
}, true);
const _updateSide = updateSide;
updateSide = function () {
  const d = S.draft;
  if (d && d.netoMode) { resolveNetos(d); d.conceptos.forEach((c, i) => { if (num(c.neto) > 0) { const v = $(`#b_conceptos_${i}_vu`); if (v && document.activeElement !== v) v.value = c.vu; const s = $('#nts_' + i); if (s) { s.textContent = c._netoDiff ? 'Dif. ' + money(c._netoDiff) : 'Cuadra'; s.className = c._netoDiff ? 'bad' : 'ok'; } } }); }
  _updateSide();
};
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.mapsheet) { const sec = el.dataset.mapsheet, ti = +el.value, s = LAYOUTS[S.mas.layout].sections.find(x => x.k === sec), t = S.mas.tables[ti], used = new Set(), cols = {};
    s.fields.forEach(f => { const c = [f.k, ...f.al].map(normH); const h = t.headers.find(h => !used.has(h) && c.includes(normH(h))); if (h) { cols[f.k] = h; used.add(h); } });
    S.mas.map[sec] = {sheet: ti, cols, fixed: {}}; render(); }
  else if (el.dataset.mapcol) { const [sec, k] = el.dataset.mapcol.split('|'); S.mas.map[sec].cols[k] = el.value; render(); }
  else if (el.dataset.xinc) { const it = S.mas.xi.items.find(x => x.id === el.dataset.xinc); if (it) it.include = el.checked; render(); }
});
document.addEventListener('keydown', e => {
  const mod = e.ctrlKey || e.metaKey;
  if (!S.acct) return;
  if (mod && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); openPalette(); return; }
  if (mod && e.key === 'Enter') {
    e.preventDefault();
    const b = $('#modal:not([hidden]) [data-a="emitir"], #modal:not([hidden]) [data-a="doPago"], #modal:not([hidden]) [data-a="doRet"], #modal:not([hidden]) [data-a="doLote"]');
    if (b) { if (!b.disabled) b.click(); return; }
    if (!$('#modal').hidden) return;
    if (['factura', 'cartaporte'].includes(S.view)) { const ok = !validar(S.draft, EM()).E.length; if (ok) review(); else bitaTimbrado(validar(S.draft, EM()).E); }
    else if (S.view === 'pagos' && S.pago && !validarPago(S.pago).length) A.reviewPago();
    else if (S.view === 'retenciones' && S.ret && !validarRet(S.ret).length) A.reviewRet();
    else if (S.view === 'masiva' && S.mas.step === 'review') A.loteReview();
    return;
  }
  if (!['factura', 'cartaporte'].includes(S.view) || !S.draft || !$('#modal').hidden) return;
  const t = e.target;
  if (e.altKey && (e.code === 'KeyN' || e.key === 'n' || e.key === 'N')) { e.preventDefault(); A.addConcepto(); focusGrid(S.draft.conceptos.length - 1, 'clave'); return; }
  if (mod && e.key === '/') { e.preventDefault(); const i = t.dataset && t.dataset.gi !== undefined ? +t.dataset.gi : S.draft.conceptos.length - 1; A.pickCat({dataset: {i}}); return; }
  if (t.dataset && t.dataset.gi !== undefined && !mod && !e.altKey) {
    const i = +t.dataset.gi, col = t.dataset.gc, vert = t.tagName === 'INPUT' && col !== 'clave' && (e.key === 'ArrowDown' || e.key === 'ArrowUp');
    if (e.key === 'Enter' || vert) {
      e.preventDefault(); const up = e.key === 'ArrowUp' || (e.key === 'Enter' && e.shiftKey), ni = up ? i - 1 : i + 1;
      if (ni < 0) return;
      if (ni >= S.draft.conceptos.length) { if (e.key === 'Enter') { A.addConcepto(); focusGrid(ni, 'clave'); } return; }
      focusGrid(ni, col);
    }
  }
}, true);
