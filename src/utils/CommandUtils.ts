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
import { password } from '@inquirer/prompts';
import { Flags } from '@oclif/core';
import figlet from 'figlet';
import { Logger, LoggerFactory, LogType } from '../logger/index.js';
import { PublicAccountInfo, SymbolCryptoAdapter } from '../sdk/index.js';
import { Constants } from './Constants.js';
import { Password } from './YamlUtils.js';

/**
 * CLI フラグ定義、パスワードバリデーション・プロンプトなど CLI 関連のユーティリティを提供するクラス。
 */
export class CommandUtils {
  /** パスワードプロンプトのデフォルトメッセージ */
  public static passwordPromptDefaultMessage = `Enter the password used to encrypt and decrypt custom presets, addresses.yml, and preset.yml files. When providing a password, private keys will be encrypted. Keep this password in a secure place!`;
  public static helpFlag = Flags.help({ char: 'h', description: 'It shows the help of this command.' });

  public static targetFlag = Flags.string({
    char: 't',
    description: 'The target folder where the symbol-bootstrap network is generated',
    default: Constants.defaultTargetFolder,
  });

  public static passwordFlag = CommandUtils.getPasswordFlag(
    `A password used to encrypt and decrypt private keys in preset files like addresses.yml and preset.yml. Bootstrap prompts for a password by default, can be provided in the command line (--password=XXXX) or disabled in the command line (--noPassword).`,
  );

  public static noPasswordFlag = Flags.boolean({
    description: 'When provided, Bootstrap will not use a password, so private keys will be stored in plain text. Use with caution.',
    default: false,
  });

  public static offlineFlag = Flags.boolean({
    description: 'If --offline is used, Bootstrap resolves the configuration without querying the running network.',
    default: false,
  });

  public static showBanner(): void {
    console.log(figlet.textSync('symbol-bootstrap', { horizontalLayout: 'controlled smushing', font: 'Slant' }));
  }

  public static getPasswordFlag(description: string) {
    return Flags.string({
      description: description,
      parse: async (input: string): Promise<string> => {
        const result = !input || CommandUtils.isValidPassword(input);
        if (result === true) return input;
        throw new Error(`--password is invalid, ${result}`);
      },
    });
  }

  public static isValidPassword(input: string | undefined): boolean | string {
    if (!input || input === '') {
      return true;
    }
    if (input.length >= 4) return true;
    return `Password must have at least 4 characters but got ${input.length}`;
  }

  public static isValidPrivateKey(input: string): boolean | string {
    return new SymbolCryptoAdapter().isHexString(input, 64) ? true : 'Invalid private key. It must have 64 hex characters.';
  }

  public static async resolvePassword(
    logger: Logger,
    providedPassword: Password | undefined,
    noPassword: boolean,
    message: string,
    log: boolean,
  ): Promise<string | undefined> {
    if (!providedPassword) {
      if (noPassword) {
        if (log) logger.warn(`Password has not been provided (--noPassword)! It's recommended to use one for security!`);
        return undefined;
      }
      const responses = await password({
        message: message,
        mask: '*',
        validate: CommandUtils.isValidPassword,
      });
      if (responses === '' || !responses) {
        if (log) logger.warn(`Password has not been provided (empty text)! It's recommended to use one for security!`);
        return undefined;
      }
      if (log) logger.info(`Password has been provided`);
      return responses;
    }
    if (log) logger.info(`Password has been provided`);
    return providedPassword;
  }

  /**
   * Returns account details formatted (ready to print)
   */
  public static formatAccount(account: PublicAccountInfo, wrapped = true): string {
    const log = `Address: ${account.address}`;
    return wrapped ? `[${log}]` : log;
  }

  /**
   * It returns the flag that can be used to tune the class of logger.
   * @param defaultLogTypes the default logger to be used if not provided.
   */
  public static getLoggerFlag(...defaultLogTypes: LogType[]) {
    const options = Object.keys(LogType).map((v) => v as LogType);
    return Flags.string({
      description: `The loggers the command will use. Options are: ${options.join(LoggerFactory.separator)}. Use '${
        LoggerFactory.separator
      }' to select multiple loggers.`,
      default: defaultLogTypes.join(LoggerFactory.separator),
    });
  }
}
