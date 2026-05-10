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
import { confirm, isCancel, password } from '@clack/prompts';
import { Flags } from '@oclif/core';

import { Logger } from '../logger/index.js';
import { Addresses, ConfigPreset, NodeAccount, NodePreset } from '../model/index.js';
import {
  AccountInfoDto,
  GeneratedAccount,
  ICryptoPort,
  INetworkPort,
  ITransactionPort,
  NetworkConfigDto,
  NetworkType,
  PublicAccountInfo,
  SymbolCryptoAdapter,
  SymbolTransactionAdapter,
  TransactionDescriptor,
} from '../sdk/index.js';
import { CommandUtils } from '../utils/CommandUtils.js';
import { TransactionUtils } from '../utils/TransactionUtils.js';
import { AccountResolver, KeyName } from './AccountResolver.js';
import { RemoteNodeService } from './RemoteNodeService.js';

export interface TransactionFactoryParams {
  presetData: ConfigPreset;
  nodePreset: NodePreset;
  nodeAccount: NodeAccount;
  mainAccountInfo?: AccountInfoDto;
  mainAccount: PublicAccountInfo;
  networkConfig: NetworkConfigDto;
  target: string;
}

export interface TransactionFactory {
  createTransactions(params: TransactionFactoryParams): Promise<TransactionDescriptor[]>;
}

type AnnounceExecutionContext = {
  url: string;
  providedMaxFee: number | undefined;
  ready: boolean | undefined;
  target: string;
  tokenAmount: string;
  presetData: ConfigPreset;
  nodePreset: NodePreset;
  nodeAccount: NodeAccount;
  networkConfig: NetworkConfigDto;
  mainAccount: PublicAccountInfo;
  serviceProviderAccount?: PublicAccountInfo;
  announcerAccount: PublicAccountInfo;
  descriptors: TransactionDescriptor[];
  confirmFn: (description: string) => Promise<boolean>;
};

export class AnnounceService {
  private networkPort?: INetworkPort;
  private static hasProcessListener = false;

  constructor(
    private readonly logger: Logger,
    private readonly accountResolver: AccountResolver,
    private readonly remoteNodeService: RemoteNodeService,
    private readonly cryptoPort: ICryptoPort = new SymbolCryptoAdapter(),
    private readonly transactionPort: ITransactionPort = new SymbolTransactionAdapter()
  ) {}

  private static onProcessListener = () => {
    if (AnnounceService.hasProcessListener) {
      return;
    }
    process.on('SIGINT', () => {
      process.exit(400);
    });
    AnnounceService.hasProcessListener = true;
  };

  public static flags = {
    password: Flags.string({
      description: `パスワードを指定して、対話プロンプトを表示せずに実行します。セキュリティ上この使い方は推奨されません。`,
      required: false,
    }),
    noPassword: Flags.boolean({
      description:
        '指定するとパスワードを使用せず、秘密鍵を平文で保存します。テスト用途に限定し、取り扱いに注意してください。',
      default: false,
    }),
    ready: Flags.boolean({
      description:
        '--ready を指定すると、確認プロンプトを表示せずにアナウンスを実行します。「アナウンスしますか？」の確認を省略できます。',
      default: false,
    }),
    url: Flags.string({
      description: '接続先ネットワークの URL を指定します。',
      default: 'http://localhost:3000',
    }),
    maxFee: Flags.integer({
      description:
        'アナウンス時に使用する最大手数料（絶対値）を指定します。未指定時はノードの minFeeMultiplier を使用します。',
      required: false,
    }),
    customPreset: Flags.string({
      description: `このコマンドは暗号化された addresses.yaml から main の秘密鍵を解決します。
      main の秘密鍵が custom preset にのみ保存されている場合は、このパラメータで指定してください。未指定の場合は必要時に入力を求めることがあります。`,
      required: false,
    }),
    signerPublicKey: Flags.string({
      description: `署名アカウントの公開鍵を指定します。main アカウントがマルチシグの場合に使用します。`,
    }),
  };

  /**
   * トランザクションを作成してネットワークへアナウンスする。
   */
  public async announce(
    providedUrl: string,
    providedMaxFee: number | undefined,
    useKnownRestGateways: boolean,
    ready: boolean | undefined,
    target: string,
    presetData: ConfigPreset,
    addresses: Addresses,
    transactionFactory: TransactionFactory,
    tokenAmount = 'some',
    signerPublicKey?: string
  ): Promise<void> {
    AnnounceService.onProcessListener();

    const nodePreset = presetData.node;
    if (!nodePreset) {
      this.logger.info(`アナウンス対象のトランザクションはありません...`);
      return;
    }

    const nodeAccount = this.requireNodeAccount(addresses);
    const url = await TransactionUtils.getBestUrl(
      this.remoteNodeService,
      useKnownRestGateways ? undefined : providedUrl.replace(/\/$/, '')
    );
    const networkConfig = await this.transactionPort.getNetworkConfig(url);
    this.ensureNetworkGenerationHash(networkConfig, presetData);
    this.logFeeInfo(providedMaxFee, networkConfig);

    const prepared = await this.prepareExecutionContext({
      url,
      providedMaxFee,
      ready,
      target,
      tokenAmount,
      presetData,
      nodePreset,
      nodeAccount,
      networkConfig,
      transactionFactory,
      signerPublicKey,
    });
    if (!prepared) return;

    if (prepared.serviceProviderAccount) {
      await this.announceUsingServiceProvider(prepared);
      return;
    }

    await this.announceUsingMainAccount(prepared);
  }

  public setNetworkPort(networkPort: INetworkPort): void {
    this.networkPort = networkPort;
  }

  /**
   * 事前検証とトランザクション生成を行い、送信に必要な情報を束ねる。
   */
  private async prepareExecutionContext(
    context: Omit<
      AnnounceExecutionContext,
      'mainAccount' | 'serviceProviderAccount' | 'announcerAccount' | 'descriptors' | 'confirmFn'
    > & {
      transactionFactory: TransactionFactory;
      signerPublicKey?: string;
    }
  ): Promise<AnnounceExecutionContext | undefined> {
    const mainAccount = this.toPublicAccountInfo(
      context.nodeAccount.main.publicKey,
      context.presetData.networkType
    );
    const serviceProviderAccount = context.signerPublicKey
      ? this.toPublicAccountInfo(context.signerPublicKey, context.presetData.networkType)
      : undefined;

    if (serviceProviderAccount) {
      this.logger.info(
        `サービスプロバイダーアカウント ${CommandUtils.formatAccount(serviceProviderAccount)} が、ノードアカウント ${CommandUtils.formatAccount(mainAccount)} の代理でトランザクションを作成します。`
      );
    }

    const announcerAccount = serviceProviderAccount ?? mainAccount;
    const announcerAccountInfo = await this.transactionPort.getAccountInfo(
      context.url,
      announcerAccount.address
    );
    const noFundsMessage = `このトランザクションを完了するための XYM が不足しています。${announcerAccount.address} に ${context.tokenAmount} トークンを送金してください。`;

    if (!announcerAccountInfo) {
      this.logger.error(
        `ノード署名アカウント ${CommandUtils.formatAccount(announcerAccount)} は無効です。\n\n${noFundsMessage}`
      );
      return undefined;
    }

    if (this.isAccountEmpty(announcerAccountInfo, context.networkConfig.currencyMosaicId)) {
      this.logger.error(
        `ノード署名アカウント ${CommandUtils.formatAccount(announcerAccount)} の残高が不足しています。Mosaic ID: ${context.networkConfig.currencyMosaicId}. \n\n${noFundsMessage}`
      );
      return undefined;
    }

    const mainAccountInfo =
      mainAccount.address === announcerAccount.address
        ? announcerAccountInfo
        : await this.transactionPort.getAccountInfo(context.url, mainAccount.address);
    if (!mainAccountInfo) {
      this.logger.info(
        `メインアカウント ${CommandUtils.formatAccount(mainAccount)} は新規アカウントです。まだチェーン上に記録がありません。`
      );
    }

    const descriptors = await context.transactionFactory.createTransactions({
      presetData: context.presetData,
      nodePreset: context.nodePreset,
      nodeAccount: context.nodeAccount,
      mainAccountInfo: mainAccountInfo ?? undefined,
      networkConfig: context.networkConfig,
      target: context.target,
      mainAccount: announcerAccount,
    });
    if (!descriptors.length) {
      this.logger.info(
        `ノード ${context.nodeAccount.name} に対してアナウンスするトランザクションはありません。`
      );
      return undefined;
    }

    return {
      ...context,
      mainAccount,
      serviceProviderAccount,
      announcerAccount,
      descriptors,
      confirmFn: async (description: string) =>
        this.shouldAnnounce(description, context.ready, context.nodeAccount.name),
    };
  }

  /**
   * サービスプロバイダー経路でアナウンスを実行する。
   */
  private async announceUsingServiceProvider(context: AnnounceExecutionContext): Promise<void> {
    const serviceProviderAccount = context.serviceProviderAccount;
    if (!serviceProviderAccount) {
      return;
    }

    const multisigInfo = await this.tryGetMultisigInfo(
      context.url,
      context.announcerAccount.address
    );
    const cosigners: GeneratedAccount[] = [];

    let signerAccount: GeneratedAccount;
    let requiredCosignatures = 1;
    if (multisigInfo) {
      const bestCosigner = await this.getMultisigBestCosigner(
        multisigInfo.minApproval,
        [...multisigInfo.cosignatoryAddresses],
        cosigners,
        'サービスプロバイダーアカウント',
        context.presetData.networkType,
        context.networkConfig.currencyMosaicId,
        context.url
      );
      if (!bestCosigner) {
        this.logger.info(`アナウンスに十分な残高を持つコサイナーがいません。`);
        return;
      }
      this.logSelectedCosigner(bestCosigner);
      signerAccount = bestCosigner;
      requiredCosignatures = multisigInfo.minApproval;
    } else {
      signerAccount = await this.accountResolver.resolveAccount(
        context.presetData.networkType,
        { publicKey: serviceProviderAccount.publicKey } as any,
        KeyName.ServiceProvider,
        undefined,
        'トランザクション署名',
        'アカウントは生成できません。'
      );
    }

    const mainMultisigInfo = await this.tryGetMultisigInfo(
      context.url,
      context.mainAccount.address
    );
    requiredCosignatures += mainMultisigInfo?.minApproval ?? 0;

    const selfTransferDescriptor = this.transactionPort.createSelfTransferDescriptor(
      serviceProviderAccount.address,
      context.networkConfig.currencyMosaicId,
      serviceProviderAccount.publicKey
    );
    await this.transactionPort.announceAggregateBonded(
      [...context.descriptors, selfTransferDescriptor],
      context.mainAccount.publicKey,
      signerAccount.privateKey,
      cosigners.map((cosigner) => cosigner.privateKey),
      requiredCosignatures,
      context.networkConfig,
      context.url,
      context.providedMaxFee,
      context.confirmFn,
      this.logger
    );
  }

  /**
   * メインアカウント経路でアナウンスを実行する。
   */
  private async announceUsingMainAccount(context: AnnounceExecutionContext): Promise<void> {
    const multisigInfo = await this.tryGetMultisigInfo(context.url, context.mainAccount.address);
    if (multisigInfo) {
      await this.announceMainAccountAsMultisig(context, multisigInfo.minApproval, [
        ...multisigInfo.cosignatoryAddresses,
      ]);
      return;
    }

    const signerAccount = await this.resolveMainSignerAccount(context);
    if (context.descriptors.length === 1) {
      const descriptor = context.descriptors[0];
      if (this.transactionPort.isMultisigModification(descriptor)) {
        const additions = (descriptor.addressAdditions as string[]) ?? [];
        const requiredCosignatures =
          additions.length + ((descriptor.minApprovalDelta as number) ?? 0);
        await this.transactionPort.announceAggregateBonded(
          context.descriptors,
          context.mainAccount.publicKey,
          signerAccount.privateKey,
          [],
          requiredCosignatures,
          context.networkConfig,
          context.url,
          context.providedMaxFee,
          context.confirmFn,
          this.logger
        );
        return;
      }

      await this.transactionPort.announceSimple(
        descriptor,
        signerAccount.privateKey,
        context.networkConfig,
        context.url,
        context.providedMaxFee,
        context.confirmFn,
        this.logger
      );
      return;
    }

    await this.transactionPort.announceAggregateComplete(
      context.descriptors,
      context.mainAccount.publicKey,
      signerAccount.privateKey,
      [],
      context.networkConfig,
      context.url,
      0,
      context.providedMaxFee,
      context.confirmFn,
      this.logger
    );
  }

  /**
   * メインアカウントがマルチシグの場合の送信方式を選択する。
   */
  private async announceMainAccountAsMultisig(
    context: AnnounceExecutionContext,
    minApproval: number,
    cosignatoryAddresses: string[]
  ): Promise<void> {
    const cosigners: GeneratedAccount[] = [];
    const bestCosigner = await this.getMultisigBestCosigner(
      minApproval,
      cosignatoryAddresses,
      cosigners,
      'ノードのメインアカウント',
      context.presetData.networkType,
      context.networkConfig.currencyMosaicId,
      context.url
    );
    if (!bestCosigner) {
      this.logger.info(`アナウンスに十分な残高を持つコサイナーがいません。`);
      return;
    }

    this.logSelectedCosigner(bestCosigner);
    const cosignerKeys = cosigners
      .filter((account) => account.address !== bestCosigner.address)
      .map((account) => account.privateKey);

    if (cosigners.length >= minApproval) {
      await this.transactionPort.announceAggregateComplete(
        context.descriptors,
        context.mainAccount.publicKey,
        bestCosigner.privateKey,
        cosignerKeys,
        context.networkConfig,
        context.url,
        minApproval,
        context.providedMaxFee,
        context.confirmFn,
        this.logger
      );
      return;
    }

    await this.transactionPort.announceAggregateBonded(
      context.descriptors,
      context.mainAccount.publicKey,
      bestCosigner.privateKey,
      cosignerKeys,
      minApproval,
      context.networkConfig,
      context.url,
      context.providedMaxFee,
      context.confirmFn,
      this.logger
    );
  }

  /**
   * メインアカウントの署名者秘密鍵を解決する。
   */
  private async resolveMainSignerAccount(
    context: AnnounceExecutionContext
  ): Promise<GeneratedAccount> {
    const presetMainPrivateKey = context.nodePreset.mainPrivateKey;
    if (presetMainPrivateKey) {
      const resolved = this.cryptoPort.createAccountFromPrivateKey(
        presetMainPrivateKey,
        context.presetData.networkType
      );
      if (resolved.address === context.announcerAccount.address) {
        return resolved;
      }
    }

    return this.accountResolver.resolveAccount(
      context.presetData.networkType,
      context.nodeAccount.main,
      KeyName.Main,
      context.nodeAccount.name,
      'トランザクション署名',
      'アカウントは生成できません。'
    );
  }

  /**
   * マルチシグ情報の取得失敗を無視して undefined を返す。
   */
  private async tryGetMultisigInfo(url: string, address: string) {
    return this.networkPort?.getMultisigInfo(url, address).catch(() => undefined);
  }

  /**
   * 接続先ネットワークの generation hash が想定値と一致するか検証する。
   */
  private ensureNetworkGenerationHash(
    networkConfig: NetworkConfigDto,
    presetData: ConfigPreset
  ): void {
    if (
      networkConfig.generationHashSeed.toUpperCase() !==
      presetData.nemesisGenerationHashSeed?.toUpperCase()
    ) {
      throw new Error(
        `接続先ネットワークが誤っています。期待される generation hash は ${presetData.nemesisGenerationHashSeed} ですが、実際は ${networkConfig.generationHashSeed} です。`
      );
    }
  }

  /**
   * Fee に関する実行情報をログ出力する。
   */
  private logFeeInfo(providedMaxFee: number | undefined, networkConfig: NetworkConfigDto): void {
    if (providedMaxFee) {
      this.logger.info(
        `MaxFee は ${providedMaxFee / Math.pow(10, networkConfig.currencyDivisibility)} です`
      );
      return;
    }
    this.logger.info(`ノードの minFeeMultiplier は ${networkConfig.minFeeMultiplier} です`);
  }

  /**
   * 入力アドレス情報からノードアカウントを取得する。
   */
  private requireNodeAccount(addresses: Addresses): NodeAccount {
    if (!addresses.node || !addresses.node.main) {
      throw new Error('CA/Main アカウントが必要です。');
    }
    return addresses.node;
  }

  /**
   * 公開鍵から公開アカウント情報を構築する。
   */
  private toPublicAccountInfo(publicKey: string, networkType: NetworkType): PublicAccountInfo {
    return {
      publicKey,
      address: this.cryptoPort.getAddressFromPublicKey(publicKey, networkType),
    };
  }

  /**
   * ユーザー入力で受け取る validate 関数を clack 形式へ変換する。
   */
  private toPromptValidation(
    validator: (input: string | undefined) => boolean | string
  ): (input: string | undefined) => string | undefined {
    return (input: string | undefined) => {
      // Cancel シンボルの場合はバリデーション前に undefined を返す
      if (isCancel(input)) {
        return undefined;
      }
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
   * clack の password プロンプトから秘密鍵入力を取得する。
   */
  private async promptSecret(message: string): Promise<string | undefined> {
    const response = await password({
      message,
      mask: '*',
      validate: this.toPromptValidation((input) =>
        CommandUtils.isValidPrivateKey((input ?? '').toUpperCase())
      ),
    });
    return isCancel(response) ? undefined : response;
  }

  /**
   * clack の confirm プロンプトから真偽値を取得する。
   */
  private async promptConfirm(message: string, initialValue: boolean): Promise<boolean> {
    const response = await confirm({ message, initialValue });
    if (isCancel(response)) {
      return false;
    }
    return response;
  }

  /**
   * 選択されたコサイナーをログに出力する。
   */
  private logSelectedCosigner(cosigner: GeneratedAccount): void {
    this.logger.info(
      `コサイナー ${CommandUtils.formatAccount({ publicKey: cosigner.publicKey, address: cosigner.address })} がトランザクション初期化を実行します。`
    );
  }

  private async promptAccounts(
    networkType: NetworkType,
    expectedAddresses: string[],
    minApproval: number
  ): Promise<GeneratedAccount[]> {
    const providedAccounts: GeneratedAccount[] = [];
    const allowedAddresses = [...expectedAddresses];
    while (true) {
      this.logger.info('');
      const expectedDescription = allowedAddresses.join(', ');
      const privateKey = await this.promptSecret(
        `次のいずれかのアドレス ${expectedDescription} に対応する 64 桁 HEX 秘密鍵を入力してください。必要なコサイナー ${minApproval} 件のうち、現在 ${providedAccounts.length} 件入力済みです。`
      );
      if (privateKey === undefined) {
        this.logger.info('秘密鍵入力をキャンセルしました。');
        return providedAccounts;
      }
      if (!privateKey) {
        this.logger.info('秘密鍵を入力してください....');
      } else {
        const account = this.cryptoPort.createAccountFromPrivateKey(
          privateKey.toUpperCase(),
          networkType
        );
        const expectedAddress = allowedAddresses.find((a) => a === account.address);
        if (!expectedAddress) {
          this.logger.info('');
          this.logger.info(
            `秘密鍵が不正です。入力した秘密鍵のアドレスは ${account.address} で、候補 ${expectedDescription} に含まれていません。\n`
          );
          this.logger.info(`秘密鍵を再入力してください...`);
        } else {
          allowedAddresses.splice(allowedAddresses.indexOf(expectedAddress), 1);
          providedAccounts.push(account);
          if (!allowedAddresses.length) {
            this.logger.info('すべてのコサイナーを入力しました。');
            return providedAccounts;
          }
          if (providedAccounts.length === minApproval) {
            this.logger.info(
              `最小承認数 ${minApproval} に到達しました。アグリゲートコンプリートトランザクションを作成できます。`
            );
            return providedAccounts;
          }
          const shouldContinue = await this.promptConfirm(
            `コサイナーをさらに入力しますか？`,
            providedAccounts.length < minApproval
          );
          if (!shouldContinue) {
            return providedAccounts;
          } else {
            this.logger.info('追加の秘密鍵を入力してください....');
          }
        }
      }
    }
  }

  private isAccountEmpty(accountInfo: AccountInfoDto, currencyMosaicId: string): boolean {
    const mosaic = accountInfo.mosaics.find((m) => m.id === currencyMosaicId);
    return !mosaic || mosaic.amount <= 0n;
  }

  public async shouldAnnounce(
    description: string,
    ready: boolean | undefined,
    nodeName: string
  ): Promise<boolean> {
    const response: boolean =
      (ready as boolean) ||
      (await this.promptConfirm(`${description} をアナウンスしますか？`, true));
    if (!response) {
      this.logger.info(`ノード[${nodeName}] のトランザクションをスキップします`);
    }
    return response;
  }

  private async getBestCosigner(
    cosigners: GeneratedAccount[],
    url: string,
    currencyMosaicId: string
  ): Promise<GeneratedAccount | undefined> {
    for (const cosigner of cosigners) {
      try {
        const accountInfo = await this.transactionPort.getAccountInfo(url, cosigner.address);
        if (accountInfo && !this.isAccountEmpty(accountInfo, currencyMosaicId)) {
          return cosigner;
        }
      } catch {
        return undefined;
      }
    }
    return undefined;
  }

  private async getMultisigBestCosigner(
    minApproval: number,
    cosignatoryAddresses: string[],
    cosigners: GeneratedAccount[],
    accountName: string,
    networkType: NetworkType,
    currencyMosaicId: string,
    url: string
  ): Promise<GeneratedAccount | undefined> {
    this.logger.info(
      `${accountName} は最小承認数 ${minApproval} のマルチシグアカウントです。コサイナー: ${cosignatoryAddresses.join(', ')}。トランザクションをアナウンスするために、ツールがコサイナーの秘密鍵入力を求めます。これらの秘密鍵は保存されません。`
    );
    cosigners.push(...(await this.promptAccounts(networkType, cosignatoryAddresses, minApproval)));
    if (!cosigners.length) {
      return undefined;
    }
    return await this.getBestCosigner(cosigners, url, currencyMosaicId);
  }
}
