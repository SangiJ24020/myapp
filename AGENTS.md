## エージェント
日本語で絵文字を使って返答する
ユーザーからデザインの指定が無ければ、モダンなライトデザインをデフォルトにする
AGENTS.mdの内容はプロダクトの要件に変更がある度に適宜修正する

# 静的サイト 実装仕様

## アプリ名
- **J24020のアプリ (myapp)**

## 確認方法
- ユーザーはCドライブのパスをブラウザに直接入力して確認する
- ローカルのフロントサーバーはこのコマンドで実行する： `npx serve public -p 3000`
- 上記コマンドはエンジニアが実行するため、AIエージェントは実行しないこと。「サーバー起動して」と言われたら、このコマンドの実行をエンジニアに求めること。
- 「Ctrl + @ 」でターミナルを起動できることも教えること。

## 実装方針
- CSS・JS等の他ファイルを参照するときは必ず相対パスを使う
- JSライブラリ（Chart.js等）はCDNを利用する

## 画像
- AIエージェントによる画像生成は実行しない
- 画像はユーザーが用意する

## GAS連携仕様
- Google Apps Script (GAS) プロジェクト名: `個人製作`
- スプレッドシート名: `個人製作`
- GASに `output.setHeader` は存在しないため使用しないこと。
- ウェブアプリを「全員（匿名含む）」アクセス可で公開していれば、fetchのGETアクセスでCORS制約を受けずに取得できる。
- もしエラーになる場合は、Gmail、外部APIアクセス、Googleカレンダー等、新しい権限が必要なコードを書いたことが原因。
- fetchからのGETアクセスでは権限認証画面が出ないため、`doGet()` の中にデバッグ用の `mode` を作成して、そのURLをブラウザのアドレスに打ち込む。エンジニアが一度権限を許可すれば、その後はfetchのGETでもエラーが解消される。

### 🔑 ログイン・セッション管理
- ユーザーシート `"users"`：`id`, `email`, `password`, `name`
- セッションシート `"sessions"`：`user_id`, `token`, `expired_at` (24時間有効)
- セッション情報の保持には、localStorageとCookieを併用する。

### 🔮 AIアシスタント機能 (OpenRouter 連携)
- OpenRouter API を用いてチャットのやり取りを生成する。
- APIキーは `"settings"` シート의 **B2セル** から読み取る。
- チャット履歴は `"messages"` シート（`user_id`, `type`, `text`, `create_at`）に保存する。

## ⚠ 文字コード設定（PowerShell 環境）
**必須:** ファイル読み書きは UTF-8 を明示的に指定する。

- スクリプト先頭で必ず以下を実行する:
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

- ファイル書き込みには `-Encoding UTF8` を必ず付ける:
Set-Content -Path 'output.txt' -Value $data -Encoding UTF8

- Python の `open()` には `encoding="utf-8"` を必ず指定する:
with open("file.txt", "r", encoding="utf-8") as f:
    content = f.read()

### PowerShell環境では文字化けが発生しやすいため厳守
