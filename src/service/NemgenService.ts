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
import { promises } from 'node:fs';
import { join } from 'node:path';

import { Logger } from '../logger/index.js';
import { ConfigPreset } from '../model/index.js';
import { Constants } from '../utils/Constants.js';
import { ConfigParams } from './ConfigTypes.js';
import { FileSystemService } from './FileSystemService.js';
import { RuntimeService } from './RuntimeService.js';

type NemgenParams = ConfigParams;

interface NemgenExecutionError {
  stdout?: string;
  stderr?: string;
  message?: string;
}

export class NemgenService {
  private readonly runtimeService: RuntimeService;
  private readonly fileSystemService: FileSystemService;
  constructor(
    private readonly logger: Logger,
    protected readonly params: NemgenParams
  ) {
    this.runtimeService = new RuntimeService(logger);
    this.fileSystemService = new FileSystemService(logger);
  }

  /**
   * nemgen 実行に必要な前処理・実行・後処理を順に行う。
   */
  public async run(presetData: ConfigPreset): Promise<void> {
    const nodeName = this.requireNodeName(presetData);
    const networkIdentifier = presetData.networkIdentifier;
    const nemesisWorkingDir = this.fileSystemService.getTargetNemesisFolder(
      this.params.target,
      true
    );
    const nemesisSeedFolder = join(nemesisWorkingDir, `seed`, networkIdentifier, `0000`);
    const serverConfigWorkingDir = this.fileSystemService.getTargetNodesFolder(
      this.params.target,
      true,
      nodeName,
      'server-config'
    );

    await this.prepareNemesisSeed(nemesisSeedFolder);
    this.fileSystemService.validateFolder(nemesisWorkingDir);
    this.fileSystemService.validateFolder(serverConfigWorkingDir);

    const cmds = [
      `${presetData.catapultAppFolder}/bin/catapult.tools.nemgen`,
      '--resources=/server-config',
      '--nemesisProperties=./server-config/block-properties-file.properties',
      '--useTemporaryCacheDatabase',
    ];

    const binds = [`${serverConfigWorkingDir}:/server-config`, `${nemesisWorkingDir}:/nemesis`];
    await this.executeNemgen(presetData, cmds, binds);
    this.fileSystemService.deleteFolder(join(nemesisWorkingDir, `seed`, networkIdentifier));
    this.logger.info('Nemgen を実行しました。');
  }

  private requireNodeName(presetData: ConfigPreset): string {
    if (!presetData.node) {
      throw new Error('nemgen 実行時は preset に node を定義する必要があります。');
    }
    return presetData.node.name;
  }

  private async prepareNemesisSeed(nemesisSeedFolder: string): Promise<void> {
    await this.fileSystemService.mkdir(nemesisSeedFolder);
    await promises.copyFile(
      join(Constants.ROOT_FOLDER, `config`, `hashes.dat`),
      join(nemesisSeedFolder, `hashes.dat`)
    );
  }

  private async executeNemgen(
    presetData: ConfigPreset,
    cmds: string[],
    binds: string[]
  ): Promise<void> {
    const userId = await this.runtimeService.resolveDockerUserFromParam(this.params.user);
    try {
      const { stdout } = await this.runtimeService.runImageUsingExec({
        catapultAppFolder: presetData.catapultAppFolder,
        image: presetData.symbolServerImage,
        userId,
        workdir: '/nemesis',
        cmds,
        binds,
      });
      if (stdout.includes('<error>')) {
        this.logger.info(stdout);
        throw new Error('Nemgen の実行に失敗しました。ログを確認してください。');
      }
    } catch (e) {
      this.logNemgenFailure(e as NemgenExecutionError);
      throw new Error('Nemgen の実行に失敗しました。ログを確認してください。', {
        cause: e,
      });
    }
  }

  private logNemgenFailure(error: NemgenExecutionError): void {
    if (error.message) this.logger.error(error.message);
    if (error.stdout) this.logger.info(error.stdout);
    if (error.stderr) this.logger.error(error.stderr);
  }
}
