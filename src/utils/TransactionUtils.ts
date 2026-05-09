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
import { ConfigPreset } from '../model/index.js';
import { INetworkPort, MultisigInfoDto } from '../sdk/index.js';
import { RemoteNodeService } from '../service/RemoteNodeService.js';

/**
 * ネットワークアクセス関連のユーティリティクラス。
 * v3移行後は INetworkPort / ITransactionPort を使用する。
 */
export class TransactionUtils {
  /**
   * 指定した URL（または既知のゲートウェイから自動選択）に対して最適な REST URL を返す。
   */
  public static async getBestUrl(
    remoteNodeService: RemoteNodeService,
    url: string | undefined
  ): Promise<string> {
    const repositoryInfo = await remoteNodeService.getBestRepositoryInfo(url);
    return repositoryInfo.restGatewayUrl;
  }

  /** @deprecated Use getBestUrl instead. */
  public static async getBestUrlLegacy(
    logger: Logger,
    presetData: ConfigPreset,
    url: string | undefined,
    networkPort: INetworkPort
  ): Promise<string> {
    const remoteNodeService = new RemoteNodeService(logger, presetData, false, networkPort);
    const repositoryInfo = await remoteNodeService.getBestRepositoryInfo(url);
    return repositoryInfo.restGatewayUrl;
  }
  /**
   * 指定アドレスのマルチシグ情報を取得する。
   * ノードへの接続が失敗した場合は `undefined` を返す。
   *
   * @param networkPort ネットワーク通信ポート
   * @param url 接続先の REST ゲートウェイ URL
   * @param accountAddress マルチシグ情報を取得するアカウントアドレス
   * @returns マルチシグ情報、または取得失敗時は `undefined`
   */ public static async getMultisigInfo(
    networkPort: INetworkPort,
    url: string,
    accountAddress: string
  ): Promise<MultisigInfoDto | undefined> {
    try {
      return await networkPort.getMultisigInfo(url, accountAddress);
    } catch {
      return undefined;
    }
  }
}
