/* ============ CONTROL DE SERIES Y CONSECUTIVO DE FOLIOS INTERNOS (anti-duplicados) ============ */
/* Fuente de verdad: los CFDI de la base (emitidos aquí o importados) + el registro de folios leídos de XML
   históricos (doc "folios" por emisor). Un folio usado queda bloqueado aunque su CFDI esté cancelado. */
const SIN_SERIE = 'SIN SERIE';
const serieKey = s => String(s ?? '').trim().toUpperCase() || SIN_SERIE;
const serieDe = k => k === SIN_SERIE ? '' : k;
const folioNum = f => { const s = String(f ?? '').trim(); return /^\d{1,12}$/.test(s) ? Number(s) : null; };
const folioId = f => { const n = folioNum(f); return n !== null ? String(n) : String(f ?? '').trim().toUpperCase(); };
const fmtSF = (serie, folio) => { const k = serieKey(serie); return k === SIN_SERIE ? `${folio} (sin serie)` : `${k}${folio}`; };
const TIPO_TXT = {I: 'Ingreso', E: 'Egreso', T: 'Traslado', P: 'Pago (REP 2.0)', R: 'Retenciones', N: 'Nómina'};
const FOL_BLANK = () => ({xml: [], ajustes: {}, tipos: {}, reservas: {}, libres: {}});

S.folReg = {}; S._folVer = 0;
function folReg(emId) { emId = emId || (EM() || {}).id; return S.folReg[emId] || (S.folReg[emId] = Object.assign({emisorId: emId}, FOL_BLANK())); }
let folSaveT;
function folSave(emId) {
  const R = folReg(emId); S._folVer++; clearTimeout(folSaveT);
  folSaveT = setTimeout(() => { if (S.acct) Store.put(docId('folios', R.emisorId), Object.assign({acct: S.acct, coll: 'folios'}, R)).catch(() => {}); }, 250);
}
async function folLoad(acct) {
  S.folReg = {};
  try { (await Store.list(acct, 'folios')).forEach(d => { S.folReg[d.emisorId] = Object.assign(FOL_BLANK(), d); }); } catch (e) {}
  S._folVer++;
}

/* Huecos de una serie: [[desde, hasta], …] */
function huecosDe(nums) {
  const a = [...nums].sort((x, y) => x - y), out = [];
  for (let i = 1; i < a.length; i++) if (a[i] - a[i - 1] > 1) out.push([a[i - 1] + 1, a[i] - 1]);
  return out;
}
const nHuecos = h => h.reduce((t, [a, b]) => t + b - a + 1, 0);
function fmtRangos(h, max = 6) {
  const parts = h.slice(0, max).map(([a, b]) => a === b ? String(a) : b === a + 1 ? `${a}, ${b}` : `${a}–${b}`);
  return parts.join(', ') + (h.length > max ? ` y ${h.length - max} rangos más` : '');
}

let _folMemo = {k: '', v: null};
function seriesInfo(em) {
  em = em || EM(); if (!em) return new Map();
  const R = folReg(em.id), memoK = `${em.id}|${S.cfdis.length}|${S._folVer}|${JSON.stringify(em.series || {})}`;
  if (_folMemo.k === memoK) return _folMemo.v;
  const M = new Map(), seenU = new Set();
  const get = key => { if (!M.has(key)) M.set(key, {key, serie: serieDe(key), tipos: {}, count: 0, xml: 0, sist: 0, sim: 0, nums: new Set(), ids: new Map(), max: 0, ult: '', def: []}); return M.get(key); };
  const add = (serie, folio, tipo, uuid, src, rec, sim) => {
    const s = get(serieKey(serie)); s.count++; s[src]++; if (sim) s.sim++; s.tipos[tipo] = (s.tipos[tipo] || 0) + 1;
    const id = folioId(folio); if (id) { if (!s.ids.has(id)) s.ids.set(id, []); s.ids.get(id).push({uuid, src, id: rec && rec.id, estado: rec ? rec.estado : '', folio: String(folio)}); }
    const n = folioNum(folio); if (n !== null) { s.nums.add(n); if (n >= s.max) { s.max = n; s.ult = String(folio); } }
  };
  S.cfdis.filter(c => c.emisorId === em.id).forEach(c => { if (c.uuid) seenU.add(c.uuid); add(c.serie, c.folio, c.tipo, c.uuid, c.externo ? 'xml' : 'sist', c); });
  R.xml.forEach(([u, s, f, t, , sim]) => { if (u && seenU.has(u)) return; if (u) seenU.add(u); add(s, f, t, u, 'xml', null, sim); });
  Object.entries(R.tipos).forEach(([key, t]) => { const s = get(key); if (!(t in s.tipos)) s.tipos[t] = 0; s.manual = true; });
  Object.entries(em.series || {}).forEach(([t, ser]) => { const s = get(serieKey(ser)); if (!(t in s.tipos)) s.tipos[t] = 0; s.def.push(t); });
  M.forEach(s => { s.tipo = Object.entries(s.tipos).sort((a, b) => b[1] - a[1])[0]?.[0] || 'I'; s.huecos = huecosDe(new Set([...s.nums, ...(R.reservas[s.key] || []).map(r => r.folio).filter(n => n < s.max)])); s.ajuste = num(R.ajustes[s.key]) || 0; s.reservas = R.reservas[s.key] || []; });
  _folMemo = {k: memoK, v: M}; return M;
}
function folioUsado(serie, folio, exceptUuid) {
  const s = seriesInfo().get(serieKey(serie)); if (!s) return null;
  const l = s.ids.get(folioId(folio)); if (!l) return null;
  return l.find(x => !exceptUuid || x.uuid !== exceptUuid) || null;
}
/* Siguiente folio libre: último + 1 (high-water mark), o el ajuste manual; salta usados y reservados. */
function nextFree(serie, avoidExtra) {
  const em = EM(); if (!em) return 1;
  const key = serieKey(serie), s = seriesInfo(em).get(key), R = folReg(em.id);
  const used = s ? s.nums : new Set(), resv = new Set((R.reservas[key] || []).map(r => r.folio));
  const avoid = n => used.has(n) || resv.has(n) || (avoidExtra && avoidExtra.has(n));
  const lib = (R.libres[key] || []).filter(n => !avoid(n)).sort((a, b) => a - b); if (lib.length) return lib[0];
  let base = s && s.max ? s.max + 1 : 1;
  if (!(s && s.max)) { const t = Object.entries(em.series || {}).find(([, v]) => serieKey(v) === key); if (t) base = num((em.folios || {})[t[0]]) || 1; }
  const aj = num(R.ajustes[key]); if (aj > 0) base = aj;
  let guard = 0; while (avoid(base) && guard++ < 1e6) base++;
  return base;
}
function describeUso(u) { return `${u.estado === 'Cancelado' ? 'CFDI cancelado' : u.src === 'xml' ? 'CFDI importado de XML' : 'CFDI emitido'}${u.uuid ? ' · UUID ' + u.uuid.slice(0, 8) + '…' : ''}`; }

/* Registro de XML cargados: crea series nuevas y mueve el consecutivo */
function folRegistrar(list, o = {}) {
  const em = EM(), R = folReg(em.id), antes = new Set(seriesInfo(em).keys()), have = new Set(R.xml.map(x => x[0]).concat(S.cfdis.map(c => c.uuid)));
  const touched = new Set(), dups = [];
  list.forEach(x => {
    const key = serieKey(x.serie); touched.add(key);
    if (x.uuid && have.has(x.uuid)) return;
    const u = folioUsado(x.serie, x.folio, x.uuid) || (R.xml.find(y => y[0] !== x.uuid && serieKey(y[1]) === key && folioId(y[2]) === folioId(x.folio)) ? {uuid: '', src: 'xml', estado: ''} : null);
    if (u && x.folio) dups.push({x, u});
    R.xml.push([x.uuid, serieDe(key), String(x.folio || ''), x.tipo, x.fecha || '', o.sim ? 1 : 0]); have.add(x.uuid); S._folVer++;
  });
  folSave(em.id);
  const info = seriesInfo(em), nuevas = [...touched].filter(k => !antes.has(k));
  return {touched: [...touched].map(k => info.get(k)).filter(Boolean), nuevas, dups};
}

/* ---- Plantilla Excel: columna Folio ---- */
(function folioEnLayout() {
  const fs = LAYOUTS.ie.sections[0].fields, is = fs.findIndex(f => f.k === 'Serie');
  fs[is].d = 'Vacío = serie predeterminada del tipo (ver Series y folios). Si la serie no existe, se crea al timbrar.';
  fs.splice(is + 1, 0, fld('Folio', 0, 'Vacío = consecutivo automático (último folio de la serie + 1). Si lo capturas, se valida que no esté usado.', ['folio interno', 'no folio', 'numero de folio']));
  const _ej = LAYOUT_EJ.ie; LAYOUT_EJ.ie = () => { const e = _ej(); if (fs.some(f => f.k === 'Folio')) e.docs.forEach(r => { if (r.length === 24) r.splice(3, 0, ''); }); return e; };
  const _sample = sampleTables;
  sampleTables = function (key, erp) {
    if (key !== 'ie' || erp) return _sample(key, erp);
    const i = fs.findIndex(f => f.k === 'Folio'), [ff] = fs.splice(i, 1);
    try { const t = _sample(key, erp); t.forEach(x => { x.headers.splice(i, 0, 'Folio'); x.rows.forEach(r => { r.Folio = ''; }); }); return t; } finally { fs.splice(i, 0, ff); }
  };
})();

/* ---- Validación: folio duplicado en el editor ---- */
const _validarFol = validar;
validar = function (d, em) {
  const v = _validarFol(d, em);
  if (d && !S._enDry && ['I', 'E', 'T'].includes(d.tipo)) {
    if (!String(d.folio ?? '').trim()) v.E.push({m: 'Falta el folio interno. Usa el consecutivo automático de la serie.', ley: 'CFF art. 29-A fr. I (serie y folio)', attr: 'Folio', code: 'FOLIO_VACIO', fix: 'folioLibre'});
    else { const u = folioUsado(d.serie, d.folio); if (u) v.E.push({m: `El folio ${fmtSF(d.serie, d.folio)} ya se usó (${describeUso(u)}). Un folio interno no se reutiliza aunque el CFDI esté cancelado.`, ley: 'Control interno de folios; CFF art. 29-A fr. I', attr: 'Folio', code: 'FOLIO_INTERNO_DUPLICADO', fix: 'folioLibre'}); }
  }
  return v;
};
FIXES.folioLibre = {get l() { const d = S.draft; return d ? `Reasignar al siguiente folio libre (${fmtSF(d.serie, nextFree(d.serie))})` : 'Reasignar al siguiente folio libre'; }, run: d => { d.folio = String(nextFree(d.serie)); d._folioAuto = true; }};

/* ---- Consecutivo automático en borradores ---- */
const _setTipoFol = setTipo;
setTipo = function (d, tipo) { _setTipoFol(d, tipo); d._serieNueva = false; d.folio = String(nextFree(d.serie)); d._folioAuto = true; };
const _draftFromRecFol = draftFromRec;
draftFromRec = function (c) { const d = _draftFromRecFol(c); if (d) { d.folio = String(nextFree(d.serie)); d._folioAuto = true; } return d; };

function folBadge(d) {
  if (!d) return '';
  const nf = nextFree(d.serie), f = String(d.folio ?? '').trim(), u = f && folioUsado(d.serie, f);
  if (!f) return `${chip('Sin folio', 'bad')}<button class="btn sm" data-a="fix" data-f="folioLibre">Usar ${esc(fmtSF(d.serie, nf))}</button>`;
  if (u) return `${chip('Folio duplicado', 'bad')}<button class="btn sm" data-a="fix" data-f="folioLibre">Reasignar al siguiente folio libre (${esc(fmtSF(d.serie, nf))})</button>`;
  return '';
}
function serieFolioHTML(d) {
  const info = seriesInfo(), key = serieKey(d.serie), nueva = d._serieNueva || !info.has(key);
  const ORD = ['A', 'SC', SIN_SERIE, 'NC', 'P', 'R', 'T'], list = [...info.values()].sort((a, b) => { const x = ORD.indexOf(a.key), y = ORD.indexOf(b.key); return (x < 0 ? 99 : x) - (y < 0 ? 99 : y) || a.key.localeCompare(b.key); });
  const dup = String(d.folio ?? '').trim() && folioUsado(d.serie, d.folio);
  return `<div class="fld"><label for="b_serie_sel">Serie</label><select id="b_serie_sel" data-a2="serieSel">${list.map(s => `<option value="${esc(s.key)}"${s.key === key && !nueva ? ' selected' : ''}>${esc(s.key)}</option>`).join('')}<option value="__nueva"${nueva ? ' selected' : ''}>+ Nueva serie...</option></select>${nueva ? `<input id="b_serie" data-b="serie" class="mono up" maxlength="25" value="${esc(d.serie)}" placeholder="Ej. FA" aria-label="Nombre de la serie nueva">` : ''}</div>
  <div class="fld"><label for="b_folio">Folio interno</label><input id="b_folio" data-b="folio" class="mono${dup ? ' bad' : ''}" inputmode="numeric" value="${esc(d.folio)}"><div id="folbadge" class="folbadge">${folBadge(d)}</div></div>`;
}
const SERIE_FOLIO_RE = /<div class="fld "><label>Serie<\/label><input id="b_serie"[^>]*><\/div><div class="fld "><label>Folio<\/label><input id="b_folio"[^>]*><\/div>/;
['factura', 'cartaporte'].forEach(v => { const f = VIEWS[v]; VIEWS[v] = () => { const h = f(); return S.draft ? h.replace(SERIE_FOLIO_RE, serieFolioHTML(S.draft)) : h; }; });

/* ---- Folios en el lote (Excel): pre-asignación, duplicados y saltos ---- */
function asignarFoliosLote(res, sec) {
  const docs = res.docs, rowsOf = doc => doc.rows.filter(r => r.sec === sec).map(r => (S.mas.rows[sec] || []).find(x => x._i === r.i)).filter(Boolean);
  const provided = new Map(), asig = new Map(), seen = new Map(), setOf = (m, k) => m.get(k) || m.set(k, new Set()).get(k);
  docs.forEach(doc => { if (!doc.d) return; const h = rowsOf(doc)[0], f = h ? String(h.Folio ?? '').trim() : '', n = folioNum(f); if (f && n !== null) setOf(provided, serieKey(doc.d.serie)).add(n); });
  docs.forEach(doc => {
    if (!doc.d) return; const h = rowsOf(doc)[0], k = serieKey(doc.d.serie), f = h ? String(h.Folio ?? '').trim() : '';
    doc.d._simFalla = !!(S.mas.simFallas && S.mas.simFallas.has(doc.key));
    if (!f) return;
    const u = folioUsado(doc.d.serie, f), lk = k + '|' + folioId(f);
    if (u) addErr(doc.errs, `Folio duplicado: ${fmtSF(doc.d.serie, f)} ya se usó (${describeUso(u)}). Un folio interno no se reutiliza aunque el CFDI esté cancelado.`, sec, h, 'Folio', 'folioLote', 'FOLIO_INTERNO_DUPLICADO');
    else if (seen.has(lk)) addErr(doc.errs, `El folio ${fmtSF(doc.d.serie, f)} está repetido en este lote (también lo tiene ${seen.get(lk)}).`, sec, h, 'Folio', 'folioLote', 'FOLIO_INTERNO_DUPLICADO');
    else { seen.set(lk, doc.key); doc.d.folio = folioNum(f) !== null ? folioId(f) : f; doc.folioModo = 'manual'; const n = folioNum(f); if (n !== null) setOf(asig, k).add(n); }
    doc.ok = !doc.errs.length;
  });
  docs.forEach(doc => {
    if (!doc.d || !doc.ok || doc.folioModo) return; const k = serieKey(doc.d.serie), A = setOf(asig, k);
    const n = nextFree(doc.d.serie, new Set([...A, ...(provided.get(k) || [])])); doc.d.folio = String(n); A.add(n); doc.folioModo = 'auto';
  });
  docs.forEach(doc => { if (!doc.d) return; doc.note = [doc.ok || doc.folioModo === 'manual' ? `Folio ${fmtSF(doc.d.serie, doc.d.folio)} · ${doc.folioModo === 'manual' ? 'capturado' : 'consecutivo automático'}` : 'Folio pendiente: se asigna al corregir el documento', doc.note].filter(Boolean).join(' · '); });
  // Saltos de secuencia provocados por folios capturados
  asig.forEach((A, k) => {
    const serie = serieDe(k), start = nextFree(serie), nums = [...A].filter(n => n >= start).sort((a, b) => a - b); if (!nums.length) return;
    const s = seriesInfo().get(k), resv = new Set((folReg().reservas[k] || []).map(r => r.folio)), miss = [];
    for (let n = start; n < nums[nums.length - 1]; n++) if (!A.has(n) && !(s && s.nums.has(n)) && !resv.has(n)) miss.push(n);
    if (!miss.length) return;
    const rangos = []; miss.forEach(n => { const l = rangos[rangos.length - 1]; if (l && l[1] === n - 1) l[1] = n; else rangos.push([n, n]); });
    const culpable = docs.find(doc => doc.d && serieKey(doc.d.serie) === k && doc.folioModo === 'manual' && folioNum(doc.d.folio) > miss[0]);
    if (culpable) { const h = rowsOf(culpable)[0]; culpable.warns.push({m: `Folios faltantes detectados en Serie ${k}: ${fmtRangos(rangos)}. El folio capturado ${fmtSF(serie, culpable.d.folio)} rompe la secuencia; déjalo vacío para usar el consecutivo.`, cell: h ? `${sec}|${h._i}|Folio` : null, code: 'SALTO_FOLIO', sev: 'warn'}); }
  });
  S.mas.folAsig = Object.fromEntries([...asig].map(([k, A]) => [k, A]));
  const rang = [...asig].map(([k, A]) => { const a = [...A].sort((x, y) => x - y); if (!a.length) return ''; const r = []; a.forEach(n => { const l = r[r.length - 1]; if (l && l[1] === n - 1) l[1] = n; else r.push([n, n]); }); return r.slice(0, 3).map(([x, y]) => x === y ? fmtSF(serieDe(k), x) : `${fmtSF(serieDe(k), x)}–${y}`).join(', ') + (r.length > 3 ? '…' : ''); }).filter(Boolean);
  return rang;
}
const _dryIEFol = dryIE;
dryIE = function () {
  S._enDry = true; let res; try { res = _dryIEFol(); } finally { S._enDry = false; }
  const rang = asignarFoliosLote(res, 'docs'); res.poliza = polizaIE(res.docs);
  if (rang.length) res.poliza.splice(1, 0, ['Folios a asignar', rang.join(' · ')]);
  return res;
};
const _dryCPFol = dryCP;
dryCP = function () {
  S._enDry = true; let res; try { res = _dryCPFol(); } finally { S._enDry = false; }
  const rang = asignarFoliosLote(res, 'viajes'); if (rang.length) res.poliza.splice(1, 0, ['Folios a asignar', rang.join(' · ')]);
  return res;
};
function folioLoteSiguiente(cell) {
  const [sec, i] = String(cell).split('|'), R = S.mas.dry, di = R && R.rowDoc.get(sec + '|' + i), doc = di !== undefined && R ? R.docs[di] : null;
  const serie = doc && doc.d ? doc.d.serie : ((EM() || {}).series || {}).I || 'A', k = serieKey(serie);
  return {serie, n: nextFree(serie, (S.mas.folAsig || {})[k])};
}
const folioLoteLabel = cell => { const x = folioLoteSiguiente(cell); return fmtSF(x.serie, x.n); };

/* ---- Folios en pagos y retenciones ---- */
const _buildPagoFol = buildPago;
buildPago = function (P) { const r = _buildPagoFol(P), em = EM(); r.d.serie = (em.series || {}).P || 'P'; r.d.folio = String(nextFree(r.d.serie)); return r; };
const _emitirRetFol = emitirRet;
emitirRet = async function (R) { const em = EM(), s = (em.series || {}).R || 'R'; em.folios = em.folios || {}; em.folios.R = nextFree(s); return _emitirRetFol(R); };

/* ---- Vista: Control de Series y Folios ---- */
NAV.splice(NAV.findIndex(n => n[0] === 'comprobantes') + 1, 0, ['series', 'Series y folios']);
VIEWS.series = () => {
  const em = EM(); if (!em) return '<p class="empty">Configura primero tu perfil fiscal.</p>';
  const list = [...seriesInfo(em).values()].sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
  const tot = list.reduce((a, s) => a + s.count, 0), hue = list.reduce((a, s) => a + nHuecos(s.huecos), 0), xml = list.reduce((a, s) => a + s.xml, 0);
  return `<header class="ph"><div><p class="eyebrow">Control interno · ${esc(em.rfc)}</p><h1>Series y folios</h1></div><div class="row wrap"><button class="btn ghost" data-a="masTab" data-k="xml">Cargar XML históricos</button><button class="btn" data-a="serieNueva">Agregar serie</button></div></header>
  <p class="muted">Las series se crean solas al cargar XML de la empresa: tomamos <span class="mono">Serie</span>, <span class="mono">Folio</span> y <span class="mono">TipoDeComprobante</span> de cada comprobante y el consecutivo sigue del folio más alto. Un folio usado no se vuelve a asignar, aunque su CFDI esté cancelado. Los XML sin serie se agrupan en “${SIN_SERIE}”.</p>
  <div class="kpis"><div class="kpi"><span class="eyebrow">Series activas</span><b>${list.length}</b></div><div class="kpi"><span class="eyebrow">CFDI registrados</span><b>${tot.toLocaleString('es-MX')}</b><small class="muted">${xml.toLocaleString('es-MX')} desde XML</small></div><div class="kpi"><span class="eyebrow">Folios faltantes</span><b class="${hue ? 'tw-warn' : ''}">${hue.toLocaleString('es-MX')}</b><small class="muted">huecos de numeración</small></div></div>
  <div class="tw"><table class="sertbl"><thead><tr><th>Serie</th><th>Tipo de CFDI</th><th class="n">CFDI registrados</th><th>Último folio emitido</th><th>Próximo folio a asignar</th><th>Saltos de secuencia</th><th></th></tr></thead><tbody>
  ${list.map((s, i) => { const nf = nextFree(s.serie), otros = Object.keys(s.tipos).filter(t => t !== s.tipo);
    return `<tr><td><b class="mono">${esc(s.key)}</b>${s.def.length ? `<br><small class="muted">Predeterminada: ${s.def.map(t => TIPO_TXT[t] || t).join(', ')}</small>` : ''}${s.sim ? '<br>' + chip('Incluye simulación') : ''}</td>
    <td>${esc(TIPO_TXT[s.tipo] || s.tipo)}${otros.length ? `<br><small class="muted">También: ${otros.map(t => TIPO_TXT[t] || t).join(', ')}</small>` : ''}</td>
    <td class="n">${s.count.toLocaleString('es-MX')}<br><small class="muted">${s.xml} XML · ${s.sist} aquí</small></td>
    <td class="mono">${s.ult ? esc(fmtSF(s.serie, s.ult)) : '—'}</td>
    <td><div class="row nowrap"><input class="mono num" id="aj_${i}" value="${nf}" inputmode="numeric" aria-label="Próximo folio de la serie ${esc(s.key)}"><button class="btn sm ghost" data-a="folAjustar" data-k="${esc(s.key)}" data-in="aj_${i}">Ajustar</button></div>${s.ajuste ? `<small class="muted">Ajuste manual desde ${s.ajuste} · <button class="link" data-a="folAjQuitar" data-k="${esc(s.key)}">quitar</button></small>` : `<small class="muted">Último + 1</small>`}${s.reservas.length ? `<br><small class="muted">Reservados: ${s.reservas.map(r => r.folio).join(', ')}</small>` : ''}</td>
    <td>${s.huecos.length ? `${chip(nHuecos(s.huecos) + ' faltantes', 'warn')}<br><small class="muted">${esc(fmtRangos(s.huecos))}</small>` : chip('Sin saltos', 'ok')}</td>
    <td class="acts">${s.def.includes(s.tipo) ? '' : `<button class="btn sm ghost" data-a="folDefault" data-k="${esc(s.key)}" data-t="${s.tipo}">Usar para ${esc((TIPO_TXT[s.tipo] || s.tipo).split(' ')[0].toLowerCase())}</button>`}${s.xml && !s.sist ? `<button class="btn sm ghost" data-a="folQuitarXml" data-k="${esc(s.key)}">Quitar registros XML</button>` : ''}</td></tr>`; }).join('')}
  </tbody></table></div>
  <p class="muted small">¿Cambias de ejercicio? Crea una serie nueva (por ejemplo A26) o ajusta el próximo folio. Si eliges un número ya usado, el sistema salta al siguiente libre.</p>`;
};
function serieNuevaModal() {
  openModal(`<header class="mh"><h3>Agregar serie</h3><button class="x" data-a="close" aria-label="Cerrar">×</button></header>
  <div class="grid3"><div class="fld"><label for="sn_s">Serie</label><input id="sn_s" class="mono up" maxlength="25" placeholder="FA"></div>
  <div class="fld"><label for="sn_t">Tipo de CFDI</label><select id="sn_t">${opts(Object.entries(TIPO_TXT).filter(([k]) => k !== 'N'), 'I', false)}</select></div>
  <div class="fld"><label for="sn_f">Folio inicial</label><input id="sn_f" class="mono" inputmode="numeric" value="1"></div></div>
  <label class="check"><input type="checkbox" id="sn_def"> Usarla como serie predeterminada de ese tipo</label><p class="ferr" id="sn_err" hidden></p>
  <footer class="mf"><button class="btn ghost" data-a="close">Cancelar</button><button class="btn" data-a="serieGuardar">Guardar serie</button></footer>`);
}
