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

import * as fs from 'fs';
import { join } from 'path';
import { KnownError } from '../errors/KnownError.js';
import { Logger } from '../logger/index.js';
import { ConfigPreset } from '../model/index.js';
import { ICryptoPort, INetworkPort, SymbolCryptoAdapter, SymbolNetworkAdapter } from '../sdk/index.js';
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
import { MigrationService } from './MigrationService.js';
import { NemesisConfigurationService } from './NemesisConfigurationService.js';
import { NodeConfigurationService } from './NodeConfigurationService.js';
import { RemoteNodeService } from './RemoteNodeService.js';
// 型・列挙型を ConfigTypes から再エクスポートして後方互換性を維持する
export * from './ConfigTypes.js';

/**
 * ネットワーク設定生成の全体を管理するコーディネーターサービス。
 * ノード設定・Nemesis 設定・ゲートウェイ設定の各サービスに処理を委譲する。
 */
export class ConfigService {
  /** デフォルトの実行パラメーター */
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

  constructor(
    private readonly logger: Logger,
    private readonly params: ConfigParams,
    private readonly cryptoPort: ICryptoPort = new SymbolCryptoAdapter(),
    private readonly networkPort: INetworkPort = new SymbolNetworkAdapter(),
  ) {
    this.configLoader = new ConfigLoader(logger);
    this.fileSystemService = new FileSystemService(logger);
    const migrationService = new MigrationService(logger, cryptoPort);
    this.addressesService = new AddressesService(logger, params.accountResolver, migrationService, cryptoPort);
    this.nodeConfigService = new NodeConfigurationService(logger, params, cryptoPort, this.fileSystemService);
    this.nemesisConfigService = new NemesisConfigurationService(logger, params, cryptoPort, this.fileSystemService);
    this.gatewayConfigService = new GatewayConfigurationService(logger, params, this.fileSystemService);
  }

  /**
   * 既存の preset.yml が存在する場合はそれを返し、
   * 存在しない（またはアップグレードモード）場合は現在のプリセットを解決して返す。
   */
  public resolveConfigPreset(password: Password): ConfigPreset {
    const target = this.params.target;
    const presetLocation = this.configLoader.getGeneratedPresetLocation(target);
    if (fs.existsSync(presetLocation) && !this.params.upgrade) {
      return this.configLoader.loadExistingPresetData(target, password);
    }
    const oldPresetData = this.configLoader.loadExistingPresetDataIfPreset(target, password);
    return this.resolveCurrentPresetData(oldPresetData, password);
  }

  /**
   * 設定生成の本体処理。
   * アドレス生成 → クリーンアップ → 証明書生成 → ノード設定 → ゲートウェイ設定 → Nemesis → ファイル書き出し の順で実行する。
   */
  public async run(): Promise<ConfigResult> {
    const target = this.params.target;
    try {
      if (this.params.reset) {
        this.fileSystemService.deleteFolder(target);
      }

      const presetLocation = this.configLoader.getGeneratedPresetLocation(target);
      const addressesLocation = this.configLoader.getGeneratedAddressLocation(target);
      const password = this.params.password;

      // 既に生成済みでアップグレードでない場合は既存ファイルを返す
      if (fs.existsSync(presetLocation) && !this.params.upgrade) {
        this.logger.info(
          `The generated preset ${presetLocation} already exist, ignoring configuration. (run -r to reset or --upgrade to upgrade)`,
        );
        const presetData = this.configLoader.loadExistingPresetData(target, password);
        const addresses = this.configLoader.loadExistingAddresses(target, password);
        return { presetData, addresses };
      }

      const oldPresetData = this.configLoader.loadExistingPresetDataIfPreset(target, password);
      if (oldPresetData) {
        // アップグレード時は既知ピア情報を削除して再取得する
        delete oldPresetData.knownPeers;
        delete oldPresetData.knownRestGateways;
      }
      const oldAddresses = this.configLoader.loadExistingAddressesIfPreset(target, password);

      if (oldAddresses && !oldPresetData) {
        throw new KnownError(`Configuration cannot be upgraded without a previous ${presetLocation} file. (run -r to reset)`);
      }
      if (!oldAddresses && oldPresetData) {
        throw new KnownError(`Configuration cannot be upgraded without a previous ${addressesLocation} file. (run -r to reset)`);
      }
      if (oldAddresses && oldPresetData) {
        this.logger.info('Upgrading configuration...');
      }

      const presetData: ConfigPreset = this.resolveCurrentPresetData(oldPresetData, password);

      // Docker Compose プロジェクト名プレフィックスをコンテナ名に付与する
      const containerNamePrefix = presetData.dockerComposeProjectName ? `${presetData.dockerComposeProjectName}-` : '';
      presetData.nodes = presetData.nodes?.map((node) => ({
        ...node,
        name: node.name ? containerNamePrefix + node.name : node.name,
        databaseHost: node.databaseHost ? containerNamePrefix + node.databaseHost : node.databaseHost,
        brokerName: node.brokerName ? containerNamePrefix + node.brokerName : node.brokerName,
      }));
      presetData.gateways = presetData.gateways?.map((gateway) => ({
        ...gateway,
        apiNodeName: gateway.apiNodeName ? containerNamePrefix + gateway.apiNodeName : gateway.apiNodeName,
        databaseHost: gateway.databaseHost ? containerNamePrefix + gateway.databaseHost : gateway.databaseHost,
        apiNodeHost: gateway.apiNodeHost ? containerNamePrefix + gateway.apiNodeHost : gateway.apiNodeHost,
        apiNodeBrokerHost: gateway.apiNodeBrokerHost ? containerNamePrefix + gateway.apiNodeBrokerHost : gateway.apiNodeBrokerHost,
      }));
      presetData.databases = presetData.databases?.map((database) => ({
        ...database,
        name: containerNamePrefix + (database.name ?? ''),
      }));

      const addresses = await this.addressesService.resolveAddresses(oldAddresses, oldPresetData, presetData);
      const privateKeySecurityMode = CryptoUtils.getPrivateKeySecurityMode(presetData.privateKeySecurityMode);
      await this.fileSystemService.mkdir(target);

      const remoteNodeService = new RemoteNodeService(this.logger, presetData, this.params.offline, this.networkPort);

      // 既存の設定フォルダーをクリーンアップしてから再生成する
      this.cleanUpConfiguration(presetData);
      await this.nodeConfigService.generateNodeCertificates(presetData, addresses);
      await this.nodeConfigService.generateNodes(presetData, addresses, remoteNodeService);
      await this.gatewayConfigService.generateGateways(presetData);

      const isUpgrade = !!oldPresetData || !!oldAddresses;
      if (presetData.nodes?.length) {
        await this.nemesisConfigService.resolveNemesis(presetData, addresses, isUpgrade);
        await this.nemesisConfigService.copyNemesis(addresses);
      }

      // 秘密鍵セキュリティモードに従って秘密鍵を削除または保持したうえでファイルへ書き出す
      await YamlUtils.writeYaml(
        addressesLocation,
        CryptoUtils.removePrivateKeysAccordingToSecurityMode(addresses, privateKeySecurityMode),
        password,
      );
      await YamlUtils.writeYaml(presetLocation, CryptoUtils.removePrivateKeys(presetData), password);
      this.logger.info(`Configuration generated.`);
      return { presetData, addresses };
    } catch (e) {
      if ((e as any).known) {
        this.logger.error(Utils.getMessage(e));
      } else {
        this.logger.error(`Unknown error generating the configuration. ${Utils.getMessage(e)}`, e);
        this.logger.error(`The target folder '${target}' should be deleted!!!`);
      }
      throw e;
    }
  }

  /** 現在のパラメーターから ConfigPreset を生成して返す内部メソッド。 */
  private resolveCurrentPresetData(oldPresetData: ConfigPreset | undefined, password: Password): ConfigPreset {
    return this.configLoader.createPresetData({
      ...this.params,
      workingDir: this.params.workingDir,
      password: password,
      oldPresetData,
    });
  }

  /**
   * 既存の設定フォルダーをクリーンアップする。
   * アップグレード時に古い設定ファイルが残留しないように事前に削除する。
   */
  private cleanUpConfiguration(presetData: ConfigPreset): void {
    const target = this.params.target;
    (presetData.nodes || []).forEach(({ name }) => {
      this.fileSystemService.deleteFolder(this.fileSystemService.getTargetNodesFolder(target, false, name, 'server-config'));
      this.fileSystemService.deleteFolder(this.fileSystemService.getTargetNodesFolder(target, false, name, 'broker-config'));
      // アップグレード時に古いユーザー設定フォルダーを削除する
      this.fileSystemService.deleteFolder(this.fileSystemService.getTargetNodesFolder(target, false, name, 'userconfig'));
      this.fileSystemService.deleteFolder(this.fileSystemService.getTargetNodesFolder(target, false, name, 'seed'));
    });
    (presetData.gateways || []).forEach(({ name }) => {
      const configFolder = this.fileSystemService.getTargetGatewayFolder(target, false, name);
      this.fileSystemService.deleteFolder(configFolder, [
        join(configFolder, presetData.restSSLKeyFileName),
        join(configFolder, presetData.restSSLCertificateFileName),
      ]);
    });
  }
}
