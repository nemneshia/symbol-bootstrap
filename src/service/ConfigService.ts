/*
 * Copyright 2022 Fernando Boucquez
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { KnownError } from '../errors/KnownError.js';
import { Logger } from '../logger/index.js';
import { Addresses, ConfigPreset } from '../model/index.js';
import {
  ICryptoPort,
  INetworkPort,
  SymbolCryptoAdapter,
  SymbolNetworkAdapter,
} from '../sdk/index.js';
import { Constants } from '../utils/Constants.js';
import { CryptoUtils } from '../utils/CryptoUtils.js';
import { Utils } from '../utils/Utils.js';
import { Password, YamlUtils } from '../utils/YamlUtils.js';
import { DefaultAccountResolver } from './AccountResolver.js';
import { AddressesService } from './AddressesService.js';
import { ConfigLoader } from './ConfigLoader.js';
import { ConfigParams, ConfigResult } from './ConfigTypes.js';
import { FileSystemService } from './FileSystemService.js';
import { GatewayConfigurationService } from './GatewayConfigurationService.js';
import { NemesisConfigurationService } from './NemesisConfigurationService.js';
import { NodeConfigurationService } from './NodeConfigurationService.js';
import { RemoteNodeService } from './RemoteNodeService.js';

/**
 * ネットワーク設定生成の全体を管理するコーディネーターサービス。
 *
 * 以下のサービスに処理を委譲し、設定生成フローをオーケストレーションする:
 * - {@link AddressesService}: ノードアドレスの生成
 * - {@link NodeConfigurationService}: ノード証明書・ノード設定ファイルの生成
 * - {@link NemesisConfigurationService}: Nemesis ブロック設定の生成・コピー
 * - {@link GatewayConfigurationService}: REST ゲートウェイ設定ファイルの生成
 */
export class ConfigService {
  /**
   * `ConfigService` のデフォルト実行パラメーター。
   * コマンドラインからパラメーターが省略された場合に使用される。
   */
  public static defaultParams: ConfigParams = {
    target: Constants.defaultTargetFolder,
    workingDir: Constants.defaultWorkingDir,
    offline: false,
    reset: false,
    upgrade: false,
    user: Constants.CURRENT_USER,
    accountResolver: new DefaultAccountResolver(),
  };

  private readonly configLoader: ConfigLoader;
  private readonly fileSystemService: FileSystemService;
  private readonly addressesService: AddressesService;
  private readonly nodeConfigService: NodeConfigurationService;
  private readonly nemesisConfigService: NemesisConfigurationService;
  private readonly gatewayConfigService: GatewayConfigurationService;

  /**
   * @param logger ログ出力インターフェース
   * @param params 設定生成パラメーター
   * @param cryptoPort 暗号処理ポート（デフォルト: Symbol 実装）
   * @param networkPort ネットワーク処理ポート（デフォルト: Symbol 実装）
   */
  constructor(
    private readonly logger: Logger,
    private readonly params: ConfigParams,
    private readonly cryptoPort: ICryptoPort = new SymbolCryptoAdapter(),
    private readonly networkPort: INetworkPort = new SymbolNetworkAdapter()
  ) {
    this.configLoader = new ConfigLoader(logger);
    this.fileSystemService = new FileSystemService(logger);
    this.addressesService = new AddressesService(logger, params.accountResolver, cryptoPort);
    this.nodeConfigService = new NodeConfigurationService(
      logger,
      params,
      cryptoPort,
      this.fileSystemService
    );
    this.nemesisConfigService = new NemesisConfigurationService(
      logger,
      params,
      cryptoPort,
      this.fileSystemService
    );
    this.gatewayConfigService = new GatewayConfigurationService(
      logger,
      params,
      this.fileSystemService
    );
  }

  /**
   * 設定プリセットを解決して返す。
   *
   * - 生成済みの `preset.yaml` が存在し、かつアップグレードモードでない場合は既存ファイルを読み込んで返す。
   * - それ以外（未生成またはアップグレード）の場合は現在のパラメーターから新規に解決して返す。
   *
   * @param password 復号パスワード
   * @returns 解決済みの ConfigPreset
   */
  public resolveConfigPreset(password: Password): ConfigPreset {
    const target = this.params.target;
    const presetLocation = this.configLoader.getGeneratedPresetLocation(target);
    if (existsSync(presetLocation) && !this.params.upgrade) {
      return this.configLoader.loadExistingPresetData(target, password);
    }
    const oldPresetData = this.configLoader.loadExistingPresetDataIfPreset(target, password);
    return this.resolveCurrentPresetData(oldPresetData, password);
  }

  /**
   * 設定生成の本体処理。
   *
   * 以下の順序で処理を実行する:
   * 1. リセット時はターゲットフォルダーを削除
   * 2. 生成済みファイルが存在し、かつアップグレードでない場合は早期リターン
   * 3. 旧データの読み込みと整合性チェック
   * 4. プリセット解決 → コンテナ名プレフィックス適用 → アドレス生成
   * 5. 設定ファイル群の生成パイプライン実行
   * 6. YAML ファイルへの書き出し
   *
   * @returns 生成されたプリセットデータとアドレスデータ
   * @throws KnownError プリセットとアドレスファイルの整合性エラー
   */
  public async run(): Promise<ConfigResult> {
    const target = this.params.target;
    try {
      if (this.params.reset) {
        this.fileSystemService.deleteFolder(target);
      }

      const password = this.params.password;

      // 生成済みファイルが存在しアップグレードでない場合は早期リターン
      const earlyResult = this.loadExistingOrReturnEarly(target, password);
      if (earlyResult) return earlyResult;

      const { oldPresetData, oldAddresses } = this.loadAndValidateOldData(target, password);
      const isUpgrade = !!oldPresetData || !!oldAddresses;

      const presetData: ConfigPreset = this.resolveCurrentPresetData(oldPresetData, password);
      // this.applyContainerNamePrefixes(presetData);

      const addresses = await this.addressesService.resolveAddresses(
        oldAddresses,
        oldPresetData,
        presetData
      );
      const privateKeySecurityMode = CryptoUtils.getPrivateKeySecurityMode(
        presetData.privateKeySecurityMode
      );
      await this.fileSystemService.mkdir(target);

      const remoteNodeService = new RemoteNodeService(
        this.logger,
        presetData,
        this.params.offline,
        this.networkPort
      );

      await this.executeGenerationPipeline(presetData, addresses, remoteNodeService, isUpgrade);
      await this.writeOutputFiles(presetData, addresses, password, privateKeySecurityMode);

      this.logger.info('設定の生成が完了しました。');
      return { presetData, addresses };
    } catch (e) {
      if ((e as any).known) {
        this.logger.error(Utils.getMessage(e));
      } else {
        this.logger.error(`設定生成中に不明なエラーが発生しました。${Utils.getMessage(e)}`, e);
        this.logger.error(`ターゲットフォルダー '${target}' を削除してください。`);
      }
      throw e;
    }
  }

  /**
   * 生成済みプリセットファイルが存在し、かつアップグレードモードでない場合に既存ファイルを返す。
   * アップグレードまたは未生成の場合は `undefined` を返し、通常フローに進む。
   *
   * @param target ターゲットフォルダーパス
   * @param password 復号パスワード
   * @returns 既存の設定結果、または `undefined`
   */
  private loadExistingOrReturnEarly(target: string, password: Password): ConfigResult | undefined {
    const presetLocation = this.configLoader.getGeneratedPresetLocation(target);
    if (!existsSync(presetLocation) || this.params.upgrade) return undefined;

    this.logger.info(
      `生成済みプリセット ${presetLocation} は既に存在するため、設定生成をスキップします。（リセットは -r、アップグレードは --upgrade を実行）`
    );
    return {
      presetData: this.configLoader.loadExistingPresetData(target, password),
      addresses: this.configLoader.loadExistingAddresses(target, password),
    };
  }

  /**
   * 旧プリセットデータおよび旧アドレスデータを読み込み、両者の整合性を検証する。
   * 一方のみ存在する場合はリセットを促すエラーを送出する。
   *
   * @param target ターゲットフォルダーパス
   * @param password 復号パスワード
   * @returns 旧プリセットデータと旧アドレスデータのペア
   * @throws KnownError プリセット・アドレスどちらか一方のみ存在する場合
   */
  private loadAndValidateOldData(
    target: string,
    password: Password
  ): { oldPresetData: ConfigPreset | undefined; oldAddresses: Addresses | undefined } {
    const presetLocation = this.configLoader.getGeneratedPresetLocation(target);
    const addressesLocation = this.configLoader.getGeneratedAddressLocation(target);

    const oldPresetData = this.configLoader.loadExistingPresetDataIfPreset(target, password);
    if (oldPresetData) {
      // アップグレード時は既知ピア情報を削除して再取得する
      delete oldPresetData.knownPeers;
      delete oldPresetData.knownRestGateways;
    }
    const oldAddresses = this.configLoader.loadExistingAddressesIfPreset(target, password);

    // 両ファイルが揃っていない状態でのアップグレードは不整合を招くためエラーとする
    if (oldAddresses && !oldPresetData) {
      throw new KnownError(
        `以前の ${presetLocation} ファイルがないため、設定をアップグレードできません。（リセットは -r を実行）`
      );
    }
    if (!oldAddresses && oldPresetData) {
      throw new KnownError(
        `以前の ${addressesLocation} ファイルがないため、設定をアップグレードできません。（リセットは -r を実行）`
      );
    }
    if (oldAddresses && oldPresetData) {
      this.logger.info('設定をアップグレードします...');
    }

    return { oldPresetData, oldAddresses };
  }

  /**
   * Docker Compose プロジェクト名プレフィックスをコンテナ関連フィールドへ付与する。
   * `dockerComposeProjectName` が未設定の場合はプレフィックスなしでそのまま維持する。
   *
   * @param presetData プレフィックスを適用するプリセットデータ（破壊的変更）
   */
  public applyContainerNamePrefixes(presetData: ConfigPreset): void {
    const prefix = presetData.dockerComposeProjectName
      ? `${presetData.dockerComposeProjectName}-`
      : '';
    if (!prefix) return;

    const withPrefix = <T extends string | undefined>(v: T): T => (v ? prefix + v : v) as T;

    if (presetData.node) {
      presetData.node = {
        ...presetData.node,
        name: withPrefix(presetData.node.name),
        databaseHost: withPrefix(presetData.node.databaseHost),
        brokerName: withPrefix(presetData.node.brokerName),
      };
    }
    if (presetData.gateway) {
      presetData.gateway = {
        ...presetData.gateway,
        name: withPrefix(presetData.gateway.name),
        apiNodeName: withPrefix(presetData.gateway.apiNodeName),
        databaseHost: withPrefix(presetData.gateway.databaseHost),
        apiNodeHost: withPrefix(presetData.gateway.apiNodeHost),
        apiNodeBrokerHost: withPrefix(presetData.gateway.apiNodeBrokerHost),
      };
    }
    if (presetData.database) {
      presetData.database = {
        ...presetData.database,
        name: prefix + (presetData.database.name ?? ''),
      };
    }
  }

  /**
   * 設定ファイル生成パイプラインを実行する。
   * cleanUp → 証明書生成 → ノード設定 → ゲートウェイ設定 → Nemesis の順で実行する。
   *
   * @param presetData 生成に使用するプリセットデータ
   * @param addresses 解決済みアドレスデータ
   * @param remoteNodeService リモートノードサービス
   * @param isUpgrade アップグレードモードフラグ（Nemesis スキップ判定に使用）
   */
  private async executeGenerationPipeline(
    presetData: ConfigPreset,
    addresses: Addresses,
    remoteNodeService: RemoteNodeService,
    isUpgrade: boolean
  ): Promise<void> {
    this.cleanUpConfiguration(presetData);
    await this.nodeConfigService.generateNodeCertificates(presetData, addresses);
    await this.nodeConfigService.generateNodes(presetData, addresses, remoteNodeService);
    await this.gatewayConfigService.generateGateways(presetData);

    if (presetData.node) {
      await this.nemesisConfigService.resolveNemesis(presetData, addresses, isUpgrade);
      await this.nemesisConfigService.copyNemesis(addresses);
    }
  }

  /**
   * 生成されたアドレスデータとプリセットデータを YAML ファイルへ書き出す。
   * 秘密鍵セキュリティモードに従い、書き出し前に秘密鍵を削除または保持する。
   *
   * @param presetData 書き出すプリセットデータ
   * @param addresses 書き出すアドレスデータ
   * @param password 暗号化パスワード
   * @param privateKeySecurityMode 秘密鍵の保持ポリシー
   */
  private async writeOutputFiles(
    presetData: ConfigPreset,
    addresses: Addresses,
    password: Password,
    privateKeySecurityMode: ReturnType<typeof CryptoUtils.getPrivateKeySecurityMode>
  ): Promise<void> {
    const target = this.params.target;
    const addressesLocation = this.configLoader.getGeneratedAddressLocation(target);
    const presetLocation = this.configLoader.getGeneratedPresetLocation(target);

    await YamlUtils.writeYaml(
      addressesLocation,
      CryptoUtils.removePrivateKeysAccordingToSecurityMode(addresses, privateKeySecurityMode),
      password
    );
    await YamlUtils.writeYaml(presetLocation, CryptoUtils.removePrivateKeys(presetData), password);
  }

  /**
   * 現在のパラメーターから新しい ConfigPreset を解決して返す。
   *
   * @param oldPresetData アップグレード時の旧プリセットデータ（新規生成時は `undefined`）
   * @param password 復号パスワード
   * @returns 解決済みの ConfigPreset
   */
  private resolveCurrentPresetData(
    oldPresetData: ConfigPreset | undefined,
    password: Password
  ): ConfigPreset {
    return this.configLoader.createPresetData({
      ...this.params,
      password,
      oldPresetData,
    });
  }

  /**
   * 既存の設定フォルダーをクリーンアップする。
   * アップグレード時に古い設定ファイルが残留しないよう、再生成前に対象ディレクトリを削除する。
   * ゲートウェイの SSL 証明書は削除対象から除外する。
   *
   * @param presetData クリーンアップ対象のノード・ゲートウェイ一覧を含むプリセットデータ
   */
  private cleanUpConfiguration(presetData: ConfigPreset): void {
    const target = this.params.target;

    // ノードごとに設定・ブローカー設定・ユーザー設定・シードフォルダーを削除する
    const nodeName = presetData.node?.name;
    if (nodeName) {
      this.fileSystemService.deleteFolder(
        this.fileSystemService.getTargetNodesFolder(target, false, nodeName, 'server-config')
      );
      this.fileSystemService.deleteFolder(
        this.fileSystemService.getTargetNodesFolder(target, false, nodeName, 'broker-config')
      );
      this.fileSystemService.deleteFolder(
        this.fileSystemService.getTargetNodesFolder(target, false, nodeName, 'userconfig')
      );
      this.fileSystemService.deleteFolder(
        this.fileSystemService.getTargetNodesFolder(target, false, nodeName, 'seed')
      );
    }

    // ゲートウェイごとに設定フォルダーを削除する（SSL 証明書ファイルは除外）
    if (presetData.gateway) {
      const gatewayName = presetData.gateway.name || 'gateway';
      const configFolder = this.fileSystemService.getTargetGatewayFolder(
        target,
        false,
        gatewayName
      );
      this.fileSystemService.deleteFolder(configFolder, [
        join(configFolder, presetData.restSSLKeyFileName),
        join(configFolder, presetData.restSSLCertificateFileName),
      ]);
    }
  }
}
