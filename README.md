# UEC 研究室マッチング診断 MVP v2

オープンキャンパス向け研究室マッチングシステムの静的Webアプリです。

v2では、複数のスマートフォン・PCから送られた匿名回答をSupabaseで共有できるようになりました。Supabaseが未設定、または通信できない場合は、自動的にブラウザのlocalStorageへ保存して診断を継続します。

## 実装済み

- 10問の5段階質問
- 横軸：人・社会 ↔ 技術・計算
- 縦軸：理論 ↔ 実践・ものづくり
- 興味分野を最大3つ選択
- 座標の近さ42%＋タグ一致58%で研究室をランキング
- 上位3研究室と推薦理由を表示
- SVGによる2次元散布図
- Supabaseを使った複数端末間の匿名回答共有
- 通信失敗時のlocalStorageフォールバック
- 未送信回答の自動再送
- デモ回答の表示・非表示設定
- モバイル対応

## すぐ試す

Supabaseを設定しなくても、端末内保存モードで動作します。

```bash
cd uec-lab-matcher-v2
python3 -m http.server 8000
```

ブラウザで次を開きます。

```text
http://localhost:8000
```

## Supabaseを設定して複数端末で共有する

### 1. Supabaseプロジェクトを作成

Supabase Dashboardで新しいプロジェクトを作成します。

- 公式サイト: https://supabase.com/
- Project URLはプロジェクトのConnect画面またはData API設定から確認できます。
- ブラウザではPublishable key（`sb_publishable_...`）を使用します。
- Secret keyや`service_role` keyは絶対に使用しないでください。

### 2. テーブルとRLSポリシーを作成

Supabase DashboardのSQL Editorを開き、同梱の`supabase-setup.sql`を実行します。

このSQLは次を行います。

- 匿名回答テーブルの作成
- x / yを-100〜100に制限
- イベントコードの制限
- Row Level Securityの有効化
- 匿名ユーザーへSELECTとINSERTだけを許可
- UPDATEとDELETEは禁止

### 3. config.jsへ接続情報を入力

`config.js`の空欄を埋めます。

```javascript
window.LAB_MATCHER_CONFIG = Object.freeze({
  supabaseUrl: "https://YOUR_PROJECT_REF.supabase.co",
  supabasePublishableKey: "sb_publishable_YOUR_KEY",
  eventCode: "uec-open-campus-2026",
  useDemoData: true,
  maxSharedResponses: 1000,
  requestTimeoutMs: 6000
});
```

`eventCode`を変更する場合は、`supabase-setup.sql`内のイベントコード2箇所も同じ値へ変更してからSQLを実行してください。

### 4. 動作確認

2台の端末で同じ公開URLを開きます。

1. 端末Aで診断を完了
2. 端末Bを再読み込み
3. トップ画面の表示が「共有データベース接続中」になることを確認
4. 診断結果の散布図に共有回答が反映されることを確認

## 公開方法

このアプリは静的ファイルだけで構成されているため、GitHub Pagesなどへ配置できます。

### GitHub Pagesで公開する

1. GitHubで新しいリポジトリを作成します。
   - Repository name: `uec-lab-matcher`
   - Public / Private: どちらでも可。ただし無料プランでPages公開するならPublicが簡単です。
   - README / .gitignore / license は追加しないで作成します。
2. 作成後に表示される `https://github.com/ユーザー名/uec-lab-matcher.git` をコピーします。
3. このフォルダで次を実行します。

```bash
git remote add origin https://github.com/ユーザー名/uec-lab-matcher.git
git branch -M main
git push -u origin main
```

4. GitHubのリポジトリ画面で `Settings` → `Pages` を開きます。
5. `Build and deployment` の `Source` を `Deploy from a branch` にします。
6. `Branch` を `main`、フォルダを `/root` にして `Save` します。
7. 数分後、次のようなURLで公開されます。

```text
https://ユーザー名.github.io/uec-lab-matcher/
```

公開URLをQRコードにすると、スマートフォンからすぐ利用できます。

公開時に必要なファイル：

- `index.html`
- `styles.css`
- `config.js`
- `data-service.js`
- `labs.js`
- `app.js`

`supabase-setup.sql`は公開しなくても動作します。

## 保存するデータ

Supabaseへ送るのは次の項目だけです。

```json
{
  "response_key": "ランダムなUUID",
  "event_code": "uec-open-campus-2026",
  "x": 40,
  "y": 60
}
```

次の情報はSupabaseへ送りません。

- 氏名
- メールアドレス
- 学校名
- 選択した興味分野
- 10問の個別回答

興味分野は、その場で研究室をランキングするためだけにブラウザ内で利用します。

## オフライン・通信障害時の動作

1. 回答をまずlocalStorageへ保存
2. Supabaseへ送信を試行
3. 成功した回答には送信済みフラグを付与
4. 失敗した回答は次回アクセス時に再送
5. Supabaseを読み込めない場合は端末内回答だけでグラフを表示

診断、採点、研究室推薦はすべてブラウザ内で行うため、データベース障害時も利用できます。

## ファイル構成

- `index.html`: 画面の土台
- `styles.css`: モノトーンのUI
- `config.js`: Supabase接続・イベント設定
- `data-service.js`: 共有保存、端末内保存、再送、フォールバック
- `app.js`: 質問、採点、マッチング、グラフ
- `labs.js`: 研究室データ
- `supabase-setup.sql`: テーブル、権限、RLSポリシー

## 現在の制約

1. 研究室の座標とタグは公式の短い研究紹介を基にした暫定値です。
2. 研究室はI類を中心とする14件のサンプルです。
3. 認証なしの公開投稿なので、URLとPublishable keyを知る人による大量投稿を完全には防げません。
4. 公開前に研究室側の座標・タグ確認と、小規模な質問項目テストが必要です。
5. 共有済み回答を来場者のブラウザから削除する機能はありません。削除はSupabase Dashboard側で行います。

## 次の開発候補

- ラボガイド掲載研究室の追加
- 研究室向け座標・タグ確認フォーム
- 管理者用の回答分布・時間帯別件数画面
- 同一端末からの短時間連続投稿の抑制
- QRコード付きの公開案内画面
- 質問項目とマッチング重みの事前評価

## 公式情報

- UECラボガイド: https://www.uec.ac.jp/arc/laboguide.html
- Supabase Data REST API: https://supabase.com/docs/guides/api
- Supabase API Keys: https://supabase.com/docs/guides/getting-started/api-keys
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
