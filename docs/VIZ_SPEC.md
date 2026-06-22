# VIZ_SPEC — semântica exata a reproduzir (extraída de scripts/load/viz.py)

Fonte por (faixa, ano): `PNAES_FINAIS_DIR/{faixa}/PNAES_valores_{faixa}_{ano}_ajustado.xlsx`.
O mapa do Streamlit renderiza **PNAES e SISVAN lado a lado** (não são abas/seletor de fonte).

## Controles
- Ano: 2015..2025 (default 2024).
- Faixa: `2a4`, `5a9`, `Adolescentes`.
- Hábito SISVAN: 10 strings fixas (lista `HABITOS`, com acentos):
  1. Hábito de realizar no mínimo as três refeições principais do dia
  2. Hábito de realizar as refeições assistindo à televisão
  3. Consumo de feijão
  4. Consumo de fruta
  5. Consumo de verduras e legumes
  6. Consumo de Alimentos Ultraprocessados
  7. Consumo de hambúrguer e/ou embutidos
  8. Consumo de bebidas adoçadas
  9. Consumo de macarrão instantâneo, salgadinho de pacote ou biscoito salgado
  10. Consumo de biscoito recheado, doces ou guloseimas
- Drill-down de estado: None (Brasil) ou uma UF → nível município (Issue 03).

## PNAES — métrica colorida
- Coluna: `TOTAL`, com fallback `TOTAL_EF` (`col_total = "TOTAL" if "TOTAL" in cols else "TOTAL_EF"`). `pd.to_numeric(..., errors="coerce")`.
- Estado: `groupby(["codigo_UF","UF"]).agg(valor=(col_total,"sum"), n_respostas=("codigo_IBGE","nunique"))`.
- Município (Issue 03): `groupby(["codigo_IBGE","municipio","UF","regiao"]).agg(valor=(col_total,"sum"), n_respostas=(col_total,"count"))`.
- Alguns arquivos de `Adolescentes` (2019, 2021, 2022) não têm `TOTAL` nem `TOTAL_EF` → pular com aviso.

## SISVAN — métrica colorida (percentual)
- `percentual_que_*` está CORROMPIDO (strings concatenadas). NÃO usar direto. Recomputar:
  - `sufixo = habito` ; `col_que = total_que_{sufixo}` ; `col_all = total_all_{sufixo}`.
  - `pct = (total_que / total_all * 100).clip(0,100)`.
  - Fallback `_converter_pct` (strip "%", to_numeric) só se faltarem as colunas de contagem.
- **Dedup antes de agregar**: `drop_duplicates(subset=["codigo_UF","UF","codigo_IBGE"])` (o finais tem 1-5 linhas/município, uma por programa PNAES; colunas SISVAN repetem).
- Estado (média ponderada): após dedup, `groupby(["codigo_UF","UF"]).agg(soma_que=(col_que,"sum"), soma_all=(col_all,"sum"))`; `valor = soma_que/soma_all*100` (clip 0-100); `n_respostas = int(soma_all)`.
- Município (Issue 03): após dedup, `groupby(["codigo_IBGE","municipio","UF","regiao"]).agg(valor=(col_pct,"mean"), n_respostas=(col_all,"first"))`.

## "Sem dado"
- `dropna(subset=["valor"])` após agregar (sai do df). No mapa: cor `lightgray`; tooltip `valor="N/D"`, `n_respostas="N/D"`.

## Escala de cor / legenda
- Colormap `YlOrRd`. `fill_opacity=0.75`, `line_opacity=0.2`. 6 faixas (equal-interval, default do folium). NaN = lightgray. Legenda com o label da métrica.

## Ranking (top 10)
- Estado: colunas `["UF","Estado",<label_valor>,"Respostas"]`, ordenado desc por valor. `Estado` = nome por UF. `Respostas`=int. Dois cards: "Top 10 maiores" (head 10) e "Top 10 menores" (tail 10 invertido).
- Município (Issue 03): `["Município","UF","Estado",<label>,"Respostas"]`.

## CSV export
- Exporta o `df_mapa` inteiro. Nome `mapa_{tipo}_{faixa}_{ano}.csv` (tipo: `pnaes_estados`, `sisvan_estados`, `pnaes_munic_{UF}`, `sisvan_munic_{UF}`).
- Estado: `["codigo_UF","UF","codigo","valor","n_respostas"]`. Município: `["codigo_IBGE","municipio","UF","regiao","valor","n_respostas","codigo"]`.

## Tooltips
- Estado: UF, Estado(nome), valor (`,.2f`), Respostas (`,`).
- Município: Município(nome), UF, Região, valor, Respostas.

## GeoJSON
- `estados.json`: prop única `codarea` (string 2 dígitos) — casa direto com `codigo_UF` stringificado. Sem normalização.
- `municipios` (Issue 03): `codarea` 7 dígitos → normalizar `codarea[:-1]` (6) para casar com `codigo_IBGE` (str 6). Nacional 54MB NÃO publicar; gerar por-UF e simplificar (mapshaper).
