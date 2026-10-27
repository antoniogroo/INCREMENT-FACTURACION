/* ============ ALMACENAMIENTO DUAL (Claude · Supabase · API propia · IndexedDB · localStorage) ============
   Todo el sistema usa solo cinco operaciones: Store.get(id) · Store.put(id, obj) · Store.del(id) · Store.list(acct, coll) · Store.init().
   Cada documento lleva `acct` (cuenta) y `coll` (colección) para poder listarlos.

   Selección del backend (window.FOLIA_CONFIG.backend, por defecto 'auto'):
     · dentro de claude.ai (existe window.claude.use)  → 'claude'   (base privada ligada a la cuenta de Claude)
     · fuera de Claude con FOLIA_CONFIG.supabase        → 'supabase' (tabla folia_docs vía REST)
     · fuera de Claude con FOLIA_CONFIG.api             → 'api'      (FastAPI u otro backend REST)
     · fuera de Claude sin backend                      → 'idb'      (IndexedDB del navegador) y, si no existe, 'local' (localStorage)
   Si el backend elegido no arranca, se usa el siguiente de la cadena (idb → local) para que la página nunca se quede sin guardar. */
const FOLIA_CFG = Object.assign({backend: 'auto', dbName: 'folia', prefix: 'cfdi26:'}, (typeof window !== 'undefined' && window.FOLIA_CONFIG) || {});
const enClaude = () => !!(typeof window !== 'undefined' && window.claude && typeof window.claude.use === 'function');
const stSleep = ms => new Promise(r => setTimeout(r, ms));
const stRec = (id, obj) => ({id, acct: obj && obj.acct != null ? String(obj.acct) : '', coll: obj && obj.coll != null ? String(obj.coll) : '', data: obj});

const StorageAdapters = {
  /* Base privada del artefacto en claude.ai */
  claude: {
    mode: 'db', remote: true, label: 'base privada ligada a tu cuenta de Claude',
    async init() {
      if (!enClaude()) throw new Error('No está en claude.ai');
      const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      const id = db && user ? await user.id() : null; if (!id) throw new Error('Sin usuario de Claude');
      this.db = db; this.uid = id;
    },
    col() { return this.db.collection('data/users/' + this.uid); },
    async get(id) { const s = await this.col().doc(id).get(); return s.exists ? s.data() : null; },
    async put(id, obj) { try { await this.col().doc(id).set(obj); } catch (e) { if (e && e.code === 'unavailable') { await stSleep(400 + Math.random() * 400); await this.col().doc(id).set(obj); } else throw e; } },
    async del(id) { await this.col().doc(id).delete(); },
    async list(acct, coll) { const s = await this.col().where('acct', '==', acct).where('coll', '==', coll).limit(1000).get(); return s.docs.map(d => d.data()); }
  },

  /* IndexedDB: más espacio que localStorage (catálogos subidos, miles de CFDI) y no bloquea la página */
  idb: {
    mode: 'idb', remote: false, label: 'este navegador (IndexedDB)',
    async init(cfg) {
      if (typeof indexedDB === 'undefined') throw new Error('Sin IndexedDB');
      this.db = await new Promise((ok, ko) => {
        const r = indexedDB.open(cfg.dbName || 'folia', 1);
        r.onupgradeneeded = () => { const s = r.result.createObjectStore('docs', {keyPath: 'id'}); s.createIndex('by_ac', ['acct', 'coll']); };
        r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); r.onblocked = () => ko(new Error('IndexedDB bloqueada'));
      });
      await this.migrar(cfg);
    },
    tx(mode, fn) { return new Promise((ok, ko) => { const t = this.db.transaction('docs', mode), s = t.objectStore('docs'); let out; const r = fn(s); if (r) r.onsuccess = () => { out = r.result; }; t.oncomplete = () => ok(out); t.onerror = () => ko(t.error); t.onabort = () => ko(t.error || new Error('Transacción cancelada')); }); },
    async get(id) { const r = await this.tx('readonly', s => s.get(id)); return r ? r.data : null; },
    async put(id, obj) { await this.tx('readwrite', s => s.put(stRec(id, obj))); },
    async del(id) { await this.tx('readwrite', s => s.delete(id)); },
    async list(acct, coll) { const r = await this.tx('readonly', s => s.index('by_ac').getAll([String(acct), String(coll)])); return (r || []).map(x => x.data); },
    /* Una sola vez: pasa a IndexedDB lo que versiones anteriores guardaron en localStorage */
    async migrar(cfg) {
      const P = cfg.prefix || 'cfdi26:', flag = P + '__idb_migrado';
      try {
        if (localStorage.getItem(flag)) return;
        const keys = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(P) && k !== P + 'session' && !k.startsWith(P + '__')) keys.push(k); }
        for (const k of keys) { try { await this.put(k.slice(P.length), JSON.parse(localStorage.getItem(k))); } catch (e) { /* registro dañado: se omite */ } }
        keys.forEach(k => localStorage.removeItem(k)); localStorage.setItem(flag, new Date().toISOString());
      } catch (e) { /* sin localStorage: nada que migrar */ }
    }
  },

  /* localStorage: último recurso (≈5 MB) */
  local: {
    mode: 'local', remote: false, label: 'este navegador',
    async init(cfg) { this.P = cfg.prefix || 'cfdi26:'; localStorage.setItem(this.P + '__test', '1'); localStorage.removeItem(this.P + '__test'); },
    async get(id) { const v = localStorage.getItem(this.P + id); return v ? JSON.parse(v) : null; },
    async put(id, obj) { localStorage.setItem(this.P + id, JSON.stringify(obj)); },
    async del(id) { localStorage.removeItem(this.P + id); },
    async list(acct, coll) { const out = [], pre = this.P + acct + '~' + coll + '~'; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(pre)) out.push(JSON.parse(localStorage.getItem(k))); } return out; }
  },

  /* Supabase (PostgREST). Tabla y políticas en backend/supabase/schema.sql.
     FOLIA_CONFIG.supabase = {url, anonKey, table?: 'folia_docs', getToken?: async () => access_token} */
  supabase: {
    mode: 'supabase', remote: true, label: 'tu base de datos en Supabase',
    async init(cfg) {
      const c = cfg.supabase; if (!c || !c.url || !c.anonKey) throw new Error('Falta FOLIA_CONFIG.supabase.url / anonKey');
      this.c = c; this.base = c.url.replace(/\/$/, '') + '/rest/v1/' + (c.table || 'folia_docs');
    },
    async h(extra) { const t = this.c.getToken ? await this.c.getToken() : null; return Object.assign({apikey: this.c.anonKey, Authorization: 'Bearer ' + (t || this.c.anonKey), 'Content-Type': 'application/json'}, extra || {}); },
    async req(url, opt) { const r = await fetch(url, opt); if (!r.ok) { let m = ''; try { m = (await r.json()).message; } catch (e) { /* sin cuerpo */ } throw Object.assign(new Error(m || 'Supabase respondió ' + r.status), {code: r.status === 401 || r.status === 403 ? 'unauthorized' : 'http_' + r.status}); } return r.status === 204 ? null : r.json().catch(() => null); },
    async get(id) { const r = await this.req(`${this.base}?id=eq.${encodeURIComponent(id)}&select=data`, {headers: await this.h()}); return r && r[0] ? r[0].data : null; },
    async put(id, obj) { const x = stRec(id, obj); await this.req(`${this.base}?on_conflict=${this.c.conflict || 'owner,id'}`, {method: 'POST', headers: await this.h({Prefer: 'resolution=merge-duplicates,return=minimal'}), body: JSON.stringify({id: x.id, acct: x.acct, coll: x.coll, data: x.data})}); },
    async del(id) { await this.req(`${this.base}?id=eq.${encodeURIComponent(id)}`, {method: 'DELETE', headers: await this.h({Prefer: 'return=minimal'})}); },
    async list(acct, coll) {
      const out = []; for (let off = 0; ; off += 1000) {
        const r = await this.req(`${this.base}?acct=eq.${encodeURIComponent(acct)}&coll=eq.${encodeURIComponent(coll)}&select=data&order=id&limit=1000&offset=${off}`, {headers: await this.h()});
        (r || []).forEach(x => out.push(x.data)); if (!r || r.length < 1000) return out;
      }
    }
  },

  /* API propia (FastAPI de ejemplo en backend/fastapi/main.py).
     FOLIA_CONFIG.api = {baseUrl: 'https://mi-api.com', headers?: async () => ({Authorization: 'Bearer …'})}
     GET /docs/{id} → {data} | 404 · PUT /docs/{id} {acct, coll, data} · DELETE /docs/{id} · GET /docs?acct=&coll= → [{data}] */
  api: {
    mode: 'api', remote: true, label: 'tu servidor',
    async init(cfg) { const c = cfg.api; if (!c || !c.baseUrl) throw new Error('Falta FOLIA_CONFIG.api.baseUrl'); this.c = c; this.base = c.baseUrl.replace(/\/$/, ''); },
    async h() { return Object.assign({'Content-Type': 'application/json'}, this.c.headers ? await this.c.headers() : {}); },
    async req(path, opt = {}) { const r = await fetch(this.base + path, Object.assign({credentials: this.c.credentials || 'same-origin'}, opt, {headers: await this.h()})); if (r.status === 404 && (!opt.method || opt.method === 'GET')) return null; if (!r.ok) throw Object.assign(new Error('El servidor respondió ' + r.status), {code: r.status === 401 || r.status === 403 ? 'unauthorized' : 'http_' + r.status}); return r.status === 204 ? null : r.json().catch(() => null); },
    async get(id) { const r = await this.req('/docs/' + encodeURIComponent(id)); return r ? r.data : null; },
    async put(id, obj) { const x = stRec(id, obj); await this.req('/docs/' + encodeURIComponent(id), {method: 'PUT', body: JSON.stringify({acct: x.acct, coll: x.coll, data: x.data})}); },
    async del(id) { await this.req('/docs/' + encodeURIComponent(id), {method: 'DELETE'}); },
    async list(acct, coll) { const r = await this.req(`/docs?acct=${encodeURIComponent(acct)}&coll=${encodeURIComponent(coll)}`); return (Array.isArray(r) ? r : (r && r.items) || []).map(x => x && x.data !== undefined ? x.data : x); }
  }
};

const Store = {
  mode: 'local', adapter: null, primary: null, remote: false, label: 'este navegador', q: Promise.resolve(),
  /* Orden de intento según la configuración y el lugar donde corre la página */
  orden() {
    const want = FOLIA_CFG.backend || 'auto';
    if (want !== 'auto') return [want, 'idb', 'local'];
    return [].concat(enClaude() ? ['claude'] : [], FOLIA_CFG.supabase ? ['supabase'] : [], FOLIA_CFG.api ? ['api'] : [], ['idb', 'local']);
  },
  usar(a) { this.adapter = a; this.mode = a.mode; this.remote = !!a.remote; this.label = a.label; },
  async init() {
    for (const k of this.orden()) {
      const a = StorageAdapters[k]; if (!a) continue;
      try { await a.init(FOLIA_CFG); this.usar(a); this.primary = a; break; } catch (e) { if (k !== 'claude') console.warn('[Folia] Almacenamiento “' + k + '” no disponible:', e && e.message || e); }
    }
    if (!this.adapter) { this.usar(StorageAdapters.local); this.primary = StorageAdapters.local; }
    if (FOLIA_CFG.hooks && FOLIA_CFG.hooks.onReady) try { FOLIA_CFG.hooks.onReady(this.mode); } catch (e) { /* hook del integrador */ }
  },
  /* La cuenta de ejemplo vive siempre en el navegador: no ensucia tu base remota ni necesita iniciar sesión en ella */
  async usarLocal() { if (!this.remote) return; for (const k of ['idb', 'local']) { const a = StorageAdapters[k]; try { if (!a.db && !a.P) await a.init(FOLIA_CFG); this.usar(a); return; } catch (e) { /* siguiente */ } } },
  usarPrincipal() { if (this.primary && this.adapter !== this.primary) this.usar(this.primary); },
  run(fn) { this.q = this.q.then(fn, fn); return this.q; },
  async get(id) { return this.adapter.get(id); },
  async put(id, obj) {
    return this.run(async () => {
      try { await this.adapter.put(id, obj); if (FOLIA_CFG.hooks && FOLIA_CFG.hooks.onSave) try { FOLIA_CFG.hooks.onSave(id, obj, this.mode); } catch (e) { /* hook */ } }
      catch (e) {
        const m = e && e.code === 'quota_exceeded' || (e && e.name === 'QuotaExceededError') ? 'El almacenamiento está lleno. Borra registros que ya no uses.' : e && e.code === 'unauthorized' ? 'Tu sesión con el servidor expiró. Vuelve a iniciar sesión.' : this.remote ? 'No se pudo guardar: ' + (e && e.message || e) : 'Tu navegador no permite guardar datos.';
        toast(m, 'bad'); if (this.remote) throw e;
      }
    });
  },
  async del(id) {
    return this.run(async () => {
      try { await this.adapter.del(id); if (FOLIA_CFG.hooks && FOLIA_CFG.hooks.onDelete) try { FOLIA_CFG.hooks.onDelete(id, this.mode); } catch (e) { /* hook */ } }
      catch (e) { if (this.remote) throw e; }
    });
  },
  async list(acct, coll) { try { return await this.adapter.list(acct, coll); } catch (e) { if (this.remote) throw e; return []; } },
  /* Registrar un adaptador propio: FoliaStorage.register('miBackend', {mode, remote, label, init, get, put, del, list}) y FOLIA_CONFIG.backend = 'miBackend' */
  register(name, a) { StorageAdapters[name] = Object.assign({mode: name, remote: true, label: name}, a); }
};
Object.entries(FOLIA_CFG.adapters || {}).forEach(([n, a]) => Store.register(n, a));
if (typeof window !== 'undefined') window.FoliaStorage = {Store, adapters: StorageAdapters, register: (n, a) => Store.register(n, a), config: FOLIA_CFG};

/* ============ AUTENTICACIÓN CON SERVIDOR (opcional) ============
   Sin FOLIA_CONFIG.auth, la cuenta se valida en el navegador (correo + contraseña con sal y SHA-256), igual que siempre.
   Con un backend compartido (Supabase/FastAPI) la contraseña debe validarla el servidor: define
   FOLIA_CONFIG.auth = {signUp({email, password, nombre}), signIn({email, password}), signOut(), restore()}
   Cada función lanza un Error con mensaje para mostrarlo en el formulario; restore() devuelve true si la sesión del servidor sigue viva. */
const AuthHooks = FOLIA_CFG.auth || null;
