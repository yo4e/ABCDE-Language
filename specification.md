# ABCDE specification — experimental v1 draft

ABCDE / アベケデ `[a.be.ke.de]` is a small language for connection and mutual aid:
eight semantic atoms, five core letters, no inflection. Numbers and external
labels are auxiliary. This is a **review draft**, not a released v1.

## 1. Authority and layers

- **Core:** the grammar in this document and the atom/marker inventory in
  [language.json](abcde/data/language.json). The inventory tables below are generated.
- **Conventions:** `conventions`, `legacy`, and `time_convention` in that same JSON,
  rendered as [dictionary.md](dictionary.md). They specialize meaning, never overwrite a parse.
- **Examples:** [examples.json](abcde/data/examples.json), rendered as
  [examples.md](examples.md). Natural translations state their assumptions.
- **Grounding:** actual people, objects, places and shared context. The interpreter
  does not supply these.

The README is introductory; [adaptations.md](adaptations.md) is non-normative.
The Python code implements grammar rather than defining a second lexicon.
`python3 tools/build_docs.py --check` detects stale generated text; conformance
fixtures test the prose's grammar decisions. Change rules and tests together.
Passing tests does not establish real-world communicative adequacy.

## 2. Atoms and composition

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

Atoms name semantic fields, not English/Japanese dictionary words or truth values.
Bare `A` does not mark future; bare `E` does not mark past. `CE`/`DE` are evaluations
relative to an unspecified standard, not Boolean truth values. Within compounds,
`BA`/`BE` contribute self/source and other/target; independent participant readings
“I” and “you” belong to conventions.

Tokenization is unique: `A`, `E`, or `B/C/D` followed by `A/E`. Join one or more atoms
without separators. The **last atom is the head**, and all earlier atoms form an
**ordered, flat list of modifiers** of that head. There is no recursive dictionary
substitution or hidden grouping. The structural gloss is `head〈modifier + …〉`.

`ADACA` parses as `[A, DA] → CA`, an entity related to motion and action. “Water”
is a survival convention, not a logical consequence. `CECADA` parses as
`[CE, CA] → DA`; “eat” is a whole-word convention, not dictionary substitution
of `CECA` into a compound tree. Unknown compounds retain their atoms and head.

Repeating an atom reinforces its field: `CECE` is intensified positive evaluation;
`DEDE` is intensified negative evaluation. It introduces no new size scale.
Mixed positive/negative modifiers are retained without Boolean simplification.
Space-separated repeated words are **separate terms**, not a plural operator.
Use a count when known (`3BACA`); otherwise plurality is unspecified.

## 3. Writing, counts, external labels

Outside brackets use uppercase `A B C D E`, ASCII digits and spaces, and `- ! ? [ ]`
only in their defined forms. **One nonempty line is one sentence or fragment.**
LF/CRLF are accepted, blank lines ignored, repeated spaces equivalent to one.
Tabs, lowercase and other punctuation outside brackets are invalid. A line is
never split by guessed semantics.

A term is an optional attached `DE-`, optional attached count, then a word or
external label. A count is `0` or an unsigned decimal integer without leading
zeros. Bare numerals are invalid. Counts mean counts of the referent, not
inferred dimensions: `5[egg]` does not mean the volume of five eggs.

External labels are nonempty text in one matching bracket pair: `[Tokyo]`, `[山田]`,
`[New York]`, `5[egg]`. Preserve spaces and spelling inside. Empty/whitespace-only
labels, control characters, nesting and multiline labels are invalid. They are
**opaque entities**, not automatically people, verbs or translated words. They
cannot be predicates or concatenate with atoms. `DE-[Tokyo]` negates the whole label.

Day (`ACA`) and step (`BADA`) are natural-unit conventions, not calibrated measures.
The interpreter computes no physical lengths or calendar dates. Numerals may use
a mutually understood local digit reading. V0's digit pronunciations remain an
optional adaptation; eight semantic atoms does not mean eight total spoken forms.

## 4. Canonical clauses and omission

```text
line     := [mood] [tense] (clause [E reference] | fragment)
clause   := subject predicate object
          | subject predicate
          | predicate object
          | predicate
fragment := term that cannot be a predicate
```

Brackets in this grammar mean optional. Every position is one term, separated
by spaces. A **predicate** is an unquantified non-external word headed by `DA`,
`CE` or `DE`; it may have `DE-`. These fields express action/power or evaluation.
Any term may fill another role, subject to the reserved bare `E` rule below.
This is deliberately restricted grammar, not a parser for all v0 prose.

- Three body terms mean **subject → predicate → object/target (S-P-O)**. Roles
  never change based on plausibility or lexical lookup. `BA CEDA BE` and
  `BE CEDA BA` describe different helpers and beneficiaries.
- With two terms, retain **every** eligible S-P and P-O parse. `CE DE` permits
  both. `CEDA BA` permits only P-O because `BA` is not a predicate.
- One predicate has unspecified subject and object. One non-predicate is a
  fragment; no proposition is invented.
- Other shapes are invalid. Missing predicates are never repaired.
- An omitted role is `null`, never automatically `BA` or `BE`. An unspecified
  object may be unnecessary for an intransitive reading or may need context;
  the interpreter does not invent a valency distinction.

Word order matters. No fronting, multiword noun phrases, implicit possession,
coordination, or extra place/time slots are provided. Compound modifiers must
be joined inside a word. An external label is also one term. Do not silently
combine adjacent terms to repair a sentence.

## 5. Markers and scope

<!-- BEGIN GENERATED: markers -->

| Marker | Meaning | Scope |
| --- | --- | --- |
| `E?` | question | whole sentence / 文全体 |
| `A!` | emphasis | whole sentence / 文全体 |
| `A-` | future | whole sentence / 文全体 |
| `E-` | past | whole sentence / 文全体 |
| `DE-` | negation / 否定 | one attached term / 直結する1語 |

<!-- END GENERATED: markers -->

At most one mood, then at most one tense, precedes the body; order is mandatory.
Duplicate, conflicting and misplaced markers are invalid. No tense marker means
**unmarked** time (a present/general reading is possible, not asserted). Past or
future does not encode completion, certainty or ability.

`DE-` negates one entire term, including count: `DE-3BACA` means “not three persons”
under the person convention, not “three non-persons”. On a predicate it denies
that predication for the participants. It is not a clause-negation particle.
`DE-CE` differs from lexical `DECE`. Repeated `DE-` is invalid; negation alone
never means “do not”, “cannot”, or danger.

`A!` adds emphasis, **not imperative mood**. A survival phrase may read an emphatic
action as an appeal (“Help me”, “Do not eat”), but must state that convention
and preserve the emphatic-assertion reading in its structural output. Bare
`CE`/`DE` do not encode context-free yes/no answers. Only whole-line `CE!` and
`DE!` expand to `A! CE` and `A! DE`. Bare `E?` has no body and is invalid here.

## 6. Bare E and time

Standalone **`E` is reserved for one clause suffix** `E reference`. The reference
is exactly one term after the body, not another object. The relation attaches
to the whole clause; its type is unspecified, not automatically after, before,
with, possession, or causation. `E` alone may be inspected as an atom fragment;
otherwise it is not a bare participant or reference. Compounds containing E
remain ordinary words.

<!-- BEGIN GENERATED: time -->

In the survival profile, future/past + E + counted ACA may mean that many days after/before the utterance. Bare E itself means only relation. Other readings remain possible.

生存会話の慣用では未来・過去 + E + 数付き ACA を発話時点からの日数差として読める。裸の E 自体は関係のみ。他の読みも残る。

<!-- END GENERATED: time -->

`A- EADA E 3ACA` has an omitted subject, a return convention, and a possible
“three days after the utterance” reading. Who returns and the return destination
remain unspecified. `BA EADA E 3ACA` supplies no time direction. `E- BA EADA E 3ACA`
offers a past offset. Negated references never activate the time convention.
The broader ACA readings remain visible.

## 7. Reference output contract

`python3 -m abcde` and `abcde.analyze(text)` provide the same analysis. JSON has
a language version, aggregate status and one result per nonempty line. A bad
line is `invalid`; valid lines in the same input remain available. Output includes:
terms (atoms, ordered modifiers, head, count, negation, bilingual literal),
markers, all possible role maps, relation, conventional readings and diagnostics.
Role/reference indices address the `terms` array. Fragments have no role map.

`ambiguous` specifically means multiple parses or registered lexical readings.
`valid` means structurally accepted, **not semantically complete**. Omissions,
external labels, unknown compounds and pragmatic uncertainty are separate
notices. Legacy warnings identify retired readings, never activate an old
parser or automatically migrate text.

Base-word candidates are explicitly **before count and negation**. The `literal`,
`negated` and `count` fields carry these operators; never show a positive base
reading as the translation of a negated word. Natural whole-sentence candidates
are only available for registered examples, with assumptions. Generic input
gets structured bilingual glosses and word candidates, not invented fluent prose.

`--core-only` suppresses word, phrase and time conventions while preserving
parses, omissions and legacy notices. Reverse `--from ja` / `--from en` uses
exact phrasebook matching, never free-text translation. Outer/repeated whitespace
is normalized; English matching is case-insensitive. Punctuation, negation,
names and extra words are not discarded. Unsupported input gives `unsupported`
and no matches. Supported matches include a fresh forward analysis.

In the example data, `candidate: false` marks analysis-only illustrations;
they are documented but never offered as natural sentence translations.

Python 3.9+ and its standard library suffice; there are no network calls or
runtime dependencies. The implementation limits input to 8192 characters per
analysis (a resource bound, not a linguistic rule). CLI exit status: 0 for
accepted/ambiguous input, 2 for invalid/unsupported input or CLI misuse.

## 8. Speech and remaining context

`C` is `[k]`. Stress the final atom, with audible word boundaries and a clear
pause between sentences. Ordinary atoms have short vowels; `A-`, `E-`, `DE-`
have extended vowels. `A!` and `E?` are short marked utterances. These guidelines
are not a validated speech-recognition protocol.

This draft deliberately leaves referents, the kind of help, and many action
details to context. It does not express arbitrary Japanese/English or every
linguistic distinction. A larger grammar and an ABCDE-native learner are outside
this pass. See [migration.md](migration.md) for compatibility and review decisions.
