"""Structure first; lexical and phrase readings are explicitly conventional.

No network, statistical translation, or context completion is performed here.
"""

import json
import re
import unicodedata
from pathlib import Path


DATA = Path(__file__).with_name("data")
LANGUAGE = json.loads((DATA / "language.json").read_text(encoding="utf-8"))
EXAMPLES = json.loads((DATA / "examples.json").read_text(encoding="utf-8"))
ATOMS = LANGUAGE["atoms"]
GRAMMAR = LANGUAGE["grammar"]
MAX_INPUT = 8192


class ParseError(ValueError):
    def __init__(self, code, en, ja):
        super().__init__(en)
        self.diagnostic = {"code": code, "en": en, "ja": ja}


def diagnostic(code, en, ja, **details):
    return dict(code=code, en=en, ja=ja, **details)


def atomize(word):
    """The inventory is prefix-free: A/E, or B/C/D followed by A/E."""
    atoms = []
    position = 0
    while position < len(word):
        size = 1 if word[position] in "AE" else 2
        atom = word[position:position + size]
        if atom not in ATOMS:
            raise ParseError("INVALID_ATOM", "Not a sequence of the eight atoms: " + word,
                             "8アトムに分解できません: " + word)
        atoms.append(atom)
        position += size
    if not atoms:
        raise ParseError("EMPTY_WORD", "A word is required.", "語が必要です。")
    return atoms


def tokenize(line):
    """Spaces delimit words except inside one nonempty bracketed label."""
    words, current = [], []
    inside = False
    for char in line:
        if unicodedata.category(char) == "Cc" or char in "\u2028\u2029":
            raise ParseError("CONTROL_CHARACTER", "Control characters are not allowed inside a line.",
                             "行内の制御文字は使えません。")
        if char == "[":
            if inside:
                raise ParseError("NESTED_BRACKET", "External labels cannot nest.", "外部語の括弧は入れ子にできません。")
            inside = True
        elif char == "]":
            if not inside:
                raise ParseError("UNMATCHED_BRACKET", "Unexpected closing bracket.", "閉じ括弧に対応する開き括弧がありません。")
            inside = False
        if char == " " and not inside:
            if current:
                words.append("".join(current))
                current = []
        else:
            current.append(char)
    if inside:
        raise ParseError("UNCLOSED_BRACKET", "External labels must end on the same line.", "外部語の括弧は同じ行で閉じてください。")
    if current:
        words.append("".join(current))
    return words


def parse_term(surface, conventions=True):
    body = surface
    negated = body.startswith(GRAMMAR["negation"])
    if negated:
        body = body[len(GRAMMAR["negation"]):]
    count_match = re.match(r"[0-9]+", body)
    count = count_match.group() if count_match else None
    if count is not None:
        if len(count) > 1 and count.startswith("0"):
            raise ParseError("LEADING_ZERO", "Use 0 or a numeral without leading zeros.", "0 または先頭に0のない整数を使ってください。")
        body = body[len(count):]
    external = bool(re.fullmatch(r"\[[^\[\]]+\]", body))
    if external and not body[1:-1].strip():
        raise ParseError("EMPTY_EXTERNAL", "An external label cannot be blank.", "外部語は空白だけにできません。")
    atoms = [] if external else atomize(body)
    entry = LANGUAGE["conventions"].get(body) if conventions else None
    literal = {}
    for lang in ("en", "ja"):
        if external:
            gloss = ("opaque label " if lang == "en" else "不透明な外部ラベル ") + body
        else:
            gloss = ATOMS[atoms[-1]][lang]
            if len(atoms) > 1:
                gloss += "〈" + " + ".join(ATOMS[atom][lang] for atom in atoms[:-1]) + "〉"
        if count is not None:
            gloss = count + " × " + gloss
        if negated:
            gloss = ("NOT(" if lang == "en" else "否定(") + gloss + ")"
        literal[lang] = gloss
    return {
        "surface": surface, "body": body, "kind": "external" if external else "word",
        "count": count, "negated": negated, "atoms": atoms,
        "head": atoms[-1] if atoms else None, "modifiers": atoms[:-1],
        "literal": literal,
        # These are base-word readings, not translations of count or DE-.
        "base_readings": entry["readings"] if entry else [],
        "convention_note": entry["note"] if entry else None,
    }


def is_predicate(term):
    return term["count"] is None and term["head"] in GRAMMAR["predicate_heads"]


def role_literal(roles, terms):
    result = {}
    names = {"en": ("subject", "predicate", "object/target"),
             "ja": ("主語", "述語", "対象")}
    for lang in ("en", "ja"):
        unknown = "unspecified" if lang == "en" else "未指定"
        result[lang] = "; ".join(
            label + "=" + (unknown if roles[role] is None else terms[roles[role]]["literal"][lang])
            for label, role in zip(names[lang], ("subject", "predicate", "object")))
    return result


def parse_line(line, conventions=True):
    original = line
    line = GRAMMAR["shorthand"].get(line, line)
    words = tokenize(line)
    notes = []
    if line != original:
        notes.append(diagnostic("SHORTHAND", "Expanded a documented shorthand.", "規定された短縮形を展開しました。"))
    mood, tense = "unmarked", "unmarked"
    if words and words[0] in GRAMMAR["moods"]:
        mood = GRAMMAR["moods"][words.pop(0)]
    if words and words[0] in GRAMMAR["tenses"]:
        tense = GRAMMAR["tenses"][words.pop(0)]
    markers = set(GRAMMAR["moods"]) | set(GRAMMAR["tenses"])
    if any(word in markers for word in words):
        raise ParseError("MARKER_ORDER", "Use at most one mood then one tense, before the clause.",
                         "文頭に気分マーカー1個、その後に時制マーカー1個まで置けます。")
    if not words:
        raise ParseError("MISSING_BODY", "A marker requires a clause or fragment.", "マーカーの後に文または断片が必要です。")

    # Bare E is a linker in clauses, but can be inspected alone as an atom.
    reference_word = None
    if GRAMMAR["linker"] in words and len(words) > 1:
        position = words.index(GRAMMAR["linker"])
        if words.count(GRAMMAR["linker"]) != 1 or position == 0 or position != len(words) - 2:
            raise ParseError("RELATION_SHAPE", "Use one suffix E followed by exactly one reference term.",
                             "関係は文末に E と参照語1個を置きます。")
        reference_word = words[-1]
        words = words[:position]
    if len(words) > 3:
        raise ParseError("CLAUSE_LENGTH", "Use at most subject, predicate, object; join modifiers inside a word.",
                         "主語・述語・対象の最大3語です。修飾アトムは語の中につなげます。")
    terms = [parse_term(word, conventions) for word in words]
    relation = None
    if reference_word is not None:
        terms.append(parse_term(reference_word, conventions))
        relation = {"kind": "unspecified", "term": len(terms) - 1, "candidates": []}
        notes.append(diagnostic("RELATION_UNSPECIFIED", "E marks a relation, not after/before, possession, or causation.",
                                "E は関係を示すだけで、前後・所有・因果を決めません。"))
        reference = terms[-1]
        if (conventions and tense in ("future", "past") and reference["count"] is not None
                and reference["body"] == LANGUAGE["time_convention"]["unit"] and not reference["negated"]):
            relation["candidates"].append({
                "basis": LANGUAGE["time_convention"]["id"], "quantity": reference["count"],
                "unit": "day", "direction": "after" if tense == "future" else "before",
                "anchor": "utterance", "note": {lang: LANGUAGE["time_convention"][lang] for lang in ("en", "ja")},
            })

    size = len(words)
    interpretations = []
    if size == 3 and is_predicate(terms[1]):
        interpretations.append({"subject": 0, "predicate": 1, "object": 2})
    elif size == 2:
        if is_predicate(terms[1]):
            interpretations.append({"subject": 0, "predicate": 1, "object": None})
        if is_predicate(terms[0]):
            interpretations.append({"subject": None, "predicate": 0, "object": 1})
    elif size == 1 and is_predicate(terms[0]):
        interpretations.append({"subject": None, "predicate": 0, "object": None})

    fragment = size == 1 and not is_predicate(terms[0])
    if fragment and relation is not None:
        raise ParseError("RELATION_WITHOUT_CLAUSE", "A relational suffix requires a clause.", "関係の接尾部には文が必要です。")
    if not interpretations and not fragment:
        raise ParseError("NO_PREDICATE", "No canonical parse. Predicate heads are DA, CE, DE; word order is significant.",
                         "標準構文として読めません。述語の末尾は DA・CE・DE で、語順に意味があります。")

    for index, term in enumerate(terms):
        if term["kind"] == "external":
            notes.append(diagnostic("OPAQUE_EXTERNAL", "The external label is preserved without translating or typing it.",
                                    "外部語は翻訳や型の推定をせず保持します。", term=index))
        elif len(term["atoms"]) > 1 and term["body"] not in LANGUAGE["conventions"]:
            notes.append(diagnostic("UNKNOWN_COMPOUND", "Valid compound; no registered conventional reading.",
                                    "合成語として有効ですが、慣用の読みは未登録です。", term=index))
        if len(term["base_readings"]) > 1:
            notes.append(diagnostic("LEXICAL_AMBIGUITY", "Several conventional readings remain; no selection was made.",
                                    "複数の慣用読みを選ばず残しています。", term=index))
        if term["body"] in LANGUAGE["legacy"]:
            note = LANGUAGE["legacy"][term["body"]]
            notes.append(diagnostic("LEGACY_READING", note["en"], note["ja"], term=index))
        if term["negated"]:
            notes.append(diagnostic("WORD_NEGATION", "DE- negates this whole term; negation alone is not a prohibition.",
                                    "DE- はこの語全体を否定します。否定だけで禁止を意味しません。", term=index))
    if fragment:
        notes.append(diagnostic("FRAGMENT", "A term, not a proposition. No subject or predicate was invented.",
                                "命題ではなく語の断片です。主語や述語は補いません。"))
    if len(interpretations) > 1:
        notes.append(diagnostic("ROLE_AMBIGUITY", "Both S-P and P-O are possible. Supply a full S-P-O clause or context.",
                                "主語-述語と述語-対象の両方が可能です。完全な3語の文または文脈が必要です。"))
    for index, roles in enumerate(interpretations):
        for role in ("subject", "object"):
            if roles[role] is None:
                notes.append(diagnostic("UNSPECIFIED_" + role.upper(),
                                        role + " is unspecified; it is not inferred from context.",
                                        ("主語" if role == "subject" else "対象") + "は未指定です。文脈から補いません。",
                                        interpretation=index))
    if mood == "emphasis":
        notes.append(diagnostic("EMPHASIS_NOT_COMMAND", "A! marks emphasis; an appeal/command reading requires a convention and context.",
                                "A! は強調です。依頼・命令という読みには慣用と文脈が必要です。"))

    normalized = " ".join(tokenize(line))
    candidates = []
    if conventions:
        for example in EXAMPLES:
            if example["abcde"] == normalized and example["candidate"]:
                candidates.append({"basis": "survival_phrase", "id": example["id"],
                                   "en": example["en"], "ja": example["ja"], "assumptions": example["assumptions"]})
    ambiguous = any(note["code"] in ("ROLE_AMBIGUITY", "LEXICAL_AMBIGUITY") for note in notes)
    return {
        "input": original, "normalized": normalized, "status": "ambiguous" if ambiguous else "valid",
        "kind": "fragment" if fragment else "clause", "mood": mood, "tense": tense,
        "terms": terms, "relation": relation,
        "interpretations": [{"roles": roles, "literal": role_literal(roles, terms)} for roles in interpretations],
        "translation_candidates": candidates, "diagnostics": notes,
    }


def analyze(text, conventions=True):
    """Analyze newline-separated sentences; one bad line does not hide good ones."""
    result = {"language_version": LANGUAGE["version"], "conventions_enabled": conventions, "sentences": []}
    if not isinstance(text, str):
        raise TypeError("text must be a string")
    if len(text) > MAX_INPUT:
        return dict(result, status="invalid", diagnostics=[diagnostic(
            "INPUT_LIMIT", "Reference implementation limit: 8192 characters per input.", "参照実装の入力上限は8192文字です。")])
    for number, raw in enumerate(text.replace("\r\n", "\n").split("\n"), 1):
        line = raw.strip(" ")
        if not line:
            continue
        try:
            sentence = parse_line(line, conventions)
        except ParseError as error:
            sentence = {"input": line, "status": "invalid", "diagnostics": [error.diagnostic]}
        sentence["line"] = number
        result["sentences"].append(sentence)
    if not result["sentences"]:
        return dict(result, status="invalid", diagnostics=[diagnostic("EMPTY_INPUT", "Enter at least one term.", "少なくとも1語を入力してください。")])
    statuses = {sentence["status"] for sentence in result["sentences"]}
    result["status"] = "invalid" if "invalid" in statuses else "ambiguous" if "ambiguous" in statuses else "valid"
    return result


def normalize_phrase(text, language):
    text = " ".join(text.strip().split())
    return text.casefold() if language == "en" else text


def reverse(text, language="ja"):
    """Exact phrasebook lookup, with a fresh forward analysis and all assumptions."""
    if language not in ("ja", "en"):
        raise ValueError("language must be ja or en")
    normalized = normalize_phrase(text, language)
    matches = []
    for example in EXAMPLES:
        if normalized in [normalize_phrase(alias, language) for alias in example["reverse"][language]]:
            matches.append({"id": example["id"], "abcde": example["abcde"],
                            "assumptions": example["assumptions"], "analysis": analyze(example["abcde"])})
    return {"language_version": LANGUAGE["version"], "input": text, "source_language": language,
            "status": "supported" if matches else "unsupported", "matches": matches,
            "note": {"en": "Exact phrasebook lookup only. Unsupported input is not approximated.",
                     "ja": "例文帳の一致検索のみです。未対応の文を近い意味に置き換えません。"}}
