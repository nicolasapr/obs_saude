# Issue 01 — Tracer skeleton: export script + manifest + mapa estadual mínimo

Type: AFK
Blocked by: None — can start immediately
Parent: PRD.md
User stories: 1, 3, 4, 16, 17

## What to build

Primeira bala traçante end-to-end: provar o caminho completo sumário → JSON → UI, com o mínimo de dados.

- `scripts/export_static_data.py` (offline) que lê, via `scripts/config.py`, **um** recorte (uma faixa, um ano) dos sumários SISVAN/PNAES e o GeoJSON de estados, e grava em `dashboard-estatico/data/`:
  - `data/manifest.json` (com pelo menos: faixas, anos, métricas e caminhos disponíveis para esse recorte);
  - `data/geo/estados.json`;
  - `data/map/states/{faixa}/{ano}.json` (valor por UF de uma métrica).
- `dashboard-estatico/index.html` + `assets/` (vanilla JS ES modules) que: carrega `manifest.json`, carrega o GeoJSON de estados, e pinta um coroplético Leaflet das UFs pela métrica do recorte. Leaflet via CDN fixado, sem build step.

## Acceptance criteria

- [ ] `python scripts/export_static_data.py` gera `manifest.json`, `estados.json` e ao menos um `states/{faixa}/{ano}.json` sem erro.
- [ ] Abrir `index.html` via servidor estático mostra o mapa do Brasil colorido por UF.
- [ ] A UI lê do `manifest.json` (não hardcoda faixa/ano/métrica daquele recorte).
- [ ] `codarea` normalizado (7→6) onde aplicável; UFs casam com os valores.
- [ ] Nenhum dado bruto e nenhum backend envolvido.

## Blocked by

None — can start immediately.
