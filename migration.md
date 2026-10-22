# v0 → v1 review draft / 旧版からの変更

The original **ABCDE v0** is reproducible at commit
`5f7d4b88fa339904e131519f8c305dcccf63497d`
([source](https://github.com/yo4e/ABCDE-Language/tree/5f7d4b88fa339904e131519f8c305dcccf63497d)).
No duplicate old specification is kept here. No tag/release is made in this local
pass. [Issue #1's preservation proposal](https://github.com/yo4e/ABCDE-Language/issues/1#issuecomment-5229674013)
should be considered **before a future breaking merge**, not published now.
This is an experimental v1 draft, not a v1 release.

原型を失敗作として捨てず、v0 として Git の履歴に残します。今回の作業はローカルのみです。

## Meaning changes / 語の変更

Generated from the interpreter's legacy notices. These are retired readings,
not automatic text replacements.

<!-- BEGIN GENERATED: legacy -->

| Word | Retired reading / action | 旧解釈と対応 |
| --- | --- | --- |
| `DEDE` | v0 also used this for small/weak. That reading is retired; use [small] as an opaque external term if needed. | v0 の小さい・弱いという読みは廃止。必要なら外部語 [small] を使う。 |
| `DEDECECA` | v0 egg/egg-size is retired. No automatic egg inference; use [egg]. Egg count does not specify volume. | v0 の卵・卵大という読みは廃止。卵を推論せず [egg] を使う。卵の個数と体積は別。 |
| `ADA` | v0 water/drink/blue readings are retired. Water is ADACA; movement alone is not drinking. | v0 の水・飲む・青という読みは廃止。水は ADACA。移動は飲むことではない。 |
| `DADA` | v0 big/giant is no longer a size reading; use [large] when size must be named. | v0 の大きい・巨大というサイズ読みは廃止。サイズを名指すなら [large]。 |
| `A` | v0 white/light is no longer a default convention; use [white]. Bare A is not future tense. | v0 の白・光は標準の慣用から外す。白は [white]。裸の A は未来時制ではない。 |
| `ECA` | v0 yellow is no longer a default convention; use [yellow]. | v0 の黄色は標準の慣用から外す。黄色は [yellow]。 |
| `DEA` | v0 black/dark/night is no longer a default convention; use an external term. | v0 の黒・暗い・夜は標準の慣用から外す。必要なら外部語を使う。 |
| `ACE` | v0 paradise/good place is no longer a default convention; positive motion does not entail a place. | v0 の楽園・良い場所は標準の慣用から外す。肯定的な動きは場所を含意しない。 |
| `ADE` | v0 hell/bad place is no longer a default convention; negative motion does not entail a place. | v0 の地獄・悪い場所は標準の慣用から外す。否定的な動きは場所を含意しない。 |

<!-- END GENERATED: legacy -->

`ACA` retains **day / here / red** as explicit contextual alternatives. This is
accepted polysemy, not three Core definitions. A time-offset candidate selects
“day” under a named convention without erasing other readings.

Five additions, using existing atoms: `ADACA` (water), `BACE` (want), `CECADA`
(eat), `EADA` (return), `BEBACA` (that other person). All are conventional;
no new basic atom or punctuation is added. Eggs and precise sizes use opaque
external labels for now. `[egg]` is not automatically translated or a volume unit.

## Grammar and translation changes / 文法と訳の変更

| v0 | This draft / この草案 |
| --- | --- |
| Free word order with recommended S-P-O | S-P-O is meaningful; short S-P/P-O ambiguity is retained. / 語順で役割を区別。 |
| Place/time may follow freely | One explicit `E reference` suffix; relation type unspecified. / 参照語は E で区切る。 |
| Broad contextual omission | Missing roles stay null; no invented speaker/listener/action. / 省略を補わない。 |
| `Word Word` means plural/intensity | Space separates roles. Use counts when known. / 空白で複数形にしない。 |
| No tense marker = present | Unmarked time; past/future do not imply completion. / 時制なしは未指定。 |
| Marker order recommended | Optional mood before optional tense; at most one of each. / 順序と個数を固定。 |
| `DE-DA` glossed as “don't do” | Word negation; prohibition requires a stated pragmatic reading. / 否定と依頼を区別。 |
| `E?` alone; external words as predicates | A body is required; external labels are opaque entities. / この参照文法では不正。 |
| Fixed numeral pronunciations | An auxiliary subsystem with an agreed local reading. / 8アトムと区別。 |
| `BA CE 5DEDECECA` = I want five eggs | CE is not want; egg/count/size were conflated. Re-express intent, e.g. `BA BACE 5[egg]`, with an agreed label. / 意図を確認して言い直す。 |
| `CEA CA DA BABA` = the sun warms us | Four unmarked terms are invalid. No warmth is inferred; CEA does not derive sun. / 暖めるとは訳さない。 |
| `BACA [Yo4e] CE` = you, Yo4e, are good | No implicit apposition/second person. `[Yo4e] CE` is a valid opaque-subject evaluation. / 同格やあなたを推定しない。 |
| `A- BA ADA ACA E 3ACA` = return in three days | Movement is not return. Use EADA to offer return; destination remains unspecified. / 移動と戻るを区別。 |

This is **not a backwards-compatible v0 parser**. Some old strings remain valid
but change interpretation. `DEDE CA` now has a negative predicate and a thing
as object, not a small noun phrase. Warnings identify known retired readings,
but cannot detect the author's version or intention. Automatic migration
cannot safely repair every v0 sentence.

Bare `E` was never past `E-`. The draft defines relation scope; it does not repeat
the corrected diagnosis in [Issue #2](https://github.com/yo4e/ABCDE-Language/issues/2#issuecomment-5229590645).

## Review before stabilizing / 安定版にする前に

Accept or revise the small predicate-head restriction, retained ACA polysemy,
five new conventional words and relative-days convention. Human learnability,
pronunciation under stress and real survival communication are not validated
by software tests. An intentionally small language still relies on context.
