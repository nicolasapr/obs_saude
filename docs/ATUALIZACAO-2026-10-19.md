# Atualização dos dados — 19/10/2026

A publicação anterior usava um catálogo gerado em 20/06/2026. Esta atualização
exporta os produtos canônicos do snapshot científico de outubro de 2026.

## Correções verificadas

| Recorte | Publicação anterior | Exportação atual |
|---|---:|---:|
| PNAE adolescente, Jandaia do Sul, 2024 | R$ 67.508,23 | R$ 65.185,60 |
| PNAE adolescente, Paraná, 2024 | R$ 60.207.869,80 | R$ 33.450.401,21 |
| PNAE adolescente, 2019, 2021 e 2022 | Ausentes | Incluídos |
| Três refeições, adolescentes, Norte, fev/2019 | Ausente | 18,59% |
| Macarrão/salgadinho, adolescentes, Brasil, jan/2015 | Ausente | 57,41% |

As diferenças financeiras refletem os totais finais atuais do projeto. Não
houve redefinição de fórmulas de rateio nesta atualização. Os mapas SISVAN
passam a usar os sumários anuais próprios, sem a restrição da antiga junção
com as planilhas financeiras. A população de registros dos dois mapas pode
ser diferente; isso é esperado e está documentado.

## Rastreabilidade e verificação

O exportador lê 69 planilhas e produz 9.251 JSONs, incluindo manifesto e
proveniência. Os 28 arquivos geográficos são preservados. Foram removidas 27
cópias financeiras antigas em `data/map/states/{faixa}/`, não referenciadas pelo
catálogo; elas continuam recuperáveis no histórico Git.

Os testes cobrem ponderação por respostas, uso de TOTAL_EF, manutenção de zero
observado, ausência de resposta, rejeição de duplicatas/contagens inválidas,
normalização dos nomes, integridade dos caminhos e exemplos confrontados com
as planilhas. A opção `--check` regenera as saídas em área temporária e compara
os bytes com os arquivos versionados.

Resultado da execução: oito testes Python aprovados, testes das funções
JavaScript aprovados e 9.251 saídas reproduzidas byte a byte com `--check`.
Os 9.279 JSONs do repositório (incluindo 28 malhas) foram lidos sem erros;
os 865.469 registros municipais dos mapas encontraram código na geometria
correspondente. A inspeção no navegador confirmou o mapa adolescente de 2019,
a abertura municipal do Paraná e a renderização das séries e da decomposição.

A interface distingue municípios de respostas válidas, informa a interpolação
da decomposição e usa as malhas locais para eliminar o erro de chave do fundo
dos mapas. Os arquivos exportados não contêm interpolação.

## Limites

Esta atualização valida a publicação contra o snapshot processado. Não é uma
nova coleta das fontes oficiais, nem uma revalidação integral dos relatórios
brutos. Dados financeiros são nominais; 2024 registra valores previstos.
