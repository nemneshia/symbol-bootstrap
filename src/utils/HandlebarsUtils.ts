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
import Handlebars from 'handlebars';

import { promises as fsPromises } from 'node:fs';
import { totalmem } from 'node:os';
import { basename, join } from 'node:path';

import { SymbolCryptoAdapter } from '../sdk/index.js';
import { Utils } from './Utils.js';
import { YamlUtils } from './YamlUtils.js';

/**
 * Handlebars テンプレートを使用した設定ファイル生成とカスタムヘルパー登録を担当するユーティリティクラス。
 */
export class HandlebarsUtils {
  /**
   * テンプレートフォルダーを走査して設定ファイルを生成する。
   * `.mustache` はレンダリングし、それ以外はそのままコピーする。
   */
  public static async generateConfiguration(
    templateContext: any,
    copyFrom: string,
    copyTo: string,
    excludeFiles: string[] = [],
    includeFiles: string[] = []
  ): Promise<void> {
    await fsPromises.mkdir(copyTo, { recursive: true });
    const entries = await fsPromises.readdir(copyFrom);

    await Promise.all(
      entries.map((entryName) =>
        this.processEntry({
          templateContext,
          entryName,
          copyFrom,
          copyTo,
          excludeFiles,
          includeFiles,
        })
      )
    );
  }

  /**
   * テンプレートディレクトリ内の 1 エントリーを処理する。
   */
  private static async processEntry({
    templateContext,
    entryName,
    copyFrom,
    copyTo,
    excludeFiles,
    includeFiles,
  }: {
    templateContext: any;
    entryName: string;
    copyFrom: string;
    copyTo: string;
    excludeFiles: string[];
    includeFiles: string[];
  }): Promise<void> {
    const fromPath = join(copyFrom, entryName);
    const toPath = join(copyTo, entryName);
    const stat = await fsPromises.stat(fromPath);

    if (stat.isDirectory()) {
      await this.generateConfiguration(
        templateContext,
        fromPath,
        toPath,
        excludeFiles,
        includeFiles
      );
      return;
    }

    if (!stat.isFile()) {
      return;
    }

    const isMustache = entryName.endsWith('.mustache');
    const destinationFile = toPath.replace(/\.mustache$/, '');
    if (!this.shouldProcessFile(destinationFile, excludeFiles, includeFiles)) {
      return;
    }

    await this.writeDestinationFile({
      fromPath,
      destinationFile,
      isMustache,
      templateContext,
    });

    await fsPromises.chmod(destinationFile, 0o600);
  }

  /**
   * 1 ファイル分の出力を行う。
   * mustache ファイルはテンプレート展開し、それ以外はコピーする。
   */
  private static async writeDestinationFile({
    fromPath,
    destinationFile,
    isMustache,
    templateContext,
  }: {
    fromPath: string;
    destinationFile: string;
    isMustache: boolean;
    templateContext: any;
  }): Promise<void> {
    if (isMustache) {
      const template = await YamlUtils.readTextFile(fromPath);
      const renderedTemplate = this.runTemplate(template, templateContext);
      const content = destinationFile.toLowerCase().endsWith('.json')
        ? this.formatJson(renderedTemplate)
        : renderedTemplate;
      await fsPromises.writeFile(destinationFile, content);
      return;
    }

    await fsPromises.copyFile(fromPath, destinationFile);
  }

  /**
   * 除外・許可リストに基づいて処理対象ファイルかを判定する。
   */
  private static shouldProcessFile(
    destinationFile: string,
    excludeFiles: string[],
    includeFiles: string[]
  ): boolean {
    const fileName = basename(destinationFile);
    const isExcluded = excludeFiles.includes(fileName);
    const isIncluded = includeFiles.length === 0 || includeFiles.includes(fileName);
    return !isExcluded && isIncluded;
  }

  /**
   * Handlebars テンプレートを実行して文字列を返す。
   * 失敗時は秘密情報をマスクしたメッセージへ変換して再送出する。
   */
  public static runTemplate(template: string, templateContext: any): string {
    try {
      const compiledTemplate = Handlebars.compile(template);
      return compiledTemplate(templateContext);
    } catch (e) {
      const securedTemplate = Utils.secureString(template);
      const securedContext = Utils.secureString(YamlUtils.toYaml(templateContext));
      const securedMessage = Utils.secureString(Utils.getMessage(e));

      const message = `テンプレートのレンダリング中にエラーが発生しました。Error: ${securedMessage}\nTemplate:\n${securedTemplate}.`;
      throw new Error(`${message}\nContext: \n${securedContext}`, { cause: e });
    }
  }

  // Handlebars ヘルパーをクラス読み込み時に登録する。
  private static initialize = (() => {
    Handlebars.registerHelper('toAmount', HandlebarsUtils.toAmount);
    Handlebars.registerHelper('toHex', HandlebarsUtils.toHex);
    Handlebars.registerHelper('toSimpleHex', HandlebarsUtils.toSimpleHex);
    Handlebars.registerHelper('toSeconds', HandlebarsUtils.toSeconds);
    Handlebars.registerHelper('toJson', HandlebarsUtils.toJson);
    Handlebars.registerHelper('splitCsv', HandlebarsUtils.splitCsv);
    Handlebars.registerHelper('add', HandlebarsUtils.add);
    Handlebars.registerHelper('minus', HandlebarsUtils.minus);
    Handlebars.registerHelper('computerMemory', HandlebarsUtils.computerMemory);
  })();

  /** 加算ヘルパー: 数値同士の場合は数値加算、文字列同士の場合は文字列連結を返す。 */
  private static add(a: any, b: any): string | number {
    if (typeof a === 'number' && typeof b === 'number') {
      return Number(a) + Number(b);
    }
    if (typeof a === 'string' && typeof b === 'string') {
      return a + b;
    }
    return '';
  }

  /** 減算ヘルパー: 数値の差分を返す。非数値の場合は TypeError を投げる。 */
  private static minus(a: any, b: any): number {
    if (typeof a !== 'number') {
      throw new TypeError('expected the first argument to be a number');
    }
    if (typeof b !== 'number') {
      throw new TypeError('expected the second argument to be a number');
    }
    return Number(a) - Number(b);
  }

  /**
   * 搭載メモリー量に対する指定割合のメモリー量を返す。
   */
  public static computerMemory(percentage: number): number {
    return (totalmem() * percentage) / 100;
  }

  /**
   * 整数文字列を 3 桁区切り（'）で整形する。
   */
  public static toAmount(renderedText: string | number): string {
    const numberAsString = String(renderedText).replaceAll("'", '');
    if (!numberAsString.match(/^\d+$/)) {
      throw new Error(`'${renderedText}' is not a valid integer`);
    }
    return (numberAsString.match(/\d{1,3}(?=(\d{3})*$)/g) || [numberAsString]).join("'");
  }

  /**
   * 16進文字列を 4 桁区切り（'）+ `0x` プレフィックスで整形する。
   */
  public static toHex(renderedText: string): string {
    if (!renderedText) {
      return '';
    }
    const numberAsString = HandlebarsUtils.toSimpleHex(renderedText);
    return '0x' + (numberAsString.match(/\w{1,4}(?=(\w{4})*$)/g) || [numberAsString]).join("'");
  }

  /**
   * 16進文字列から区切りと `0x` を除去した生文字列を返す。
   */
  public static toSimpleHex(renderedText: string): string {
    if (!renderedText) {
      return '';
    }
    return renderedText.toString().replaceAll("'", '').replace(/^(0x)/, '');
  }

  /**
   * オブジェクトをインデント付き JSON 文字列へ変換する。
   */
  public static toJson(object: any): string {
    return JSON.stringify(object, null, 2);
  }

  /**
   * JSON文字列を妥当性検証しつつ整形する。
   */
  public static formatJson(string: string): string {
    try {
      return JSON.stringify(JSON.parse(string), null, 2);
    } catch (e) {
      throw new Error(`${Utils.getMessage(e)}:JSON\n ${string}`, { cause: e });
    }
  }

  /**
   * CSV 文字列を分割し、空要素を除去して返す。
   */
  public static splitCsv(object: string): string[] {
    return (object || '')
      .split(',')
      .map((string) => string.trim())
      .filter((string) => string);
  }

  /**
   * `1h`, `10m` などのサーバー時間表記を秒へ変換する。
   */
  public static toSeconds(serverDuration: string): number {
    return new SymbolCryptoAdapter().parseServerDurationToSeconds(serverDuration);
  }
}
