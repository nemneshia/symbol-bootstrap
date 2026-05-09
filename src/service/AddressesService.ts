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
import { Logger } from '../logger/index.js';
import {
  Addresses,
  ConfigAccount,
  ConfigPreset,
  MosaicAccounts,
  NodeAccount,
  NodePreset,
  PrivateKeySecurityMode,
} from '../model/index.js';
import { ICryptoPort, NetworkType, SymbolCryptoAdapter } from '../sdk/index.js';
import { ConfigurationUtils } from '../utils/ConfigurationUtils.js';
import { CryptoUtils } from '../utils/CryptoUtils.js';
import { Utils } from '../utils/Utils.js';
import { YamlUtils } from '../utils/YamlUtils.js';
import { AccountResolver, KeyName } from './AccountResolver.js';

/**
 * addresses.yaml とそこに含まれるアカウント情報を解決するサービスクラス。
 */
export class AddressesService {
  private readonly cryptoPort: ICryptoPort;

  /**
   * @param logger ログ出力インターフェース
   * @param accountResolver アカウント解決インターフェース
   * @param cryptoPort 暗号処理ポート（省略時は SymbolCryptoAdapter を使用）
   */
  constructor(
    private readonly logger: Logger,
    private readonly accountResolver: AccountResolver,
    cryptoPort?: ICryptoPort
  ) {
    this.cryptoPort = cryptoPort ?? new SymbolCryptoAdapter();
  }

  /**
   * プリセットデータと既存アドレス情報を元に、最終的な Addresses オブジェクトを解決して返す。
   *
   * @param oldAddresses 既存の addresses（アップグレード時に使用）
   * @param oldPresetData 既存のプリセットデータ（アップグレード時に使用）
   * @param presetData 最新のプリセットデータ
   * @returns 解決済みの Addresses オブジェクト
   */
  public async resolveAddresses(
    oldAddresses: Addresses | undefined,
    oldPresetData: ConfigPreset | undefined,
    presetData: ConfigPreset
  ): Promise<Addresses> {
    const networkType = presetData.networkType;
    const addresses: Addresses = {
      version: 1,
      networkType,
      nemesisGenerationHashSeed:
        presetData.nemesisGenerationHashSeed ||
        oldAddresses?.nemesisGenerationHashSeed ||
        this.cryptoPort.randomHex(32),
      sinkAddress: presetData.sinkAddress || oldAddresses?.sinkAddress,
    };

    presetData.harvestNetworkFeeSinkAddress = this.resolveSinkAddress(
      presetData.harvestNetworkFeeSinkAddress,
      addresses,
      networkType
    );
    presetData.mosaicRentalFeeSinkAddress = this.resolveSinkAddress(
      presetData.mosaicRentalFeeSinkAddress,
      addresses,
      networkType
    );
    presetData.namespaceRentalFeeSinkAddress = this.resolveSinkAddress(
      presetData.namespaceRentalFeeSinkAddress,
      addresses,
      networkType
    );

    // V1 フォールバック: V1 アドレスが未設定の場合は現行アドレスをそのまま使用する
    presetData.harvestNetworkFeeSinkAddressV1 ??= presetData.harvestNetworkFeeSinkAddress;
    presetData.mosaicRentalFeeSinkAddressV1 ??= presetData.mosaicRentalFeeSinkAddress;
    presetData.namespaceRentalFeeSinkAddressV1 ??= presetData.namespaceRentalFeeSinkAddress;
    presetData.networkIdentifier = Utils.getNetworkIdentifier(networkType);
    presetData.networkName = Utils.getNetworkName(networkType);
    presetData.nemesisGenerationHashSeed = addresses.nemesisGenerationHashSeed;
    addresses.node = await this.resolveNodesAccounts(oldAddresses, presetData, networkType);

    const shouldCreateNemesis = ConfigurationUtils.shouldCreateNemesis(presetData);
    if (shouldCreateNemesis) {
      const nemesisSigner = this.resolveNemesisAccount(presetData, oldAddresses);
      if (!nemesisSigner.privateKey) {
        throw new Error('Nemesis Signer の秘密鍵を解決できる必要があります。');
      }
      addresses.nemesisSigner = nemesisSigner;
      presetData.nemesisSignerPublicKey = nemesisSigner.publicKey;
      presetData.nemesis.nemesisSignerPrivateKey = nemesisSigner.privateKey;
    }

    const nemesisSignerAddress = this.cryptoPort.getAddressFromPublicKey(
      presetData.nemesisSignerPublicKey,
      networkType
    );

    presetData.currencyMosaicId ??= this.cryptoPort.createMosaicId(0, nemesisSignerAddress);

    if (!presetData.harvestingMosaicId) {
      if (!presetData.nemesis) {
        throw new Error('nemesis が未定義です。');
      }
      if (presetData.nemesis.mosaics && presetData.nemesis.mosaics.length > 1) {
        presetData.harvestingMosaicId = this.cryptoPort.createMosaicId(1, nemesisSignerAddress);
      } else {
        presetData.harvestingMosaicId = presetData.currencyMosaicId;
      }
    }

    if (shouldCreateNemesis) {
      if (oldAddresses) {
        if (!oldPresetData) {
          throw new Error('アップグレード時は oldPresetData が必要です。');
        }
        // アップグレード時はネメシス設定を変更できないため、既存の設定を引き継ぐ
        addresses.mosaics = oldAddresses.mosaics;
        presetData.nemesis = oldPresetData.nemesis;
      } else {
        addresses.mosaics = this.processNemesisBalances(
          presetData,
          addresses,
          nemesisSignerAddress
        );
      }
    }

    return addresses;
  }

  /**
   * フィーシンクアドレスを解決する。
   * - 提供済みのアドレスがある場合はそれを正規化して返す。
   * - ない場合は sinkAddress（未設定なら新規生成）を返す。
   *
   * @param providedAddress プリセットに指定されたアドレス文字列（省略可）
   * @param addresses 解決中の Addresses オブジェクト（sinkAddress が副作用で更新される場合がある）
   * @param networkType ネットワークタイプ
   * @returns 解決済みのアドレス文字列
   */
  private resolveSinkAddress(
    providedAddress: string | undefined,
    addresses: Addresses,
    networkType: NetworkType
  ): string {
    if (providedAddress) {
      return this.cryptoPort.createAddressFromRawAddress(providedAddress);
    }
    addresses.sinkAddress =
      addresses.sinkAddress || this.cryptoPort.generateAccount(networkType).address;
    return addresses.sinkAddress;
  }

  /**
   * 配布量の合計を計算する。負の値が含まれる場合は例外を投げる。
   *
   * @param distribution アドレスと配布量のペア配列
   * @param mosaicName 検証エラー表示用のモザイク名
   * @returns 合計配布量
   */
  private sum(distribution: { amount: number; address: string }[], mosaicName: string): number {
    return distribution
      .map((d, index) => {
        if (d.amount < 0) {
          throw new Error(
            `Nemesis distribution balance cannot be less than 0. Mosaic ${mosaicName}, distribution address: ${d.address}, amount: ${d.amount}, index ${index}. \nDistributions are:\n${YamlUtils.toYaml(distribution)}`
          );
        }
        return d.amount;
      })
      .reduce((a, b) => a + b, 0);
  }

  /**
   * ネメシス署名者アカウントを解決する。
   * 既存のアドレス情報またはプリセットから秘密鍵・公開鍵を取得し、ConfigAccount を生成する。
   *
   * @param presetData プリセットデータ
   * @param oldAddresses 既存の addresses（アップグレード時）
   * @returns 解決済みのネメシス署名者アカウント
   */
  private resolveNemesisAccount(
    presetData: ConfigPreset,
    oldAddresses: Addresses | undefined
  ): ConfigAccount {
    const networkType = presetData.networkType;
    const signerPrivateKey =
      presetData.nemesis.nemesisSignerPrivateKey ||
      oldAddresses?.nemesisSigner?.privateKey ||
      this.cryptoPort.generateAccount(networkType).privateKey;

    const signerPublicKey =
      presetData.nemesisSignerPublicKey || oldAddresses?.nemesisSigner?.publicKey;
    const nemesisSigner = ConfigurationUtils.toConfigAccountFomKeys(
      networkType,
      signerPublicKey,
      signerPrivateKey,
      this.cryptoPort
    );

    if (!nemesisSigner) {
      throw new Error('Nemesis Signer を解決できる必要があります。');
    }
    return nemesisSigner;
  }

  /**
   * ネメシスモザイクの配布バランスを計算し、各モザイクの MosaicAccounts 一覧を返す。
   *
   * @param presetData プリセットデータ
   * @param addresses 解決中の Addresses オブジェクト
   * @param nemesisSignerAddress ネメシス署名者アドレス
   * @returns MosaicAccounts 配列
   */
  private processNemesisBalances(
    presetData: ConfigPreset,
    addresses: Addresses,
    nemesisSignerAddress: string
  ): MosaicAccounts[] {
    const privateKeySecurityMode = CryptoUtils.getPrivateKeySecurityMode(
      presetData.privateKeySecurityMode
    );
    const networkType = presetData.networkType;
    const mosaics: MosaicAccounts[] = [];
    presetData.nemesis.mosaics.forEach((m, mosaicIndex) => {
      const accounts = this.generateAddresses(networkType, privateKeySecurityMode, m.accounts);
      const id = this.cryptoPort.createMosaicId(mosaicIndex, nemesisSignerAddress);
      mosaics.push({
        id,
        name: m.name,
        accounts,
      });
      const getNodeBalance = (): number | undefined => {
        if (!presetData.node) {
          return undefined;
        }
        const balance = presetData.node.balances?.[mosaicIndex];
        if (balance !== undefined) {
          return balance;
        }
        if (presetData.node.excludeFromNemesis) {
          return 0;
        }
        return undefined;
      };
      const providedDistributions = [...(m.currencyDistributions || [])];
      if (addresses.node) {
        const balance = getNodeBalance();
        if (balance !== undefined) {
          providedDistributions.push({
            address: addresses.node.main.address,
            amount: balance,
          });
        }
      }
      const nodeMainAccounts =
        addresses.node && getNodeBalance() === undefined ? [addresses.node] : [];
      const providedSupply = this.sum(providedDistributions, m.name);
      const remainingSupply = m.supply - providedSupply;
      if (remainingSupply < 0) {
        throw new Error(
          `モザイク ${m.name} の固定配布量 ${providedSupply} が、総供給量 ${m.supply} を超えています。`
        );
      }
      const dynamicAccounts = accounts.length + nodeMainAccounts.length;
      const amountPerAccount = Math.floor(remainingSupply / dynamicAccounts);
      const maxHarvesterBalance = this.getMaxHarvesterBalance(presetData, mosaicIndex);
      const generatedAccounts = [
        ...accounts.map((a) => ({
          address: a.address,
          amount: amountPerAccount,
        })),
        ...nodeMainAccounts.map((n) => ({
          address: n.main.address,
          amount: Math.min(maxHarvesterBalance, amountPerAccount),
        })),
      ];
      m.currencyDistributions = [...generatedAccounts, ...providedDistributions].filter(
        (d) => d.amount > 0
      );

      const generatedSupply = this.sum(generatedAccounts.slice(1), m.name);

      m.currencyDistributions[0].amount = m.supply - providedSupply - generatedSupply;

      const supplied = this.sum(m.currencyDistributions, m.name);
      if (m.supply !== supplied) {
        throw new Error(
          `nemgen の供給量が不正です。期待値 ${m.supply} に対して合計は ${supplied} です。\n配布内容:\n${YamlUtils.toYaml(m.currencyDistributions)}`
        );
      }
    });
    return mosaics;
  }

  /**
   * モザイクインデックスに応じてハーベスターの最大バランスを返す。
   * モザイクの第1番目（インデックス=0の単一モザイク、または複数モザイク時のインデックス=1）は maxHarvesterBalance を適用する。
   *
   * @param presetData プリセットデータ
   * @param mosaicIndex モザイクインデックス
   * @returns ハーベスターの最大バランス
   */
  private getMaxHarvesterBalance(presetData: ConfigPreset, mosaicIndex: number): number {
    return (presetData.nemesis.mosaics.length === 1 && mosaicIndex === 0) ||
      (presetData.nemesis.mosaics.length > 1 && mosaicIndex === 1)
      ? presetData.maxHarvesterBalance
      : Number.MAX_SAFE_INTEGER;
  }

  /**
   * すべてのノードのアカウント一覧を解決する。
   *
   * @param oldAddresses 既存の addresses（アップグレード時）
   * @param presetData プリセットデータ
   * @param networkType ネットワークタイプ
   * @returns 解決済み NodeAccount
   */
  public async resolveNodesAccounts(
    oldAddresses: Addresses | undefined,
    presetData: ConfigPreset,
    networkType: NetworkType
  ): Promise<NodeAccount | undefined> {
    if (!presetData.node) {
      return undefined;
    }
    return this.resolveNodeAccounts(
      oldAddresses?.node,
      presetData,
      0,
      presetData.node,
      networkType
    );
  }

  /**
   * 1つのノードのアカウント一式（main / transport / remote / vrf / voting 等）を解決する。
   *
   * @param oldNodeAccount 既存の NodeAccount（アップグレード時）
   * @param presetData プリセットデータ
   * @param index ノードインデックス
   * @param nodePreset ノードプリセット情報
   * @param networkType ネットワークタイプ
   * @returns 解決済み NodeAccount
   */
  public async resolveNodeAccounts(
    oldNodeAccount: NodeAccount | undefined,
    presetData: ConfigPreset,
    index: number,
    nodePreset: NodePreset,
    networkType: NetworkType
  ): Promise<NodeAccount> {
    const privateKeySecurityMode = CryptoUtils.getPrivateKeySecurityMode(
      presetData.privateKeySecurityMode
    );
    const name = nodePreset.name || `node-${index}`;
    const main = await this.resolveAccount(
      networkType,
      privateKeySecurityMode,
      KeyName.Main,
      nodePreset.name,
      oldNodeAccount?.main,
      ConfigurationUtils.toConfigAccountFomKeys(
        networkType,
        nodePreset.mainPublicKey,
        nodePreset.mainPrivateKey,
        this.cryptoPort
      )
    );
    const transport = await this.resolveAccount(
      networkType,
      privateKeySecurityMode,
      KeyName.Transport,
      nodePreset.name,
      oldNodeAccount?.transport,
      ConfigurationUtils.toConfigAccountFomKeys(
        networkType,
        nodePreset.transportPublicKey,
        nodePreset.transportPrivateKey,
        this.cryptoPort
      )
    );

    const friendlyName = nodePreset.friendlyName || main.publicKey.substring(0, 7);

    const nodeAccount: NodeAccount = {
      name,
      friendlyName,
      roles: ConfigurationUtils.resolveRoles(nodePreset),
      main,
      transport,
    };

    const useRemoteAccount = nodePreset.nodeUseRemoteAccount || presetData.nodeUseRemoteAccount;

    if (useRemoteAccount && (nodePreset.harvesting || nodePreset.voting)) {
      nodeAccount.remote = await this.resolveAccount(
        networkType,
        privateKeySecurityMode,
        KeyName.Remote,
        nodePreset.name,
        oldNodeAccount?.remote,
        ConfigurationUtils.toConfigAccountFomKeys(
          networkType,
          nodePreset.remotePublicKey,
          nodePreset.remotePrivateKey,
          this.cryptoPort
        )
      );
    }
    if (nodePreset.harvesting) {
      nodeAccount.vrf = await this.resolveAccount(
        networkType,
        privateKeySecurityMode,
        KeyName.VRF,
        nodePreset.name,
        oldNodeAccount?.vrf,
        ConfigurationUtils.toConfigAccountFomKeys(
          networkType,
          nodePreset.vrfPublicKey,
          nodePreset.vrfPrivateKey,
          this.cryptoPort
        )
      );
    }

    return nodeAccount;
  }

  /**
   * アカウント一覧を生成する。
   * - `accounts` が数値ならその数分フレッシュアカウントを生成する。
   * - 配列なら公開鍵リストから ConfigAccount を生成する。
   *
   * @param networkType ネットワークタイプ
   * @param privateKeySecurityMode 秘密鍵のセキュリティモード
   * @param accounts 数値（生成する数）または公開鍵の文字列配列
   * @returns 生成または解決された ConfigAccount 一覧
   */
  public generateAddresses(
    networkType: NetworkType,
    privateKeySecurityMode: PrivateKeySecurityMode,
    accounts: number | string[]
  ): ConfigAccount[] {
    if (typeof accounts === 'number') {
      return [...Array(accounts).keys()].map(() =>
        ConfigurationUtils.toConfigAccount(this.cryptoPort.generateAccount(networkType))
      );
    } else {
      return accounts.map((key) =>
        ConfigurationUtils.toConfigAccount(this.cryptoPort.createPublicAccount(key, networkType))
      );
    }
  }

  /**
   * 指定されたキーナームとセキュリティモードの組み合わせでアカウント生成時のエラーメッセージを返す。
   * アカウントを安全に生成できる場合は undefined を返す。
   *
   * @param keyName キーナーム
   * @param privateKeySecurityMode 秘密鍵のセキュリティモード
   * @returns エラーメッセージ文字列、または undefined
   */
  public resolveGenerateErrorMessage(
    keyName: KeyName,
    privateKeySecurityMode: PrivateKeySecurityMode
  ): string | undefined {
    if (
      keyName === KeyName.Main &&
      (privateKeySecurityMode === PrivateKeySecurityMode.PROMPT_ALL ||
        privateKeySecurityMode === PrivateKeySecurityMode.PROMPT_MAIN_TRANSPORT ||
        privateKeySecurityMode === PrivateKeySecurityMode.PROMPT_MAIN)
    ) {
      return `Account ${keyName} cannot be generated when Private Key Security Mode is ${privateKeySecurityMode}. Account won't be stored anywhere!. Please use ${PrivateKeySecurityMode.ENCRYPT}, or provider your ${keyName} account with custom presets!`;
    }
    if (
      keyName === KeyName.Transport &&
      (privateKeySecurityMode === PrivateKeySecurityMode.PROMPT_ALL ||
        privateKeySecurityMode === PrivateKeySecurityMode.PROMPT_MAIN_TRANSPORT)
    ) {
      return `Account ${keyName} cannot be generated when Private Key Security Mode is ${privateKeySecurityMode}. Account won't be stored anywhere!. Please use ${PrivateKeySecurityMode.ENCRYPT}, ${PrivateKeySecurityMode.PROMPT_MAIN}, or provider your ${keyName} account with custom presets!`;
    }
    if (privateKeySecurityMode === PrivateKeySecurityMode.PROMPT_ALL) {
      return `Account ${keyName} cannot be generated when Private Key Security Mode is ${privateKeySecurityMode}. Account won't be stored anywhere! Please use ${PrivateKeySecurityMode.ENCRYPT}, ${PrivateKeySecurityMode.PROMPT_MAIN}, ${PrivateKeySecurityMode.PROMPT_MAIN_TRANSPORT}, or provider your ${keyName} account with custom presets!`;
    }
    return undefined;
  }

  /**
   * ノードアカウントを解決する。
   * 既存・新規アカウントの照合・導出・ログ記録を行い、最終的な ConfigAccount を返す。
   *
   * @param networkType ネットワークタイプ
   * @param privateKeySecurityMode 秘密鍵のセキュリティモード
   * @param keyName キーナーム
   * @param nodeName ノード名
   * @param oldStoredAccount 既存の保存アカウント
   * @param newProvidedAccount 新規提供アカウント
   * @returns 解決済みの ConfigAccount
   */
  public async resolveAccount(
    networkType: NetworkType,
    privateKeySecurityMode: PrivateKeySecurityMode,
    keyName: KeyName,
    nodeName: string,
    oldStoredAccount: ConfigAccount | undefined,
    newProvidedAccount: ConfigAccount | undefined
  ): Promise<ConfigAccount> {
    const oldAccount = ConfigurationUtils.toAccount(
      networkType,
      oldStoredAccount?.publicKey.toUpperCase(),
      oldStoredAccount?.privateKey?.toUpperCase(),
      this.cryptoPort
    );
    const newAccount = ConfigurationUtils.toAccount(
      networkType,
      newProvidedAccount?.publicKey?.toUpperCase(),
      newProvidedAccount?.privateKey?.toUpperCase(),
      this.cryptoPort
    );

    const getAccountLog = (a: { address: string; publicKey: string }) =>
      `${keyName} Account ${a.address} Public Key ${a.publicKey} `;

    if (oldAccount && newAccount) {
      if (oldAccount.address.toUpperCase() === newAccount.address.toUpperCase()) {
        this.logger.info(`${getAccountLog(newAccount)} を再利用します`);
        return {
          ...ConfigurationUtils.toConfigAccount(oldAccount),
          ...ConfigurationUtils.toConfigAccount(newAccount),
        };
      }
      this.logger.info(
        `旧 ${getAccountLog(oldAccount)} は変更されました。新しい ${getAccountLog(newAccount)} で置き換えます。`
      );
      return ConfigurationUtils.toConfigAccount(newAccount);
    }
    if (oldAccount) {
      this.logger.info(`${getAccountLog(oldAccount)} を再利用します...`);
      return ConfigurationUtils.toConfigAccount(oldAccount);
    }
    if (newAccount) {
      this.logger.info(`${getAccountLog(newAccount)} が指定されました`);
      return ConfigurationUtils.toConfigAccount(newAccount);
    }

    const generateErrorMessage = this.resolveGenerateErrorMessage(keyName, privateKeySecurityMode);

    const account = await this.accountResolver.resolveAccount(
      networkType,
      newProvidedAccount || oldStoredAccount,
      keyName,
      nodeName,
      'initialization',
      generateErrorMessage
    );
    return ConfigurationUtils.toConfigAccount({
      publicKey: account.publicKey,
      address: account.address,
      privateKey: account.privateKey,
    });
  }
}
