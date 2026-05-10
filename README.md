# symbol-bootstrap

このプロジェクトは [@fboucquez/symbol-bootstrap](https://github.com/fboucquez/symbol-bootstrap) と [@symbol/symbol-bootstrap](https://github.com/symbol/symbol-bootstrap) からのフォークです。

[@nemneshia/symbol-bootstrap](https://github.com/nemneshia/symbol-bootstrap) は、Symbol ブロックチェーンネットワークの構築・設定・運用を行うための CLI ツールです。

このツールを使うことで、既存の Symbol ネットワーク（Mainnet、Testnet）に参加するノードの構築、あるいはプライベート Symbol ネットワークの構築・起動・保守を簡単に行えます。

## 特徴

- **スタンドアロン CLI**：repo をクローンせずに、npm からインストールして使用可能
- **One-liner コマンド**：`symbol-bootstrap start` で設定、イメージ生成、Docker 起動を一度に実行
- **プリセット・カスタマイズ対応**：Network、Assembly、Custom Preset を組み合わせてノード構成を柔軟に定義
- **パスワード・秘密鍵管理**：暗号化ファイル対応（`encrypt` / `decrypt`）
- **Docker Compose 自動生成**：設定から docker-compose.yml を自動生成
- **Node.js SDK統合**：キー生成、署名、VRF、投票ファイル生成などを TS SDK で実行
- **充実した運用コマンド**：停止、ヘルスチェック、リセット、証明書更新、投票キー更新など

## 動作要件

- **Node.js 20.0.0 以上**
- **Docker 20.10.13 以上**
- **Docker Compose 2.0.0 以上**

Docker をユーザー権限で実行できることを確認してください：

```shell
docker run hello-world
```

もし下記のエラーが表示される場合：

```plaintext
Got permission denied while trying to connect to the Docker daemon socket at unix:///var/run/docker.sock
```

以下の手順で Docker グループにユーザーを追加してください：

```shell
sudo usermod -aG docker $USER
newgrp docker
```

## インストール

### グローバルインストール（推奨）

```shell
npm install -g @nemneshia/symbol-bootstrap
```

CLI は `symbol-bootstrap` または `sb` で呼び出せます：

```shell
symbol-bootstrap --version
sb --help
```

### ローカルインストール

プロジェクトディレクトリで開発する場合：

```shell
pnpm install
pnpm run build
```

## クイックスタート

### 1. 環境確認

```shell
symbol-bootstrap verify
```

### 2. ノード初期化

作業用ディレクトリを作成して移動してください。設定、データ、Docker ファイルは `./target` フォルダに生成されます：

```shell
mkdir my-node
cd my-node
```

### 3. ノード起動（推奨）

最も簡単な方法は `start` コマンド：

```shell
symbol-bootstrap start -p testnet -a dual -c custom_preset.yaml
```

- `-p testnet`：Network preset（`testnet` または `mainnet`）
- `-a dual`：Assembly（`peer`、`api`、`dual`）
- `-c custom_preset.yaml`：カスタム設定ファイル（オプション）

パスワード入力を求められます。対話的に入力するか、以下のオプションを使用できます：

```shell
# パスワード指定
symbol-bootstrap start -p testnet -a dual --password mypassword

# パスワードなし（暗号化しない）
symbol-bootstrap start -p testnet -a dual --noPassword

# 標準入力からパスワード読み込み
echo "mypassword" | symbol-bootstrap start -p testnet -a dual
```

### 4. 分割実行

より細かい制御が必要な場合、以下を順に実行します：

```shell
# ステップ 1：設定ファイル生成
symbol-bootstrap config -p testnet -a dual -c custom_preset.yaml

# ステップ 2：docker-compose.yml 生成
symbol-bootstrap compose

# ステップ 3：Docker 起動
symbol-bootstrap run
```

### 5. ノード停止

```shell
symbol-bootstrap stop
```

### 6. ヘルスチェック

```shell
symbol-bootstrap checkHealth
```

## 概念

### Network Preset

ネットワーク全体の構成を定義する Yaml ファイル：

- **`mainnet`**：Symbol Mainnet に参加するノード用
- **`testnet`**：Symbol Testnet に参加するノード用

### Assembly

ノードに含める機能やコンポーネントを定義：

| Assembly | 構成                                                  | 用途           |
| -------- | ----------------------------------------------------- | -------------- |
| `peer`   | Peer ノード + Light REST Gateway                      | ピア専用ノード |
| `api`    | DB + API ノード + REST Gateway + Broker               | API サーバー用 |
| `dual`   | DB + API ノード + REST Gateway + Broker + Peer ノード | 兼用ノード     |

### Custom Preset

ユーザー定義の Yaml ファイル（`-c` / `--customPreset`）で、Network Preset や Assembly の設定を上書き。ルート直下の [custom_preset.yaml](custom_preset.yaml) に実際の例があります：

```yaml
# custom_preset.yaml の例
assembly: dual
preset: testnet

# パスワード入力モード
privateKeySecurityMode: PROMPT_MAIN_TRANSPORT

# ノード設定
node:
  host: my-node.example.com
  friendlyName: my-peer
  voting: false

# 委任ハーベスタ設定
maxUnlockedAccounts: 100
delegatePrioritizationPolicy: Importance
beneficiaryAddress: TBQLP7SU7WMUK3XYMIJZPWIT2HJ3PTVJPWFJNJQ
```

### Target フォルダ構成

自動生成される `./target` フォルダには以下が含まれます：

```
target/
├── preset.yml              # 最終生成設定（Network + Assembly + Custom の統合）
├── addresses.yml           # 生成された秘密鍵、SSL キーなど
├── node/                   # ノード設定・データ・ログ
├── gateway/                # REST Gateway 設定・ログ
├── nemesis/                # Genesis ブロック
├── database/               # MongoDB データ
└── docker/                 # docker-compose.yml など
```

**⚠️ 注意**：Target フォルダは自動生成され、アップグレード時に上書きされます。カスタム設定は必ずカスタム Preset ファイルで行ってください。

## パスワード・秘密鍵管理

### パスワード入力方法

デフォルトではパスワード入力を求められます：

```shell
# 対話的に入力
symbol-bootstrap config -p testnet -a dual

# コマンドラインで指定
symbol-bootstrap config -p testnet -a dual --password mypassword

# 標準入力から読み込み
echo "mypassword" | symbol-bootstrap config -p testnet -a dual

# パスワードなし（暗号化しない）
symbol-bootstrap config -p testnet -a dual --noPassword
```

### 秘密鍵を含む Preset の暗号化・復号化

秘密鍵を含む Custom Preset は暗号化して保管できます：

```shell
# Preset 暗号化
symbol-bootstrap encrypt -s custom_preset.yaml -d custom_preset.encrypted.yaml

# Preset 復号化
symbol-bootstrap decrypt -s custom_preset.encrypted.yaml -d custom_preset.yaml
```

## 運用コマンド

| コマンド            | 説明                                                                 |
| ------------------- | -------------------------------------------------------------------- |
| `verify`            | 環境要件チェック（Node.js、Docker、Docker Compose のバージョン確認） |
| `config`            | ネットワーク設定ファイル、nemesis ブロック生成                       |
| `compose`           | docker-compose.yml 生成                                              |
| `run`               | Docker Compose で起動                                                |
| `start`             | config + compose + run を一括実行                                    |
| `stop`              | Docker Compose 停止（`docker compose down`）                         |
| `checkHealth`       | サービス稼働状況確認                                                 |
| `resetData`         | ノードデータをリセット（設定・キー・ブロック1は保持）                |
| `clean`             | Target フォルダ全削除                                                |
| `renewCertificates` | SSL 証明書更新（秘密鍵は保持）                                       |
| `updateVotingKeys`  | 投票キーファイル更新                                                 |
| `link`              | VRF / Voting Link トランザクション発行（ノード登録完了）             |
| `modifyMultisig`    | マルチシグアカウント作成・変更                                       |
| `encrypt`           | Yaml ファイル暗号化                                                  |
| `decrypt`           | Yaml ファイル復号化                                                  |
| `pack`              | ノード設定を zip 圧縮（別マシンへの移行用）                          |

## 利用例

### Testnet にノード参加（Dual Assembly）

```shell
symbol-bootstrap start -p testnet -a dual
```

### Mainnet へピアノード追加

```shell
symbol-bootstrap start -p mainnet -a peer -c custom_preset.yaml
```

### API サーバー構築

```shell
symbol-bootstrap start -p testnet -a api
```

### カスタムネットワークプリセット使用

独自の Symbol ネットワークを構築する場合、ネットワークプリセット Yaml と nemesis ブロックを別途提供：

```shell
symbol-bootstrap start -p /path/to/custom_network.yml -a dual -c /path/to/custom_node.yaml
```

### 初期状態への戻す

新しく設定し直す場合：

```shell
symbol-bootstrap clean
symbol-bootstrap start -p testnet -a dual
```

## 開発

このリポジトリに貢献したい場合、クローンして開発環境を構築：

```shell
pnpm install
pnpm run build
pnpm test
pnpm run lint
pnpm run style:fix
```

開発中は以下のコマンドで実行：

```shell
symbol-bootstrap <command> [options]
```

### ライセンス

Apache-2.0

### Issue / Pull Request

バグ報告、機能要望、プルリクエストは [GitHub Issues](https://github.com/nemneshia/symbol-bootstrap/issues) でお待ちしています。
