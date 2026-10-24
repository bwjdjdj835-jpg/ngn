# 🐧 Pinguim — comércios sem site (Google Places + OpenStreetMap)

Busca comércios locais e marca quem não tem site. A fonte primária é a Google Places API (New); o OpenStreetMap entra como complemento e como fallback. A página e a API abrem sem login.

Este app fica só na pasta `pinguim/`. O site Legado Barbearia (GitHub Pages a partir da `main`) não faz parte daqui.

## Rodar localmente

```bash
cd pinguim
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
export GOOGLE_PLACES_API_KEY="sua-chave"   # opcional: sem ela a busca usa só OSM
.venv/bin/uvicorn app:app --host 0.0.0.0 --port 8010
```

Abra http://localhost:8010 . Não há usuário nem senha.

Não commite `.env`. O exemplo vazio está em `.env.example`.

API:

- `GET /api/buscar?termo=pet shop&cidade=Cacoal, RO&dominios=false`
- `GET /api/categorias`
- `GET /api/resultados`
- `GET /api/resultados/{arquivo}`

`dominios` vem **desligado** por padrão (`false`). Com `dominios=true` (ou a caixa na página) a checagem de DNS/RDAP/HTTP roda, com teto curto, só para quem não tem site.

## Deploy na Vercel

Crie um **projeto novo** neste repositório. Não reutilize um projeto cujo root seja a raiz do site da barbearia.

No dashboard do projeto:

| Configuração | Valor |
| --- | --- |
| Root Directory | `pinguim` |
| Framework Preset | FastAPI (detectado por `requirements.txt` + `app.py`). Se a lista não mostrar, deixe em branco / Other. |
| Build Command | vazio |
| Output Directory | vazio |
| Install Command | vazio (a Vercel instala `requirements.txt`) |
| Python | 3.12 (arquivo `.python-version`) |

Variável de ambiente (Production e Preview). O **valor** fica só no dashboard:

- `GOOGLE_PLACES_API_KEY` — Places API (New). Sem ela a busca ainda roda pelo OSM e registra o aviso.

Não há login. `PINGUIM_USER` e `PINGUIM_PASSWORD` não são lidas.

Entrypoint: `app.py` na raiz do projeto Vercel (a pasta `pinguim/` do git), variável `app` (FastAPI). `vercel.json` usa o builder `@vercel/python` (`builds`) e manda todo request para `app.py` (`routes`). `includeFiles` empacota `static/` e `data/`; `maxDuration` é 60. A chave `functions` não entra: no deploy por Git ela só casa arquivos dentro de `api/`, e `app.py` na raiz faz o build falhar com `unused_function`.

`maxDuration` está em 60 segundos. A busca em si para por volta de 40 segundos e devolve o que já tiver (JSON), em vez de esperar o Overpass estourar o limite da função. Overpass usa `timeout:8` e no máximo ~10 s por espelho. A checagem de domínio é opcional e, quando ligada, cabe em cerca de 8 segundos e em no máximo 8 comércios sem site.

O filesystem da função é somente leitura. Buscas novas são gravadas em `/tmp/pinguim/<termo>_<cidade>_<data>.json` e em `/tmp/pinguim/latest.json`. Isso some quando a instância recicla. Os JSON em `data/` são amostras somente leitura, incluídas no deploy, e continuam em `GET /api/resultados`.

## Fontes

- **Primária:** Google Places API (New) Text Search (`places:searchText`, até 3 páginas × 20). Field mask: id, displayName, formattedAddress, internationalPhoneNumber, nationalPhoneNumber, websiteUri, googleMapsUri, rating, location, primaryType, nextPageToken. Chave em `GOOGLE_PLACES_API_KEY`. Resultados fora do bbox da cidade são descartados. Se o tempo acabar, a paginação para e o aviso vai em `erros`.
- OSM = fallback/complemento; dedupe por nome normalizado. Campo `fonte`: `google_places` | `osm` | `google_places+osm`. `avaliacao` vem do Google. O JSON traz `erros` e `resumo.por_fonte`.
- Nominatim (geocodificação da cidade, 1 req/s, User-Agent próprio).
- Overpass API, nesta ordem, parando na primeira resposta utilizável: `overpass-api.de`, `overpass.openstreetmap.fr`, `overpass.osm.ch`, `overpass.kumi.systems`. Cada tentativa usa no máximo ~10 s. Uma resposta HTTP 200 sem data OSM (espelho vazio ou `remark` de erro) não conta. Termos em pt-BR mapeados para tags OSM (`CATEGORIAS` em `app.py`); qualquer outro termo vira busca por nome (regex, só POIs).
- Domínios (só com `dominios=true`, e só para quem não tem site): DNS (A/NS, 1,5 s) + RDAP (`rdap.registro.br` para `.com.br`, `rdap.org` para `.com`) + HTTP/HTTPS em paralelo, com orçamento de ~8 s.

## Schema JSON

`/tmp/pinguim/<termo>_<cidade>_<data>.json` e `/tmp/pinguim/latest.json` na hora da busca. Amostras antigas em `data/`. Consumido por Leão, Gato, Abelha, Tigre, Aranha.

```
{ "schema": "pinguim/v1", "gerado_em": ISO8601,
  "consulta": {"termo","cidade","cidade_resolvida","bbox":[s,n,w,e],"tags_osm":[...]|null},
  "resumo": {"total","com_site","sem_site","por_fonte":{"google_places":n,"osm":n,...}},
  "erros": ["..."],
  "resultados": [{
     "id": "node/123"|"google/...", "fonte": "google_places"|"osm"|"google_places+osm",
     "nome", "categoria", "endereco"|null, "avaliacao"|null,
     "telefone"|null, "telefone_e164": "+5569..."|null, "lat", "lon",
     "tem_site": bool, "site"|null,
     "links": {"whatsapp": "https://wa.me/55..."|null, "instagram", "instagram_fonte": "osm"|"busca",
               "google_maps", "osm"},
     "dominios": [{"dominio","registrado":bool|null,"dns":bool,"rdap":bool|null,"site_ativo":bool,
                   "status":"registrado"|"provavelmente livre"|"não verificado"}],
     "site_mesmo_nome": bool,
     "tags_osm": {...}|null }] }
```

A resposta HTTP inclui `arquivo` (caminho em `/tmp/pinguim/...`). O JSON salvo no disco não inclui `arquivo`. Domínios só são preenchidos quando `dominios=true`.

## Limitações

Cobertura do OSM em cidades pequenas é fraca. WhatsApp só existe se a fonte tiver telefone. O link de Instagram sem tag OSM é uma busca, não uma verificação. Resultados em `/tmp` não são um banco: outra instância da Vercel não vê a busca que esta acabou de salvar. As amostras em `data/` permanecem.
