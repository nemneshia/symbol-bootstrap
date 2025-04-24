# 変更履歴

このプロジェクトのすべての重要な変更はこのファイルに記録されます。

変更履歴の形式は[Keep a Changelog](https://keepachangelog.com/en/1.0.0/)に基づいています。

## [2.0.6] - 2025-04-24

**マイルストーン**: メインネット(1.0.3.8)

| パッケージ       | バージョン | リンク                                                            |
| ---------------- | ---------- | ----------------------------------------------------------------- |
| Symbol Bootstrap | v2.0.6     | [symbol-bootstrap](https://github.com/nemneshia/symbol-bootstrap) |

- `healthCheck` が `Ctrl + C` 待機中でも終了するように修正
- `-v` オプションでバージョン確認が可能になるように対応

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

  ```yaml
  nodes:
    - host: <ホスト名>
      friendlyName: <フレンドリー名>
      voting: false
      trustedHosts: 127.0.0.1, 172.21.0.25 # ネットワークのサブネットを変更する場合(Apiノード用)
      localNetworks: 127.0.0.1, 172.21.0.25 # ネットワークのサブネットを変更する場合(Apiノード用)

  # RESTの設定
  gateways:
    - ipv4_address: 172.21.0.25 # ネットワークのサブネットを変更する場合

    # コンテナ名にプレフィックスを付与
    dockerComposeProjectName: mainnet
    # ネットワークのサブネット変更
    subnet: "172.21.0.0/24"
  ```

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
