"""Conformance, meaning-preservation regressions, shared-data and CLI checks."""

import itertools
import json
import random
import re
import subprocess
import sys
import unittest
from pathlib import Path

from abcde import analyze, reverse
from abcde.interpreter import ATOMS, EXAMPLES, LANGUAGE, MAX_INPUT, atomize, normalize_phrase
from tools.build_docs import render_all

ROOT = Path(__file__).resolve().parents[1]
CORPUS = json.loads((ROOT / "tests/conformance.json").read_text(encoding="utf-8"))


def first(text, **kwargs):
    return analyze(text, **kwargs)["sentences"][0]


def codes(result):
    return {d["code"] for d in result.get("diagnostics", [])}


def surface_roles(sentence):
    return [{role: None if index is None else sentence["terms"][index]["surface"]
             for role, index in interpretation["roles"].items()}
            for interpretation in sentence["interpretations"]]


class ConformanceTests(unittest.TestCase):
    def test_accepted_corpus(self):
        for case in CORPUS["accepted"]:
            with self.subTest(input=case["input"]):
                result = analyze(case["input"])
                self.assertEqual(case["status"], result["status"])
                sentence = result["sentences"][0]
                for field in ("kind", "mood", "tense"):
                    if field in case:
                        self.assertEqual(case[field], sentence[field])
                if "roles" in case:
                    self.assertEqual(case["roles"], surface_roles(sentence))
                if "time" in case:
                    times = sentence["relation"]["candidates"]
                    self.assertEqual([] if case["time"] is None else [case["time"]],
                                     [candidate["direction"] for candidate in times])
                self.assertTrue(set(case.get("diagnostics", [])) <= codes(sentence))

    def test_invalid_corpus(self):
        for case in CORPUS["invalid"]:
            with self.subTest(input=case["input"]):
                result = analyze(case["input"])
                self.assertEqual("invalid", result["status"])
                diagnostics = codes(result) | {d["code"] for s in result["sentences"] for d in s["diagnostics"]}
                self.assertIn(case["code"], diagnostics)
                self.assertTrue(all(not s.get("translation_candidates") for s in result["sentences"]))

    def test_exactly_eight_prefix_free_atoms(self):
        self.assertEqual({"A", "E", "BA", "BE", "CA", "CE", "DA", "DE"}, set(ATOMS))
        for left, right in itertools.permutations(ATOMS, 2):
            self.assertFalse(right.startswith(left))

    def test_all_compounds_up_to_four_atoms_preserve_structure(self):
        # Independent token sequences are encoded then decoded; no dictionary segmentation.
        for length in range(1, 5):
            for sequence in itertools.product(ATOMS, repeat=length):
                self.assertEqual(list(sequence), atomize("".join(sequence)))

    def test_unknown_compound_is_not_invalid_or_guessed(self):
        sentence = first("BACEDA")
        self.assertEqual("valid", sentence["status"])
        term = sentence["terms"][0]
        self.assertEqual(["BA", "CE", "DA"], term["atoms"])
        self.assertEqual(["BA", "CE"], term["modifiers"])
        self.assertEqual("DA", term["head"])
        self.assertEqual([], term["base_readings"])
        self.assertEqual([], sentence["translation_candidates"])

    def test_unknown_compounds_are_not_segmented_by_known_subwords(self):
        term = first("CECADA")["terms"][0]
        self.assertEqual(["CE", "CA", "DA"], term["atoms"])
        self.assertNotIn("food", term["literal"]["en"])
        self.assertNotIn("eat", term["literal"]["en"])

    def test_line_boundaries_and_partial_failure(self):
        result = analyze("BA CEDA BE\r\n\r\nBADX\nBE CEDA BA\n")
        self.assertEqual("invalid", result["status"])
        self.assertEqual([1, 3, 4], [s["line"] for s in result["sentences"]])
        self.assertEqual(["valid", "invalid", "valid"], [s["status"] for s in result["sentences"]])

    def test_external_label_is_opaque_and_preserves_inner_spaces(self):
        sentence = first("[New  York] CEDA [東京]")
        self.assertEqual("[New  York]", sentence["terms"][0]["body"])
        for term in (sentence["terms"][0], sentence["terms"][2]):
            self.assertEqual([], term["atoms"])
            self.assertEqual([], term["base_readings"])
            self.assertIsNone(term["head"])

    def test_external_labels_cannot_hide_controls_or_newlines(self):
        for text in ("[New\nYork]", "[x\u0085y]", "[x\u2028y]", "[x\u2029y]", "[x\ty]"):
            with self.subTest(text=text):
                self.assertEqual("invalid", analyze(text)["status"])

    def test_bounded_input_and_no_crashes_on_malformed_text(self):
        self.assertIn("INPUT_LIMIT", codes(analyze("A" * (MAX_INPUT + 1))))
        self.assertNotEqual("invalid", analyze("A" * MAX_INPUT)["status"])
        rng = random.Random(42)
        alphabet = "ABCDEabc03-!?[] \n\t。水"
        for _ in range(300):
            text = "".join(rng.choice(alphabet) for _ in range(rng.randrange(1, 100)))
            result = analyze(text)
            self.assertIn(result["status"], ("valid", "ambiguous", "invalid"))


class MeaningTests(unittest.TestCase):
    def test_water_does_not_mean_move_or_blue(self):
        water = reverse("水がほしい")["matches"][0]
        self.assertEqual("BACE ADACA", water["abcde"])
        self.assertEqual([{"subject": None, "predicate": "BACE", "object": "ADACA"}],
                         surface_roles(water["analysis"]["sentences"][0]))
        term = water["analysis"]["sentences"][0]["terms"][1]
        self.assertEqual("CA", term["head"])
        self.assertEqual(["water"], [r["en"] for r in term["base_readings"]])
        motion = first("ADA")["terms"][0]
        self.assertEqual(["move/go"], [r["en"] for r in motion["base_readings"]])

    def test_japanese_omission_is_not_english_explicit_speaker(self):
        omitted = reverse("水がほしい")["matches"][0]["analysis"]["sentences"][0]
        explicit = reverse("I want water", "en")["matches"][0]["analysis"]["sentences"][0]
        self.assertIsNone(surface_roles(omitted)[0]["subject"])
        self.assertEqual("BA", surface_roles(explicit)[0]["subject"])

    def test_eat_negation_survives_reverse_translation(self):
        match = reverse("食べないで")["matches"][0]
        sentence = match["analysis"]["sentences"][0]
        self.assertEqual("A! DE-CECADA", match["abcde"])
        self.assertTrue(sentence["terms"][0]["negated"])
        self.assertTrue(sentence["terms"][0]["literal"]["en"].startswith("NOT("))
        self.assertEqual("emphasis", sentence["mood"])
        self.assertIn("EMPHASIS_NOT_COMMAND", codes(sentence))
        self.assertEqual({"subject": None, "predicate": "DE-CECADA", "object": None}, surface_roles(sentence)[0])

    def test_generic_help_keeps_both_participants_unspecified(self):
        result = reverse("助けて")
        self.assertEqual("supported", result["status"])
        self.assertEqual(1, len(result["matches"]))
        match = result["matches"][0]
        self.assertEqual("A! CEDA", match["abcde"])
        sentence = match["analysis"]["sentences"][0]
        self.assertEqual([{"subject": None, "predicate": "CEDA", "object": None}], surface_roles(sentence))
        self.assertEqual(["CEDA"], [term["surface"] for term in sentence["terms"]])
        self.assertEqual("emphasis", sentence["mood"])
        self.assertTrue({"UNSPECIFIED_SUBJECT", "UNSPECIFIED_OBJECT", "EMPHASIS_NOT_COMMAND"} <= codes(sentence))
        candidate = sentence["translation_candidates"][0]
        self.assertEqual("help_unspecified", candidate["id"])
        self.assertEqual(match["assumptions"], candidate["assumptions"])
        self.assertIn("依頼として読む慣用", candidate["assumptions"]["ja"])
        self.assertIn("An emphatic assertion is also possible", candidate["assumptions"]["en"])

    def test_help_beneficiaries_are_distinct(self):
        me = reverse("私を助けて")["matches"][0]["analysis"]["sentences"][0]
        other = reverse("あの人を助けて")["matches"][0]["analysis"]["sentences"][0]
        self.assertEqual("BA", surface_roles(me)[0]["object"])
        self.assertEqual("BEBACA", surface_roles(other)[0]["object"])
        self.assertIsNone(surface_roles(other)[0]["subject"])

    def test_swapping_participants_changes_roles(self):
        forward = surface_roles(first("BA CEDA BE"))[0]
        backward = surface_roles(first("BE CEDA BA"))[0]
        self.assertNotEqual(forward, backward)
        self.assertEqual(forward["subject"], backward["object"])

    def test_return_offset_and_omissions_survive(self):
        match = reverse("3 日後に戻る")["matches"][0]
        sentence = match["analysis"]["sentences"][0]
        self.assertEqual("A- EADA E 3ACA", match["abcde"])
        self.assertEqual({"subject": None, "predicate": "EADA", "object": None}, surface_roles(sentence)[0])
        time = sentence["relation"]["candidates"][0]
        self.assertEqual(("3", "day", "after", "utterance", "relative_days"),
                         tuple(time[k] for k in ("quantity", "unit", "direction", "anchor", "basis")))
        self.assertEqual("unspecified", sentence["relation"]["kind"])

    def test_lexical_e_is_not_past(self):
        for text in ("E", "EADA", "BA EADA E 3ACA"):
            self.assertEqual("unmarked", first(text)["tense"])
        self.assertEqual("past", first("E- BA EADA E 3ACA")["tense"])

    def test_no_automatic_return_from_movement(self):
        sentence = first("A- BA ADA ACA E 3ACA")
        self.assertEqual(["move/go"], [r["en"] for r in sentence["terms"][1]["base_readings"]])
        self.assertFalse(any("return" in c["en"] for c in sentence["translation_candidates"]))

    def test_aca_polysemy_stays_visible(self):
        for text in ("ACA", "3ACA"):
            term = first(text)["terms"][0]
            self.assertEqual(["day", "here", "red"], [r["en"] for r in term["base_readings"]])

    def test_dede_is_not_small_and_legacy_egg_is_not_guessed(self):
        bad = first("DEDE")["terms"][0]
        self.assertFalse(bad["negated"])
        self.assertEqual(["very bad"], [r["en"] for r in bad["base_readings"]])
        eggs = first("5DEDECECA")
        self.assertEqual([], eggs["terms"][0]["base_readings"])
        self.assertIn("LEGACY_READING", codes(eggs))
        self.assertIn("UNKNOWN_COMPOUND", codes(eggs))

    def test_negation_scopes_over_count_and_is_not_lexical_de(self):
        term = first("DE-3BACA")["terms"][0]
        self.assertEqual("3", term["count"])
        self.assertTrue(term["literal"]["en"].startswith("NOT(3 × "))
        self.assertTrue(first("DE-CE")["terms"][0]["negated"])
        self.assertFalse(first("DECE")["terms"][0]["negated"])

    def test_no_sun_warming_or_want_invention(self):
        self.assertEqual("invalid", analyze("CEA CA DA BABA")["status"])
        generic = first("BA DA BABA")
        self.assertEqual([], generic["translation_candidates"])
        self.assertNotIn("warm", generic["interpretations"][0]["literal"]["en"])
        like = first("BA CE CECA")["translation_candidates"]
        self.assertEqual(["I like food"], [x["en"] for x in like])

    def test_core_only_suppresses_conventions_without_changing_parse(self):
        for text in ("BA BACE ADACA", "A- EADA E 3ACA", "CE DE", "A! CEDA BA", "A! CEDA"):
            with self.subTest(text=text):
                normal = first(text)
                core = first(text, conventions=False)
                self.assertEqual(normal["interpretations"], core["interpretations"])
                self.assertEqual([], core["translation_candidates"])
                self.assertTrue(all(not t["base_readings"] for t in core["terms"]))
                if core["relation"]:
                    self.assertEqual([], core["relation"]["candidates"])
        self.assertEqual("ambiguous", first("CE DE", conventions=False)["status"])

    def test_reverse_does_not_approximate_unknown_or_negative_input(self):
        for language, text in (("ja", "水はいらない"), ("ja", "私を助けないで"), ("ja", "助けないで"),
                               ("en", "I do not want water"), ("en", "Help me tomorrow"),
                               ("en", "Help me."), ("ja", "3日前に戻った")):
            with self.subTest(text=text):
                result = reverse(text, language)
                self.assertEqual("unsupported", result["status"])
                self.assertEqual([], result["matches"])

    def test_reverse_normalizes_only_documented_variation(self):
        self.assertEqual("Help me".casefold(), normalize_phrase("  HELP   ME  ", "en"))
        self.assertEqual("supported", reverse("  HELP   ME  ", "en")["status"])


class SharedDataAndCLITests(unittest.TestCase):
    def test_data_integrity_and_all_examples(self):
        ids, surfaces, aliases = set(), set(), set()
        for example in EXAMPLES:
            with self.subTest(id=example["id"]):
                self.assertNotIn(example["id"], ids)
                ids.add(example["id"])
                self.assertNotIn(example["abcde"], surfaces)
                surfaces.add(example["abcde"])
                self.assertNotEqual("invalid", analyze(example["abcde"])["status"])
                self.assertTrue(example["assumptions"]["en"] and example["assumptions"]["ja"])
                for lang in ("ja", "en"):
                    for alias in example["reverse"][lang]:
                        key = (lang, normalize_phrase(alias, lang))
                        self.assertNotIn(key, aliases)
                        aliases.add(key)
                        match = reverse(alias, lang)["matches"][0]
                        self.assertEqual(example["abcde"], match["abcde"])
                        self.assertNotEqual("invalid", match["analysis"]["status"])
        for word, entry in LANGUAGE["conventions"].items():
            self.assertTrue(atomize(word))
            self.assertTrue(entry["readings"] and entry["note"]["en"] and entry["note"]["ja"])
        self.assertEqual(22, len(EXAMPLES))

    def test_generated_docs_are_current(self):
        for name, expected in render_all().items():
            with self.subTest(file=name):
                self.assertEqual(expected, (ROOT / name).read_text(encoding="utf-8"),
                                 "Run python3 tools/build_docs.py")

    def test_local_markdown_links_exist(self):
        for path in ROOT.glob("*.md"):
            for link in re.findall(r"\]\(([^)]+)\)", path.read_text(encoding="utf-8")):
                if "://" not in link and not link.startswith("#"):
                    with self.subTest(file=path.name, link=link):
                        self.assertTrue((path.parent / link.split("#")[0]).exists())

    def run_cli(self, *args, input=None):
        return subprocess.run([sys.executable, "-m", "abcde", *args], cwd=ROOT,
                              input=input, text=True, capture_output=True, timeout=10)

    def test_cli_json_and_stdin(self):
        proc = self.run_cli("--json", input="BA CEDA BE\nBE CEDA BA\n")
        self.assertEqual(0, proc.returncode, proc.stderr)
        result = json.loads(proc.stdout)
        self.assertEqual(2, len(result["sentences"]))
        self.assertEqual("valid", result["status"])

    def test_cli_invalid_and_unsupported_exit_two(self):
        for args in (("--json", "B"), ("--json", "--from", "en", "I do not want water")):
            proc = self.run_cli(*args)
            self.assertEqual(2, proc.returncode, proc.stderr)
            self.assertIn(json.loads(proc.stdout)["status"], ("invalid", "unsupported"))

    def test_cli_reverse_lists_and_core_only_guard(self):
        proc = self.run_cli("--json", "--from", "ja", "私を助けて")
        self.assertEqual(0, proc.returncode, proc.stderr)
        self.assertEqual("A! CEDA BA", json.loads(proc.stdout)["matches"][0]["abcde"])
        phrases = self.run_cli("--phrases", "--json")
        self.assertEqual(0, phrases.returncode)
        self.assertTrue(any("水がほしい" in p["ja"] for p in json.loads(phrases.stdout)))
        self.assertEqual(2, self.run_cli("--core-only", "--from", "ja", "水がほしい").returncode)

    def test_cli_generic_help_displays_omission_and_appeal_assumptions(self):
        proc = self.run_cli("--from", "ja", "助けて")
        self.assertEqual(0, proc.returncode, proc.stderr)
        for required in ("→ A! CEDA\n", "UNSPECIFIED_SUBJECT", "UNSPECIFIED_OBJECT",
                         "EMPHASIS_NOT_COMMAND", "依頼として読む慣用", "An emphatic assertion is also possible"):
            self.assertIn(required, proc.stdout)
        self.assertNotIn("Help me", proc.stdout)

    def test_cli_human_output_shows_negation_and_assumptions(self):
        proc = self.run_cli("--from", "ja", "食べないで")
        self.assertEqual(0, proc.returncode, proc.stderr)
        for required in ("A! DE-CECADA", "NOT(", "EMPHASIS_NOT_COMMAND", "UNSPECIFIED_SUBJECT", "Assumptions"):
            self.assertIn(required, proc.stdout)


if __name__ == "__main__":
    unittest.main()
