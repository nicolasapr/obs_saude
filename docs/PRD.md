# PRD — Dashboard Estático (Observatório da Saúde)

Status: ready-for-agent
Origem: council Opus+Codex + grill-me (sessão 2026-06-19)

## Problem Statement

O dashboard atual do projeto é um app **Streamlit** (`scripts/load/app.py`, `viz.py`, `series.py`, `catalog.py`, `extractor.py`). Streamlit é um servidor Python: exige backend rodando, `pip install` pesado e processo vivo. Por isso o pesquisador não consegue simplesmente "colocar o dashboard num servidor" barato/estático nem publicá-lo em GitHub Pages. Ele quer expor as visualizações (mapas + séries) de forma pública e gratuita, sem manter servidor e **sem** carregar dados brutos (MEC microdados 2.1 GB) nem rodar transformação/extração — apenas os **sumários** já pré-computados.

## Solution

Um **dashboard puramente estático** (HTML + JS, sem backend) numa subpasta `dashboard-estatico/`, publicável em GitHub Pages. Ele carrega apenas JSON pré-gerado a partir dos sumários existentes (SISVAN séries/anuais/historico + PNAES finais) e GeoJSON por-UF. Um script de exportação offline (`scripts/export_static_data.py`) converte os `.xlsx` dos sumários em JSON enxuto (apenas colunas plotadas) + `manifest.json`, gravando em `dashboard-estatico/data/`. A interface (pt-BR) replica as duas abas que importam: **Mapa** (coroplético estado→município, Leaflet) e **Séries Temporais** (Plotly.js). Stack: vanilla JS + Leaflet + Plotly.js via CDN fixado, **sem build step**.

## User Stories

1. Como pesquisador/autor do TCC, quero publicar o dashboard num host estático gratuito (GitHub Pages), para que qualquer pessoa veja os resultados sem eu manter servidor.
2. Como pesquisador, quero que o site carregue só sumários (não dados brutos), para que o repositório publicado fique pequeno e dentro dos limites do GH Pages.
3. Como pesquisador, quero gerar os JSON do site rodando um único script offline, para reproduzir a publicação quando os sumários mudarem.
4. Como visitante, quero ver um mapa coroplético do Brasil por estado, para comparar indicadores PNAES/SISVAN entre UFs.
5. Como visitante, quero clicar/selecionar uma UF e ver o detalhe por município, para explorar variação intra-estadual.
6. Como visitante, quero passar o mouse num município e ver tooltip com nome, região e n_respostas, para interpretar o dado pontual.
7. Como visitante, quero escolher faixa etária e ano via controles, para filtrar o mapa pelo recorte de interesse.
8. Como visitante, quero ver um ranking (tabela) de UFs/municípios pelo indicador selecionado, para identificar extremos rapidamente.
9. Como visitante, quero exportar como CSV o recorte que estou vendo, para reusar os números fora do site.
10. Como visitante, quero ver séries temporais mensais por faixa etária, para entender a evolução dos hábitos ao longo do tempo.
11. Como visitante, quero comparar séries entre regiões e entre UFs, para contrastar territórios.
12. Como visitante, quero navegar entre as abas Mapa e Séries Temporais, para alternar análises sem recarregar a página.
13. Como visitante em conexão lenta, quero que apenas o JSON do recorte selecionado seja baixado (lazy-load), para a página abrir rápido.
14. Como visitante, quero que o GeoJSON municipal seja carregado por UF sob demanda, para não baixar os 54 MB do arquivo nacional.
15. Como pesquisador, quero a interface em português, coerente com o TCC e os dados brasileiros.
16. Como mantenedor, quero o site sem etapa de build (sem npm/bundler), para conseguir editar e republicar com edição direta de arquivos.
17. Como mantenedor, quero um `manifest.json` descrevendo o que existe (faixas, anos, UFs, métricas), para a UI montar os controles dinamicamente sem hardcode.
18. Como mantenedor, quero que o script de exportação valide colunas ausentes (schema drift, ex.: arquivos de adolescentes sem `TOTAL`/`TOTAL_EF`), para falhar claramente em vez de gerar JSON quebrado.
19. Como visitante, quero estados sem informação destacados visualmente (faixa "sem dado"), para não confundir com valor zero.
20. Como pesquisador, quero deixar o pipeline transform/extract intocado, para que o dashboard estático seja só um consumidor dos sumários.

## Implementation Decisions

- **Subpasta:** `dashboard-estatico/` na raiz do projeto. Contém `index.html`, `assets/` (js/css), `data/` (JSON gerado) e `docs/` (este PRD + issues).
- **Stack:** vanilla JS (ES modules), **Leaflet** para mapa coroplético, **Plotly.js** para séries. Ambos via CDN com versão fixada (SRI quando possível). Sem React/Vite, sem bundler, sem build step.
- **Abas entregues:** apenas **Mapa** e **Séries Temporais**. Catálogo e Extração ficam **fora de escopo** (Extração depende de backend; Catálogo poderia virar leitor de manifest no futuro).
- **Script de exportação:** `scripts/export_static_data.py` (offline, fora do runtime publicado). Lê via `scripts/config.py` os sumários `.xlsx` e GeoJSON; emite JSON enxuto + `manifest.json` em `dashboard-estatico/data/`. **Pruning de colunas:** exporta apenas as colunas efetivamente plotadas/rankeadas (xlsx→JSON infla ~8x; pruning derruba para ~83 MB cru / ~5 MB gzip).
- **Layout de dados (muitos arquivos pequenos, lazy-load):**
  - `data/manifest.json` — faixas, anos, UFs, métricas, caminhos.
  - `data/map/states/{faixa}/{ano}.json` — valores por UF (nível estado).
  - `data/map/municipios/{faixa}/{ano}/{uf}.json` — valores por município de uma UF.
  - `data/series/nacional/{faixa}.json`, `data/series/regiao/{faixa}.json`, `data/series/uf/{faixa}.json` — séries mensais.
  - `data/geo/estados.json` — UFs (~978 KB).
  - `data/geo/municipios/{uf}.json` — geometria por UF, **simplificada via mapshaper**.
- **GeoJSON:** **não** publicar `municipios.json` nacional (54 MB). Pré-gerar **todas as 27 UFs** (hoje só 6 em cache) e simplificar geometria com mapshaper para reduzir tamanho. Normalizar `codarea` 7→6 dígitos para casar com `codigo_IBGE` (já feito no Streamlit, replicar).
- **Métricas no mapa:** valores PNAES (finais ajustados) e hábitos SISVAN, conforme já plotado no `viz.py` (médias ponderadas, dedup, `n_respostas`). Cálculos que hoje rodam em Python no servidor são **pré-computados** pelo export script e gravados no JSON — o cliente apenas pinta.
- **Manifesto dirige a UI:** controles (faixa/ano/UF/métrica) montados a partir do `manifest.json`, sem listas hardcoded.
- **Idioma:** pt-BR.
- **Deploy:** somente **build local** na subpasta. Não criar remote nem publicar externamente nesta entrega; deixar pronto para `git push` + ativar GH Pages (apontando para `dashboard-estatico/`). Incluir `README` curto com o passo de publicação.

## Testing Decisions

- Testar **comportamento externo**, não implementação. Dois alvos principais:
  1. **`export_static_data.py`** (Python, seam = função de exportação): dado um diretório de sumários de fixture, produz JSON com o schema esperado; valida que colunas ausentes (ex.: adolescentes sem `TOTAL_EF`) geram erro/aviso explícito, não JSON silenciosamente vazio. Prior art: `tests/analysis/` já existe no repo.
  2. **`manifest.json` ↔ arquivos de dados** (teste de consistência): todo caminho referenciado no manifest existe em `dashboard-estatico/data/`, e todo JSON gerado está referenciado no manifest. Cobre o lazy-load sem precisar de browser.
- Para a UI JS: verificação manual/leve (carregar `index.html` via `file://` ou servidor estático e confirmar que mapa e séries renderizam, lazy-load dispara por seleção). Sem framework de teste JS nesta entrega (mantém "sem build step").

## Out of Scope

- Aba **Extração** (depende de backend/subprocess) e aba **Catálogo** (vira, no máximo, leitor de manifest no futuro).
- Pipelines de **transformação** e **extração** — permanecem offline e intocados.
- Carregar **dados brutos** (MEC microdados 2.1 GB, PNAES pré-ajustado).
- `municipios.json` nacional (54 MB).
- Configurar remote git, criar repositório no GitHub e publicar de fato (o usuário fará o push e ativará GH Pages).
- Backend, API, autenticação.
- Frameworks JS / bundlers / etapa de build.

## Further Notes

- Subestimar o tamanho do JSON é o maior risco: `.xlsx` já é comprimido; sem pruning de colunas o payload estoura. Medir tamanho gerado e gzip ao final.
- Schema drift entre faixas (adulto/criança/adolescente) é real — o export script deve normalizar e validar.
- gzip do GH Pages reduz muito o transferido; ainda assim priorizar lazy-load por seleção.
- Pinar versões de Leaflet/Plotly.js no CDN para reprodutibilidade do TCC.
