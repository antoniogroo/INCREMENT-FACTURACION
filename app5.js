/* ============ ACCIONES: candados, progreso y bitácora ============ */
function bitaTimbrado(E) {
  const d = S.draft; if (!d) return;
  E.forEach(e => bitaLog({fuente: 'timbrado', origen: `Editor · ${d.serie}${d.folio}`, ref: d.receptor.rfc || '', code: codeOf(e), diag: e.m, action: e.fix && FIXES[e.fix] ? {kind: 'fix', fix: e.fix} : null}));
  toast(`No se puede timbrar: ${E.length} ${E.length === 1 ? 'dato por corregir' : 'datos por corregir'}. Quedó registrado en la bitácora.`, 'warn');
}
const _login = login;
login = async function (id, u, keep) { await bitaLoad(id); return _login(id, u, keep); };
const _logout = logout;
logout = function () { S.bita = []; S.mas.prog = null; _logout(); };
const _cancelar = cancelar;
cancelar = function (id) {
  const c = S.cfdis.find(x => x.id === id), b = c && bloqueoCancelacion(c);
  if (b) bitaLog({fuente: 'cancelacion', origen: `${c.serie}${c.folio}`, ref: c.uuid, code: /plazo/.test(b) ? 'CANCELACION_PLAZO' : 'CANCELACION_CON_PAGOS', diag: b, action: {kind: 'ver', id: c.id}});
  _cancelar(id);
};
const _sust = A.sustituir;
const _emitir = A.emitir;
Object.assign(A, {
  sustituir: el => { const c = S.cfdis.find(x => x.id === el.dataset.id), b = c && bloqueoCancelacion(c); if (b) bitaLog({fuente: 'cancelacion', origen: `Sustitución de ${c.serie}${c.folio}`, ref: c.uuid, code: /plazo/.test(b) ? 'CANCELACION_PLAZO' : 'CANCELACION_CON_PAGOS', diag: b, action: {kind: 'ver', id: c.id}}); _sust(el); },
  emitir: async el => { try { await _emitir(el); } catch (e) { bitaLog({fuente: 'timbrado', origen: `Editor · ${S.draft.serie}${S.draft.folio}`, ref: S.draft.receptor.rfc, code: 'ERROR_TIMBRADO', diag: e.message || String(e)}); toast('No se pudo emitir: ' + (e.message || e), 'bad'); closeModal(); } },
  masEjemplo: async el => { const k = el.dataset.k; S.mas.layout = k; S.mas.tab = 'carga'; S.mas.step = 'upload'; S.view = 'masiva'; render(); window.scrollTo(0, 0); await loteConProgreso(sampleTables(k), 'Datos de ejemplo', {directo: true}); },
  mapApply: async () => {
    const L = LAYOUTS[S.mas.layout], miss = [];
    L.sections.forEach(s => s.fields.forEach(f => { if (f.req && !S.mas.map[s.k].cols[f.k] && f.k !== 'Nombre_Receptor') miss.push(f.k); }));
    if (miss.length) return toast('Asigna una columna o valor fijo a: ' + miss.join(', ') + '.', 'warn');
    window.scrollTo(0, 0); await aplicarConProgreso();
  },
  simExcel: async () => { S.mas.layout = 'ie'; S.mas.tab = 'carga'; S.mas.step = 'upload'; S.mas.filter = 'all'; render(); window.scrollTo(0, 0); await loteConProgreso(simExcelTable(), 'ventas_octubre_simulado.xlsx', {sim: true, directo: true}); S._bitaOpen = true; render(); },
  simXml: async el => { el.disabled = true; S.mas.tab = 'xml'; render(); await xmlProcess(simXmlFiles(), {sim: true}); S._bitaOpen = true; render(); },
  bitaFix: el => { const e = S.bita.find(x => x.id === el.dataset.id); if (e) openCellFix(e); },
  cellApply: el => {
    const e = S.bita.find(x => x.id === el.dataset.id); if (!e) return closeModal(); const a = e.action, row = (S.mas.rows[a.sec] || []).find(r => r._i === a.i);
    if (row) { row[a.f] = $('#cellval').value.trim(); runDry(); }
    closeModal(); render(); toast(`${e.origen}: corregido. Lote revalidado.`, 'ok');
  },
  cellGo: el => {
    const e = S.bita.find(x => x.id === el.dataset.id); if (!e) return; const a = e.action; closeModal();
    Object.assign(S.mas, {tab: 'carga', step: 'review', sec: a.sec, filter: 'all'}); S.view = 'masiva'; render();
    const n = document.getElementById(`mc_${a.sec}_${a.i}_${a.f}`); if (n) { n.scrollIntoView({block: 'center', inline: 'center'}); n.focus(); n.select(); }
  },
  bitaCli: el => {
    const e = S.bita.find(x => x.id === el.dataset.id); if (!e) return; const a = e.action, row = (S.mas.rows[a.sec] || []).find(r => r._i === a.i), c = S.clientes.find(x => x.id === a.cliente);
    if (!row || !c) return toast('No encontramos la fila o el cliente.', 'warn');
    Object.assign(row, {Nombre_Receptor: c.nombre, Regimen_Receptor: c.regimen, CP_Receptor: c.cp, Uso_CFDI: c.uso || row.Uso_CFDI}); runDry(); render(); toast(`Fila ${a.i + 2}: se tomaron régimen, CP y uso registrados de ${c.nombre}.`, 'ok');
  },
  bitaSkip: el => { const e = S.bita.find(x => x.id === el.dataset.id); if (!e) return; const id = e.action.item; S.mas.xi.items = S.mas.xi.items.filter(i => i.id !== id); S.bita = S.bita.filter(x => !(x.action && x.action.item === id)); bitaSave(); render(); toast('Archivo omitido.'); },
  bitaEm: el => { const e = S.bita.find(x => x.id === el.dataset.id); if (e) { A2.switchEm({value: e.action.emisor}); toast('Emisor cambiado. Vuelve a cargar ese XML.'); } },
  bitaEd: el => { const e = S.bita.find(x => x.id === el.dataset.id); if (!e) return; if (!S.draft) return toast('Ese borrador ya no está abierto.', 'warn'); S.view = S.draft.cp ? 'cartaporte' : 'factura'; A.fix({dataset: {f: e.action.fix}}); },
  bitaExp: el => bitaExport(el.dataset.k),
  bitaClear: () => { S.bita = S.bita.filter(e => e.fuente === 'excel'); bitaSave(); render(); toast('Historial vaciado. Los errores del lote actual se conservan.'); }
});
Object.assign(A2, {
  loteFile: async el => { const f = el.files[0]; if (!f) return; progStart('excel', 1, 'Leyendo ' + f.name + '…'); try { const t = await readTableFile(f); await loteConProgreso(t, f.name, {}); render(); } catch (e) { S.mas.prog = null; bitaLog({fuente: 'excel', origen: f.name, ref: '', code: 'EXCEL_ILEGIBLE', diag: e.message}); bitaSave(); toast(e.message, 'bad'); render(); } },
  xmlFiles: async el => { const fs = Array.from(el.files || []); if (!fs.length) return; await xmlProcess(fs); render(); }
});
const _emitirLote = emitirLote;
emitirLote = async function (onProg) { const r = await _emitirLote(onProg); r.fails.forEach(f => bitaLog({fuente: 'timbrado', origen: `Lote · ${f.key}`, ref: f.key, code: 'ERROR_TIMBRADO', diag: f.m})); return r; };
document.addEventListener('input', e => { const el = e.target; if (el.dataset.bf !== undefined && el.tagName === 'INPUT') { S.bf[el.dataset.bf] = el.value; clearTimeout(window._bfT); window._bfT = setTimeout(() => { const pos = el.selectionStart; render(); const n = $('#bf_q'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }, 250); } });
document.addEventListener('change', e => { const el = e.target; if (el.dataset.bf !== undefined && el.tagName === 'SELECT') { S.bf[el.dataset.bf] = el.value; render(); } });
