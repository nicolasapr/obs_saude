# Issue 05 — Prontidão para publicação: README GH Pages, pinning, tamanho/gzip, testes

Type: AFK
Blocked by: Issues 02, 03, 04
Parent: PRD.md
User stories: 2, 16, 18, 20

## What to build

Fechar a entrega para o usuário publicar em GitHub Pages.

- `dashboard-estatico/README.md` com passo-a-passo: gerar dados (`export_static_data.py`), testar localmente, criar remote, ativar GH Pages apontando para a subpasta. Deixar claro que transform/extract permanecem offline e intocados.
- Fixar versões de Leaflet/Plotly.js no CDN (SRI quando possível).
- Medir e reportar tamanho do `data/` gerado (cru + gzip); confirmar que cabe em GH Pages.
- **Testes:**
  - Consistência `manifest.json` ↔ arquivos: todo caminho do manifest existe em `data/`, e todo JSON gerado está no manifest.
  - Schema-drift no export: colunas ausentes (ex.: adolescentes sem `TOTAL`/`TOTAL_EF`) geram erro/aviso explícito, não JSON vazio silencioso. Prior art: `tests/analysis/`.

## Acceptance criteria

- [ ] README permite a um terceiro gerar dados e publicar sem ajuda.
- [ ] Versões de Leaflet/Plotly.js fixadas.
- [ ] Tamanho do `data/` medido e dentro dos limites do GH Pages.
- [ ] Teste de consistência manifest↔arquivos passa.
- [ ] Teste de schema-drift do export passa (falha explícita em coluna ausente).
- [ ] Nenhum dado bruto ou backend no pacote publicável.

## Blocked by

- Issues 02, 03, 04.
