/* ============ ACCIONES ============ */
const A = {
  close: closeModal,
  go: el => go(el.dataset.v),
  logout: () => logout(),
  authMode: el => viewAuth(el.dataset.m),
  demo: async () => {
    await Store.usarLocal(); try { if (Store.adapter !== Store.primary) localStorage.setItem('cfdi26:__demo', '1'); } catch (e) { /* sin localStorage */ }
    const email = 'demo@ejemplo.mx', id = 'acct~' + (await sha256(email)).slice(0, 24);
    let u = await Store.get(id);
    if (!u) { const salt = sid(); u = {id, acct: id, coll: 'acct', email, nombre: 'Usuario de ejemplo', salt, hash: await sha256(salt + ':ejemplo2026'), creado: nowLocal(), activeEmisor: ''}; await Store.put(id, u); await login(id, u, true); await seedDemo(); }
    else await login(id, u, true);
    toast('Estás en la cuenta de ejemplo (contraseña: ejemplo2026). Los datos llevan la marca “Ejemplo”.', 'ok');
  },
  quick: el => {
    const q = QUICK[+el.dataset.i][2];
    if (q === 'P') return go('pagos'); if (q === 'R') return go('retenciones');
    if (q === 'T-CP' || q === 'I-CP') { go('cartaporte'); if (q === 'I-CP') { setTipo(S.draft, 'I'); S.draft.conceptos = [fleteConcepto()]; } return render(); }
    go('factura'); const d = S.draft;
    if (q === 'I-PPD') { d.metodoPago = 'PPD'; d.formaPago = '99'; }
    if (q === 'E') setTipo(d, 'E');
    if (q === 'G') toggleGlobal(true);
    render();
  },
  setTipo: el => { setTipo(S.draft, el.dataset.t); render(); },
  recPG: () => { Object.assign(S.draft.receptor, {rfc: RFC_PG, nombre: 'PUBLICO EN GENERAL', regimen: '616', uso: 'S01', cp: S.draft.lugarExp}); render(); },
  recEXT: () => { Object.assign(S.draft.receptor, {rfc: RFC_EXT, nombre: '', regimen: '616', uso: 'S01', cp: S.draft.lugarExp}); render(); },
  applyPreset: el => { applyPreset(S.draft, el.dataset.p); render(); },
  addConcepto: () => { const c = newConcepto(); const p = PRESETS[S.draft.preset]; if (p && S.draft.tipo !== 'T') Object.assign(c, {objeto: p.obj, iva: p.iva, retIsr: p.isr, retIva: p.riva}); if (S.draft.tipo === 'T') Object.assign(c, {objeto: '01', vu: '0', unidad: 'H87'}); S.draft.conceptos.push(c); render(); },
  delConcepto: el => { S.draft.conceptos.splice(+el.dataset.i, 1); render(); },
  addFlete: () => { S.draft.conceptos.push(fleteConcepto()); render(); },
  pickCat: el => openCatalog((k, d) => { const c = S.draft.conceptos[+el.dataset.i]; c.clave = k; if (!c.descripcion) c.descripcion = d; render(); }),
  pickCatMerc: el => openCatalog((k, d) => { const m = S.draft.cp.merc[+el.dataset.i]; m.bien = k; if (!m.desc) m.desc = d; const pc = PRODSERV.find(p => p[0] === k); if (pc && pc[2]) m.peligroso = 'Sí'; render(); }),
  pickCatForm: el => { const t = el.dataset.target; openCatalog((k, d) => { $('#' + t).value = k; const ds = $('#ff_descripcion'); if (ds && !ds.value) ds.value = d; }); },
  close2,
  pickRel: () => {
    const d = S.draft, em = EM(); const list = S.cfdis.filter(c => c.emisorId === em.id && ['I', 'E', 'T'].includes(c.tipo) && c.estado !== 'Cancelado' && (!d.receptor.rfc || c.receptor.rfc === d.receptor.rfc.toUpperCase()));
    openModal(`<header class="mh"><h3>Relacionar CFDI</h3><button class="x" data-a="close" aria-label="Cerrar">×</button></header>${list.length ? `<div class="tw"><table><tbody>${list.map(c => `<tr><td><input type="checkbox" class="relck" value="${c.uuid}" aria-label="Relacionar ${esc(c.serie + c.folio)}"></td><td class="mono">${esc(c.serie)}${esc(c.folio)}</td><td>${esc(c.receptor.nombre)}</td><td>${fmtDate(c.fecha)}</td><td class="n">${money(c.total, c.moneda)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">No hay CFDI vigentes para este receptor.</p>'}<footer class="mf"><button class="btn ghost" data-a="close">Cancelar</button><button class="btn" data-a="relOk">Relacionar</button></footer>`, true);
  },
  relOk: () => { const us = $$('.relck:checked').map(i => i.value); const d = S.draft; const cur = d.relacion.uuids.split(/[\s,]+/).filter(Boolean); d.relacion.uuids = [...new Set(cur.concat(us))].join('\n'); if (!d.relacion.tipo) d.relacion.tipo = d.tipo === 'E' ? '01' : '04'; closeModal(); render(); },
  addUbic: () => { S.draft.cp.ubic.push({tipo: 'Destino', rfc: '', nombre: '', fecha: '', cp: '', estado: '', municipio: '', calle: '', dist: ''}); render(); },
  delUbic: el => { S.draft.cp.ubic.splice(+el.dataset.i, 1); render(); },
  addMerc: () => { S.draft.cp.merc.push({bien: '', desc: '', cant: '1', unidad: 'KGM', peso: '', valor: '', peligroso: 'No', cvePel: '', embalaje: ''}); render(); },
  delMerc: el => { S.draft.cp.merc.splice(+el.dataset.i, 1); render(); },
  mercDesdeConceptos: () => { S.draft.conceptos.filter(c => c.clave).forEach(c => S.draft.cp.merc.push({bien: c.clave, desc: c.descripcion, cant: c.cantidad, unidad: c.unidad, peso: '', valor: '', peligroso: (PRODSERV.find(p => p[0] === c.clave) || [])[2] ? 'Sí' : 'No', cvePel: '', embalaje: ''})); render(); toast('Mercancías copiadas. Captura el peso de cada una.'); },
  addOp: () => { S.draft.cp.ops.push({tipo: '01', rfc: '', nombre: '', licencia: ''}); render(); },
  delOp: el => { S.draft.cp.ops.splice(+el.dataset.i, 1); render(); },
  review, resetDraft: () => { S.draft = newDraft(S.draft.cp ? 'T' : 'I', {cp: !!S.draft.cp}); render(); },
  emitir: async () => {
    const need = ['#ck1', '#ck2', '#ck3'].filter(s => $(s)); if (need.some(s => !$(s).checked)) return toast('Marca las confirmaciones para emitir.', 'warn');
    const btn = $('[data-a="emitir"]'); btn.disabled = true; btn.textContent = 'Emitiendo…';
    const rec = await emitirDraft(S.draft); const cp = !!S.draft.cp; S.draft = newDraft(cp ? 'T' : 'I', {cp}); closeModal(); render();
    toast(`CFDI ${rec.serie}${rec.folio} emitido.` + (rec.sustituyo ? ` ${rec.sustituyo} quedó cancelado con motivo 01.` : ''), 'ok'); verCFDI(rec.id);
  },
  ver: el => verCFDI(el.dataset.id, el.dataset.tab || 'res'),
  zipXML: el => { const c = S.cfdis.find(x => x.id === el.dataset.id); const n = `${EM().rfc}_${c.serie}${c.folio}_${c.uuid.slice(0, 8)}`; ofrecerArchivo(n + '.zip', makeZip([{name: n + '.xml', data: c.xml}])); },
  copyXML: async el => { const c = S.cfdis.find(x => x.id === el.dataset.id); try { await navigator.clipboard.writeText(c.xml); toast('XML copiado.', 'ok'); } catch (e) { verCFDI(c.id, 'xml'); const r = document.createRange(); r.selectNodeContents($('#xmlpre')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); toast('Texto seleccionado: cópialo con Ctrl+C.'); } },
  duplicar: el => { const c = S.cfdis.find(x => x.id === el.dataset.id); const d = clone(c.draft); const em = EM(); d.folio = String((em.folios || {})[d.tipo] || 1); d.relacion = {tipo: '', uuids: ''}; if (d.cp) { d.cp.idccp = idCCP(); d.cp.ubic.forEach(u => u.fecha = ''); } S.draft = d; closeModal(); S.view = d.cp ? 'cartaporte' : 'factura'; render(); toast('Copia lista. Revisa fechas y cantidades.'); },
  notaCredito: el => {
    const c = S.cfdis.find(x => x.id === el.dataset.id); const d = newDraft('E');
    Object.assign(d.receptor, clone(c.receptor)); d.receptor.uso = 'G02'; d.relacion = {tipo: '01', uuids: c.uuid}; d.moneda = c.moneda; d.tipoCambio = c.tc !== 1 ? String(c.tc) : '';
    d.formaPago = c.metodo === 'PPD' ? '15' : (c.forma || '03'); d.preset = (c.draft && c.draft.preset) || 'normal';
    d.conceptos = [Object.assign(newConcepto(), {clave: '84111506', unidad: 'ACT', descripcion: `Bonificación sobre factura ${c.serie}${c.folio}`})]; applyPreset(d, d.preset);
    S.draft = d; closeModal(); S.view = 'factura'; render();
  },
  pagarDesde: el => { const c = S.cfdis.find(x => x.id === el.dataset.id); S.pago = newPago(c.receptor.rfc); S.pago.sel[c.id] = f2(c.saldo); S.pago.monto = f2(c.saldo); closeModal(); S.view = 'pagos'; render(); },
  cancelar: el => cancelar(el.dataset.id),
  doCancel: async el => {
    const c = S.cfdis.find(x => x.id === el.dataset.id), mot = $('#cmot').value, sust = $('#csust') ? $('#csust').value : '';
    if (mot === '01' && !sust) { const e = $('#cerr'); e.hidden = false; e.textContent = 'Con motivo 01 selecciona el CFDI que lo sustituye.'; return; }
    c.estado = 'Cancelado'; c.cancel = {motivo: mot, sust, fecha: nowLocal()};
    if (c.tipo === 'P') for (const p of c.pagosDe || []) { const f = S.cfdis.find(x => x.id === p.id); if (f) { f.pagos = (f.pagos || []).filter(x => x.uuid !== c.uuid); f.saldo = r2(f.saldo + p.monto); await saveRec('cfdi', f); } }
    if (c.tipo === 'E') for (const f of S.cfdis.filter(x => (x.notas || []).some(n => n.uuid === c.uuid))) { const n = f.notas.find(n => n.uuid === c.uuid); f.saldo = r2(f.saldo + n.monto); f.notas = f.notas.filter(x => x.uuid !== c.uuid); await saveRec('cfdi', f); }
    if (c.tipo === 'I') c.saldo = 0;
    await saveRec('cfdi', c); closeModal(); render(); toast(`CFDI ${c.serie}${c.folio} cancelado con motivo ${mot}.`, 'ok');
  },
  repartir: () => { const P = S.pago; let rem = r2(num(P.monto)); if (!(rem > 0)) return toast('Primero captura el monto recibido.', 'warn'); P.sel = {}; for (const c of pendientes(P.rfc)) { if (rem <= 0) break; const a = r2(Math.min(c.saldo, rem)); P.sel[c.id] = f2(a); rem = r2(rem - a); } if (rem > 0) toast(`Sobran ${money(rem)}: el pago supera el saldo pendiente.`, 'warn'); render(); },
  reviewPago: () => {
    const P = S.pago; if (validarPago(P).length) return; const {sel, moneda} = buildPago(P);
    openModal(`<header class="mh"><h3>Confirma el complemento de pago</h3><button class="x" data-a="close" aria-label="Cerrar">×</button></header>
    <p>Pago de <b>${money(num(P.monto), moneda)}</b> recibido el ${esc(P.fecha.replace('T', ' '))} por ${esc(lbl(CAT.formaPago, P.forma).toLowerCase())}.</p>
    <div class="tw"><table><thead><tr><th>Factura</th><th>Parcialidad</th><th class="n">Saldo anterior</th><th class="n">Pagado</th><th class="n">Saldo insoluto</th></tr></thead><tbody>${sel.map(({c, monto}) => `<tr><td class="mono">${esc(c.serie)}${esc(c.folio)}</td><td>${(c.pagos || []).length + 1}</td><td class="n">${money(c.saldo, moneda)}</td><td class="n">${money(monto, moneda)}</td><td class="n">${money(r2(c.saldo - monto), moneda)}</td></tr>`).join('')}</tbody></table></div>
    <label class="check"><input type="checkbox" id="pk1"> El dinero ya está en mi cuenta o caja; el complemento solo se emite por pagos efectivamente recibidos.</label>
    <footer class="mf"><button class="btn ghost" data-a="close">Volver</button><button class="btn" data-a="doPago">Emitir complemento</button></footer>`, true);
  },
  doPago: async () => { if (!$('#pk1').checked) return toast('Confirma que recibiste el pago.', 'warn'); $('[data-a="doPago"]').disabled = true; const rec = await emitirPago(S.pago); S.pago = null; closeModal(); render(); toast(`Complemento ${rec.serie}${rec.folio} emitido. Saldos actualizados.`, 'ok'); verCFDI(rec.id); },
  retPreset: el => { S.ret.cve = el.dataset.k; S.ret.auto = true; recalcRet(S.ret); render(); },
  retAdd: () => { S.ret.auto = false; S.ret.imps.push({imp: '001', base: f2(num(S.ret.montoOp) - num(S.ret.montoExent)), monto: '', tipo: '05'}); render(); },
  retDel: el => { S.ret.imps.splice(+el.dataset.i, 1); render(); },
  retManual: () => { S.ret.auto = false; render(); },
  retAuto: () => { S.ret.auto = true; recalcRet(S.ret); render(); },
  reviewRet: () => {
    const R = S.ret; if (validarRet(R).length) return; const tot = r2(R.imps.reduce((a, m) => a + num(m.monto), 0));
    openModal(`<header class="mh"><h3>Confirma la constancia de retenciones</h3><button class="x" data-a="close" aria-label="Cerrar">×</button></header>
    <div class="revgrid"><div><p class="eyebrow">Retenido a</p><p><b>${esc(R.nombre.toUpperCase())}</b><br><span class="mono">${esc(R.rfc.toUpperCase())}</span></p></div><div><p class="eyebrow">Periodo</p><p>${esc(lbl(CAT.meses, R.mesIni))} a ${esc(lbl(CAT.meses, R.mesFin))} de ${esc(R.ejercicio)}</p></div>
    <div><p class="eyebrow">Clave</p><p>${esc(R.cve)} · ${esc(lbl(CAT.cveRetenc, R.cve))}</p></div><div><p class="eyebrow">Total retenido</p><p class="big">${money(tot)}</p></div></div>
    <label class="check"><input type="checkbox" id="rk1"> Las retenciones ya se descontaron del pago y se enterarán en la declaración del mes.</label>
    <footer class="mf"><button class="btn ghost" data-a="close">Volver</button><button class="btn" data-a="doRet">Emitir constancia</button></footer>`);
  },
  doRet: async () => { if (!$('#rk1').checked) return toast('Marca la confirmación para emitir.', 'warn'); const rec = await emitirRet(S.ret); S.ret = null; closeModal(); render(); toast('Constancia de retenciones emitida.', 'ok'); verCFDI(rec.id); },
  edit: el => editRec(el.dataset.c, el.dataset.id, ({cliente: 'Cliente', producto: 'Producto o servicio', vehiculo: 'Vehículo', operador: 'Operador', ubicacion: 'Ubicación'})[el.dataset.c]),
  del: el => { const c = el.dataset.c, id = el.dataset.id; openModal(`<header class="mh"><h3>¿Borrar este registro?</h3><button class="x" data-a="close" aria-label="Cerrar">×</button></header><p>Los comprobantes ya emitidos no cambian.</p><footer class="mf"><button class="btn ghost" data-a="close">Conservar</button><button class="btn danger" data-a="delOk" data-c="${c}" data-id="${id}">Borrar</button></footer>`); },
  delOk: async el => { await delRec(el.dataset.c, el.dataset.id); closeModal(); render(); toast('Registro borrado.'); },
  openCat: () => openCatalog((k, d) => editRecWith('producto', {clave: k, descripcion: d, unidad: 'H87'})),
  clearCat: async () => { for (let i = 0; i < (S.user.catChunks || 0); i++) await Store.del(docId('catalogo', 'c' + i)); S.catImport = []; S.user.catChunks = 0; await saveUser(); render(); toast('Catálogo importado eliminado.'); },
  addEm: () => editEm(), editEm: el => editEm(el.dataset.id),
  useEm: async el => { S.user.activeEmisor = el.dataset.id; await saveUser(); S.draft = null; render(); toast('Emisor cambiado.'); },
  backup: () => { const data = {cuenta: {email: S.user.email, nombre: S.user.nombre}, emisores: S.emisores, clientes: S.clientes, productos: S.productos, comprobantes: S.cfdis, vehiculos: S.vehiculos, operadores: S.operadores, ubicaciones: S.ubicaciones, exportado: nowLocal()}; ofrecerArchivo(`respaldo_folia_${nowLocal().slice(0, 10)}.json`, JSON.stringify(data, null, 2)); },
  exportCSV: () => {
    const em = EM(); const rows = S.cfdis.filter(c => c.emisorId === em.id).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = ['Tipo,Serie,Folio,UUID,Fecha,RFC receptor,Receptor,Moneda,Subtotal,Total,Metodo,Forma,Saldo,Estado'].concat(rows.map(c => [tipoNombre(c), c.serie, c.folio, c.uuid, c.fecha, c.receptor.rfc, c.receptor.nombre, c.moneda, f2(c.subtotal || 0), f2(c.tipo === 'P' ? c.montoPago : c.tipo === 'R' ? c.totalRet : c.total), c.metodo || '', c.forma || '', f2(c.saldo || 0), c.estado].map(q).join(','))).join('\n');
    ofrecerArchivo(`comprobantes_${em.rfc}_${nowLocal().slice(0, 10)}.csv`, '﻿' + csv);
  }
};
function editRecWith(coll, vals) { openForm('Producto o servicio', FIELDS[coll](), vals, async o => { const e = checkRec(coll, o); if (e) return e; await saveRec(coll, o); toast('Guardado.', 'ok'); }); }
function fleteConcepto() { const c = newConcepto(); Object.assign(c, {clave: '78101802', unidad: 'E48', descripcion: 'Servicio de flete', objeto: '02', iva: '0.160000'}); return c; }
function toggleGlobal(on) {
  const d = S.draft; d.global.on = on;
  if (on) { Object.assign(d.receptor, {rfc: RFC_PG, nombre: 'PUBLICO EN GENERAL', regimen: '616', uso: 'S01', cp: d.lugarExp}); d.conceptos.forEach(c => Object.assign(c, {clave: '01010101', unidad: 'ACT', descripcion: c.descripcion || 'Venta'})); d.saveCliente = false; }
  else { Object.assign(d.receptor, {rfc: '', nombre: '', regimen: '', uso: 'G03', cp: ''}); d.conceptos.forEach(c => { if (c.clave === '01010101') c.clave = ''; }); d.saveCliente = true; }
}
const A2 = {
  switchEm: async el => { S.user.activeEmisor = el.value; await saveUser(); S.draft = null; S.pago = null; S.ret = null; if (['factura', 'cartaporte'].includes(S.view)) S.draft = newDraft(S.view === 'cartaporte' ? 'T' : 'I', {cp: S.view === 'cartaporte'}); render(); toast('Ahora facturas como ' + EM().nombre + '.'); },
  toggleGlobal: el => { toggleGlobal(el.checked); render(); },
  pickCliente: el => { const c = S.clientes.find(x => x.id === el.value); if (!c) return; Object.assign(S.draft.receptor, {rfc: c.rfc, nombre: c.nombre, regimen: c.regimen, cp: c.cp, uso: c.uso || 'G03'}); if (c.preset) applyPreset(S.draft, c.preset); if (c.credito && num(c.credito) > 0) { S.draft.metodoPago = 'PPD'; S.draft.formaPago = '99'; S.draft.condiciones = `Crédito ${c.credito} días`; } render(); },
  preset: el => { applyPreset(S.draft, el.value); render(); },
  addProducto: el => { const p = S.productos.find(x => x.id === el.value); if (!p) return; const d = S.draft; const c = newConcepto(p); const ps = PRESETS[d.preset]; if (ps) { c.retIsr = ps.isr; c.retIva = ps.riva; if (!p.iva) c.iva = ps.iva; } if (d.conceptos.length === 1 && !d.conceptos[0].clave && !d.conceptos[0].descripcion) d.conceptos = [c]; else d.conceptos.push(c); render(); },
  ieps: el => { const c = S.draft.conceptos[+el.dataset.i], x = IEPS26.find(y => y[0] === el.value) || IEPS26[0]; c.iepsCat = x[0]; c.iepsFactor = x[2]; c.iepsValor = x[3]; render(); },
  pickUbic: el => { const u = S.ubicaciones.find(x => x.id === el.value); if (!u) return; Object.assign(S.draft.cp.ubic[+el.dataset.i], {rfc: u.rfc, nombre: u.nombre, cp: u.cp, estado: u.estado, municipio: u.municipio || '', calle: u.calle || ''}); render(); },
  pickVeh: el => { const v = S.vehiculos.find(x => x.id === el.value); if (!v) return; S.draft.cp.veh = {perm: v.perm, numPerm: v.numPerm, config: v.config, placa: v.placa, anio: v.anio, pesoVeh: v.pesoVeh, aseg: v.aseg, poliza: v.poliza, remSub: v.remSub || '', remPlaca: v.remPlaca || ''}; render(); },
  pickOp: el => { const o = S.operadores.find(x => x.id === el.value); if (!o) return; S.draft.cp.ops.push({tipo: '01', rfc: o.rfc, nombre: o.nombre, licencia: o.licencia}); render(); },
  pagoCli: el => { S.pago = newPago(el.value); render(); },
  pagoSel: el => { const P = S.pago, id = el.dataset.id; if (el.checked) { const c = pendientes(P.rfc).find(x => x.id === id); const used = Object.values(P.sel).reduce((a, v) => a + num(v), 0); const rem = num(P.monto) - used; P.sel[id] = f2(rem > 0 ? Math.min(rem, c.saldo) : c.saldo); } else delete P.sel[id]; render(); },
  retCli: el => { const c = S.clientes.find(x => x.id === el.value); if (c) Object.assign(S.ret, {rfc: c.rfc, nombre: c.nombre, cp: c.cp}); render(); },
  cmot: el => { $('#csustw').hidden = el.value !== '01'; },
  importCat: async el => {
    const f = el.files[0]; if (!f) return; const txt = await f.text(); const seen = new Set(), items = [];
    txt.split(/\r?\n/).forEach(l => { const m = l.match(/^\s*"?(\d{8})"?\s*[,;\t|]\s*"?([^"\t;|]+?)"?\s*(?:[,;\t|]|$)/); if (m && !seen.has(m[1])) { seen.add(m[1]); items.push([m[1], m[2].trim()]); } });
    if (items.length < 50) return toast('No reconocimos el archivo. Debe tener la clave de 8 dígitos en la primera columna y la descripción en la segunda.', 'bad');
    toast(`Importando ${items.length.toLocaleString('es-MX')} claves…`);
    for (let i = 0; i < (S.user.catChunks || 0); i++) await Store.del(docId('catalogo', 'c' + i));
    const size = 2000, n = Math.ceil(items.length / size);
    for (let i = 0; i < n; i++) await Store.put(docId('catalogo', 'c' + i), {acct: S.acct, coll: 'catalogo', n: i, items: items.slice(i * size, (i + 1) * size)});
    S.user.catChunks = n; await saveUser(); S.catImport = items; render(); toast(`Catálogo importado: ${items.length.toLocaleString('es-MX')} claves.`, 'ok');
  }
};

/* ============ EVENTOS ============ */
document.addEventListener('click', e => { const el = e.target.closest('[data-a]'); if (!el) { if (e.target.id === 'modal2') close2(); else if (e.target.id === 'modal') closeModal(); return; } if (el.tagName === 'BUTTON' || el.dataset.a) { const f = A[el.dataset.a]; if (f) { e.preventDefault(); f(el, e); } } });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (!$('#modal2').hidden) close2(); else if (!$('#modal').hidden) closeModal(); } if (e.key === 'Enter' && e.target.matches('tr.click')) verCFDI(e.target.dataset.id); });
let ft;
document.addEventListener('input', e => {
  const el = e.target;
  if (el.dataset.b && S.draft) { if (el.tagName === 'SELECT') return; setPath(S.draft, el.dataset.b, el.type === 'checkbox' ? el.checked : (el.classList.contains('up') ? el.value.toUpperCase() : el.value)); updateSide(); }
  else if (el.dataset.f !== undefined && el.tagName === 'INPUT') { S.f[el.dataset.f] = el.value; clearTimeout(ft); ft = setTimeout(() => { const pos = el.selectionStart; render(); const n = $('#fq'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }, 250); }
  else if (el.dataset.p && S.pago) { S.pago[el.dataset.p] = el.value; $('#pside').innerHTML = pagoSide(); }
  else if (el.dataset.ps && S.pago) { S.pago.sel[el.dataset.ps] = el.value; const c = pendientes(S.pago.rfc).find(x => x.id === el.dataset.ps); const t = $('#ins_' + el.dataset.ps); if (c && t) t.textContent = money(r2(c.saldo - num(el.value)), c.moneda); $('#pside').innerHTML = pagoSide(); }
  else if (el.dataset.rt && S.ret && el.tagName === 'INPUT') { S.ret[el.dataset.rt] = el.value; if (['montoOp', 'montoExent'].includes(el.dataset.rt)) { recalcRet(S.ret); $('#rimps').innerHTML = retImpsHTML(S.ret); } $('#rside').innerHTML = retSide(); }
  else if (el.dataset.ri && S.ret && el.tagName === 'INPUT') { const [i, k] = el.dataset.ri.split('.'); S.ret.imps[+i][k] = el.value; $('#rside').innerHTML = retSide(); }
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.a2 && A2[el.dataset.a2]) return A2[el.dataset.a2](el);
  if (el.dataset.b && S.draft) { setPath(S.draft, el.dataset.b, el.type === 'checkbox' ? el.checked : (el.classList.contains('up') ? el.value.toUpperCase() : el.value)); if (el.dataset.b === 'metodoPago' && !S.draft.especial) S.draft.formaPago = el.value === 'PPD' ? '99' : (S.draft.formaPago === '99' ? '03' : S.draft.formaPago); if (el.dataset.b === 'receptor.regimen' && !S.draft.especial) { const u = CAT.uso.find(x => x[0] === S.draft.receptor.uso); if (u && !u[2].includes(el.value)) S.draft.receptor.uso = el.value === '616' ? 'S01' : ''; } if (el.dataset.r === '1' || (el.dataset.r === 'blur' && rfcTipo(S.draft.receptor.rfc) !== S._rt)) render(); else updateSide(); }
  else if (el.dataset.f !== undefined && el.tagName === 'SELECT') { S.f[el.dataset.f] = el.value; render(); }
  else if (el.dataset.p && S.pago) { S.pago[el.dataset.p] = el.value; $('#pside').innerHTML = pagoSide(); }
  else if (el.dataset.rt && S.ret) { S.ret[el.dataset.rt] = el.value; if (el.dataset.rt === 'cve') { S.ret.auto = true; recalcRet(S.ret); render(); } else $('#rside').innerHTML = retSide(); }
  else if (el.dataset.ri && S.ret) { const [i, k] = el.dataset.ri.split('.'); S.ret.imps[+i][k] = el.value; $('#rside').innerHTML = retSide(); }
});

/* ============ DATOS DE EJEMPLO ============ */
async function seedDemo() {
  const em = await saveRec('emisor', {rfc: 'EKU9003173C9', nombre: 'ESCUELA KEMPER URGATE', regimen: '601', cp: '64000', csdNo: '30001000000500003416', csdVence: '2027-05-18', frontera: false, series: {I: 'A', E: 'NC', T: 'T', P: 'P', R: 'R'}, folios: {I: 101, T: 12, P: 40, E: 5, R: 8}, demo: true});
  S.user.activeEmisor = em.id; await saveUser();
  const xia = await saveRec('cliente', {rfc: 'XIA190128J61', nombre: 'XENON INDUSTRIAL ARTICLES', regimen: '601', cp: '76343', uso: 'G03', preset: 'flete', credito: '30', demo: true});
  const ure = await saveRec('cliente', {rfc: 'URE180429TM6', nombre: 'UNIVERSIDAD ROBOTICA ESPAÑOLA', regimen: '601', cp: '86991', uso: 'G03', preset: 'normal', credito: '15', demo: true});
  await saveRec('cliente', {rfc: 'CACX7605101P8', nombre: 'XOCHILT CASAS CHAVEZ', regimen: '612', cp: '36257', uso: 'G03', preset: 'normal', demo: true});
  await saveRec('producto', {clave: '78101802', unidad: 'E48', descripcion: 'Flete Monterrey – Querétaro, caja seca 53 pies', precio: '28500', objeto: '02', demo: true});
  await saveRec('producto', {clave: '80101504', unidad: 'E48', descripcion: 'Consultoría en planeación estratégica (hora)', precio: '1850', objeto: '02', demo: true});
  await saveRec('producto', {clave: '14111507', unidad: 'XBX', descripcion: 'Caja de papel bond carta, 5,000 hojas', precio: '689', objeto: '02', demo: true});
  await saveRec('vehiculo', {alias: 'Tracto 07', config: 'T3S2', placa: '84AB3C', anio: '2022', pesoVeh: '36', perm: 'TPAF01', numPerm: 'SCT-0751-NL', aseg: 'Seguros del Norte', poliza: 'RC-2026-44871', remSub: 'CTR007', remPlaca: '9KX441', demo: true});
  await saveRec('operador', {nombre: 'RAUL MORALES SOTO', rfc: 'MOSR800101AB3', licencia: 'NL0457821', demo: true});
  await saveRec('ubicacion', {alias: 'Bodega Apodaca', rfc: 'EKU9003173C9', nombre: 'ESCUELA KEMPER URGATE', cp: '66600', estado: 'NLE', municipio: 'Apodaca', calle: 'Av. Miguel Alemán 1200', demo: true});
  await saveRec('ubicacion', {alias: 'Planta Xenon Querétaro', rfc: 'XIA190128J61', nombre: 'XENON INDUSTRIAL ARTICLES', cp: '76343', estado: 'QUE', municipio: 'El Marqués', calle: 'Parque Industrial Bernardo Quintana', demo: true});
  const mk = (rec, conceptos, extra = {}) => { const d = newDraft('I'); Object.assign(d.receptor, {rfc: rec.rfc, nombre: rec.nombre, regimen: rec.regimen, cp: rec.cp, uso: rec.uso}); d.conceptos = conceptos.map(([p, q]) => Object.assign(newConcepto(p), {cantidad: String(q)})); applyPreset(d, rec.preset || 'normal'); d.saveCliente = false; Object.assign(d, extra); return d; };
  const P = S.productos;
  await emitirDraft(mk(xia, [[P[0], 1]], {metodoPago: 'PPD', formaPago: '99', condiciones: 'Crédito 30 días'}), {fecha: '2026-09-24T10:12:40', demo: true, silent: true});
  await emitirDraft(mk(ure, [[P[1], 20]], {metodoPago: 'PPD', formaPago: '99', condiciones: 'Crédito 15 días'}), {fecha: '2026-10-02T12:40:05', demo: true, silent: true});
  await emitirDraft(mk(xia, [[P[0], 2]], {metodoPago: 'PPD', formaPago: '99', condiciones: 'Crédito 30 días'}), {fecha: '2026-10-09T09:05:51', demo: true, silent: true});
  await emitirDraft(mk(S.clientes[2], [[P[2], 3]], {metodoPago: 'PUE', formaPago: '03'}), {fecha: '2026-10-14T17:22:10', demo: true, silent: true});
  const t = newDraft('T', {cp: true}); t.conceptos = [Object.assign(newConcepto(), {clave: '14111507', unidad: 'XBX', cantidad: '120', descripcion: 'Caja de papel bond carta', objeto: '01', vu: '0'})];
  Object.assign(t.cp.ubic[0], {fecha: '2026-10-20T06:00', cp: '66600', estado: 'NLE', municipio: 'Apodaca', calle: 'Av. Miguel Alemán 1200'}); Object.assign(t.cp.ubic[1], {rfc: 'XIA190128J61', nombre: 'XENON INDUSTRIAL ARTICLES', fecha: '2026-10-20T16:30', cp: '76343', estado: 'QUE', municipio: 'El Marqués', dist: '725'});
  t.cp.merc = [{bien: '14111507', desc: 'Caja de papel bond carta', cant: '120', unidad: 'XBX', peso: '2760', valor: '82680', peligroso: 'No'}];
  t.cp.veh = {perm: 'TPAF01', numPerm: 'SCT-0751-NL', config: 'T3S2', placa: '84AB3C', anio: '2022', pesoVeh: '36', aseg: 'Seguros del Norte', poliza: 'RC-2026-44871', remSub: 'CTR007', remPlaca: '9KX441'};
  t.cp.ops = [{tipo: '01', rfc: 'MOSR800101AB3', nombre: 'RAUL MORALES SOTO', licencia: 'NL0457821'}];
  await emitirDraft(t, {fecha: '2026-10-20T05:48:00', demo: true, silent: true});
  S.view = 'inicio'; render();
}

/* ============ ARRANQUE ============ */
(async function boot() {
  $('#app').innerHTML = '<div class="splash">Conectando con tu base de datos…</div>';
  await Store.init();
  const s = session.get();
  if (s) {
    try {
      let demo = false; try { demo = !!localStorage.getItem('cfdi26:__demo'); } catch (e) { /* sin localStorage */ }
      if (demo) await Store.usarLocal(); else if (AuthHooks && AuthHooks.restore && !(await AuthHooks.restore())) throw new Error('sesión del servidor vencida');
      const u = await Store.get(s); if (u) return login(s, u, true);
    } catch (e) { Store.usarPrincipal(); }
  }
  viewAuth();
})();
