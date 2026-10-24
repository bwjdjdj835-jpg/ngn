"""Pinguim — encontra comércios locais sem site (Google Places + OpenStreetMap).

Deploy na Vercel (root directory `pinguim/`):
- chave do Google em GOOGLE_PLACES_API_KEY
- a interface e a API são públicas (sem login)
- resultados novos em /tmp/pinguim (o filesystem da função é somente leitura)
- amostras versionadas continuam em data/ e são só leitura
"""
import asyncio
import datetime
import json
import os
import pathlib
import re
import time
import unicodedata
from urllib.parse import quote_plus

import dns.asyncresolver
import dns.resolver
import httpx
from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse

UA = "Pinguim/0.1 (agente comercios sem site; contato: bruno)"
NOMINATIM = "https://nominatim.openstreetmap.org/search"
# de é o primário. Os dois seguintes cobrem 502/timeout; kumi fica por último
# porque às vezes segura a conexão até o timeout do cliente.
OVERPASS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.openstreetmap.fr/api/interpreter",
    "https://overpass.osm.ch/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
# Orçamento interno, abaixo do maxDuration de 60s em vercel.json, para
# devolver JSON em vez de estourar o timeout da função.
SEARCH_BUDGET_S = 40
OVERPASS_QUERY_TIMEOUT = 8
DOMAIN_BUDGET_S = 8
MAX_DOMAIN_TARGETS = 8
DNS_LIFETIME = 1.5

ROOT = pathlib.Path(__file__).resolve().parent
SAMPLES = ROOT / "data"
RESULTS = pathlib.Path("/tmp/pinguim")
STATIC_INDEX = ROOT / "static" / "index.html"
_SAFE_NAME = re.compile(r"^[A-Za-z0-9._-]+\.json$")

CATEGORIAS = {
    "pet shop": ["shop=pet", "amenity=veterinary", "shop=pet_grooming"],
    "veterinario": ["amenity=veterinary"],
    "padaria": ["shop=bakery", "shop=pastry"],
    "restaurante": ["amenity=restaurant", "amenity=fast_food"],
    "lanchonete": ["amenity=fast_food", "amenity=cafe"],
    "bar": ["amenity=bar", "amenity=pub"],
    "salao": ["shop=hairdresser", "shop=beauty"],
    "barbearia": ["shop=hairdresser"],
    "oficina": ["shop=car_repair", "shop=motorcycle_repair", "craft=mechanic"],
    "mercado": ["shop=supermarket", "shop=convenience"],
    "farmacia": ["amenity=pharmacy", "shop=chemist"],
    "academia": ["leisure=fitness_centre"],
    "hotel": ["tourism=hotel", "tourism=guest_house", "tourism=motel"],
    "loja de roupas": ["shop=clothes"],
    "otica": ["shop=optician"],
    "dentista": ["amenity=dentist"],
}

PLACES = "https://places.googleapis.com/v1/places:searchText"
FIELDS = ",".join([
    "places.id",
    "places.displayName",
    "places.formattedAddress",
    "places.internationalPhoneNumber",
    "places.nationalPhoneNumber",
    "places.websiteUri",
    "places.googleMapsUri",
    "places.rating",
    "places.location",
    "places.primaryType",
    "nextPageToken",
])


def norm(s):
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower().strip()


def slug(s):
    return re.sub(r"[^a-z0-9]", "", norm(s))


def public_error(msg):
    if isinstance(msg, BaseException):
        text = str(msg).strip() or type(msg).__name__
    else:
        text = str(msg).strip() or "erro desconhecido"
    key = os.environ.get("GOOGLE_PLACES_API_KEY") or ""
    if key and key in text:
        text = text.replace(key, "***")
    return text[:500]


def tag_filter(t):
    k, v = t.split("=")
    return f'["{k}"="{v}"]'


def overpass_util(payload):
    """HTTP 200 não basta: há espelho que responde vazio, sem base OSM."""
    if not isinstance(payload, dict) or "elements" not in payload:
        return False
    if payload.get("remark"):
        return False
    ts = str((payload.get("osm3s") or {}).get("timestamp_osm_base") or "")
    return "T" in ts


def overpass_name_regex(termo):
    cleaned = re.sub(r'[\[\]\(\);"\\]', "", termo)
    return re.escape(cleaned).replace('"', "")


_last_nom = 0.0


async def geocode(c, cidade):
    global _last_nom
    wait = 1.1 - (time.time() - _last_nom)
    if wait > 0:
        await asyncio.sleep(wait)  # Nominatim: max 1 req/s
    _last_nom = time.time()
    r = await c.get(
        NOMINATIM,
        params={"q": f"{cidade}, Brasil", "format": "json", "limit": 1, "countrycodes": "br"},
        timeout=8,
    )
    r.raise_for_status()
    j = r.json()
    if not j:
        raise ValueError(f"Cidade não encontrada: {cidade}")
    g = j[0]
    return g, g["display_name"], [float(x) for x in g["boundingbox"]]


async def overpass(c, termo, bbox, deadline):
    s, n, w, e = bbox
    b = f"({s},{w},{n},{e})"
    tags = CATEGORIAS.get(norm(termo))
    if tags:
        parts = "".join(f"nwr{tag_filter(t)}{b};" for t in tags)
    else:
        rx = overpass_name_regex(termo)
        parts = f'nwr["name"~"{rx}",i]{b};'
    q = f"[out:json][timeout:{OVERPASS_QUERY_TIMEOUT}];({parts});out center tags;"
    falhas = []
    for url in OVERPASS:
        left = deadline - time.monotonic()
        if left < 5:
            falhas.append("sem tempo restante para o Overpass")
            break
        try:
            host = url.split("/")[2]
            r = await c.post(url, data={"data": q}, timeout=min(10, left - 1))
            if r.status_code == 200:
                try:
                    payload = r.json()
                except Exception:
                    falhas.append(f"{host}: JSON inválido")
                    continue
                if overpass_util(payload):
                    return payload.get("elements") or [], tags
                falhas.append(f"{host}: instância sem base OSM utilizável")
                continue
            falhas.append(f"{host} HTTP {r.status_code}")
        except Exception as ex:
            falhas.append(f"{url.split('/')[2]}: {public_error(ex)}")
    raise RuntimeError("Overpass falhou: " + "; ".join(falhas))


async def google_places(c, termo, cidade, deadline, max_paginas=3):
    key = os.environ.get("GOOGLE_PLACES_API_KEY")
    if not key:
        return [], "GOOGLE_PLACES_API_KEY não definida"
    out, token = [], None
    for _ in range(max_paginas):
        if deadline - time.monotonic() < 6:
            if out:
                return out, "paginação do Google cortada pelo limite de tempo"
            return [], "Google Places pulado pelo limite de tempo"
        body = {"textQuery": f"{termo} em {cidade}", "languageCode": "pt-BR", "regionCode": "BR", "pageSize": 20}
        if token:
            body["pageToken"] = token
        left = deadline - time.monotonic()
        r = await c.post(
            PLACES,
            json=body,
            headers={"X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELDS},
            timeout=min(8, max(1, left - 1)),
        )
        if r.status_code != 200:
            try:
                msg = r.json()["error"]["message"]
            except Exception:
                msg = r.text[:300]
            return out, f"Google Places HTTP {r.status_code}: {public_error(msg)}"
        j = r.json()
        out += j.get("places", [])
        token = j.get("nextPageToken")
        if not token:
            break
        await asyncio.sleep(0.2)
    if token:
        return out, "paginação do Google cortada pelo limite de tempo"
    return out, None


def phone55(p):
    if not p:
        return None
    p = p.split(";")[0]
    d = re.sub(r"\D", "", p)
    if d.startswith("00"):
        d = d[2:]
    if d.startswith("0"):
        d = d.lstrip("0")
    if not d.startswith("55"):
        d = "55" + d
    return d if 12 <= len(d) <= 13 else None


async def dns_exists(dom):
    try:
        res = dns.asyncresolver.Resolver()
        res.lifetime = DNS_LIFETIME
        res.timeout = DNS_LIFETIME
        for t in ("A", "NS"):
            try:
                await res.resolve(dom, t)
                return True
            except dns.resolver.NoAnswer:
                continue
        return False
    except Exception:
        return False


async def rdap(c, dom):
    url = f"https://rdap.registro.br/domain/{dom}" if dom.endswith(".br") else f"https://rdap.org/domain/{dom}"
    try:
        r = await c.get(url, timeout=2.5, follow_redirects=True)
        return {200: True, 404: False}.get(r.status_code)
    except Exception:
        return None


async def has_site(c, dom):
    async def one(u):
        try:
            r = await c.get(u, timeout=2, follow_redirects=True)
            return r.status_code < 500
        except Exception:
            return False

    https_ok, http_ok = await asyncio.gather(one(f"https://{dom}"), one(f"http://{dom}"))
    return https_ok or http_ok


async def check_domain(c, sem, dom):
    async with sem:
        try:
            d, rd = await asyncio.gather(dns_exists(dom), rdap(c, dom))
            reg = rd if rd is not None else d
            site = await has_site(c, dom) if d else False
            return {
                "dominio": dom,
                "registrado": bool(reg) if reg is not None else None,
                "dns": d,
                "rdap": rd,
                "site_ativo": site,
                "status": "registrado" if reg else "provavelmente livre",
            }
        except Exception:
            return {
                "dominio": dom,
                "registrado": None,
                "dns": False,
                "rdap": None,
                "site_ativo": False,
                "status": "não verificado",
            }


def candidatos(nome):
    s = slug(nome)
    if not s:
        return []
    return [f"{s}.com.br", f"{s}.com"]


async def anexar_dominios(c, items, erros, deadline):
    left = deadline - time.monotonic()
    if left < 3:
        erros.append("checagem de domínios pulada para caber no tempo da função")
        return
    sem_site = [i for i in items if not i["tem_site"]]
    alvo = sem_site[:MAX_DOMAIN_TARGETS]
    if len(sem_site) > len(alvo):
        erros.append(f"checagem de domínios limitada a {MAX_DOMAIN_TARGETS} comércios sem site")
    if not alvo:
        return
    sem = asyncio.Semaphore(8)
    groups, all_tasks = [], []
    for item in alvo:
        tasks = [asyncio.create_task(check_domain(c, sem, d)) for d in candidatos(item["nome"])]
        groups.append((item, tasks))
        all_tasks.extend(tasks)
    if not all_tasks:
        return
    budget = min(DOMAIN_BUDGET_S, left - 1)
    _done, pending = await asyncio.wait(all_tasks, timeout=max(0.1, budget))
    for task in pending:
        task.cancel()
    if pending:
        await asyncio.gather(*pending, return_exceptions=True)
        erros.append("parte da checagem de domínios foi interrompida para caber no tempo")
    for item, tasks in groups:
        ready = []
        for task in tasks:
            if task.cancelled() or not task.done() or task.exception() is not None:
                continue
            ready.append(task.result())
        item["dominios"] = ready
        item["site_mesmo_nome"] = any(x.get("site_ativo") for x in ready)


def salvar(out, termo, cidade):
    RESULTS.mkdir(parents=True, exist_ok=True)
    fn = RESULTS / f"{slug(termo)}_{slug(cidade)}_{datetime.datetime.now():%Y%m%d_%H%M%S}.json"
    payload = json.dumps(out, ensure_ascii=False, indent=2)
    fn.write_text(payload, encoding="utf-8")
    (RESULTS / "latest.json").write_text(payload, encoding="utf-8")
    return str(fn)


def _dentro_bbox(lat, lon, bbox):
    if lat is None or lon is None:
        return True
    s, n, w, e = bbox
    return (s - 0.05) <= lat <= (n + 0.05) and (w - 0.05) <= lon <= (e + 0.05)


async def buscar(termo, cidade, checar_dominios=False):
    termo, cidade = (termo or "").strip(), (cidade or "").strip()
    if not termo or not cidade:
        raise ValueError("Informe termo e cidade")
    if len(termo) > 80 or len(cidade) > 120:
        raise ValueError("termo ou cidade longo demais")
    start = time.monotonic()
    deadline = start + SEARCH_BUDGET_S
    async with httpx.AsyncClient(
        headers={"User-Agent": UA},
        timeout=httpx.Timeout(10.0, connect=5.0),
    ) as c:
        g, display, bbox = await geocode(c, cidade)
        erros, items, seen = [], [], set()
        gp, gerr = await google_places(c, termo, cidade, deadline)
        if gerr:
            erros.append(gerr)
        cid = cidade.split(",")[0]
        for p in gp:
            nome = (p.get("displayName") or {}).get("text")
            if not nome:
                continue
            lat = (p.get("location") or {}).get("latitude")
            lon = (p.get("location") or {}).get("longitude")
            if not _dentro_bbox(lat, lon, bbox):
                continue
            tel = p.get("internationalPhoneNumber") or p.get("nationalPhoneNumber")
            p55 = phone55(tel)
            site = p.get("websiteUri")
            seen.add(norm(nome))
            items.append({
                "id": f"google/{p['id']}",
                "fonte": "google_places",
                "nome": nome,
                "categoria": p.get("primaryType"),
                "endereco": p.get("formattedAddress"),
                "telefone": tel,
                "telefone_e164": ("+" + p55) if p55 else None,
                "lat": lat,
                "lon": lon,
                "avaliacao": p.get("rating"),
                "tem_site": bool(site),
                "site": site,
                "links": {
                    "whatsapp": f"https://wa.me/{p55}" if p55 else None,
                    "instagram": f"https://www.instagram.com/explore/search/keyword/?q={quote_plus(nome)}",
                    "instagram_fonte": "busca",
                    "google_maps": p.get("googleMapsUri") or f"https://www.google.com/maps/search/?api=1&query={quote_plus(nome + ' ' + cid)}",
                    "osm": None,
                },
                "dominios": [],
                "site_mesmo_nome": False,
                "tags_osm": None,
            })
        tags = None
        els = []
        if deadline - time.monotonic() < 5:
            erros.append("Overpass pulado para caber no tempo da função")
        else:
            try:
                els, tags = await overpass(c, termo, bbox, deadline)
            except Exception as ex:
                els, tags = [], None
                erros.append(public_error(ex))
        for e in els:
            t = e.get("tags") or {}
            nome = t.get("name")
            if not nome:
                continue
            if not tags and not any(k in t for k in ("shop", "amenity", "craft", "office", "tourism", "leisure", "healthcare")):
                continue
            lat = e.get("lat") or (e.get("center") or {}).get("lat")
            lon = e.get("lon") or (e.get("center") or {}).get("lon")
            key = norm(nome)
            if key in seen:
                ig0 = t.get("contact:instagram") or t.get("instagram")
                for it in items:
                    if norm(it["nome"]) == key and it["fonte"] == "google_places":
                        it["fonte"] = "google_places+osm"
                        it["links"]["osm"] = f"https://www.openstreetmap.org/{e['type']}/{e['id']}"
                        if ig0:
                            it["links"]["instagram"] = ig0 if str(ig0).startswith("http") else "https://instagram.com/" + str(ig0).lstrip("@")
                            it["links"]["instagram_fonte"] = "osm"
                continue
            seen.add(key)
            site = t.get("website") or t.get("contact:website") or t.get("url")
            tel = t.get("phone") or t.get("contact:phone") or t.get("contact:mobile") or t.get("mobile") or t.get("contact:whatsapp")
            end = ", ".join(x for x in [
                " ".join(filter(None, [t.get("addr:street"), t.get("addr:housenumber")])),
                t.get("addr:suburb"),
                t.get("addr:city"),
            ] if x) or None
            ig = t.get("contact:instagram") or t.get("instagram")
            if ig and not str(ig).startswith("http"):
                ig = "https://instagram.com/" + str(ig).lstrip("@")
            p55 = phone55(tel)
            items.append({
                "id": f"{e['type']}/{e['id']}",
                "fonte": "osm",
                "nome": nome,
                "avaliacao": None,
                "categoria": next((f"{k}={t[k]}" for k in ("shop", "amenity", "craft", "leisure", "tourism") if k in t), None),
                "endereco": end,
                "telefone": tel,
                "telefone_e164": ("+" + p55) if p55 else None,
                "lat": lat,
                "lon": lon,
                "tem_site": bool(site),
                "site": site,
                "links": {
                    "whatsapp": f"https://wa.me/{p55}" if p55 else None,
                    "instagram": ig or f"https://www.instagram.com/explore/search/keyword/?q={quote_plus(nome)}",
                    "instagram_fonte": "osm" if ig else "busca",
                    "google_maps": f"https://www.google.com/maps/search/?api=1&query={quote_plus(nome + ' ' + cid)}",
                    "osm": f"https://www.openstreetmap.org/{e['type']}/{e['id']}",
                },
                "dominios": [],
                "site_mesmo_nome": False,
                "tags_osm": t,
            })
        if checar_dominios:
            await anexar_dominios(c, items, erros, deadline)
        out = {
            "schema": "pinguim/v1",
            "gerado_em": datetime.datetime.now().astimezone().isoformat(),
            "consulta": {
                "termo": termo,
                "cidade": cidade,
                "cidade_resolvida": display,
                "bbox": bbox,
                "tags_osm": tags,
            },
            "resumo": {
                "total": len(items),
                "com_site": sum(i["tem_site"] for i in items),
                "sem_site": sum(not i["tem_site"] for i in items),
                "por_fonte": {f: sum(i["fonte"] == f for i in items) for f in {i["fonte"] for i in items}},
            },
            "erros": erros,
            "resultados": items,
        }
        try:
            arquivo = salvar(out, termo, cidade)
        except OSError as ex:
            arquivo = None
            erros.append(f"não foi possível salvar em /tmp: {ex}")
            out["erros"] = erros
        out["arquivo"] = arquivo
        print(
            f"pinguim busca termo={termo!r} cidade={cidade!r} n={len(items)} "
            f"dominios={checar_dominios} s={time.monotonic() - start:.1f}"
        )
        return out


def listar_resultados():
    names = set()
    for folder in (RESULTS, SAMPLES):
        if folder.is_dir():
            names.update(p.name for p in folder.glob("*.json") if p.is_file())
    return sorted(names)


def achar_resultado(nome):
    if not _SAFE_NAME.fullmatch(nome or ""):
        return None
    for folder in (RESULTS, SAMPLES):
        path = folder / nome
        if path.is_file():
            return path
    return None


app = FastAPI(title="Pinguim")


@app.get("/api/buscar")
async def api_buscar(termo: str, cidade: str, dominios: bool = False):
    try:
        return await buscar(termo, cidade, dominios)
    except Exception as ex:
        return {"erro": public_error(ex)}


@app.get("/api/categorias")
def cats():
    return CATEGORIAS


@app.get("/api/resultados")
def listar():
    return listar_resultados()


@app.get("/api/resultados/{nome}")
def um(nome: str):
    path = achar_resultado(nome)
    if path is None:
        return JSONResponse({"erro": "arquivo não encontrado"}, status_code=404)
    return FileResponse(path, media_type="application/json")


@app.get("/", include_in_schema=False)
def home():
    if not STATIC_INDEX.is_file():
        return JSONResponse({"erro": "static/index.html ausente"}, status_code=500)
    return FileResponse(STATIC_INDEX, media_type="text/html")
