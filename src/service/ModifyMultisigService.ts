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
import { isCancel, text } from '@clack/prompts';

import { Logger } from '../logger/index.js';
import { Addresses, ConfigPreset } from '../model/index.js';
import {
  ICryptoPort,
  INetworkPort,
  ITransactionPort,
  MultisigInfoDto,
  NetworkType,
  SymbolCryptoAdapter,
  SymbolNetworkAdapter,
  SymbolTransactionAdapter,
  TransactionDescriptor,
} from '../sdk/index.js';
import { Constants } from '../utils/Constants.js';
import { TransactionUtils } from '../utils/TransactionUtils.js';
import { Password } from '../utils/YamlUtils.js';
import { AccountResolver } from './AccountResolver.js';
import {
  AnnounceService,
  TransactionFactory,
  TransactionFactoryParams,
} from './AnnounceService.js';
import { BootstrapAccountResolver } from './BootstrapAccountResolver.js';
import { ConfigLoader } from './ConfigLoader.js';
import { RemoteNodeService } from './RemoteNodeService.js';

/**
 * ネットワークへマルチシグ変更トランザクションをアナウンスするためのパラメータ。
 */
export type ModifyMultisigParams = {
  target: string;
  password?: Password;
  url: string;
  maxFee?: number;
  useKnownRestGateways?: boolean;
  ready?: boolean;
  customPreset?: string;
  minRemovalDelta?: number;
  minApprovalDelta?: number;
  addressAdditions?: string;
  addressDeletions?: string;
  serviceProviderPublicKey?: string;
  accountResolver?: AccountResolver;
};

type MultisigNextState = {
  newMinApproval: number;
  newMinRemoval: number;
  newCosignatoryNumber: number;
};

export class ModifyMultisigService implements TransactionFactory {
  public static readonly defaultParams: ModifyMultisigParams = {
    target: Constants.defaultTargetFolder,
    useKnownRestGateways: false,
    ready: false,
    url: 'http://localhost:3000',
    maxFee: 100000,
  };

  private readonly configLoader: ConfigLoader;

  constructor(
    private readonly logger: Logger,
    protected readonly params: ModifyMultisigParams,
    private readonly cryptoPort: ICryptoPort = new SymbolCryptoAdapter(),
    private readonly networkPort: INetworkPort = new SymbolNetworkAdapter(),
    private readonly transactionPort: ITransactionPort = new SymbolTransactionAdapter()
  ) {
    this.configLoader = new ConfigLoader(logger);
  }

  public async run(
    passedPresetData?: ConfigPreset | undefined,
    passedAddresses?: Addresses | undefined
  ): Promise<void> {
    const presetData =
      passedPresetData ??
      this.configLoader.loadExistingPresetData(this.params.target, this.params.password);
    const addresses =
      passedAddresses ??
      this.configLoader.loadExistingAddresses(this.params.target, this.params.password);
    const customPreset = this.configLoader.loadCustomPreset(
      this.params.customPreset,
      this.params.password
    );
    const accountResolver =
      this.params.accountResolver || new BootstrapAccountResolver(this.logger, this.cryptoPort);
    const remoteNodeService = new RemoteNodeService(
      this.logger,
      this.configLoader.mergePresets(presetData, customPreset),
      false,
      this.networkPort
    );
    await new AnnounceService(this.logger, accountResolver, remoteNodeService).announce(
      this.params.url,
      this.params.maxFee,
      this.params.useKnownRestGateways ?? false,
      this.params.ready,
      this.params.target,
      this.configLoader.mergePresets(presetData, customPreset),
      addresses,
      this,
      'some',
      this.params.serviceProviderPublicKey
    );
  }

  public async createTransactions({
    presetData,
    mainAccount,
    networkConfig,
  }: TransactionFactoryParams): Promise<TransactionDescriptor[]> {
    const networkType = presetData.networkType;

    const addressAdditions = await this.resolveAddressAdditions(
      networkType,
      this.params.addressAdditions
    );
    const addressDeletions = await this.resolveAddressDeletions(
      networkType,
      this.params.addressDeletions
    );
    const minApprovalDelta = await this.resolveMinApprovalDelta(this.params.minApprovalDelta);
    const minRemovalDelta = await this.resolveMinRemovalDelta(this.params.minRemovalDelta);

    const url = this.params.url.replace(/\/$/, '');
    const bestUrl = await TransactionUtils.getBestUrlLegacy(
      this.logger,
      presetData,
      this.params.useKnownRestGateways ? undefined : url,
      this.networkPort
    );
    const multisigInfo = await TransactionUtils.getMultisigInfo(
      this.networkPort,
      bestUrl,
      mainAccount.address
    );
    this.validateParams(
      addressAdditions,
      addressDeletions,
      minRemovalDelta,
      minApprovalDelta,
      multisigInfo
    );

    this.logger.info(
      `マルチシグアカウント変更トランザクションを作成します [addressAdditions: "${addressAdditions.join(' , ')}", addressDeletions: "${addressDeletions.join(' , ')}", minApprovalDelta: ${minApprovalDelta}, minRemovalDelta: ${minRemovalDelta}]`
    );

    return [
      this.transactionPort.createMultisigModificationDescriptor(
        addressAdditions,
        addressDeletions,
        minApprovalDelta,
        minRemovalDelta,
        mainAccount.publicKey
      ),
    ];
  }

  public async resolveMinRemovalDelta(delta?: number): Promise<number> {
    return this.resolveDelta('最小削除承認数の差分:', delta);
  }

  public async resolveMinApprovalDelta(delta?: number): Promise<number> {
    return this.resolveDelta('最小承認数の差分:', delta);
  }

  public async resolveDelta(message: string, delta?: number): Promise<number> {
    if (delta !== undefined) {
      return delta;
    }

    const response = await text({
      message,
      defaultValue: '0',
      validate: this.toPromptValidation((input) => {
        if (input === undefined || input.trim() === '') {
          return '数値を入力してください。';
        }
        return Number.isNaN(Number.parseInt(input, 10)) ? '整数を入力してください。' : true;
      }),
    });

    return isCancel(response) ? 0 : Number.parseInt(response, 10);
  }

  public async resolveAddressAdditions(
    networkType: NetworkType,
    cosigners?: string
  ): Promise<string[]> {
    return this.resolveCosigners(
      networkType,
      '追加するコサイナーアドレスを入力してください（カンマ区切り、Enter でスキップ）:',
      cosigners
    );
  }

  public async resolveAddressDeletions(
    networkType: NetworkType,
    cosigners?: string
  ): Promise<string[]> {
    return this.resolveCosigners(
      networkType,
      '削除するコサイナーアドレスを入力してください（カンマ区切り、Enter でスキップ）:',
      cosigners
    );
  }

  public async resolveCosigners(
    networkType: NetworkType,
    message: string,
    cosigners?: string
  ): Promise<string[]> {
    // API 互換のため引数は維持しつつ、現状の実装では networkType は未使用。
    void networkType;
    const response = cosigners !== undefined ? cosigners : await text({ message });
    if (isCancel(response)) {
      return [];
    }
    const resolution = response;
    if (!resolution) {
      return [];
    }
    return this.toAddresses(resolution.split(','));
  }

  private toAddresses(addresses?: string[]): string[] {
    return addresses?.map((addressString) => this.toAddress(addressString.trim())) || [];
  }

  private toAddress(addressString: string): string {
    // Symbol アドレス基本検証: base32 文字かつ長さ 39
    const isValid = /^[A-Z2-7]{39}$/.test(addressString.replace(/-/g, ''));
    if (!isValid) {
      throw new Error(`アドレス ${addressString} は不正です。`);
    }
    return addressString;
  }

  protected validateParams(
    addressAdditions?: string[],
    addressDeletions?: string[],
    minRemovalDelta?: number,
    minApprovalDelta?: number,
    currentMultisigInfo?: MultisigInfoDto
  ): void {
    const nextState = this.calculateNextState(
      addressAdditions,
      addressDeletions,
      minRemovalDelta,
      minApprovalDelta,
      currentMultisigInfo
    );

    this.validateCosignersToAdd(addressAdditions, currentMultisigInfo);
    this.validateCosignersToRemove(addressDeletions, currentMultisigInfo);
    this.validateMinApproval(nextState.newCosignatoryNumber, nextState.newMinApproval);
    this.validateMinRemoval(nextState.newCosignatoryNumber, nextState.newMinRemoval);
    this.validateNonZeroThresholds(nextState);
  }

  private validateNonZeroThresholds(nextState: MultisigNextState): void {
    if (
      nextState.newCosignatoryNumber > 0 &&
      (nextState.newMinApproval === 0 || nextState.newMinRemoval === 0)
    ) {
      throw new Error(
        `コサイナーが ${nextState.newCosignatoryNumber} 件いる状態で、最小承認数または最小削除承認数を 0 には設定できません。`
      );
    }
  }

  private calculateNextState(
    addressAdditions?: string[],
    addressDeletions?: string[],
    minRemovalDelta?: number,
    minApprovalDelta?: number,
    currentMultisigInfo?: MultisigInfoDto
  ): MultisigNextState {
    const newMinApproval = currentMultisigInfo
      ? currentMultisigInfo.minApproval + (minApprovalDelta || 0)
      : minApprovalDelta || 0;
    const newMinRemoval = currentMultisigInfo
      ? currentMultisigInfo.minRemoval + (minRemovalDelta || 0)
      : minRemovalDelta || 0;
    const numberOfAddedCosigners =
      (addressAdditions?.length || 0) - (addressDeletions?.length || 0);
    const newCosignatoryNumber = currentMultisigInfo
      ? currentMultisigInfo.cosignatoryAddresses.length + numberOfAddedCosigners
      : numberOfAddedCosigners;

    return { newMinApproval, newMinRemoval, newCosignatoryNumber };
  }

  private validateCosignersToAdd(
    addressAdditions: string[] | undefined,
    currentMultisigInfo: MultisigInfoDto | undefined
  ): void {
    for (const addressToAdd of addressAdditions || []) {
      if (currentMultisigInfo?.cosignatoryAddresses.some((ca: string) => ca === addressToAdd)) {
        throw new Error(`コサイナーを追加できません。${addressToAdd} は既にコサイナーです。`);
      }
    }
  }

  private validateCosignersToRemove(
    addressDeletions: string[] | undefined,
    currentMultisigInfo: MultisigInfoDto | undefined
  ): void {
    for (const addressToRemove of addressDeletions || []) {
      if (!currentMultisigInfo?.cosignatoryAddresses.some((ca: string) => ca === addressToRemove)) {
        throw new Error(
          `コサイナーを削除できません。${addressToRemove} は現行コサイナーではありません。`
        );
      }
    }
  }

  private validateMinApproval(newCosignatoryNumber: number, newMinApproval: number): void {
    if (newCosignatoryNumber < newMinApproval) {
      throw new Error(
        `最小承認数に対してコサイナーが ${
          newMinApproval - newCosignatoryNumber
        } 件不足しています。コサイナーを追加するか、最小承認数の差分を下げてください。`
      );
    }
  }

  private validateMinRemoval(newCosignatoryNumber: number, newMinRemoval: number): void {
    if (newCosignatoryNumber < newMinRemoval) {
      throw new Error(
        `最小削除承認数に対してコサイナーが ${
          newMinRemoval - newCosignatoryNumber
        } 件不足しています。コサイナーを追加するか、最小削除承認数の差分を下げてください。`
      );
    }
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
}
