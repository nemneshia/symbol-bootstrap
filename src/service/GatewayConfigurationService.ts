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
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { KnownError } from '../errors/KnownError.js';
import { Logger } from '../logger/index.js';
import { ConfigPreset, GatewayConfigPreset, GatewayPreset } from '../model/index.js';
import { Constants } from '../utils/Constants.js';
import { HandlebarsUtils } from '../utils/HandlebarsUtils.js';
import { ConfigParams } from './ConfigTypes.js';
import { FileSystemService } from './FileSystemService.js';

/**
 * REST ゲートウェイの設定ファイル生成を担当するサービスクラス。
 * presetData.gateways に定義された全ゲートウェイのテンプレート展開と証明書コピーを行う。
 */
export class GatewayConfigurationService {
  constructor(
    private readonly logger: Logger,
    private readonly params: ConfigParams,
    private readonly fileSystemService: FileSystemService
  ) {}

  /**
   * 全ゲートウェイの設定ファイルを生成する。
   */
  public generateGateways(presetData: ConfigPreset): Promise<void[]> {
    if (!presetData.gateway) {
      return Promise.resolve([]);
    }
    return Promise.all([this.generateGateway(presetData, presetData.gateway, 0)]);
  }

  /**
   * 単一ゲートウェイの設定ファイルを生成する。
   *
   * @param presetData ネットワーク設定プリセット
   * @param gatewayPreset 対象ゲートウェイのプリセット設定
   * @param index ゲートウェイのインデックス（名前未指定時のフォールバックに使用）
   */
  private async generateGateway(
    presetData: ConfigPreset,
    gatewayPreset: GatewayPreset,
    index: number
  ): Promise<void> {
    const copyFrom = join(Constants.ROOT_FOLDER, 'config', 'gateway');
    const generatedContext: Partial<GatewayConfigPreset> = {
      restDeploymentToolVersion: Constants.VERSION,
      restDeploymentToolLastUpdatedDate: new Date().toISOString().slice(0, 10),
    };
    const templateContext = { ...generatedContext, ...presetData, ...gatewayPreset };
    const name = templateContext.name || (index === 0 ? 'gateway' : `gateway-${index}`);
    const moveTo = this.fileSystemService.getTargetGatewayFolder(this.params.target, false, name);

    await HandlebarsUtils.generateConfiguration(templateContext, copyFrom, moveTo);
    await this.copyApiNodeFiles(gatewayPreset, moveTo);

    if (gatewayPreset.restProtocol === 'HTTPS') {
      this.handleSslCertificates(presetData, gatewayPreset, moveTo);
    }
  }

  /**
   * API ノードの設定ファイルと証明書をゲートウェイ出力ディレクトリへコピーする。
   *
   * @param gatewayPreset 対象ゲートウェイのプリセット設定
   * @param moveTo ゲートウェイ出力ディレクトリのパス
   */
  private async copyApiNodeFiles(gatewayPreset: GatewayPreset, moveTo: string): Promise<void> {
    const apiNodeConfigFolder = this.fileSystemService.getTargetNodesFolder(
      this.params.target,
      false,
      gatewayPreset.apiNodeName,
      'server-config',
      'resources'
    );
    const apiNodeCertFolder = this.fileSystemService.getTargetNodesFolder(
      this.params.target,
      false,
      gatewayPreset.apiNodeName,
      'cert'
    );

    await HandlebarsUtils.generateConfiguration(
      {},
      apiNodeConfigFolder,
      join(moveTo, 'api-node-config'),
      [],
      ['config-network.properties', 'config-node.properties', 'config-inflation.properties']
    );
    await HandlebarsUtils.generateConfiguration(
      {},
      apiNodeCertFolder,
      join(moveTo, 'api-node-config', 'cert'),
      [],
      ['node.crt.pem', 'node.key.pem', 'ca.cert.pem']
    );
  }

  /**
   * HTTPS 用 SSL 証明書をゲートウェイ出力ディレクトリへ書き出す、または既存ファイルの存在を確認する。
   *
   * - Base64 エンコード済み証明書がプリセットに含まれている場合はファイルとして書き出す。
   * - 含まれていない場合は、既にファイルが配置済みであることを確認する。
   *
   * @param presetData ネットワーク設定プリセット（SSL ファイル名を参照）
   * @param gatewayPreset 対象ゲートウェイのプリセット設定
   * @param moveTo ゲートウェイ出力ディレクトリのパス
   * @throws KnownError SSL ファイルも Base64 データも存在しない場合
   */
  private handleSslCertificates(
    presetData: ConfigPreset,
    gatewayPreset: GatewayPreset,
    moveTo: string
  ): void {
    const keyPath = join(moveTo, presetData.restSSLKeyFileName);
    const certPath = join(moveTo, presetData.restSSLCertificateFileName);

    if (gatewayPreset.restSSLKeyBase64 && gatewayPreset.restSSLCertificateBase64) {
      writeFileSync(keyPath, gatewayPreset.restSSLKeyBase64, 'base64');
      writeFileSync(certPath, gatewayPreset.restSSLCertificateBase64, 'base64');
      return;
    }

    if (!existsSync(keyPath) && !existsSync(certPath)) {
      throw new KnownError(
        `Native SSL is enabled but restSSLKeyBase64 or restSSLCertificateBase64 properties are not found in the custom-preset file! Either use 'symbol-bootstrap wizard' command to fill those properties in the custom-preset or make sure you copy your SSL key and cert files to ${moveTo} folder.`
      );
    }

    this.logger.info(
      `ゲートウェイ ${gatewayPreset.name} のネイティブ SSL 証明書は既に提供済みのため、再利用します...`
    );
  }
}
