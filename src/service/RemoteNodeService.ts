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
import { lookup } from 'dns/promises';

import { KnownError } from '../errors/KnownError.js';
import { Logger } from '../logger/index.js';
import { ConfigPreset, NodewatchPeer, PeerInfo } from '../model/index.js';
import { ChainInfoDto, INetworkPort, SymbolNetworkAdapter } from '../sdk/index.js';
import { Utils } from '../utils/Utils.js';

/**
 * REST ゲートウェイ URL とそのノードのチェーン情報のペア。
 */
export interface RepositoryInfo {
  restGatewayUrl: string;
  chainInfo: ChainInfoDto;
}

/**
 * リモートノード（REST/Nodewatch）からネットワーク情報を収集するサービス。
 * 設定生成時に必要な REST ノード候補・最終化エポック・外部ピア情報を解決する。
 */
export class RemoteNodeService {
  /**
   * @param logger ログ出力インターフェース
   * @param presetData プリセットデータ
   * @param offline オフラインモードのとき `true`
   * @param networkPort ネットワーク通信ポート（省略時は SymbolNetworkAdapter を使用）
   */
  constructor(
    private readonly logger: Logger,
    private readonly presetData: ConfigPreset,
    private readonly offline: boolean,
    private readonly networkPort: INetworkPort = new SymbolNetworkAdapter()
  ) {}

  private restUrls: string[] | undefined;

  /** デフォルトで取得する Nodewatch 件数。 */
  private static readonly defaultNodewatchLimit = 10;

  /**
   * 現在の最終化エポックを取得する。
   * オフライン時やインターネット未接続時は、既知のエポック値を返す。
   */
  public async resolveCurrentFinalizationEpoch(): Promise<number> {
    const votingNode = this.presetData.node?.voting ? this.presetData.node : undefined;
    if (!votingNode || this.offline) {
      return this.presetData.lastKnownNetworkEpoch;
    }

    if (!(await this.isConnectedToInternet())) {
      return this.presetData.lastKnownNetworkEpoch;
    }

    const urls = await this.getRestUrls();
    return (await this.getBestFinalizationEpoch(urls)) || this.presetData.lastKnownNetworkEpoch;
  }

  /**
   * 与えられた REST URL 候補の中から、最も高さの高いノードの最終化エポックを返す。
   */
  public async getBestFinalizationEpoch(urls: string[]): Promise<number | undefined> {
    if (!urls.length) {
      return undefined;
    }

    const repositoryInfo = await this.pickBestRepositoryInfo(urls);
    const finalizationEpoch = repositoryInfo?.chainInfo.finalizationEpoch;
    if (finalizationEpoch) {
      this.logger.info(`現在のネットワーク最終化エポックは ${finalizationEpoch} です`);
    }
    return finalizationEpoch;
  }

  /**
   * 接続可能なノードの中から最適なノード情報を返す。
   * `url` が指定された場合はその URL のみを対象にする。
   */
  public async getBestRepositoryInfo(url: string | undefined): Promise<RepositoryInfo> {
    const urls = url ? [url] : await this.getRestUrls();
    const repositoryInfo = await this.pickBestRepositoryInfo(urls);
    if (!repositoryInfo) {
      throw new Error(`稼働中のノードが見つかりませんでした。候補:\n - ${urls.join('\n - ')}`);
    }
    this.logger.info(`ノード ${repositoryInfo.restGatewayUrl} に接続します`);
    return repositoryInfo;
  }

  /**
   * ブロック高の降順（高い順）に並べ替える。
   */
  private sortByHeight(repos: RepositoryInfo[]): RepositoryInfo[] {
    return repos.sort((a, b) => {
      const hA = a.chainInfo.height;
      const hB = b.chainInfo.height;
      return hB > hA ? 1 : hB < hA ? -1 : 0;
    });
  }

  /**
   * ノード候補から最も高さの高いノード情報を 1 件返す。
   */
  private async pickBestRepositoryInfo(urls: string[]): Promise<RepositoryInfo | undefined> {
    return this.sortByHeight(await this.getKnownNodeRepositoryInfos(urls)).find(
      (repositoryInfo) => repositoryInfo
    );
  }

  /**
   * DNS 参照でインターネット接続可否を判定する。
   * `ENOTFOUND` エラーのみ未接続と判断し、その他のエラーは接続ありとして扱う。
   */
  public async isConnectedToInternet(): Promise<boolean> {
    try {
      await lookup('google.com');
      return true;
    } catch (e: any) {
      return e?.code !== 'ENOTFOUND';
    }
  }

  /**
   * 指定された REST URL へ接続し、取得できたチェーン情報を返す。
   * 接続失敗したノードは警告ログを出して除外する。
   */
  private async getKnownNodeRepositoryInfos(urls: string[]): Promise<RepositoryInfo[]> {
    if (!urls.length) {
      throw new KnownError('既知ノードがありません。');
    }

    this.logger.info(`次の候補から最適なノードを探索します:\n - ${urls.join('\n - ')}`);
    return (
      await Promise.all(
        urls.map(async (restGatewayUrl): Promise<RepositoryInfo | undefined> => {
          try {
            const chainInfo = await this.networkPort.getChainInfo(restGatewayUrl);
            return { restGatewayUrl, chainInfo };
          } catch (e) {
            const message = `ノード ${restGatewayUrl} との通信中にエラーが発生しました。詳細: ${Utils.getMessage(e)}`;
            this.logger.warn(message);
            return undefined;
          }
        })
      )
    ).filter((i): i is RepositoryInfo => i !== undefined);
  }

  /**
   * Nodewatch の件数指定が未定義の場合にデフォルト値を補完する。
   */
  private getNodewatchLimit(limit: number | undefined): number {
    return limit ?? RemoteNodeService.defaultNodewatchLimit;
  }

  /**
   * 利用可能な REST URL 一覧を返す。
   * 1 度解決した結果はインスタンス内でキャッシュする。
   */
  public async getRestUrls(): Promise<string[]> {
    if (this.restUrls) {
      return this.restUrls;
    }

    const urls = [...(this.presetData.knownRestGateways || [])];
    const nodewatchUrl = this.presetData.nodewatchUrl;
    if (nodewatchUrl && !this.offline) {
      try {
        const order = 'random';
        const nodes = await this.getNodes(
          nodewatchUrl,
          this.getNodewatchLimit(this.presetData.nodewatchRestLimit),
          order
        );
        urls.push(...nodes.map((n) => n.endpoint).filter((url): url is string => !!url));
      } catch (e) {
        this.logger.warn(
          `nodewatch ${nodewatchUrl} への接続でエラーが発生しました。REST URL を解決できません。詳細: ${Utils.getMessage(e)}`
        );
      }
    }

    this.restUrls = urls;
    return urls;
  }

  /**
   * ノードロールのビット値を人が読みやすい文字列へ変換する。
   * @param role ノードロールのビットフラグ
   */
  public static getNodeRoles(role: number): string {
    const roles: string[] = [];
    if ((1 & role) !== 0) {
      roles.push('Peer');
    }
    if ((2 & role) !== 0) {
      roles.push('Api');
    }
    if ((4 & role) !== 0) {
      roles.push('Voting');
    }
    return roles.join(',');
  }

  /**
   * 外部ピア一覧を取得する。
   * Nodewatch から取得したノードに対して `/node/info` を問い合わせ、host/port を補完する。
   */
  public async getPeerInfos(): Promise<PeerInfo[]> {
    const nodewatchUrl = this.presetData.nodewatchUrl;
    const knownPeers = [...(this.presetData.knownPeers || [])];

    if (nodewatchUrl && !this.offline) {
      try {
        const order = 'random';
        const nodes = await this.getNodes(
          nodewatchUrl,
          this.getNodewatchLimit(this.presetData.nodewatchPeerLimit),
          order
        );

        await this.enrichNodesWithHostInfo(nodes);

        knownPeers.push(...this.convertNodesToPeerInfos(nodes));
      } catch (error) {
        this.logger.warn(
          `nodewatch ${nodewatchUrl} への接続でエラーが発生しました。Peer を解決できません。詳細: ${Utils.getMessage(error)}`
        );
      }
    }

    return knownPeers;
  }

  /**
   * 各ノードの `/node/info` エンドポイントへ問い合わせ、host と port を補完する。
   *
   * @param nodes 補完対象の NodewatchPeer 配列
   */
  private async enrichNodesWithHostInfo(nodes: NodewatchPeer[]): Promise<void> {
    await Promise.all(
      nodes.map(async (node) => {
        if (!node.endpoint || !node.isHealthy) {
          return;
        }
        try {
          const nodeInfoUrl = new URL('/node/info', node.endpoint);
          const nodeInfoResponse = await fetch(nodeInfoUrl.toString());
          if (nodeInfoResponse.ok) {
            const nodeInfo = await nodeInfoResponse.json();
            node.host = nodeInfo.host;
            node.port = nodeInfo.port;
          }
        } catch (e) {
          this.logger.warn(
            `ノード情報の取得に失敗しました ${node.endpoint}: ${Utils.getMessage(e)}`
          );
        }
      })
    );
  }

  /**
   * NodewatchPeer の配列を PeerInfo の配列に変換する。
   * 必須フィールド（isHealthy / mainPublicKey / name / roles / host / port）が
   * 欠けているノードは除外する。
   *
   * @param nodes 変換対象の NodewatchPeer 配列
   * @returns 変換された PeerInfo 配列
   */
  private convertNodesToPeerInfos(nodes: NodewatchPeer[]): PeerInfo[] {
    return nodes
      .map((n): PeerInfo | undefined => {
        if (!n.isHealthy || !n.mainPublicKey || !n.name || !n.roles || !n.host || !n.port) {
          return undefined;
        }
        return {
          publicKey: n.mainPublicKey,
          endpoint: {
            host: n.host,
            port: n.port,
          },
          metadata: {
            name: n.name,
            roles: RemoteNodeService.getNodeRoles(n.roles),
          },
        };
      })
      .filter((peerInfo): peerInfo is PeerInfo => peerInfo !== undefined);
  }

  /**
   * 各 REST サービス用の接続先 URL 一覧とデフォルト URL を解決する。
   */
  public async resolveRestUrlsForServices(): Promise<{ restNodes: string[]; defaultNode: string }> {
    const restNodes: string[] = [];
    const restService = this.presetData.gateway;
    if (restService) {
      const nodePreset =
        this.presetData.node?.name === restService.apiNodeName ? this.presetData.node : undefined;
      restNodes.push(`http://${restService.host || nodePreset?.host || 'localhost'}:3000`);
    }
    restNodes.push(...(await this.getRestUrls()));

    const defaultNode = restNodes[0];
    if (!defaultNode) {
      throw new Error('REST ノードを解決できませんでした。');
    }

    return { restNodes: [...new Set(restNodes)], defaultNode };
  }

  /**
   * Nodewatch API からノード一覧を取得する。
   */
  public async getNodes(
    nodewatchUrl: string,
    limit: number,
    order: string
  ): Promise<NodewatchPeer[]> {
    const base = nodewatchUrl.endsWith('/') ? nodewatchUrl : `${nodewatchUrl}/`;
    const nodewatchRequestUrl = new URL('api/symbol/nodes/peer', base);
    nodewatchRequestUrl.searchParams.set('limit', limit.toString());
    nodewatchRequestUrl.searchParams.set('order', order);

    const response = await fetch(nodewatchRequestUrl.toString());
    if (!response.ok) {
      throw new Error(`Nodewatch がステータス ${response.status} を返しました`);
    }
    const nodes = (await response.json()) as NodewatchPeer[];
    if (!nodes || !Array.isArray(nodes)) {
      throw new Error(`Nodewatch のレスポンス本文が不正です: ${JSON.stringify(nodes)}`);
    }

    return nodes;
  }
}
