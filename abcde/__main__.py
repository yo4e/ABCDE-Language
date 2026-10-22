"""Run from the checkout: python3 -m abcde --help."""

import argparse
import json
import sys

from .interpreter import EXAMPLES, analyze, reverse


def display(result):
    print("ABCDE " + result["language_version"] + " | " + result["status"])
    if "matches" in result:
        if not result["matches"]:
            print(result["note"]["ja"] + " / " + result["note"]["en"])
            print("See: python3 -m abcde --phrases")
        for match in result["matches"]:
            print("→ " + match["abcde"])
            print("条件 / Assumptions: " + match["assumptions"]["ja"] + " / " + match["assumptions"]["en"])
            display(match["analysis"])
        return
    for note in result.get("diagnostics", []):
        print("! " + note["code"] + ": " + note["ja"] + " / " + note["en"])
    for sentence in result["sentences"]:
        print("\n" + str(sentence["line"]) + ": " + sentence["input"] + " [" + sentence["status"] + "]")
        if sentence["status"] != "invalid":
            print("mood=" + sentence["mood"] + "; tense=" + sentence["tense"])
        for term in sentence.get("terms", []):
            print("  " + term["surface"] + " = " + (" + ".join(term["atoms"]) or "[external]"))
            print("    直訳: " + term["literal"]["ja"] + " / " + term["literal"]["en"])
            if term["base_readings"]:
                readings = " | ".join(x["ja"] + " / " + x["en"] for x in term["base_readings"])
                print("    基本語の慣用候補（数量・否定を適用する前） / base readings: " + readings)
                print("    " + term["convention_note"]["ja"] + " / " + term["convention_note"]["en"])
        for index, interpretation in enumerate(sentence.get("interpretations", []), 1):
            print("  構造 " + str(index) + ": " + interpretation["literal"]["ja"])
            print("  Structure " + str(index) + ": " + interpretation["literal"]["en"])
        relation = sentence.get("relation")
        if relation:
            print("  E: 関係の種類は未指定 / relation type unspecified")
            for candidate in relation["candidates"]:
                print("    慣用の時間候補 / time candidate: " + candidate["quantity"] + " days " + candidate["direction"] + " " + candidate["anchor"])
                print("    " + candidate["note"]["ja"] + " / " + candidate["note"]["en"])
        for candidate in sentence.get("translation_candidates", []):
            print("  慣用の文候補: " + candidate["ja"] + " / " + candidate["en"])
            print("    条件 / Assumptions: " + candidate["assumptions"]["ja"] + " / " + candidate["assumptions"]["en"])
        for note in sentence["diagnostics"]:
            print("  ! " + note["code"] + ": " + note["ja"] + " / " + note["en"])


def main(argv=None):
    parser = argparse.ArgumentParser(description="ABCDE: structural glosses and explicit conventional candidates; no API required.")
    parser.add_argument("text", nargs="?", help="Input text; reads stdin if omitted. Quote spaces in the shell.")
    parser.add_argument("--from", dest="source", choices=("abcde", "ja", "en"), default="abcde")
    parser.add_argument("--json", action="store_true", help="Machine-readable output.")
    parser.add_argument("--core-only", action="store_true", help="Suppress lexical, phrase, and time conventions.")
    parser.add_argument("--phrases", action="store_true", help="List all supported reverse-translation inputs.")
    args = parser.parse_args(argv)
    if args.core_only and args.source != "abcde":
        parser.error("--core-only applies only to ABCDE input; reverse lookup requires conventions")
    if args.phrases:
        phrases = [{"abcde": e["abcde"], **e["reverse"]} for e in EXAMPLES if any(e["reverse"].values())]
        if args.json:
            print(json.dumps(phrases, ensure_ascii=False, indent=2))
        else:
            for phrase in phrases:
                print(phrase["abcde"] + " ← " + " | ".join(phrase["ja"] + phrase["en"]))
        return 0
    text = args.text if args.text is not None else sys.stdin.read()
    result = analyze(text, conventions=not args.core_only) if args.source == "abcde" else reverse(text, args.source)
    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        display(result)
    return 2 if result["status"] in ("invalid", "unsupported") else 0


if __name__ == "__main__":
    raise SystemExit(main())
