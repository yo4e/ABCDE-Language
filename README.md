# ABCDE Language

**Eight semantic atoms. Five letters. No inflection.**

ABCDE / アベケデ `[a.be.ke.de]` is an experimental minimal language for basic
connection, survival and mutual aid. This v1 review draft separates what atoms
say from what people conventionally mean. It includes a small offline
Japanese/English reference interpreter.

[日本語](README_JP.md) · [Specification](specification.md) ·
[Dictionary](dictionary.md) · [Examples](examples.md) · [Migration](migration.md)

## The eight atoms

<!-- BEGIN GENERATED: atoms -->

| Atom | IPA | Core field | 意味の核 |
| --- | --- | --- | --- |
| `A` | [a] | motion/change | 動き・変化 |
| `E` | [e] | relation | 関係 |
| `BA` | [ba] | self/source | 自己・起点 |
| `BE` | [be] | other/target | 他者・対象 |
| `CA` | [ka] | entity/matter | 存在・物 |
| `CE` | [ke] | positive/desirable | 肯定的・望ましい |
| `DA` | [da] | action/power | 行為・力 |
| `DE` | [de] | negative/undesirable | 否定的・望ましくない |

<!-- END GENERATED: atoms -->

Join atoms into words: the final atom is the head; earlier atoms modify it.
`ADACA` is an entity related to motion/action; **water** is its survival convention.
The structural meaning and conventional reading are displayed separately.
No new letters or conjugations are needed.

## A small reliable grammar

- Use **subject → predicate → object/target**. Exchanging participants changes
  who does what to whom. Predicate heads are `DA`, `CE`, `DE`.
- Short sentences can omit subject/object. Missing roles remain unspecified;
  if two parses fit, retain both. A lone non-predicate is a fragment.
- Optional `E?` (question) or `A!` (emphasis) goes first, then optional `A-`
  (future) or `E-` (past). No tense marker means unmarked time.
- Attach `DE-` to one word to negate it. Emphasis/negation alone do not encode
  commands; request readings are labeled conventions.
- Separate sentences with newlines. Counts attach to terms (`3BACA`). External
  labels such as `[Tokyo]` are opaque; repeated words do not mark plurality.
- Final `E reference` expresses a relation. The relative-days convention makes
  future + `E 3ACA` a candidate for “in 3 days”, anchored to the utterance.

`DEDE` is intensified negative evaluation, not small. `ADA` is motion/action;
water is `ADACA`. `ACA` deliberately retains day/here/red as contextual candidates.
Unknown compounds still have atom breakdowns. The interpreter never quietly adds
“warm”, “want”, “I”, or a destination absent from the input.

## Try it locally

From this checkout, with Python 3.9+ (no installation, API key, or network):

```sh
python3 -m abcde 'A! CEDA BA'
python3 -m abcde --from ja '水がほしい'
python3 -m abcde --from en 'Help that person'
python3 -m abcde --json 'A- EADA E 3ACA'
python3 -m abcde --core-only 'ADACA'
python3 -m abcde --phrases
```

Omit text to read stdin. Quote spaces and shell punctuation. JSON exposes atoms,
roles, negation, conventional candidates and diagnostics. `valid` means valid
structure, not complete meaning; `ambiguous` signals multiple parses/readings.
Missing participants are still reported. Invalid/unsupported input exits 2.
Reverse translation accepts only listed phrases, not arbitrary sentences.
Whitespace is normalized and English case ignored; punctuation must match.

## Survival examples

These are **conventional candidates**, not guaranteed natural-language meanings.
The full [examples](examples.md) include structural glosses and assumptions.

<!-- BEGIN GENERATED: quick -->

| ABCDE | 日本語候補 | English candidate |
| --- | --- | --- |
| `BACE ADACA` | 水がほしい（欲しい主体は省略） | Water is wanted (experiencer omitted) |
| `A! DE-CECADA` | 食べないで | Do not eat |
| `A! CEDA` | 助けて（助ける側・助けられる側は未指定） | Help (helper and beneficiary unspecified) |
| `A! CEDA BA` | 私を助けて | Help me |
| `A! CEDA BEBACA` | あの人を助けて | Help that person |
| `A- EADA E 3ACA` | 3日後に戻る（主語は省略） | Return in 3 days (actor omitted) |

<!-- END GENERATED: quick -->

## Edit and verify

```sh
python3 tools/build_docs.py
python3 tools/build_docs.py --check
python3 -m unittest discover -s tests -v
```

Edit [language.json](abcde/data/language.json) for atoms, markers and lexical
conventions; [examples.json](abcde/data/examples.json) for examples and exact
reverse phrases. Generate dictionary/examples and marked README/spec sections
from them. Grammar prose stays in the specification and is exercised by
[conformance fixtures](tests/conformance.json). There is no second translator
dictionary. [REVIEW.md](REVIEW.md) records decisions, checks and open questions.

[Adaptations](adaptations.md) describes decorative scripts. The original
[promo video](assets/promo_video.mp4) illustrates v0; it is historical material,
not this draft's specification.

Created by Yoshie Yamada. [MIT license](LICENSE).
