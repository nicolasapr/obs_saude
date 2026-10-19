#!/usr/bin/env python3
"""Exporta os produtos canônicos do ETL para o dashboard, sem refazer rateios.

Uso: python scripts/export_static_data.py --source /caminho/para/dados
     python scripts/export_static_data.py --source /caminho/para/dados --check
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
from pathlib import Path
import tempfile
import unicodedata

import pandas as pd


YEARS = list(range(2015, 2025))
AGES = {"2a4": "Crianças_de_2_a_4_anos", "5a9": "Crianças_de_5_a_9_anos", "Adolescentes": "Adolescentes"}
UFS = dict(zip(
    "11 12 13 14 15 16 17 21 22 23 24 25 26 27 28 29 31 32 33 35 41 42 43 50 51 52 53".split(),
    "RO AC AM RR PA AP TO MA PI CE RN PB PE AL SE BA MG ES RJ SP PR SC RS MS MT GO DF".split(),
))
HABITS = [
    ("refeicoes_principais", "Hábito de realizar no mínimo as três refeições principais do dia", "3 Refeições/dia"),
    ("refeicoes_tv", "Hábito de realizar as refeições assistindo à televisão", "Refeição + TV"),
    ("feijao", "Consumo de feijão", "Feijão"),
    ("fruta", "Consumo de fruta", "Fruta"),
    ("verduras_legumes", "Consumo de verduras e legumes", "Verduras/Legumes"),
    ("ultraprocessados", "Consumo de Alimentos Ultraprocessados", "Ultraprocessados"),
    ("hamburguer_embutidos", "Consumo de hambúrguer eou embutidos", "Hambúrguer/Embutidos"),
    ("bebidas_adocadas", "Consumo de bebidas adoçadas", "Bebidas Adoçadas"),
    ("macarrao_salgadinho", "Consumo de macarrão instantâneo salgadinho de pacote ou biscoito salgado", "Macarrão inst./Salgadinho"),
    ("biscoito_doces", "Consumo de biscoito recheado doces ou guloseimas", "Biscoito/Doces"),
]
LABELS = {"pnaes": "Valor total PNAE nominal (R$)", "sisvan": "Percentual SISVAN (%)"}
SHORT_HABITS = [{"slug": s, "label": short} for s, _, short in HABITS]


def normalized(value: str) -> str:
    return unicodedata.normalize("NFC", str(value))


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Aceita variantes conhecidas, mas não soma colunas ambíguas do legado."""
    aliases = {
        "Consumo de macarrão instantâneo salgadinho de pacote ou bis": HABITS[8][1],
        "Hábito de realizar no mínimo as três refeições principais do": HABITS[0][1],
    }
    names = []
    for original in df.columns:
        name = normalized(original).replace("e/ou", "eou").replace("e_ou", "eou").replace(", ", " ")
        for prefix in ("total_que_", "total_all_", "percentual_que_"):
            if name.startswith(prefix):
                name = prefix + aliases.get(name[len(prefix):], name[len(prefix):])
                break
        names.append(name)
    if len(names) != len(set(names)):
        raise ValueError("Colunas colidentes após normalização; revisar a fonte canônica.")
    return df.set_axis(names, axis=1)


def numeric(series: pd.Series, label: str) -> pd.Series:
    values = pd.to_numeric(series, errors="raise")
    if values.dropna().map(lambda v: not math.isfinite(v)).any():
        raise ValueError(f"Valor não finito: {label}")
    return values


def municipality_frame(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    codes = numeric(df["codigo_IBGE"], "codigo_IBGE")
    if codes.isna().any() or (codes % 1 != 0).any() or not codes.between(100000, 999999).all():
        raise ValueError("Código municipal inválido; esperado IBGE de seis dígitos.")
    df["codigo_IBGE"] = codes.astype(int).astype(str)
    if df.codigo_IBGE.duplicated().any():
        raise ValueError("Municípios duplicados na fonte canônica; não somar programas novamente.")
    df["codigo_UF"] = df.codigo_IBGE.str[:2]
    if not df.codigo_UF.isin(UFS).all() or not df.UF.eq(df.codigo_UF.map(UFS)).all():
        raise ValueError("UF não corresponde ao código municipal.")
    for col in ("municipio", "regiao"):
        if df[col].isna().any():
            raise ValueError(f"Campo territorial ausente: {col}")
        df[col] = df[col].map(normalized)
    return df.sort_values("codigo_IBGE")


def counts(df: pd.DataFrame, habit: str) -> tuple[pd.Series, pd.Series]:
    q = numeric(df[f"total_que_{habit}"], habit)
    n = numeric(df[f"total_all_{habit}"], habit)
    invalid = q.isna().ne(n.isna()) | (q < 0) | (n < 0) | (q > n) | (q.mod(1).fillna(0) != 0) | (n.mod(1).fillna(0) != 0)
    if invalid.any():
        raise ValueError(f"Contagens inválidas: {habit}")
    return q, n


def pnae_maps(df: pd.DataFrame, age: str) -> tuple[dict, dict]:
    df = municipality_frame(df)
    column = "TOTAL_EF" if age == "Adolescentes" else "TOTAL"
    df["value"] = numeric(df[column], column)
    if df.value.isna().any() or (df.value < 0).any():
        raise ValueError(f"Total financeiro ausente ou negativo: {age}")
    states, cities = {}, {uf: {} for uf in UFS}
    for uf, group in df.groupby("codigo_UF", sort=True):
        states[uf] = {"valor": round(float(group.value.sum()), 2), "n_respostas": len(group), "uf": UFS[uf]}
        for row in group.to_dict("records"):
            cities[uf][row["codigo_IBGE"]] = {
                "municipio": row["municipio"], "regiao": row["regiao"],
                "valor": round(float(row["value"]), 2), "n_respostas": 1,
            }
    return states, cities


def sisvan_maps(df: pd.DataFrame, habit: str) -> tuple[dict, dict]:
    df = municipality_frame(df)
    df["q"], df["n"] = counts(df, habit)
    # Ausência de respostas não é prevalência zero. Nunca recortar valores inválidos.
    df = df.loc[df.n.gt(0)]
    states, cities = {}, {uf: {} for uf in UFS}
    for uf, group in df.groupby("codigo_UF", sort=True):
        states[uf] = {
            "valor": round(float(group.q.sum() / group.n.sum() * 100), 2),
            "n_respostas": int(group.n.sum()), "uf": UFS[uf],
        }
        for row in group.to_dict("records"):
            cities[uf][row["codigo_IBGE"]] = {
                "municipio": row["municipio"], "regiao": row["regiao"],
                "valor": round(float(row["q"] / row["n"] * 100), 2), "n_respostas": int(row["n"]),
            }
    return states, cities


def monthly_series(df: pd.DataFrame, age: str, level: str) -> dict:
    df = df.copy()
    for col in ("ano", "mes"):
        values = numeric(df[col], col)
        if values.isna().any() or (values % 1 != 0).any():
            raise ValueError(f"Data mensal inválida: {col}")
        df[col] = values.astype(int)
    if not df.ano.isin(YEARS).all() or not df.mes.between(1, 12).all():
        raise ValueError("Série fora do período 2015–2024 ou mês inválido.")
    keys = ["ano", "mes"] + (["regiao"] if level == "regiao" else ["UF"] if level == "uf" else [])
    if df.duplicated(keys).any():
        raise ValueError("Observações mensais duplicadas.")
    df = df.sort_values(keys)
    if level == "nacional" and len(df) != 120:
        raise ValueError("Série nacional não contém os 120 meses esperados.")
    result = pd.DataFrame({"mes": df.ano.astype(str) + "-" + df.mes.astype(str).str.zfill(2)}, index=df.index)
    if level == "regiao":
        result["regiao"] = df.regiao.map(normalized)
    elif level == "uf":
        if not df.UF.isin(UFS.values()).all():
            raise ValueError("UF inválida na série.")
        result["uf"] = df.UF
    for slug, habit, _ in HABITS:
        q, n = counts(df, habit)
        expected = pd.Series([round(float(a / b), 4) if pd.notna(b) and b > 0 else float("nan")
                              for a, b in zip(q, n)], index=df.index)
        pct = numeric(df[f"percentual_que_{habit}"], habit)
        if ((pct - expected).abs().gt(1e-10) | pct.isna().ne(expected.isna())).any():
            raise ValueError(f"Percentual não coincide com os contadores: {habit}")
        # Mantém a precisão publicada pelo ETL (razão com quatro casas), em %.
        result[slug] = (pct * 100).round(2)
    records = result.astype(object).where(result.notna(), None).to_dict("records")
    return {"faixa": age, "nivel": level, "habitos": SHORT_HABITS, "dados": records}


def encode(value: dict) -> str:
    return json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(",", ":")) + "\n"


class Exporter:
    def __init__(self, source: Path, target: Path, generated_at: str):
        self.source, self.target, self.generated_at = source, target, generated_at
        self.inputs, self.outputs = {}, {}

    def read(self, relative: str) -> pd.DataFrame:
        # HFS/APFS podem expor nomes em NFD; resolve sem glob ambíguo.
        wanted = self.source / relative
        matches = [p for p in wanted.parent.iterdir() if normalized(p.name) == normalized(wanted.name)]
        if len(matches) != 1:
            raise ValueError(f"Esperado um único arquivo canônico: {relative}")
        path = matches[0]
        self.inputs[relative] = hashlib.sha256(path.read_bytes()).hexdigest()
        return normalize_columns(pd.read_excel(path))

    def emit(self, relative: str, content: dict) -> None:
        text = encode(content)
        path = self.target / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
        self.outputs[relative] = hashlib.sha256(text.encode()).hexdigest()

    def build(self) -> None:
        manifest = {
            "gerado_em": self.generated_at, "faixas": list(AGES),
            "fontes": {source: {"metrica_label": label, "anos_por_faixa": {age: YEARS for age in AGES}}
                       for source, label in LABELS.items()},
            "geo": {"estados": "geo/estados.json", "municipios": {uf: f"geo/municipios/{uf}.json" for uf in UFS}},
            "map_states_pnaes": [], "map_states_sisvan": [],
            "municipios": {"pnaes": {}, "sisvan": {}, "path_patterns": {
                "pnaes": "map/municipios/pnaes/{faixa}/{ano}/{uf}.json",
                "sisvan": "map/municipios/sisvan/{faixa}/{ano}/{habito}/{uf}.json",
                "geo": "geo/municipios/{uf}.json"}},
            "series": {"faixas": list(AGES.values()), "niveis": ["nacional", "regiao", "uf"], "habitos": SHORT_HABITS},
            "proveniencia": "proveniencia.json",
        }
        manifest["fontes"]["sisvan"]["habitos"] = [{"slug": s, "label": h} for s, h, _ in HABITS]
        for age, long_age in AGES.items():
            manifest["municipios"]["pnaes"][age], manifest["municipios"]["sisvan"][age] = {}, {}
            for year in YEARS:
                financial = f"pnaes/finais/{age}/PNAES_valores_{age}_{year}_ajustado.xlsx"
                annual = f"sisvan/anuais/{year}/sumario_anual_habitos_{long_age}.xlsx"
                df = self.read(financial)
                states, cities = pnae_maps(df, age)
                types = sorted(df.tipo_valor_fnde.dropna().unique())
                if types != ["previsto" if year == 2024 else "pago"]:
                    raise ValueError(f"Tipo financeiro inesperado em {financial}: {types}")
                meta = {"fonte": "pnaes", "metrica_label": LABELS["pnaes"], "faixa": age,
                        "ano": year, "origem": financial, "tipo_valor_fnde": types[0],
                        "unidade_contagem": "municipios"}
                path = f"map/states/pnaes/{age}/{year}.json"
                self.emit(path, {**meta, "estados": states})
                manifest["map_states_pnaes"].append({"faixa": age, "ano": year, "path": path})
                for uf, rows in cities.items():
                    self.emit(f"map/municipios/pnaes/{age}/{year}/{uf}.json",
                              {**meta, "uf_code": uf, "municipios": rows})
                manifest["municipios"]["pnaes"][age][str(year)] = list(UFS)
                annual_df = self.read(annual)
                manifest["municipios"]["sisvan"][age][str(year)] = {}
                for slug, habit, _ in HABITS:
                    states, cities = sisvan_maps(annual_df, habit)
                    meta = {"fonte": "sisvan", "metrica_label": LABELS["sisvan"], "faixa": age,
                            "ano": year, "habito_slug": slug, "habito_label": habit, "origem": annual,
                            "unidade_contagem": "respostas_validas"}
                    path = f"map/states/sisvan/{age}/{year}/{slug}.json"
                    self.emit(path, {**meta, "estados": states})
                    manifest["map_states_sisvan"].append({"faixa": age, "ano": year, "habito": slug, "path": path})
                    for uf, rows in cities.items():
                        self.emit(f"map/municipios/sisvan/{age}/{year}/{slug}/{uf}.json",
                                  {**meta, "uf_code": uf, "municipios": rows})
                    manifest["municipios"]["sisvan"][age][str(year)][slug] = list(UFS)
                print(f"Exportado: {age}/{year}", flush=True)
            for level in manifest["series"]["niveis"]:
                suffix = "" if level == "nacional" else f"_por_{level}"
                origin = f"sisvan/series/serie_mensal_{long_age}{suffix}.xlsx"
                series = monthly_series(self.read(origin), long_age, level)
                self.emit(f"series/{level}/{long_age}.json", {**series, "origem": origin})
        self.emit("manifest.json", manifest)
        self.emit("proveniencia.json", {
            "gerado_em": self.generated_at,
            "origem_projeto": "https://github.com/nicolasapr/observatorio-da-saude",
            "snapshot": "dados-2015-2024-20261018", "exportador": "scripts/export_static_data.py",
            "fontes_sha256": self.inputs, "saidas_sha256": dict(self.outputs),
            "regras": {
                "pnaes": "TOTAL (2a4/5a9), TOTAL_EF (adolescentes); soma por UF; valores nominais, sem novo rateio.",
                "sisvan": "Sumários anuais próprios; 100 * soma(afirmativas) / soma(válidas); denominador zero é ausência.",
                "series": "Percentuais canônicos mensais * 100, conferidos com contadores; sem imputação na exportação.",
                "precisao": "Valores monetários e percentuais exportados com duas casas decimais.",
                "contagem": "n_respostas: municípios no PNAE, respostas válidas no SISVAN; não pessoas únicas.",
            },
        })


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path, help="Pasta dados do projeto científico")
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "data")
    parser.add_argument("--generated-at", help="Data ISO fixa para reprodução byte a byte")
    parser.add_argument("--check", action="store_true", help="Regenera em área temporária e compara, sem alterar saídas")
    args = parser.parse_args()
    generated = args.generated_at
    if args.check and generated is None:
        generated = json.loads((args.output / "manifest.json").read_text())["gerado_em"]
    generated = generated or datetime.now(timezone.utc).isoformat(timespec="seconds")
    for geo in ["geo/estados.json", *(f"geo/municipios/{uf}.json" for uf in UFS)]:
        if not (args.output / geo).is_file():
            raise ValueError(f"Geometria versionada não encontrada: {geo}")
    # Nenhum arquivo publicado é substituído se uma fonte falhar na validação.
    with tempfile.TemporaryDirectory(prefix="obs-saude-export-") as tmp:
        builder = Exporter(args.source.resolve(), Path(tmp), generated)
        builder.build()
        differences = []
        for relative in builder.outputs:
            staged, destination = Path(tmp) / relative, args.output / relative
            if args.check:
                if not destination.is_file() or staged.read_bytes() != destination.read_bytes():
                    differences.append(relative)
            else:
                destination.parent.mkdir(parents=True, exist_ok=True)
                destination.write_bytes(staged.read_bytes())
        if differences:
            raise SystemExit(f"{len(differences)} saídas divergentes: {differences[:10]}")
        print(f"{'Conferidos' if args.check else 'Gravados'} {len(builder.outputs)} JSONs; {len(builder.inputs)} fontes canônicas.")


if __name__ == "__main__":
    main()
