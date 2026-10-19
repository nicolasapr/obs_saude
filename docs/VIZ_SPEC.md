# Semântica dos dados e da visualização

Especificação vigente em 19/10/2026. Substitui os atalhos necessários à primeira
exportação, que tratava arquivos legados com duplicatas e colunas incompletas.

## Fontes e chaves

- PNAE: `pnaes/finais/{faixa}/PNAES_valores_{faixa}_{ano}_ajustado.xlsx`.
- Mapas SISVAN: `sisvan/anuais/{ano}/sumario_anual_habitos_{faixa_longa}.xlsx`.
- Séries: `sisvan/series/serie_mensal_{faixa_longa}.xlsx`, com sufixos
  `_por_regiao` e `_por_uf` para os outros níveis.
- Faixas: 2a4, 5a9 e Adolescentes; período: 2015–2024.
- Chave municipal: código IBGE de seis dígitos. UF deve corresponder aos dois
  primeiros dígitos. Duplicatas na fonte canônica causam erro, sem soma ou
  descarte silencioso. As malhas municipais já estão normalizadas nessa chave.

## Financiamento

A coluna é `TOTAL` para crianças e `TOTAL_EF` para adolescentes, explicitamente.
O exportador não calcula pesos demográficos, pesos de matrícula ou componentes
financeiros. Esses cálculos permanecem no ETL científico.

No município, publica o total final; no estado, soma os totais municipais antes
do arredondamento. As duas saídas são arredondadas a centavos; a soma de valores
municipais já arredondados pode diferir alguns centavos do total estadual.

Valores são nominais. O metadado `tipo_valor_fnde` registra `pago` até 2023 e
`previsto` em 2024. O mapa não incorpora a deflação ou o denominador por
matrícula do estudo analítico. Sua cobertura é a dos arquivos finais do ETL,
não necessariamente a de todos os municípios financiados pelo FNDE.

## Marcadores alimentares

São dez: três refeições principais; refeições diante da televisão; feijão;
fruta; verduras e legumes; ultraprocessados; hambúrguer e/ou embutidos; bebidas
adoçadas; macarrão instantâneo, salgadinho ou biscoito salgado; biscoito recheado,
doces ou guloseimas.

Para cada marcador:

- Município: `100 × total_que / total_all`.
- Estado: `100 × soma(total_que) / soma(total_all)`.
- Denominador nulo ou zero: ausência, e não 0%.
- Numerador zero e denominador positivo: 0% observado.
- Contagens negativas, não inteiras ou afirmativas superiores às válidas:
  exportação interrompida, sem recortar artificialmente para 0–100%.

As contagens anuais vêm diretamente dos sumários SISVAN, sem restringir a
amostra aos municípios com dados financeiros. São registros de respostas;
não se presume que sejam indivíduos distintos.

## Séries e decomposição

O percentual canônico mensal (razão de 0 a 1, arredondada a quatro casas pelo
ETL) é conferido com os contadores e multiplicado por 100. Os dez campos estão
sempre presentes no JSON. Ausência é `null`; nenhum valor é imputado na exportação.

A decomposição aditiva de período 12 exige pelo menos 24 meses no intervalo.
Somente nessa visualização, lacunas internas são interpoladas linearmente;
pontas sem observações são aparadas. A legenda informa a quantidade de meses
interpolados. Os arquivos de dados e as curvas observadas não são modificados.

## Contrato com a interface

São preservados os caminhos do catálogo, o JSON por estado e município,
os rankings, o clique no estado e o CSV. O campo histórico `n_respostas`
significa número de municípios no PNAE (1 em cada linha municipal), e soma de
respostas válidas no SISVAN. A interface usa os rótulos correspondentes.

O catálogo inclui 30 mapas estaduais financeiros e 300 alimentares, os
correspondentes arquivos municipais para 27 UFs, nove séries e as malhas locais.
Cada saída identifica `origem`; `proveniencia.json` registra os hashes SHA-256.
Os mapas usam exclusivamente as malhas locais do IBGE, sem imagens CARTO.
