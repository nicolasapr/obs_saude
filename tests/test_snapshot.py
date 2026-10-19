import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1] / "data"


def load(path):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


class PublishedSnapshotTests(unittest.TestCase):
    def test_catalog_has_all_years_and_files(self):
        manifest = load("manifest.json")
        years = list(range(2015, 2025))
        for source in ("pnaes", "sisvan"):
            for age in manifest["faixas"]:
                self.assertEqual(manifest["fontes"][source]["anos_por_faixa"][age], years)
                for year in years:
                    for habit in ([None] if source == "pnaes" else [h["slug"] for h in manifest["fontes"][source]["habitos"]]):
                        ufs = manifest["municipios"][source][age][str(year)]
                        if habit:
                            ufs = ufs[habit]
                        for uf in ufs:
                            path = manifest["municipios"]["path_patterns"][source].format(faixa=age, ano=year, habito=habit, uf=uf)
                            self.assertTrue((ROOT / path).is_file(), path)
        self.assertEqual(len(manifest["map_states_pnaes"]), 30)
        self.assertEqual(len(manifest["map_states_sisvan"]), 300)
        for entry in manifest["map_states_pnaes"] + manifest["map_states_sisvan"]:
            self.assertTrue((ROOT / entry["path"]).is_file())

    def test_regressions_compared_with_canonical_spreadsheets(self):
        data = load("map/municipios/pnaes/Adolescentes/2024/41.json")
        self.assertEqual(data["municipios"]["411210"]["valor"], 65185.60)
        state = load("map/states/pnaes/Adolescentes/2024.json")
        self.assertEqual(state["estados"]["41"]["valor"], 33450401.21)
        series = load("series/regiao/Adolescentes.json")["dados"]
        row = next(r for r in series if r["mes"] == "2019-02" and r["regiao"] == "NORTE")
        self.assertEqual(row["refeicoes_principais"], 18.59)
        national = load("series/nacional/Adolescentes.json")["dados"]
        self.assertEqual(national[0]["macarrao_salgadinho"], 57.41)

    def test_national_series_have_all_ten_markers_and_120_months(self):
        for path in (ROOT / "series/nacional").glob("*.json"):
            data = json.loads(path.read_text())
            self.assertEqual(len(data["dados"]), 120)
            for row in data["dados"]:
                for habit in data["habitos"]:
                    self.assertIsNotNone(row[habit["slug"]])
                    self.assertTrue(0 <= row[habit["slug"]] <= 100)


if __name__ == "__main__":
    unittest.main()
