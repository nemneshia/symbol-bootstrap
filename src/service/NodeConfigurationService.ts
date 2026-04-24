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
import { copyFileSync } from 'fs';
import { join } from 'path';
import { Logger } from '../logger/index.js';
import { Addresses, ConfigPreset, NodeAccount, PeerInfo } from '../model/index.js';
import { ICryptoPort } from '../sdk/index.js';
import { ConfigurationUtils } from '../utils/ConfigurationUtils.js';
import { Constants } from '../utils/Constants.js';
import { HandlebarsUtils } from '../utils/HandlebarsUtils.js';
import { Utils } from '../utils/Utils.js';
import { KeyName } from './AccountResolver.js';
import { CertificateService, RenewMode } from './CertificateService.js';
import { ConfigParams } from './ConfigTypes.js';
import { FileSystemService } from './FileSystemService.js';
import { RemoteNodeService } from './RemoteNodeService.js';
import { VotingService } from './VotingService.js';

/**
 * ノードの設定ファイル生成・証明書生成・P2P ピアリスト作成を担当するサービスクラス。
 * 各ノードについてサーバー設定・ブローカー設定・証明書・投票キーを生成する。
 */
export class NodeConfigurationService {
  constructor(
    private readonly logger: Logger,
    private readonly params: ConfigParams,
    private readonly cryptoPort: ICryptoPort,
    private readonly fileSystemService: FileSystemService,
  ) {}

  /**
   * 全ノードの設定ファイルを生成する。
   * リモートノードからのピア情報とローカルノードのピア情報を統合して P2P ファイルを生成する。
   */
  public async generateNodes(presetData: ConfigPreset, addresses: Addresses, remoteNodeService: RemoteNodeService): Promise<void> {
    const currentFinalizationEpoch = await remoteNodeService.resolveCurrentFinalizationEpoch();
    const externalPeers: PeerInfo[] = await remoteNodeService.getPeerInfos();

    // ローカルノードのピア情報を構築する
    const localPeers: PeerInfo[] = (presetData.nodes || []).map((nodePresetData, index) => {
      const node = (addresses.nodes || [])[index];
      return {
        publicKey: node.main.publicKey,
        endpoint: {
          host: nodePresetData.host || '',
          port: 7900,
        },
        metadata: {
          name: nodePresetData.friendlyName || '',
          roles: ConfigurationUtils.resolveRoles(nodePresetData),
        },
      };
    });

    const allPeers = Utils.uniqBy([...externalPeers, ...localPeers], (p) => p.publicKey);
    await Promise.all(
      (addresses.nodes || []).map((account, index) =>
        this.generateNodeConfiguration(account, index, presetData, currentFinalizationEpoch, allPeers),
      ),
    );
  }

  /**
   * 全ノードの証明書を生成または警告表示する。
   */
  public async generateNodeCertificates(presetData: ConfigPreset, addresses: Addresses): Promise<void> {
    await Promise.all(
      (addresses.nodes || []).map((account) => {
        const providedCertificates = {
          main: account.main,
          transport: account.transport,
        };
        return new CertificateService(this.logger, this.params.accountResolver, this.params, this.cryptoPort).run(
          presetData,
          account.name,
          providedCertificates,
          RenewMode.ONLY_WARNING,
        );
      }),
    );
  }

  /**
   * 個別ノードのサーバー設定・ブローカー設定・P2P ファイル・投票キーを生成する。
   */
  private async generateNodeConfiguration(
    account: NodeAccount,
    index: number,
    presetData: ConfigPreset,
    currentFinalizationEpoch: number | undefined,
    knownPeers: PeerInfo[],
  ): Promise<void> {
    const copyFrom = join(Constants.ROOT_FOLDER, 'config', 'node');
    const name = account.name;
    const serverConfig = this.fileSystemService.getTargetNodesFolder(this.params.target, false, name, 'server-config');
    const brokerConfig = this.fileSystemService.getTargetNodesFolder(this.params.target, false, name, 'broker-config');
    const dataFolder = this.fileSystemService.getTargetNodesFolder(this.params.target, false, name, 'data');
    await this.fileSystemService.mkdir(dataFolder);

    const nodePreset = (presetData.nodes || [])[index];

    // ハーベスティング設定: Remote キーがある場合はそちらを使用する
    const harvestingKeyName = account.remote ? KeyName.Remote : KeyName.Main;
    const harvestingAccount = account.remote || account.main;
    const harvesterSigningAccount = nodePreset.harvesting
      ? await this.params.accountResolver.resolveAccount(
          presetData.networkType,
          harvestingAccount,
          harvestingKeyName,
          account.name,
          'storing the harvesterSigningPrivateKey in the server properties',
          'Should not generate!',
        )
      : undefined;
    const harvesterVrf = nodePreset.harvesting
      ? await this.params.accountResolver.resolveAccount(
          presetData.networkType,
          account.vrf,
          KeyName.VRF,
          account.name,
          'storing the harvesterVrfPrivateKey in the server properties',
          'Should not generate!',
        )
      : undefined;

    const beneficiaryAddress = nodePreset.beneficiaryAddress || presetData.beneficiaryAddress;
    const generatedContext = {
      name: name,
      friendlyName: nodePreset?.friendlyName || account.friendlyName,
      harvesterSigningPrivateKey: harvesterSigningAccount?.privateKey || '',
      harvesterVrfPrivateKey: harvesterVrf?.privateKey || '',
      unfinalizedBlocksDuration: nodePreset.voting
        ? presetData.votingUnfinalizedBlocksDuration
        : presetData.nonVotingUnfinalizedBlocksDuration,
      beneficiaryAddress: beneficiaryAddress == undefined ? account.main.address : beneficiaryAddress,
      roles: ConfigurationUtils.resolveRoles(nodePreset),
    };
    const templateContext: any = { ...presetData, ...generatedContext, ...nodePreset };
    const excludeFiles: string[] = [];

    // 有効化されていない拡張機能の設定ファイルを除外する
    if (!templateContext.harvesting) {
      excludeFiles.push('config-harvesting.properties');
    }
    if (!templateContext.networkheight) {
      excludeFiles.push('config-networkheight.properties');
    }

    const serverRecoveryConfig = {
      addressextractionRecovery: false,
      mongoRecovery: false,
      zeromqRecovery: false,
      filespoolingRecovery: true,
      hashcacheRecovery: true,
    };

    const brokerRecoveryConfig = {
      addressextractionRecovery: true,
      mongoRecovery: true,
      zeromqRecovery: true,
      filespoolingRecovery: false,
      hashcacheRecovery: true,
    };

    this.logger.info(`Generating ${name} server configuration`);
    await HandlebarsUtils.generateConfiguration({ ...serverRecoveryConfig, ...templateContext }, copyFrom, serverConfig, excludeFiles);

    // P2P ピアリストを生成して resources フォルダーに書き出す
    const isPeer = (p: PeerInfo): boolean => p.metadata.roles.includes('Peer');
    const peers = knownPeers.filter((peer) => isPeer(peer) && peer.publicKey != account.main.publicKey);
    const peersP2PFile = await this.generateP2PFile(
      peers,
      presetData.peersP2PListLimit,
      serverConfig,
      `this file contains a list of peers`,
      'peers-p2p.json',
    );

    const isApi = (p: PeerInfo): boolean => p.metadata.roles.includes('Api');
    const apiPeers = knownPeers.filter((peer) => isApi(peer) && peer.publicKey != account.main.publicKey);
    const peersApiFile = await this.generateP2PFile(
      apiPeers,
      presetData.peersApiListLimit,
      serverConfig,
      `this file contains a list of api peers`,
      'peers-api.json',
    );

    if (!peers.length && !apiPeers.length) {
      this.logger.warn('The peer lists could not be resolved. peers-p2p.json and peers-api.json are empty!');
    }

    // ブローカーが設定されている場合、ブローカー設定とピアリストも生成する
    if (nodePreset.brokerName) {
      this.logger.info(`Generating ${nodePreset.brokerName} broker configuration`);
      await HandlebarsUtils.generateConfiguration({ ...brokerRecoveryConfig, ...templateContext }, copyFrom, brokerConfig, excludeFiles);
      copyFileSync(peersP2PFile, join(join(brokerConfig, 'resources', 'peers-p2p.json')));
      copyFileSync(peersApiFile, join(join(brokerConfig, 'resources', 'peers-api.json')));
    }

    // 投票キーファイルを生成または更新する
    await new VotingService(this.logger, this.params, this.cryptoPort).run(
      presetData,
      account,
      nodePreset,
      currentFinalizationEpoch,
      undefined,
      ConfigurationUtils.shouldCreateNemesis(presetData),
    );
  }

  /**
   * P2P ピアリスト JSON ファイルを生成し、パーミッション 0o600 で保存する。
   * listLimit を超える場合はランダムサンプリングして上限に収める。
   */
  private async generateP2PFile(
    knownPeers: PeerInfo[],
    listLimit: number,
    outputFolder: string,
    info: string,
    jsonFileName: string,
  ): Promise<string> {
    const data = {
      _info: info,
      knownPeers: knownPeers.length > listLimit ? Utils.sampleSize(knownPeers, listLimit) : knownPeers,
    };
    const peerFile = join(outputFolder, `resources`, jsonFileName);
    await fs.promises.writeFile(peerFile, JSON.stringify(data, null, 2));
    await fs.promises.chmod(peerFile, 0o600);
    return peerFile;
  }
}
