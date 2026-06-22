# Issue 02 — Mapa estadual completo: controles, ranking, CSV, "sem dado"

Type: AFK
Blocked by: Issue 01
Parent: PRD.md
User stories: 4, 7, 8, 9, 15, 17, 19

## What to build

Expandir o tracer para o mapa estadual completo, dirigido pelo manifest.

- Export script passa a emitir **todas** as faixas/anos/métricas plotadas no nível estado (`data/map/states/{faixa}/{ano}.json`), com **pruning de colunas** (só o que é plotado/rankeado). Cálculos PNAES/SISVAN (médias ponderadas, dedup, `n_respostas`) pré-computados no Python e gravados no JSON.
- UI: controles (faixa / ano / métrica) montados a partir do `manifest.json`; ao trocar seleção, lazy-load do JSON correspondente e repintura.
- Tabela de **ranking** das UFs pela métrica selecionada.
- Botão **exportar CSV** do recorte visível.
- UFs sem dado destacadas com faixa visual "sem dado" (distinta de zero).
- Interface em pt-BR.

## Acceptance criteria

- [ ] Trocar faixa/ano/métrica atualiza o mapa baixando só o JSON do recorte.
- [ ] Ranking reflete a métrica/recorte atual.
- [ ] CSV exportado bate com o que está no mapa/tabela.
- [ ] UFs sem dado aparecem com estilo "sem dado", não como zero.
- [ ] Controles vêm do manifest (sem listas hardcoded).

## Blocked by

- Issue 01.
