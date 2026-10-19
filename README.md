# Observatório da Saúde — dashboard estático

Mapas de financiamento do Programa Nacional de Alimentação Escolar (PNAE) e
marcadores de consumo alimentar do Sistema de Vigilância Alimentar e Nutricional
(SISVAN), com séries mensais de 2015 a 2024.

Site: https://nicolasapr.github.io/obs_saude/

Este repositório publica os dados derivados e a interface HTML/JavaScript.
O código de extração e transformação e o pacote de dados de origem ficam no
[projeto científico](https://github.com/nicolasapr/observatorio-da-saude).
As fórmulas financeiras são aplicadas naquele projeto. O exportador deste
repositório consome os totais finais, sem aplicar os pesos novamente.

## Reproduzir os dados

Requer Python 3.12. Instale as dependências em um ambiente virtual:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-export.txt
.venv/bin/python scripts/export_static_data.py --source /caminho/observatorio-da-saude/dados
```

A pasta de origem deve conter os produtos canônicos das três faixas e de todos
os anos de 2015 a 2024. O pacote completo está na
[Release dos dados](https://github.com/nicolasapr/observatorio-da-saude/releases/tag/dados-2015-2024-20261018).
O exportador lê 69 planilhas: 30 finais financeiros, 30 anuais SISVAN e nove
séries. Os arquivos de origem permanecem intactos.

Cada arquivo gerado identifica a sua origem relativa. O arquivo
[data/proveniencia.json](data/proveniencia.json) registra as regras e os SHA-256
dos insumos e das saídas. Para reproduzir a data dos metadados, use
`--generated-at` com o valor de `gerado_em` do manifesto. Para conferir os dados
publicados contra as fontes, sem alterar saídas:

```sh
.venv/bin/python scripts/export_static_data.py --source /caminho/observatorio-da-saude/dados --check
```

O exportador valida todas as entradas em uma área temporária antes de substituir
as saídas. Fonte ausente, duplicata municipal, contagem inválida ou percentual
mensal incompatível com os contadores interrompe a exportação.

## Testar e visualizar localmente

```sh
.venv/bin/python -B -m unittest discover -s tests -v
node tests/test_frontend.cjs
python3 -m http.server 8000 --bind 127.0.0.1
```

Abra http://127.0.0.1:8000. Confira os filtros, o clique em um estado para mostrar
municípios, os arquivos CSV e a aba de séries com decomposição.

## Como interpretar

- PNAE: valores nominais, em reais. 2015–2023 representam pagamentos; 2024
  representa valores previstos pelo FNDE. Não são valores deflacionados nem
  repasses por matrícula. A coluna de contagem indica municípios.
- SISVAN: os mapas usam os sumários anuais próprios, incluindo municípios sem
  informação financeira. Percentuais estaduais são a razão entre somas de
  respostas afirmativas e válidas, não a média dos percentuais municipais.
  Respostas somadas entre meses não representam pessoas únicas.
- Séries: os nove arquivos mensais canônicos são exportados em porcentagem.
  Ausência permanece ausência. A decomposição no navegador usa interpolação
  linear em lacunas internas e informa quantos meses foram preenchidos.
- As malhas geográficas locais são do IBGE. O mapa temático não depende de
  serviços externos de imagens de fundo nem de chaves de acesso.

As regras detalhadas estão em [VIZ_SPEC](docs/VIZ_SPEC.md), e a revisão de dados
em [Atualização de outubro de 2026](docs/ATUALIZACAO-2026-10-19.md).
Documentos antigos em `docs/issues/` registram o planejamento histórico.

## Publicar no GitHub Pages

O site é servido da raiz de `main`. Em Settings → Pages, a configuração é
Deploy from a branch, branch `main`, pasta `/ (root)`.
Um push para essa branch dispara a publicação; um commit apenas local não
atualiza o site.

O repositório inclui `index.html`, `assets/`, as malhas em `data/geo/` e os
JSONs gerados. Não é preciso publicar as planilhas ou os microdados do projeto.
