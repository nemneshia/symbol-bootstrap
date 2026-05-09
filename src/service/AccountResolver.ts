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
import { CertificatePair } from '../model/index.js';
import { GeneratedAccount, ICryptoPort, NetworkType, SymbolCryptoAdapter } from '../sdk/index.js';

/**
 * ノードのアカウント（キー）の種別を識別する列挙型。
 * ConfigService やアカウント解決処理全般で使用する。
 */
export enum KeyName {
  Main = 'Main',
  Remote = 'Remote',
  Transport = 'Transport',
  Voting = 'Voting',
  VRF = 'VRF',
  NemesisAccount = 'Nemesis Account',
  ServiceProvider = 'Service Provider',
}

/**
 * アカウント（鍵ペア）を解決するための抽象インターフェース。
 * 実装側で、既存鍵の読み込み・生成・対話入力などを選択できる。
 */
export interface AccountResolver {
  resolveAccount(
    networkType: NetworkType,
    account: CertificatePair | undefined,
    keyName: KeyName,
    nodeName: string | undefined,
    operationDescription: string,
    generateErrorMessage: string | undefined
  ): Promise<GeneratedAccount>;
}

/**
 * 非対話型の基本実装。
 * 与えられた秘密鍵からアカウントを復元するか、必要に応じて新規生成する。
 */
export class DefaultAccountResolver implements AccountResolver {
  constructor(private readonly cryptoPort: ICryptoPort = new SymbolCryptoAdapter()) {}

  /**
   * アカウント情報を解決する。
   * `account` が未指定なら新規生成（またはエラー）、秘密鍵があれば復元する。
   */
  public async resolveAccount(
    networkType: NetworkType,
    account: CertificatePair | undefined,
    _keyName: KeyName,
    _nodeName: string,
    _operationDescription: string,
    generateErrorMessage: string | undefined
  ): Promise<GeneratedAccount> {
    if (!account) {
      if (generateErrorMessage) {
        throw new Error(generateErrorMessage);
      }
      return this.generateNewAccount(networkType);
    }

    if (account.privateKey) {
      return this.cryptoPort.createAccountFromPrivateKey(account.privateKey, networkType);
    }

    throw new Error('秘密鍵が指定されていません。');
  }

  /**
   * 指定ネットワークタイプの新規アカウントを生成する。
   */
  public generateNewAccount(networkType: NetworkType): GeneratedAccount {
    return this.cryptoPort.generateAccount(networkType);
  }
}
