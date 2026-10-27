/* ============ c_ClaveUnidad (catCFDI): catálogo completo para conceptos y para las mercancías de Carta Porte ============
   Instructivo Carta Porte 3.1, Mercancia@ClaveUnidad: “registrar o seleccionar una clave del catálogo catCFDI:c_ClaveUnidad”.
   c_ClaveUnidadPeso (catCartaPorte) solo aplica a Mercancias@UnidadPeso (peso bruto total, KGM) y DetalleMercancia@UnidadPesoMerc. */
const UNIDAD_ORIG = CATSAT.unidad.map(x => [x[0], x[1]]);
const UNIDAD_MERC = ['KGM', 'H87', 'XBX', 'LTR', 'TNE', 'XPX', 'XSA', 'XUN', 'MTQ', 'XPK', 'XBG', 'XDR', 'XBJ', 'MTR', 'SET', 'KT', 'GRM', 'XCT', 'XRO'];
CB_POP['cp.merc.*.unidad'] = UNIDAD_MERC.slice(0, 15);
function unidadMercOpts(v) {
  const l = UNIDAD_MERC.filter(k => UNIDAD_MAP.has(k)).map(k => [k, UNIDAD_MAP.get(k)]);
  if (v && !l.some(x => x[0] === v)) l.unshift([v, UNIDAD_MAP.get(v) || 'No existe en c_ClaveUnidad']);
  return l;
}
/* Sustituye/complementa el catálogo en memoria (mismo arreglo y mismo Map: lo ven validaciones, Excel y buscadores) */
function unidadAplicar(items, modo) {
  let list = UNIDAD_ORIG;
  if (items && items.length) {
    if (modo === 'reemplazo') list = items;
    else { const m = new Map(UNIDAD_ORIG.map(x => [x[0], x])); items.forEach(x => m.set(x[0], x)); list = [...m.values()]; }
  }
  CATSAT.unidad.length = 0; list.forEach(x => CATSAT.unidad.push([x[0], x[1]]));
  UNIDAD_MAP.clear(); CATSAT.unidad.forEach(x => UNIDAD_MAP.set(x[0], x[1]));
  CAT.unidad = CAT.unidad.map(u => [u[0], UNIDAD_MAP.get(u[0]) || u[1]]);
  document.querySelectorAll('select').forEach(s => { delete s._cbItems; });
}
/* Extrae [clave, nombre] de las filas de la hoja c_ClaveUnidad (descarta claves con fin de vigencia vencido) */
function unidadDesdeFilas(rows) {
  const N = v => cbNorm(v == null ? '' : v);
  let h = rows.findIndex(r => r && r.some(c => /^(c_claveunidad|clave unidad|clave de unidad|claveunidad|clave)$/.test(N(c))));
  const hr = h >= 0 ? rows[h] : [], col = (re, def) => { const i = hr.findIndex(c => re.test(N(c))); return i >= 0 ? i : def; };
  const ck = col(/^(c_claveunidad|clave unidad|clave de unidad|claveunidad|clave)$/, 0), cn = col(/^nombre$/, 1), cf = col(/fin de vigencia|fechafin|vigencia fin/, -1);
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const fecha = v => {
    if (v == null || v === '') return null;
    if (typeof v === 'number') return new Date(Math.round((v - 25569) * 864e5));
    const s = String(v).trim(); let m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s); if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  };
  const items = [], seen = new Set(); let vencidas = 0;
  rows.slice(h + 1).forEach(r => {
    if (!r) return;
    let k = r[ck]; k = typeof k === 'number' ? String(k) : String(k ?? '').trim();
    const nom = String(r[cn] ?? '').trim();
    if (!/^[A-Za-z0-9]{1,3}$/.test(k) || !nom || seen.has(k)) return;
    const fin = cf >= 0 ? fecha(r[cf]) : null;
    if (fin && fin < hoy) { vencidas++; return; }
    seen.add(k); items.push([k, nom]);
  });
  return {items, vencidas};
}
async function unidadCargar(acct, u) {
  if (!u || !u.unidMeta) return unidadAplicar(null);
  try {
    const ch = (await Store.list(acct, 'catunidad')).sort((a, b) => a.n - b.n), items = ch.flatMap(c => c.items || []);
    unidadAplicar(items, u.unidMeta.modo || 'reemplazo');
  } catch (e) { unidadAplicar(null); }
}
const _loginUnid = login;
login = async function (id, u, keep) { await unidadCargar(id, u); return _loginUnid(id, u, keep); };
const _logoutUnid = logout;
logout = function () { unidadAplicar(null); return _logoutUnid.apply(this, arguments); };

function unidadEstadoHTML() {
  const m = S.user && S.user.unidMeta;
  return m ? `${chip(`${CATSAT.unidad.length.toLocaleString('es-MX')} claves en uso`, 'ok')} <span class="muted small">Subido por ti: ${esc(m.archivo)} · ${esc(m.fecha)} · ${m.modo === 'reemplazo' ? 'catálogo completo' : `${m.n.toLocaleString('es-MX')} claves agregadas al integrado`}${m.vencidas ? ` · ${m.vencidas} claves con vigencia vencida descartadas` : ''}</span>`
    : `${chip(`${CATSAT.unidad.length.toLocaleString('es-MX')} claves en uso`, 'ok')} <span class="muted small">Catálogo integrado: catCFDI versión 15/10/2026 (hoja c_ClaveUnidad).</span>`;
}
function unidadPanelHTML(enModal) {
  return `<p class="muted small">Esta lista se usa en la <b>unidad de los conceptos</b> y en la <b>unidad de cada mercancía de la Carta Porte</b> (Mercancia@ClaveUnidad). El catálogo de Carta Porte <span class="mono">c_ClaveUnidadPeso</span> solo aplica a la unidad del peso bruto total (KGM).</p>
  <div class="row wrap" style="margin:.5rem 0">${unidadEstadoHTML()}</div>
  <p class="muted small">Sube el catálogo del CFDI 4.0 tal como lo descargas del portal del SAT (<span class="mono">catCFDI_V_4_AAAAMMDD.xls</span>): tomamos solo la hoja <span class="mono">c_ClaveUnidad</span>. También acepta .xlsx o CSV con la clave en la primera columna y el nombre en la segunda. Si el archivo trae menos de 1,500 claves, se agregan a las que ya existen.</p>
  <div class="row wrap"><label class="btn${enModal ? '' : ' ghost'}" for="unidfile${enModal ? 'm' : ''}">Subir catálogo c_ClaveUnidad</label><input type="file" id="unidfile${enModal ? 'm' : ''}" accept=".xls,.xlsx,.csv,.txt" hidden data-a2="unidadFile">
  ${S.user && S.user.unidMeta ? '<button class="btn ghost sm" data-a="unidadReset">Volver al catálogo integrado</button>' : ''}<button class="btn ghost sm" data-a="unidadVer">Buscar una unidad</button></div>
  <p id="unidprog" class="small" role="status" aria-live="polite"></p>`;
}
A.unidadCat = () => openModal(`<h2>Catálogo c_ClaveUnidad</h2>${unidadPanelHTML(true)}<div class="row end"><button class="btn ghost" data-a="close">Cerrar</button></div>`);
A.unidadVer = () => {
  closeModal();
  openModal(`<h2>Buscar en c_ClaveUnidad</h2><p class="muted small">${CATSAT.unidad.length.toLocaleString('es-MX')} claves. Escribe la clave, el nombre o una palabra común (pieza, caja, tarima, litro…).</p>
    <div class="fld"><label for="cbi_unidad_ver">Unidad</label><select id="unidad_ver" data-combo="unidadAll" data-nocopy="1">${opts(CAT.unidad.map(u => [u[0], u[1]]), '', true, 'Escribe para buscar…')}</select></div>
    <p id="unidad_ver_t" class="small muted"></p><div class="row end"><button class="btn ghost" data-a="close">Cerrar</button></div>`);
  setTimeout(() => { const i = document.getElementById('cbi_unidad_ver'); if (i) i.focus(); }, 50);
};
document.addEventListener('change', e => { if (e.target.id === 'unidad_ver') { const t = $('#unidad_ver_t'); if (t) t.innerHTML = `Clave <b class="mono">${esc(e.target.value)}</b>: ${esc(UNIDAD_MAP.get(e.target.value) || '')}. Cópiala o elígela directamente en el campo Unidad.`; } });
A2.unidadFile = async el => {
  const f = el.files && el.files[0]; if (!f) return;
  const st = $('#unidprog'), msg = (t, cls = '') => { if (st) { st.textContent = t; st.className = 'small ' + cls; } };
  msg(`Leyendo ${f.name} (${(f.size / 1048576).toFixed(1)} MB)…`); await new Promise(r => setTimeout(r, 40));
  try {
    const sheets = await leerLibroCatalogo(f, n => /^c_ClaveUnidad(Peso)?$/i.test(String(n).trim()));
    const sh = sheets.find(s => /^c_ClaveUnidad$/i.test(String(s.name).trim())) || (sheets.length === 1 && !/^c_ClaveUnidadPeso$/i.test(String(sheets[0].name).trim()) ? sheets[0] : null);
    if (!sh) {
      if (sheets.some(s => /peso/i.test(s.name))) throw new Error('Este archivo es el catálogo de Carta Porte (c_ClaveUnidadPeso). Para la unidad de cada mercancía el SAT pide c_ClaveUnidad, que viene en el catálogo del CFDI 4.0 (catCFDI_V_4_AAAAMMDD.xls).');
      throw new Error('No encontramos la hoja c_ClaveUnidad en el archivo. Sube el catálogo del CFDI 4.0 (catCFDI) o un CSV con clave y nombre.');
    }
    msg('Procesando la hoja c_ClaveUnidad…'); await new Promise(r => setTimeout(r, 20));
    const {items, vencidas} = unidadDesdeFilas(sh.rows);
    if (items.length < 5) throw new Error('No reconocimos claves de unidad en el archivo. La primera columna debe tener la clave (H87, KGM, XBX…) y la segunda el nombre.');
    const modo = items.length >= 1500 ? 'reemplazo' : 'agregar', antes = new Set(CATSAT.unidad.map(x => x[0])), nuevas = items.filter(x => !antes.has(x[0])).length;
    msg(`Guardando ${items.length.toLocaleString('es-MX')} claves en tu base de datos…`);
    for (let i = 0; i < (S.user.unidChunks || 0); i++) await Store.del(docId('catunidad', 'u' + i));
    const size = 800, n = Math.ceil(items.length / size);
    for (let i = 0; i < n; i++) await Store.put(docId('catunidad', 'u' + i), {acct: S.acct, coll: 'catunidad', n: i, items: items.slice(i * size, (i + 1) * size)});
    S.user.unidChunks = n; S.user.unidMeta = {archivo: f.name, fecha: nowLocal().slice(0, 16).replace('T', ' '), n: items.length, modo, vencidas}; await saveUser();
    unidadAplicar(items, modo);
    const enModal = !$('#modal').hidden; render(); if (enModal) A.unidadCat();
    toast(`Catálogo c_ClaveUnidad cargado: ${CATSAT.unidad.length.toLocaleString('es-MX')} claves en uso${nuevas ? `, ${nuevas} nuevas` : ''}.`, 'ok');
  } catch (e) { msg(e.message || String(e), 'bad'); toast(e.message || String(e), 'bad'); }
  el.value = '';
};
A.unidadReset = async () => {
  for (let i = 0; i < (S.user.unidChunks || 0); i++) await Store.del(docId('catunidad', 'u' + i));
  S.user.unidChunks = 0; delete S.user.unidMeta; await saveUser(); unidadAplicar(null);
  const enModal = !$('#modal').hidden; render(); if (enModal) A.unidadCat(); toast('Se restauró el catálogo c_ClaveUnidad integrado.', 'ok');
};
/* Sección en “Productos y catálogo” */
const _productosUnid = VIEWS.productos;
VIEWS.productos = () => _productosUnid() + `<section class="block"><div class="bh"><h2>Catálogo c_ClaveUnidad (unidades de medida)</h2></div>${unidadPanelHTML(false)}</section>`;
