/* ============ MOTOR RELACIONAL DE CATÁLOGOS GEOGRÁFICOS DEL SAT (Carta Porte 3.1) ============ */
/* Puente c_CodigoPostal → c_Estado, c_Municipio (clave compuesta estado+municipio), c_Localidad (estado+localidad)
   y c_Colonia (colonias por CP). Datos del catálogo oficial catCFDI del SAT; CP y colonias se leen por prefijo. */
const GEO_PAIS = CATSAT.paises;
/* Códigos oficiales de la matriz de errores Carta Porte 3.1 para el domicilio */
const GEO_CODE = {Colonia: 'CP143', Localidad: 'CP144', Municipio: 'CP145', Estado: 'CP146', CodigoPostal: 'CP147', Pais: 'CP147'}, GEO_CODES = new Set(Object.values(GEO_CODE));
/* Catálogos oficiales: municipios y localidades completos; CP y colonias se cargan por prefijo (data/geo/NN.json) */
const GEO_MUN = CATSAT.mun, GEO_LOC = CATSAT.loc;
/* Respaldo integrado (datos oficiales) para los CP de ejemplo si el visor no puede leer los archivos de datos */
const GEO_CP = Object.fromEntries(Object.entries(CATSAT.cpDemo).map(([k, v]) => [k, {e: v.cp[0], m: v.cp[1], l: v.cp[2] || null, f: v.cp[3], c: v.col}]));
const GEO_SH = {}, GEO_LOADING = {}, GEO_PREF = new Set(["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13", "14", "15", "16", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31", "32", "33", "34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46", "47", "48", "49", "50", "51", "52", "53", "54", "55", "56", "57", "58", "59", "60", "61", "62", "63", "64", "65", "66", "67", "68", "69", "70", "71", "72", "73", "74", "75", "76", "77", "78", "79", "80", "81", "82", "83", "84", "85", "86", "87", "88", "89", "90", "91", "92", "93", "94", "95", "96", "97", "98", "99"]); let GEO_ERR = '';
function geoShard(cp) { const d = GEO_SH[cp.slice(0, 2)]; if (!d || !d.cp[cp]) return null; const v = d.cp[cp]; return {e: v[0], m: v[1], l: v[2] || null, f: v[3], c: d.col[cp] || []}; }
const geoPending = cp => /^\d{5}$/.test(String(cp || '')) && !GEO_SH[String(cp).slice(0, 2)] && !GEO_ERR;
function geoFetch(pre) {
  if (GEO_SH[pre]) return Promise.resolve(GEO_SH[pre]);
  return GEO_LOADING[pre] || (GEO_LOADING[pre] = (GEO_PREF.has(pre) ? fetch(`data/geo/${pre}.json`).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }) : Promise.resolve({cp: {}, col: {}})).then(d => { GEO_SH[pre] = d; return d; }).catch(e => { GEO_SH[pre] = {cp: {}, col: {}, err: true}; GEO_ERR = 'No se pudo leer el catálogo de códigos postales en este visor (' + (e.message || e) + '). Se usan los CP de respaldo.'; delete GEO_LOADING[pre]; return GEO_SH[pre]; }));
}
async function geoEnsure(cps) { const pres = [...new Set(cps.map(c => String(c || '').trim()).filter(c => /^\d{5}$/.test(c)).map(c => c.slice(0, 2)))].filter(p => !GEO_SH[p]); await Promise.all(pres.map(geoFetch)); return pres.length; }
S.geoImport = null;
const geoK = v => parseClave(String(v ?? '').trim());
function munNombre(e, m) { const I = S.geoImport; return (I && I.mun[e] && I.mun[e][m]) || (GEO_MUN[e] || {})[m] || ''; }
function locNombre(e, l) { const I = S.geoImport; return (I && I.loc[e] && I.loc[e][l]) || (GEO_LOC[e] || {})[l] || ''; }
function munList(e) { const I = S.geoImport; return Object.entries(Object.assign({}, GEO_MUN[e] || {}, (I && I.mun[e]) || {})).sort((a, b) => a[0].localeCompare(b[0])); }
function locList(e) { const I = S.geoImport; return Object.entries(Object.assign({}, GEO_LOC[e] || {}, (I && I.loc[e]) || {})).sort((a, b) => a[0].localeCompare(b[0])); }
function geoInfo(cp) {
  cp = String(cp ?? '').trim(); if (!/^\d{5}$/.test(cp)) return null;
  const I = S.geoImport, g = geoShard(cp) || (I && I.cp[cp]) || GEO_CP[cp]; if (!g) return null;
  const col = g.c || (I && I.col[cp]) || [];
  return {cp, estado: g.e, municipio: g.m || '', localidad: g.l || '', franja: g.f, colonias: col, estNombre: lbl(CAT.estados, g.e), munNombre: munNombre(g.e, g.m), locNombre: g.l ? locNombre(g.e, g.l) : ''};
}
/* Completa claves desde el CP. forzar = sobrescribe estado, municipio y localidad (al cambiar el CP o autocorregir). */
function geoCompletar(u, forzar) {
  const auto = [], pais = geoK(u.pais).toUpperCase();
  if (!pais || (forzar && pais !== 'MEX' && !u.extranjero)) { if (pais !== 'MEX') auto.push('Pais'); u.pais = 'MEX'; } else u.pais = pais;
  const g = geoInfo(u.cp); if (!g || u.pais !== 'MEX') return auto;
  [['estado', g.estado, 'Estado'], ['municipio', g.municipio, 'Municipio'], ['localidad', g.localidad, 'Localidad']].forEach(([k, v, n]) => {
    const cur = geoK(u[k]); if (forzar ? cur !== v : !cur) { u[k] = v; auto.push(n); } else u[k] = cur;
  });
  const col = geoK(u.colonia), ok = g.colonias.some(c => c[0] === col);
  if (ok) u.colonia = col;
  else if (!col || forzar) { const nv = g.colonias.length === 1 ? g.colonias[0][0] : ''; if (col !== nv) { u.colonia = nv; auto.push('Colonia'); } }
  return auto;
}
function geoProblemas(u) {
  const P = [], add = (attr, m) => P.push({attr, m}), g = geoInfo(u.cp), pais = geoK(u.pais || 'MEX').toUpperCase();
  if (pais !== 'MEX') return P;
  const est = geoK(u.estado).toUpperCase(), mun = geoK(u.municipio), loc = geoK(u.localidad), col = geoK(u.colonia);
  const hint = (k, n) => g ? ` (según el CP: ${k} - ${n})` : '';
  if (est && !CAT.estados.some(x => x[0] === est)) add('Estado', `el estado “${u.estado}” es texto libre; va la clave c_Estado${hint(g && g.estado, g && g.estNombre)}`);
  else if (g && est && est !== g.estado) add('Estado', `el estado ${est} no corresponde al CP ${u.cp}${hint(g.estado, g.estNombre)}`);
  if (mun && !/^\d{3}$/.test(mun)) add('Municipio', `el municipio “${u.municipio}” es texto libre; va la clave c_Municipio de 3 dígitos${hint(g && g.municipio, g && g.munNombre)}`);
  else if (g && mun && mun !== g.municipio) add('Municipio', `el municipio ${mun} no corresponde al CP ${u.cp}${hint(g.municipio, g.munNombre)}`);
  if (loc && !/^\d{2}$/.test(loc)) add('Localidad', `la localidad “${u.localidad}” es texto libre; va la clave c_Localidad de 2 dígitos${g && g.localidad ? hint(g.localidad, g.locNombre) : ''}`);
  else if (g && loc && loc !== g.localidad) add('Localidad', g.localidad ? `la localidad ${loc} no corresponde al CP ${u.cp}${hint(g.localidad, g.locNombre)}` : `el CP ${u.cp} es rural y no tiene localidad en c_Localidad; deja la localidad vacía (se omite el atributo en el XML)`);
  const validas = g ? g.colonias.slice(0, 6).map(c => `${c[0]} - ${c[1]}`).join(', ') : '';
  if (col && !/^\d{4}$/.test(col)) add('Colonia', `la colonia “${u.colonia}” es texto libre; va la clave c_Colonia de 4 dígitos${validas ? ` (válidas para el CP: ${validas})` : ''}`);
  else if (g && col && !g.colonias.some(c => c[0] === col)) add('Colonia', `la colonia ${col} no pertenece al CP ${u.cp} (válidas: ${validas || 'ninguna en el catálogo'})`);
  return P;
}
/* Excel: completa las columnas autocalculadas y las escribe de vuelta en la fila para que se vean en la revisión */
function geoCompletarFila(r, u) {
  ['pais', 'estado', 'municipio', 'localidad', 'colonia'].forEach(k => { const v = geoK(u[k]); if (/^[A-Z]{3}$|^\d{2,4}$/i.test(v)) u[k] = v; });
  geoCompletar(u, false);
  const map = {Pais: 'pais', Clave_Estado: 'estado', Clave_Municipio: 'municipio', Clave_Localidad: 'localidad', Colonia: 'colonia'};
  Object.entries(map).forEach(([c, k]) => { if (!String(r[c] ?? '').trim() && u[k]) r[c] = u[k]; });
}

/* ---- Validación cruzada geográfica ---- */
const _validarCPGeo = validarCP;
validarCP = function (d, em, err, warn) {
  _validarCPGeo(d, em, err, warn);
  d.cp.ubic.forEach((u, i) => {
    const n = `${u.tipo} ${i + 1}: `; if (!/^\d{5}$/.test(u.cp || '')) return;
    geoProblemas(u).forEach(p => err(n + `domicilio no válido según el catálogo c_CodigoPostal del SAT: ${p.m}.`, 'Complemento Carta Porte 3.1, Ubicacion/Domicilio; catálogos c_CodigoPostal, c_Estado, c_Municipio, c_Localidad y c_Colonia', 'geoFix', p.attr, GEO_CODE[p.attr] || 'CP147'));
    if (geoPending(u.cp)) { geoEnsure([u.cp]).then(() => { if (S.draft && ['factura', 'cartaporte'].includes(S.view)) render(); }); return; }
    if (geoK(u.pais || 'MEX').toUpperCase() === 'MEX' && !geoInfo(u.cp) && !GEO_ERR) err(n + `el código postal ${u.cp} no existe en el catálogo c_CodigoPostal vigente del SAT.`, 'c_CodigoPostal', null, 'CodigoPostal', 'CP147');
    if (false) warn(n + `el CP ${u.cp} no está en el catálogo c_CodigoPostal cargado, así que no se completaron ni validaron sus claves. Importa el catálogo oficial en Flota y rutas.`, 'c_CodigoPostal', null, 'Domicilio');
  });
};
FIXES.geoFix = {l: 'Autocorregir claves según Código Postal SAT', run: d => { if (d.cp) d.cp.ubic.forEach(u => geoCompletar(u, true)); }};

/* ---- Formulario de Ubicaciones con autocompletado ---- */
function ubicGeoHTML(u, i) {
  const p = `cp.ubic.${i}`, g = geoInfo(u.cp), full = /^\d{5}$/.test(u.cp || ''), probs = full ? geoProblemas(u) : [], est = geoK(u.estado).toUpperCase(), muns = munList(est), locs = locList(est);
  const ko = list => list.map(([k, n]) => [k, `${k} - ${n}`]);
  const status = !full ? '<span class="muted small">Escribe el código postal: completamos País, Estado, Municipio, Localidad y Colonia con las claves del SAT.</span>'
    : geoPending(u.cp) ? `${chip('Consultando c_CodigoPostal…')}`
    : !g && GEO_ERR ? `${chip('Catálogo de CP no disponible en este visor', 'warn')}<span class="muted small">${esc(GEO_ERR)} Elige estado y municipio a mano.</span>`
    : !g ? `${chip('CP inexistente en c_CodigoPostal', 'bad')}<span class="muted small">Revisa el código postal: no está en el catálogo vigente del SAT.</span>`
    : probs.length ? `${chip('Domicilio no coincide con el CP', 'bad')}<button class="btn sm" data-a="geoFixUbic" data-i="${i}">Autocorregir claves según Código Postal SAT</button>`
    : chip(`Claves SAT completadas desde el CP ${u.cp}`, 'ok');
  const munVal = geoK(u.municipio), colVal = geoK(u.colonia);
  return `<div class="geo"><div class="geostat" id="geostat_${i}">${status}</div><div class="grid4">
    ${F('Código postal', inp(p + '.cp', u.cp, `class="mono" maxlength="5" inputmode="numeric" autocomplete="off" data-geocp="${i}"`))}
    ${F('País (c_Pais)', '<input value="MEX - México" readonly class="ro" aria-label="País">')}
    ${F('Estado (c_Estado)', sel(p + '.estado', ko(CAT.estados), CAT.estados.some(x => x[0] === est) ? est : '', false, est && !CAT.estados.some(x => x[0] === est) ? `Texto libre: ${u.estado}` : 'Selecciona…', 'data-r="1"'), 'span2')}
    ${F('Municipio (c_Municipio)', muns.length ? sel(p + '.municipio', ko(muns), muns.some(m => m[0] === munVal) ? munVal : '', false, munVal && !muns.some(m => m[0] === munVal) ? `No válido: ${u.municipio}` : 'Selecciona…', 'data-r="1"') : inp(p + '.municipio', u.municipio, 'class="mono" maxlength="3" placeholder="039"'), 'span2')}
    ${F('Localidad (c_Localidad)', sel(p + '.localidad', ko(locs), locs.some(l => l[0] === geoK(u.localidad)) ? geoK(u.localidad) : '', false, 'Sin Localidad (Se omite atributo en XML)', 'data-r="1"'), 'span2')}
    ${F('Colonia (c_Colonia)', g ? sel(p + '.colonia', ko(g.colonias), g.colonias.some(c => c[0] === colVal) ? colVal : '', false, colVal && !g.colonias.some(c => c[0] === colVal) ? `No válida: ${u.colonia}` : g.colonias.length ? 'Selecciona…' : 'Sin colonias en el catálogo', 'data-r="1"') : inp(p + '.colonia', u.colonia, 'class="mono" maxlength="4" placeholder="0001"'), 'span2')}
    ${F('Calle y número', inp(p + '.calle', u.calle), 'span2')}
  </div></div>`;
}
function rutaHTML(d) {
  const cp = d.cp, tot = r2(cp.ubic.filter(u => u.tipo === 'Destino').reduce((a, u) => a + num(u.dist), 0)), ubO = S.ubicaciones.map(u => [u.id, `${u.alias} · CP ${u.cp}`]);
  return `<section class="card cpcard"><h2><span class="n">CP</span>Ruta</h2><p class="muted small mono">IdCCP ${esc(cp.idccp)} · Distancia total ${f2(tot)} km</p>
  ${cp.ubic.map((u, i) => `<div class="ubic"><div class="chead"><b>${u.tipo === 'Origen' ? 'Origen' : 'Destino'}</b>${S.ubicaciones.length ? `<select class="sm" data-a2="pickUbic" data-i="${i}">${opts(ubO, '', false, 'Usar ubicación guardada…')}</select>` : ''}${cp.ubic.length > 2 && i > 0 ? `<button class="x" data-a="delUbic" data-i="${i}" aria-label="Quitar">×</button>` : ''}</div><div class="grid4">
    ${F('RFC ' + (u.tipo === 'Origen' ? 'remitente' : 'destinatario'), inp(`cp.ubic.${i}.rfc`, u.rfc, 'class="mono up" maxlength="13"'))}${F('Nombre', inp(`cp.ubic.${i}.nombre`, u.nombre, 'class="up"'), 'span2')}
    ${F(u.tipo === 'Origen' ? 'Fecha y hora de salida' : 'Llegada estimada', inp(`cp.ubic.${i}.fecha`, u.fecha, 'type="datetime-local"'))}
    ${u.tipo === 'Destino' ? F('Distancia desde el punto anterior (km)', inp(`cp.ubic.${i}.dist`, u.dist, 'inputmode="decimal" class="mono"')) : ''}
  </div>${ubicGeoHTML(u, i)}</div>`).join('')}
  <button class="btn ghost sm" data-a="addUbic">Agregar otro destino</button></section>`;
}
const RUTA_RE = /<section class="card cpcard"><h2><span class="n">CP<\/span>Ruta<\/h2>[\s\S]*?<\/section>/;
const _cartaPorteHTMLGeo = cartaPorteHTML;
cartaPorteHTML = function (d) { return _cartaPorteHTMLGeo(d).replace(RUTA_RE, () => rutaHTML(d)); };

document.addEventListener('input', e => {
  const el = e.target; if (el.dataset.geocp === undefined || !S.draft || !S.draft.cp) return;
  const u = S.draft.cp.ubic[+el.dataset.geocp]; if (!u) return; const v = el.value.replace(/\D/g, '').slice(0, 5);
  if (v.length === 5 && v !== u._geoCp) { u.cp = v; u._geoCp = v; geoEnsure([v]).then(() => { if (u.cp !== v) return; geoCompletar(u, true); render(); const n = document.getElementById(el.id); if (n) { n.focus(); n.setSelectionRange(5, 5); } }); }
  if (v.length < 5) u._geoCp = '';
}, true);
const _pickUbicGeo = A2.pickUbic;
A2.pickUbic = async el => { _pickUbicGeo(el); const u = S.draft && S.draft.cp && S.draft.cp.ubic[+el.dataset.i]; if (!u) return; await geoEnsure([u.cp]); if (geoInfo(u.cp)) { geoCompletar(u, true); render(); } };

/* ---- Excel / lote: autocorrección por fila ---- */
function geoFixFila(sec, i) {
  const row = (S.mas.rows[sec] || []).find(r => r._i === +i); if (!row) return false;
  const u = {cp: pad0(row.Codigo_Postal, 5), pais: '', estado: '', municipio: '', localidad: '', colonia: row.Colonia};
  if (!geoInfo(u.cp)) return false; geoCompletar(u, true);
  Object.assign(row, {Pais: u.pais, Clave_Estado: u.estado, Clave_Municipio: u.municipio, Clave_Localidad: u.localidad, Colonia: u.colonia}); return true;
}
Object.assign(A, {
  geoFixUbic: async el => { const u = S.draft && S.draft.cp && S.draft.cp.ubic[+el.dataset.i]; if (!u) return; await geoEnsure([u.cp]); geoCompletar(u, true); render(); toast(`Claves de ${u.tipo.toLowerCase()} corregidas según el CP ${u.cp}.`, 'ok'); },
  geoFixLote: el => {
    const [sec, i] = String(el.dataset.cell).split('|');
    if (!geoFixFila(sec, i)) return toast('Ese CP no está en el catálogo cargado: no hay claves para autocorregir.', 'warn');
    runDry(); closeModal(); render(); toast('Claves de domicilio corregidas según el Código Postal SAT. Lote revalidado.', 'ok');
  },
  geoInfoCP: async () => { const v = ($('#geoq') || {}).value || ''; await geoEnsure([v.trim()]); const g = geoInfo(v.trim()); $('#geores').innerHTML = g ? geoResHTML(g) : `<p class="muted small">${/^\d{5}$/.test(v.trim()) ? 'Ese CP no está en el catálogo cargado.' : 'Escribe un código postal de 5 dígitos.'}</p>`; }
});
const geoResHTML = g => `<div class="tw"><table><tbody><tr><th>País</th><td class="mono">MEX - México</td></tr><tr><th>Estado</th><td class="mono">${esc(g.estado)} - ${esc(g.estNombre)}</td></tr><tr><th>Municipio</th><td class="mono">${esc(g.municipio)} - ${esc(g.munNombre)}</td></tr><tr><th>Localidad</th><td class="mono">${g.localidad ? esc(g.localidad + ' - ' + g.locNombre) : 'Sin Localidad (se omite atributo en XML)'}</td></tr><tr><th>Colonias (${g.colonias.length})</th><td class="mono">${g.colonias.map(c => esc(c[0] + ' - ' + c[1])).join('<br>') || '—'}</td></tr><tr><th>Estímulo franja fronteriza</th><td>${g.franja ? 'Sí (IVA 8% posible)' : 'No'}</td></tr></tbody></table></div>`;

/* Revisión del lote: botón de autocorrección en el mensaje de error */
const _bitaActionsGeo = bitaActions;
bitaActions = function (e) {
  const a = e.action || {};
  if (GEO_CODES.has(e.code) && a.kind === 'cell') return `<button class="btn sm" data-a="geoFixLote" data-cell="${a.sec}|${a.i}|${a.f}">Autocorregir claves según Código Postal SAT</button>` + _bitaActionsGeo(e);
  if (GEO_CODES.has(e.code) && a.kind === 'fix') return `<button class="btn sm" data-a="bitaEd" data-id="${e.id}">Autocorregir claves según Código Postal SAT</button>`;
  return _bitaActionsGeo(e);
};
const _opcionesValidasGeo = opcionesValidas;
opcionesValidas = function (sec, row, f) {
  if (sec === 'ubic' && f === 'Colonia') { const g = geoInfo(pad0(row.Codigo_Postal, 5)); return g ? g.colonias.map(c => [c[0], `${c[0]} - ${c[1]}`]) : null; }
  if (sec === 'ubic' && ['Clave_Estado', 'Clave_Municipio', 'Clave_Localidad', 'Pais'].includes(f)) { const g = geoInfo(pad0(row.Codigo_Postal, 5)); if (g) return [[({Clave_Estado: g.estado, Clave_Municipio: g.municipio, Clave_Localidad: g.localidad, Pais: 'MEX'})[f], ({Clave_Estado: `${g.estado} - ${g.estNombre}`, Clave_Municipio: `${g.municipio} - ${g.munNombre}`, Clave_Localidad: g.localidad ? `${g.localidad} - ${g.locNombre}` : 'Sin Localidad (se omite en el XML)', Pais: 'MEX - México'})[f]]]; }
  return _opcionesValidasGeo(sec, row, f);
};

/* ---- Importación del catálogo oficial (CSV exportados de catCFDI) ---- */
async function geoLoad(acct) {
  S.geoImport = null;
  try { const ch = await Store.list(acct, 'geo'); if (ch.length) { const I = {cp: {}, col: {}, mun: {}, loc: {}}; ch.forEach(c => geoMerge(I, c.kind, c.items)); S.geoImport = I; } } catch (e) {}
}
function geoMerge(I, kind, items) {
  if (kind === 'cp') items.forEach(([cp, e, m, l]) => { I.cp[cp] = {e, m, l: l || null}; });
  if (kind === 'col') items.forEach(([k, cp, n]) => { (I.col[cp] = I.col[cp] || []).push([k, n]); });
  if (kind === 'mun') items.forEach(([m, e, n]) => { (I.mun[e] = I.mun[e] || {})[m] = n; });
  if (kind === 'loc') items.forEach(([l, e, n]) => { (I.loc[e] = I.loc[e] || {})[l] = n; });
}
function geoParse(text) {
  const rows = parseCSV(text), norm = s => normH(s);
  for (let h = 0; h < Math.min(rows.length, 15); h++) {
    const H = rows[h].map(norm), ix = k => H.indexOf(norm(k));
    if (ix('c_Colonia') >= 0 && ix('c_CodigoPostal') >= 0) { const a = ix('c_Colonia'), b = ix('c_CodigoPostal'), n = H.findIndex(x => x.startsWith('nombre')); return {kind: 'col', items: rows.slice(h + 1).filter(r => /^\d{1,4}$/.test(String(r[a] || '').trim()) && /^\d{4,5}$/.test(String(r[b] || '').trim())).map(r => [String(r[a]).trim().padStart(4, '0'), String(r[b]).trim().padStart(5, '0'), String(r[n] || '').trim()])}; }
    if (ix('c_CodigoPostal') >= 0 && ix('c_Estado') >= 0) { const a = ix('c_CodigoPostal'), e = ix('c_Estado'), m = ix('c_Municipio'), l = ix('c_Localidad'); return {kind: 'cp', items: rows.slice(h + 1).filter(r => /^\d{4,5}$/.test(String(r[a] || '').trim())).map(r => [String(r[a]).trim().padStart(5, '0'), String(r[e] || '').trim(), m >= 0 ? String(r[m] || '').trim().padStart(3, '0') : '', l >= 0 && String(r[l] || '').trim() ? String(r[l]).trim().padStart(2, '0') : ''])}; }
    if (ix('c_Municipio') >= 0 && ix('c_Estado') >= 0) { const a = ix('c_Municipio'), e = ix('c_Estado'), n = H.findIndex(x => x.startsWith('descripcion')); return {kind: 'mun', items: rows.slice(h + 1).filter(r => String(r[a] || '').trim()).map(r => [String(r[a]).trim().padStart(3, '0'), String(r[e] || '').trim(), String(r[n] || '').trim()])}; }
    if (ix('c_Localidad') >= 0 && ix('c_Estado') >= 0) { const a = ix('c_Localidad'), e = ix('c_Estado'), n = H.findIndex(x => x.startsWith('descripcion')); return {kind: 'loc', items: rows.slice(h + 1).filter(r => String(r[a] || '').trim()).map(r => [String(r[a]).trim().padStart(2, '0'), String(r[e] || '').trim(), String(r[n] || '').trim()])}; }
  }
  return null;
}
const GEO_KIND = {cp: 'c_CodigoPostal', col: 'c_Colonia', mun: 'c_Municipio', loc: 'c_Localidad'};
A2.importGeo = async el => {
  const fs = Array.from(el.files || []); if (!fs.length) return; const res = [];
  for (const f of fs) {
    const p = geoParse(await f.text()); if (!p || !p.items.length) { res.push(`${f.name}: no reconocimos el catálogo`); continue; }
    toast(`Importando ${GEO_KIND[p.kind]}: ${p.items.length.toLocaleString('es-MX')} registros…`);
    const old = (await Store.list(S.acct, 'geo')).filter(c => c.kind === p.kind); for (const c of old) await Store.del(docId('geo', `${c.kind}_${c.n}`));
    const size = 4000; for (let i = 0; i * size < p.items.length; i++) await Store.put(docId('geo', `${p.kind}_${i}`), {acct: S.acct, coll: 'geo', kind: p.kind, n: i, items: p.items.slice(i * size, (i + 1) * size)});
    res.push(`${GEO_KIND[p.kind]}: ${p.items.length.toLocaleString('es-MX')}`);
  }
  await geoLoad(S.acct); render(); toast('Catálogos geográficos: ' + res.join(' · '), 'ok');
};
A.geoClear = async () => { for (const c of await Store.list(S.acct, 'geo')) await Store.del(docId('geo', `${c.kind}_${c.n}`)); S.geoImport = null; render(); toast('Se quitaron los catálogos importados; queda el diccionario de prueba.'); };
const _flotaGeo = VIEWS.flota;
VIEWS.flota = () => { const I = S.geoImport; return _flotaGeo() + `<section class="block"><div class="bh"><h2>Catálogos geográficos del SAT</h2></div>
  <p class="muted">Con el código postal se completan País, Estado, Municipio, Localidad y Colonia de cada ubicación de Carta Porte. Catálogo oficial integrado (${esc(CATSAT.meta.archivo)}): ${CATSAT.meta.totales.cp.toLocaleString('es-MX')} códigos postales, ${CATSAT.meta.totales.colonias.toLocaleString('es-MX')} colonias, ${CATSAT.meta.totales.municipios.toLocaleString('es-MX')} municipios y ${CATSAT.meta.totales.localidades.toLocaleString('es-MX')} localidades. Si el SAT publica una versión más nueva, puedes importar sus hojas en CSV.</p>${GEO_ERR ? `<div class="alert warn"><span>${esc(GEO_ERR)}</span></div>` : ''}
  <div class="row wrap"><label class="btn ghost" for="geofile">Actualizar con una versión más nueva (CSV)</label><input type="file" id="geofile" accept=".csv,.txt" multiple hidden data-a2="importGeo">${I ? chip(`${Object.keys(I.cp).length.toLocaleString('es-MX')} CP · ${Object.keys(I.col).length.toLocaleString('es-MX')} CP con colonias`, 'ok') + '<button class="btn sm ghost" data-a="geoClear">Quitar catálogos importados</button>' : ''}</div>
  <div class="row wrap"><div class="fld"><label for="geoq">Probar un código postal</label><input id="geoq" class="mono" maxlength="5" inputmode="numeric" placeholder="64000"></div><button class="btn ghost sm" data-a="geoInfoCP">Consultar</button></div><div id="geores"></div></section>`; };
const _loginGeo = login;
login = async function (id, u, keep) { await geoLoad(id); return _loginGeo(id, u, keep); };
