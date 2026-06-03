# Architecture

## Overview

Cloudflare Workers 上でHono APIとViteでビルドしたReact SPAを配信する。永続データはCloudflare D1に保存する。

```text
Browser
  |
  | /              React SPA assets
  | /api/*         Hono API
  v
Cloudflare Worker
  |
  v
Cloudflare D1
```

## Directory Responsibilities

- `src/worker/index.ts`: Worker entry point
- `src/worker/app.ts`: Hono app, global middleware, route registration
- `src/worker/middleware`: Basic認証、リクエストログ、エラーハンドリングを配置
- `src/worker/db`: D1取得処理
- `src/worker/features/*/*.routes.ts`: Hono route。入力検証とHTTPレスポンスを担当
- `src/worker/features/*/*.repository.ts`: D1アクセスを隠蔽
- `src/worker/features/*/*.service.ts`: 業務ロジックを担当
- `src/worker/features/*/*.schemas.ts`: zod schema
- `src/shared/types.ts`: APIとフロントで共有する型
- `src/web/routes`: React Router のページ単位コンポーネント
- `src/web/components`: UIと業務コンポーネント
- `src/web/lib/api-client.ts`: API呼び出しの集約

## Backend Layers

Route層は薄く保つ。

1. RouteでURL/JSONを受け取る
2. zodで入力検証する
3. Serviceを呼び出す
4. ServiceがRepositoryを組み合わせて業務ロジックを実行する
5. RepositoryがD1 SQLを実行する

編集系APIはBasic認証で保護する。認証方式を変える場合はmiddlewareを差し替える。

## Frontend Flow

React Routerでページを分ける。検索条件はURL queryに置き、スマホ・PC間でURL共有しやすくする。

- 一覧: `GET /api/parts` にqueryを渡す
- 詳細: `GET /api/parts/:id`
- 登録/編集: Basic認証済みセッションから API を呼び出す
- 管理画面: カテゴリ、タグ、保管場所、ステータス、カテゴリ別仕様項目をまとめる

## Export Flow

DBの保存構造はカテゴリに依存させない。カテゴリ差分は出力時に吸収する。

```text
PartsRepository
  -> ExportService
  -> getExportSchema(categorySlug)
  -> ExportRowBuilder
  -> ExcelExporter / PdfExporter / JsonExporter
```

MVPでは `export-schemas.ts` にカテゴリ別ヘッダをコード定義する。将来DB管理にする場合は、`getExportSchema` の取得元を `export_schemas` / `export_schema_columns` に差し替える。

## Import Flow

APIは正規化済みの行配列を受け取る。フロントでJSON/CSV/Excelを読み取り、JSON行に変換してから `POST /api/import/parts` に渡す。

`attributes_json` は `part_attributes` の複数行へ展開する。カテゴリとタグは存在しなければ作成する。
