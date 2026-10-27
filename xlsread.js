/* ============ LECTOR DE EXCEL 97-2003 (.xls BIFF8) — sin librerías externas ============
   Los catálogos del SAT se publican en .xls. Este lector abre el contenedor OLE2 (CFB),
   ubica el flujo "Workbook" y extrae solo la hoja pedida (texto y números). */
function cfbWorkbook(buf) {
  const dv = new DataView(buf), u8 = new Uint8Array(buf);
  if (dv.getUint32(0, true) !== 0xE011CFD0 || dv.getUint32(4, true) !== 0xE11AB1A1) throw new Error('El archivo no es un Excel 97-2003 (.xls) válido.');
  const ss = 1 << dv.getUint16(30, true), mss = 1 << dv.getUint16(32, true), nFat = dv.getUint32(44, true), dir0 = dv.getUint32(48, true), cutoff = dv.getUint32(56, true), mf0 = dv.getUint32(60, true), dif0 = dv.getUint32(68, true);
  const off = s => 512 + s * ss;
  const fatSecs = []; for (let i = 0; i < 109 && fatSecs.length < nFat; i++) { const s = dv.getInt32(76 + i * 4, true); if (s >= 0) fatSecs.push(s); }
  for (let d = dif0, guard = 0; d >= 0 && d < 0xFFFFFFFA && fatSecs.length < nFat && guard++ < 1e5;) { const o = off(d); for (let i = 0; i < ss / 4 - 1 && fatSecs.length < nFat; i++) { const s = dv.getInt32(o + i * 4, true); if (s >= 0) fatSecs.push(s); } d = dv.getUint32(o + ss - 4, true); }
  const fat = new Int32Array(fatSecs.length * ss / 4); fatSecs.forEach((s, i) => fat.set(new Int32Array(buf.slice(off(s), off(s) + ss)), i * ss / 4));
  const chain = s => { const out = []; for (let g = 0; s >= 0 && g < fat.length + 1; g++) { out.push(s); s = fat[s]; } return out; };
  const readChain = (s, size) => { const secs = chain(s), out = new Uint8Array(size ?? secs.length * ss); let p = 0; for (const x of secs) { if (p >= out.length) break; const n = Math.min(ss, out.length - p); out.set(u8.subarray(off(x), off(x) + n), p); p += n; } return out; };
  const dir = readChain(dir0), ddv = new DataView(dir.buffer), ents = [];
  for (let o = 0; o + 128 <= dir.length; o += 128) { const nl = ddv.getUint16(o + 64, true); if (!nl) continue; let name = ''; for (let i = 0; i < nl / 2 - 1; i++) name += String.fromCharCode(ddv.getUint16(o + i * 2, true)); ents.push({name, type: dir[o + 66], start: ddv.getInt32(o + 116, true), size: ddv.getUint32(o + 120, true)}); }
  const e = ents.find(x => x.name === 'Workbook') || ents.find(x => x.name === 'Book');
  if (!e) throw new Error('El archivo .xls no contiene un libro de Excel.');
  if (e.size >= cutoff) return readChain(e.start, e.size);
  const root = ents.find(x => x.type === 5), mini = readChain(root.start, root.size), mfat = new Int32Array(readChain(mf0).buffer), out = new Uint8Array(e.size);
  for (let s = e.start, p = 0; s >= 0 && p < e.size; s = mfat[s]) { const n = Math.min(mss, e.size - p); out.set(mini.subarray(s * mss, s * mss + n), p); p += n; }
  return out;
}
function biffBook(wb) {
  const dv = new DataView(wb.buffer, wb.byteOffset, wb.byteLength), sheets = [];
  let sst = null, p = 0;
  const latin = new TextDecoder('latin1'), utf16 = new TextDecoder('utf-16le');
  while (p + 4 <= wb.length) {
    const t = dv.getUint16(p, true), n = dv.getUint16(p + 2, true), d = p + 4;
    if (t === 0x0085) { const cch = wb[d + 6], hi = wb[d + 7] & 1; sheets.push({name: hi ? utf16.decode(wb.subarray(d + 8, d + 8 + cch * 2)) : latin.decode(wb.subarray(d + 8, d + 8 + cch)), pos: dv.getUint32(d, true), hidden: wb[d + 4] & 3}); }
    else if (t === 0x00FC) {
      // SST + CONTINUE: segmentos para respetar los cortes de caracteres
      const segs = [[d, d + n]]; let q = d + n;
      while (q + 4 <= wb.length && dv.getUint16(q, true) === 0x003C) { const m = dv.getUint16(q + 2, true); segs.push([q + 4, q + 4 + m]); q += 4 + m; }
      sst = biffSST(wb, dv, segs, latin, utf16); p = q; continue;
    } else if (t === 0x000A) break;
    p = d + n;
  }
  return {sheets, sst: sst || [], wb, dv};
}
function biffSST(wb, dv, segs, latin, utf16) {
  let si = 0, p = segs[0][0]; const end = () => segs[si][1];
  const next = () => { si++; if (si >= segs.length) throw new Error('SST incompleto'); p = segs[si][0]; };
  const need = k => { if (p + k > end()) next(); };
  const u8 = () => { need(1); return wb[p++]; }, u16 = () => { need(2); const v = dv.getUint16(p, true); p += 2; return v; }, u32 = () => { need(4); const v = dv.getUint32(p, true); p += 4; return v; };
  const skip = k => { while (k > 0) { if (p >= end()) next(); const m = Math.min(k, end() - p); p += m; k -= m; } };
  u32(); const nUnique = u32(), out = new Array(nUnique);
  for (let i = 0; i < nUnique; i++) {
    let cch = u16(); const fl = u8(); let hi = fl & 1; const rich = fl & 8 ? u16() : 0, ext = fl & 4 ? u32() : 0;
    let s = '';
    while (cch > 0) {
      if (p >= end()) { next(); hi = wb[p++] & 1; }
      const avail = hi ? (end() - p) >> 1 : end() - p, k = Math.min(cch, avail);
      s += hi ? utf16.decode(wb.subarray(p, p + k * 2)) : latin.decode(wb.subarray(p, p + k));
      p += hi ? k * 2 : k; cch -= k;
    }
    skip(rich * 4 + ext); out[i] = s;
  }
  return out;
}
const rkNum = (dv, o) => { const rk = dv.getInt32(o, true); let v; if (rk & 2) v = rk >> 2; else { const b = new DataView(new ArrayBuffer(8)); b.setInt32(4, rk & 0xFFFFFFFC, true); b.setInt32(0, 0, true); v = b.getFloat64(0, true); } return rk & 1 ? v / 100 : v; };
/* Filas de una hoja: matriz de celdas (texto o número) */
function biffRows(book, sheet) {
  const {wb, dv, sst} = book, rows = [], latin = new TextDecoder('latin1'), utf16 = new TextDecoder('utf-16le');
  const set = (r, c, v) => { (rows[r] || (rows[r] = []))[c] = v; };
  let p = sheet.pos;
  while (p + 4 <= wb.length) {
    const t = dv.getUint16(p, true), n = dv.getUint16(p + 2, true), d = p + 4;
    if (t === 0x00FD) set(dv.getUint16(d, true), dv.getUint16(d + 2, true), sst[dv.getUint32(d + 6, true)] ?? '');
    else if (t === 0x0203) set(dv.getUint16(d, true), dv.getUint16(d + 2, true), dv.getFloat64(d + 6, true));
    else if (t === 0x027E) set(dv.getUint16(d, true), dv.getUint16(d + 2, true), rkNum(dv, d + 6));
    else if (t === 0x00BD) { const r = dv.getUint16(d, true), c0 = dv.getUint16(d + 2, true), k = (n - 6) / 6; for (let i = 0; i < k; i++) set(r, c0 + i, rkNum(dv, d + 4 + i * 6 + 2)); }
    else if (t === 0x0204) { const cch = dv.getUint16(d + 6, true), hi = wb[d + 8] & 1; set(dv.getUint16(d, true), dv.getUint16(d + 2, true), hi ? utf16.decode(wb.subarray(d + 9, d + 9 + cch * 2)) : latin.decode(wb.subarray(d + 9, d + 9 + cch))); }
    else if (t === 0x000A) break;
    p = d + n;
  }
  return rows;
}
/* Lee cualquier archivo de catálogo (.xls, .xlsx, .csv/.txt) → [{name, rows}] (solo hojas cuyo nombre pase el filtro) */
async function leerLibroCatalogo(file, filtro = () => true) {
  const nm = (file.name || '').toLowerCase(), buf = await file.arrayBuffer(), head = new Uint8Array(buf, 0, Math.min(8, buf.byteLength));
  if (head[0] === 0xD0 && head[1] === 0xCF) {
    const book = biffBook(cfbWorkbook(buf));
    return book.sheets.map(s => ({name: s.name, s})).filter(x => filtro(x.name)).map(x => ({name: x.name, rows: biffRows(book, x.s)}));
  }
  if (head[0] === 0x50 && head[1] === 0x4B) return (await readXlsx(buf)).filter(s => filtro(s.name));
  const txt = new TextDecoder(/\.csv$|\.txt$/.test(nm) && !new TextDecoder('utf-8', {fatal: false}).decode(buf).includes('\uFFFD') ? 'utf-8' : 'latin1').decode(buf);
  return [{name: file.name, rows: csvRows(txt)}];
}
function csvRows(txt) {
  const sep = [',', ';', '\t', '|'].map(s => [s, (txt.split('\n', 20).join('\n').match(new RegExp('\\' + s, 'g')) || []).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i];
    if (q) { if (ch === '"') { if (txt[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
    else if (ch === '"') q = true; else if (ch === sep) { row.push(f); f = ''; } else if (ch === '\n') { row.push(f.replace(/\r$/, '')); rows.push(row); row = []; f = ''; } else f += ch;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}
