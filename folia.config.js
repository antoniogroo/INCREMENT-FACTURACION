/* =====================================================================
   Configuración de Folia (INCREMENT FACTURACION) para tu propio dominio
   ---------------------------------------------------------------------
   Sin cambiar nada, la página guarda cuentas, CFDIs y catálogos en el
   navegador (IndexedDB) y funciona igual que en claude.ai.

   Para sincronizar entre equipos, descomenta UNA de las opciones de abajo
   (Supabase o tu API con FastAPI). Las instrucciones están en README.md.
   ===================================================================== */
window.FOLIA_CONFIG = {
  // 'auto' (recomendado) · 'idb' · 'local' · 'supabase' · 'api' · o el nombre de un adaptador propio
  backend: 'auto',

  // Nombre de la base IndexedDB y prefijo de localStorage (cámbialos si alojas dos copias en el mismo dominio)
  dbName: 'folia',
  prefix: 'cfdi26:',

  // Avisos opcionales para tu integración (analítica, respaldo, cola de sincronización…)
  hooks: {
    // onReady(mode) { console.log('[Folia] almacenamiento:', mode); },
    // onSave(id, doc, mode) {},
    // onDelete(id, mode) {}
  }
};

/* ---------------------------------------------------------------------
   OPCIÓN A · SUPABASE  (tabla y políticas: backend/supabase/schema.sql)
   ---------------------------------------------------------------------
(function () {
  const SUPABASE_URL = 'https://TU-PROYECTO.supabase.co';
  const SUPABASE_ANON_KEY = 'TU_ANON_KEY_PUBLICA';
  let cliente;
  const sb = () => cliente || (cliente = import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm')
    .then(m => m.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)));
  const token = async () => { const {data} = await (await sb()).auth.getSession(); return data.session ? data.session.access_token : null; };

  window.FOLIA_CONFIG.supabase = {url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, table: 'folia_docs', getToken: token};
  // La contraseña la valida Supabase Auth (nunca el navegador) cuando hay base compartida:
  window.FOLIA_CONFIG.auth = {
    async signUp({email, password, nombre}) {
      const {data, error} = await (await sb()).auth.signUp({email, password, options: {data: {nombre}}});
      if (error) throw new Error(/registered/i.test(error.message) ? 'Ya existe una cuenta con ese correo. Inicia sesión.' : error.message);
      if (!data.session) throw new Error('Te enviamos un correo para confirmar tu cuenta. Confírmalo y luego inicia sesión.');
    },
    async signIn({email, password}) {
      const {error} = await (await sb()).auth.signInWithPassword({email, password});
      if (error) throw new Error(/confirm/i.test(error.message) ? 'Confirma tu correo antes de iniciar sesión.' : 'Correo o contraseña incorrectos.');
    },
    async signOut() { await (await sb()).auth.signOut(); },
    async restore() { return !!(await token()); }
  };
})();
*/

/* ---------------------------------------------------------------------
   OPCIÓN B · API PROPIA CON FASTAPI  (ejemplo: backend/fastapi/main.py)
   ---------------------------------------------------------------------
(function () {
  const API = 'https://api.tu-dominio.com';
  const KEY = 'folia_token';
  const leer = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
  const guardar = t => { try { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY); } catch (e) {} };
  const post = async (ruta, body) => {
    const r = await fetch(API + ruta, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.detail || 'No se pudo conectar con el servidor.');
    return j;
  };

  window.FOLIA_CONFIG.api = {baseUrl: API, headers: async () => (leer() ? {Authorization: 'Bearer ' + leer()} : {})};
  window.FOLIA_CONFIG.auth = {
    async signUp({email, password, nombre}) { guardar((await post('/auth/signup', {email, password, nombre})).token); },
    async signIn({email, password}) { guardar((await post('/auth/login', {email, password})).token); },
    async signOut() { const t = leer(); guardar(null); if (t) fetch(API + '/auth/logout', {method: 'POST', headers: {Authorization: 'Bearer ' + t}}).catch(() => {}); },
    async restore() { const t = leer(); if (!t) return false; const r = await fetch(API + '/auth/me', {headers: {Authorization: 'Bearer ' + t}}).catch(() => null); return !!(r && r.ok); }
  };
})();
*/

/* ---------------------------------------------------------------------
   OPCIÓN C · ADAPTADOR PROPIO (Firebase, Appwrite, tu ERP…)
   ---------------------------------------------------------------------
window.FOLIA_CONFIG.backend = 'miBackend';
window.FOLIA_CONFIG.adapters = {
  miBackend: {
    remote: true, label: 'mi servidor',
    async init(cfg) {},                 // conecta; lanza un Error si no está disponible (se usa IndexedDB)
    async get(id) { return null; },     // documento o null
    async put(id, doc) {},              // doc.acct y doc.coll sirven para listar
    async del(id) {},
    async list(acct, coll) { return []; }
  }
};
*/
