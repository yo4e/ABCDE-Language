# 静的翻訳ビューワー

## 利用方法

ダウンロードしたcheckoutの [docs/index.html](docs/index.html) をブラウザで開きます。
同じ `docs` フォルダのCSS・JavaScriptを一緒に置けば、Python・Node.js・ローカルサーバーは不要です。
HTMLを直接開く `file:` と、GitHub Pagesのプロジェクト名付きパスに相当するHTTP配信の両方を
検証しています。JavaScriptは必要です。無効時は説明を表示し、入力を送信できない状態にします。

入力はブラウザ内で処理し、URL・外部API・アクセスログへ送信しません。入力履歴・Cookie・
localStorage・Service Workerは使いません。ホスティング時には静的ファイルの取得だけが発生します。
読み込み後の翻訳はオフラインでも動きますが、オフラインでの再読み込みを保証するPWAではありません。
ファイルを手元に保存すればサーバーなしで開けます。ブラウザ自身の履歴・フォーム保持はその設定に従います。

日本語・英語の逆方向は登録表現のみです。自由文の近似翻訳はしません。役割の省略・複数の解析・
語の多義・未登録合成語・不正入力を区別し、慣用による読みには前提を表示します。
例文ボタンは方向と入力を一緒に切り替え、慣用を含む表示へ戻します。
未送信の入力を編集しても、結果には最後に確認した入力と方向を表示し続けます。

## 構成と正本

- 言語データと例文の正本は [language.json](abcde/data/language.json) と
  [examples.json](abcde/data/examples.json)。文法の動作の正本は [interpreter.py](abcde/interpreter.py) です。
- [build_static.py](tools/build_static.py) が語彙・例文・文法パラメーター・診断文・逆翻訳の注意文を
  [data.js](docs/data.js) へ生成します。生成物は直接編集しません。
- [engine.js](docs/engine.js) はブラウザ用の小さな文法処理です。Pythonを丸ごと持ち込むランタイムを
  避けるため、このアルゴリズム部分だけはJavaScriptにも実装しています。別の言語仕様にはせず、
  Pythonの出力JSONと完全比較して差異を検出します。文法変更時は両実装と一致検証を同じ変更に含めます。
- 英語の一致検索をJavaScriptの単純な小文字変換で近似しないよう、Pythonのcasefold・空白判定表も
  生成します。今回の生成環境はPython 3.9.6 / Unicode 13.0.0です。生成に使うPythonのUnicode版を
  更新した場合は生成物の差分を確認し、両エンジンの一致検証をやり直してください。
- [app.js](docs/app.js) は画面だけを担当し、入力をDOMのテキストとして表示します。
  依存パッケージ、外部CDN、fetch、ビルド用npmプロジェクトはありません。配信用の6ファイルは合計約91KBです。

既存main `d4566a0` からの独立ブランチ `codex/static-viewer-20261022` です。
以前のPythonサーバー版は `codex/local-browser-translator-20261022` に残し、この静的版には含めません。
Python参照CLI、仕様、共有辞書・例文の意味は変更していません。

## 検証方法と結果

```sh
python3 tools/build_docs.py --check
python3 tools/build_static.py --check
python3 -m unittest discover -s tests -v
```

Python 3.9.6 / Node 22.22.0で37テスト成功。生成物の一致確認と、7,717入力のPython対JavaScriptの
全JSON比較を含みます。NodeがなければJavaScript比較だけskipされるため、リリース前には必ずNodeのある
検証環境で実行してください。Nodeは開発検証専用で、利用者の環境には不要です。

一致検証には正常41例・不正46例の両表示モード、4アトムまでの4,680合成、共有例文22件、
逆方向の日本語21・英語17表現と表記揺れ、役割・語順・否定・数量・マーカー・時間関係の組合せ、
制御文字・Unicode空白・絵文字・8192文字境界・未対応表現・乱数seed固定の不正入力1,000件を含みます。
状態だけでなく、アトム・役割・直訳・候補・前提・診断・行番号まで一致を確認しています。

既にPlaywrightとChromiumがある開発環境では、任意の画面検証を再現できます。

```sh
PLAYWRIGHT_MODULE=/path/to/playwright node tools/check_static_browser.cjs /tmp/abcde-static
```

Playwright 1.61.1 / 独立したヘッドレスChromium 149.0.7827.55で次を確認しました。
追加インストールや通常のブラウザ・ユーザー画面の操作はしていません。

- HTMLファイルの直接起動、実ブラウザでも7,717入力の全JSON一致。
- 「水がほしい」「助けて」「私を助けて」「あの人を助けて」「食べないで」「3日後に戻る」の意味保持。
- `CE DE` の役割の両候補、`ACA` の日・ここ・赤、慣用の前提、否定の範囲、アトムと構文だけの表示。
- 未対応・不正・未知・正常と不正の混在・空欄・長すぎる入力、HTMLに見える外部ラベル。
- 繰り返し送信、方向変更、入力編集、クリア、例文選択、登録表現一覧。
- 幅1280px / 390px / 320px。長いラベルも横はみ出しなし。デスクトップと狭い画面の主要状態を画像で目視確認。
- `/ABCDE-Language/` 配下での相対アセット読み込み、読み込み後のオフライン翻訳。
- 操作中の追加リクエスト0、予期しない外部リクエスト0、コンソール・ページエラー0。
- JavaScript無効時に必要条件を説明し、送信ボタンを無効化。

Safari/Firefox、実機スマートフォン、スクリーンリーダー、実際のGitHub Pages配信は未検証です。
37テストに以前のPythonサーバー専用16テストは含みません。こちらにはサーバー自体がありません。

## 将来の公開手順（この変更では実行しない）

公開を承認した段階で、最終headの上記検証とレビュー後にPRをmainへマージします。
次にGitHubの **Settings → Pages → Build and deployment → Deploy from a branch** で
`main` と `/docs` を選び、Saveします。エントリーは `docs/index.html`、`.nojekyll` は
生成済みファイルをそのまま配信するためのものです。カスタムドメインやデプロイ用ワークフローは不要です。
これは [GitHub公式の公開元設定](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
に沿った構成です。

Pagesのビルド・配信結果と設定画面に表示されるURLを確認し、その実URLで生存会話・曖昧入力・
各アセット・狭い画面を再検証します。実際に公開されるまでは閲覧用URLとして案内しません。
以後、公開元mainのdocs更新は自動配信されるので、生成物の更新と一致検証を更新手順に含めます。
このPRはPages有効化・公開・マージを実施せず、デプロイを起動するworkflowも追加しません。
