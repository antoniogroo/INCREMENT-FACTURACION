#!/bin/sh
# Genera ../index.html (sitio independiente). Ejecuta: sh src/build.sh
set -e
cd "$(dirname "$0")"
ALL=$(mktemp)
trap 'rm -f "$ALL"' EXIT
cat cat.js catsat.js ccpsat.js catapply.js storage.js core.js pdf.js xlsx.js app1.js zf.js app2.js masiva.js bita.js app3.js app4.js app5.js series.js sat.js app6.js geo.js taxes.js catsat2.js ccp.js combo.js xlsread.js unidad.js > "$ALL"

# ---- Sitio independiente: documento HTML completo + folia.config.js opcional ----
OUT=..
L=$(grep -n '<div id="app">' head.html | cut -d: -f1)
{
  printf '<!doctype html>\n<html lang="es">\n<head>\n<meta charset="utf-8">\n'
  printf '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
  printf '<meta name="description" content="Facturación CFDI 4.0: ingresos, egresos, traslados, Carta Porte 3.1, complemento de pagos 2.0 y retenciones.">\n'
  printf '<link rel="icon" href="data:image/svg+xml,%%3Csvg xmlns=%%27http://www.w3.org/2000/svg%%27 viewBox=%%270 0 32 32%%27%%3E%%3Crect width=%%2732%%27 height=%%2732%%27 rx=%%277%%27 fill=%%27%%23155e4b%%27/%%3E%%3Ctext x=%%2716%%27 y=%%2721%%27 font-family=%%27monospace%%27 font-size=%%2712%%27 font-weight=%%27700%%27 fill=%%27white%%27 text-anchor=%%27middle%%27%%3E4.0%%3C/text%%3E%%3C/svg%%3E">\n'
  head -n $((L - 1)) head.html | grep -v 'claude:viewport\|<meta charset'
  printf '</head>\n<body>\n'
  tail -n +"$L" head.html
  printf '<script src="folia.config.js"></script>\n<script>\n'; cat "$ALL"; printf '</script>\n</body>\n</html>\n'
} > "$OUT/index.html"
