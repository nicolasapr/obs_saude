import importlib.util
from pathlib import Path
import unittest

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("exporter", ROOT / "scripts/export_static_data.py")
exporter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exporter)


def municipalities():
    return pd.DataFrame({
        "codigo_IBGE": [411210, 410690, 410480], "UF": ["PR"] * 3,
        "municipio": ["JANDAIA DO SUL", "CURITIBA", "CASCAVEL"], "regiao": ["SUL"] * 3,
    })


class ExportTests(unittest.TestCase):
    def test_adolescents_use_final_total_without_reapplying_weights(self):
        frame = municipalities()
        frame["TOTAL"] = [900, 900, 900]
        frame["TOTAL_EF"] = [100, 200, 0]
        states, cities = exporter.pnae_maps(frame, "Adolescentes")
        self.assertEqual(states["41"]["valor"], 300)
        self.assertEqual(states["41"]["n_respostas"], 3)
        self.assertEqual(cities["41"]["411210"]["valor"], 100)
        self.assertEqual(cities["41"]["410480"]["valor"], 0)

    def test_weighted_percentage_and_no_responses_is_not_zero(self):
        frame = municipalities()
        habit = exporter.HABITS[0][1]
        frame[f"total_que_{habit}"] = [9, 10, 0]
        frame[f"total_all_{habit}"] = [10, 100, 0]
        states, cities = exporter.sisvan_maps(frame, habit)
        self.assertEqual(states["41"], {"valor": 17.27, "n_respostas": 110, "uf": "PR"})
        self.assertEqual(cities["41"]["411210"]["valor"], 90)
        self.assertNotIn("410480", cities["41"])
        frame.loc[2, f"total_all_{habit}"] = 1
        _, cities = exporter.sisvan_maps(frame, habit)
        self.assertEqual(cities["41"]["410480"]["valor"], 0)

    def test_rejects_duplicate_municipalities_and_invalid_counts(self):
        frame = municipalities()
        with self.assertRaisesRegex(ValueError, "duplicados"):
            exporter.municipality_frame(pd.concat([frame, frame.iloc[[0]]]))
        habit = exporter.HABITS[0][1]
        frame[f"total_que_{habit}"] = [11, 0, 0]
        frame[f"total_all_{habit}"] = [10, 0, 0]
        with self.assertRaisesRegex(ValueError, "Contagens inválidas"):
            exporter.sisvan_maps(frame, habit)

    def test_normalizes_legacy_names_without_summing_ambiguous_columns(self):
        legacy = "total_que_Consumo de macarrão instantâneo, salgadinho de pacote ou bis"
        canonical = "total_que_" + exporter.HABITS[8][1]
        self.assertEqual(list(exporter.normalize_columns(pd.DataFrame({legacy: [5]}))), [canonical])
        with self.assertRaisesRegex(ValueError, "colidentes"):
            exporter.normalize_columns(pd.DataFrame({legacy: [5], canonical: [5]}))

    def test_monthly_export_preserves_nulls_and_checks_percentages(self):
        frame = pd.DataFrame({"ano": [2019, 2019], "mes": [1, 2], "UF": ["PR", "PR"]})
        for _, habit, _ in exporter.HABITS:
            frame[f"total_que_{habit}"] = [1, 0]
            frame[f"total_all_{habit}"] = [3, 0]
            frame[f"percentual_que_{habit}"] = [0.3333, float("nan")]
        result = exporter.monthly_series(frame, "Adolescentes", "uf")
        self.assertEqual(result["dados"][0]["feijao"], 33.33)
        self.assertIsNone(result["dados"][1]["feijao"])
        self.assertEqual(len(result["dados"][1]), 12)
        frame.loc[0, "percentual_que_" + exporter.HABITS[0][1]] = 0.9
        with self.assertRaisesRegex(ValueError, "não coincide"):
            exporter.monthly_series(frame, "Adolescentes", "uf")


if __name__ == "__main__":
    unittest.main()
