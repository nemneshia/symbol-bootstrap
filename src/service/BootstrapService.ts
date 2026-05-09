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
import { Logger } from '../logger/index.js';
import { Addresses, ConfigPreset, DockerCompose } from '../model/index.js';
import { SymbolCryptoAdapter, SymbolNetworkAdapter } from '../sdk/index.js';
import { Password } from '../utils/YamlUtils.js';
import { ComposeParams, ComposeService } from './ComposeService.js';
import { ConfigService } from './ConfigService.js';
import { ConfigParams, ConfigResult } from './ConfigTypes.js';
import { CryptoFileParams, CryptoFileService } from './CryptoFileService.js';
import { FileSystemService } from './FileSystemService.js';
import { LinkParams, LinkService } from './LinkService.js';
import { ModifyMultisigParams, ModifyMultisigService } from './ModifyMultisigService.js';
import { PackService, PackServiceResult } from './PackService.js';
import { RenewCertificatesService } from './RenewCertificatesService.js';
import { RunParams, RunService } from './RunService.js';
import { VerifyService } from './VerifyService.js';
import { VotingKeysUpdateService } from './VotingKeysUpdateService.js';

export type StartParams = ConfigParams & ComposeParams & RunParams;

export interface RenewCertificatesParams {
  target: string;
  password: Password;
  customPreset?: string;
  user: string;
  force: boolean;
}

export interface VotingKeysUpdateParams {
  target: string;
  user: string;
  finalizationEpoch?: number;
}

/**
 * API 統合向けのメインエントリーポイント。
 */
export class BootstrapService {
  private readonly cryptoPort = new SymbolCryptoAdapter();
  private readonly networkPort = new SymbolNetworkAdapter();

  public constructor(private readonly logger: Logger) {}

  /**
   * ネットワーク設定を生成する。
   */
  public config(config: ConfigParams): Promise<ConfigResult> {
    return new ConfigService(this.logger, config, this.cryptoPort, this.networkPort).run();
  }

  /**
   * 実行用プリセットを解決する。
   */
  public resolveConfigPreset(config: ConfigParams): ConfigPreset {
    return new ConfigService(
      this.logger,
      config,
      this.cryptoPort,
      this.networkPort
    ).resolveConfigPreset(false);
  }

  /**
   * Docker Compose 定義を生成する。
   */
  public compose(config: ComposeParams, passedPresetData?: ConfigPreset): Promise<DockerCompose> {
    return new ComposeService(this.logger, config).run(passedPresetData);
  }

  /**
   * リンクトランザクションのアナウンス処理を実行する。
   */
  public link(
    config: LinkParams,
    passedPresetData?: ConfigPreset | undefined,
    passedAddresses?: Addresses | undefined
  ): Promise<void> {
    return new LinkService(this.logger, config, this.cryptoPort, this.networkPort).run(
      passedPresetData,
      passedAddresses
    );
  }

  /**
   * マルチシグ変更トランザクションのアナウンス処理を実行する。
   */
  public modifyMultisig(
    config: ModifyMultisigParams,
    passedPresetData?: ConfigPreset | undefined,
    passedAddresses?: Addresses | undefined
  ): Promise<void> {
    return new ModifyMultisigService(this.logger, config, this.cryptoPort, this.networkPort).run(
      passedPresetData,
      passedAddresses
    );
  }

  /**
   * ノード群を起動する。
   */
  public run(config: RunParams): Promise<void> {
    return new RunService(this.logger, config, this.networkPort).run();
  }

  /**
   * ノードデータをリセットする。
   */
  public resetData(config: { target: string }): Promise<void> {
    return new RunService(this.logger, config, this.networkPort).resetData();
  }

  /**
   * ノードのヘルスチェックを実行する。
   */
  public checkHealth(config: { target: string }): Promise<void> {
    return new RunService(this.logger, config, this.networkPort).checkHealth();
  }

  /**
   * config / compose / run を連続で実行する。
   */
  public async start(config: StartParams): Promise<ConfigResult> {
    const configResult = await this.config(config);
    await this.compose(config, configResult.presetData);
    await this.run(config);
    return configResult;
  }

  /**
   * ノード群を停止する。
   */
  public stop(config: RunParams): Promise<void> {
    return new RunService(this.logger, config, this.networkPort).stop();
  }

  /**
   * ターゲットフォルダーを削除する。
   */
  public clean(config: { target: string }): void {
    new FileSystemService(this.logger).deleteFolder(config.target);
  }

  /**
   * 実行環境の依存関係を検証する。
   */
  public verify(): Promise<void> {
    return new VerifyService(this.logger).run();
  }

  /**
   * ネットワーク構成を生成し、配布用 zip を作成する。
   */
  public pack(config: ConfigParams): Promise<PackServiceResult> {
    return new PackService(this.logger).run(config);
  }

  /**
   * 証明書の更新処理を実行する。
   */
  public renewCertificates(config: RenewCertificatesParams): Promise<boolean> {
    return new RenewCertificatesService(this.logger).run(config);
  }

  /**
   * 投票キーファイルの更新処理を実行する。
   */
  public updateVotingKeys(config: VotingKeysUpdateParams): Promise<boolean> {
    return new VotingKeysUpdateService(this.logger).run(config);
  }

  /**
   * YAML ファイルを暗号化する。
   */
  public encryptFile(config: CryptoFileParams): Promise<string> {
    return new CryptoFileService(this.logger).encryptFile(config);
  }

  /**
   * YAML ファイルを復号化する。
   */
  public decryptFile(config: CryptoFileParams): Promise<string> {
    return new CryptoFileService(this.logger).decryptFile(config);
  }
}
