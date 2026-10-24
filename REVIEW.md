# Local review / ローカルレビュー

This is the initial design-review record. The proposal was adopted and merged in
[PR #3](https://github.com/yo4e/ABCDE-Language/pull/3). The scope, counts and open
questions below describe that review stage. Current browser behavior and publication
status are documented in [STATIC_VIEWER.md](STATIC_VIEWER.md).

## Scope and status / 範囲

Baseline: `5f7d4b88fa339904e131519f8c305dcccf63497d` (v0 / current remote main at checkout).

Branch: `codex/minimal-reference-20261022`.

The branch contains a proposed v1 language draft, a Python standard-library CLI,
shared JSON language/example data, generated documentation, and conformance tests.
The initial local-review stage did not include push, PR, tag, release, merge or deployment.

## Design decisions / 判断

8アトム・5文字・活用なし・生存と助け合いという核を保持した。
合成は末尾アトムを中心とする平坦な修飾リストとし、人間の常識を使った自然訳とは分離した。
完全な自然言語翻訳は目指さず、汎用入力には構造的な直訳と語の候補、登録文には前提付きの自然訳を返す。

| Choice | Reason / 理由 |
| --- | --- |
| Canonical S-P-O, enumerate short S-P/P-O alternatives | Free order plus omission cannot reliably preserve who helps whom. Extra role particles would enlarge the core. / 語順を固定し、曖昧な短文は両方残す。 |
| Predicate heads DA/CE/DE | A small recognizable action/evaluation class permits omission without a new delimiter. This limits expression and needs human review. / 追加記号なしで述語を識別するための小さな制約。 |
| DEDE = reinforced negative; old small/egg retired | Avoid deriving smallness from badness or calling something an egg by accident. New size vocabulary is deferred. / 小さい・卵の隠れた補完をやめる。 |
| Water ADACA; want BACE; eat CECADA; return EADA; other person BEBACA | Five conventional compounds support the requested contrasts without adding atoms. / 依頼された区別に必要な5語だけ追加。 |
| Keep ACA day/here/red as explicit candidates | Not every polysemy needs a new word. The interpreter must expose the ambiguity. / 意図的な多義を保持。 |
| Bare E is a neutral relation suffix | The E/E- correction is respected. Relative day offsets are a separate convention anchored to utterance time. / 関係と時制を分離。 |
| A! remains emphasis | Request phrases expose their pragmatic assumptions; DE- never silently becomes prohibition or inability. / 強調・否定・依頼を区別。 |
| CLI, no dependencies or service | A small runnable reference is sufficient to test language consistency. / APIも大きなアプリも不要。 |

`language.json` is the sole atom/marker/lexical data source; `examples.json` owns
example translations, assumptions and reverse aliases. The specification owns
grammar prose; independent fixtures assert its role/scope decisions. Dictionary,
examples and marked portions of README/spec/migration are generated and checked.

## Run / 実行

```sh
python3 -m abcde --from ja '水がほしい'
python3 -m abcde --from ja '食べないで'
python3 -m abcde --from ja '助けて'
python3 -m abcde --from ja '私を助けて'
python3 -m abcde --from ja 'あの人を助けて'
python3 -m abcde --from ja '3 日後に戻る'
python3 -m abcde --json 'CE DE'
python3 -m abcde --core-only 'ADACA'
python3 -m abcde --phrases
python3 tools/build_docs.py --check
python3 -m unittest discover -s tests -v
```

Python 3.9+; run from the checkout. No installation or network needed.

## Validation / 検証

Verified locally on Python 3.9.6:

- `python3 -m unittest discover -s tests -v`: **34 tests passed**.
- Independent conformance corpus: **41 accepted cases** (12 intentionally
  ambiguous) and **46 invalid cases**.
- All **22 examples**, **28 lexical conventions**, and reverse aliases
  (**21 Japanese / 17 English**) checked; generated documentation is current.
- Exhaustive atom segmentation through four atoms: **4,680 sequences**.
  Boundary/control-character checks and 300 deterministic malformed-input
  probes completed without uncaught parser exceptions.
- CLI JSON/stdin, exit codes, negation/assumption display, core-only mode,
  local documentation links, and `git diff --check` passed.

| Japanese input | Result | Meaning preserved / 保持した区別 |
| --- | --- | --- |
| 水がほしい | `BACE ADACA` | Experiencer unspecified; water is an entity, not motion or blue. / 欲しい人を勝手に私にしない。 |
| 食べないで | `A! DE-CECADA` | Negated eating; appeal is a convention, actor/food unspecified. / 否定を保持し、依頼の前提を表示。 |
| 助けて | `A! CEDA` | Helper and beneficiary unspecified; appeal is a convention. / 助ける側も助けられる側も補わず、依頼読みの前提を表示。 |
| 私を助けて | `A! CEDA BA` | Speaker is beneficiary; helper unspecified. / 助けられる側が私。 |
| あの人を助けて | `A! CEDA BEBACA` | Third person is beneficiary, identified by context. / 聞き手や私に取り違えない。 |
| 3 日後に戻る | `A- EADA E 3ACA` | Possible offset after utterance, not past; actor/destination unspecified. / E と E- を区別。 |

Manual reading also checked that generic action is not translated as warming,
CE (like) is not upgraded to want, an old egg word gets a legacy warning,
and future is not silently strengthened into intention. Generated tables and
example outputs were inspected as text; this work has no browser UI.

The finishing pass adds the exact Japanese phrase “助けて” using the existing
one-predicate clause. Both participant roles stay null, and an emphatic assertion
remains possible alongside the conventional appeal. Regression checks cover
roles, the displayed assumption, core-only output, and rejection of the unsupported
negative phrase “助けないで”; no new grammar or lexical word was needed.
It also corrects migration.md's v0 quotation to “I will come here after 3 days”.

Execution evidence is saved outside the repository in the sibling
`review-evidence/` directory (test log, CLI samples, JSON analyses and counts).
These checks establish software conformance, not human learnability.

## Questions recorded at review / レビュー時点の論点

- この S-P-O と述語末尾の制約を採用するか。既存の自由語順や同格表現との後方互換性はない。
- ACA の多義と、未来・過去＋日数の時間慣用が人間にも分かりやすいか。
- 追加した5つの慣用語の覚えやすさ。卵・サイズ・色の語彙を将来どこまで戻すか。
- 依頼を慣用として残すか、将来明示マーカーを設けるか。今回、強調と命令は同一視していない。
- 発音・学習容易性・実際の場面での取り違えは未検証。ソフトウェアの適合テストとは別に確認が必要。
- 将来の破壊的なマージ前に v0 のタグ・リリース保存を検討する。今回は作成していない。

There is no automatic v0 migration and no claim of complete translation.
See [migration.md](migration.md) for the exact compatibility changes.
