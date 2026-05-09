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
import { join } from 'node:path';

import { Logger } from '../logger/index.js';
import { ConfigPreset, NodeAccount, NodePreset } from '../model/index.js';
import { ICryptoPort } from '../sdk/index.js';
import { VotingKeyFile, VotingUtils } from '../utils/VotingUtils.js';
import { FileSystemService } from './FileSystemService.js';
import {
  CatapultVotingKeyFileProvider,
  NativeVotingKeyFileProvider,
  VotingKeyFileProvider,
} from './VotingKeyFileProvider.js';

export interface VotingParams {
  target: string;
  user: string;
  votingKeyFileProvider?: VotingKeyFileProvider;
}

/**
 * 投票キーファイルの生成・更新を管理するサービス。
 * ノード状態と現在エポックから更新要否を判定し、必要時のみ新しい投票キーファイルを生成する。
 */
export class VotingService {
  private readonly fileSystemService: FileSystemService;

  constructor(
    private readonly logger: Logger,
    protected readonly params: VotingParams,
    private readonly cryptoPort: ICryptoPort
  ) {
    this.fileSystemService = new FileSystemService(logger);
  }

  /**
   * 投票キーファイルを必要に応じて生成・更新する。
   * @returns 新規ファイルを生成した場合は true
   */
  public async run(
    presetData: ConfigPreset,
    nodeAccount: NodeAccount,
    nodePreset: NodePreset,
    currentNetworkEpoch: number | undefined,
    updateVotingKey: boolean | undefined,
    nemesisBlock: boolean
  ): Promise<boolean> {
    const networkEpoch = this.resolveNetworkEpoch(
      currentNetworkEpoch,
      presetData.lastKnownNetworkEpoch
    );
    const update = this.resolveUpdateFlag(updateVotingKey, presetData.autoUpdateVotingKeys);

    if (!this.isVotingEnabled(nodePreset, nodeAccount)) {
      return false;
    }

    this.validateVotingLifetime(presetData);
    const votingKeysFolder = this.resolveVotingKeysFolder(presetData, nodeAccount.name);
    const votingUtils = new VotingUtils(VotingUtils.nobleImplementation, this.cryptoPort);
    await this.prepareVotingKeysFolder(votingKeysFolder);

    const currentVotingFiles = votingUtils.loadVotingFiles(votingKeysFolder);
    nodeAccount.voting = currentVotingFiles;

    const maxVotingKeyEndEpoch = this.resolveMaxVotingKeyEndEpoch(currentVotingFiles, networkEpoch);
    if (this.isVotingFileUpToDate(maxVotingKeyEndEpoch, networkEpoch, presetData)) {
      this.logger.info(`ノード ${nodeAccount.name} の投票ファイルは最新です。`);
      return false;
    }

    if (this.shouldWarnManualUpdate(update, currentVotingFiles.length)) {
      this.logUpdateRequiredWarning();
      return false;
    }

    const votingKeyStartEpoch = maxVotingKeyEndEpoch + 1;
    const votingKeyEndEpoch = maxVotingKeyEndEpoch + presetData.votingKeyDesiredLifetime;
    const epochs = votingKeyEndEpoch - votingKeyStartEpoch + 1;
    this.logger.info(
      `ノード ${nodeAccount.name} 向けに ${epochs} エポック分の投票キーファイルを作成します。しばらく時間がかかる場合があります。`
    );

    const privateKeyTreeFileName = `private_key_tree${currentVotingFiles.length + 1}.dat`;
    const provider = this.resolveVotingKeyFileProvider(presetData);
    const { publicKey } = await provider.createVotingFile({
      presetData,
      votingKeysFolder,
      privateKeyTreeFileName,
      votingKeyStartEpoch,
      votingKeyEndEpoch,
    });

    this.logLinkInstructions(
      nodeAccount,
      publicKey,
      votingKeyStartEpoch,
      votingKeyEndEpoch,
      nemesisBlock
    );

    nodeAccount.voting = votingUtils.loadVotingFiles(votingKeysFolder);
    return true;
  }

  /**
   * ノードに投票設定があるか判定する。
   */
  private isVotingEnabled(nodePreset: NodePreset, nodeAccount: NodeAccount): boolean {
    if (!nodePreset?.voting) {
      this.logger.info(`ノード ${nodeAccount.name} は投票設定が無効です。`);
      return false;
    }
    return true;
  }

  /**
   * 投票キー寿命設定の整合性を検証する。
   */
  private validateVotingLifetime(presetData: ConfigPreset): void {
    const votingKeyDesiredFutureLifetime = presetData.votingKeyDesiredFutureLifetime;
    const votingKeyDesiredLifetime = presetData.votingKeyDesiredLifetime;
    if (votingKeyDesiredFutureLifetime > votingKeyDesiredLifetime) {
      throw new Error(
        `votingKeyDesiredFutureLifetime (${votingKeyDesiredFutureLifetime}) cannot be greater than votingKeyDesiredLifetime (${votingKeyDesiredLifetime})`
      );
    }
  }

  /**
   * 投票キーファイル格納先を解決する。
   */
  private resolveVotingKeysFolder(presetData: ConfigPreset, nodeName: string): string {
    return join(
      this.fileSystemService.getTargetNodesFolder(this.params.target, true, nodeName),
      presetData.votingKeysDirectory
    );
  }

  /**
   * 投票キーフォルダーの準備を行う。
   */
  private async prepareVotingKeysFolder(votingKeysFolder: string): Promise<void> {
    await this.fileSystemService.mkdir(votingKeysFolder);
    this.fileSystemService.deleteFile(join(votingKeysFolder, 'metadata.yaml'));
  }

  /**
   * 既存キーの最終エポックを解決する。
   */
  private resolveMaxVotingKeyEndEpoch(
    currentVotingFiles: VotingKeyFile[],
    networkEpoch: number
  ): number {
    return Math.max(
      currentVotingFiles[currentVotingFiles.length - 1]?.endEpoch || 0,
      networkEpoch - 1
    );
  }

  /**
   * 投票キーファイル更新が不要か判定する。
   */
  private isVotingFileUpToDate(
    maxVotingKeyEndEpoch: number,
    networkEpoch: number,
    presetData: ConfigPreset
  ): boolean {
    return maxVotingKeyEndEpoch > networkEpoch + presetData.votingKeyDesiredFutureLifetime;
  }

  /**
   * 既存キーがあり自動更新しない場合に警告するか判定する。
   */
  private shouldWarnManualUpdate(update: boolean, currentVotingFileCount: number): boolean {
    return !update && currentVotingFileCount > 0;
  }

  /**
   * 手動更新が必要な案内ログを出力する。
   */
  private logUpdateRequiredWarning(): void {
    this.logger.warn('');
    this.logger.warn(
      `投票キーファイルの有効期限が近いか、既に期限切れです。'symbol-bootstrap updateVotingKeys' コマンドを実行してください。`
    );
    this.logger.warn('');
  }

  /**
   * 実行時のネットワークエポックを解決する。
   */
  private resolveNetworkEpoch(
    currentNetworkEpoch: number | undefined,
    lastKnownNetworkEpoch: number | undefined
  ): number {
    return currentNetworkEpoch ?? lastKnownNetworkEpoch ?? 1;
  }

  /**
   * 更新可否フラグを解決する。
   */
  private resolveUpdateFlag(
    updateVotingKey: boolean | undefined,
    autoUpdateVotingKeys: boolean | undefined
  ): boolean {
    return updateVotingKey === undefined ? !!autoUpdateVotingKeys : updateVotingKey;
  }

  /**
   * 生成プロバイダーを解決する。
   */
  private resolveVotingKeyFileProvider(presetData: ConfigPreset): VotingKeyFileProvider {
    if (this.params.votingKeyFileProvider) {
      return this.params.votingKeyFileProvider;
    }
    if (presetData.useExperimentalNativeVotingKeyGeneration) {
      return new NativeVotingKeyFileProvider(this.logger, this.cryptoPort);
    }
    return new CatapultVotingKeyFileProvider(this.logger, this.params.user, this.cryptoPort);
  }

  /**
   * 生成後の案内ログを出力する。
   */
  private logLinkInstructions(
    nodeAccount: NodeAccount,
    publicKey: string,
    votingKeyStartEpoch: number,
    votingKeyEndEpoch: number,
    nemesisBlock: boolean
  ): void {
    if (nemesisBlock) {
      // 新規ネットワークではリンクトランザクションは nemesis に含まれる。
      this.logger.info('');
      this.logger.info(
        `ノード ${nodeAccount.name} の新しい投票ファイルを生成しました。リンクトランザクションは nemesis ブロックに含まれます。`
      );
      this.logger.info('');
      return;
    }

    // 稼働中ネットワークでは手動リンクが必要。
    this.logger.warn('');
    this.logger.warn(`ノード ${nodeAccount.name} の新しい投票ファイルを生成しました。`);
    this.logger.warn(
      `Voting Public Key: ${publicKey}（startEpoch: ${votingKeyStartEpoch}, endEpoch: ${votingKeyEndEpoch}）を使って、main ${nodeAccount.main.address} から Voting Key Link トランザクションを送信してください。`
    );
    this.logger.warn(
      `リンクには 'symbol-bootstrap link' コマンド、symbol CLI、または symbol デスクトップウォレットを使用できます。`
    );
    this.logger.warn('');
  }
}
