/* ============ ESTADO ============ */
const S = { acct: null, user: null, emisores: [], clientes: [], productos: [], cfdis: [], vehiculos: [], operadores: [], ubicaciones: [], catImport: [], pdfimg: {}, mapeos: [], view: 'inicio', draft: null, ret: null, pago: null, f: {q: '', tipo: '', estado: ''} };
const COLL = {emisor: 'emisores', cliente: 'clientes', producto: 'productos', cfdi: 'cfdis', vehiculo: 'vehiculos', operador: 'operadores', ubicacion: 'ubicaciones'};
const docId = (coll, id) => `${S.acct}~${coll}~${id}`;
async function saveRec(coll, obj) {
  obj.id = obj.id || sid(); obj.acct = S.acct; obj.coll = coll; obj.mod = Date.now();
  const arr = S[COLL[coll]], i = arr.findIndex(x => x.id === obj.id);
  if (i >= 0) arr[i] = obj; else arr.push(obj);
  await Store.put(docId(coll, obj.id), obj); return obj;
}
async function delRec(coll, id) { S[COLL[coll]] = S[COLL[coll]].filter(x => x.id !== id); await Store.del(docId(coll, id)); }
async function saveUser() { await Store.put(S.acct, S.user); }
const EM = () => S.emisores.find(e => e.id === S.user.activeEmisor) || S.emisores[0] || null;

/* ============ UI BÁSICA ============ */
function toast(m, kind = '') {
  const t = document.createElement('div'); t.className = 'toast ' + kind; t.textContent = m; $('#toasts').appendChild(t);
  setTimeout(() => t.classList.add('out'), 3800); setTimeout(() => t.remove(), 4300);
}
function openModal(html, wide) { const m = $('#modal'); m.innerHTML = `<div class="sheet${wide ? ' wide' : ''}" role="dialog" aria-modal="true">${html}</div>`; m.hidden = false; const f = m.querySelector('input,select,textarea,button'); if (f) f.focus(); }
function close2() { const m = $('#modal2'); m.hidden = true; m.innerHTML = ''; }
function closeModal() { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; }
function getPath(o, p) { return p.split('.').reduce((a, k) => a == null ? a : a[k], o); }
function setPath(o, p, v) { const ks = p.split('.'); let a = o; ks.slice(0, -1).forEach(k => a = a[k]); a[ks[ks.length - 1]] = v; }
const chip = (t, k = '') => `<span class="chip ${k}">${esc(t)}</span>`;
const estadoChip = r => r.estado === 'Cancelado' ? chip('Cancelado', 'bad') : (r.tipo === 'I' && r.metodo === 'PPD' ? (r.saldo > 0.009 ? chip('Por cobrar ' + money(r.saldo, r.moneda), 'warn') : chip('Pagada', 'ok')) : chip('Vigente', 'ok'));
const tipoNombre = r => r.tipo === 'R' ? 'Retenciones' : (lbl(CAT.tipo, r.tipo) + (r.cp ? ' + Carta Porte' : ''));

/* ============ FORMULARIOS GENÉRICOS ============ */
function fieldHTML(f, v) {
  const id = 'ff_' + f.k, req = f.req ? ' required' : '';
  const L = `<label for="${id}">${esc(f.l)}${f.req ? ' <b class="req">*</b>' : ''}</label>`;
  let inp;
  if (f.t === 'select') inp = `<select id="${id}" name="${f.k}"${req}>${opts(f.o, v ?? '', f.code !== false, f.empty ?? 'Selecciona…')}</select>`;
  else if (f.t === 'check') return `<label class="check" for="${id}"><input type="checkbox" id="${id}" name="${f.k}"${v ? ' checked' : ''}> ${esc(f.l)}</label>`;
  else if (f.t === 'prodserv') inp = `<div class="inline"><input id="${id}" name="${f.k}" value="${esc(v ?? '')}" inputmode="numeric" maxlength="8" class="mono"${req}><button type="button" class="btn ghost sm" data-a="pickCatForm" data-target="${id}">Buscar</button></div>`;
  else inp = `<input id="${id}" name="${f.k}" type="${f.t || 'text'}" value="${esc(v ?? '')}"${f.ph ? ` placeholder="${esc(f.ph)}"` : ''}${f.up ? ' class="mono up"' : ''}${f.step ? ` step="${f.step}"` : ''}${req}>`;
  return `<div class="fld${f.wide ? ' wide' : ''}">${L}${inp}${f.hint ? `<small>${esc(f.hint)}</small>` : ''}</div>`;
}
function openForm(title, fields, vals, onSave, note = '') {
  openModal(`<form id="gform" novalidate><header class="mh"><h3>${esc(title)}</h3><button type="button" class="x" data-a="close" aria-label="Cerrar">×</button></header>
  ${note ? `<p class="note">${note}</p>` : ''}<div class="grid2">${fields.map(f => fieldHTML(f, vals[f.k])).join('')}</div>
  <p class="ferr" id="gferr" hidden></p><footer class="mf"><button type="button" class="btn ghost" data-a="close">Cancelar</button><button class="btn">Guardar</button></footer></form>`);
  $('#gform').addEventListener('submit', async ev => {
    ev.preventDefault(); const o = {...vals};
    fields.forEach(f => { const el = $('#ff_' + f.k); o[f.k] = f.t === 'check' ? el.checked : (f.up ? el.value.trim().toUpperCase() : el.value.trim()); });
    const miss = fields.filter(f => f.req && !o[f.k]);
    if (miss.length) { const e = $('#gferr'); e.hidden = false; e.textContent = 'Completa: ' + miss.map(f => f.l).join(', ') + '.'; return; }
    const r = await onSave(o); if (r && r.error) { const e = $('#gferr'); e.hidden = false; e.textContent = r.error; return; }
    closeModal(); render();
  });
}
function openCatalog(onPick) {
  const m2 = $('#modal2'); m2.hidden = false; m2.innerHTML = `<div class="sheet wide" role="dialog" aria-modal="true"><header class="mh"><h3>Catálogo de productos y servicios SAT</h3><button class="x" data-a="close2" aria-label="Cerrar">×</button></header>
  <div class="fld"><label for="catq">Busca por palabra o clave</label><input id="catq" placeholder="ej. transporte, papel, 8411…" autocomplete="off"></div>
  <p class="muted small">${S.catImport.length ? `Buscando en el catálogo oficial importado (${S.catImport.length.toLocaleString('es-MX')} claves) y en la selección frecuente.` : 'Buscando en la selección frecuente. Importa el catálogo oficial completo en “Productos y catálogo”.'}</p>
  <div id="catres" class="catres"></div></div>`; $('#catq').focus();
  const run = () => {
    const q = $('#catq').value.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const all = PRODSERV.concat(S.catImport.filter(x => !PRODSERV.some(p => p[0] === x[0])));
    const words = q.split(/\s+/).filter(Boolean);
    const res = (words.length ? all.filter(p => { const t = (p[0] + ' ' + p[1]).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); return words.every(w => t.includes(w)); }) : all).slice(0, 60);
    $('#catres').innerHTML = res.length ? res.map(p => `<button type="button" class="catrow" data-k="${p[0]}" data-d="${esc(p[1])}"><span class="mono">${p[0]}</span><span>${esc(p[1])}</span>${p[2] ? chip('Material peligroso', 'warn') : ''}</button>`).join('') : '<p class="muted">Sin resultados. Prueba otra palabra o importa el catálogo oficial.</p>';
  };
  $('#catq').addEventListener('input', run); run();
  $('#catres').addEventListener('click', e => { const b = e.target.closest('.catrow'); if (b) { close2(); onPick(b.dataset.k, b.dataset.d); } });
}

/* ============ AUTENTICACIÓN ============ */
function viewAuth(mode = 'login', msg = '') {
  $('#app').innerHTML = `<div class="auth">
  <section class="auth-intro">
    <div class="brand big"><span class="mark" aria-hidden="true">4.0</span><div><b>Folia</b><small>Facturación CFDI</small></div></div>
    <h1>Factura sin errores ante el SAT</h1>
    <p>Ingresos, egresos, traslados, Carta Porte 3.1, complemento de pagos 2.0 y CFDI de retenciones 2.0. Cada comprobante se valida contra el Anexo 20 y las reglas fiscales de 2026 antes de emitirse.</p>
    <ul class="ticks"><li>Impuestos y retenciones calculados por situación fiscal</li><li>Complementos de pago desde tus facturas PPD con saldo</li><li>Flota, operadores y rutas guardados para tus cartas porte</li></ul>
  </section>
  <section class="auth-card">
    <div class="seg" role="tablist"><button class="${mode === 'login' ? 'on' : ''}" data-a="authMode" data-m="login">Iniciar sesión</button><button class="${mode === 'signup' ? 'on' : ''}" data-a="authMode" data-m="signup">Crear cuenta</button></div>
    <form id="authf" novalidate>
      ${mode === 'signup' ? `<div class="fld"><label for="a_nombre">Tu nombre</label><input id="a_nombre" autocomplete="name" required></div>` : ''}
      <div class="fld"><label for="a_email">Correo electrónico</label><input id="a_email" type="email" autocomplete="email" required></div>
      <div class="fld"><label for="a_pass">Contraseña</label><input id="a_pass" type="password" autocomplete="${mode === 'signup' ? 'new-password' : 'current-password'}" minlength="8" required>${mode === 'signup' ? '<small>Mínimo 8 caracteres.</small>' : ''}</div>
      <label class="check" for="a_keep"><input type="checkbox" id="a_keep" checked> Mantener mi sesión iniciada</label>
      <p class="ferr" id="aerr"${msg ? '' : ' hidden'}>${esc(msg)}</p>
      <button class="btn block">${mode === 'signup' ? 'Crear cuenta' : 'Entrar'}</button>
    </form>
    <div class="or"><span>o</span></div>
    <button class="btn ghost block" data-a="demo">Explorar con datos de ejemplo</button>
    <p class="muted small authsafe" title="Almacenamiento: ${esc(Store.label)}"><svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg> Tus datos y CFDIs están protegidos y sincronizados de forma segura</p>
  </section></div>`;
  $('#authf').addEventListener('submit', async ev => {
    ev.preventDefault();
    const email = $('#a_email').value.trim().toLowerCase(), pass = $('#a_pass').value, keep = $('#a_keep').checked;
    const fail = m => { const e = $('#aerr'); e.hidden = false; e.textContent = m; };
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail('Escribe un correo válido.');
    if (pass.length < 8) return fail('La contraseña debe tener al menos 8 caracteres.');
    const btn = ev.target.querySelector('button.btn'); if (btn) btn.disabled = true;
    try {
    Store.usarPrincipal(); try { localStorage.removeItem('cfdi26:__demo'); } catch (e) { /* sin localStorage */ }
    const id = 'acct~' + (await sha256(email)).slice(0, 24);
    if (AuthHooks) {
      // El servidor valida la contraseña; aquí solo se crea o se lee el perfil de la cuenta
      if (mode === 'signup') { const nombre = $('#a_nombre').value.trim(); if (!nombre) return fail('Escribe tu nombre.'); await AuthHooks.signUp({email, password: pass, nombre}); }
      else await AuthHooks.signIn({email, password: pass});
      let u = await Store.get(id);
      if (!u) { u = {id, acct: id, coll: 'acct', email, nombre: mode === 'signup' ? $('#a_nombre').value.trim() : email.split('@')[0], creado: nowLocal(), activeEmisor: ''}; await Store.put(id, u); }
      await login(id, u, keep); if (mode === 'signup') toast('Cuenta creada. Ahora configura tu perfil fiscal.', 'ok');
      return;
    }
    const ex = await Store.get(id);
    if (mode === 'signup') {
      const nombre = $('#a_nombre').value.trim(); if (!nombre) return fail('Escribe tu nombre.');
      if (ex) return fail('Ya existe una cuenta con ese correo. Inicia sesión.');
      const salt = sid(); const u = {id, acct: id, coll: 'acct', email, nombre, salt, hash: await sha256(salt + ':' + pass), creado: nowLocal(), activeEmisor: ''};
      await Store.put(id, u); await login(id, u, keep); toast('Cuenta creada. Ahora configura tu perfil fiscal.', 'ok');
    } else {
      if (!ex || ex.hash !== await sha256(ex.salt + ':' + pass)) return fail('Correo o contraseña incorrectos.');
      await login(id, ex, keep);
    }
    } catch (e) { fail(e && e.message ? e.message : 'No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.'); }
    finally { if (btn && btn.isConnected) btn.disabled = false; }
  });
}
async function login(id, u, keep) {
  S.acct = id; S.user = u; if (keep) session.set(id);
  $('#app').innerHTML = '<div class="splash">Cargando tus datos…</div>';
  for (const c of Object.keys(COLL)) S[COLL[c]] = await Store.list(id, c);
  S.pdfimg = {}; (await Store.list(id, 'pdfimg')).forEach(p => { (S.pdfimg[p.emisorId] = S.pdfimg[p.emisorId] || {})[p.slot] = {png: p.png, w: p.w, h: p.h}; });
  const chunks = await Store.list(id, 'catalogo'); S.catImport = chunks.sort((a, b) => a.n - b.n).flatMap(c => c.items || []);
  S.view = S.emisores.length ? 'inicio' : 'perfil';
  if (!S.user.activeEmisor && S.emisores[0]) S.user.activeEmisor = S.emisores[0].id;
  render();
}
function logout() { session.set(null); if (Store.adapter && Store.adapter !== Store.primary) { try { localStorage.removeItem('cfdi26:__demo'); } catch (e) { /* sin localStorage */ } } else if (AuthHooks && AuthHooks.signOut) { Promise.resolve().then(() => AuthHooks.signOut()).catch(() => {}); } Store.usarPrincipal(); Object.assign(S, {acct: null, user: null, emisores: [], clientes: [], productos: [], cfdis: [], vehiculos: [], operadores: [], ubicaciones: [], catImport: [], pdfimg: {}, mapeos: [], draft: null, ret: null, pago: null}); S.mas = Object.assign(S.mas, {step: 'upload', tables: [], rows: {}, dry: null, xi: {items: []}}); viewAuth(); }

/* ============ SHELL ============ */
const NAV = [
  ['inicio', 'Inicio'], ['factura', 'Nueva factura'], ['cartaporte', 'Carta Porte'], ['pagos', 'Complemento de pago'], ['retenciones', 'Retenciones'],
  ['comprobantes', 'Comprobantes'], ['masiva', 'Facturación masiva y Excel'], ['clientes', 'Clientes'], ['productos', 'Productos y catálogo'], ['flota', 'Flota y rutas'], ['guia', 'Guía y fundamentos'], ['perfil', 'Perfil fiscal']
];
function render() {
  if (!S.acct) return viewAuth();
  const aid = document.activeElement && document.activeElement.id, sy = window.scrollY;
  if (S.draft) S._rt = rfcTipo(S.draft.receptor.rfc);
  const em = EM();
  $('#app').innerHTML = `<div class="shell">
  <aside class="side"><div class="brand"><span class="mark" aria-hidden="true">4.0</span><div><b>Folia</b><small>Facturación CFDI</small></div></div>
    ${S.emisores.length ? `<div class="fld emsel"><label for="emsel">Emisor</label><select id="emsel" data-a2="switchEm">${S.emisores.map(e => `<option value="${e.id}"${em && e.id === em.id ? ' selected' : ''}>${esc(e.rfc)} · ${esc(e.nombre)}</option>`).join('')}</select></div>` : ''}
    <nav class="nav">${NAV.map(([k, t]) => `<button class="${S.view === k ? 'on' : ''}" data-a="go" data-v="${k}">${t}</button>`).join('')}</nav>
    <div class="who"><span>${esc(S.user.nombre)}</span><button class="link" data-a="logout">Cerrar sesión</button></div>
  </aside>
  <main class="main" id="main">${(VIEWS[S.view] || VIEWS.inicio)()}</main></div>`;
  if (S.view === 'factura' || S.view === 'cartaporte') updateSide();
  if (AFTER[S.view]) AFTER[S.view]();
  if (aid) { const n = document.getElementById(aid); if (n && n.focus) n.focus({preventScroll: true}); }
  window.scrollTo(0, sy);
}
function go(v, keep) {
  if (!EM() && !['perfil', 'guia'].includes(v)) { toast('Primero agrega tu perfil fiscal de emisor.', 'warn'); v = 'perfil'; }
  if ((v === 'factura' || v === 'cartaporte') && !keep) S.draft = newDraft(v === 'cartaporte' ? 'T' : 'I', {cp: v === 'cartaporte'});
  S.view = v; render(); window.scrollTo(0, 0);
}

/* ============ INICIO ============ */
const VIEWS = {};
VIEWS.inicio = () => {
  const em = EM(), now = new Date(), ym = now.toISOString().slice(0, 7);
  const mine = S.cfdis.filter(c => c.emisorId === em.id), vig = mine.filter(c => c.estado !== 'Cancelado');
  const mes = vig.filter(c => (c.fecha || '').startsWith(ym));
  const fact = r2(mes.filter(c => c.tipo === 'I').reduce((a, c) => a + c.total * (c.tc || 1), 0));
  const pend = vig.filter(c => c.tipo === 'I' && c.metodo === 'PPD' && c.saldo > 0.009).sort((a, b) => a.fecha.localeCompare(b.fecha));
  const porCobrar = r2(pend.reduce((a, c) => a + c.saldo * (c.tc || 1), 0));
  const cps = mes.filter(c => c.cp).length;
  const nextM = new Date(now.getFullYear(), now.getMonth() + 1, 5);
  const csdDias = em.csdVence ? Math.round((new Date(em.csdVence) - now) / 864e5) : null;
  const alerts = [];
  if (!em.csdNo) alerts.push(['warn', 'Agrega el número de tu certificado de sello digital (CSD) en tu perfil fiscal.', 'perfil']);
  if (csdDias !== null && csdDias < 45) alerts.push([csdDias < 0 ? 'bad' : 'warn', csdDias < 0 ? 'Tu CSD está vencido: no podrás timbrar.' : `Tu CSD vence en ${csdDias} días. Renuévalo en el portal del SAT.`, 'perfil']);
  if (pend.length) alerts.push(['info', `Si cobras alguna de tus ${pend.length} facturas PPD este mes, emite su complemento de pago a más tardar el 5 de ${MESES[nextM.getMonth()]}.`, 'pagos']);
  return `<header class="ph"><div><p class="eyebrow">${esc(em.rfc)} · Régimen ${esc(em.regimen)}</p><h1>${esc(em.nombre)}</h1></div><button class="btn" data-a="go" data-v="factura">Nueva factura</button></header>
  <section class="kpis">
    <div class="kpi"><span>Facturado en ${MESES[now.getMonth()]}</span><b>${money(fact)}</b><small>${mes.filter(c => c.tipo === 'I').length} CFDI de ingreso vigentes</small></div>
    <div class="kpi"><span>Por cobrar (PPD)</span><b>${money(porCobrar)}</b><small>${pend.length} facturas con saldo</small></div>
    <div class="kpi"><span>Comprobantes del mes</span><b>${mes.length}</b><small>incluye pagos y retenciones</small></div>
    <div class="kpi"><span>Cartas porte del mes</span><b>${cps}</b><small>${S.vehiculos.length} vehículos registrados</small></div>
  </section>
  ${alerts.length ? `<section class="alerts">${alerts.map(a => `<div class="alert ${a[0]}"><span>${esc(a[1])}</span><button class="link" data-a="go" data-v="${a[2]}">Ir</button></div>`).join('')}</section>` : ''}
  <section class="block"><h2>¿Qué necesitas hacer?</h2><div class="quick">${QUICK.map((q, i) => `<button class="qcard" data-a="quick" data-i="${i}"><b>${q[0]}</b><span>${q[1]}</span><em>${q[2]}</em></button>`).join('')}</div></section>
  <section class="block"><div class="bh"><h2>Facturas por cobrar</h2><button class="link" data-a="go" data-v="pagos">Registrar un pago</button></div>
  ${pend.length ? `<div class="tw"><table><thead><tr><th>Folio</th><th>Cliente</th><th>Fecha</th><th class="n">Total</th><th class="n">Saldo</th><th></th></tr></thead><tbody>${pend.slice(0, 8).map(c => `<tr><td class="mono">${esc(c.serie)}${esc(c.folio)}</td><td>${esc(c.receptor.nombre)}</td><td>${fmtDate(c.fecha)}</td><td class="n">${money(c.total, c.moneda)}</td><td class="n"><b>${money(c.saldo, c.moneda)}</b></td><td><button class="btn sm ghost" data-a="pagarDesde" data-id="${c.id}">Registrar pago</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="empty">No tienes facturas a crédito pendientes. Cuando emitas una factura con método PPD aparecerá aquí con su saldo.</p>'}</section>`;
};
const QUICK = [
  ['Vendí y ya me pagaron', 'Factura de ingreso PUE', 'I-PUE'],
  ['Vendí a crédito o en parcialidades', 'Factura de ingreso PPD, forma 99', 'I-PPD'],
  ['Me pagaron una factura a crédito', 'Complemento de pago 2.0', 'P'],
  ['Devolución, descuento o bonificación', 'CFDI de egreso relacionado', 'E'],
  ['Muevo mi propia mercancía en carretera federal', 'Traslado + Carta Porte 3.1', 'T-CP'],
  ['Cobro un servicio de flete', 'Ingreso + Carta Porte 3.1', 'I-CP'],
  ['Ventas del día a público en general', 'Factura global', 'G'],
  ['Retuve impuestos a un proveedor', 'CFDI de retenciones 2.0', 'R']
];

/* ============ EDITOR DE CFDI (Ingreso, Egreso, Traslado, Carta Porte) ============ */
function newConcepto(p) {
  const em = EM(); const base = {clave: '', unidad: 'E48', cantidad: '1', descripcion: '', noIdent: '', vu: '', descuento: '', objeto: '02', iva: em && em.frontera ? '0.080000' : '0.160000', iepsCat: '', iepsFactor: '', iepsValor: '', retIsr: '', retIva: ''};
  if (p) Object.assign(base, {clave: p.clave, unidad: p.unidad, descripcion: p.descripcion, noIdent: p.noIdent || '', vu: p.precio || '', objeto: p.objeto || '02', iva: p.iva ?? base.iva, iepsCat: p.iepsCat || '', iepsFactor: p.iepsFactor || '', iepsValor: p.iepsValor || ''});
  return base;
}
function newDraft(tipo, o = {}) {
  const em = EM();
  const d = {tipo, serie: '', folio: '', lugarExp: em.cp, moneda: 'MXN', tipoCambio: '', formaPago: '03', metodoPago: 'PUE', exportacion: '01', condiciones: '',
    receptor: {rfc: '', nombre: '', regimen: '', cp: '', uso: 'G03', residencia: '', numRegId: ''}, saveCliente: true,
    global: {on: false, periodicidad: '01', meses: pad(new Date().getMonth() + 1), anio: String(new Date().getFullYear())},
    relacion: {tipo: '', uuids: ''}, conceptos: [newConcepto()], preset: em.frontera ? 'frontera' : 'normal', cp: null};
  if (o.cp) d.cp = {idccp: idCCP(), ubic: [{tipo: 'Origen', rfc: em.rfc, nombre: em.nombre, fecha: '', cp: em.cp, estado: '', municipio: '', calle: ''}, {tipo: 'Destino', rfc: '', nombre: '', fecha: '', cp: '', estado: '', municipio: '', calle: '', dist: ''}], merc: [], veh: {}, ops: []};
  setTipo(d, tipo); return d;
}
function setTipo(d, tipo) {
  const em = EM(); d.tipo = tipo; d.serie = (em.series || {})[tipo] || ({I: 'A', E: 'NC', T: 'T'})[tipo] || ''; d.folio = String(((em.folios || {})[tipo]) || 1);
  if (tipo === 'T') {
    Object.assign(d.receptor, {rfc: em.rfc, nombre: em.nombre, regimen: em.regimen, cp: em.cp, uso: 'S01'});
    d.global.on = false; d.conceptos.forEach(c => { c.objeto = '01'; c.vu = '0'; c.retIsr = ''; c.retIva = ''; });
    if (d.cp && d.cp.ubic[0]) Object.assign(d.cp.ubic[0], {rfc: em.rfc, nombre: em.nombre});
  } else {
    if (d.receptor.rfc === em.rfc) Object.assign(d.receptor, {rfc: '', nombre: '', regimen: '', cp: '', uso: 'G03'});
    d.conceptos.forEach(c => { if (c.objeto === '01' && d.preset !== 'no_objeto') c.objeto = '02'; if (c.vu === '0') c.vu = ''; });
    if (tipo === 'E') { d.metodoPago = 'PUE'; d.receptor.uso = 'G02'; if (!d.relacion.tipo) d.relacion.tipo = '01'; if (d.formaPago === '99') d.formaPago = '03'; }
    if (tipo === 'I' && d.cp && d.preset !== 'flete') applyPreset(d, 'normal');
  }
}
function applyPreset(d, key) { const p = PRESETS[key]; if (!p) return; d.preset = key; d.conceptos.forEach(c => { c.objeto = p.obj; c.iva = p.iva; c.retIsr = p.isr; c.retIva = p.riva; }); }
function sugerir(d) {
  const em = EM(), et = rfcTipo(em.rfc), rt = rfcTipo(d.receptor.rfc);
  if (d.tipo !== 'I' || d.global.on) return null;
  if (d.cp && rt === 'M') return 'flete';
  if (et === 'F' && rt === 'M') { if (em.regimen === '626') return 'resico_serv'; if (em.regimen === '606') return 'arrend_pm'; if (em.regimen === '612') return 'honor_pm'; }
  return null;
}
const IVA_O = [['0.160000', 'IVA 16%'], ['0.080000', 'IVA 8% frontera'], ['0.000000', 'IVA 0%'], ['Exento', 'Exento'], ['', 'Sin IVA']];
const RISR_O = [['', 'Sin retención ISR'], ['0.100000', 'Ret. ISR 10%'], ['0.012500', 'Ret. ISR 1.25% RESICO']];
const RIVA_O = [['', 'Sin retención IVA'], ['0.106667', 'Ret. IVA 2/3 (10.6667%)'], ['0.040000', 'Ret. IVA 4% fletes'], ['0.060000', 'Ret. IVA 6% personal'], ['0.160000', 'Ret. IVA 16% total']];
function inp(path, v, extra = '') { return `<input id="b_${path.replace(/\./g, '_')}" data-b="${path}" value="${esc(v ?? '')}" ${extra}>`; }
function sel(path, list, v, code = true, empty, extra = '') { return `<select id="b_${path.replace(/\./g, '_')}" data-b="${path}" ${extra}>${opts(list, v ?? '', code, empty)}</select>`; }
function F(label, html, cls = '') { return `<div class="fld ${cls}"><label>${label}</label>${html}</div>`; }

VIEWS.factura = VIEWS.cartaporte = () => {
  const d = S.draft, em = EM(); if (!d) { S.draft = newDraft('I'); return VIEWS.factura(); }
  const rt = rfcTipo(d.receptor.rfc), isT = d.tipo === 'T', isCP = !!d.cp;
  const regs = d.especial ? CAT.regimen : CAT.regimen.filter(r => rt === 'PG' || rt === 'EXT' ? r[0] === '616' : (rt ? r[2].includes(rt) : true));
  const usos = d.especial ? CAT.uso.filter(u => u[0] !== 'CN01') : CAT.uso.filter(u => !d.receptor.regimen || u[2].includes(d.receptor.regimen)).filter(u => !['CP01', 'CN01'].includes(u[0]));
  const sug = sugerir(d);
  const clientesOpt = S.clientes.map(c => [c.id, `${c.rfc} · ${c.nombre}`]);
  return `<header class="ph"><div><p class="eyebrow">${isCP ? 'Complemento Carta Porte 3.1' : 'CFDI 4.0'}</p><h1>${isCP ? 'Nueva Carta Porte' : 'Nueva factura'}</h1></div>
    <div class="seg">${(isCP ? [['T', 'Traslado propio'], ['I', 'Ingreso (flete)']] : [['I', 'Ingreso'], ['E', 'Egreso'], ['T', 'Traslado']]).map(([t, n]) => `<button class="${d.tipo === t ? 'on' : ''}" data-a="setTipo" data-t="${t}">${n}</button>`).join('')}</div></header>
  <div class="editor"><div class="ecol">
  ${d.sustituye ? (() => { const o = S.cfdis.find(x => x.id === d.sustituye); return o ? `<div class="alert warn"><span>Corriges <b>${esc(o.serie)}${esc(o.folio)}</b> (${esc(o.uuid.slice(0, 8))}…). Al emitir este CFDI, el original se cancela con <b>motivo 01</b> y queda relacionado con tipo 04.</span><button class="btn sm ghost" data-a="cancelSust">No sustituir</button></div>` : ''; })() : ''}
  <section class="card"><h2><span class="n">1</span>Datos del comprobante</h2><div class="grid3">
    ${F('Serie', inp('serie', d.serie, 'class="mono up" maxlength="25"'))}${F('Folio', inp('folio', d.folio, 'class="mono" inputmode="numeric"'))}${F('Lugar de expedición (CP)', inp('lugarExp', d.lugarExp, 'class="mono" maxlength="5" inputmode="numeric"'))}
    ${!isT ? F('Método de pago', sel('metodoPago', CAT.metodoPago, d.metodoPago, true, undefined, 'data-r="1"')) + F('Forma de pago', sel('formaPago', d.especial ? CAT.formaPago : d.metodoPago === 'PPD' ? CAT.formaPago.filter(x => x[0] === '99') : CAT.formaPago.filter(x => x[0] !== '99'), d.formaPago, true, undefined, 'data-r="1"')) + F('Moneda', sel('moneda', CAT.moneda, d.moneda, true, undefined, 'data-r="1"')) : ''}
    ${!isT && d.moneda !== 'MXN' ? F('Tipo de cambio (DOF)', inp('tipoCambio', d.tipoCambio, 'inputmode="decimal" class="mono"')) : ''}
    ${!isT ? F('Exportación', sel('exportacion', CAT.exportacion, d.exportacion, true, undefined, 'data-r="1"')) + F('Condiciones de pago', inp('condiciones', d.condiciones, 'placeholder="ej. Crédito 30 días"')) : ''}
  </div>
  ${d.metodoPago === 'PPD' && !isT && !d.especial ? '<p class="note">Con PPD la forma de pago es 99. Cada cobro se reporta después con un complemento de pago, a más tardar el día 5 del mes siguiente.</p>' : ''}
  ${d.tipo === 'I' && !isCP ? `<label class="check"><input type="checkbox" data-a2="toggleGlobal" ${d.global.on ? 'checked' : ''}> Factura global de operaciones con público en general</label>
  ${d.global.on ? `<div class="grid3">${F('Periodicidad', sel('global.periodicidad', CAT.periodicidad, d.global.periodicidad))}${F('Mes o bimestre', sel('global.meses', CAT.meses, d.global.meses))}${F('Año', inp('global.anio', d.global.anio, 'class="mono" maxlength="4"'))}</div>` : ''}` : ''}
  </section>

  <section class="card"><h2><span class="n">2</span>Receptor</h2>
  ${isT ? `<p class="note">En un traslado el receptor es tu mismo RFC con uso S01. Con Carta Porte es obligatorio (regla CP107 de la matriz del SAT).</p>` : `<div class="row wrap">
    <div class="fld grow"><label for="clipick">Elegir de mis clientes</label><select id="clipick" data-a2="pickCliente">${opts(clientesOpt, '', false, S.clientes.length ? 'Selecciona un cliente…' : 'Aún no tienes clientes guardados')}</select></div>
    <button class="btn ghost sm" data-a="recPG">Público en general</button><button class="btn ghost sm" data-a="recEXT">Extranjero</button></div>`}
  <div class="grid3">
    ${F('RFC', inp('receptor.rfc', d.receptor.rfc, 'class="mono up" maxlength="13" data-r="blur" autocomplete="off"'))}
    ${F('Nombre o razón social', inp('receptor.nombre', d.receptor.nombre, 'class="up"'), 'span2')}
    ${F('Régimen fiscal', sel('receptor.regimen', regs, d.receptor.regimen, true, 'Selecciona…', 'data-r="1"'), 'span2')}
    ${F('CP del domicilio fiscal', inp('receptor.cp', d.receptor.cp, 'class="mono" maxlength="5" inputmode="numeric"'))}
    ${F('Uso del CFDI', sel('receptor.uso', usos, d.receptor.uso, true, 'Selecciona…', 'data-r="1"'), 'span2')}
    ${rt === 'EXT' ? F('Residencia fiscal (país)', inp('receptor.residencia', d.receptor.residencia, 'class="mono up" maxlength="3" placeholder="USA"')) + F('Núm. registro tributario', inp('receptor.numRegId', d.receptor.numRegId)) : ''}
  </div>
  ${!isT && !d.global.on ? `<label class="check"><input type="checkbox" data-b="saveCliente" ${d.saveCliente ? 'checked' : ''}> Guardar o actualizar este cliente en mi base de datos</label>` : ''}
  </section>

  ${!isT ? `<section class="card"><h2><span class="n">3</span>Situación fiscal e impuestos</h2>
  ${sug && sug !== d.preset ? `<div class="alert info"><span>Por tu régimen y el de tu cliente, te sugerimos: <b>${esc(PRESETS[sug].t)}</b>.</span><button class="btn sm" data-a="applyPreset" data-p="${sug}">Aplicar</button></div>` : ''}
  <div class="fld"><label for="presetSel">Aplica IVA y retenciones a todos los conceptos</label><select id="presetSel" data-a2="preset">${Object.entries(PRESETS).map(([k, p]) => `<option value="${k}"${k === d.preset ? ' selected' : ''}>${esc(p.t)}</option>`).join('')}</select><small>Fundamento: ${esc(PRESETS[d.preset] ? PRESETS[d.preset].ley : '')}</small></div>
  </section>` : ''}

  <section class="card"><h2><span class="n">${isT ? 3 : 4}</span>${isT ? 'Bienes que se trasladan' : 'Conceptos'}</h2>
  ${conceptGrid(d)}
  </section>

  ${!isT || d.relacion.uuids ? `<section class="card"><h2><span class="n">${isT ? 4 : 5}</span>CFDI relacionados ${d.tipo === 'E' ? '<b class="req">*</b>' : '<small class="muted">opcional</small>'}</h2><div class="grid3">
    ${F('Tipo de relación', sel('relacion.tipo', CAT.tipoRelacion, d.relacion.tipo, true, 'Sin relación'), 'span2')}
    <div class="fld"><label>&nbsp;</label><button class="btn ghost sm" data-a="pickRel">Buscar en mis CFDI</button></div>
    ${F('Folios fiscales (UUID), uno por línea', `<textarea id="b_relacion_uuids" data-b="relacion.uuids" rows="2" class="mono up">${esc(d.relacion.uuids)}</textarea>`, 'span3')}</div></section>` : ''}

  ${isCP ? cartaPorteHTML(d) : ''}
  </div>
  <aside class="eside"><div class="sticky" id="side"></div></aside></div>`;
};
function conceptoHTML(c, i, d) {
  const isT = d.tipo === 'T', p = `conceptos.${i}`;
  const ie = IEPS26.find(x => x[0] === c.iepsCat);
  return `<div class="concepto"><div class="chead"><b>${i + 1}</b><span class="lt" id="lt_${i}"></span>${d.conceptos.length > 1 ? `<button class="x" data-a="delConcepto" data-i="${i}" aria-label="Quitar concepto">×</button>` : ''}</div>
  <div class="grid4">
    ${F('Clave SAT', `<div class="inline">${inp(p + '.clave', c.clave, 'class="mono" maxlength="8" inputmode="numeric"')}<button class="btn ghost sm" data-a="pickCat" data-i="${i}">Buscar</button></div>`, 'span2')}
    ${F('Unidad', sel(p + '.unidad', CAT.unidad, c.unidad))}
    ${F('Cantidad', inp(p + '.cantidad', c.cantidad, 'inputmode="decimal" class="mono"'))}
    ${F('Descripción', inp(p + '.descripcion', c.descripcion), 'span3')}
    ${F('No. identificación', inp(p + '.noIdent', c.noIdent, 'placeholder="SKU (opcional)"'))}
    ${!isT ? F('Valor unitario', inp(p + '.vu', c.vu, 'inputmode="decimal" class="mono"')) + F('Descuento', inp(p + '.descuento', c.descuento, 'inputmode="decimal" class="mono" placeholder="0.00"')) + F('Objeto de impuesto', sel(p + '.objeto', CAT.objetoImp.slice(0, 5), c.objeto, true, undefined, 'data-r="1"'), 'span2') : ''}
  </div>
  ${!isT && ['02', '05'].includes(c.objeto) ? `<details class="taxes"${c.iepsCat || c.retIsr || c.retIva ? ' open' : ''}><summary>Impuestos de este concepto</summary><div class="grid4">
    ${F('IVA trasladado', sel(p + '.iva', IVA_O, c.iva, false))}
    ${F('IEPS 2026', `<select id="b_${p.replace(/\./g, '_')}_ieps" data-a2="ieps" data-i="${i}">${IEPS26.map(x => `<option value="${x[0]}"${x[0] === c.iepsCat ? ' selected' : ''}>${esc(x[1])}${x[3] ? ` (${x[2] === 'Cuota' ? '$' + x[3] : (num(x[3]) * 100).toFixed(1) + '%'})` : ''}</option>`).join('')}</select>`, 'span2')}
    ${c.iepsCat ? F(c.iepsFactor === 'Cuota' ? 'Cuota por unidad' : 'Tasa IEPS', inp(p + '.iepsValor', c.iepsValor, 'class="mono" inputmode="decimal"')) : ''}
    ${F('Retención ISR', sel(p + '.retIsr', RISR_O, c.retIsr, false))}${F('Retención IVA', sel(p + '.retIva', RIVA_O, c.retIva, false))}
  </div>${ie && ie[2] === 'Cuota' ? '<small class="muted">La cuota se multiplica por la cantidad (litros o piezas). La base del IVA incluye el IEPS.</small>' : ''}</details>` : ''}
  </div>`;
}
function cartaPorteHTML(d) {
  const cp = d.cp, tot = r2(cp.ubic.filter(u => u.tipo === 'Destino').reduce((a, u) => a + num(u.dist), 0));
  const peso = cp.merc.reduce((a, m) => a + num(m.peso), 0);
  const ubO = S.ubicaciones.map(u => [u.id, `${u.alias} · CP ${u.cp}`]);
  return `<section class="card cpcard"><h2><span class="n">CP</span>Ruta</h2><p class="muted small mono">IdCCP ${esc(cp.idccp)} · Distancia total ${f2(tot)} km</p>
  ${cp.ubic.map((u, i) => `<div class="ubic"><div class="chead"><b>${u.tipo === 'Origen' ? 'Origen' : 'Destino'}</b>${S.ubicaciones.length ? `<select class="sm" data-a2="pickUbic" data-i="${i}">${opts(ubO, '', false, 'Usar ubicación guardada…')}</select>` : ''}${cp.ubic.length > 2 && i > 0 ? `<button class="x" data-a="delUbic" data-i="${i}" aria-label="Quitar">×</button>` : ''}</div><div class="grid4">
    ${F('RFC ' + (u.tipo === 'Origen' ? 'remitente' : 'destinatario'), inp(`cp.ubic.${i}.rfc`, u.rfc, 'class="mono up" maxlength="13"'))}${F('Nombre', inp(`cp.ubic.${i}.nombre`, u.nombre, 'class="up"'), 'span2')}
    ${F(u.tipo === 'Origen' ? 'Fecha y hora de salida' : 'Llegada estimada', inp(`cp.ubic.${i}.fecha`, u.fecha, 'type="datetime-local"'))}
    ${F('Código postal', inp(`cp.ubic.${i}.cp`, u.cp, 'class="mono" maxlength="5" inputmode="numeric"'))}${F('Estado', sel(`cp.ubic.${i}.estado`, CAT.estados, u.estado, false, 'Selecciona…'))}
    ${F('Municipio (clave o nombre)', inp(`cp.ubic.${i}.municipio`, u.municipio))}${u.tipo === 'Destino' ? F('Distancia desde el punto anterior (km)', inp(`cp.ubic.${i}.dist`, u.dist, 'inputmode="decimal" class="mono"')) : F('Calle', inp(`cp.ubic.${i}.calle`, u.calle))}
  </div></div>`).join('')}
  <button class="btn ghost sm" data-a="addUbic">Agregar otro destino</button>
  </section>
  <section class="card cpcard"><h2><span class="n">CP</span>Mercancías</h2><p class="muted small">${cp.merc.length} mercancías · Peso bruto total ${peso.toLocaleString('es-MX')} kg (UnidadPeso KGM) · <button class="cball" data-a="unidadCat">¿Falta una unidad? Catálogo c_ClaveUnidad (${CATSAT.unidad.length.toLocaleString('es-MX')} claves)</button></p>
  ${cp.merc.map((m, i) => `<div class="ubic"><div class="chead"><b>${i + 1}</b><button class="x" data-a="delMerc" data-i="${i}" aria-label="Quitar">×</button></div><div class="grid4">
    ${F('Clave bienes transportados', `<div class="inline">${inp(`cp.merc.${i}.bien`, m.bien, 'class="mono" maxlength="8" data-suggest="bienes" placeholder="Clave o palabra: cemento, gasolina…"')}<button class="btn ghost sm" data-a="pickCatMerc" data-i="${i}">Buscar</button></div>`, 'span2')}
    ${F('Descripción', inp(`cp.merc.${i}.desc`, m.desc), 'span2')}${F('Cantidad', inp(`cp.merc.${i}.cant`, m.cant, 'inputmode="decimal" class="mono"'))}${F('Unidad (c_ClaveUnidad)', sel(`cp.merc.${i}.unidad`, unidadMercOpts(m.unidad), m.unidad, true, undefined, 'data-combo="unidadAll"') + (cp.merc.length > 1 && m.unidad ? `<button class="cball" data-a="mercAll" data-f="unidad" data-i="${i}">Aplicar ${esc(m.unidad)} a todas</button>` : ''))}
    ${F('Peso (kg)', inp(`cp.merc.${i}.peso`, m.peso, 'inputmode="decimal" class="mono"'))}${F('Valor (MXN)', inp(`cp.merc.${i}.valor`, m.valor, 'inputmode="decimal" class="mono" placeholder="opcional"'))}
    ${(() => { const fl = ccpFlag(m.bien); return F('¿Material peligroso?', fl === '0' && m.peligroso !== 'Sí' ? '<input value="No aplica (c_ClaveProdServCP = 0)" readonly class="ro">' : sel(`cp.merc.${i}.peligroso`, [['No', 'No'], ['Sí', 'Sí']], m.peligroso, false, undefined, 'data-r="1"') + (fl === '1' ? '<small>El catálogo la clasifica como material peligroso.</small>' : fl === '0,1' ? '<small>Puede o no ser peligroso: confírmalo con quien te la envía.</small>' : '')); })()}
    ${m.peligroso === 'Sí' ? F('Clave UN (c_MaterialPeligroso)', inp(`cp.merc.${i}.cvePel`, m.cvePel, 'class="mono up" placeholder="1203 o nombre: gasolina…" maxlength="6" data-suggest="mp" autocomplete="off"') + `<small id="mpd_${i}">${esc(mpNombre(m.cvePel))}</small>`) + F('Embalaje (c_TipoEmbalaje)', sel(`cp.merc.${i}.embalaje`, CAT.embalaje, m.embalaje, true, 'Selecciona…') + (cp.merc.filter(x => x.peligroso === 'Sí').length > 1 && m.embalaje ? `<button class="cball" data-a="mercAll" data-f="embalaje" data-i="${i}">Aplicar ${esc(m.embalaje)} a todas</button>` : ''), 'span2') : ''}
  </div></div>`).join('')}
  <div class="row wrap"><button class="btn ghost sm" data-a="addMerc">Agregar mercancía</button>${d.tipo === 'T' ? '<button class="btn ghost sm" data-a="mercDesdeConceptos">Copiar desde los bienes del traslado</button>' : ''}</div>
  </section>
  <section class="card cpcard"><h2><span class="n">CP</span>Vehículo y operador</h2>
  <div class="row wrap">${S.vehiculos.length ? `<select class="sm" data-a2="pickVeh">${opts(S.vehiculos.map(v => [v.id, `${v.alias} · ${v.placa} · ${v.config}`]), '', false, 'Usar vehículo de mi flota…')}</select>` : '<span class="muted small">Registra tus vehículos en “Flota y rutas” para llenarlos con un clic.</span>'}</div>
  <div class="grid4">
    ${F('Permiso SCT', sel('cp.veh.perm', CAT.permSCT, cp.veh.perm, true, 'Selecciona…'), 'span2')}${F('Número de permiso', inp('cp.veh.numPerm', cp.veh.numPerm, 'class="mono up"'), 'span2')}
    ${F('Configuración vehicular', sel('cp.veh.config', CAT.configVeh, cp.veh.config, true, 'Selecciona…', 'data-r="1"'), 'span2')}${F('Placa', inp('cp.veh.placa', cp.veh.placa, 'class="mono up" maxlength="7"'))}${F('Año modelo', inp('cp.veh.anio', cp.veh.anio, 'class="mono" maxlength="4" inputmode="numeric"'))}
    ${F('Peso bruto vehicular (t)', inp('cp.veh.pesoVeh', cp.veh.pesoVeh, 'class="mono" inputmode="decimal"'))}${F('Aseguradora resp. civil', inp('cp.veh.aseg', cp.veh.aseg))}${F('Póliza', inp('cp.veh.poliza', cp.veh.poliza, 'class="mono up"'), 'span2')}
    ${((CAT.configMeta[cp.veh.config] || {}).rem || '0') !== '0' ? F('Remolque / semirremolque' + ((CAT.configMeta[cp.veh.config] || {}).rem === '0,1' ? ' (opcional)' : ''), sel('cp.veh.remSub', CAT.subTipoRem, cp.veh.remSub, true, (CAT.configMeta[cp.veh.config] || {}).rem === '0,1' ? 'Sin remolque' : 'Selecciona…'), 'span2') + F('Placa del remolque', inp('cp.veh.remPlaca', cp.veh.remPlaca, 'class="mono up" maxlength="7"')) : ''}
    ${cp.merc.some(m => m.peligroso === 'Sí') ? F('Aseguradora daños al medio ambiente', inp('cp.veh.asegMA', cp.veh.asegMA), 'span2') + F('Póliza medio ambiente', inp('cp.veh.polizaMA', cp.veh.polizaMA, 'class="mono up"'), 'span2') : ''}
    ${F('Aseguradora de la carga (opcional)', inp('cp.veh.asegCarga', cp.veh.asegCarga))}${F('Póliza de la carga', inp('cp.veh.polizaCarga', cp.veh.polizaCarga, 'class="mono up"'))}${F('Prima del seguro', inp('cp.veh.prima', cp.veh.prima, 'class="mono" inputmode="decimal" placeholder="0.00"'))}
  </div>
  <h3 class="sub">Figuras de transporte</h3>
  ${cp.ops.map((o, i) => `<div class="grid4 opline">${F('Tipo', sel(`cp.ops.${i}.tipo`, CAT.tipoFigura, o.tipo, true, undefined, 'data-r="1"'))}${F('RFC', inp(`cp.ops.${i}.rfc`, o.rfc, 'class="mono up" maxlength="13"'))}${F('Nombre', inp(`cp.ops.${i}.nombre`, o.nombre, 'class="up"'))}${o.tipo === '01' ? F('Licencia federal', inp(`cp.ops.${i}.licencia`, o.licencia, 'class="mono up"')) : ['02', '03'].includes(o.tipo) ? F('Parte del transporte (c_ParteTransporte)', sel(`cp.ops.${i}.parte`, CAT.parteTransporte, o.parte, true, 'Selecciona…')) : '<div></div>'}<button class="x" data-a="delOp" data-i="${i}" aria-label="Quitar figura">×</button></div>`).join('')}
  <div class="row wrap">${S.operadores.length ? `<select class="sm" data-a2="pickOp">${opts(S.operadores.map(o => [o.id, `${o.nombre} · ${o.licencia}`]), '', false, 'Agregar operador guardado…')}</select>` : ''}<button class="btn ghost sm" data-a="addOp">Agregar figura manualmente</button></div>
  </section>`;
}
function updateSide() {
  const d = S.draft, em = EM(); if (!d || !$('#side')) return;
  const v = validar(d, em), k = v.k;
  k.lines.forEach((l, i) => { const el = $('#lt_' + i); if (el) el.textContent = d.tipo === 'T' ? '' : money(l.base, d.moneda); });
  const nombreImp = t => (t.imp === '002' ? 'IVA' : t.imp === '003' ? 'IEPS' : 'ISR') + (t.factor === 'Exento' ? ' exento' : t.factor === 'Cuota' ? ' cuota' : ' ' + r2(num(t.tasa) * 100) + '%');
  $('#side').innerHTML = `<div class="sumcard"><p class="eyebrow">${esc(lbl(CAT.tipo, d.tipo))}${d.cp ? ' + Carta Porte' : ''} · ${esc(d.serie)}${esc(d.folio)}</p>
  ${d.tipo === 'T' ? '<p class="muted small">Un CFDI de traslado tiene total en cero: ampara la mercancía, no una venta.</p>' : `<dl class="tot">
    <div><dt>Subtotal</dt><dd>${money(k.sub, d.moneda)}</dd></div>${k.des > 0 ? `<div><dt>Descuento</dt><dd>−${money(k.des, d.moneda)}</dd></div>` : ''}
    ${k.tras.map(t => `<div><dt>${nombreImp(t)}</dt><dd>${t.factor === 'Exento' ? '—' : money(t.importe, d.moneda)}</dd></div>`).join('')}
    ${k.ret.map(t => `<div class="ret"><dt>Ret. ${t.imp === '001' ? 'ISR' : 'IVA'}</dt><dd>−${money(t.importe, d.moneda)}</dd></div>`).join('')}
    <div class="grand"><dt>Total</dt><dd>${money(k.total, d.moneda)}</dd></div></dl>`}
  </div>
  <details class="valid" id="vdet"${(S._vOpen ?? window.innerWidth >= 1500) ? ' open' : ''}><summary><h3>${v.E.length ? `${v.E.length} ${v.E.length === 1 ? 'dato por corregir' : 'datos por corregir'}` : 'Listo para emitir'}${v.W.length ? ` · ${v.W.length} aviso${v.W.length > 1 ? 's' : ''}` : ''}</h3></summary>
  <ul>${v.E.concat(v.W).map((e, j) => `<li class="${j < v.E.length ? 'e' : 'w'}"><span>${esc(e.m)}</span><small>${e.code ? `<b class="mono">${esc(e.code)}</b> · ` : ''}${e.attr ? `<span class="mono">${esc(e.attr)}</span> · ` : ''}${esc(e.ley)}</small>${e.fix && FIXES[e.fix] ? `<button class="btn sm ghost fixb" data-a="fix" data-f="${e.fix}">${esc(FIXES[e.fix].l)}</button>` : ''}</li>`).join('')}</ul>
  ${!v.E.length && !v.W.length ? '<p class="muted small">Todas las reglas del Anexo 20 que revisamos se cumplen.</p>' : ''}</details>
  <div class="sidebtns"><button class="btn block" data-a="review" ${v.E.length ? 'disabled' : ''}>Revisar y emitir <kbd>Ctrl</kbd><kbd>Enter</kbd></button>
  <button class="btn ghost block" data-a="resetDraft">Empezar de nuevo</button>
  <button class="link small" data-a="traductor">¿Tu PAC rechazó un CFDI? Traduce el error</button></div>`;
  const vd = $('#vdet'); if (vd) vd.addEventListener('toggle', () => { S._vOpen = vd.open; });
}

/* ============ REVISIÓN Y EMISIÓN ============ */
function review() {
  const d = S.draft, em = EM(), v = validar(d, em); if (v.E.length) return updateSide();
  const k = v.k;
  openModal(`<header class="mh"><h3>Antes de emitir, confirma</h3><button class="x" data-a="close" aria-label="Cerrar">×</button></header>
  <div class="revgrid"><div><p class="eyebrow">Emisor</p><p><b>${esc(em.nombre)}</b><br><span class="mono">${esc(em.rfc)}</span> · Régimen ${esc(em.regimen)}</p></div>
  <div><p class="eyebrow">Receptor</p><p><b>${esc(d.receptor.nombre.toUpperCase())}</b><br><span class="mono">${esc(d.receptor.rfc.toUpperCase())}</span> · Régimen ${esc(d.receptor.regimen)} · CP ${esc(d.receptor.cp)} · Uso ${esc(d.receptor.uso)}</p></div>
  <div><p class="eyebrow">Comprobante</p><p>${esc(lbl(CAT.tipo, d.tipo))}${d.cp ? ' con Carta Porte 3.1' : ''} · ${esc(d.serie)}${esc(d.folio)}${d.tipo !== 'T' ? `<br>${esc(d.metodoPago)} · Forma ${esc(d.formaPago)} · ${esc(d.moneda)}` : ''}</p></div>
  <div><p class="eyebrow">Total</p><p class="big">${d.tipo === 'T' ? '$0.00' : money(k.total, d.moneda)}</p></div></div>
  ${v.W.some(w => !w.exc) ? `<div class="alert warn"><span>${v.W.filter(w => !w.exc).map(w => esc(w.m)).join('<br>')}</span></div>` : ''}
  <label class="check"><input type="checkbox" id="ck1"> Verifiqué RFC, nombre, régimen y código postal del receptor contra su Constancia de Situación Fiscal.</label>
  <label class="check"><input type="checkbox" id="ck2"> Confirmo que la operación es real y los conceptos describen lo que se ${d.tipo === 'T' ? 'traslada' : 'vende o cobra'} (CFF art. 29-A).</label>
  ${v.W.some(w => !w.exc) ? '<label class="check"><input type="checkbox" id="ck3"> Leí las advertencias y quiero continuar.</label>' : ''}
  <p class="muted small">Modo demostración: el folio fiscal se genera localmente y no tiene validez ante el SAT hasta que conectes un PAC con tu CSD.</p>
  ${d.sustituye ? `<div class="alert warn"><span>Al emitir, se cancelará ${esc((S.cfdis.find(x => x.id === d.sustituye) || {}).serie || '')}${esc((S.cfdis.find(x => x.id === d.sustituye) || {}).folio || '')} con motivo 01.</span></div>` : ''}
  <footer class="mf"><span class="muted small grow"><kbd>Ctrl</kbd><kbd>Enter</kbd> emite cuando marcas las confirmaciones</span><button class="btn ghost" data-a="close">Volver a editar</button><button class="btn" data-a="emitir">Emitir CFDI</button></footer>`);
}
async function emitirDraft(d, o = {}) {
  const em = EM(); const k = calcDoc(d);
  d.fecha = o.fecha || nowLocal();
  const uuid = uid().toUpperCase(), tfd = {uuid, fecha: d.fecha};
  const xml = xmlCFDI(d, em, k, {tfd});
  const rec = {emisorId: em.id, tipo: d.tipo, serie: d.serie, folio: d.folio, fecha: d.fecha, uuid, estado: 'Vigente', receptor: clone(d.receptor), moneda: d.moneda, tc: d.moneda === 'MXN' ? 1 : num(d.tipoCambio),
    total: k.total, subtotal: k.sub, metodo: d.metodoPago, forma: d.formaPago, cp: !!d.cp, global: d.global.on, saldo: d.tipo === 'I' && d.metodoPago === 'PPD' ? k.total : 0, pagos: [],
    imp: {tras: k.tras, ret: k.ret, total: k.total}, relacion: clone(d.relacion), draft: clone(d), xml, demo: !!o.demo};
  await saveRec('cfdi', rec);
  em.folios = em.folios || {}; em.folios[d.tipo] = (num(d.folio) || 0) + 1; await saveRec('emisor', em);
  if (d.sustituye) { const o = S.cfdis.find(x => x.id === d.sustituye); if (o && o.estado !== 'Cancelado') { o.estado = 'Cancelado'; o.cancel = {motivo: '01', sust: uuid, fecha: nowLocal(), auto: true}; if (o.tipo === 'I') o.saldo = 0; await saveRec('cfdi', o); rec.sustituyo = o.serie + o.folio; } }
  if (d.saveCliente && d.tipo !== 'T' && !d.global.on && !['PG', 'EXT'].includes(rfcTipo(d.receptor.rfc)) && !o.silent) {
    const ex = S.clientes.find(c => c.rfc === d.receptor.rfc.toUpperCase());
    await saveRec('cliente', Object.assign(ex || {}, {rfc: d.receptor.rfc.toUpperCase(), nombre: d.receptor.nombre.toUpperCase(), regimen: d.receptor.regimen, cp: d.receptor.cp, uso: d.receptor.uso, preset: d.preset}));
  }
  if (d.relacion.tipo === '01' || d.relacion.tipo === '03' || d.relacion.tipo === '07') {
    for (const u of d.relacion.uuids.split(/[\s,]+/).filter(Boolean)) { const f = S.cfdis.find(c => c.uuid === u.toUpperCase()); if (f && f.metodo === 'PPD' && f.saldo > 0) { f.saldo = r2(Math.max(0, f.saldo - k.total)); f.notas = (f.notas || []).concat([{uuid, monto: k.total}]); await saveRec('cfdi', f); } }
  }
  return rec;
}
