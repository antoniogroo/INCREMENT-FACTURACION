/* ============ CATÁLOGOS OFICIALES DEL SAT EN LA EMISIÓN (c_ClaveProdServ, c_CodigoPostal, c_TasaOCuota, c_Pais) ============ */
const PS = {list: null, map: null, err: '', loading: null};
function psLoad() {
  if (PS.list || PS.loading) return PS.loading;
  PS.loading = fetch('data/prodserv.json').then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(l => { PS.list = l.map(x => [x[0], x[1], x[2], x[3], x[4], (x[0] + ' ' + x[1] + ' ' + x[4]).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')]); PS.map = new Map(PS.list.map(x => [x[0], x])); if (S.acct && ['factura', 'cartaporte', 'productos'].includes(S.view)) render(); })
    .catch(e => { PS.err = 'No se pudo leer c_ClaveProdServ en este visor (' + (e.message || e) + ').'; PS.loading = null; });
  return PS.loading;
}
const normQ = q => String(q || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
function psBuscar(q, n = 60) {
  const ws = normQ(q).split(/\s+/).filter(Boolean), out = [], seen = new Set();
  const push = p => { if (!seen.has(p[0])) { seen.add(p[0]); out.push(p); } };
  const mine = S.productos.map(p => [p.clave, p.descripcion]).concat(PRODSERV);
  for (const p of mine) { if (out.length >= n) break; const t = normQ(p[0] + ' ' + p[1]); if (!ws.length || ws.every(w => t.includes(w))) push([p[0], p[1], p[2]]); }
  if (PS.list && ws.length) {
    if (/^\d{2,8}$/.test(ws[0]) && ws.length === 1) { for (const p of PS.list) { if (out.length >= n) break; if (p[0].startsWith(ws[0])) push([p[0], p[1]]); } }
    else for (const p of PS.list) { if (out.length >= n) break; if (ws.every(w => p[5].includes(w))) push([p[0], p[1]]); }
  }
  return out.slice(0, n);
}
catalogHits = function (q, n = 40) { return psBuscar(q, n); };
openCatalog = function (onPick) {
  psLoad();
  const m2 = $('#modal2'); m2.hidden = false; m2.innerHTML = `<div class="sheet wide" role="dialog" aria-modal="true"><header class="mh"><h3>Catálogo c_ClaveProdServ del SAT</h3><button class="x" data-a="close2" aria-label="Cerrar">×</button></header>
  <div class="fld"><label for="catq">Busca por palabra, sinónimo o clave</label><input id="catq" placeholder="ej. flete, papel bond, 8411…" autocomplete="off"></div>
  <p class="muted small" id="catinfo"></p><div id="catres" class="catres"></div></div>`; $('#catq').focus();
  const run = () => {
    $('#catinfo').textContent = PS.list ? `Catálogo oficial vigente: ${PS.list.length.toLocaleString('es-MX')} claves (incluye palabras similares del SAT).` : PS.err || 'Cargando el catálogo oficial…';
    const res = psBuscar($('#catq').value, 60), pel = k => (PRODSERV.find(p => p[0] === k) || [])[2];
    $('#catres').innerHTML = res.length ? res.map(p => { const o = PS.map && PS.map.get(p[0]); return `<button type="button" class="catrow" data-k="${p[0]}" data-d="${esc(o ? o[1] : p[1])}"><span class="mono">${p[0]}</span><span>${esc(o ? o[1] : p[1])}${o && o[4] ? `<small class="muted"> · ${esc(o[4].slice(0, 90))}</small>` : ''}</span>${pel(p[0]) ? chip('Material peligroso', 'warn') : ''}${o && !o[3] ? chip('Sin estímulo frontera') : ''}</button>`; }).join('') : '<p class="muted">Sin resultados. Prueba otra palabra o el inicio de la clave.</p>';
  };
  $('#catq').addEventListener('input', run); run(); if (!PS.list && PS.loading) PS.loading.then(() => { if (!m2.hidden && $('#catq')) run(); });
  $('#catres').addEventListener('click', e => { const b = e.target.closest('.catrow'); if (b) { close2(); onPick(b.dataset.k, b.dataset.d); } });
};

/* ---- Validaciones contra catálogos oficiales ---- */
const _validarCat = validar;
validar = function (d, em) {
  const v = _validarCat(d, em); if (!d || !em) return v;
  const err = (m, ley, fix, attr, code) => v.E.push({m, ley, fix, attr, code}), warn = (m, ley, attr) => v.W.push({m, ley, attr});
  const cps = [d.lugarExp, d.receptor.cp].filter(c => /^\d{5}$/.test(c || ''));
  if (cps.some(geoPending)) geoEnsure(cps).then(() => { if (S.draft === d) updateSide(); });
  else {
    if (/^\d{5}$/.test(d.lugarExp || '') && !geoInfo(d.lugarExp) && !GEO_ERR) err(`El lugar de expedición ${d.lugarExp} no existe en el catálogo c_CodigoPostal del SAT.`, 'Anexo 20, LugarExpedicion; c_CodigoPostal', 'f_lugar', 'LugarExpedicion', 'CFDI40126');
    if (/^\d{5}$/.test(d.receptor.cp || '') && !geoInfo(d.receptor.cp) && !GEO_ERR) err(`El código postal del receptor ${d.receptor.cp} no existe en el catálogo c_CodigoPostal del SAT.`, 'Anexo 20, DomicilioFiscalReceptor; c_CodigoPostal', 'f_cp', 'DomicilioFiscalReceptor', 'CP_NO_EXISTE');
  }
  const R = d.receptor; if (rfcTipo(R.rfc) === 'EXT' && R.residencia) { const pa = String(R.residencia).toUpperCase(); if (!CAT.paises.some(p => p[0] === pa)) err(`La residencia fiscal ${pa} no existe en el catálogo c_Pais.`, 'Anexo 20, ResidenciaFiscal; c_Pais', 'f_res', 'ResidenciaFiscal', 'CFDI40150'); else if (pa === 'MEX') err('La residencia fiscal de un extranjero no puede ser MEX.', 'Anexo 20, ResidenciaFiscal', 'f_res', 'ResidenciaFiscal', 'CFDI40152'); }
  if (d.tipo === 'T') return v;
  const k = v.k, ge = geoInfo(d.lugarExp);
  d.conceptos.forEach((c, i) => {
    const n = `Concepto ${i + 1}: `, o = PS.map && /^\d{8}$/.test(c.clave || '') ? PS.map.get(c.clave) : null;
    if (PS.map && /^\d{8}$/.test(c.clave || '') && !o) err(n + `la clave ${c.clave} no existe en el catálogo c_ClaveProdServ vigente.`, 'c_ClaveProdServ (catCFDI)', null, 'ClaveProdServ', 'CFDI40162');
    if (c.unidad && !UNIDAD_MAP.has(c.unidad)) err(n + `la unidad ${c.unidad} no existe en el catálogo c_ClaveUnidad.`, 'c_ClaveUnidad', null, 'ClaveUnidad', 'CFDI40165');
    const l = k.lines[i] || {tras: [], ret: []};
    if (o && o[2] && ['01', '02', '05'].includes(c.objeto) && !l.tras.some(t => t.imp === '002')) err(n + `el catálogo c_ClaveProdServ indica “Incluir IVA trasladado: Sí” para la clave ${c.clave}: desglosa el IVA.`, 'c_ClaveProdServ, Incluir IVA trasladado', null, 'Impuestos', 'CFDI40164');
    l.tras.concat(l.ret).forEach(t => {
      const ret = l.ret.includes(t);
      if (!tasaPermitida(t.imp, t.factor, t.tasa, ret)) err(n + `${IMP_TXT[t.imp]} ${ret ? 'retenido' : 'trasladado'} ${t.factor}${t.factor === 'Exento' ? '' : ' ' + t.tasa} no existe en el catálogo c_TasaOCuota (vigente desde 01/02/2026).`, 'c_TasaOCuota', null, 'Impuestos', ret ? 'CFDI40185' : 'CFDI40179');
      if (t.imp === '002' && !ret && t.factor === 'Tasa' && Math.abs(num(t.tasa) - 0.08) < 1e-7) {
        if (ge && !ge.franja) err(n + `IVA 8% requiere que el lugar de expedición (${d.lugarExp}) tenga “Estímulo Franja Fronteriza” en c_CodigoPostal.`, 'c_CodigoPostal; Decreto región fronteriza (DOF 31/12/2025)', 'sinIva8', 'Impuestos', 'FRANJA_CP');
        if (o && !o[3]) err(n + `la clave ${c.clave} no aplica el estímulo de la región fronteriza (c_ClaveProdServ, Estímulo Franja Fronteriza = 0).`, 'c_ClaveProdServ', 'sinIva8', 'Impuestos', 'FRANJA_PRODSERV');
      }
    });
  });
  if (d.especial) { const keep = []; v.E.forEach(e => { if (['FRANJA_CP', 'FRANJA_PRODSERV', 'CFDI40179', 'CFDI40185', 'CFDI40126', 'CP_NO_EXISTE', 'CFDI40164', 'CFDI140228', 'CFDI40132', 'CFDI40134', 'CFDI40135'].includes(e.code)) v.W.push(Object.assign({}, e, {m: 'Advertencia: ' + e.m + ' El PAC valida esta regla y puede rechazar el timbrado.', exc: true})); else keep.push(e); }); v.E.length = 0; keep.forEach(e => v.E.push(e)); }
  return v;
};
/* Excel: claves de producto contra el catálogo oficial */
const _candadosCat = candados;
candados = function (sec, row, errs, warns) {
  _candadosCat(sec, row, errs, warns);
  if (sec === 'docs' && PS.map) { const k = pad0(row.Clave_ProdServ, 8); if (/^\d{8}$/.test(k) && !PS.map.has(k)) addErr(errs, `La clave ${k} no existe en el catálogo c_ClaveProdServ vigente.`, sec, row, 'Clave_ProdServ', 'cell', 'CFDI40162'); }
};
FULLCAT.Unidad = CATSAT.unidad; FULLCAT.Estado = CAT.estados; FULLCAT.Objeto = CAT.objetoImp; FULLCAT.Regimen = CAT.regimen; FULLCAT.Uso = CAT.uso; FULLCAT.Forma = CAT.formaPago; FULLCAT.Moneda = CAT.moneda.concat([['XXX', 'Sin moneda']]); FULLCAT.TipoRel = CAT.tipoRelacion;
/* Carta Porte desde Excel: carga los CP del lote antes de completar las claves */
async function geoEnsureLote() { const cps = (S.mas.rows.ubic || []).map(r => pad0(r.Codigo_Postal, 5)); const n = await geoEnsure(cps); return n; }
const _aplicarConProgresoCat = aplicarConProgreso;
aplicarConProgreso = async function (o = {}) {
  if (S.mas.layout === 'cp') { const L = LAYOUTS.cp, m = (S.mas.map.ubic || {}), t = S.mas.tables[m.sheet] || {rows: []}, col = (m.cols || {}).Codigo_Postal; if (col && col !== '=fijo') await geoEnsure(t.rows.map(r => pad0(r[col], 5))); }
  if (S.mas.layout === 'ie') await psLoad();
  return _aplicarConProgresoCat(o);
};
const _runDryCat = runDry;
runDry = function () {
  _runDryCat();
  if (S.mas.layout === 'cp') { const cps = (S.mas.rows.ubic || []).map(r => pad0(r.Codigo_Postal, 5)); if (cps.some(geoPending)) geoEnsure(cps).then(() => { _runDryCat(); if (S.view === 'masiva') render(); }); }
};
/* Objeto de impuesto: claves 06 a 08 del catálogo vigente */
OBJ_S.length = 0; CAT.objetoImp.forEach(o => OBJ_S.push([o[0], `${o[0]} ${o[1].replace(/^Sí objeto del impuesto, /, '').slice(0, 26)}`]));
/* Productos: información del catálogo integrado */
const _productosCat = VIEWS.productos;
VIEWS.productos = () => { psLoad(); return _productosCat().replace(/<p class="muted">Incluimos[\s\S]*?<\/p>/, () => `<p class="muted">${PS.list ? `Catálogo oficial integrado: <b>${PS.list.length.toLocaleString('es-MX')}</b> claves vigentes de ${esc(CATSAT.meta.archivo)} (revisión ${esc(CATSAT.meta.c_ClaveProdServ.version)}.${esc(CATSAT.meta.c_ClaveProdServ.revision)}, publicada ${esc(CATSAT.meta.c_ClaveProdServ.publicacion)}), con palabras similares y el indicador de estímulo de franja fronteriza.` : PS.err || 'Cargando el catálogo oficial c_ClaveProdServ…'} Si el SAT publica una versión más nueva, puedes importarla en CSV.</p>`); };
/* Al entrar: precarga el catálogo de productos y el prefijo del CP del emisor */
const _loginCat = login;
login = async function (id, u, keep) { const r = await _loginCat(id, u, keep); psLoad(); const em = EM(); if (em) geoEnsure([em.cp]); return r; };
