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

import { copyFileSync, promises as fsPromises, readFileSync } from 'fs';
import * as yaml from 'js-yaml';
import { dirname } from 'path';
import { KnownError } from '../errors/KnownError.js';
import { CryptoUtils } from './CryptoUtils.js';
import { Utils } from './Utils.js';

export type Password = string | false | undefined;

/**
 * YAML / テキストファイルの読み書きを担当するユーティリティクラス。
 * 暗号化・復号化（パスワード対応）およびレガシー暗号化の自動アップグレード機能を含む。
 */
export class YamlUtils {
  /**
   * 文字列が YAML ファイル（.yml または .yaml 拡張子）かどうかを判定する。
   */
  public static isYamlFile(string: string): boolean {
    return string.toLowerCase().endsWith('.yml') || string.toLowerCase().endsWith('.yaml');
  }

  /** @deprecated isYamlFile を使用してください */
  public static isYmlFile(string: string): boolean {
    return YamlUtils.isYamlFile(string);
  }

  public static async writeYaml(path: string, object: unknown, password: Password): Promise<void> {
    const yamlString = this.toYaml(password ? CryptoUtils.encrypt(object, Utils.validatePassword(password)) : object);
    await this.writeTextFile(path, yamlString);
  }

  public static toYaml(object: unknown): string {
    return yaml.dump(object, { skipInvalid: true, indent: 4, lineWidth: 140, noRefs: true });
  }

  public static fromYaml(yamlString: string): any {
    return yaml.load(yamlString);
  }

  public static loadYaml(fileLocation: string, password: Password): any {
    const result = this.loadYamlWithUpgradeInfo(fileLocation, password);

    // If legacy encryption was upgraded, re-save the file with stronger encryption
    if (result.hasLegacyUpgrade && password) {
      const backupLocation = `${fileLocation}.bk`;
      console.log(`Legacy encryption detected in ${fileLocation}. Upgrading to stronger encryption...`);
      console.log(`Creating backup of original file at ${backupLocation}`);

      try {
        copyFileSync(fileLocation, backupLocation);
        console.log(`Backup created successfully`);

        // Re-encrypt and save the file with stronger encryption (this is async, but we'll handle it in background)
        YamlUtils.writeYaml(fileLocation, result.data, password)
          .then(() => {
            console.log(`Successfully upgraded encryption for ${fileLocation}`);
            console.log(`Original file backed up to ${backupLocation} (encrypted with legacy method)`);
          })
          .catch((e) => {
            console.error(`Failed to upgrade encryption for ${fileLocation}: ${e.message}`);
          });
      } catch (e) {
        console.error(`Failed to create backup for ${fileLocation}: ${e instanceof Error ? e.message : e}`);
      }
    }

    return result.data;
  }

  /**
   * Loads YAML file and returns both the data and information about whether legacy encryption was upgraded.
   * This method provides visibility into whether the file should be re-saved with stronger encryption.
   */
  public static loadYamlWithUpgradeInfo(
    fileLocation: string,
    password: Password,
  ): { data: any; hasLegacyUpgrade: boolean; filePath: string } {
    const object = this.fromYaml(this.loadFileAsText(fileLocation));
    if (password) {
      Utils.validatePassword(password);
      try {
        const result = CryptoUtils.decryptWithUpgradeInfo(object, password);
        return {
          data: result.data,
          hasLegacyUpgrade: result.hasLegacyUpgrade,
          filePath: fileLocation,
        };
      } catch {
        throw new KnownError(`Cannot decrypt file ${fileLocation}. Have you used the right password?`);
      }
    } else {
      if (password !== false && CryptoUtils.encryptedCount(object) > 0) {
        throw new KnownError(
          `File ${fileLocation} seems to be encrypted but no password has been provided. Have you entered the right password?`,
        );
      }
    }
    return { data: object, hasLegacyUpgrade: false, filePath: fileLocation };
  }

  public static async writeTextFile(path: string, text: string): Promise<void> {
    const mkdirParentFolder = async (fileName: string): Promise<void> => {
      const parentFolder = dirname(fileName);
      if (parentFolder) {
        await fsPromises.mkdir(parentFolder, { recursive: true });
      }
    };
    await mkdirParentFolder(path);
    await fsPromises.writeFile(path, text, 'utf8');
  }

  public static loadFileAsText(fileLocation: string): string {
    return readFileSync(fileLocation, 'utf8');
  }

  public static async readTextFile(path: string): Promise<string> {
    return fsPromises.readFile(path, 'utf8');
  }
}
