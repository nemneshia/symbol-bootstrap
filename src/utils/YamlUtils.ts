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
   * 文字列が YAML ファイル（.yaml または .yaml 拡張子）かどうかを判定する。
   */
  public static isYamlFile(string: string): boolean {
    return string.toLowerCase().endsWith('.yml') || string.toLowerCase().endsWith('.yaml');
  }

  /**
   * 指定したパスに YAML ファイルを書き込む。
   * パスワードを指定した場合は暗号化してから書き込む。
   *
   * @param path 書き込み先ファイルパス
   * @param object 書き込む内容
   * @param password 暗号化パスワード。`false` / `undefined` の場合は平文で書き込む
   */
  public static async writeYaml(path: string, object: unknown, password: Password): Promise<void> {
    const yamlString = this.toYaml(
      password ? CryptoUtils.encrypt(object, Utils.validatePassword(password)) : object
    );
    await this.writeTextFile(path, yamlString);
  }

  /**
   * オブジェクトを YAML 文字列に変換する。
   *
   * @param object 変換対象のオブジェクト
   * @returns YAML 形式の文字列
   */
  public static toYaml(object: unknown): string {
    return yaml.dump(object, { skipInvalid: true, indent: 2, lineWidth: 140, noRefs: true });
  }

  /**
   * YAML 文字列をオブジェクトにパースする。
   *
   * @param yamlString YAML 形式の文字列
   * @returns パース結果のオブジェクト
   */
  public static fromYaml(yamlString: string): any {
    return yaml.load(yamlString);
  }

  /**
   * YAML ファイルを読み込む。
   * レガシー暗号化（旧形式）が検出された場合は、バックグラウンドでより強力な暗号化へ自動アップグレードする。
   *
   * @param fileLocation 読み込むファイルパス
   * @param password 復号化パスワード。`false` の場合は暗号化チェックをスキップする
   * @returns パース・復号済みのオブジェクト
   */
  public static loadYaml(fileLocation: string, password: Password): any {
    const result = this.loadYamlWithUpgradeInfo(fileLocation, password);

    // レガシー暗号化が検出された場合は、より強力な暗号化で上書き保存する
    if (result.hasLegacyUpgrade && password) {
      this.performLegacyUpgrade(fileLocation, result.data, password);
    }

    return result.data;
  }

  /**
   * レガシー暗号化ファイルを新形式にアップグレードする。
   * 既存ファイルをバックアップしてから、より強力な暗号化で上書き保存する。
   * アップグレードはバックグラウンドで非同期に行われる。
   *
   * @param fileLocation アップグレード対象のファイルパス
   * @param data 復号済みのデータ
   * @param password 再暗号化に使うパスワード
   */
  private static performLegacyUpgrade(fileLocation: string, data: any, password: string): void {
    const backupLocation = `${fileLocation}.bk`;
    console.log(
      `レガシー暗号化を検出しました（${fileLocation}）。より強力な暗号化へアップグレードします...`
    );
    console.log(`バックアップを作成中: ${backupLocation}`);

    try {
      copyFileSync(fileLocation, backupLocation);
      console.log('バックアップを作成しました');

      // バックグラウンドで非同期に再暗号化して保存する
      YamlUtils.writeYaml(fileLocation, data, password)
        .then(() => {
          console.log(`暗号化のアップグレードが完了しました: ${fileLocation}`);
          console.log(`元のファイルはレガシー暗号化のまま ${backupLocation} に保存されています`);
        })
        .catch((e) => {
          console.error(`暗号化のアップグレードに失敗しました（${fileLocation}）: ${e.message}`);
        });
    } catch (e) {
      console.error(`バックアップの作成に失敗しました（${fileLocation}）: ${Utils.getMessage(e)}`);
    }
  }

  /**
   * YAML ファイルを読み込み、データとレガシー暗号化アップグレードの有無を返す。
   * レガシー暗号化が検出された場合は `hasLegacyUpgrade` が `true` になる。
   *
   * @param fileLocation 読み込むファイルパス
   * @param password 復号化パスワード
   * @returns `{ data, hasLegacyUpgrade, filePath }` の形式で情報を返す
   */
  public static loadYamlWithUpgradeInfo(
    fileLocation: string,
    password: Password
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
        throw new KnownError(
          `Cannot decrypt file ${fileLocation}. Have you used the right password?`
        );
      }
    } else {
      if (password !== false && CryptoUtils.encryptedCount(object) > 0) {
        throw new KnownError(
          `File ${fileLocation} seems to be encrypted but no password has been provided. Have you entered the right password?`
        );
      }
    }
    return { data: object, hasLegacyUpgrade: false, filePath: fileLocation };
  }

  /**
   * テキストファイルに文字列を書き込む。
   * 親ディレクトリが存在しない場合は再帰的に作成する。
   *
   * @param path 書き込み先ファイルパス
   * @param text 書き込む文字列
   */
  public static async writeTextFile(path: string, text: string): Promise<void> {
    await fsPromises.mkdir(dirname(path), { recursive: true });
    await fsPromises.writeFile(path, text, 'utf8');
  }

  /**
   * テキストファイルを同期的に読み込む。
   *
   * @param fileLocation 読み込むファイルパス
   * @returns ファイルの内容（UTF-8 文字列）
   */
  public static loadFileAsText(fileLocation: string): string {
    return readFileSync(fileLocation, 'utf8');
  }

  /**
   * テキストファイルを非同期に読み込む。
   *
   * @param path 読み込むファイルパス
   * @returns ファイルの内容（UTF-8 文字列）
   */
  public static async readTextFile(path: string): Promise<string> {
    return fsPromises.readFile(path, 'utf8');
  }
}
