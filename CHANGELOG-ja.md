# 変更履歴

このプロジェクトのすべての重要な変更はこのファイルに記録されます。

変更履歴の形式は[Keep a Changelog](https://keepachangelog.com/en/1.0.0/)に基づいています。

## [2.0.8] - 2026-04-19

### 変更
- ノードリストの取得をStatisticsServiceからNodeWatchに変更。

## [2.0.7] - 2025-11-30

### 変更
- Docker 29 向けにソフト/ハードリミットを設定追加。

## [2.0.6] - 2025-09-23

**マイルストーン**: メインネット(1.0.3.9)

| パッケージ       | バージョン | リンク                                                            |
| ---------------- | ---------- | ----------------------------------------------------------------- |
| Symbol Bootstrap | v2.0.6     | [symbol-bootstrap](https://github.com/nemneshia/symbol-bootstrap) |

以下のパッケージを更新する：
- [Catapult Client v1.0.3.9](https://github.com/symbol/symbol/releases/tag/client%2Fcatapult%2Fv1.0.3.9)
- [Rest 2.5.1](https://github.com/symbol/symbol/releases/tag/rest%2Fv2.5.1)
- MongoDB 7.0.23

### 追加
- legacy crypto-js 4.1.1互換性サポートと強化された暗号化への自動アップグレード
- legacy暗号化ファイル検出時のバックアップ作成機能
- legacy暗号化アップグレード機能の包括的なテストカバレッジ

### 修正
- crypto-js バージョン 4.1.1 と 4.2.0+ の暗号化方式間の互換性問題
- decryptコマンドでのlegacy暗号化アドレスのバックアップファイル作成問題

### 変更
- legacy暗号化データのフォールバック復号化機能でCryptoUtilsを強化
- 暗号化アップグレードをシームレスに処理するためのYamlUtilsとConfigLoaderの改善

## [2.0.5] - 2025-04-17

**マイルストーン**: メインネット(1.0.3.8)

| パッケージ       | バージョン | リンク                                                            |
| ---------------- | ---------- | ----------------------------------------------------------------- |
| Symbol Bootstrap | v2.0.5     | [symbol-bootstrap](https://github.com/nemneshia/symbol-bootstrap) |

- ノード証明書を x509v3 に変更  
  CA 証明書から作り直す必要があるので、`cert` ディレクトリを削除して再生成する必要があります。

  ```bash
  rm -rf target/nodes/node/cert
  sb config -c custom-preset.yaml --upgrade
  ```

- Metal デコードを無効化可能に変更

  ```yaml
  metal: null
  ```

  なお、キャッシュサイズの変更方法は以下の通りです。

  ```yaml
  metal:
    cacheTtl: 350
    sizeLimit: 15000000
  ```

## [2.0.4] - 2025-04-10

**マイルストーン**: メインネット(1.0.3.8)

| パッケージ       | バージョン | リンク                                                            |
| ---------------- | ---------- | ----------------------------------------------------------------- |
| Symbol Bootstrap | v2.0.4     | [symbol-bootstrap](https://github.com/nemneshia/symbol-bootstrap) |

- エクスプローラの Docker イメージを symbolplatform/symbol-explorer:1.3.0-amd64 に変更

## [2.0.3] - 2025-04-09

**マイルストーン**: メインネット(1.0.3.8)

| パッケージ       | バージョン | リンク                                                            |
| ---------------- | ---------- | ----------------------------------------------------------------- |
| Symbol Bootstrap | v2.0.3     | [symbol-bootstrap](https://github.com/nemneshia/symbol-bootstrap) |

- Docker Compose にプロジェクト名のプレフィックスを追加

## [2.0.2] - 2025-03-06

**マイルストーン**: メインネット(1.0.3.8)

| パッケージ       | バージョン | リンク                                                            |
| ---------------- | ---------- | ----------------------------------------------------------------- |
| Symbol Bootstrap | v2.0.2     | [symbol-bootstrap](https://github.com/nemneshia/symbol-bootstrap) |

- アセンブリが Peer のときの Docker Compose プロジェクトの対応漏れを修正

## [2.0.1] - 2025-02-27

**マイルストーン**: メインネット(1.0.3.8)

| パッケージ       | バージョン | リンク                                                            |
| ---------------- | ---------- | ----------------------------------------------------------------- |
| Symbol Bootstrap | v2.0.1     | [symbol-bootstrap](https://github.com/nemneshia/symbol-bootstrap) |

- [Catapult Client v1.0.3.8](https://github.com/symbol/symbol/releases/tag/client%2Fcatapult%2Fv1.0.3.8)
- [Rest 2.5.0](https://github.com/symbol/symbol/releases/tag/rest%2Fv2.5.0)
- MongoDB 7.0.17
- Docker Compose プロジェクトに対応

## [2.0.0] - 2025-02-24

**マイルストーン**: メインネット(1.0.3.7)

| パッケージ       | バージョン | リンク                                                            |
| ---------------- | ---------- | ----------------------------------------------------------------- |
| Symbol Bootstrap | v2.0.0     | [symbol-bootstrap](https://github.com/nemneshia/symbol-bootstrap) |

- crypto-js を v4.2 に変更(**旧バージョンとキー暗号化互換性なし**)
- docker compose v2 を使用する
- oclif を v1 から v4 に変更
- 上記に伴うコード全体の ESM 化

## [1.1.13] - 2025-02-15

**マイルストーン**: メインネット(1.0.3.7)

| パッケージ       | バージョン | リンク                                                            |
| ---------------- | ---------- | ----------------------------------------------------------------- |
| Symbol Bootstrap | v1.1.13    | [symbol-bootstrap](https://github.com/nemneshia/symbol-bootstrap) |

以下のパッケージを更新：

- カスタムプリセットでピアのリスニングポートを変更可能に

### エクスプローラー設定の例

```yaml
explorers:
  - excludeDockerService: false
```

### ピアのリスニングポートを変更する例

```yaml
nodePort: 7950
apiNodePort: 7950
nodes:
  - openPort: 7950
```

## [1.1.12] - 2025-02-15

**マイルストーン**: メインネット(1.0.3.7)

| パッケージ       | バージョン | リンク                                                            |
| ---------------- | ---------- | ----------------------------------------------------------------- |
| Symbol Bootstrap | v1.1.12    | [symbol-bootstrap](https://github.com/nemneshia/symbol-bootstrap) |

以下のパッケージを更新：

- Rest での Metal デコードのサポート
- config-node.properties のいくつかの項目のデフォルト値を変更
  - maxChainBytesPerSyncAttempt: 50MB
  - blockDisruptorMaxMemorySize: 1000MB
- config-finalization.properties のいくつかの項目のデフォルト値を変更
  - messageSynchronizationMaxResponseSize: 5MB
