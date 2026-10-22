"""Shared differential corpus for Node and real-browser JavaScript engines."""
import itertools
import json
from pathlib import Path
import random
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from abcde.interpreter import ATOMS, EXAMPLES, LANGUAGE, analyze, reverse  # noqa: E402


def cases():
    result = []

    def add(text, source="abcde", conventions=True):
        result.append({"text": text, "source": source, "conventions": conventions})

    corpus = json.loads((ROOT / "tests/conformance.json").read_text(encoding="utf-8"))
    for case in corpus["accepted"] + corpus["invalid"]:
        for conventions in (True, False):
            add(case["input"], conventions=conventions)
    for size in range(1, 5):
        for atoms in itertools.product(ATOMS, repeat=size):
            add("".join(atoms))
    for example in EXAMPLES:
        add(example["abcde"])
        add(example["abcde"], conventions=False)
        for source, aliases in example["reverse"].items():
            for alias in aliases:
                add(alias, source)
                add(" \t" + alias.upper().replace(" ", "\u3000\u00a0") + "\n", source)
    # Grammar combinations include role inversions, markers, counted and negated
    # words, relation suffixes, shorthand, and opaque labels.
    words = ["BA", "BE", "CEDA", "CE", "DE", "ADACA", "DE-CECADA", "3ACA", "[a b]"]
    for size in range(1, 4):
        for terms in itertools.product(words, repeat=size):
            add(" ".join(terms))
    for prefix in ("", "A! ", "E? ", "E- ", "A- ", "A! A- ", "A- A! "):
        for clause in ("EADA", "BA CEDA BE", "CE DE", "ADACA", "DE-CECADA", "CE!"):
            for suffix in ("", " E 3ACA", " E DE-3ACA", " E [now]", " E", " E 3ACA E BA"):
                add(prefix + clause + suffix)
    for word in LANGUAGE["conventions"]:
        for modifier in ("", "DE-", "0", "9007199254740993", "DE-3"):
            add(modifier + word, conventions=False)
    for number in list(range(160)) + [0x1680, 0x2000, 0x2028, 0x2029, 0x202f, 0x3000, 0xfeff, 0x1f30a]:
        char = chr(number)
        for text in ("[" + char + "]", "BA" + char + "CEDA", "I" + char + "want" + char + "water"):
            add(text, "en" if text.startswith("I") else "abcde")
    for text in ("", " \n ", "CE!", "DE!", "BACE ADACA\r\nAB\n\nA! CEDA", "A" * 8192, "A" * 8193,
                 "[" + "🌊" * 8190 + "]", "[" + "🌊" * 8191 + "]", "[<script>alert(1)</script>]", "__proto__", "constructor"):
        add(text)
    for text in ("助けないで", "水はいらない", "助けて！", "Help", "help that perſon", "HELP ME", "I DON'T WANT WATER", "\ufeffHelp me"):
        for source in ("ja", "en"):
            add(text, source)
    rng = random.Random(220610)
    alphabet = "ABCDE abcde!?-[]0129\t\r\n水🌊\x00\u00a0"
    for _ in range(1000):
        add("".join(rng.choice(alphabet) for _ in range(rng.randrange(1, 100))))
    return result


def expected(case):
    return (analyze(case["text"], case["conventions"]) if case["source"] == "abcde"
            else reverse(case["text"], case["source"]))


if __name__ == "__main__":
    corpus = cases()
    print(json.dumps({"cases": corpus, "expected": [expected(case) for case in corpus]}, ensure_ascii=True))
