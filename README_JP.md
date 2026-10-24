# ABCDE Language（アベケデ語）

**8つの意味アトム、5文字、活用なし。**

**[公開ビューワーを開く](https://yo4e.github.io/ABCDE-Language/)** —
日本語・英語の語カードを選んで文章を作れます。ダウンロード・インストールは不要です。

ABCDE / アベケデ `[a.be.ke.de]` は、人とのつながり・生存・助け合いを優先する
実験的なミニマル言語です。この v1 レビュー草案では、アトムから読める構造と、
人が共有する慣用を分けました。日本語・英語の読みを確認する、小さなオフライン
参照翻訳機も含みます。

[English](README.md) · [仕様](specification.md) · [辞書](dictionary.md) ·
[例文](examples.md) · [旧版からの変更](migration.md)

## 8つのアトム

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

アトムをつなげて語を作ります。最後のアトムが中心で、前のアトムがそれを修飾します。
たとえば `ADACA` は動き・行為に関係する物。「水」は生存会話で共有する慣用です。
翻訳機はこの構造と慣用を別々に表示します。新しい文字や活用は増やしません。

## 小さく確かめられる文法

- 標準語順は **主語 → 述語 → 対象**。参加者を入れ替えると、誰が誰に働きかけるかも
  変わります。述語の末尾アトムは `DA`・`CE`・`DE` です。
- 主語・対象は省略できます。省かれた役割は未指定のままにし、2通りに読めれば両方を
  残します。述語にならない1語だけなら、命題を補わず断片として扱います。
- 文頭に `E?`（疑問）または `A!`（強調）、その後に `A-`（未来）または `E-`（過去）を
  置けます。時制がなければ時間は未指定です。
- `DE-` は1語に直接つけ、その語を否定します。否定や強調だけでは命令になりません。
  「助けて」「食べないで」という依頼の読みは、慣用と明記します。
- 文は改行で区切ります。数は語に付けます（`3BACA`）。`[Tokyo]` などの外部ラベルは
  中身を解釈しません。語を空白で繰り返しても複数形にはしません。
- 文末の `E 参照語` は関係を表します。未来 + `E 3ACA` を「発話時点から3日後」と
  読むのは、時間差を表す慣用です。

`DEDE` は否定的評価の強調で、「小さい」ではありません。`ADA` は移動・行為、水は
`ADACA` に分けます。`ACA` の日・ここ・赤は、意図的な多義として候補を残します。
未登録の合成語もアトムに分解できます。翻訳機が勝手に「暖める」「欲しい」「私」や
移動先を補うことはしません。

## ブラウザだけで試す

[公開ビューワー](https://yo4e.github.io/ABCDE-Language/)をそのまま開いて使えます。
JavaScriptを有効にしたブラウザだけで、入力の解析と表示が完結します。Python・Node.js・サーバーの
起動やAPIキーは不要です。

オフラインで使う場合はリポジトリをダウンロードし、手元の `docs/index.html` をブラウザで開きます。
`docs` 内のファイルは同じフォルダに保ってください。[GitHub上のHTMLファイル](docs/index.html)は
ソースコードの表示です。オンラインで使う入口は上の公開ビューワーです。

「ことばを選ぶ」で、日本語・英語を併記した28語のカードを押すと、ABCDEを末尾に追加できます。
たとえば「私」→「欲しい」→「水」で `BA BACE ADACA`。例文と登録表現一覧のボタンは、
前の入力を残して新しい行に一文を追加します。「次の文へ」で文を区切り、「読みを確認」を押します。
語順や省略した役割は自動で補正しません。

「手入力」では日本語・英語→ABCDE、ABCDE→日本語・英語を選べます。組み立て中の文と
方向ごとの下書きを別々に保持し、「取り消し」「やり直し」で直近100操作を戻せます。クリアも取り消せます。
入力はこのページを開いている間だけ保持し、再読み込み・終了で消えます。外部送信・端末保存はしません。

直訳・慣用候補・前提・省略・複数の読みを分けて表示し、ABCDE入力では「アトムと構文だけを見る」も
選べます。日本語・英語の自由文翻訳には対応しません。UIは白・黒・黄色、語と読みの説明は日英併記です。
[静的版の詳しい操作・検証・公開手順](STATIC_VIEWER.md)を参照してください。

## Pythonの参照CLIで試す

この checkout 内で、Python 3.9 以上を使います。インストール・APIキー・通信は不要です。

```sh
python3 -m abcde 'A! CEDA BA'
python3 -m abcde --from ja '水がほしい'
python3 -m abcde --from en 'Help that person'
python3 -m abcde --json 'A- EADA E 3ACA'
python3 -m abcde --core-only 'ADACA'
python3 -m abcde --phrases
```

テキスト引数を省くと標準入力を読みます。空白や記号のある入力は引用符で囲んでください。
JSON にはアトム・役割・否定・慣用候補・診断が入ります。`valid` は構造が有効という意味で、
意味の完全性を保証しません。`ambiguous` は複数の構文・読みが残る状態です。省略も別途表示します。
不正・未対応入力の終了コードは2です。逆翻訳は一覧にある表現だけを受け付け、自由文を近い意味に
置き換えません。前後・連続空白と英語の大小文字は吸収しますが、句読点は登録表現との一致が必要です。

## 生存会話の例

以下は **慣用による候補** です。[例文集](examples.md)で構造的な直訳と必要な前提を確認できます。

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

## 編集と検証

```sh
python3 tools/build_docs.py
python3 tools/build_static.py
python3 tools/build_docs.py --check
python3 tools/build_static.py --check
python3 -m unittest discover -s tests -v
```

アトム・マーカー・慣用語は [language.json](abcde/data/language.json)、例文・逆翻訳の
対応表現は [examples.json](abcde/data/examples.json) を編集します。辞書・例文ページと
README・仕様の指定部分はそこから生成し、翻訳機用に別の辞書を持ちません。文法の規定は
仕様に置き、[適合例](tests/conformance.json)で検証します。
静的版のデータと診断文も同じ正本から生成します。JavaScriptの文法処理はPythonとの
全JSON一致で検証します（JavaScriptのテストは開発時のみNode.jsが必要で、未導入ならskipされます）。
[REVIEW.md](REVIEW.md) は初期設計レビューの記録です。現在の画面の操作・検証・公開状況は
[STATIC_VIEWER.md](STATIC_VIEWER.md)にまとめています。

[応用・派生](adaptations.md)は装飾的な文字体系の説明です。
[当初の紹介動画](assets/promo_video.mp4)は v0 の歴史資料で、この草案の規定ではありません。

Created by Yoshie Yamada. [MIT ライセンス](LICENSE)。
