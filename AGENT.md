# Agent Guide

このファイルは、このリポジトリで作業するエージェント向けの実行ガイドです。  
目的は、`npm` / `pnpm` / `Yarn` / `Yarn PnP` の `install` / `ci` ベンチマークを、再現可能な手順で比較することです。

## 1. ゴールと非ゴール

### ゴール

- 同一条件で各パッケージマネージャーのベンチマークを取得する。
- `results` と `README.md` の整合を保つ。
- 変更内容と測定条件を PR に明記し、第三者が再実行できる状態にする。

### 非ゴール

- ベンチ結果と無関係な依存追加・大規模リファクタ。
- `README.md` の自動生成ブロック (`<!-- BENCH:START -->` 〜 `<!-- BENCH:END -->`) の手編集。
  - ベンチマーク表の出力内容を変えたい場合は `README.md` を直接編集せず、`bench/render-readme.mjs`（必要に応じて `bench/merge-results.mjs` / `bench/run.mjs`）を変更する。

## 2. 前提環境

- Node.js と `npm` / `pnpm` / `yarn` が PATH にあること。
- 実行環境の違い（OS、CPU、ストレージ、ネットワーク）で測定値が変わる点を理解すること。
- 比較用途では、同一マシン・同一負荷状態で繰り返し測定すること。

## 3. 主要ファイル

- `bench/run.mjs`
  - ベンチマーク実行本体（ケース生成、状態初期化、実行、JSON 出力）。
- `bench/merge-results.mjs`
  - `results/partial/*.json` を統合して `results/results.json` を作成。
- `bench/render-readme.mjs`
  - `results/results.json` を元に `README.md` のベンチ表を再生成。
- `results/results.json`
  - 集約済みの結果（README 生成元）。

## 4. 標準ワークフロー

1. **変更内容を確認**
   - ベンチ条件や依存定義に影響する変更かどうかを確認する。
2. **ベンチを実行**
   - 例: `npm run bench:run -- --node 24 --scope all`
3. **結果を統合**
   - `npm run bench:merge`
4. **README を再生成**
   - `npm run bench:render`
5. **差分確認**
   - `results/results.json` と `README.md` が意図どおり更新されているか確認する。
6. **コミット**
   - 実行条件（Node version、scope、必要なら cache mode）をコミットメッセージまたは PR 本文に残す。

## 5. よく使うコマンド

```bash
npm run bench:run -- --node 24 --scope all
npm run bench:run -- --node 24 --scope npm
npm run bench:run -- --node 24 --scope all --cache-mode all
npm run bench:merge
npm run bench:render
```

## 6. 変更ポリシー

- `package.json` の依存セット変更時は、**なぜ比較条件を変える必要があるか**を明記する。
- ベンチ条件（実行ケース、run 回数、cache 取り扱い）を変える場合は、PR で影響範囲を説明する。
- README のベンチ表を変更したい場合は `README.md` の該当ブロックを直編集せず、出力元の JS（主に `bench/render-readme.mjs`）を更新する。
- ドキュメントのみ変更でも、必要に応じて手順との整合性を確認する。

## 7. トラブルシュート

- ツール未導入エラー
  - `npm` / `pnpm` / `yarn` のインストール状況と PATH を確認する。
- 結果ファイルが期待どおり更新されない
  - `bench:merge` → `bench:render` の順序で再実行する。
- 差分が大きく不安定
  - 同条件で再実行し、実行中のバックグラウンド負荷を下げて再測定する。

## 8. PR 記載テンプレート（推奨）

- 実行コマンド
- 実行環境（Node version / scope / cache mode）
- 変更ファイル
- 結果サマリー（どのケースがどう変わったか）
- 再現手順

## 9. 変更完了時チェック

```bash
npm run bench:merge
npm run bench:render
```

- `README.md` のベンチ表が `results/results.json` と一致している。
- 自動生成ブロックを手編集していない。
- 変更理由と実行条件を説明できる。
