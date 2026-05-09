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
import { copyFileSync } from 'node:fs';
import { chmod, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

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
    private readonly fileSystemService: FileSystemService
  ) {}

  /**
   * 全ノードの設定ファイルを生成する。
   * リモートノードからのピア情報とローカルノードのピア情報を統合して P2P ファイルを生成する。
   */
  public async generateNodes(
    presetData: ConfigPreset,
    addresses: Addresses,
    remoteNodeService: RemoteNodeService
  ): Promise<void> {
    const currentFinalizationEpoch = await remoteNodeService.resolveCurrentFinalizationEpoch();
    const externalPeers: PeerInfo[] = await remoteNodeService.getPeerInfos();

    // ローカルノードのピア情報を構築する
    const localPeers: PeerInfo[] = [];
    if (presetData.node) {
      const nodePresetData = presetData.node;
      const node = addresses.node;
      if (node) {
        localPeers.push({
          publicKey: node.main.publicKey,
          endpoint: {
            host: nodePresetData.host || '',
            port: 7900,
          },
          metadata: {
            name: nodePresetData.friendlyName || '',
            roles: ConfigurationUtils.resolveRoles(nodePresetData),
          },
        });
      }
    }

    const allPeers = Utils.uniqBy([...externalPeers, ...localPeers], (p) => p.publicKey);
    if (addresses.node) {
      await this.generateNodeConfiguration(
        addresses.node,
        presetData,
        currentFinalizationEpoch,
        allPeers
      );
    }
  }

  /**
   * 全ノードの証明書を生成または警告表示する。
   */
  public async generateNodeCertificates(
    presetData: ConfigPreset,
    addresses: Addresses
  ): Promise<void> {
    if (!addresses.node) {
      return;
    }
    const providedCertificates = {
      main: addresses.node.main,
      transport: addresses.node.transport,
    };
    await new CertificateService(
      this.logger,
      this.params.accountResolver,
      this.params,
      this.cryptoPort
    ).run(
      presetData,
      presetData.node?.friendlyName ?? 'Symbol Node',
      presetData.node?.host ?? '',
      providedCertificates,
      RenewMode.ONLY_WARNING
    );
  }

  /**
   * 個別ノードのサーバー設定・ブローカー設定・P2P ファイル・投票キーを生成する。
   */
  private async generateNodeConfiguration(
    account: NodeAccount,
    presetData: ConfigPreset,
    currentFinalizationEpoch: number | undefined,
    knownPeers: PeerInfo[]
  ): Promise<void> {
    const copyFrom = join(Constants.ROOT_FOLDER, 'config', 'node');
    const name = account.name;
    const serverConfig = this.fileSystemService.getTargetNodesFolder(
      this.params.target,
      false,
      name,
      'server-config'
    );
    const brokerConfig = this.fileSystemService.getTargetNodesFolder(
      this.params.target,
      false,
      name,
      'broker-config'
    );
    const dataFolder = this.fileSystemService.getTargetNodesFolder(
      this.params.target,
      false,
      name,
      'data'
    );
    await this.fileSystemService.mkdir(dataFolder);

    const nodePreset = presetData.node;
    if (!nodePreset) {
      throw new Error('node preset が未定義です。');
    }
    const { harvesterSigningAccount, harvesterVrf } = await this.resolveHarvestingAccounts(
      presetData,
      account,
      nodePreset
    );

    const beneficiaryAddress = nodePreset.beneficiaryAddress ?? presetData.beneficiaryAddress;
    const generatedContext = {
      name,
      friendlyName: nodePreset?.friendlyName || account.friendlyName,
      harvesterSigningPrivateKey: harvesterSigningAccount?.privateKey || '',
      harvesterVrfPrivateKey: harvesterVrf?.privateKey || '',
      unfinalizedBlocksDuration: nodePreset.voting
        ? presetData.votingUnfinalizedBlocksDuration
        : presetData.nonVotingUnfinalizedBlocksDuration,
      beneficiaryAddress: beneficiaryAddress ?? account.main.address,
      roles: ConfigurationUtils.resolveRoles(nodePreset),
    };
    const templateContext: any = { ...presetData, ...generatedContext, ...nodePreset };
    const excludeFiles = this.buildNodeExcludeFiles(templateContext);

    const serverRecoveryConfig = {
      addressextractionRecovery: false,
      mongoRecovery: false,
      zeromqRecovery: false,
      filespoolingRecovery: true,
      hashcacheRecovery: true,
    };

    this.logger.info(`${name} の server 設定を生成します`);
    await HandlebarsUtils.generateConfiguration(
      { ...serverRecoveryConfig, ...templateContext },
      copyFrom,
      serverConfig,
      excludeFiles
    );

    // P2P ピアリストを生成して resources フォルダーに書き出す
    const isPeer = (p: PeerInfo): boolean => p.metadata.roles.includes('Peer');
    const peers = knownPeers.filter(
      (peer) => isPeer(peer) && peer.publicKey !== account.main.publicKey
    );
    const peersP2PFile = await this.generateP2PFile(
      peers,
      presetData.peersP2PListLimit,
      serverConfig,
      'this file contains a list of peers',
      'peers-p2p.json'
    );

    const isApi = (p: PeerInfo): boolean => p.metadata.roles.includes('Api');
    const apiPeers = knownPeers.filter(
      (peer) => isApi(peer) && peer.publicKey !== account.main.publicKey
    );
    const peersApiFile = await this.generateP2PFile(
      apiPeers,
      presetData.peersApiListLimit,
      serverConfig,
      'this file contains a list of api peers',
      'peers-api.json'
    );

    if (!peers.length && !apiPeers.length) {
      this.logger.warn(
        'ピアリストを解決できませんでした。peers-p2p.json と peers-api.json は空です。'
      );
    }

    if (nodePreset.brokerName) {
      await this.generateBrokerConfig(
        nodePreset.brokerName,
        templateContext,
        copyFrom,
        brokerConfig,
        excludeFiles,
        peersP2PFile,
        peersApiFile
      );
    }

    // 投票キーファイルを生成または更新する
    await new VotingService(this.logger, this.params, this.cryptoPort).run(
      presetData,
      account,
      nodePreset,
      currentFinalizationEpoch,
      undefined,
      ConfigurationUtils.shouldCreateNemesis(presetData)
    );
  }

  /**
   * ノードのハーベスティングアカウントと VRF アカウントを解決する。
   *
   * harvesting が無効の場合は両方 `undefined` を返す。
   *
   * @param presetData ネットワーク設定プリセット
   * @param account 対象ノードのアカウント情報
   * @param nodePreset 対象ノードのプリセット設定
   * @returns 解決済みのハーベスティングアカウントと VRF アカウント
   */
  private async resolveHarvestingAccounts(
    presetData: ConfigPreset,
    account: NodeAccount,
    nodePreset: any
  ): Promise<{ harvesterSigningAccount: any; harvesterVrf: any }> {
    if (!nodePreset.harvesting) {
      return { harvesterSigningAccount: undefined, harvesterVrf: undefined };
    }

    // Remote キーがある場合はそちらを使用し、ない場合は Main キーを使用する
    const harvestingKeyName = account.remote ? KeyName.Remote : KeyName.Main;
    const harvestingAccount = account.remote || account.main;

    const harvesterSigningAccount = await this.params.accountResolver.resolveAccount(
      presetData.networkType,
      harvestingAccount,
      harvestingKeyName,
      account.name,
      'storing the harvesterSigningPrivateKey in the server properties',
      'Should not generate!'
    );
    const harvesterVrf = await this.params.accountResolver.resolveAccount(
      presetData.networkType,
      account.vrf,
      KeyName.VRF,
      account.name,
      'storing the harvesterVrfPrivateKey in the server properties',
      'Should not generate!'
    );

    return { harvesterSigningAccount, harvesterVrf };
  }

  /**
   * テンプレートコンテキストに基づき、除外すべき設定ファイル名一覧を構築する。
   *
   * @param templateContext テンプレートコンテキスト
   * @returns 除外するファイル名の配列
   */
  private buildNodeExcludeFiles(templateContext: any): string[] {
    const excludeFiles: string[] = [];
    if (!templateContext.harvesting) {
      excludeFiles.push('config-harvesting.properties');
    }
    if (!templateContext.networkheight) {
      excludeFiles.push('config-networkheight.properties');
    }
    return excludeFiles;
  }

  /**
   * ブローカー設定ファイルを生成し、P2P ピアファイルをブローカー配下へコピーする。
   *
   * @param brokerName ブローカー名（ログ出力用）
   * @param templateContext テンプレートコンテキスト
   * @param copyFrom コピー元ディレクトリ
   * @param brokerConfig ブローカー設定出力先ディレクトリ
   * @param excludeFiles 除外ファイル名一覧
   * @param peersP2PFile P2P ピアファイルのパス
   * @param peersApiFile API ピアファイルのパス
   */
  private async generateBrokerConfig(
    brokerName: string,
    templateContext: any,
    copyFrom: string,
    brokerConfig: string,
    excludeFiles: string[],
    peersP2PFile: string,
    peersApiFile: string
  ): Promise<void> {
    const brokerRecoveryConfig = {
      addressextractionRecovery: true,
      mongoRecovery: true,
      zeromqRecovery: true,
      filespoolingRecovery: false,
      hashcacheRecovery: true,
    };

    this.logger.info(`${brokerName} の server 設定を生成します`);
    await HandlebarsUtils.generateConfiguration(
      { ...brokerRecoveryConfig, ...templateContext },
      copyFrom,
      brokerConfig,
      excludeFiles
    );
    copyFileSync(peersP2PFile, join(brokerConfig, 'resources', 'peers-p2p.json'));
    copyFileSync(peersApiFile, join(brokerConfig, 'resources', 'peers-api.json'));
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
    jsonFileName: string
  ): Promise<string> {
    const data = {
      _info: info,
      knownPeers:
        knownPeers.length > listLimit ? Utils.sampleSize(knownPeers, listLimit) : knownPeers,
    };
    const peerFile = join(outputFolder, 'resources', jsonFileName);
    await writeFile(peerFile, JSON.stringify(data, null, 2));
    await chmod(peerFile, 0o600);
    return peerFile;
  }
}
