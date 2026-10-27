/* ============ REPRESENTACIÓN IMPRESA: PDF propio (sin librerías) + vista previa en canvas ============ */
const MCTX = (() => { try { return document.createElement('canvas').getContext('2d'); } catch (e) { return null; } })();
function tw(s, size, bold, mono) {
  s = String(s ?? '');
  if (mono) return s.length * size * 0.6;
  if (!MCTX) return s.length * size * 0.52;
  MCTX.font = `${bold ? 'bold ' : ''}${size}px Arial, Helvetica, "Liberation Sans", sans-serif`;
  return MCTX.measureText(s).width;
}
function wrap(s, w, size, bold, mono) {
  const out = [];
  String(s ?? '').split('\n').forEach(par => {
    const toks = par.split(/(\s+)/); let line = '';
    for (const t of toks) {
      if (!t) continue;
      if (tw(line + t, size, bold, mono) <= w) { line += t; continue; }
      if (line.trim()) out.push(line.trimEnd());
      line = t.trimStart();
      while (line && tw(line, size, bold, mono) > w) { let i = line.length - 1; while (i > 1 && tw(line.slice(0, i), size, bold, mono) > w) i--; out.push(line.slice(0, i)); line = line.slice(i); }
    }
    out.push(line.trimEnd());
  });
  return out;
}
function numLetras(n, moneda = 'MXN') {
  const U = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE', 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIÚN', 'VEINTIDÓS', 'VEINTITRÉS', 'VEINTICUATRO', 'VEINTICINCO', 'VEINTISÉIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE'];
  const D = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const C = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];
  const cien = x => { if (x === 100) return 'CIEN'; const c = Math.floor(x / 100), r = x % 100; let s = C[c]; if (r) s += (s ? ' ' : '') + (r < 30 ? U[r] : D[Math.floor(r / 10)] + (r % 10 ? ' Y ' + U[r % 10] : '')); return s; };
  const words = x => {
    if (x === 0) return 'CERO'; let s = '';
    const mm = Math.floor(x / 1e6), mil = Math.floor((x % 1e6) / 1000), r = x % 1000;
    if (mm) s += mm === 1 ? 'UN MILLÓN' : words(mm) + ' MILLONES';
    if (mil) s += (s ? ' ' : '') + (mil === 1 ? 'MIL' : cien(mil) + ' MIL');
    if (r) s += (s ? ' ' : '') + cien(r);
    return s;
  };
  const cents = Math.round(Math.abs(n) * 100), ent = Math.floor(cents / 100), cen = cents % 100;
  const cur = {MXN: ['PESO', 'PESOS', 'M.N.'], USD: ['DÓLAR', 'DÓLARES', 'USD'], EUR: ['EURO', 'EUROS', 'EUR'], CAD: ['DÓLAR CANADIENSE', 'DÓLARES CANADIENSES', 'CAD']}[moneda] || ['', '', moneda];
  let w = words(ent); if (ent >= 1e6 && ent % 1e6 === 0) w += ' DE';
  return `${w} ${ent === 1 ? cur[0] : cur[1]} ${String(cen).padStart(2, '0')}/100 ${cur[2]}`.replace(/\s+/g, ' ');
}
const WINANSI = {'€': 128, '‚': 130, 'ƒ': 131, '„': 132, '…': 133, '†': 134, '‡': 135, '‰': 137, 'Š': 138, '‹': 139, 'Œ': 140, 'Ž': 142, '‘': 145, '’': 146, '“': 147, '”': 148, '•': 149, '–': 150, '—': 151, '™': 153, 'š': 154, '›': 155, 'œ': 156, 'ž': 158, 'Ÿ': 159};
function pdfEsc(s) { let o = ''; for (const ch of String(s)) { let c = ch.charCodeAt(0); if (WINANSI[ch]) c = WINANSI[ch]; else if (c > 255) c = 63; const x = String.fromCharCode(c); o += (x === '(' || x === ')' || x === '\\') ? '\\' + x : x; } return o; }
const latin1 = s => { const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 255; return b; };
const b64bytes = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

class PdfPainter {
  constructor() { this.W = 612; this.H = 792; this.pages = []; this.imgs = []; this.alphas = []; }
  page() { this.c = []; this.pages.push(this.c); }
  setPage(i) { this.c = this.pages[i]; }
  rgb(h) { h = String(h || '#000000').replace('#', ''); if (h.length === 3) h = h.split('').map(x => x + x).join(''); const n = parseInt(h, 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => (v / 255).toFixed(3)).join(' '); }
  Y(y) { return (this.H - y).toFixed(2); }
  rect(x, y, w, h, o = {}) { let s = 'q '; if (o.fill) s += this.rgb(o.fill) + ' rg '; if (o.stroke) s += this.rgb(o.stroke) + ' RG ' + (o.lw || 0.5) + ' w '; s += `${x.toFixed(2)} ${(this.H - y - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re ${o.fill && o.stroke ? 'B' : o.fill ? 'f' : 'S'} Q`; this.c.push(s); }
  line(x1, y1, x2, y2, color = '#000000', lw = 0.5) { this.c.push(`q ${this.rgb(color)} RG ${lw} w ${x1.toFixed(2)} ${this.Y(y1)} m ${x2.toFixed(2)} ${this.Y(y2)} l S Q`); }
  text(s, x, y, o = {}) { const size = o.size || 8; s = String(s ?? ''); if (!s) return; const w = tw(s, size, o.bold, o.mono); if (o.align === 'right') x -= w; else if (o.align === 'center') x -= w / 2; this.c.push(`BT /${o.mono ? 'F3' : o.bold ? 'F2' : 'F1'} ${size} Tf ${this.rgb(o.color || '#1a1a1a')} rg ${x.toFixed(2)} ${this.Y(y)} Td (${pdfEsc(s)}) Tj ET`); }
  rtext(s, cx, cy, deg, o = {}) { const size = o.size || 40, w = tw(s, size, o.bold), a = deg * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a); const x0 = cx - (w / 2) * c, y0 = (this.H - cy) - (w / 2) * sn; this.c.push(`BT /${o.bold ? 'F2' : 'F1'} ${size} Tf ${this.rgb(o.color)} rg ${c.toFixed(4)} ${sn.toFixed(4)} ${(-sn).toFixed(4)} ${c.toFixed(4)} ${x0.toFixed(2)} ${y0.toFixed(2)} Tm (${pdfEsc(s)}) Tj ET`); }
  image(im, x, y, w, h, alpha = 1) { if (!im || !im.pdf) return; let i = this.imgs.indexOf(im.pdf); if (i < 0) { this.imgs.push(im.pdf); i = this.imgs.length - 1; } let gs = ''; if (alpha < 1) { const k = Math.max(5, Math.round(alpha * 100)); if (!this.alphas.includes(k)) this.alphas.push(k); gs = `/GA${k} gs `; } this.c.push(`q ${gs}${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${(this.H - y - h).toFixed(2)} cm /Im${i} Do Q`); }
  qr(m, x, y, size) { const n = m.length, cs = size / n; let s = 'q 0 0 0 rg '; for (let r = 0; r < n; r++) { let c = 0; while (c < n) { if (m[r][c]) { let e = c; while (e < n && m[r][e]) e++; s += `${(x + c * cs).toFixed(2)} ${(this.H - y - (r + 1) * cs).toFixed(2)} ${((e - c) * cs + 0.05).toFixed(2)} ${(cs + 0.05).toFixed(2)} re `; c = e; } else c++; } } this.c.push(s + 'f Q'); }
  build() {
    const objs = [null, null]; const add = parts => { objs.push(parts); return objs.length; };
    const f1 = add([latin1('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')]);
    const f2 = add([latin1('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')]);
    const f3 = add([latin1('<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>')]);
    const imgRefs = this.imgs.map(p => {
      let sm = '';
      if (p.alpha) { const r = add([latin1(`<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceGray /BitsPerComponent 8${p.alphaFlate ? ' /Filter /FlateDecode' : ''} /Length ${p.alpha.length} >>\nstream\n`), p.alpha, latin1('\nendstream')]); sm = ` /SMask ${r} 0 R`; }
      return add([latin1(`<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode${sm} /Length ${p.jpg.length} >>\nstream\n`), p.jpg, latin1('\nendstream')]);
    });
    const gsRefs = this.alphas.map(k => add([latin1(`<< /Type /ExtGState /ca ${(k / 100).toFixed(2)} /CA ${(k / 100).toFixed(2)} >>`)]));
    const res = `<< /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R /F3 ${f3} 0 R >>` + (imgRefs.length ? ` /XObject << ${imgRefs.map((r, i) => `/Im${i} ${r} 0 R`).join(' ')} >>` : '') + (gsRefs.length ? ` /ExtGState << ${gsRefs.map((r, i) => `/GA${this.alphas[i]} ${r} 0 R`).join(' ')} >>` : '') + ' >>';
    const kids = this.pages.map(ops => { const body = latin1(ops.join('\n')); const cs = add([latin1(`<< /Length ${body.length} >>\nstream\n`), body, latin1('\nendstream')]); return add([latin1(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.W} ${this.H}] /Resources ${res} /Contents ${cs} 0 R >>`)]); });
    const info = add([latin1(`<< /Producer (Folia CFDI) /Title (${pdfEsc(this.title || 'CFDI')}) >>`)]);
    objs[0] = [latin1('<< /Type /Catalog /Pages 2 0 R >>')];
    objs[1] = [latin1(`<< /Type /Pages /Kids [${kids.map(r => r + ' 0 R').join(' ')}] /Count ${kids.length} >>`)];
    const out = [latin1('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')]; let off = out[0].length; const xref = [];
    objs.forEach((parts, i) => { xref.push(off); const h = latin1(`${i + 1} 0 obj\n`), t = latin1('\nendobj\n'); out.push(h, ...parts, t); off += h.length + parts.reduce((a, p) => a + p.length, 0) + t.length; });
    out.push(latin1(`xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + xref.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${off}\n%%EOF\n`));
    const total = out.reduce((a, p) => a + p.length, 0), bytes = new Uint8Array(total); let k = 0; out.forEach(p => { bytes.set(p, k); k += p.length; });
    return bytes;
  }
}
class CanvasPainter {
  constructor(scale = 1.5) { this.W = 612; this.H = 792; this.s = scale; this.pages = []; }
  page() { const c = document.createElement('canvas'); c.width = this.W * this.s; c.height = this.H * this.s; const x = c.getContext('2d'); x.scale(this.s, this.s); x.fillStyle = '#ffffff'; x.fillRect(0, 0, this.W, this.H); this.pages.push(c); this.x = x; }
  setPage(i) { this.x = this.pages[i].getContext('2d'); }
  font(size, bold, mono) { return `${bold ? 'bold ' : ''}${size}px ${mono ? '"Courier New", Courier, monospace' : 'Arial, Helvetica, "Liberation Sans", sans-serif'}`; }
  rect(x, y, w, h, o = {}) { const c = this.x; if (o.fill) { c.fillStyle = o.fill; c.fillRect(x, y, w, h); } if (o.stroke) { c.strokeStyle = o.stroke; c.lineWidth = o.lw || 0.5; c.strokeRect(x, y, w, h); } }
  line(x1, y1, x2, y2, color = '#000', lw = 0.5) { const c = this.x; c.strokeStyle = color; c.lineWidth = lw; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
  text(s, x, y, o = {}) { const c = this.x, size = o.size || 8; s = String(s ?? ''); if (!s) return; const w = tw(s, size, o.bold, o.mono); if (o.align === 'right') x -= w; else if (o.align === 'center') x -= w / 2; c.font = this.font(size, o.bold, o.mono); c.fillStyle = o.color || '#1a1a1a'; c.textAlign = 'left'; c.fillText(s, x, y); }
  rtext(s, cx, cy, deg, o = {}) { const c = this.x; c.save(); c.translate(cx, cy); c.rotate(-deg * Math.PI / 180); c.font = this.font(o.size || 40, o.bold); c.fillStyle = o.color || '#eee'; c.textAlign = 'center'; c.fillText(s, 0, 0); c.restore(); }
  image(im, x, y, w, h, alpha = 1) { if (!im || !im.el) return; const c = this.x; c.save(); c.globalAlpha = alpha; c.drawImage(im.el, x, y, w, h); c.restore(); }
  qr(m, x, y, size) { const n = m.length, cs = size / n, c = this.x; c.fillStyle = '#000'; for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (m[r][k]) c.fillRect(x + k * cs, y + r * cs, cs + 0.3, cs + 0.3); }
}

/* Imágenes (logo y sello): PNG guardado; para PDF se separa en JPEG + canal alfa */
const IMGC = new Map(), PREPC = new Map();
function loadImg(src) { if (!IMGC.has(src)) IMGC.set(src, new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; })); return IMGC.get(src); }
function prepImg(rec) {
  if (!rec || !rec.png) return Promise.resolve(null);
  if (PREPC.has(rec.png)) return PREPC.get(rec.png);
  const p = (async () => {
    const el = await loadImg(rec.png); if (!el) return null;
    const w = el.naturalWidth, h = el.naturalHeight;
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const x = cv.getContext('2d'); x.drawImage(el, 0, 0);
    const d = x.getImageData(0, 0, w, h).data; const a = new Uint8Array(w * h); let opaque = true;
    for (let i = 0; i < w * h; i++) { a[i] = d[i * 4 + 3]; if (a[i] < 255) opaque = false; }
    const cv2 = document.createElement('canvas'); cv2.width = w; cv2.height = h; const x2 = cv2.getContext('2d'); x2.fillStyle = '#ffffff'; x2.fillRect(0, 0, w, h); x2.drawImage(el, 0, 0);
    const jpg = b64bytes(cv2.toDataURL('image/jpeg', 0.92).split(',')[1]);
    let alpha = null, flate = false;
    if (!opaque) { alpha = a; try { if (window.CompressionStream) { alpha = new Uint8Array(await new Response(new Blob([a]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer()); flate = true; } } catch (e) { alpha = a; flate = false; } }
    return {el, w, h, pdf: {jpg, alpha, alphaFlate: flate, w, h}};
  })();
  PREPC.set(rec.png, p); return p;
}
async function fileToPng(file, max = 360) {
  const url = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
  const el = await loadImg(url); if (!el) throw new Error('No pudimos leer la imagen.');
  let w = el.naturalWidth, h = el.naturalHeight; const sc = Math.min(1, max / Math.max(w, h)); w = Math.max(1, Math.round(w * sc)); h = Math.max(1, Math.round(h * sc));
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').drawImage(el, 0, 0, w, h);
  let png = cv.toDataURL('image/png'); if (png.length > 190000 && max > 200) return fileToPng(file, Math.round(max * 0.7));
  return {png, w, h};
}

/* QR del SAT: se carga la librería qrcode-generator bajo demanda */
let QRLIB = null;
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = () => res(); s.onerror = () => rej(new Error('load')); document.head.appendChild(s); }); }
function qrLib() {
  if (window.qrcode) return Promise.resolve(window.qrcode);
  if (!QRLIB) QRLIB = (async () => { for (const u of ['https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js', 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js']) { try { await loadScript(u); if (window.qrcode) return window.qrcode; } catch (e) {} } return null; })();
  return QRLIB;
}
async function qrMatrix(text) { const q = await qrLib(); if (!q) return null; try { const o = q(0, 'M'); o.addData(text); o.make(); const n = o.getModuleCount(); return Array.from({length: n}, (_, r) => Array.from({length: n}, (_, c) => o.isDark(r, c))); } catch (e) { return null; } }
function qrURL(m) {
  const tt = (m.kind === 'ret' ? num(m.totales.MontoTotOperacion) : m.total).toFixed(6).padStart(17, '0'), fe = String(m.tfd.SelloCFD || m.sello || '').slice(-8);
  return m.kind === 'ret' ? `https://prodretencionverificacion.clouda.sat.gob.mx/?id=${m.tfd.UUID}&re=${m.emisor.rfc}&rr=${m.receptor.rfc || ''}&tt=${tt}&fe=${fe}`
    : `https://verificacfdi.facturaelectronica.sat.gob.mx/default.aspx?id=${m.tfd.UUID}&re=${m.emisor.rfc}&rr=${m.receptor.rfc}&tt=${tt}&fe=${fe}`;
}
function selloDemo(seed, len = 344) { let h = 2166136261; for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'; let s = ''; for (let i = 0; i < len - 2; i++) { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; h = (h + 0x9E3779B9 + i) >>> 0; s += A[h % 64]; } return s + '=='; }

/* Lectura de XML (CFDI 4.0 y Retenciones 2.0) a un modelo para PDF e importación */
const xEl = (root, n) => root ? Array.from(root.getElementsByTagNameNS('*', n)) : [];
const x1 = (root, n) => xEl(root, n)[0] || null;
const kidsX = (el, n) => el ? Array.from(el.children).filter(c => c.localName === n) : [];
function atX(el) { const o = {}; if (el) for (const a of Array.from(el.attributes)) o[a.localName] = a.value; return o; }
function parseXML(str) { const doc = new DOMParser().parseFromString(String(str).replace(/^﻿/, ''), 'application/xml'); if (doc.getElementsByTagName('parsererror').length) throw new Error('El archivo XML está mal formado.'); return doc.documentElement; }
function modelCFDI(xml) {
  const r = parseXML(xml);
  if (r.localName === 'Retenciones') return modelRet(r);
  if (r.localName !== 'Comprobante') throw new Error('El archivo no es un CFDI.');
  const c = atX(r), em = atX(kidsX(r, 'Emisor')[0]), re = atX(kidsX(r, 'Receptor')[0]);
  const imp = t => ({base: num(t.Base), imp: t.Impuesto, factor: t.TipoFactor, tasa: t.TasaOCuota || '', importe: num(t.Importe)});
  const m = {kind: 'cfdi', version: c.Version, serie: c.Serie || '', folio: c.Folio || '', fecha: c.Fecha || '', formaPago: c.FormaPago || '', noCert: c.NoCertificado || '', sello: c.Sello || '', condiciones: c.CondicionesDePago || '',
    subtotal: num(c.SubTotal), descuento: num(c.Descuento), moneda: c.Moneda || 'MXN', tipoCambio: c.TipoCambio || '', total: num(c.Total), tipo: c.TipoDeComprobante, exportacion: c.Exportacion || '', metodoPago: c.MetodoPago || '', lugar: c.LugarExpedicion || '',
    emisor: {rfc: em.Rfc, nombre: em.Nombre, regimen: em.RegimenFiscal}, receptor: {rfc: re.Rfc, nombre: re.Nombre, cp: re.DomicilioFiscalReceptor, regimen: re.RegimenFiscalReceptor, uso: re.UsoCFDI, residencia: re.ResidenciaFiscal || '', numRegId: re.NumRegIdTrib || ''}};
  const ig = kidsX(r, 'InformacionGlobal')[0]; m.global = ig ? atX(ig) : null;
  m.relacionados = kidsX(r, 'CfdiRelacionados').map(g => ({tipo: g.getAttribute('TipoRelacion'), uuids: kidsX(g, 'CfdiRelacionado').map(u => u.getAttribute('UUID'))}));
  m.conceptos = kidsX(kidsX(r, 'Conceptos')[0], 'Concepto').map(ce => { const a = atX(ce), ib = kidsX(ce, 'Impuestos')[0]; return {clave: a.ClaveProdServ, noIdent: a.NoIdentificacion || '', cantidad: a.Cantidad, claveUnidad: a.ClaveUnidad, unidad: a.Unidad || '', desc: a.Descripcion, vu: a.ValorUnitario, importe: num(a.Importe), descuento: num(a.Descuento), objeto: a.ObjetoImp || '', tras: kidsX(kidsX(ib, 'Traslados')[0], 'Traslado').map(e => imp(atX(e))), ret: kidsX(kidsX(ib, 'Retenciones')[0], 'Retencion').map(e => imp(atX(e)))}; });
  const ri = kidsX(r, 'Impuestos')[0];
  m.impuestos = {totTras: num(ri && ri.getAttribute('TotalImpuestosTrasladados')), totRet: num(ri && ri.getAttribute('TotalImpuestosRetenidos')), tras: kidsX(kidsX(ri, 'Traslados')[0], 'Traslado').map(e => imp(atX(e))), ret: kidsX(kidsX(ri, 'Retenciones')[0], 'Retencion').map(e => imp(atX(e)))};
  m.tfd = atX(x1(r, 'TimbreFiscalDigital'));
  const il = x1(r, 'ImpuestosLocales'); m.locales = il ? {tras: xEl(il, 'TrasladosLocales').map(atX), ret: xEl(il, 'RetencionesLocales').map(atX)} : null;
  const cp = x1(r, 'CartaPorte');
  if (cp) m.cp = {...atX(cp), ubic: xEl(cp, 'Ubicacion').map(u => ({...atX(u), dom: atX(kidsX(u, 'Domicilio')[0])})), merc: atX(x1(cp, 'Mercancias')), mercs: xEl(cp, 'Mercancia').map(atX), auto: atX(x1(cp, 'Autotransporte')), veh: atX(x1(cp, 'IdentificacionVehicular')), seg: atX(x1(cp, 'Seguros')), rems: xEl(cp, 'Remolque').map(atX), figs: xEl(cp, 'TiposFigura').map(atX)};
  const pg = x1(r, 'Pagos');
  if (pg) m.pagos = {totales: atX(x1(pg, 'Totales')), pagos: kidsX(pg, 'Pago').map(p => ({...atX(p), doctos: kidsX(p, 'DoctoRelacionado').map(d => ({...atX(d), tras: xEl(d, 'TrasladoDR').map(atX), ret: xEl(d, 'RetencionDR').map(atX)}))}))};
  return m;
}
function modelRet(r) {
  const c = atX(r), em = atX(kidsX(r, 'Emisor')[0]), rec = kidsX(r, 'Receptor')[0], nac = atX(kidsX(rec, 'Nacional')[0]), ext = atX(kidsX(rec, 'Extranjero')[0]), tot = kidsX(r, 'Totales')[0];
  return {kind: 'ret', tipo: 'R', serie: '', folio: c.FolioInt || '', fecha: c.FechaExp || '', cve: c.CveRetenc, descRet: c.DescRetenc || '', lugar: c.LugarExpRetenc, noCert: c.NoCertificado || '', sello: c.Sello || '', moneda: 'MXN',
    emisor: {rfc: em.RfcE, nombre: em.NomDenRazSocE, regimen: em.RegimenFiscalE}, receptor: {nac: atX(rec).NacionalidadR, rfc: nac.RfcR || '', nombre: nac.NomDenRazSocR || ext.NomDenRazSocR || '', curp: nac.CurpR || '', cp: nac.DomicilioFiscalR || ''},
    periodo: atX(kidsX(r, 'Periodo')[0]), totales: atX(tot), imps: kidsX(tot, 'ImpRetenidos').map(atX), tfd: atX(x1(r, 'TimbreFiscalDigital'))};
}

/* Diseño de la representación impresa (estructura fija; el emisor solo cambia colores, logo, tarjeta y sello) */
const PDF_DEF = {primary: '#24365c', secondary: '#eef1f6', stampOpacity: 0.9, card: {}};
const impName = c => ({'001': 'ISR', '002': 'IVA', '003': 'IEPS'})[c] || c;
const m6 = v => { const n = num(v); const s = n.toFixed(6).replace(/0{1,4}$/, ''); return '$' + Number(s.split('.')[0]).toLocaleString('es-MX') + '.' + s.split('.')[1]; };
function docTitle(m) {
  if (m.kind === 'ret') return 'CONSTANCIA DE RETENCIONES';
  const cp = m.cp ? ' · CARTA PORTE' : '';
  return ({I: 'FACTURA' + cp, E: m.relacionados.some(r => r.tipo === '01') ? 'NOTA DE CRÉDITO' : 'CFDI DE EGRESO', T: 'TRASLADO' + cp, P: 'RECIBO ELECTRÓNICO DE PAGO', N: 'RECIBO DE NÓMINA'})[m.tipo] || 'CFDI';
}
function drawDoc(P, m, st0, imgs, qrm) {
  const st = Object.assign({}, PDF_DEF, st0 || {}), card = st.card || {};
  const M = 28, W = 612, R = W - M, CW = W - 2 * M, BOTTOM = 792 - 40;
  const pri = st.primary || PDF_DEF.primary, sec = st.secondary || PDF_DEF.secondary, mut = '#596273', ln = '#c9ced8';
  const tfd = m.tfd || {}, demo = /^DEMO/.test(tfd.RfcProvCertif || '') || m.sello === 'DEMO';
  if (demo) { tfd.SelloCFD = selloDemo(tfd.UUID + 'cfd'); tfd.SelloSAT = selloDemo(tfd.UUID + 'sat'); }
  const title = docTitle(m); let y = 0;
  const newPage = first => {
    P.page(); if (demo) P.rtext('SIN VALIDEZ FISCAL · DEMOSTRACIÓN', W / 2, 430, 35, {size: 30, bold: true, color: '#ededed'});
    y = M;
    if (!first) { P.text(m.emisor.nombre, M, y + 9, {size: 8, bold: true}); P.text(`${title} ${m.serie}${m.folio}`, R, y + 9, {size: 8, bold: true, align: 'right', color: pri}); P.text('Folio fiscal: ' + (tfd.UUID || ''), R, y + 19, {size: 6.5, align: 'right', color: mut}); P.line(M, y + 24, R, y + 24, pri, 1); y += 32; }
  };
  const ensure = h => { if (y + h > BOTTOM) newPage(false); };
  const bar = t => { ensure(44); P.rect(M, y, CW, 13, {fill: pri}); P.text(t, M + 6, y + 9.3, {size: 7.3, bold: true, color: '#ffffff'}); y += 13; };
  const cells = (items, cols = 3) => {
    const cw = CW / cols, rows = []; let row = [], col = 0;
    items.filter(Boolean).forEach(it => { const sp = Math.min(cols, it[2] || 1); if (col + sp > cols) { rows.push(row); row = []; col = 0; } row.push({l: it[0], v: String(it[1] ?? '—') || '—', sp}); col += sp; });
    if (row.length) rows.push(row);
    rows.forEach((ri, idx) => {
      const ls = ri.map(it => wrap(it.v, it.sp * cw - 10, 7.4)); const h = 12 + Math.max(...ls.map(l => l.length)) * 8.8 + 3;
      ensure(h); if (idx % 2 === 1) P.rect(M, y, CW, h, {fill: sec});
      let cx = M; ri.forEach((it, i) => { P.text(it.l.toUpperCase(), cx + 5, y + 8.5, {size: 5.7, bold: true, color: mut}); ls[i].forEach((l, j) => P.text(l, cx + 5, y + 18 + j * 8.8, {size: 7.4})); cx += it.sp * cw; });
      y += h;
    });
    P.line(M, y, R, y, ln); y += 9;
  };
  const table = (cols, rows) => {
    const tot = cols.reduce((a, c) => a + c.w, 0), ws = cols.map(c => c.w / tot * CW);
    const head = () => { const hl = cols.map((c, i) => wrap(c.t, ws[i] - 6, 6, true)); const h = Math.max(...hl.map(l => l.length)) * 7.2 + 6; P.rect(M, y, CW, h, {fill: sec}); let x = M; cols.forEach((c, i) => { hl[i].forEach((l, j) => P.text(l, c.a === 'r' ? x + ws[i] - 3 : x + 3, y + 8 + j * 7.2, {size: 6, bold: true, color: mut, align: c.a === 'r' ? 'right' : 'left'})); x += ws[i]; }); y += h; };
    ensure(34); head();
    rows.forEach(r => {
      const cl = r.c.map((v, i) => wrap(v ?? '', ws[i] - 6, 7, cols[i].b)); const subs = (r.sub || []).flatMap(s => wrap(s, CW - 24, 6.2));
      const base = Math.max(1, ...cl.map(l => l.length)) * 8.4 + 5, h = base + subs.length * 7.4 + (subs.length ? 3 : 0);
      if (y + h > BOTTOM) { newPage(false); head(); }
      let x = M; cl.forEach((ls, i) => { ls.forEach((l, j) => P.text(l, cols[i].a === 'r' ? x + ws[i] - 3 : x + 3, y + 9 + j * 8.4, {size: 7, bold: cols[i].b, align: cols[i].a === 'r' ? 'right' : 'left'})); x += ws[i]; });
      let sy = y + base - 1; subs.forEach(s => { sy += 7.4; P.text(s, M + 14, sy - 1.5, {size: 6.2, color: mut}); });
      y += h; P.line(M, y, R, y, ln, 0.4);
    });
    y += 9;
  };

  /* Encabezado */
  newPage(true);
  const rbW = 216, rbX = R - rbW; let lx = M, ty = y + 2, logoH = 0;
  if (imgs && imgs.logo) { const im = imgs.logo, bw = 112, bh = 64, sc = Math.min(bw / im.w, bh / im.h); P.image(im, M, y + (bh - im.h * sc) / 2, im.w * sc, im.h * sc); lx = M + bw + 12; logoH = bh; }
  const lw = rbX - 14 - lx;
  wrap(m.emisor.nombre, lw, 11, true).forEach(l => { ty += 12.5; P.text(l, lx, ty, {size: 11, bold: true}); });
  [[`RFC: ${m.emisor.rfc}`, true], [`Régimen fiscal: ${m.emisor.regimen} - ${lbl(CAT.regimen, m.emisor.regimen)}`], [`Lugar de expedición: ${m.lugar}`]].forEach(([t, b]) => wrap(t, lw, 7.4, b).forEach(l => { ty += 9.4; P.text(l, lx, ty, {size: 7.4, bold: b}); }));
  const cl = [card.direccion, [card.telefono, card.email].filter(Boolean).join('  ·  '), card.web].filter(Boolean);
  if (cl.length || card.leyenda) { ty += 4; cl.forEach(t => wrap(t, lw, 6.9).forEach(l => { ty += 8.4; P.text(l, lx, ty, {size: 6.9, color: mut}); })); if (card.leyenda) wrap(card.leyenda, lw, 7, true).forEach(l => { ty += 9; P.text(l, lx, ty, {size: 7, bold: true, color: pri}); }); }
  let ry = y; P.rect(rbX, ry, rbW, 17, {fill: pri}); P.text(title, rbX + rbW / 2, ry + 11.8, {size: 8.6, bold: true, color: '#ffffff', align: 'center'}); ry += 17;
  const hdr = m.kind === 'ret'
    ? [['Folio interno', m.folio], ['Folio fiscal', tfd.UUID], ['No. de serie del CSD', m.noCert], ['Fecha de expedición', (m.fecha || '').replace('T', ' ')], ['Fecha de certificación', (tfd.FechaTimbrado || '').replace('T', ' ')], ['Clave de retención', `${m.cve} - ${lbl(CAT.cveRetenc, m.cve)}`]]
    : [['Serie y folio', `${m.serie}${m.folio}` || '—'], ['Folio fiscal', tfd.UUID], ['No. de serie del CSD', m.noCert], ['Fecha de emisión', m.fecha.replace('T', ' ')], ['Fecha de certificación', (tfd.FechaTimbrado || '').replace('T', ' ')], ['Efecto del comprobante', `${m.tipo} - ${lbl(CAT.tipo, m.tipo)}`], ['Exportación', m.exportacion ? `${m.exportacion} - ${lbl(CAT.exportacion, m.exportacion)}` : '']];
  const ry0 = ry;
  hdr.forEach(([k, v], i) => { const vl = wrap(v || '—', rbW - 96, 7); const h = vl.length * 8.4 + 4.5; if (i % 2 === 0) P.rect(rbX, ry, rbW, h, {fill: sec}); P.text(k, rbX + 5, ry + 8.8, {size: 6.2, bold: true, color: mut}); vl.forEach((l, j) => P.text(l, rbX + 91, ry + 8.8 + j * 8.4, {size: 7})); ry += h; });
  P.rect(rbX, ry0 - 17, rbW, ry - ry0 + 17, {stroke: ln});
  y = Math.max(ty + 4, y + logoH, ry) + 12;

  if (m.kind === 'ret') {
    bar('RECEPTOR');
    cells([['Nombre o razón social', m.receptor.nombre, 2], ['RFC', m.receptor.rfc], ['Nacionalidad', m.receptor.nac], ['CURP', m.receptor.curp || '—'], ['Domicilio fiscal (CP)', m.receptor.cp || '—']]);
    bar('PERIODO Y MONTOS');
    const tt = m.totales;
    cells([['Mes inicial', lbl(CAT.meses, m.periodo.MesIni)], ['Mes final', lbl(CAT.meses, m.periodo.MesFin)], ['Ejercicio', m.periodo.Ejercicio], ['Monto total de la operación', money(num(tt.MontoTotOperacion))], ['Monto gravado', money(num(tt.MontoTotGrav))], ['Monto exento', money(num(tt.MontoTotExent))]]);
    bar('IMPUESTOS RETENIDOS');
    table([{t: 'Impuesto', w: 60}, {t: 'Base de la retención', w: 90, a: 'r'}, {t: 'Monto retenido', w: 90, a: 'r'}, {t: 'Tipo de pago', w: 160}], m.imps.map(i => ({c: [`${i.ImpuestoRet} - ${impName(i.ImpuestoRet)}`, money(num(i.BaseRet)), money(num(i.MontoRet)), `${i.TipoPagoRet} - ${lbl(CAT.tipoPagoRet, i.TipoPagoRet)}`]})));
    ensure(40); const tx = M + CW * 0.58;
    P.text('TOTAL RETENIDO CON LETRA', M, y + 8, {size: 5.7, bold: true, color: mut}); wrap(numLetras(num(tt.MontoTotRet)), tx - M - 14, 7.4, true).forEach((l, j) => P.text(l, M, y + 18 + j * 9, {size: 7.4, bold: true}));
    P.rect(tx, y, R - tx, 18, {fill: pri}); P.text('TOTAL RETENIDO', tx + 6, y + 12.5, {size: 8.5, bold: true, color: '#ffffff'}); P.text(money(num(tt.MontoTotRet)), R - 6, y + 12.5, {size: 8.5, bold: true, color: '#ffffff', align: 'right'});
    y += 34;
  } else {
    bar('RECEPTOR');
    const R2 = m.receptor;
    cells([['Nombre o razón social', R2.nombre, 2], ['RFC', R2.rfc], ['Domicilio fiscal (CP)', R2.cp], ['Régimen fiscal', `${R2.regimen} - ${lbl(CAT.regimen, R2.regimen)}`, 2], ['Uso del CFDI', `${R2.uso} - ${lbl(CAT.uso, R2.uso)}`, 2], R2.residencia ? ['Residencia fiscal', R2.residencia] : null, R2.numRegId ? ['Núm. registro tributario', R2.numRegId] : null]);
    if (m.tipo === 'I' || m.tipo === 'E') {
      bar('DATOS DEL COMPROBANTE');
      cells([['Moneda', `${m.moneda} - ${lbl(CAT.moneda, m.moneda)}`], m.tipoCambio ? ['Tipo de cambio', m.tipoCambio] : null, ['Forma de pago', `${m.formaPago} - ${lbl(CAT.formaPago, m.formaPago)}`], ['Método de pago', `${m.metodoPago} - ${lbl(CAT.metodoPago, m.metodoPago)}`], ['Condiciones de pago', m.condiciones || '—']], 4);
    }
    if (m.global) { bar('INFORMACIÓN GLOBAL'); cells([['Periodicidad', `${m.global.Periodicidad} - ${lbl(CAT.periodicidad, m.global.Periodicidad)}`], ['Meses', `${m.global.Meses} - ${lbl(CAT.meses, m.global.Meses)}`], ['Año', m.global['Año'] || m.global.Ano || '']]); }
    m.relacionados.forEach(g => { bar('CFDI RELACIONADOS'); cells([['Tipo de relación', `${g.tipo} - ${lbl(CAT.tipoRelacion, g.tipo)}`, 3], ['Folios fiscales relacionados', g.uuids.join('\n'), 3]]); });
    bar('CONCEPTOS');
    const tl = t => `${impName(t.imp)} · ${t.factor}${t.factor === 'Exento' ? '' : ' ' + t.tasa} · Base ${t.factor === 'Cuota' ? num(t.base) : money(t.base)}${t.factor === 'Exento' ? '' : ' · Importe ' + money(t.importe)}`;
    table([{t: 'Clave prod./serv.', w: 52}, {t: 'Cantidad', w: 38, a: 'r'}, {t: 'Clave unidad', w: 34}, {t: 'Unidad', w: 46}, {t: 'Descripción', w: 150}, {t: 'Valor unitario', w: 60, a: 'r'}, {t: 'Importe', w: 58, a: 'r'}, {t: 'Descuento', w: 44, a: 'r'}, {t: 'Objeto imp.', w: 36}],
      m.conceptos.map(c => ({c: [c.clave, c.cantidad, c.claveUnidad, c.unidad, c.desc + (c.noIdent ? `\nNo. identificación: ${c.noIdent}` : ''), m6(c.vu), money(c.importe), c.descuento ? money(c.descuento) : '', c.objeto],
        sub: [...c.tras.map(t => 'Traslado · ' + tl(t)), ...c.ret.map(t => 'Retención · ' + tl(t))]})));
    if (m.tipo === 'I' || m.tipo === 'E') {
      const lines = [['Subtotal', m.subtotal]]; if (m.descuento) lines.push(['Descuento', -m.descuento]);
      m.impuestos.tras.forEach(t => lines.push([`${impName(t.imp)} trasladado ${t.factor === 'Exento' ? 'exento' : t.factor === 'Cuota' ? '(cuota ' + num(t.tasa) + ')' : r2(num(t.tasa) * 100) + '%'}`, t.importe]));
      m.impuestos.ret.forEach(t => lines.push([`${impName(t.imp)} retenido`, -t.importe]));
      if (m.locales) { m.locales.tras.forEach(t => lines.push([`Imp. local trasladado: ${t.ImpLocTrasladado} ${t.TasadeTraslado}%`, num(t.Importe)])); m.locales.ret.forEach(t => lines.push([`Imp. local retenido: ${t.ImpLocRetenido} ${t.TasadeRetencion}%`, -num(t.Importe)])); }
      const tx = M + CW * 0.56, hTot = lines.length * 11.5 + 26, stampH = imgs && imgs.stamp ? 104 : 0;
      ensure(Math.max(hTot, 40 + stampH));
      let ly = y; P.text('IMPORTE CON LETRA', M, ly + 8, {size: 5.7, bold: true, color: mut});
      wrap(numLetras(m.total, m.moneda), tx - M - 16, 7.4, true).forEach(l => { ly += 9; P.text(l, M, ly + 9, {size: 7.4, bold: true}); }); ly += 16;
      if (stampH) { const im = imgs.stamp, sc = Math.min(96 / im.w, 96 / im.h); P.image(im, M, ly, im.w * sc, im.h * sc, st.stampOpacity ?? 0.9); ly += im.h * sc + 6; }
      let ry2 = y;
      lines.forEach(([k, v]) => { P.text(k, tx + 6, ry2 + 8.5, {size: 7.3, color: mut}); P.text((v < 0 ? '-' : '') + money(Math.abs(v), m.moneda), R - 6, ry2 + 8.5, {size: 7.3, align: 'right'}); ry2 += 11.5; P.line(tx, ry2, R, ry2, ln, 0.4); });
      P.rect(tx, ry2 + 3, R - tx, 19, {fill: pri}); P.text('TOTAL', tx + 6, ry2 + 15.8, {size: 9, bold: true, color: '#ffffff'}); P.text(`${money(m.total, m.moneda)} ${m.moneda}`, R - 6, ry2 + 15.8, {size: 9, bold: true, color: '#ffffff', align: 'right'}); ry2 += 24;
      y = Math.max(ly, ry2) + 10;
    }
    if (m.pagos) {
      bar('COMPLEMENTO PARA RECEPCIÓN DE PAGOS 2.0');
      m.pagos.pagos.forEach(p => {
        cells([['Fecha de pago', (p.FechaPago || '').replace('T', ' ')], ['Forma de pago', `${p.FormaDePagoP} - ${lbl(CAT.formaPago, p.FormaDePagoP)}`], ['Moneda', p.MonedaP + (p.MonedaP !== 'MXN' ? ' · TC ' + p.TipoCambioP : '')], ['Monto', money(num(p.Monto), p.MonedaP)], ['Número de operación', p.NumOperacion || '—', 2]]);
        const tdr = (t, k) => `${k} ${impName(t.ImpuestoDR)} · ${t.TipoFactorDR}${t.TasaOCuotaDR ? ' ' + t.TasaOCuotaDR : ''} · Base ${money(num(t.BaseDR))}${t.ImporteDR ? ' · Importe ' + money(num(t.ImporteDR)) : ''}`;
        table([{t: 'Folio fiscal del documento relacionado', w: 150}, {t: 'Serie y folio', w: 48}, {t: 'Parcialidad', w: 42, a: 'r'}, {t: 'Saldo anterior', w: 62, a: 'r'}, {t: 'Importe pagado', w: 62, a: 'r'}, {t: 'Saldo insoluto', w: 62, a: 'r'}, {t: 'Objeto imp.', w: 36}],
          p.doctos.map(d => ({c: [d.IdDocumento, (d.Serie || '') + (d.Folio || ''), d.NumParcialidad, money(num(d.ImpSaldoAnt)), money(num(d.ImpPagado)), money(num(d.ImpSaldoInsoluto)), d.ObjetoImpDR], sub: [...d.tras.map(t => tdr(t, 'Traslado')), ...d.ret.map(t => tdr(t, 'Retención'))]})));
      });
      const TL = {TotalRetencionesIVA: 'Retenciones IVA', TotalRetencionesISR: 'Retenciones ISR', TotalRetencionesIEPS: 'Retenciones IEPS', TotalTrasladosBaseIVA16: 'Base IVA 16%', TotalTrasladosImpuestoIVA16: 'IVA 16%', TotalTrasladosBaseIVA8: 'Base IVA 8%', TotalTrasladosImpuestoIVA8: 'IVA 8%', TotalTrasladosBaseIVA0: 'Base IVA 0%', TotalTrasladosImpuestoIVA0: 'IVA 0%', TotalTrasladosBaseIVAExento: 'Base IVA exento', MontoTotalPagos: 'Monto total de pagos'};
      cells(Object.entries(m.pagos.totales).map(([k, v]) => [TL[k] || k, money(num(v))]), 4);
    }
    if (m.cp) {
      const cp = m.cp;
      bar('COMPLEMENTO CARTA PORTE 3.1');
      cells([['IdCCP', cp.IdCCP, 2], ['Transporte internacional', cp.TranspInternac], ['Distancia total recorrida', f2(num(cp.TotalDistRec)) + ' km'], ['Peso bruto total', `${cp.merc.PesoBrutoTotal || ''} ${cp.merc.UnidadPeso || ''}`], ['Número total de mercancías', cp.merc.NumTotalMercancias]]);
      table([{t: 'Tipo', w: 40}, {t: 'ID', w: 44}, {t: 'RFC', w: 66}, {t: 'Nombre', w: 100}, {t: 'Fecha y hora', w: 70}, {t: 'Domicilio', w: 120}, {t: 'Distancia (km)', w: 46, a: 'r'}],
        cp.ubic.map(u => ({c: [u.TipoUbicacion, u.IDUbicacion, u.RFCRemitenteDestinatario, u.NombreRemitenteDestinatario || '', (u.FechaHoraSalidaLlegada || '').replace('T', ' '), [u.dom.Calle, u.dom.Colonia ? 'Col. ' + u.dom.Colonia : '', u.dom.Localidad ? 'Loc. ' + u.dom.Localidad : '', u.dom.Municipio ? 'Mun. ' + u.dom.Municipio : '', lbl(CAT.estados, u.dom.Estado) || u.dom.Estado, 'CP ' + u.dom.CodigoPostal].filter(Boolean).join(', '), u.DistanciaRecorrida ? f2(num(u.DistanciaRecorrida)) : '']})));
      table([{t: 'Bienes transp.', w: 52}, {t: 'Descripción', w: 150}, {t: 'Cantidad', w: 44, a: 'r'}, {t: 'Clave unidad', w: 40}, {t: 'Peso (kg)', w: 50, a: 'r'}, {t: 'Material peligroso', w: 64}, {t: 'Valor', w: 60, a: 'r'}],
        cp.mercs.map(x => ({c: [x.BienesTransp, x.Descripcion, x.Cantidad, x.ClaveUnidad, x.PesoEnKg, x.MaterialPeligroso ? x.MaterialPeligroso + (x.CveMaterialPeligroso ? ` (${x.CveMaterialPeligroso}, ${x.Embalaje || ''})` : '') : 'No', x.ValorMercancia ? money(num(x.ValorMercancia)) : '']})));
      cells([['Permiso SCT', `${cp.auto.PermSCT} - ${lbl(CAT.permSCT, cp.auto.PermSCT)}`, 2], ['Número de permiso', cp.auto.NumPermisoSCT], ['Configuración vehicular', `${cp.veh.ConfigVehicular} - ${lbl(CAT.configVeh, cp.veh.ConfigVehicular)}`, 2], ['Peso bruto vehicular', (cp.veh.PesoBrutoVehicular || '') + ' t'], ['Placa', cp.veh.PlacaVM], ['Año modelo', cp.veh.AnioModeloVM], ['Aseguradora RC / póliza', `${cp.seg.AseguraRespCivil || ''} · ${cp.seg.PolizaRespCivil || ''}`], cp.rems.length ? ['Remolques', cp.rems.map(r => `${r.SubTipoRem} - ${lbl(CAT.subTipoRem, r.SubTipoRem)} · ${r.Placa}`).join('\n'), 3] : null]);
      table([{t: 'Tipo de figura', w: 70}, {t: 'RFC', w: 80}, {t: 'Nombre', w: 160}, {t: 'Número de licencia', w: 90}], cp.figs.map(f => ({c: [`${f.TipoFigura} - ${lbl(CAT.tipoFigura, f.TipoFigura)}`, f.RFCFigura, f.NombreFigura || '', f.NumLicencia || '']})));
    }
    if (!(m.tipo === 'I' || m.tipo === 'E') && imgs && imgs.stamp) { ensure(104); const im = imgs.stamp, sc = Math.min(96 / im.w, 96 / im.h); P.image(im, M, y, im.w * sc, im.h * sc, st.stampOpacity ?? 0.9); y += im.h * sc + 8; }
  }

  /* Pie con QR y sellos */
  const qs = 92, fx = M + qs + 12, fw = R - fx;
  const sCFD = tfd.SelloCFD || m.sello || '', cad = `||1.1|${tfd.UUID || ''}|${tfd.FechaTimbrado || ''}|${tfd.RfcProvCertif || ''}|${sCFD}|${tfd.NoCertificadoSAT || ''}||`;
  const bl = [['Sello digital del CFDI', sCFD], ['Sello digital del SAT', tfd.SelloSAT || ''], ['Cadena original del complemento de certificación digital del SAT', cad]].map(([t, v]) => [t, wrap(v, fw, 5.5, false, true)]);
  const fh = Math.max(qs, bl.reduce((a, [, l]) => a + 11 + l.length * 6.5, 0)) + 30;
  ensure(fh); P.line(M, y, R, y, pri, 1); y += 8;
  if (qrm) P.qr(qrm, M, y, qs); else { P.rect(M, y, qs, qs, {stroke: ln}); P.text('Verifica en el portal', M + qs / 2, y + 42, {size: 6.3, align: 'center', color: mut}); P.text('del SAT con el folio fiscal', M + qs / 2, y + 51, {size: 6.3, align: 'center', color: mut}); }
  let fy = y; bl.forEach(([t, ls]) => { P.text(t + ':', fx, fy + 7, {size: 6.2, bold: true, color: mut}); fy += 9.5; ls.forEach(l => { P.text(l, fx, fy + 5.3, {size: 5.5, mono: true}); fy += 6.5; }); fy += 2; });
  y = Math.max(y + qs, fy) + 6;
  wrap(`RFC del proveedor de certificación: ${tfd.RfcProvCertif || ''}     No. de serie del certificado del SAT: ${tfd.NoCertificadoSAT || ''}     Fecha y hora de certificación: ${(tfd.FechaTimbrado || '').replace('T', ' ')}`, CW, 6.4).forEach(l => { P.text(l, M, y + 6, {size: 6.4, color: mut}); y += 8; });
  const n = P.pages.length;
  for (let i = 0; i < n; i++) { P.setPage(i); P.line(M, 792 - 30, R, 792 - 30, ln, 0.5); P.text(`Este documento es una representación impresa de un CFDI ${m.kind === 'ret' ? 'de retenciones e información de pagos 2.0' : 'versión 4.0'}`, M, 792 - 20, {size: 6.4, color: mut}); P.text(`Página ${i + 1} de ${n}`, R, 792 - 20, {size: 6.4, color: mut, align: 'right'}); }
  P.title = `${title} ${m.serie}${m.folio}`;
  return P;
}
async function pdfAssets(emisorId, override) {
  const em = S.emisores.find(e => e.id === emisorId) || EM() || {};
  const st = override ? override.st : (em.pdf || {}), src = override ? override.imgs : (S.pdfimg[em.id] || {});
  return {st, imgs: {logo: await prepImg(src.logo), stamp: await prepImg(src.stamp)}};
}
async function renderRec(rec, P, override) {
  const m = modelCFDI(rec.xml); const a = await pdfAssets(rec.emisorId, override);
  const qrm = m.tfd && m.tfd.UUID ? await qrMatrix(qrURL(m)) : null;
  return drawDoc(P, m, a.st, a.imgs, qrm);
}
async function pdfBytes(rec) { return (await renderRec(rec, new PdfPainter())).build(); }
const pdfName = rec => `${(S.emisores.find(e => e.id === rec.emisorId) || EM()).rfc}_${rec.serie || ''}${rec.folio || ''}_${rec.uuid.slice(0, 8)}`;
async function verPDF(id) {
  const c = S.cfdis.find(x => x.id === id); if (!c) return;
  openModal(`<header class="mh"><div><p class="eyebrow">Representación impresa</p><h3>${esc(tipoNombre(c))} ${esc(c.serie)}${esc(c.folio)}</h3></div><button class="x" data-a="close" aria-label="Cerrar">×</button></header><div class="pdfpages" id="pdfpages"><p class="muted">Generando vista previa…</p></div>
  <footer class="mf"><button class="btn ghost" data-a="ver" data-id="${c.id}">Volver al detalle</button><button class="btn" data-a="dlPDF" data-id="${c.id}">Descargar PDF</button></footer>`, true);
  const tok = S._pdfTok = Symbol('pdf');
  try { const P = await renderRec(c, new CanvasPainter(1.6)); const box = $('#pdfpages'); if (!box || S._pdfTok !== tok) return; box.innerHTML = ''; P.pages.forEach(cv => { cv.className = 'pdfpage'; box.appendChild(cv); }); }
  catch (e) { const box = $('#pdfpages'); if (box) box.innerHTML = `<p class="ferr">No se pudo generar la vista previa: ${esc(e.message)}</p>`; }
}
