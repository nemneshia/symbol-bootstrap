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

import { firstValueFrom } from 'rxjs';
import { Logger } from '../logger/index.js';
import { ConfigPreset } from '../model/index.js';
import { Address, INetworkPort, MultisigAccountInfo, RepositoryFactory, RepositoryFactoryHttp } from '../sdk/index.js';
import { RemoteNodeService } from '../service/RemoteNodeService.js';

/**
 * RepositoryFactory の解決やマルチシグアカウント情報の取得を担当するユーティリティクラス。
 */
export class TransactionUtils {
  /**
   * 指定した URL（または既知のゲートウェイから自動選択）に対して最適な RepositoryFactory を返す。
   *
   * @param remoteNodeService  注入された RemoteNodeService
   */
  public static async getRepositoryFactory(remoteNodeService: RemoteNodeService, url: string | undefined): Promise<RepositoryFactory> {
    const repositoryInfo = await remoteNodeService.getBestRepositoryInfo(url);
    return new RepositoryFactoryHttp(repositoryInfo.restGatewayUrl);
  }

  /** @deprecated Use the overload that accepts RemoteNodeService instead. */
  public static async getRepositoryFactoryLegacy(
    logger: Logger,
    presetData: ConfigPreset,
    url: string | undefined,
    networkPort: INetworkPort,
  ): Promise<RepositoryFactory> {
    const remoteNodeService = new RemoteNodeService(logger, presetData, false, networkPort);
    const repositoryInfo = await remoteNodeService.getBestRepositoryInfo(url);
    return new RepositoryFactoryHttp(repositoryInfo.restGatewayUrl);
  }

  public static async getMultisigAccount(
    repositoryFactory: RepositoryFactory,
    accountAddress: Address,
  ): Promise<MultisigAccountInfo | undefined> {
    try {
      const info = await firstValueFrom(repositoryFactory.createMultisigRepository().getMultisigAccountInfo(accountAddress));
      return info.isMultisig() ? info : undefined;
    } catch {
      return undefined;
    }
  }
}
