# Issue 03 — Drill-down municipal: geo 27 UFs (mapshaper) + lazy-load

Type: AFK
Blocked by: Issue 01
Parent: PRD.md
User stories: 5, 6, 13, 14

## What to build

Detalhe por município ao selecionar uma UF, sem nunca baixar o `municipios.json` nacional (54 MB).

- Export script: pré-gerar geometria municipal **das 27 UFs** (hoje só 6 em cache), cada uma **simplificada via mapshaper**, em `data/geo/municipios/{uf}.json`; e os valores municipais em `data/map/municipios/{faixa}/{ano}/{uf}.json`.
- UI: ao clicar/selecionar uma UF no mapa estadual, lazy-load do GeoJSON e dos valores daquela UF; renderiza coroplético municipal.
- Tooltip de município com nome, região e `n_respostas`.
- Voltar para a visão estadual.

## Acceptance criteria

- [ ] Selecionar qualquer das 27 UFs carrega e pinta os municípios daquela UF.
- [ ] Nenhuma requisição baixa o `municipios.json` nacional.
- [ ] Tooltip mostra nome + região + `n_respostas`.
- [ ] Geometria simplificada (arquivos por-UF visivelmente menores que o original IBGE).
- [ ] Lazy-load: geo/valores municipais só baixam quando a UF é selecionada.

## Blocked by

- Issue 01.
