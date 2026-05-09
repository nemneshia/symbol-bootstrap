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
import { isAbsolute, join } from 'path';

import dns from 'node:dns/promises';
import net from 'node:net';

import { KnownError } from '../errors/KnownError.js';
import { NetworkType } from '../sdk/index.js';

/**
 * 雑多なユーティリティメソッドをまとめたクラス。
 * OS判定（旧 OSUtils）、オブジェクト操作、バリデーション、ネットワーク識別などを含む。
 */
export class Utils {
  /**
   * テキスト内の64文字16進数（秘密鍵など）を `HIDDEN_KEY` に置換してセキュアな文字列を返す。
   */
  public static secureString(text: string): string {
    const regex = new RegExp('[0-9a-fA-F]{64}', 'g');
    return text.replace(regex, 'HIDDEN_KEY');
  }

  /**
   * 値が undefined または null でないことを検証する。
   */
  public static validateIsDefined(value: unknown, message: string): void {
    if (value === undefined || value === null) {
      throw new Error(message);
    }
  }

  /**
   * ブール値が true であることを検証する。
   */
  public static validateIsTrue(value: boolean, message: string): void {
    if (!value) {
      throw new Error(message);
    }
  }
  /**
   * ターミナル上の同じ行を上書き出力する（プログレス表示用）。
   */
  public static logSameLineMessage(message: string): void {
    process.stdout.write(Utils.isWindows() ? '\x1b[0G' : '\r');
    process.stdout.write(message);
  }
  /**
   * パスワードが最低4文字であることを検証して返す。
   */
  public static validatePassword(password: string): string {
    const passwordMinSize = 4;
    if (password.length < passwordMinSize) {
      throw new KnownError(
        `Password is too short. It should have at least ${passwordMinSize} characters!`
      );
    }
    return password;
  }

  /**
   * NetworkType から 'mainnet' / 'testnet' の識別子文字列を返す。
   */
  public static getNetworkIdentifier(networkType: NetworkType): string {
    return Utils.getNetworkName(networkType);
  }

  /**
   * NetworkType からネットワーク名を返す。
   */
  public static getNetworkName(networkType: NetworkType): string {
    switch (networkType) {
      case NetworkType.MAIN_NET:
        return 'mainnet';
      case NetworkType.TEST_NET:
        return 'testnet';
    }
  }

  /**
   * 作業ディレクトリと相対/絶対パスを組み合わせて最終パスを返す。
   */
  public static resolveWorkingDirPath(workingDir: string, path: string): string {
    if (isAbsolute(path)) {
      return path;
    } else {
      return join(workingDir, path);
    }
  }

  /**
   * オブジェクトから undefined / null / NaN / 空オブジェクト のプロパティを再帰的に削除する。
   * 元のオブジェクトは変更せず、ディープクローンに対して処理を行う。
   */
  public static pruneEmpty(obj: any): any {
    // 元オブジェクトを破壊しないよう、クローンに対して再帰処理する。
    return Utils.pruneValue(structuredClone(obj));
  }
  /**
   * エラーオブジェクトからメッセージ文字列を取得する。
   */
  public static getMessage(e: unknown): string {
    return (e as any)['message'] || `${e}`;
  }

  /**
   * 複数のオブジェクトを lodash.merge と同等の方法で再帰的にディープマージして返す。
   * 配列はインデックスでマージされる（後の引数が前の引数の同一インデックスの値を上書き）。
   */
  public static deepMerge(target: any, ...sources: any[]): any {
    if (!sources.length) return target;
    const result: any = Array.isArray(target) ? [...target] : { ...target };
    for (const source of sources) {
      if (!source || typeof source !== 'object') continue;
      for (const key of Object.keys(source)) {
        const srcVal = source[key];
        const dstVal = result[key];
        if (srcVal === undefined) continue;
        if (
          srcVal !== null &&
          typeof srcVal === 'object' &&
          dstVal !== null &&
          dstVal !== undefined &&
          typeof dstVal === 'object'
        ) {
          // 両方ともオブジェクト/配列の場合は再帰的にマージする
          result[key] = Utils.deepMerge(dstVal, srcVal);
        } else {
          result[key] = srcVal;
        }
      }
    }
    return result;
  }

  /**
   * 配列からランダムに n 件を取得して返す（重複なし）。
   * lodash の _.sampleSize 相当。
   */
  public static sampleSize<T>(arr: T[], n: number): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, n);
  }

  /**
   * 指定のキー関数で重複を排除した配列を返す。
   * lodash の _.uniqBy 相当。
   */
  public static uniqBy<T>(arr: T[], keyFn: (item: T) => any): T[] {
    const seen = new Set<any>();
    return arr.filter((item) => {
      const key = keyFn(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  public static async resolveHost(host: string) {
    if (net.isIP(host)) return host;
    const { address } = await dns.lookup(host);
    return address;
  }

  // --- OSUtils から統合したOS判定メソッド ---

  /**
   * 現在のプロセスが Linux/Unix 上のルート権限で実行されているか確認する。
   */
  public static isRoot(): boolean {
    return !Utils.isWindows() && typeof process.getuid === 'function' && process.getuid() === 0;
  }

  /**
   * 現在の OS が Windows かどうかを返す。
   */
  public static isWindows(): boolean {
    return process.platform === 'win32';
  }

  /**
   * オブジェクトまたは配列が空かどうかを判定する内部ヘルパー。
   * 配列は length === 0、オブジェクトは own enumerable キーがない場合に空と判定する。
   */
  private static isObjectEmpty(value: any): boolean {
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object' && value !== null) return Object.keys(value).length === 0;
    return false;
  }

  /**
   * 値を再帰的に走査して空要素を削除する内部ヘルパー。
   */
  private static pruneValue(current: any): any {
    if (Array.isArray(current)) {
      return current
        .map((value) => Utils.pruneValue(value))
        .filter((value) => !Utils.shouldPruneValue(value));
    }

    if (typeof current === 'object' && current !== null) {
      for (const key of Object.keys(current)) {
        const value = Utils.pruneValue(current[key]);
        if (Utils.shouldPruneValue(value)) {
          delete current[key];
        } else {
          current[key] = value;
        }
      }
      return current;
    }

    return current;
  }

  /**
   * prune 対象の空値かどうかを判定する内部ヘルパー。
   */
  private static shouldPruneValue(value: any): boolean {
    return (
      value === undefined || value === null || Number.isNaN(value) || Utils.isObjectEmpty(value)
    );
  }
}
