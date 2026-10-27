/* ============ ESTATUS DEL CFDI ANTE EL SAT (ConsultaCFDIService) ============ */
/* El servicio SOAP del SAT no admite llamadas directas desde un navegador (CORS); en producción la consulta
   la hace el servidor o el PAC con la misma expresión impresa. Aquí un simulador aplica las reglas de la RMF 2026. */
const SAT_WS = 'https://consultaqr.facturaelectronica.sat.gob.mx/ConsultaCFDIService.svc';
const SAT_ACTION = 'http://tempuri.org/IConsultaCFDIService/Consulta';
const SAT_FUENTE = 'Simulador local (reglas RMF 2026)';
S.satSim = {}; S.satProg = null;
const _mcache = new Map();
function recModel(c) { if (c._m) return c._m; if (!c.xml) return null; if (_mcache.has(c.id)) return _mcache.get(c.id); let m = null; try { m = modelCFDI(c.xml); } catch (e) {} _mcache.set(c.id, m); return m; }
function satDatos(c) {
  const m = recModel(c), em = EM() || {};
  const total = c.tipo === 'R' ? (m && m.totales ? num(m.totales.MontoTotOperacion) : num(c.totalRet)) : c.tipo === 'P' ? 0 : num(c.total);
  let sello = m ? String((m.tfd || {}).SelloCFD || m.sello || '') : ''; if (sello.length < 20 && c.uuid) sello = selloDemo(String(c.uuid).toUpperCase() + 'cfd');
  return {re: (m && m.emisor && m.emisor.rfc) || em.rfc || '', rr: (c.receptor || {}).rfc || '', tt: total.toFixed(6).padStart(17, '0'), id: String(c.uuid || '').toUpperCase(), fe: sello.slice(-8)};
}
const expresionImpresa = c => { const x = satDatos(c); return `?re=${x.re}&rr=${x.rr}&tt=${x.tt}&id=${x.id}&fe=${x.fe}`; };
const verificadorURL = c => { const x = satDatos(c); return (c.tipo === 'R' ? 'https://prodretencionverificacion.clouda.sat.gob.mx/' : 'https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx') + `?id=${encodeURIComponent(x.id)}&re=${encodeURIComponent(x.re)}&rr=${encodeURIComponent(x.rr)}&tt=${x.tt}&fe=${encodeURIComponent(x.fe)}`; };
const soapConsulta = expr => `POST ${SAT_WS}\nContent-Type: text/xml; charset=utf-8\nSOAPAction: "${SAT_ACTION}"\n\n<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">\n  <soapenv:Header/>\n  <soapenv:Body>\n    <tem:Consulta>\n      <tem:expresionImpresa><![CDATA[${expr}]]></tem:expresionImpresa>\n    </tem:Consulta>\n  </soapenv:Body>\n</soapenv:Envelope>`;

/* Días hábiles (lunes a viernes; no descuenta días festivos) */
function sumarDiasHabiles(d, n) { const x = new Date(d); let k = 0; while (k < n) { x.setDate(x.getDate() + 1); const w = x.getDay(); if (w !== 0 && w !== 6) k++; } return x; }
function finDiaHabilSiguiente(fecha) { const x = sumarDiasHabiles(new Date(fecha), 1); x.setHours(23, 59, 59, 0); return x; }
/* RMF 2026, regla 2.7.1.35: supuestos de cancelación sin aceptación del receptor */
function motivoSinAceptacion(c, ahora = new Date()) {
  const rt = rfcTipo((c.receptor || {}).rfc || ''), tot = (c.tipo === 'P' || c.tipo === 'R') ? 0 : num(c.total) * (num(c.tc) || 1);
  if (c.tipo === 'E') return 'CFDI de egreso (notas de crédito, devoluciones, descuentos y bonificaciones)';
  if (c.tipo === 'T') return 'CFDI de traslado';
  if (c.tipo === 'N') return 'CFDI de nómina';
  if (c.tipo === 'R') return 'CFDI de retenciones e información de pagos';
  if (c.global || rt === 'PG') return 'Factura global a público en general';
  if (rt === 'EXT') return 'Receptor residente en el extranjero';
  if (tot <= 1000) return `Monto total de hasta $1,000.00 (${money(tot)})`;
  if (c.fecha && ahora <= finDiaHabilSiguiente(c.fecha)) return 'Se cancela a más tardar el día hábil siguiente a su emisión';
  return '';
}
function hijosVigentes(c) {
  const out = [];
  (c.pagos || []).forEach(p => { const pc = S.cfdis.find(x => x.uuid === p.uuid); if (pc && pc.estado !== 'Cancelado') out.push({uuid: pc.uuid, folio: pc.serie + pc.folio, tipo: 'Complemento de pago (REP 2.0)', id: pc.id}); });
  if (c.uuid) S.cfdis.forEach(x => {
    if (x.id === c.id || x.estado === 'Cancelado' || out.some(o => o.uuid === x.uuid)) return;
    const r = x.relacion || {}; if (r.tipo && r.tipo !== '04' && String(r.uuids || '').toUpperCase().includes(c.uuid)) out.push({uuid: x.uuid, folio: x.serie + x.folio, tipo: x.tipo === 'E' ? `Nota de crédito (relación ${r.tipo})` : `CFDI relacionado (tipo ${r.tipo})`, id: x.id});
  });
  return out;
}
function satConsulta(c) {
  const sim = c.satSim || S.satSim[c.uuid] || {}, can = c.cancel || {};
  const res = {ts: new Date().toISOString(), fuente: SAT_FUENTE, expr: expresionImpresa(c), hijos: [], motivoSinA: ''};
  if (!UUID_RE.test(c.uuid || '')) return Object.assign(res, {CodigoEstatus: 'N - 601: La expresión impresa proporcionada no es válida.', Estado: 'No Encontrado', EsCancelable: '', EstatusCancelacion: '', ValidacionEFOS: ''});
  if (sim.estado === 'nf') return Object.assign(res, {CodigoEstatus: 'N - 602: Comprobante no encontrado.', Estado: 'No Encontrado', EsCancelable: '', EstatusCancelacion: '', ValidacionEFOS: ''});
  const cancelado = c.estado === 'Cancelado', hijos = cancelado ? [] : hijosVigentes(c), sinA = motivoSinAceptacion(c, can.fecha ? new Date(can.fecha) : new Date());
  return Object.assign(res, {
    CodigoEstatus: 'S - Comprobante obtenido satisfactoriamente.', Estado: cancelado ? 'Cancelado' : 'Vigente',
    EsCancelable: hijos.length ? 'No cancelable' : sinA ? 'Cancelable sin aceptación' : 'Cancelable con aceptación',
    EstatusCancelacion: cancelado ? (can.est && can.est !== 'En proceso' ? can.est : 'Cancelado sin aceptación') : (can.est || ''),
    ValidacionEFOS: sim.efos ? '100' : '200', hijos, motivoSinA: sinA
  });
}
/* Consulta para un XML externo que aún no está en la base */
function satConsultaModel(m) {
  const uuid = String((m.tfd || {}).UUID || '').toUpperCase(), ex = S.cfdis.find(c => c.uuid === uuid); if (ex) return satConsulta(ex);
  const sim = S.satSim[uuid] || {}, r = m.receptor || {};
  const fake = {id: 'x' + uuid, uuid, tipo: m.kind === 'ret' ? 'R' : m.tipo, total: m.total, tc: num(m.tipoCambio) || 1, receptor: r, fecha: m.fecha, estado: sim.estado === 'cancelado' ? 'Cancelado' : 'Vigente', global: !!m.global, _m: m, satSim: sim,
    cancel: sim.estado === 'cancelado' ? {est: sim.est || 'Cancelado sin aceptación', motivo: sim.motivo || '02'} : sim.estado === 'proceso' ? {est: 'En proceso', fecha: nowLocal()} : null};
  return satConsulta(fake);
}
function satNivel(r) { if (!r) return 'none'; if (r.Estado === 'No Encontrado') return 'nf'; if (r.Estado === 'Cancelado') return 'cancel'; if (r.EstatusCancelacion === 'En proceso') return 'proc'; return 'vig'; }
function horasRestantes(c) { const l = c.cancel && c.cancel.limite ? new Date(c.cancel.limite) : null; if (!l) return ''; const h = Math.max(0, Math.round((l - new Date()) / 36e5)); return h > 48 ? `${Math.floor(h / 24)} días ${h % 24} h` : `${h} h`; }
const LOCK = '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path fill="currentColor" d="M4 7V5a4 4 0 1 1 8 0v2h.5A1.5 1.5 0 0 1 14 8.5v5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 13.5v-5A1.5 1.5 0 0 1 3.5 7H4Zm2 0h4V5a2 2 0 1 0-4 0v2Z"/></svg>';
function satBadge(c, o = {}) {
  const r = c.sat, n = satNivel(r), ts = r ? `Verificado ${fmtTs(r.ts)} · ${r.fuente}` : 'Aún no se consulta en el SAT';
  let t = 'Sin verificar', sub = 'Pulsa “Verificar en SAT”';
  if (n === 'vig') { t = 'Vigente'; sub = r.EsCancelable === 'No cancelable' ? `${LOCK} No cancelable: lo bloquea ${esc(r.hijos.map(h => `${h.folio} (${h.uuid.slice(0, 8)}…)`).join(', '))}` : esc(r.EsCancelable) + (r.EstatusCancelacion === 'Solicitud rechazada' ? ' · solicitud rechazada' : ''); }
  if (n === 'proc') { t = 'En proceso de cancelación'; sub = `Buzón Tributario: quedan ${esc(horasRestantes(c) || '3 días hábiles')}`; }
  if (n === 'cancel') { t = 'Cancelado'; sub = esc(r.EstatusCancelacion) + (c.cancel && c.cancel.motivo ? ` · motivo ${esc(c.cancel.motivo)}` : ''); }
  if (n === 'nf') { t = 'No encontrado'; sub = esc(r.CodigoEstatus); }
  const efos = r && r.ValidacionEFOS === '100';
  return `<span class="satcell"><button class="sat ${n}" data-a="acuse" data-id="${c.id}" title="${esc(ts)}"><b>${t}</b><small>${sub}</small></button>${efos ? `<button class="sat efos" data-a="acuse" data-id="${c.id}"><b>Alerta EFOS 69-B</b><small>ValidacionEFOS 100</small></button>` : ''}</span>`;
}
function satMini(r) { const n = satNivel(r); return r ? chip({vig: 'SAT: Vigente', proc: 'SAT: En proceso', cancel: 'SAT: Cancelado', nf: 'SAT: No encontrado'}[n], {vig: 'ok', proc: 'warn', cancel: 'bad', nf: ''}[n]) + (r.ValidacionEFOS === '100' ? ' ' + chip('EFOS 69-B', 'efos') : '') : ''; }

/* ---- Aplicar los cambios de estatus en la base ---- */
async function aplicarCancelacion(c, est, o = {}) {
  if (c.estado === 'Cancelado') { c.cancel = Object.assign(c.cancel || {}, {est}); await saveRec('cfdi', c); return; }
  c.estado = 'Cancelado'; c.cancel = Object.assign({motivo: o.motivo || '02', sust: o.sust || '', fecha: nowLocal()}, c.cancel || {}, {est, fin: nowLocal()});
  if (c.tipo === 'P') for (const p of c.pagosDe || []) { const f = S.cfdis.find(x => x.id === p.id); if (f) { f.pagos = (f.pagos || []).filter(x => x.uuid !== c.uuid); f.saldo = r2(f.saldo + p.monto); await saveRec('cfdi', f); } }
  if (c.tipo === 'E') for (const f of S.cfdis.filter(x => (x.notas || []).some(n => n.uuid === c.uuid))) { const n = f.notas.find(n => n.uuid === c.uuid); f.saldo = r2(f.saldo + n.monto); f.notas = f.notas.filter(x => x.uuid !== c.uuid); await saveRec('cfdi', f); }
  if (c.tipo === 'I') c.saldo = 0;
  await saveRec('cfdi', c);
}
function saldoVivo(c) { if (!(c.tipo === 'I' && c.metodo === 'PPD')) return 0; const pg = (c.pagos || []).reduce((a, p) => a + num(p.monto), 0), nc = (c.notas || []).reduce((a, n) => a + num(n.monto), 0); return r2(Math.max(0, c.total - pg - nc)); }
async function reactivar(c) {
  if (c.estado === 'Cancelado') {
    c.estado = 'Vigente';
    if (c.tipo === 'P') for (const p of c.pagosDe || []) { const f = S.cfdis.find(x => x.id === p.id); if (f && !(f.pagos || []).some(x => x.uuid === c.uuid)) { f.pagos = (f.pagos || []).concat([{uuid: c.uuid, monto: p.monto, parc: p.parc, saldo: r2(f.saldo - p.monto), fecha: c.fechaPago || c.fecha}]); f.saldo = r2(Math.max(0, f.saldo - p.monto)); await saveRec('cfdi', f); } }
    c.saldo = saldoVivo(c);
  }
  c.cancel = null;
}
async function satVerificar(c, o = {}) {
  if (c.cancel && c.cancel.est === 'En proceso' && c.cancel.limite && new Date() > new Date(c.cancel.limite)) await aplicarCancelacion(c, 'Plazo vencido');
  const prev = c.sat, r = satConsulta(c); c.sat = r;
  const pn = satNivel(prev), n = satNivel(r), org = `${c.serie || ''}${c.folio || ''}`;
  if (r.ValidacionEFOS === '100' && (!prev || prev.ValidacionEFOS !== '100')) bitaLog({fuente: 'sat', sev: 'crit', origen: org, ref: c.uuid, code: 'EFOS_69B', diag: 'ValidacionEFOS = 100: el emisor aparece en el listado del art. 69-B del CFF (operaciones presuntamente inexistentes). Revisa el caso con tu contador antes de seguir facturando o deduciendo.', action: {kind: 'acuse', id: c.id}});
  if (n !== pn && prev) {
    if (n === 'nf') bitaLog({fuente: 'sat', sev: 'crit', origen: org, ref: c.uuid, code: 'SAT_NO_ENCONTRADO', diag: `${r.CodigoEstatus} El UUID no aparece en el SAT con esa expresión impresa: revisa que se haya timbrado con un PAC autorizado.`, action: {kind: 'acuse', id: c.id}});
    if (n === 'cancel') bitaLog({fuente: 'sat', sev: 'warn', origen: org, ref: c.uuid, code: 'SAT_CANCELADO', diag: `El SAT reporta el CFDI como Cancelado (${r.EstatusCancelacion}). Ya no admite complementos de pago ni notas de crédito; su serie y folio siguen bloqueados.`, action: {kind: 'acuse', id: c.id}});
    if (n === 'proc') bitaLog({fuente: 'sat', sev: 'warn', origen: org, ref: c.uuid, code: 'SAT_EN_PROCESO', diag: 'Cancelación en proceso: el receptor tiene 3 días hábiles para aceptarla o rechazarla en su Buzón Tributario.', action: {kind: 'acuse', id: c.id}});
  }
  if (!o.noSave) await saveRec('cfdi', c);
  return r;
}

/* ---- Vista Comprobantes con semáforo SAT ---- */
function comprobantesFiltrados() {
  const em = EM(), f = S.f, q = f.q.trim().toLowerCase();
  return S.cfdis.filter(c => c.emisorId === em.id)
    .filter(c => !f.tipo || (f.tipo === 'CP' ? c.cp : c.tipo === f.tipo))
    .filter(c => { const n = satNivel(c.sat); return !f.estado || (f.estado === 'PPD' ? c.metodo === 'PPD' && c.saldo > 0.009 && c.estado !== 'Cancelado' : f.estado === 'proc' ? (c.cancel || {}).est === 'En proceso' : f.estado === 'efos' ? c.sat && c.sat.ValidacionEFOS === '100' : f.estado === 'sinver' ? n === 'none' : f.estado === 'nf' ? n === 'nf' : c.estado === f.estado); })
    .filter(c => !q || [c.serie + c.folio, c.uuid, c.receptor.rfc, c.receptor.nombre, f2(c.total)].join(' ').toLowerCase().includes(q))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}
VIEWS.comprobantes = () => {
  const f = S.f, rows = comprobantesFiltrados();
  return `<header class="ph"><div><p class="eyebrow">Base de datos de CFDI</p><h1>Comprobantes</h1></div><div class="row wrap"><button class="btn" data-a="satSync" ${rows.length ? '' : 'disabled'}>Sincronizar estatus SAT del lote (${rows.length})</button><button class="btn ghost" data-a="exportCSV">Exportar a CSV</button></div></header>
  <div id="satprog">${S.satProg ? progHTML(S.satProg) : ''}</div>
  <div class="filters"><div class="fld grow"><label for="fq">Buscar</label><input id="fq" data-f="q" value="${esc(f.q)}" placeholder="Folio, UUID, RFC, cliente o monto"></div>
  <div class="fld"><label for="ft">Tipo</label><select id="ft" data-f="tipo">${opts([['I', 'Ingreso'], ['E', 'Egreso'], ['T', 'Traslado'], ['P', 'Pago'], ['R', 'Retenciones'], ['CP', 'Con Carta Porte']], f.tipo, false, 'Todos')}</select></div>
  <div class="fld"><label for="fe">Estatus</label><select id="fe" data-f="estado">${opts([['Vigente', 'Vigentes'], ['proc', 'En proceso de cancelación'], ['Cancelado', 'Cancelados'], ['efos', 'Alerta EFOS 69-B'], ['nf', 'No encontrados en el SAT'], ['sinver', 'Sin verificar en el SAT'], ['PPD', 'Por cobrar (PPD)']], f.estado, false, 'Todos')}</select></div></div>
  ${rows.length ? `<div class="tw"><table class="comptbl"><thead><tr><th>Folio</th><th>Tipo</th><th>Receptor</th><th>Fecha</th><th class="n">Total</th><th>Cobranza</th><th>Estatus SAT</th><th></th></tr></thead><tbody>
  ${rows.map(c => `<tr class="click" data-a="ver" data-id="${c.id}" tabindex="0"><td class="mono">${esc(c.serie)}${esc(c.folio)}${c.demo ? ' ' + chip('Ejemplo') : ''}${c.externo ? ' ' + chip('XML') : ''}</td><td>${esc(tipoNombre(c))}</td><td><span class="mono small">${esc(c.receptor.rfc)}</span><br>${esc(c.receptor.nombre)}</td><td>${fmtDate(c.fecha)}</td><td class="n">${c.tipo === 'P' ? money(c.montoPago, c.moneda) : c.tipo === 'R' ? money(c.totalRet) : money(c.total, c.moneda)}</td><td>${estadoChip(c)}</td><td>${satBadge(c)}</td>
  <td class="acts"><button class="btn sm ghost" data-a="satUno" data-id="${c.id}">Verificar en SAT</button><button class="btn sm ghost" data-a="verPDF" data-id="${c.id}">PDF</button>${['I', 'E', 'T'].includes(c.tipo) && c.estado !== 'Cancelado' && !((c.cancel || {}).est === 'En proceso') && c.draft ? `<button class="btn sm ghost" data-a="sustituir" data-id="${c.id}" title="Abre una copia editable; al timbrarla se cancela esta con motivo 01">Corregir y sustituir</button>` : ''}</td></tr>`).join('')}
  </tbody></table></div>` : '<p class="empty">No hay comprobantes con estos filtros.</p>'}`;
};

/* ---- Acuse de validación SAT ---- */
function acuseHTML(c) {
  const r = c.sat || satConsulta(c), n = satNivel(r), x = satDatos(c), proc = n === 'proc', sim = c.satSim || {};
  const efectos = [];
  if (n === 'cancel') efectos.push('No se pueden emitir complementos de pago ni notas de crédito sobre este UUID.', `Su folio interno ${fmtSF(c.serie, c.folio)} sigue bloqueado: no se reutiliza.`);
  if (n === 'proc') efectos.push('Mientras la solicitud esté en proceso no se registran pagos ni notas de crédito sobre este UUID.', 'Si el receptor no responde en 3 días hábiles, la cancelación procede (plazo vencido).');
  if (n === 'vig') { if (c.tipo === 'I' && c.metodo === 'PPD' && c.saldo > 0.009) efectos.push(`Puede recibir complementos de pago: saldo ${money(c.saldo, c.moneda)}.`); efectos.push(r.EsCancelable === 'No cancelable' ? 'Para cancelarlo, primero cancela los documentos relacionados que lo bloquean.' : r.EsCancelable === 'Cancelable sin aceptación' ? `Se cancela sin aceptación del receptor: ${r.motivoSinA}.` : 'Requiere que el receptor acepte la cancelación en su Buzón Tributario (3 días hábiles).'); }
  if (n === 'nf') efectos.push('No uses este UUID para pagos ni deducciones hasta confirmar su timbrado con el PAC.');
  if (r.ValidacionEFOS === '100') efectos.push('Alerta EFOS: el emisor aparece en el listado definitivo del art. 69-B; los CFDI pueden no tener efectos fiscales para quien los recibe.');
  const ef = v => v === '100' ? '100 · Alerta crítica: emisor en lista 69-B' : v === '200' ? '200 · Sin incidencias' : '—';
  return `<header class="mh"><div><p class="eyebrow">Acuse de validación SAT · ConsultaCFDIService</p><h3>${esc(tipoNombre(c))} ${esc(c.serie || '')}${esc(c.folio || '')}</h3></div><button class="x" data-a="close" aria-label="Cerrar">×</button></header>
  <div class="row wrap">${satBadge(c)}<span class="muted small">Consulta: ${esc(fmtTs(r.ts))} · ${esc(r.fuente)}</span></div>
  <div class="tw"><table class="acuse"><thead><tr><th>Nodo</th><th>Respuesta</th><th>Qué significa</th></tr></thead><tbody>
    <tr><td class="mono">CodigoEstatus</td><td><b>${esc(r.CodigoEstatus)}</b></td><td class="small">S: el SAT encontró el comprobante. N - 601: expresión impresa inválida. N - 602: no encontrado.</td></tr>
    <tr><td class="mono">Estado</td><td><b>${esc(r.Estado)}</b></td><td class="small">Vigente, Cancelado o No Encontrado.</td></tr>
    <tr><td class="mono">EsCancelable</td><td><b>${esc(r.EsCancelable || '—')}</b>${r.hijos.length ? `<br><small>${LOCK} Documentos que lo bloquean: ${r.hijos.map(h => `<button class="link" data-a="ver" data-id="${h.id}">${esc(h.folio)}</button> ${esc(h.tipo)} (${esc(h.uuid.slice(0, 8))}…)`).join('; ')}</small>` : r.motivoSinA ? `<br><small class="muted">${esc(r.motivoSinA)}</small>` : ''}</td><td class="small">Sin aceptación: monto hasta $1,000, egreso, traslado, nómina, retenciones, global, extranjero o dentro del día hábil siguiente (RMF 2026, regla 2.7.1.35). No cancelable: tiene CFDI relacionados vigentes.</td></tr>
    <tr><td class="mono">EstatusCancelacion</td><td><b>${esc(r.EstatusCancelacion || 'Ninguno')}</b>${proc ? `<br><small>Límite: ${esc(new Date(c.cancel.limite).toLocaleString('es-MX'))}</small>` : ''}</td><td class="small">En proceso, Cancelado sin/con aceptación, Plazo vencido o Solicitud rechazada. Vacío si no hay solicitud.</td></tr>
    <tr><td class="mono">ValidacionEFOS</td><td><b>${ef(r.ValidacionEFOS)}</b></td><td class="small">200: el emisor no está en el listado 69-B. 100: sí está.</td></tr>
  </tbody></table></div>
  ${efectos.length ? `<div class="alert ${n === 'cancel' || n === 'nf' || r.ValidacionEFOS === '100' ? 'bad' : n === 'proc' ? 'warn' : 'info'}"><span><b>Qué hace el sistema:</b> ${efectos.map(esc).join(' ')}</span></div>` : ''}
  ${proc ? `<div class="card tight"><p class="eyebrow">Simular respuesta del receptor en su Buzón Tributario</p><div class="row wrap"><button class="btn sm" data-a="satResp" data-id="${c.id}" data-v="acepta">Receptor acepta</button><button class="btn sm ghost" data-a="satResp" data-id="${c.id}" data-v="rechaza">Receptor rechaza</button><button class="btn sm ghost" data-a="satResp" data-id="${c.id}" data-v="vence">Vence el plazo sin respuesta</button></div></div>` : ''}
  <div class="fld"><label>ExpresionImpresa</label><pre class="xml expr" id="exprpre">${esc(r.expr || expresionImpresa(c))}</pre>
  <small>re = RFC emisor · rr = RFC receptor · tt = total a 17 posiciones (${esc(x.tt)}) · id = UUID · fe = últimos 8 caracteres del sello (${esc(x.fe || '—')}).</small></div>
  <div class="row wrap"><button class="btn sm ghost" data-a="copyExpr">Copiar expresión</button><a class="btn sm ghost" href="${esc(verificadorURL(c))}" target="_blank" rel="noopener">Abrir en el verificador del SAT</a></div>
  <details class="soap"><summary>Solicitud SOAP que envía el servidor o el PAC</summary><pre class="xml">${esc(soapConsulta(r.expr || expresionImpresa(c)))}</pre></details>
  <fieldset class="simbox"><legend>Simulador: prueba cómo reacciona el sistema</legend>
    <div class="seg">${[['vigente', 'Vigente'], ['proceso', 'En proceso'], ['cancelado', 'Cancelado'], ['nf', 'No encontrado']].map(([k, t]) => `<button class="${(k === 'vigente' && n === 'vig') || (k === 'proceso' && proc) || (k === 'cancelado' && n === 'cancel') || (k === 'nf' && n === 'nf') ? 'on' : ''}" data-a="satSim" data-id="${c.id}" data-v="${k}">${t}</button>`).join('')}</div>
    <label class="check"><input type="checkbox" data-a2="satEfos" data-id="${c.id}"${sim.efos ? ' checked' : ''}> ValidacionEFOS = 100 (emisor en lista 69-B)</label>
    <small class="muted">Cancelado aplica los efectos reales en tu base: libera saldos de pagos o notas y bloquea nuevos complementos. Vigente los revierte.</small></fieldset>
  <p class="muted small">El navegador no puede llamar directo al servicio SOAP del SAT; en producción tu servidor o tu PAC envía esta misma expresión impresa a ${esc(SAT_WS)}. Los días hábiles no descuentan días festivos.</p>
  <footer class="mf"><button class="btn ghost" data-a="satUno" data-id="${c.id}" data-modal="1">Volver a consultar</button><button class="btn" data-a="close">Cerrar</button></footer>`;
}
async function abrirAcuse(id) { const c = S.cfdis.find(x => x.id === id); if (!c) return; await satVerificar(c); openModal(acuseHTML(c), true); }
