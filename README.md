# Dashboard Estatico -- Observatorio da Saude

Dashboard puramente estatico (HTML + JS vanilla, sem backend) que consome
sumarios PNAES e SISVAN pre-gerados em JSON.  Publicavel diretamente no
GitHub Pages.

## Pre-requisitos

| Ferramenta | Para que |
|---|---|
| Python 3.10+ com venv do projeto (pandas, openpyxl) | Gerar os JSONs a partir dos sumarios `.xlsx` |
| Node.js + mapshaper (`npm install -g mapshaper`) | Simplificar GeoJSON municipal (ja foi executado; so necessario para re-gerar `geo/municipios/`) |

> A geometria municipal ja esta gerada em `data/geo/municipios/`.
> Se voce so quer publicar o dashboard, **nao precisa de Node/mapshaper**.

## Passo 1 -- Gerar os dados

Dentro da raiz do projeto (onde fica `.venv/`):

```bash
source .venv/bin/activate
python scripts/export_static_data.py
```

Isso le os sumarios finais PNAES (`dados/pnaes/finais/`) e as series
SISVAN (`dados/sisvan/series/`) e grava tudo em `dashboard-estatico/data/`:

- `manifest.json` -- metadados (faixas, anos, metricas, habitos, caminhos)
- `geo/` -- GeoJSON de estados e municipios por UF
- `map/states/` -- dados PNAES e SISVAN agregados por UF
- `map/municipios/` -- dados PNAES e SISVAN por municipio, por UF
- `series/` -- series temporais mensais

## Passo 2 -- Testar localmente

```bash
cd dashboard-estatico
python -m http.server 8000
```

Abra `http://localhost:8000` no navegador.  Verifique:

- Aba **Mapa**: selecionar faixa/ano pinta o mapa coropletico; clicar em
  um estado faz drill-down municipal.
- Aba **Series Temporais**: selecionar faixa e habito mostra grafico de
  linhas mensais. **Ano inicial/final** recortam o periodo (ex.: 2018-2022)
  e filtram tanto o grafico quanto a decomposicao. Abaixo, a secao
  **Decomposicao** exibe tendencia +
  sazonalidade + residuo (modelo aditivo, periodo=12), calculada no
  navegador a partir da serie carregada (>= 24 meses).

## Passo 3 -- Publicar no GitHub Pages

1. Crie um repositorio no GitHub (pode ser o mesmo repo do projeto ou um
   repo dedicado).

2. Faca push do conteudo:

   ```bash
   git add dashboard-estatico/
   git commit -m "feat: dashboard estatico para publicacao"
   git push origin main
   ```

3. No GitHub, va em **Settings > Pages**:
   - Source: **Deploy from a branch**
   - Branch: `main`
   - Folder: `/dashboard-estatico`  (ou `/docs` se voce copiar o conteudo
     para `docs/`)
   - Clique **Save**.

4. Apos 1-2 minutos o site estara disponivel em
   `https://<usuario>.github.io/<repo>/`.

> **Nota:** Os pipelines de transform/extract continuam offline e intocados.
> Dados brutos (`.xlsx`, `.csv` do SISVAN) **nao** vao para o site --
> apenas os JSONs pre-gerados em `data/`.

## Tamanho do `data/` gerado

| Metrica | Valor |
|---|---|
| Arquivos JSON | 9.221 |
| Tamanho bruto | 93 MB |
| Tamanho gzip (soma per-file) | 18 MB |
| Razao de compressao | ~20% |
| Limite GitHub Pages | 1 GB por repositorio |

O GitHub Pages serve com `Content-Encoding: gzip` automaticamente, entao o
trafego real sera proximo de **18 MB**.

## Stack

- **Leaflet 1.9.4** (CDN, SRI pinned) -- mapas coropleticos
- **Plotly.js 2.35.3** (CDN, versao pinned) -- series temporais
- HTML + CSS + JS vanilla, sem build step, sem framework
