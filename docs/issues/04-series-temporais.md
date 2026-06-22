# Issue 04 — Aba Séries Temporais (Plotly.js)

Type: AFK
Blocked by: Issue 01
Parent: PRD.md
User stories: 10, 11, 12, 13

## What to build

Segunda aba do dashboard, com gráficos de linha mensais.

- Export script: emitir séries em `data/series/nacional/{faixa}.json`, `data/series/regiao/{faixa}.json`, `data/series/uf/{faixa}.json` a partir dos `serie_mensal_*.xlsx` (dados leves, ~2 MB).
- UI: aba **Séries Temporais** navegável a partir da aba Mapa (sem reload). Plotly.js via CDN fixado.
- Gráficos de linha por faixa etária; comparação entre regiões e entre UFs (seleção múltipla).
- Lazy-load: baixa só o JSON da faixa/nível selecionado.

## Acceptance criteria

- [ ] Alternar entre abas Mapa e Séries sem recarregar a página.
- [ ] Série mensal renderiza por faixa selecionada.
- [ ] Comparação região-vs-região e UF-vs-UF funciona.
- [ ] Lazy-load por seleção (não baixa todas as séries de uma vez).
- [ ] Interface em pt-BR.

## Blocked by

- Issue 01.
