# Folia · INCREMENT FACTURACION

Sistema de facturación CFDI 4.0: ingreso, egreso, traslado, Carta Porte 3.1, complemento de pagos 2.0 y retenciones 2.0.
Página estática: no necesita compilación para publicarse.

## Estructura

| Ruta | Qué es |
|---|---|
| `index.html` | La aplicación completa (lo que se publica) |
| `folia.config.js` | Configuración: almacenamiento, Supabase, API propia |
| `data/` | Catálogos del SAT que se cargan bajo demanda (c_CodigoPostal, c_ClaveProdServ, c_ClaveProdServCP, c_MaterialPeligroso) |
| `src/` | Código fuente por módulos. `sh src/build.sh` regenera `index.html` |
| `backend/supabase/schema.sql` | Tabla y políticas para guardar en Supabase |
| `backend/fastapi/` | API de ejemplo en FastAPI |

## Publicar

**GitHub Pages:** Settings → Pages → Source: *Deploy from a branch* → rama `main`, carpeta `/ (root)`.
Queda en `https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/`.

**Vercel / Netlify:** importa el repositorio, sin comando de build y con `.` como carpeta de salida.

**Local:** `python3 -m http.server 8000` y abre `http://localhost:8000`. (Abrir el archivo con doble clic no carga los catálogos de `data/`.)

## Dónde se guardan los datos

`src/storage.js` elige el almacenamiento automáticamente:

1. Dentro de claude.ai → base privada de la cuenta de Claude.
2. Con `supabase` en `folia.config.js` → Supabase.
3. Con `api` en `folia.config.js` → tu API (FastAPI).
4. Sin nada configurado → IndexedDB del navegador (y localStorage como respaldo).

Sin configurar un backend, cada navegador guarda sus propios datos: no se comparten entre equipos.
La cuenta de "Explorar con datos de ejemplo" siempre se guarda solo en el navegador.

### Conectar Supabase
1. Ejecuta `backend/supabase/schema.sql` en el SQL Editor de tu proyecto.
2. En `folia.config.js` descomenta la **Opción A** y pon tu URL y tu *anon key*.
3. Con Supabase activo, la contraseña la valida Supabase Auth (no el navegador).

### Conectar FastAPI
1. `cd backend/fastapi && pip install -r requirements.txt`
2. `FOLIA_ORIGINS="https://TU-USUARIO.github.io" uvicorn main:app --port 8080` (en producción, detrás de HTTPS y con PostgreSQL).
Publicado en GitHub Pages
4. En `folia.config.js` descomenta la **Opción B** y pon la URL de tu API.

## Seguridad
- Sin backend, la contraseña se guarda con sal y SHA-256 en el propio navegador: protege contra miradas casuales, no contra alguien con acceso al equipo.
- Con un backend compartido, usa siempre la autenticación del servidor (`FOLIA_CONFIG.auth`), como en las opciones A y B.
- La *anon key* de Supabase es pública por diseño; la protección real son las políticas RLS de `schema.sql`. Nunca pongas la *service_role key* en `folia.config.js`.
