/* ============ EXCEL (.xlsx) Y CSV: lectura y escritura sin librerías ============ */
const colName = i => { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
const colIdx = s => s.toUpperCase().split('').reduce((a, c) => a * 26 + c.charCodeAt(0) - 64, 0) - 1;
const xe = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
const XH = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main', NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
function makeXlsx(sheets) {
  const files = [];
  files.push({name: '[Content_Types].xml', data: XH + `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`});
  files.push({name: '_rels/.rels', data: XH + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${NS_REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`});
  files.push({name: 'xl/workbook.xml', data: XH + `<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><sheets>${sheets.map((s, i) => `<sheet name="${xe(s.name.slice(0, 31))}" sheetId="${i + 1}"${s.hidden ? ' state="hidden"' : ''} r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`});
  files.push({name: 'xl/_rels/workbook.xml.rels', data: XH + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="${NS_REL}/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="${NS_REL}/styles" Target="styles.xml"/></Relationships>`});
  files.push({name: 'xl/styles.xml', data: XH + `<styleSheet xmlns="${NS_MAIN}"><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF24365C"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`});
  sheets.forEach((s, i) => {
    const ncol = Math.max(1, ...s.rows.map(r => r.length));
    const widths = s.widths || Array.from({length: ncol}, (_, c) => Math.min(60, Math.max(10, ...s.rows.map(r => String(r[c] ?? '').length + 2))));
    const rowsX = s.rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => {
      if (v === '' || v == null) return '';
      const ref = colName(ci) + (ri + 1), tc = (s.textCols || []).includes(ci), st = ri === 0 && s.header !== false ? ' s="1"' : (s.boldCol0 && ci === 0 ? ' s="2"' : tc ? ' s="3"' : '');
      if (tc && ri > 0) v = String(v);
      return typeof v === 'number' && isFinite(v) ? `<c r="${ref}"${st}><v>${v}</v></c>` : `<c r="${ref}" t="inlineStr"${st}><is><t xml:space="preserve">${xe(v)}</t></is></c>`;
    }).join('')}</row>`).join('');
    files.push({name: `xl/worksheets/sheet${i + 1}.xml`, data: XH + `<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><sheetViews><sheetView workbookViewId="0">${s.header !== false ? '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>' : ''}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${widths.map((w, c) => `<col min="${c + 1}" max="${c + 1}" width="${w}" customWidth="1"${(s.textCols || []).includes(c) ? ' style="3"' : ''}/>`).join('')}</cols><sheetData>${rowsX}</sheetData>${(s.validations || []).length ? `<dataValidations count="${s.validations.length}">${s.validations.map(v => `<dataValidation type="${v.type}"${v.op ? ` operator="${v.op}"` : ''} allowBlank="1" showInputMessage="1" showErrorMessage="1" errorStyle="${v.strict === false ? 'warning' : 'stop'}" errorTitle="${xe((v.title || '').slice(0, 32))}" error="${xe((v.msg || '').slice(0, 255))}" promptTitle="${xe((v.title || '').slice(0, 32))}" prompt="${xe((v.msg || '').slice(0, 255))}" sqref="${v.sq}"><formula1>${xe(v.f1)}</formula1>${v.f2 !== undefined ? `<formula2>${xe(v.f2)}</formula2>` : ''}</dataValidation>`).join('')}</dataValidations>` : ''}</worksheet>`});
  });
  return makeZip(files);
}
async function unzip(buf) {
  const u8 = new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), dec = new TextDecoder();
  let e = -1; for (let i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('El archivo no es un Excel .xlsx válido. Si es .xls, guárdalo como .xlsx o CSV.');
  const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true); const files = {};
  for (let k = 0; k < n; k++) { if (dv.getUint32(p, true) !== 0x02014b50) break; const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true); files[dec.decode(u8.subarray(p + 46, p + 46 + nl))] = {method: dv.getUint16(p + 10, true), csize: dv.getUint32(p + 20, true), lo: dv.getUint32(p + 42, true)}; p += 46 + nl + xl + cl; }
  const read = async name => {
    const f = files[name]; if (!f) return null;
    const nl = dv.getUint16(f.lo + 26, true), xl = dv.getUint16(f.lo + 28, true), s = f.lo + 30 + nl + xl, data = u8.subarray(s, s + f.csize);
    if (f.method === 0) return dec.decode(data);
    if (f.method === 8) { if (!window.DecompressionStream) throw new Error('Tu navegador no puede abrir .xlsx. Guarda el archivo como CSV.'); return dec.decode(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()); }
    throw new Error('El Excel usa una compresión no soportada. Guárdalo como CSV.');
  };
  return {names: Object.keys(files), read};
}
function serialToDate(n) { const d = new Date(Math.round((n - 25569) * 864e5)); const s = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; return (d.getUTCHours() || d.getUTCMinutes()) ? `${s}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` : s; }
async function readXlsx(buf) {
  const z = await unzip(buf), wb = parseXML(await z.read('xl/workbook.xml'));
  const rels = {}; const rx = await z.read('xl/_rels/workbook.xml.rels'); if (rx) xEl(parseXML(rx), 'Relationship').forEach(r => rels[r.getAttribute('Id')] = r.getAttribute('Target'));
  const ssx = await z.read('xl/sharedStrings.xml'); const ss = ssx ? kidsX(parseXML(ssx), 'si').map(si => xEl(si, 't').map(t => t.textContent).join('')) : [];
  let dateXf = []; const stx = await z.read('xl/styles.xml');
  if (stx) { const sd = parseXML(stx), custom = {}; xEl(sd, 'numFmt').forEach(n => custom[n.getAttribute('numFmtId')] = n.getAttribute('formatCode')); dateXf = kidsX(x1(sd, 'cellXfs'), 'xf').map(x => { const id = +x.getAttribute('numFmtId'); if ((id >= 14 && id <= 22) || (id >= 45 && id <= 47)) return true; const f = custom[id]; return !!f && /[dmyhs]/i.test(f.replace(/\[[^\]]*\]|"[^"]*"/g, '')); }); }
  const out = [];
  for (const s of xEl(wb, 'sheet')) {
    const t = rels[s.getAttribute('r:id') || s.getAttributeNS(NS_REL, 'id')]; if (!t) continue;
    const xml = await z.read(t.startsWith('/') ? t.slice(1) : 'xl/' + t.replace(/^\.\//, '')); if (!xml) continue;
    const rows = [];
    xEl(parseXML(xml), 'row').forEach((rw, idx) => {
      const ri = rw.getAttribute('r') ? +rw.getAttribute('r') - 1 : idx, arr = [];
      kidsX(rw, 'c').forEach((c, ci) => {
        const ref = c.getAttribute('r'), col = ref ? colIdx(ref.replace(/\d+/g, '')) : ci, ty = c.getAttribute('t'), v = kidsX(c, 'v')[0];
        let val = '';
        if (ty === 's') val = v ? (ss[+v.textContent] ?? '') : '';
        else if (ty === 'inlineStr') val = xEl(c, 't').map(x => x.textContent).join('');
        else if (ty === 'b') val = v && v.textContent === '1' ? 'TRUE' : 'FALSE';
        else if (v) { val = v.textContent; if (ty !== 'str' && ty !== 'e' && dateXf[+c.getAttribute('s') || 0] && val !== '' && isFinite(+val)) val = serialToDate(+val); }
        arr[col] = val;
      });
      rows[ri] = arr;
    });
    out.push({name: s.getAttribute('name'), rows: Array.from(rows, r => Array.from(r || [], v => v ?? ''))});
  }
  return out;
}
function parseCSV(text) {
  text = String(text).replace(/^﻿/, ''); const first = text.split(/\r?\n/)[0] || '';
  const sep = [',', ';', '\t', '|'].map(s => [s, first.split(s).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true; else if (ch === sep) { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); rows.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(v => String(v).trim() !== ''));
}
const toCSV = rows => '﻿' + rows.map(r => r.map(v => { const s = String(v ?? ''); return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(',')).join('\r\n');
function tableFromRows(name, rows) {
  const hi = rows.findIndex(r => r.filter(v => String(v).trim() !== '').length >= 2); if (hi < 0) return {name, headers: [], rows: []};
  const seen = {}; const headers = rows[hi].map((h, i) => { let k = String(h || '').trim() || `Columna ${colName(i)}`; if (seen[k]) k += ' (' + (++seen[k]) + ')'; else seen[k] = 1; return k; });
  const data = rows.slice(hi + 1).filter(r => r.some(v => String(v).trim() !== '')).map(r => { const o = {}; headers.forEach((h, i) => o[h] = String(r[i] ?? '').trim()); return o; });
  return {name, headers, rows: data, headerRow: hi};
}
async function readTableFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'csv' || ext === 'txt') return [tableFromRows(file.name.replace(/\.\w+$/, ''), parseCSV(await file.text()))];
  if (ext === 'xls') throw new Error('Los archivos .xls (Excel 97-2003) no se pueden leer aquí. En Excel usa Guardar como → Libro de Excel (.xlsx) o CSV.');
  return (await readXlsx(await file.arrayBuffer())).map(s => tableFromRows(s.name, s.rows));
}
