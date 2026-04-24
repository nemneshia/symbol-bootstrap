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
import { Addresses, ConfigPreset, NodeAccount } from '../model/index.js';
import {
  AccountKeyLinkTransaction,
  Convert,
  Deadline,
  ICryptoPort,
  LinkAction,
  Transaction,
  TransactionMapping,
  UInt64,
  VotingKeyLinkTransaction,
  VrfKeyLinkTransaction,
} from '../sdk/index.js';
import { ConfigurationUtils } from '../utils/ConfigurationUtils.js';
import { Constants } from '../utils/Constants.js';
import { HandlebarsUtils } from '../utils/HandlebarsUtils.js';
import { Utils } from '../utils/Utils.js';
import { YamlUtils } from '../utils/YamlUtils.js';
import { KeyName } from './AccountResolver.js';
import { ConfigParams } from './ConfigTypes.js';
import { FileSystemService } from './FileSystemService.js';
import { NemgenService } from './NemgenService.js';

/**
 * Nemesis ブロックの設定生成・シードコピー・トランザクション作成を担当するサービスクラス。
 * Nemesis の生成（--reset 時）と既存シードの参照（アップグレード時）の両方に対応する。
 */
export class NemesisConfigurationService {
  constructor(
    private readonly logger: Logger,
    private readonly params: ConfigParams,
    private readonly cryptoPort: ICryptoPort,
    private readonly fileSystemService: FileSystemService,
  ) {}

  /**
   * Nemesis シードフォルダーを解決する。
   * 新規生成の場合は generateNemesisConfig を呼び出し、既存プリセットの場合はシードをコピーする。
   */
  public async resolveNemesis(presetData: ConfigPreset, addresses: Addresses, isUpgrade: boolean): Promise<void> {
    const target = this.params.target;
    const nemesisSeedFolder = this.fileSystemService.getTargetNemesisFolder(target, false, 'seed');
    await this.fileSystemService.mkdir(nemesisSeedFolder);

    if (ConfigurationUtils.shouldCreateNemesis(presetData)) {
      if (isUpgrade) {
        this.logger.info('Nemesis data cannot be generated when upgrading...');
      } else {
        // アップグレードでない場合は Nemesis を新規生成する
        this.fileSystemService.deleteFolder(nemesisSeedFolder);
        await this.fileSystemService.mkdir(nemesisSeedFolder);
        await this.generateNemesisConfig(presetData, addresses);
        await this.fileSystemService.validateSeedFolder(nemesisSeedFolder, `Is the generated nemesis seed a valid seed folder?`);
      }
      return;
    }

    if (isUpgrade) {
      this.logger.info('Upgrading genesis on upgrade!');
    }

    // カスタムプリセットの nemesisSeedFolder が指定された場合はそちらを参照する
    const resolvePresetNemesisSeedFolder = (): string | undefined => {
      if (!presetData.nemesisSeedFolder) return undefined;
      return Utils.resolveWorkingDirPath(this.params.workingDir, presetData.nemesisSeedFolder);
    };

    const presetNemesisSeedFolder = resolvePresetNemesisSeedFolder();
    if (presetNemesisSeedFolder) {
      await this.fileSystemService.validateSeedFolder(
        presetNemesisSeedFolder,
        `Is the provided preset nemesisSeedFolder: ${presetNemesisSeedFolder} a valid seed folder?`,
      );
      this.logger.info(`Using custom nemesis seed folder in ${presetNemesisSeedFolder}`);
      this.fileSystemService.deleteFolder(nemesisSeedFolder);
      await this.fileSystemService.mkdir(nemesisSeedFolder);
      await this.fileSystemService.copyDir(presetNemesisSeedFolder, nemesisSeedFolder);
      await this.fileSystemService.validateSeedFolder(
        nemesisSeedFolder,
        `Is the ${presetData.preset} preset default seed a valid seed folder?`,
      );
      return;
    }

    if (YamlUtils.isYamlFile(presetData.preset)) {
      throw new KnownError(`Seed for preset ${presetData.preset} could not be found. Please provide 'nemesisSeedFolder'!`);
    }

    // ビルトインプリセットの seed フォルダーを参照する
    const networkNemesisSeed = join(Constants.ROOT_FOLDER, 'presets', presetData.preset, 'seed');
    if (existsSync(networkNemesisSeed)) {
      this.fileSystemService.deleteFolder(nemesisSeedFolder);
      await this.fileSystemService.mkdir(nemesisSeedFolder);
      await this.fileSystemService.copyDir(networkNemesisSeed, nemesisSeedFolder);
      await this.fileSystemService.validateSeedFolder(
        nemesisSeedFolder,
        `Is the ${presetData.preset} preset default seed a valid seed folder?`,
      );
      return;
    }
    this.logger.warn(`Seed for preset ${presetData.preset} could not be found in ${networkNemesisSeed}`);
    throw new Error('Seed could not be found!!!!');
  }

  /**
   * Nemesis シードを各ノードの data フォルダーにコピーする。
   */
  public async copyNemesis(addresses: Addresses): Promise<void> {
    const target = this.params.target;
    const nemesisSeedFolder = this.fileSystemService.getTargetNemesisFolder(target, false, 'seed');
    await this.fileSystemService.validateSeedFolder(nemesisSeedFolder, `Invalid final seed folder ${nemesisSeedFolder}`);
    await Promise.all(
      (addresses.nodes || []).map(async (account) => {
        const name = account.name;
        const dataFolder = this.fileSystemService.getTargetNodesFolder(target, false, name, 'data');
        await this.fileSystemService.mkdir(dataFolder);
        const seedFolder = this.fileSystemService.getTargetNodesFolder(target, false, name, 'seed');
        await this.fileSystemService.copyDir(nemesisSeedFolder, seedFolder);
      }),
    );
  }

  /**
   * Nemesis 設定ファイルとトランザクションバイナリを生成し、NemgenService を実行する。
   */
  private async generateNemesisConfig(presetData: ConfigPreset, addresses: Addresses): Promise<void> {
    if (!presetData.nemesis) {
      throw new Error('nemesis must not be defined!');
    }
    const target = this.params.target;
    const nemesisWorkingDir = this.fileSystemService.getTargetNemesisFolder(target, false);
    const transactionsDirectory = join(nemesisWorkingDir, presetData.nemesis.transactionsDirectory || presetData.transactionsDirectory);
    await this.fileSystemService.mkdir(transactionsDirectory);
    const copyFrom = join(Constants.ROOT_FOLDER, `config`, `nemesis`);
    const moveTo = join(nemesisWorkingDir, `server-config`);
    const templateContext = { ...(presetData as any), addresses };
    // excludeFromNemesis フラグが立っていないノードのみを Nemesis 対象とする
    const nodes = (addresses.nodes || []).filter((n, index) => !presetData.nodes?.[index]?.excludeFromNemesis);

    await Promise.all(nodes.filter((n) => n.vrf).map((n) => this.createVrfTransaction(transactionsDirectory, presetData, n)));
    await Promise.all(nodes.filter((n) => n.remote).map((n) => this.createAccountKeyLinkTransaction(transactionsDirectory, presetData, n)));
    await Promise.all(nodes.map((n) => this.createVotingKeyTransactions(transactionsDirectory, presetData, n)));

    // プリセットに直接指定されたトランザクションを処理する
    if (presetData.nemesis.transactions) {
      const transactionHashes: string[] = [];
      const transactions = (
        await Promise.all(
          Object.entries(presetData.nemesis.transactions || {})
            .map(([key, payload]) => {
              const transactionHash = Transaction.createTransactionHash(
                payload,
                Array.from(Convert.hexToUint8(presetData.nemesisGenerationHashSeed)),
              );
              if (transactionHashes.indexOf(transactionHash) > -1) {
                this.logger.warn(`Transaction ${key} wth hash ${transactionHash} already exist. Excluded from folder.`);
                return undefined;
              }
              transactionHashes.push(transactionHash);
              return this.storeTransaction(transactionsDirectory, key, payload);
            })
            .filter((p) => p),
        )
      ).filter((p) => p);
      this.logger.info(`Found ${transactions.length} provided in transactions.`);
    }

    await HandlebarsUtils.generateConfiguration(templateContext, copyFrom, moveTo);
    await new NemgenService(this.logger, this.params).run(presetData);
  }

  /**
   * VRF キーリンクトランザクションを作成してファイルに保存する。
   */
  private async createVrfTransaction(transactionsDirectory: string, presetData: ConfigPreset, node: NodeAccount): Promise<Transaction> {
    if (!node.vrf) throw new Error('VRF keys should have been generated!!');
    if (!node.main) throw new Error('Main keys should have been generated!!');
    const deadline = Deadline.createFromDTO('1');
    const vrf = VrfKeyLinkTransaction.create(deadline, node.vrf.publicKey, LinkAction.Link, presetData.networkType, UInt64.fromUint(0));
    const account = await this.params.accountResolver.resolveAccount(
      presetData.networkType,
      node.main,
      KeyName.Main,
      node.name,
      'creating the vrf key link transactions',
      'Should not generate!',
    );
    const signedTransaction = account.sign(vrf, presetData.nemesisGenerationHashSeed);
    return this.storeTransaction(transactionsDirectory, `vrf_${node.name}`, signedTransaction.payload);
  }

  /**
   * アカウントキーリンクトランザクション（リモートキー）を作成してファイルに保存する。
   */
  private async createAccountKeyLinkTransaction(
    transactionsDirectory: string,
    presetData: ConfigPreset,
    node: NodeAccount,
  ): Promise<Transaction> {
    if (!node.remote) throw new Error('Remote keys should have been generated!!');
    if (!node.main) throw new Error('Main keys should have been generated!!');
    const deadline = Deadline.createFromDTO('1');
    const akl = AccountKeyLinkTransaction.create(
      deadline,
      node.remote.publicKey,
      LinkAction.Link,
      presetData.networkType,
      UInt64.fromUint(0),
    );
    const account = await this.params.accountResolver.resolveAccount(
      presetData.networkType,
      node.main,
      KeyName.Main,
      node.name,
      'creating the account link transactions',
      'Should not generate!',
    );
    const signedTransaction = account.sign(akl, presetData.nemesisGenerationHashSeed);
    return this.storeTransaction(transactionsDirectory, `remote_${node.name}`, signedTransaction.payload);
  }

  /**
   * 投票キーリンクトランザクションを全投票キーファイル分作成してファイルに保存する。
   */
  private async createVotingKeyTransactions(
    transactionsDirectory: string,
    presetData: ConfigPreset,
    node: NodeAccount,
  ): Promise<Transaction[]> {
    const votingFiles = node.voting || [];
    const account = await this.params.accountResolver.resolveAccount(
      presetData.networkType,
      node.main,
      KeyName.Main,
      node.name,
      'creating the voting key link transactions',
      'Should not generate!',
    );
    return Promise.all(
      votingFiles.map(async (votingFile) => {
        const voting = VotingKeyLinkTransaction.create(
          Deadline.createFromDTO('1'),
          votingFile.publicKey,
          votingFile.startEpoch,
          votingFile.endEpoch,
          LinkAction.Link,
          presetData.networkType,
          1,
          UInt64.fromUint(0),
        );
        const signedTransaction = account.sign(voting, presetData.nemesisGenerationHashSeed);
        return this.storeTransaction(transactionsDirectory, `voting_${node.name}`, signedTransaction.payload);
      }),
    );
  }

  /**
   * トランザクションのペイロードを .bin ファイルに保存し、Transaction オブジェクトを返す。
   */
  private async storeTransaction(transactionsDirectory: string, name: string, payload: string): Promise<Transaction> {
    const transaction = TransactionMapping.createFromPayload(payload);
    await fs.promises.writeFile(`${transactionsDirectory}/${name}.bin`, Convert.hexToUint8(payload));
    return transaction as Transaction;
  }
}
