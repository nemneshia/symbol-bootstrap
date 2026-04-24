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
import { existsSync } from 'fs';
import { join } from 'path';
import { KnownError } from '../errors/KnownError.js';
import { Logger } from '../logger/index.js';
import { ConfigPreset, GatewayConfigPreset } from '../model/index.js';
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
    private readonly fileSystemService: FileSystemService,
  ) {}

  /**
   * 全ゲートウェイの設定ファイルを生成する。
   * HTTPS プロトコルの場合は SSL 証明書ファイルの存在も確認する。
   */
  public generateGateways(presetData: ConfigPreset): Promise<void[]> {
    return Promise.all(
      (presetData.gateways || []).map(async (gatewayPreset, index: number) => {
        const copyFrom = join(Constants.ROOT_FOLDER, 'config', 'rest-gateway');
        const generatedContext: Partial<GatewayConfigPreset> = {
          restDeploymentToolVersion: Constants.VERSION,
          restDeploymentToolLastUpdatedDate: new Date().toISOString().slice(0, 10),
        };
        const templateContext = { ...generatedContext, ...presetData, ...gatewayPreset };
        const name = templateContext.name || `rest-gateway-${index}`;
        const moveTo = this.fileSystemService.getTargetGatewayFolder(this.params.target, false, name);
        await HandlebarsUtils.generateConfiguration(templateContext, copyFrom, moveTo);

        // ゲートウェイの API ノード設定と証明書を出力先ディレクトリへコピーする
        const apiNodeConfigFolder = this.fileSystemService.getTargetNodesFolder(
          this.params.target,
          false,
          gatewayPreset.apiNodeName,
          'server-config',
          'resources',
        );
        const apiNodeCertFolder = this.fileSystemService.getTargetNodesFolder(this.params.target, false, gatewayPreset.apiNodeName, 'cert');
        await HandlebarsUtils.generateConfiguration(
          {},
          apiNodeConfigFolder,
          join(moveTo, 'api-node-config'),
          [],
          ['config-network.properties', 'config-node.properties', 'config-inflation.properties'],
        );
        await HandlebarsUtils.generateConfiguration(
          {},
          apiNodeCertFolder,
          join(moveTo, 'api-node-config', 'cert'),
          [],
          ['node.crt.pem', 'node.key.pem', 'ca.cert.pem'],
        );

        // HTTPS プロトコルの場合、SSL 証明書ファイルを書き出すか既存ファイルの存在を確認する
        if (gatewayPreset.restProtocol === 'HTTPS') {
          if (gatewayPreset.restSSLKeyBase64 && gatewayPreset.restSSLCertificateBase64) {
            fs.writeFileSync(join(moveTo, presetData.restSSLKeyFileName), gatewayPreset.restSSLKeyBase64, 'base64');
            fs.writeFileSync(join(moveTo, presetData.restSSLCertificateFileName), gatewayPreset.restSSLCertificateBase64, 'base64');
          } else {
            if (
              !existsSync(join(moveTo, presetData.restSSLKeyFileName)) &&
              !existsSync(join(moveTo, presetData.restSSLCertificateFileName))
            ) {
              throw new KnownError(
                `Native SSL is enabled but restSSLKeyBase64 or restSSLCertificateBase64 properties are not found in the custom-preset file! Either use 'symbol-bootstrap wizard' command to fill those properties in the custom-preset or make sure you copy your SSL key and cert files to ${moveTo} folder.`,
              );
            } else {
              this.logger.info(`Native SSL certificates for gateway ${gatewayPreset.name} have been previously provided. Reusing...`);
            }
          }
        }
      }),
    );
  }
}
