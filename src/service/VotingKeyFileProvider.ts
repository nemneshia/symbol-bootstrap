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
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { Logger } from '../logger/index.js';
import { ConfigPreset } from '../model/index.js';
import { ICryptoPort } from '../sdk/index.js';
import { VotingUtils } from '../utils/VotingUtils.js';
import { RuntimeService } from './RuntimeService.js';

export interface VotingKeyParams {
  presetData: ConfigPreset;
  votingKeysFolder: string;
  privateKeyTreeFileName: string;
  votingKeyStartEpoch: number;
  votingKeyEndEpoch: number;
}

export interface VotingKeyCreationResult {
  publicKey: string;
}

export interface VotingKeyFileProvider {
  createVotingFile(params: VotingKeyParams): Promise<VotingKeyCreationResult>;
}

/**
 * TypeScript 実装で投票キーファイルを生成するプロバイダー。
 */
export class NativeVotingKeyFileProvider implements VotingKeyFileProvider {
  constructor(
    private readonly logger: Logger,
    private readonly cryptoPort: ICryptoPort
  ) {}

  public async createVotingFile({
    presetData,
    votingKeysFolder,
    privateKeyTreeFileName,
    votingKeyStartEpoch,
    votingKeyEndEpoch,
  }: VotingKeyParams): Promise<VotingKeyCreationResult> {
    const votingAccount = this.cryptoPort.generateAccount(presetData.networkType);
    const votingPrivateKey = votingAccount.privateKey;
    const votingUtils = new VotingUtils(VotingUtils.nobleImplementation, this.cryptoPort);
    this.logger.info(
      'ネイティブ TypeScript の投票キーファイルジェネレーターを使用して投票ファイルを作成します。'
    );
    const votingFile = await votingUtils.createVotingFile(
      votingPrivateKey,
      votingKeyStartEpoch,
      votingKeyEndEpoch
    );
    writeFileSync(join(votingKeysFolder, privateKeyTreeFileName), votingFile);
    return {
      publicKey: votingAccount.publicKey,
    };
  }
}

/**
 * catapult.tools.votingkey を docker 経由で実行して投票キーファイルを生成するプロバイダー。
 */
export class CatapultVotingKeyFileProvider implements VotingKeyFileProvider {
  private readonly runtimeService: RuntimeService;

  constructor(
    private readonly logger: Logger,
    private readonly user: string,
    private readonly cryptoPort: ICryptoPort
  ) {
    this.runtimeService = new RuntimeService(logger);
  }
  public async createVotingFile({
    presetData,
    votingKeysFolder,
    privateKeyTreeFileName,
    votingKeyStartEpoch,
    votingKeyEndEpoch,
  }: VotingKeyParams): Promise<VotingKeyCreationResult> {
    this.logger.info('docker と catapult.tools.votingkey を使用して投票ファイルを作成します。');
    const votingAccount = this.cryptoPort.generateAccount(presetData.networkType);
    const votingPrivateKey = votingAccount.privateKey;
    const symbolServerImage = presetData.symbolServerImage;
    const binds = [`${votingKeysFolder}:/votingKeys:rw`];
    const cmd = [
      `${presetData.catapultAppFolder}/bin/catapult.tools.votingkey`,
      `--secret=${votingPrivateKey}`,
      `--startEpoch=${votingKeyStartEpoch}`,
      `--endEpoch=${votingKeyEndEpoch}`,
      `--output=/votingKeys/${privateKeyTreeFileName}`,
    ];
    const userId = await this.runtimeService.resolveDockerUserFromParam(this.user);
    const { stdout, stderr } = await this.runtimeService.runImageUsingExec({
      catapultAppFolder: presetData.catapultAppFolder,
      image: symbolServerImage,
      userId: userId,
      cmds: cmd,
      binds: binds,
      workdir: presetData.catapultAppFolder,
    });

    if (stdout.includes('<error> ')) {
      this.logger.info(stdout);
      this.logger.error(stderr);
      throw new Error('投票キーの作成に失敗しました。ログを確認してください。');
    }
    return {
      publicKey: votingAccount.publicKey,
    };
  }
}
