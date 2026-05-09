/*
 * Copyright 2021 NEM
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

import { KnownError } from '../errors/KnownError.js';
import { Logger } from '../logger/index.js';
import { CertificatePair } from '../model/index.js';
import { GeneratedAccount, ICryptoPort, NetworkType, SymbolCryptoAdapter } from '../sdk/index.js';
import { CommandUtils } from '../utils/CommandUtils.js';
import { AccountResolver, KeyName } from './AccountResolver.js';

/**
 * プロンプト入力に対応したアカウント解決実装。
 */
export class BootstrapAccountResolver implements AccountResolver {
  constructor(
    private readonly logger: Logger,
    private readonly cryptoPort: ICryptoPort = new SymbolCryptoAdapter()
  ) {}

  public async resolveAccount(
    networkType: NetworkType,
    account: CertificatePair | undefined,
    keyName: KeyName,
    nodeName: string,
    operationDescription: string,
    generateErrorMessage: string | undefined
  ): Promise<GeneratedAccount> {
    if (!account) {
      if (generateErrorMessage) {
        throw new KnownError(generateErrorMessage);
      }
      this.logger.info(`${keyName} アカウントを生成します...`);
      return this.cryptoPort.generateAccount(networkType);
    }

    if (account.privateKey) {
      return this.cryptoPort.createAccountFromPrivateKey(account.privateKey, networkType);
    }

    return this.resolveAccountByPrompt(
      networkType,
      account,
      keyName,
      nodeName,
      operationDescription
    );
  }

  /**
   * 秘密鍵が未設定のアカウントを対話的に解決する。
   */
  private async resolveAccountByPrompt(
    networkType: NetworkType,
    account: CertificatePair,
    keyName: KeyName,
    nodeName: string,
    operationDescription: string
  ): Promise<GeneratedAccount> {
    const address = this.cryptoPort.getAddressFromPublicKey(account.publicKey, networkType);
    const nodeDescription = nodeName === '' ? '' : `ノード '${nodeName}' の`;

    while (true) {
      this.logPromptIntro(operationDescription, keyName);
      const privateKey = await this.promptPrivateKey(
        address,
        account.publicKey,
        nodeDescription,
        keyName
      );
      if (!privateKey) {
        this.logger.info('秘密鍵を入力してください。');
        continue;
      }

      const enteredAccount = this.cryptoPort.createAccountFromPrivateKey(privateKey, networkType);
      if (!this.isMatchedPublicKey(enteredAccount.publicKey, account.publicKey)) {
        this.logInvalidPrivateKey(address, enteredAccount.address);
        continue;
      }

      account.privateKey = privateKey;
      return enteredAccount;
    }
  }

  private logPromptIntro(operationDescription: string, keyName: KeyName): void {
    this.logger.info('');
    this.logger.info(`${operationDescription} には ${keyName} の秘密鍵が必要です。`);
  }

  private async promptPrivateKey(
    address: string,
    publicKey: string,
    nodeDescription: string,
    keyName: KeyName
  ): Promise<string | undefined> {
    const response = await password({
      message: `アドレス: ${address} / 公開鍵: ${publicKey} の ${nodeDescription}${keyName} アカウントに対応する 64 桁 HEX 秘密鍵を入力してください:`,
      mask: '*',
      validate: this.toPromptValidation((input) => CommandUtils.isValidPrivateKey(input ?? '')),
    });
    if (isCancel(response)) {
      return undefined;
    }
    return response === '' ? undefined : response.toUpperCase();
  }

  private toPromptValidation(
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

  private isMatchedPublicKey(actualPublicKey: string, expectedPublicKey: string): boolean {
    return actualPublicKey.toUpperCase() === expectedPublicKey.toUpperCase();
  }

  private logInvalidPrivateKey(expectedAddress: string, actualAddress: string): void {
    this.logger.info(
      `秘密鍵が不正です。期待されるアドレスは ${expectedAddress} ですが、入力された秘密鍵のアドレスは ${actualAddress} です。\n`
    );
    this.logger.info('秘密鍵を再入力してください。');
  }
}
