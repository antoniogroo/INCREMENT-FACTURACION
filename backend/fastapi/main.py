"""
Folia · API de ejemplo con FastAPI + SQLite.

Implementa exactamente lo que espera el adaptador 'api' de src/storage.js:
  POST /auth/signup  {email, password, nombre} -> {token}
  POST /auth/login   {email, password}         -> {token}
  POST /auth/logout                            -> 204
  GET  /auth/me                                -> {email, nombre}
  GET    /docs/{id}                -> {data} | 404
  PUT    /docs/{id}  {acct, coll, data}
  DELETE /docs/{id}
  GET    /docs?acct=&coll=         -> [{data}, ...]

Ejecutar:
  pip install -r requirements.txt
  FOLIA_ORIGINS="https://tu-usuario.github.io,http://localhost:8000" uvicorn main:app --reload --port 8080

Para producción cambia SQLite por PostgreSQL y sirve la API detrás de HTTPS.
"""
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import time
from contextlib import contextmanager

from fastapi import Depends, FastAPI, Header, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field

DB_PATH = os.environ.get("FOLIA_DB", "folia.db")
SESSION_DAYS = int(os.environ.get("FOLIA_SESSION_DAYS", "30"))
ORIGINS = [o.strip() for o in os.environ.get("FOLIA_ORIGINS", "http://localhost:8000").split(",") if o.strip()]

app = FastAPI(title="Folia API", version="1.0")
app.add_middleware(CORSMiddleware, allow_origins=ORIGINS, allow_methods=["*"], allow_headers=["*"])


@contextmanager
def db():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    try:
        yield con
        con.commit()
    finally:
        con.close()


with db() as c:
    c.executescript(
        """
        create table if not exists users (id integer primary key, email text unique not null, nombre text, salt text not null, hash text not null, created real);
        create table if not exists sessions (token text primary key, user_id integer not null, expires real not null);
        create table if not exists docs (user_id integer not null, id text not null, acct text not null default '', coll text not null default '',
                                         data text not null, updated real, primary key (user_id, id));
        create index if not exists docs_ac on docs (user_id, acct, coll);
        """
    )


def pw_hash(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 310_000).hex()


def new_session(user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    with db() as c:
        c.execute("insert into sessions values (?,?,?)", (token, user_id, time.time() + SESSION_DAYS * 86400))
    return token


def current_user(authorization: str = Header(default="")) -> int:
    token = authorization.removeprefix("Bearer ").strip()
    with db() as c:
        row = c.execute("select user_id, expires from sessions where token = ?", (token,)).fetchone()
    if not row or row["expires"] < time.time():
        raise HTTPException(401, "Tu sesión expiró. Vuelve a iniciar sesión.")
    return row["user_id"]


class Signup(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    nombre: str = ""


class Login(BaseModel):
    email: EmailStr
    password: str


class Doc(BaseModel):
    acct: str = ""
    coll: str = ""
    data: dict


@app.post("/auth/signup")
def signup(body: Signup):
    salt = secrets.token_hex(16)
    try:
        with db() as c:
            cur = c.execute("insert into users (email, nombre, salt, hash, created) values (?,?,?,?,?)",
                            (body.email.lower(), body.nombre, salt, pw_hash(body.password, salt), time.time()))
            uid = cur.lastrowid
    except sqlite3.IntegrityError:
        raise HTTPException(409, "Ya existe una cuenta con ese correo. Inicia sesión.")
    return {"token": new_session(uid)}


@app.post("/auth/login")
def login(body: Login):
    with db() as c:
        u = c.execute("select * from users where email = ?", (body.email.lower(),)).fetchone()
    if not u or not hmac.compare_digest(u["hash"], pw_hash(body.password, u["salt"])):
        raise HTTPException(401, "Correo o contraseña incorrectos.")
    return {"token": new_session(u["id"])}


@app.post("/auth/logout", status_code=204)
def logout(authorization: str = Header(default="")):
    with db() as c:
        c.execute("delete from sessions where token = ?", (authorization.removeprefix("Bearer ").strip(),))
    return Response(status_code=204)


@app.get("/auth/me")
def me(uid: int = Depends(current_user)):
    with db() as c:
        u = c.execute("select email, nombre from users where id = ?", (uid,)).fetchone()
    return {"email": u["email"], "nombre": u["nombre"]}


@app.get("/docs/{doc_id}")
def get_doc(doc_id: str, uid: int = Depends(current_user)):
    with db() as c:
        row = c.execute("select data from docs where user_id = ? and id = ?", (uid, doc_id)).fetchone()
    if not row:
        raise HTTPException(404, "No existe")
    return {"data": json.loads(row["data"])}


@app.put("/docs/{doc_id}", status_code=204)
def put_doc(doc_id: str, body: Doc, uid: int = Depends(current_user)):
    with db() as c:
        c.execute(
            "insert into docs (user_id, id, acct, coll, data, updated) values (?,?,?,?,?,?) "
            "on conflict(user_id, id) do update set acct = excluded.acct, coll = excluded.coll, data = excluded.data, updated = excluded.updated",
            (uid, doc_id, body.acct, body.coll, json.dumps(body.data, ensure_ascii=False), time.time()),
        )
    return Response(status_code=204)


@app.delete("/docs/{doc_id}", status_code=204)
def del_doc(doc_id: str, uid: int = Depends(current_user)):
    with db() as c:
        c.execute("delete from docs where user_id = ? and id = ?", (uid, doc_id))
    return Response(status_code=204)


@app.get("/docs")
def list_docs(acct: str, coll: str, uid: int = Depends(current_user)):
    with db() as c:
        rows = c.execute("select data from docs where user_id = ? and acct = ? and coll = ? order by id", (uid, acct, coll)).fetchall()
    return [{"data": json.loads(r["data"])} for r in rows]
