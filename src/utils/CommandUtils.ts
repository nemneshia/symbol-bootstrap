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
import { isCancel, password } from '@clack/prompts';
import { Flags } from '@oclif/core';
import cfonts from 'cfonts';

import { LogType, Logger, LoggerFactory } from '../logger/index.js';
import { PublicAccountInfo, SymbolCryptoAdapter } from '../sdk/index.js';
import { Constants } from './Constants.js';
import { Password } from './YamlUtils.js';

/**
 * CLI フラグ定義、パスワードバリデーション・プロンプトなど CLI 関連のユーティリティを提供するクラス。
 */
export class CommandUtils {
  /** パスワードプロンプトのデフォルトメッセージ */
  public static passwordPromptDefaultMessage = `custom presets、addresses.yaml、preset.yaml の暗号化/復号に使うパスワードを入力してください。パスワードを設定すると秘密鍵は暗号化されます。安全な場所に保管してください。`;
  public static helpFlag = Flags.help({
    char: 'h',
    description: 'このコマンドのヘルプを表示します。',
  });

  public static targetFlag = Flags.string({
    char: 't',
    description: 'symbol-bootstrap ネットワークを生成する対象フォルダを指定します。',
    default: Constants.defaultTargetFolder,
  });

  public static passwordFlag = CommandUtils.getPasswordFlag(
    `addresses.yaml や preset.yaml などのプリセットファイル内の秘密鍵を暗号化/復号するパスワードを指定します。デフォルトでは対話的に入力を求めますが、コマンドライン（--password=XXXX）で指定するか、--noPassword で無効化できます。`
  );

  public static noPasswordFlag = Flags.boolean({
    description:
      '指定するとパスワードを使用せず、秘密鍵は平文で保存されます。取り扱いに注意してください。',
    default: false,
  });

  public static offlineFlag = Flags.boolean({
    description: '--offline を指定すると、稼働中ネットワークへ問い合わせずに設定を解決します。',
    default: false,
  });

  /**
   * CLI 起動時にバナー文字列を表示する。
   */
  public static showBanner(): void {
    console.log(CommandUtils.createBannerText());
  }

  /**
   * パスワードフラグ定義を生成する。
   * @param description フラグ説明文
   */
  public static getPasswordFlag(description: string) {
    return Flags.string({
      description: description,
      parse: async (input: string): Promise<string> => {
        const validationResult = CommandUtils.isValidPassword(input);
        if (validationResult === true) return input;
        throw new Error(`--password が不正です: ${validationResult}`);
      },
    });
  }

  /**
   * パスワード入力値の妥当性を検証する。
   * 空文字は「未設定」として許可する。
   */
  public static isValidPassword(input: string | undefined): boolean | string {
    if (!input) {
      return true;
    }
    if (input.length >= 4) return true;
    return `パスワードは 4 文字以上必要です（現在 ${input.length} 文字）`;
  }

  /**
   * 秘密鍵文字列の妥当性を検証する。
   */
  public static isValidPrivateKey(input: string): boolean | string {
    return new SymbolCryptoAdapter().isHexString(input, 64)
      ? true
      : '秘密鍵が不正です。64 桁の 16 進文字列を指定してください。';
  }

  /**
   * 実行コンテキストに応じてパスワード値を解決する。
   * @returns 利用可能なパスワード。未設定の場合は undefined。
   */
  public static async resolvePassword(
    logger: Logger,
    providedPassword: Password | undefined,
    noPassword: boolean,
    message: string,
    log: boolean
  ): Promise<string | undefined> {
    if (providedPassword) {
      CommandUtils.logProvidedPassword(logger, log);
      return providedPassword;
    }

    if (noPassword) {
      CommandUtils.logNoPasswordFlag(logger, log);
      return undefined;
    }

    const response = await CommandUtils.promptPassword(message);
    if (!response) {
      CommandUtils.logEmptyPassword(logger, log);
      return undefined;
    }

    CommandUtils.logProvidedPassword(logger, log);
    return response;
  }

  /**
   * アカウント情報をログ出力向け文字列へ整形する。
   */
  public static formatAccount(account: PublicAccountInfo, wrapped = true): string {
    const log = `アドレス: ${account.address}`;
    return wrapped ? `[${log}]` : log;
  }

  /**
   * 使用するロガー種別を指定するフラグ定義を返す。
   * @param defaultLogTypes 未指定時に利用するロガー種別
   */
  public static getLoggerFlag(...defaultLogTypes: LogType[]) {
    const options = Object.keys(LogType).map((v) => v as LogType);
    return Flags.string({
      description: `このコマンドで使用するロガーを指定します。指定可能な値: ${options.join(LoggerFactory.separator)}。'${
        LoggerFactory.separator
      }' で区切ると複数指定できます。`,
      default: defaultLogTypes.join(LoggerFactory.separator),
    });
  }

  /**
   * バナー文字列を生成する。
   */
  private static createBannerText(): string {
    const banner = cfonts.render('symbol-bootstrap', {
      font: 'tiny',
      align: 'left',
      // colors: ['#7000DF'],
      gradient: ['#FF00C8', '#7000DF'],
      // background: '#78B6E4',
      letterSpacing: 1,
      lineHeight: 1,
      space: true,
      maxLength: '0',
    });
    return banner && typeof banner === 'object' ? banner.string : 'symbol-bootstrap';
  }

  /**
   * パスワード入力を対話的に取得する。
   */
  private static async promptPassword(message: string): Promise<string | undefined> {
    const response = await password({
      message,
      mask: '*',
      validate: CommandUtils.toPromptValidation(CommandUtils.isValidPassword),
    });
    return isCancel(response) ? undefined : response;
  }

  private static toPromptValidation(
    validator: (input: string | undefined) => boolean | string
  ): (input: string | undefined) => string | undefined {
    return (input: string | undefined) => {
      const result = validator(input);
      if (result === true) {
        return undefined;
      }
      if (typeof result === 'string') {
        return result;
      }
      return '入力値が不正です。';
    };
  }

  /**
   * パスワードが与えられていない旨を警告ログに出力する。
   */
  private static logNoPasswordFlag(logger: Logger, log: boolean): void {
    if (log)
      logger.warn(
        `パスワードが指定されていません（--noPassword）。セキュリティのため設定を推奨します。`
      );
  }

  /**
   * 空のパスワード入力だった旨を警告ログに出力する。
   */
  private static logEmptyPassword(logger: Logger, log: boolean): void {
    if (log)
      logger.warn(
        `パスワードが空文字のため未設定として扱います。セキュリティのため設定を推奨します。`
      );
  }

  /**
   * パスワードが解決済みである旨を情報ログに出力する。
   */
  private static logProvidedPassword(logger: Logger, log: boolean): void {
    if (log) logger.info(`パスワードが指定されました。`);
  }
}
