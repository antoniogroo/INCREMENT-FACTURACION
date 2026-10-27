/* ============ BUSCADOR RÁPIDO PARA CATÁLOGOS LARGOS (escribe clave, nombre o sinónimo) ============
   Cualquier <select> con más de CB_MIN opciones se convierte en un campo con búsqueda:
   el <select> original se queda oculto como fuente de verdad (mismos eventos change/input),
   así que la validación, los Excel y el resto de los módulos siguen funcionando igual. */
const CB_MIN = 12;
/* Palabras de uso diario → claves SAT (se usan solo si la clave existe en el catálogo del campo) */
const CB_SYN = {
  kg: 'KGM', kgs: 'KGM', kilo: 'KGM', kilos: 'KGM', kilogramo: 'KGM', kilogramos: 'KGM',
  gr: 'GRM', grs: 'GRM', g: 'GRM', gramo: 'GRM', gramos: 'GRM',
  ton: 'TNE', tons: 'TNE', tonelada: 'TNE', toneladas: 'TNE', t: 'TNE',
  l: 'LTR', lt: 'LTR', lts: 'LTR', litro: 'LTR', litros: 'LTR', ml: 'MLT', mililitro: 'MLT', mililitros: 'MLT',
  m3: 'MTQ', 'metro cubico': 'MTQ', 'metros cubicos': 'MTQ', m2: 'MTK', 'metro cuadrado': 'MTK', m: 'MTR', mt: 'MTR', mts: 'MTR', metro: 'MTR', metros: 'MTR', km: 'KMT',
  caja: 'XBX', cajas: 'XBX', cja: 'XBX', carton: 'XCT', cartones: 'XCT',
  tarima: 'XPX', tarimas: 'XPX', pallet: 'XPX', pallets: 'XPX', palet: 'XPX', palets: 'XPX', plt: 'XPX',
  saco: 'XSA', sacos: 'XSA', bulto: 'XSA', bultos: 'XSA', costal: 'XSA', costales: 'XSA',
  bolsa: ['XBG', 'XBG'], bolsas: 'XBG', paquete: 'XPK', paquetes: 'XPK', paq: 'XPK',
  pieza: ['H87', 'XUN', 'C62'], piezas: ['H87', 'XUN'], pza: ['H87', 'XUN'], pzas: ['H87', 'XUN'], pz: ['H87', 'XUN'], unidad: ['XUN', 'H87', 'C62'], unidades: ['XUN', 'H87'],
  servicio: 'E48', servicios: 'E48', actividad: 'ACT', honorarios: 'E48',
  tambo: 'XDR', tambos: 'XDR', tambor: 'XDR', tambores: 'XDR', cubeta: 'XBJ', cubetas: 'XBJ', barril: 'XBA', barriles: 'XBA', tina: 'XTB',
  rollo: 'XRO', rollos: 'XRO', paca: 'XBL', pacas: 'XBL', sobre: 'XEN', sobres: 'XEN', cajetilla: 'XPA', contenedor: 'XCN', contenedores: 'XCN', flejado: 'XBE',
  galon: 'GLL', galones: 'GLL', kit: ['KT', 'XKI'], juego: 'SET', conjunto: 'SET', lote: 'LO', hora: 'HUR', horas: 'HUR', dia: 'DAY', dias: 'DAY', mes: 'MON', meses: 'MON', ano: 'ANN', tarifa: 'A9', kwh: 'KWH',
  dolar: 'USD', dolares: 'USD', dlls: 'USD', usd: 'USD', peso: 'MXN', pesos: 'MXN', euro: 'EUR', euros: 'EUR',
  efectivo: '01', cheque: '02', transferencia: '03', spei: '03', tarjeta: ['04', '28'], credito: '04', debito: '28', 'por definir': '99', compensacion: '17', condonacion: '15',
  sueldos: '605', asalariado: '605', resico: '626', 'persona moral': '601', 'actividad empresarial': '612', arrendamiento: '606', 'sin obligaciones': '616', 'publico en general': '616',
  gastos: 'G03', mercancia: 'G01', mercancias: 'G01', devolucion: 'G02', 'sin efectos': 'S01', nomina: 'CN01', pagos: 'CP01', medicos: 'D01', colegiaturas: 'D10',
  torton: 'C3', rabon: 'C2', trailer: ['T3S2', 'T3S3'], 'full': ['T3S2R4', 'T3S2R3'], sencillo: 'T3S2', camioneta: 'C2', pickup: 'C2', thorton: 'C3',
  tanque: ['CTR001', 'CTR020'], pipa: ['CTR001', 'CTR020'], 'caja seca': 'CTR004', plataforma: 'CTR014', refrigerado: 'CTR006', dolly: 'CTR016'
};
/* Lo más usado primero (cuando el campo está vacío o al abrir) */
const CB_POP = {
  'cp.merc.*.unidad': ['KGM', 'XBX', 'LTR', 'TNE', 'XPX', 'XSA', 'XUN', 'MTQ', 'XPK', 'XBG', 'XDR', 'XBJ', 'XCT', 'XRO', 'GRM'],
  'conceptos.*.unidad': ['H87', 'E48', 'ACT', 'KGM', 'LTR', 'XBX', 'MTR', 'TNE', 'XUN', 'SET', 'KT', 'HUR'],
  'cp.merc.*.embalaje': ['4G', '1A1', '1H1', '4H2', '5H1', '6HA1', 'Z01'],
  'cp.veh.config': ['C2', 'C3', 'T3S2', 'T3S3', 'T3S2R4', 'C3R2', 'VL'],
  'cp.veh.perm': ['TPAF01', 'TPAF02', 'TPAF03', 'TPAF10'],
  moneda: ['MXN', 'USD', 'EUR', 'CAD'], formaPago: ['03', '01', '04', '28', '02', '99'], 'receptor.uso': ['G03', 'G01', 'S01', 'CP01', 'G02'], 'receptor.regimen': ['601', '612', '626', '605', '616', '606']
};
/* Catálogos completos para campos que muestran una lista corta pero aceptan todo el catálogo */
const CB_LISTS = {
  unidadAll: () => CATSAT.unidad,
  unidadPeso: () => CAT.unidadPeso
};
/* Sugerencias para campos de texto libre con catálogo enorme */
const CB_SUGGEST = {
  bienes: q => { if (!PSCP.list) { const pr = pscpLoad(); if (pr && pr.then) pr.then(() => cbRefresh()); return null; } if (!cbNorm(q)) return []; return psCpBuscar(q, 60).map(p => [p[0], p[1] + (p[2] === '1' ? ' · material peligroso' : p[2] === '0,1' ? ' · puede ser peligroso' : '')]); },
  mp: q => {
    if (!PSCP.mp) { const pr = pscpLoad(); if (pr && pr.then) pr.then(() => cbRefresh()); return null; }
    const qn = cbNorm(q).replace(/^un\s*/, ''), out = [];
    if (!qn) return [];
    const isNum = /^\d+$/.test(qn), toks = qn.split(/\s+/);
    for (const x of PSCP.mp.values()) {
      if (out.length >= 60) break;
      const t = x._n || (x._n = cbNorm(x[1]));
      if (isNum ? x[0].startsWith(qn) || x[0].startsWith(qn.padStart(4, '0')) : toks.every(w => t.includes(w))) out.push([x[0], `${x[1]} · clase ${x[2]}`]);
    }
    return out;
  }
};
const CB = {el: null, items: [], idx: 0, open: false, typed: false, total: 0, quiet: false};
function cbNorm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim(); }
const cbId = path => String(path || '').replace(/\.\d+\./g, '.*.');
function cbRecent(id) { try { return (JSON.parse(localStorage.getItem('folia.cb') || '{}')[id]) || []; } catch (e) { return []; } }
function cbRemember(id, k) { if (!id || !k) return; try { const o = JSON.parse(localStorage.getItem('folia.cb') || '{}'); o[id] = [k].concat((o[id] || []).filter(x => x !== k)).slice(0, 6); localStorage.setItem('folia.cb', JSON.stringify(o)); } catch (e) { /* sin almacenamiento: solo se pierde la memoria de recientes */ } }
/* Texto de una opción sin la clave al inicio: "KGM · Kilogramo" → "Kilogramo" */
function cbDesc(k, t) { t = String(t || ''); return t.startsWith(k) ? t.slice(k.length).replace(/^\s*[·\-–:]\s*/, '').trim() || t : t; }
function cbSel(el) { return el && el.dataset.cbsel ? document.getElementById(el.dataset.cbsel) : null; }
function cbPath(el) { const s = cbSel(el); return (s ? s.dataset.b || s.dataset.p || s.dataset.rt || s.dataset.f || s.id : el.dataset.b) || ''; }
/* Lista de [clave, descripción] para un campo */
function cbItems(el) {
  const s = cbSel(el);
  if (!s) return [];
  if (!s._cbItems) {
    const seen = new Set(), arr = [];
    [...s.options].forEach(o => { if (o.value !== '' && !seen.has(o.value)) { seen.add(o.value); arr.push([o.value, cbDesc(o.value, o.text)]); } });
    const ext = s.dataset.combo && CB_LISTS[s.dataset.combo] ? CB_LISTS[s.dataset.combo]() : [];
    ext.forEach(x => { if (!seen.has(x[0])) { seen.add(x[0]); arr.push([x[0], x[1]]); } });
    s._cbItems = arr;
  }
  return s._cbItems;
}
function cbScore(k, kn, tn, qn, toks, syn) {
  let s = 0;
  if (kn === qn) s = 1000;
  else if (syn.has(k)) s = 950 - [...syn].indexOf(k);
  else if (kn.startsWith(qn)) s = 800 - kn.length;
  if (!s) {
    const words = tn.split(/[\s,.;:()\/\-]+/);
    const allStart = toks.every(w => words.some(x => x.startsWith(w)) || kn.startsWith(w));
    if (allStart) s = 600 - Math.min(200, tn.indexOf(toks[0]) < 0 ? 200 : tn.indexOf(toks[0])) - Math.min(100, tn.length / 4);
    else if (toks.every(w => tn.includes(w) || kn.includes(w))) s = 300 - Math.min(100, tn.length / 4);
  }
  return s;
}
function cbSearch(el, q) {
  const id = cbId(cbPath(el)), rec = cbRecent(id), sug = el.dataset.suggest;
  if (sug) {
    const r = CB_SUGGEST[sug](q);
    if (r === null) return {list: [], total: 0, loading: true};
    const recs = !cbNorm(q) ? rec.map(k => [k, sug === 'mp' ? mpNombre(k) : ((PSCP.map && PSCP.map.get(k)) || [k, ''])[1]]).filter(x => x[1]).map(x => ({k: x[0], t: x[1], g: 'Usadas recientemente'})) : [];
    return {list: recs.concat(r.filter(x => !recs.some(y => y.k === x[0])).map(x => ({k: x[0], t: x[1], g: recs.length ? 'Catálogo' : ''}))), total: r.length};
  }
  const items = cbItems(el), qn = cbNorm(q);
  if (!qn) {
    const byK = new Map(items.map(x => [x[0], x])), out = [], seen = new Set();
    const push = (x, g) => { if (x && !seen.has(x[0])) { seen.add(x[0]); out.push({k: x[0], t: x[1], g}); } };
    rec.forEach(k => push(byK.get(k), 'Usadas recientemente'));
    (CB_POP[id] || []).forEach(k => push(byK.get(k), 'Más comunes'));
    const g = out.length ? 'Todo el catálogo' : '';
    for (const x of items) { if (out.length >= 80) break; push(x, g); }
    return {list: out, total: items.length};
  }
  const toks = qn.split(' '), syn = new Set([].concat(CB_SYN[qn] || [], ...toks.map(t => CB_SYN[t] || [])));
  const recS = new Set(rec), sc = [];
  for (const x of items) {
    const kn = x._kn || (x._kn = cbNorm(x[0])), tn = x._tn || (x._tn = cbNorm(x[1]));
    let s = cbScore(x[0], kn, tn, qn, toks, syn);
    if (s) { if (recS.has(x[0])) s += 60; sc.push([s, x]); }
  }
  sc.sort((a, b) => b[0] - a[0] || a[1][1].length - b[1][1].length);
  return {list: sc.slice(0, 80).map(([, x]) => ({k: x[0], t: x[1], g: ''})), total: sc.length};
}
/* ---- Popup único, posicionado sobre la página (no lo recortan tablas con scroll) ---- */
function cbPop() { let p = document.getElementById('cbpop'); if (!p) { p = document.createElement('div'); p.id = 'cbpop'; p.className = 'cbpop'; p.setAttribute('role', 'listbox'); p.hidden = true; document.body.appendChild(p); p.addEventListener('mousedown', e => e.preventDefault()); p.addEventListener('click', e => { if (e.target.closest('[data-a]')) { cbClose(); if (CB.el) CB.el.blur(); return; } const o = e.target.closest('[data-cbk]'); if (o && CB.el) cbCommit(CB.el, o.dataset.cbk, o.dataset.cbt, 'click'); }); } return p; }
function cbPlace() {
  const p = cbPop(), el = CB.el; if (!el || p.hidden) return;
  const bar = document.querySelector('.eside'), bt = bar && getComputedStyle(bar).position === 'fixed' && !el.closest('.eside') ? bar.getBoundingClientRect().top : innerHeight;
  const r = el.getBoundingClientRect(), vw = innerWidth, vh = Math.min(innerHeight, bt > 80 ? bt : innerHeight), w = Math.min(Math.max(r.width, 300), vw - 16);
  const below = vh - r.bottom - 12, above = r.top - 12, down = below >= 220 || below >= above, h = Math.max(120, Math.min(320, down ? below : above));
  p.style.width = w + 'px'; p.style.left = Math.max(8, Math.min(r.left, vw - w - 8)) + 'px'; p.style.maxHeight = h + 'px';
  if (down) { p.style.top = (r.bottom + 4) + 'px'; p.style.bottom = ''; } else { p.style.top = ''; p.style.bottom = (innerHeight - r.top + 4) + 'px'; }
}
function cbOpen(el, q) {
  CB.el = el; const res = cbSearch(el, q || ''); CB.items = res.list; CB.total = res.total;
  const cur = cbSel(el) ? cbSel(el).value : el.value.trim().toUpperCase();
  const ci = CB.items.findIndex(x => x.k === cur);
  CB.idx = q ? 0 : Math.max(0, ci);
  const p = cbPop();
  if (!CB.items.length && !res.loading && !q && el.dataset.suggest) { cbClose(); return; }
  let h = '', g = null;
  CB.items.forEach((x, i) => {
    if (x.g && x.g !== g) { h += `<div class="cbg">${esc(x.g)}</div>`; } g = x.g;
    h += `<div class="cbo${i === CB.idx ? ' on' : ''}${x.k === cur ? ' cur' : ''}" role="option" id="cbo_${i}" data-cbk="${esc(x.k)}" data-cbt="${esc(x.t)}" aria-selected="${i === CB.idx}"><b class="mono">${esc(x.k)}</b><span>${cbMark(x.t, q)}</span></div>`;
  });
  if (res.loading) h = '<div class="cbf">Cargando catálogo del SAT…</div>';
  else if (!CB.items.length) h = `<div class="cbf">Sin coincidencias para “${esc(q)}”. Prueba con la clave o con otra palabra.${cbSel(el) && cbSel(el).dataset.combo === 'unidadAll' ? ' <button class="cball" data-a="unidadCat">Subir catálogo c_ClaveUnidad actualizado</button>' : ''}</div>`;
  else h += `<div class="cbf">${!q && CB.total > CB.items.length ? `Escribe para buscar entre ${CB.total.toLocaleString('es-MX')} claves · ` : q && CB.total > CB.items.length ? `${CB.total.toLocaleString('es-MX')} resultados, mostrando ${CB.items.length} · ` : ''}↑↓ moverse · Enter elegir · Esc salir</div>`;
  p.innerHTML = h; p.hidden = false; CB.open = true;
  el.setAttribute('aria-expanded', 'true'); el.setAttribute('aria-controls', 'cbpop'); el.setAttribute('aria-activedescendant', CB.items.length ? 'cbo_' + CB.idx : '');
  cbPlace(); const on = p.querySelector('.cbo.on'); if (on) on.scrollIntoView({block: 'nearest'});
}
function cbMark(t, q) {
  const s = esc(t), toks = cbNorm(q).split(' ').filter(w => w.length > 1); if (!toks.length) return s;
  const n = cbNorm(t); if (n.length !== t.length) return s;
  const marks = []; toks.forEach(w => { let i = n.indexOf(w); while (i >= 0) { marks.push([i, i + w.length]); i = n.indexOf(w, i + 1); } });
  if (!marks.length) return s;
  marks.sort((a, b) => a[0] - b[0]); let out = '', p = 0;
  marks.forEach(([a, b]) => { if (a < p) return; out += esc(t.slice(p, a)) + '<mark>' + esc(t.slice(a, b)) + '</mark>'; p = b; });
  return out + esc(t.slice(p));
}
function cbClose() { const p = document.getElementById('cbpop'); if (p) p.hidden = true; if (CB.el) { CB.el.setAttribute('aria-expanded', 'false'); CB.el.removeAttribute('aria-activedescendant'); } CB.open = false; CB.typed = false; }
function cbRefresh() { if (CB.open && CB.el && CB.el.isConnected) cbOpen(CB.el, CB.typed ? CB.el.value : ''); }
function cbMove(d) { if (!CB.items.length) return; CB.idx = (CB.idx + d + CB.items.length) % CB.items.length; const p = cbPop(); p.querySelectorAll('.cbo').forEach((o, i) => { o.classList.toggle('on', i === CB.idx); o.setAttribute('aria-selected', i === CB.idx); }); CB.el.setAttribute('aria-activedescendant', 'cbo_' + CB.idx); const on = p.querySelector('.cbo.on'); if (on) on.scrollIntoView({block: 'nearest'}); }
function cbShow(s) { const o = s.selectedOptions[0]; return s.value && o ? (o.text.startsWith(s.value) ? o.text : `${s.value} · ${o.text}`) : ''; }
/* Elegir una clave: actualiza el <select> oculto (o el campo de texto) y dispara sus eventos normales */
function cbCommit(el, k, t, how) {
  const s = cbSel(el), id = cbId(cbPath(el)), elId = el.id;
  cbClose(); CB.quiet = true;
  try {
  if (s) {
    if (![...s.options].some(o => o.value === k)) { const o = document.createElement('option'); o.value = k; o.textContent = `${k} · ${t || ''}`; s.appendChild(o); }
    const changed = s.value !== k; s.value = k; el.value = cbShow(s);
    cbRemember(id, k);
    if (changed) { s.dispatchEvent(new Event('input', {bubbles: true})); s.dispatchEvent(new Event('change', {bubbles: true})); }
  } else {
    const changed = el.value !== k; el.value = k; cbRemember(id, k);
    if (changed) { el.dispatchEvent(new Event('input', {bubbles: true})); el.dispatchEvent(new Event('change', {bubbles: true})); }
  }
  } finally { CB.quiet = false; }
  // si el cambio redibujó la pantalla, regresamos el foco al campo equivalente
  if (how === 'tab' || how === 'shift-tab') cbFocusNext(elId, how === 'shift-tab' ? -1 : 1);
  else if (how) { const n = document.getElementById(elId); if (n && document.activeElement !== n) { CB.quiet = true; n.focus({preventScroll: true}); CB.quiet = false; } }
}
function cbFocusNext(id, dir) {
  const n = document.getElementById(id); if (!n) return;
  const f = [...document.querySelectorAll('input:not([type=hidden]):not([disabled]):not([readonly]), select:not([disabled]):not(.cbhide), textarea, button:not([disabled])')].filter(x => x.offsetParent !== null && x.tabIndex >= 0);
  const i = f.indexOf(n); if (i < 0) return; const t = f[i + dir]; if (t) { t.focus(); if (t.select && t.tagName === 'INPUT') t.select(); }
}
/* ---- Conversión automática de selects largos ---- */
function cbEnhance() {
  document.querySelectorAll('select:not([data-cbdone])').forEach(s => {
    s.dataset.cbdone = '1';
    if (s.dataset.nocombo !== undefined || s.dataset.mapcol || s.dataset.mapsheet || s.multiple || !s.id) return;
    const n = [...s.options].filter(o => o.value !== '').length;
    if (!s.dataset.combo && n <= CB_MIN) return;
    const emptyOpt = [...s.options].find(o => o.value === '');
    const i = document.createElement('input');
    i.id = 'cbi_' + s.id; i.className = 'cbin ' + (s.className || '').replace(/\bsm\b/, 'sm');
    i.setAttribute('role', 'combobox'); i.setAttribute('aria-autocomplete', 'list'); i.setAttribute('aria-expanded', 'false'); i.autocomplete = 'off'; i.spellcheck = false;
    i.dataset.cbsel = s.id; i.placeholder = emptyOpt ? emptyOpt.text : 'Escribe clave o nombre…';
    if (s.dataset.gi !== undefined) { i.dataset.gi = s.dataset.gi; i.dataset.gc = s.dataset.gc; delete s.dataset.gi; delete s.dataset.gc; }
    const lab = s.closest('.fld') && s.closest('.fld').querySelector('label'); i.setAttribute('aria-label', lab ? lab.textContent : (s.getAttribute('aria-label') || emptyOpt && emptyOpt.text || 'Buscar en catálogo'));
    if (s.title) i.title = s.title;
    i.value = cbShow(s); i.disabled = s.disabled;
    s.classList.add('cbhide'); s.tabIndex = -1; s.setAttribute('aria-hidden', 'true');
    const w = document.createElement('span'); w.className = 'cbw' + (s.closest('td') ? ' cbtd' : ''); s.parentNode.insertBefore(w, s); w.appendChild(i); w.appendChild(s);
    i.title = i.value;
    s.addEventListener('change', () => { if (document.activeElement !== i || !CB.open) { i.value = cbShow(s); i.title = i.value; } });
  });
  document.querySelectorAll('input[data-suggest]:not([data-cbdone])').forEach(i => {
    i.dataset.cbdone = '1'; i.removeAttribute('maxlength'); i.setAttribute('role', 'combobox'); i.setAttribute('aria-autocomplete', 'list'); i.setAttribute('aria-expanded', 'false'); i.autocomplete = 'off'; i.removeAttribute('list');
  });
  if (CB.open && (!CB.el || !CB.el.isConnected)) cbClose();
}
new MutationObserver(() => cbEnhance()).observe(document.documentElement, {childList: true, subtree: true});
const isCb = el => el && el.tagName === 'INPUT' && (el.dataset.cbsel || el.dataset.suggest);
document.addEventListener('focusin', e => {
  const el = e.target; if (!isCb(el) || CB.quiet) return;
  if (el.dataset.cbsel) { el.select(); cbOpen(el, ''); } else if (!el.value.trim()) cbOpen(el, '');
});
document.addEventListener('focusout', e => {
  const el = e.target; if (!isCb(el) || CB.el !== el) return;
  if (el.dataset.cbsel) {
    const s = cbSel(el), q = el.value.trim();
    if (s && q !== cbShow(s)) {
      // Escribió la clave exacta o una palabra con un único resultado claro: se acepta; si no, se restaura
      const qn = cbNorm(q), exact = cbItems(el).find(x => cbNorm(x[0]) === qn);
      if (!q && !s.querySelector('option[value=""]')) el.value = cbShow(s);
      else if (!q) { cbClose(); s.value = ''; el.value = ''; s.dispatchEvent(new Event('change', {bubbles: true})); return; }
      else if (exact) { cbCommit(el, exact[0], exact[1]); return; }
      else el.value = cbShow(s);
    }
  }
  cbClose();
});
document.addEventListener('input', e => {
  const el = e.target; if (!isCb(el) || CB.quiet) return;
  CB.typed = true; cbOpen(el, el.value); CB.typed = true;
});
document.addEventListener('mousedown', e => { const el = e.target; if (isCb(el) && document.activeElement === el && el.dataset.cbsel) { if (CB.open && CB.el === el) cbClose(); else setTimeout(() => { el.select(); cbOpen(el, ''); }, 0); } });
/* Teclado: se registra en window (captura) para adelantarse a la navegación de la tabla de conceptos */
window.addEventListener('keydown', e => {
  const el = e.target; if (!isCb(el) || e.ctrlKey || e.metaKey || e.altKey) return;
  const stop = () => { e.preventDefault(); e.stopImmediatePropagation(); };
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { stop(); if (!CB.open || CB.el !== el) cbOpen(el, el.dataset.cbsel ? '' : el.value); else cbMove(e.key === 'ArrowDown' ? 1 : -1); return; }
  if (!CB.open || CB.el !== el) return;
  if (e.key === 'Escape') { stop(); const s = cbSel(el); if (s) el.value = cbShow(s); cbClose(); return; }
  if (e.key === 'PageDown' || e.key === 'PageUp') { stop(); cbMove(e.key === 'PageDown' ? 8 : -8); return; }
  const it = CB.items[CB.idx];
  if (e.key === 'Enter' && it) { stop(); cbCommit(el, it.k, it.t, 'enter'); return; }
  if (e.key === 'Enter' && CB.typed) { stop(); return; }
  if (e.key === 'Tab' && it && CB.typed) { stop(); cbCommit(el, it.k, it.t, e.shiftKey ? 'shift-tab' : 'tab'); return; }
  if (e.key === 'Tab') cbClose();
}, true);
addEventListener('resize', () => cbPlace());
document.addEventListener('scroll', e => { if (CB.open && !(e.target && e.target.id === 'cbpop')) cbPlace(); }, true);

/* ============ MERCANCÍAS DE CARTA PORTE: menos captura repetida ============ */
/* Memoria por clave de bienes transportados: al volver a usar una clave se proponen descripción, unidad, embalaje y material peligroso */
function mercMem() { try { return JSON.parse(localStorage.getItem('folia.merc') || '{}'); } catch (e) { return {}; } }
function mercMemSave(m) { if (!m || !/^\d{8}$/.test(m.bien || '')) return; try { const o = mercMem(); o[m.bien] = {desc: m.desc, unidad: m.unidad, embalaje: m.embalaje, peligroso: m.peligroso, cvePel: m.cvePel, t: Date.now()}; const ks = Object.keys(o); if (ks.length > 300) ks.sort((a, b) => o[a].t - o[b].t).slice(0, ks.length - 300).forEach(k => delete o[k]); localStorage.setItem('folia.merc', JSON.stringify(o)); } catch (e) { /* sin almacenamiento */ } }
function mercAutollenar(m) {
  const mem = mercMem()[m.bien], ps = PSCP.map && PSCP.map.get(m.bien); let n = 0;
  if (mem) {
    if (!m.desc && mem.desc) { m.desc = mem.desc; n++; }
    if (mem.unidad && (m._ua || !m.unidad)) { m.unidad = mem.unidad; m._ua = false; n++; }
    if (mem.peligroso === 'Sí' && ccpFlag(m.bien) !== '0') { m.peligroso = 'Sí'; if (!m.cvePel) m.cvePel = mem.cvePel || ''; if (!m.embalaje) m.embalaje = mem.embalaje || ''; n++; }
  } else if (!m.desc && ps) m.desc = ps[1];
  return n;
}
document.addEventListener('change', e => {
  const el = e.target, mm = /^cp\.merc\.(\d+)\.(\w+)$/.exec(el.dataset.b || ''); if (!mm || !S.draft || !S.draft.cp) return;
  const m = S.draft.cp.merc[+mm[1]]; if (!m) return;
  if (mm[2] === 'unidad') m._ua = false;
  if (mm[2] === 'bien' && /^\d{8}$/.test(m.bien)) { if (mercAutollenar(m)) { render(); toast('Datos de la mercancía propuestos con base en tu último uso de la clave ' + m.bien); } }
  if (mm[2] !== 'bien') mercMemSave(m);
});
A.pickCatMerc = el => openCatalogCP((k, d) => { const m = S.draft.cp.merc[+el.dataset.i]; m.bien = k; const n = mercAutollenar(m); if (!m.desc) m.desc = d; const f = ccpFlag(k); m.peligroso = f === '1' ? 'Sí' : f === '0' ? 'No' : m.peligroso; cbRemember('cp.merc.*.bien', k); mercMemSave(m); render(); if (n) toast('Datos de la mercancía propuestos con base en tu último uso de la clave ' + k); });
const _addMercCb = A.addMerc;
A.addMerc = () => {
  const ms = S.draft.cp.merc, last = ms[ms.length - 1];
  _addMercCb();
  const m = S.draft.cp.merc[S.draft.cp.merc.length - 1];
  if (last && last.unidad) m.unidad = last.unidad;
  if (last && last.embalaje && last.peligroso === 'Sí') m.embalaje = last.embalaje;
  m._ua = true; render();
  const b = document.getElementById(`b_cp_merc_${S.draft.cp.merc.length - 1}_bien`); if (b) b.focus();
};
/* “Aplicar a todas”: copia la unidad o el embalaje de una mercancía al resto */
A.mercAll = el => {
  const i = +el.dataset.i, f = el.dataset.f, ms = S.draft.cp.merc, v = ms[i] && ms[i][f]; if (!v) return;
  let n = 0; ms.forEach((m, j) => { if (j !== i && m[f] !== v && (f !== 'embalaje' || m.peligroso === 'Sí')) { m[f] = v; if (f === 'unidad') m._ua = false; n++; } });
  render(); toast(n ? `${f === 'unidad' ? 'Unidad' : 'Embalaje'} ${v} aplicada a ${n} mercancía${n === 1 ? '' : 's'}` : 'Todas las mercancías ya tienen ese valor');
};
/* Si algún módulo (p. ej. “ir al dato por corregir”) enfoca el select oculto, el foco pasa al buscador visible */
document.addEventListener('focusin', e => { const s = e.target; if (s.tagName === 'SELECT' && s.classList.contains('cbhide')) { const i = document.getElementById('cbi_' + s.id); if (i) { i.focus(); i.scrollIntoView({block: 'center', behavior: 'smooth'}); } } });
