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
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';

import { KnownError } from '../errors/KnownError.js';
import { Logger } from '../logger/index.js';
import { CryptoUtils } from '../utils/CryptoUtils.js';
import { Utils } from '../utils/Utils.js';
import { Password, YamlUtils } from '../utils/YamlUtils.js';
import { FileSystemService } from './FileSystemService.js';

export interface CryptoFileParams {
  source: string;
  destination: string;
  password: Password;
}

/**
 * YAML 暗号化ファイルの入出力ワークフローを担当するサービス。
 */
export class CryptoFileService {
  private readonly fileSystemService: FileSystemService;

  constructor(logger: Logger) {
    this.fileSystemService = new FileSystemService(logger);
  }

  /**
   * 指定ファイルを暗号化して出力先へ保存する。
   */
  public async encryptFile(params: CryptoFileParams): Promise<string> {
    this.validatePaths(params.source, params.destination);

    const data = YamlUtils.loadYaml(params.source, false);
    if (CryptoUtils.encryptedCount(data) > 0) {
      throw new KnownError(
        `入力ファイル ${params.source} は既に暗号化されています。復号する場合は decrypt コマンドを使用してください。`
      );
    }

    const password = this.validateEncryptionPassword(params.password);
    await this.writeOutputFile(params.destination, data, password);
    return `暗号化ファイル ${params.destination} を作成しました。`;
  }

  /**
   * 指定ファイルを復号化して出力先へ保存する。
   */
  public async decryptFile(params: CryptoFileParams): Promise<string> {
    this.validatePaths(params.source, params.destination);

    const data = YamlUtils.loadYaml(params.source, params.password);
    await this.writeOutputFile(params.destination, data, '');
    return `復号ファイル ${params.destination} を作成しました。このファイル内の秘密鍵は平文です。不要になったら削除してください。`;
  }

  /**
   * 入出力パスの存在条件を検証する。
   */
  private validatePaths(source: string, destination: string): void {
    this.validateSourceExists(source);
    this.validateDestinationDoesNotExist(destination);
  }

  private validateSourceExists(source: string): void {
    if (!existsSync(source)) {
      throw new KnownError(`入力ファイル ${source} が存在しません。`);
    }
  }

  private validateDestinationDoesNotExist(destination: string): void {
    if (existsSync(destination)) {
      throw new KnownError(`出力ファイル ${destination} は既に存在します。`);
    }
  }

  private validateEncryptionPassword(password: Password): string {
    if (!password) {
      throw new KnownError(`ファイルを暗号化するにはパスワードが必要です。`);
    }
    return Utils.validatePassword(password);
  }

  private async writeOutputFile(
    destination: string,
    data: unknown,
    password: Password
  ): Promise<void> {
    await this.fileSystemService.mkdir(dirname(destination));
    await YamlUtils.writeYaml(destination, data, password);
  }
}
