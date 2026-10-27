/* ============ APLICAR CATÁLOGOS OFICIALES DEL SAT A CAT (antes de que los usen los demás módulos) ============ */
(function aplicarCatSat() {
  const C = CATSAT, ord = (list, first) => list.slice().sort((a, b) => { const x = first.indexOf(a[0]), y = first.indexOf(b[0]); return (x < 0 ? 999 : x) - (y < 0 ? 999 : y) || a[0].localeCompare(b[0]); });
  CAT.regimen = C.regimen.map(r => [r[0], r[1], r[2]]);
  CAT.uso = C.uso.map(u => [u[0], u[1], u[2], u[3]]);
  CAT.formaPago = C.formaPago.map(f => [f[0], f[1]]);
  CAT.metodoPago = C.metodoPago.map(m => [m[0], m[1]]);
  CAT.moneda = ord(C.moneda.map(m => [m[0], m[1]]), ['MXN', 'USD', 'EUR', 'CAD', 'XXX']);
  CAT.objetoImp = C.objetoImp;
  CAT.tipoRelacion = C.tipoRelacion; CAT.exportacion = C.exportacion; CAT.periodicidad = C.periodicidad; CAT.meses = C.meses; CAT.impuesto = C.impuesto;
  CAT.tipo = C.tipo.map(t => [t[0], t[1]]);
  CAT.estados = C.estadosAll.filter(e => e[2] === 'MEX').map(e => [e[0], e[1]]);
  CAT.paises = C.paises;
  CAT.unidadAll = C.unidad;
  const UM = new Map(C.unidad);
  CAT.unidad = CAT.unidad.filter(u => UM.has(u[0])).map(u => [u[0], UM.get(u[0])]);
  CAT.tasas = C.tasas;
})();
const UNIDAD_MAP = new Map(CATSAT.unidad);
/* c_TasaOCuota: ¿la tasa o cuota existe para ese impuesto, factor y tipo (traslado/retención)? */
function tasaPermitida(imp, factor, tasa, ret) {
  if (factor === 'Exento') return imp === '002' && !ret;
  const v = num(tasa);
  return CAT.tasas.some(t => t.imp === imp && t.factor === factor && (ret ? t.ret : t.tras) && (t.t === 'Fijo' ? Math.abs(t.max - v) < 1e-7 : v >= t.min - 1e-9 && v <= t.max + 1e-9));
}
/* Catálogos del complemento Carta Porte 3.1 (Catalogos_Carta_Porte31) */
(function aplicarCCP() {
  const C = CCPSAT;
  CAT.configVeh = C.config.map(c => [c[0], c[1]]);
  CAT.configMeta = Object.fromEntries(C.config.map(c => [c[0], {ejes: c[2], llantas: c[3], rem: c[4]}]));
  CAT.permSCT = C.permiso.filter(p => p[2].split(',').includes('01')).map(p => [p[0], p[1]]);
  CAT.subTipoRem = C.subTipoRem; CAT.tipoFigura = C.figura; CAT.parteTransporte = C.parte; CAT.embalaje = C.embalaje;
  CAT.unidadPeso = C.unidadPeso.map(u => [u[0], u[1]]);
})();
const UNIDAD_PESO = new Map(CCPSAT.unidadPeso.map(u => [u[0], u[1]]));
const PSCP = {list: null, map: null, mp: null, loading: null, err: ''};
/* Bandera “Material peligroso” de c_ClaveProdServCP: '0', '1' o '0,1' */
function ccpFlag(k) { const o = PSCP.map && PSCP.map.get(k); if (o) return o[2]; const p = PRODSERV.find(x => x[0] === k); return p && p[2] ? '0,1' : (PSCP.map ? '' : '0'); }
