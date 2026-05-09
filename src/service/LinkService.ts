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
import { confirm, isCancel } from '@clack/prompts';

import { Logger } from '../logger/index.js';
import { Addresses, ConfigPreset, NodeAccount } from '../model/index.js';
import {
  AccountInfoDto,
  ICryptoPort,
  INetworkPort,
  ITransactionPort,
  SymbolTransactionAdapter,
  TransactionDescriptor,
} from '../sdk/index.js';
import { Constants } from '../utils/Constants.js';
import { VotingKeyAccount } from '../utils/VotingUtils.js';
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
 * ネットワークへリンク系トランザクションをアナウンスするためのパラメータ。
 */
export type LinkParams = {
  target: string;
  password?: Password;
  url: string;
  maxFee?: number | undefined;
  unlink: boolean;
  useKnownRestGateways?: boolean;
  ready?: boolean;
  customPreset?: string;
  serviceProviderPublicKey?: string;
  removeOldLinked?: boolean; // テスト専用
  accountResolver?: AccountResolver;
};

export type KeyAccount = { publicKey: string };

export interface LinkServiceTransactionFactoryParams {
  presetData: ConfigPreset;
  nodeAccount: NodeAccount;
  mainAccountInfo?: AccountInfoDto;
  networkConfig?: { latestFinalizedBlockEpoch?: number };
}

export interface GenericNodeAccount {
  remote?: KeyAccount;
  vrf?: KeyAccount;
  voting?: VotingKeyAccount[];
}

type LinkActionStr = 'link' | 'unlink';

type DescriptorFactories = {
  remoteTransactionFactory: (
    keyAccount: KeyAccount,
    action: LinkActionStr
  ) => TransactionDescriptor;
  vrfTransactionFactory: (keyAccount: KeyAccount, action: LinkActionStr) => TransactionDescriptor;
  votingKeyTransactionFactory: (
    account: VotingKeyAccount,
    action: LinkActionStr
  ) => TransactionDescriptor;
};

const MAX_LINKED_VOTING_KEYS = 3;

export class LinkService implements TransactionFactory {
  public static readonly defaultParams: LinkParams = {
    target: Constants.defaultTargetFolder,
    useKnownRestGateways: false,
    ready: false,
    url: 'http://localhost:3000',
    maxFee: 100000,
    unlink: false,
  };

  private readonly configLoader: ConfigLoader;

  constructor(
    private readonly logger: Logger,
    protected readonly params: LinkParams,
    private readonly cryptoPort: ICryptoPort,
    private readonly networkPort: INetworkPort,
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
    this.logger.info(`${this.params.unlink ? 'ノードのリンク解除' : 'ノードのリンク'}を実行します`);
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

  /**
   * ノード設定と現在のオンチェーン状態を比較し、リンク系トランザクションを生成する。
   */
  public async createTransactions({
    presetData,
    nodeAccount,
    mainAccountInfo,
    networkConfig,
  }: TransactionFactoryParams): Promise<TransactionDescriptor[]> {
    const latestFinalizedBlockEpoch =
      networkConfig?.latestFinalizedBlockEpoch ?? presetData.lastKnownNetworkEpoch;
    const mainAccountAddress = nodeAccount.main.address;
    const nodeName = nodeAccount.name;
    const factories = this.createDescriptorFactories(nodeAccount.main.publicKey);
    const currentMainAccountKeys = this.toCurrentMainAccountKeys(mainAccountInfo);

    this.logger.info(
      `ノード ${nodeName}（CA/Main アカウント: ${mainAccountAddress}）のトランザクションを作成します`
    );
    const transactions = await new LinkTransactionGenericFactory(
      this.logger,
      this.params
    ).createGenericTransactions(
      nodeName,
      currentMainAccountKeys,
      nodeAccount,
      latestFinalizedBlockEpoch,
      factories.remoteTransactionFactory,
      factories.vrfTransactionFactory,
      factories.votingKeyTransactionFactory
    );
    // Unlink を先に実行するため先頭に並べる。
    return transactions.sort(
      (firstTransaction, secondTransaction) =>
        this.getActionOrder(firstTransaction) - this.getActionOrder(secondTransaction)
    );
  }

  private createDescriptorFactories(signerPublicKey: string): DescriptorFactories {
    return {
      remoteTransactionFactory: ({ publicKey }: KeyAccount, action: LinkActionStr) =>
        this.transactionPort.createAccountKeyLinkDescriptor(publicKey, action, signerPublicKey),
      vrfTransactionFactory: ({ publicKey }: KeyAccount, action: LinkActionStr) =>
        this.transactionPort.createVrfKeyLinkDescriptor(publicKey, action, signerPublicKey),
      votingKeyTransactionFactory: (account: VotingKeyAccount, action: LinkActionStr) =>
        this.transactionPort.createVotingKeyLinkDescriptor(account, action, signerPublicKey),
    };
  }

  private toCurrentMainAccountKeys(mainAccountInfo?: AccountInfoDto): GenericNodeAccount {
    const supplementalPublicKeys = mainAccountInfo?.supplementalPublicKeys;
    return {
      vrf: supplementalPublicKeys?.vrf ? { publicKey: supplementalPublicKeys.vrf } : undefined,
      remote: supplementalPublicKeys?.linked
        ? { publicKey: supplementalPublicKeys.linked }
        : undefined,
      voting: supplementalPublicKeys?.voting
        ? supplementalPublicKeys.voting.map((votingKey) => ({
            publicKey: votingKey.publicKey,
            startEpoch: votingKey.startEpoch,
            endEpoch: votingKey.endEpoch,
          }))
        : [],
    };
  }

  private getActionOrder(descriptor: TransactionDescriptor): number {
    return descriptor.linkAction === 'unlink' ? 0 : 1;
  }
}

export class LinkTransactionGenericFactory {
  constructor(
    private readonly logger: Logger,
    private readonly params: { unlink: boolean; ready?: boolean; removeOldLinked?: boolean }
  ) {}

  public async createGenericTransactions<AccountKL, VRFKL, VotingKL>(
    nodeName: string,
    currentMainAccountKeys: GenericNodeAccount,
    nodeAccount: GenericNodeAccount,
    latestFinalizedBlockEpoch: number,
    remoteTransactionFactory: (keyAccount: KeyAccount, action: 'link' | 'unlink') => AccountKL,
    vrfTransactionFactory: (keyAccount: KeyAccount, action: 'link' | 'unlink') => VRFKL,
    votingKeyTransactionFactory: (account: VotingKeyAccount, action: 'link' | 'unlink') => VotingKL
  ): Promise<(AccountKL | VRFKL | VotingKL)[]> {
    const transactions: (AccountKL | VRFKL | VotingKL)[] = [];
    const print = (account: { publicKey: string }) => `public key ${account.publicKey}`;
    transactions.push(
      ...(await this.createKeyLinkTransactions(
        nodeName,
        currentMainAccountKeys,
        nodeAccount,
        remoteTransactionFactory,
        vrfTransactionFactory,
        print
      ))
    );

    const votingPrint = (account: VotingKeyAccount) =>
      `public key ${account.publicKey}, start epoch ${account.startEpoch}, end epoch ${account.endEpoch}`;
    transactions.push(
      ...(await this.createVotingTransactions(
        nodeName,
        currentMainAccountKeys.voting || [],
        nodeAccount.voting || [],
        latestFinalizedBlockEpoch,
        votingKeyTransactionFactory,
        votingPrint
      ))
    );

    return transactions;
  }

  private async createKeyLinkTransactions<AccountKL, VRFKL>(
    nodeName: string,
    currentMainAccountKeys: GenericNodeAccount,
    nodeAccount: GenericNodeAccount,
    remoteTransactionFactory: (keyAccount: KeyAccount, action: 'link' | 'unlink') => AccountKL,
    vrfTransactionFactory: (keyAccount: KeyAccount, action: 'link' | 'unlink') => VRFKL,
    print: (account: { publicKey: string }) => string
  ): Promise<(AccountKL | VRFKL)[]> {
    const transactions: (AccountKL | VRFKL)[] = [];

    if (nodeAccount.remote) {
      transactions.push(
        ...(await this.addTransaction(
          currentMainAccountKeys.remote,
          remoteTransactionFactory,
          nodeName,
          'Remote',
          nodeAccount.remote,
          print
        ))
      );
    }

    if (nodeAccount.vrf) {
      transactions.push(
        ...(await this.addTransaction(
          currentMainAccountKeys.vrf,
          vrfTransactionFactory,
          nodeName,
          'VRF',
          nodeAccount.vrf,
          print
        ))
      );
    }

    return transactions;
  }

  private async createVotingTransactions<T>(
    nodeName: string,
    linkedVotingKeyAccounts: VotingKeyAccount[],
    votingKeyFiles: VotingKeyAccount[],
    latestFinalizedBlockEpoch: number,
    votingKeyTransactionFactory: (account: VotingKeyAccount, action: 'link' | 'unlink') => T,
    print: (account: VotingKeyAccount) => string
  ): Promise<T[]> {
    if (this.params.unlink) {
      return this.addVotingKeyUnlinkTransactions(
        linkedVotingKeyAccounts,
        votingKeyFiles,
        nodeName,
        votingKeyTransactionFactory,
        print
      );
    }
    return this.addVotingKeyLinkTransactions(
      linkedVotingKeyAccounts,
      votingKeyFiles,
      nodeName,
      latestFinalizedBlockEpoch,
      votingKeyTransactionFactory,
      print
    );
  }

  public async addVotingKeyLinkTransactions<T>(
    linkedVotingKeyAccounts: VotingKeyAccount[],
    votingKeyFiles: VotingKeyAccount[],
    nodeName: string,
    lastKnownNetworkEpoch: number,
    transactionFactory: (transaction: VotingKeyAccount, action: 'link' | 'unlink') => T,
    print: (account: VotingKeyAccount) => string
  ): Promise<T[]> {
    const transactions: T[] = [];
    const accountName = 'Voting';
    let remainingVotingKeys: VotingKeyAccount[] = linkedVotingKeyAccounts;

    for (const alreadyLinkedAccount of linkedVotingKeyAccounts) {
      if (
        alreadyLinkedAccount.endEpoch < lastKnownNetworkEpoch &&
        (await this.confirmUnlink(accountName, alreadyLinkedAccount, print))
      ) {
        const unlinkTransaction = transactionFactory(alreadyLinkedAccount, 'unlink');
        this.logUnlinkTransaction(nodeName, accountName, print(alreadyLinkedAccount));
        remainingVotingKeys = this.removeVotingKey(remainingVotingKeys, alreadyLinkedAccount);
        transactions.push(unlinkTransaction);
      }
    }

    const activeVotingKeyFiles = votingKeyFiles.filter((a) => a.endEpoch >= lastKnownNetworkEpoch);
    for (const accountTobeLinked of activeVotingKeyFiles) {
      const alreadyLinkedAccount = remainingVotingKeys.find((a) =>
        LinkTransactionGenericFactory.overlapsVotingAccounts(accountTobeLinked, a)
      );
      const isAlreadyLinkedSameAccount = this.isSameVotingAccount(
        alreadyLinkedAccount,
        accountTobeLinked
      );

      let addTransaction = !isAlreadyLinkedSameAccount;
      if (alreadyLinkedAccount && !isAlreadyLinkedSameAccount) {
        this.logger.warn(
          `ノード ${nodeName} は既に ${accountName} ${print(
            alreadyLinkedAccount
          )} にリンクされていますが、設定値 ${print(accountTobeLinked)} と一致しません。`
        );
        if (await this.confirmUnlink(accountName, alreadyLinkedAccount, print)) {
          const unlinkTransaction = transactionFactory(alreadyLinkedAccount, 'unlink');
          this.logUnlinkTransaction(nodeName, accountName, print(alreadyLinkedAccount));
          remainingVotingKeys = this.removeVotingKey(remainingVotingKeys, alreadyLinkedAccount);
          transactions.push(unlinkTransaction);
        } else {
          addTransaction = false;
        }
      }

      if (remainingVotingKeys.length < MAX_LINKED_VOTING_KEYS && addTransaction) {
        const transaction = transactionFactory(accountTobeLinked, 'link');
        this.logLinkTransaction(nodeName, accountName, print(accountTobeLinked));
        transactions.push(transaction);
        remainingVotingKeys.push(accountTobeLinked);
      }
    }

    return transactions;
  }

  public async addVotingKeyUnlinkTransactions<T>(
    linkedVotingKeyAccounts: VotingKeyAccount[],
    votingKeyFiles: VotingKeyAccount[],
    nodeName: string,
    transactionFactory: (transaction: VotingKeyAccount, action: 'link' | 'unlink') => T,
    print: (account: VotingKeyAccount) => string
  ): Promise<T[]> {
    const transactions: T[] = [];
    const accountName = 'Voting';
    let remainingVotingKeys: VotingKeyAccount[] = linkedVotingKeyAccounts;

    for (const accountTobeLinked of votingKeyFiles) {
      const alreadyLinkedAccount = remainingVotingKeys.find((a) =>
        LinkTransactionGenericFactory.overlapsVotingAccounts(accountTobeLinked, a)
      );
      const isAlreadyLinkedSameAccount = this.isSameVotingAccount(
        alreadyLinkedAccount,
        accountTobeLinked
      );

      if (alreadyLinkedAccount && isAlreadyLinkedSameAccount) {
        if (await this.confirmUnlink(accountName, alreadyLinkedAccount, print)) {
          const unlinkTransaction = transactionFactory(alreadyLinkedAccount, 'unlink');
          this.logUnlinkTransaction(nodeName, accountName, print(alreadyLinkedAccount));
          remainingVotingKeys = this.removeVotingKey(remainingVotingKeys, alreadyLinkedAccount);
          transactions.push(unlinkTransaction);
        }
      }
    }
    return transactions;
  }

  public static overlapsVotingAccounts(x: VotingKeyAccount, y: VotingKeyAccount): boolean {
    return x.endEpoch >= y.startEpoch && x.startEpoch <= y.endEpoch;
  }

  private isSameVotingAccount(
    firstAccount: VotingKeyAccount | undefined,
    secondAccount: VotingKeyAccount
  ): boolean {
    return (
      firstAccount?.publicKey.toUpperCase() === secondAccount.publicKey.toUpperCase() &&
      firstAccount?.startEpoch === secondAccount.startEpoch &&
      firstAccount?.endEpoch === secondAccount.endEpoch
    );
  }

  private isSameKeyAccount<A extends KeyAccount>(
    firstAccount: A | undefined,
    secondAccount: A
  ): boolean {
    return secondAccount.publicKey.toUpperCase() === firstAccount?.publicKey.toUpperCase();
  }

  private async addTransaction<A extends KeyAccount, T>(
    alreadyLinkedAccount: A | undefined,
    transactionFactory: (transaction: A, action: 'link' | 'unlink') => T,
    nodeName: string,
    accountName: string,
    accountTobeLinked: A,
    print: (account: A) => string
  ): Promise<T[]> {
    return this.params.unlink
      ? this.createUnlinkTransactions(
          alreadyLinkedAccount,
          transactionFactory,
          nodeName,
          accountName,
          accountTobeLinked,
          print
        )
      : this.createLinkTransactions(
          alreadyLinkedAccount,
          transactionFactory,
          nodeName,
          accountName,
          accountTobeLinked,
          print
        );
  }

  private async createUnlinkTransactions<A extends KeyAccount, T>(
    alreadyLinkedAccount: A | undefined,
    transactionFactory: (transaction: A, action: 'link' | 'unlink') => T,
    nodeName: string,
    accountName: string,
    accountTobeLinked: A,
    print: (account: A) => string
  ): Promise<T[]> {
    const transactions: T[] = [];
    if (!alreadyLinkedAccount) {
      this.logger.info(
        `ノード ${nodeName} は ${accountName} ${print(accountTobeLinked)} にリンクされていません。`
      );
      return transactions;
    }

    if (this.isSameKeyAccount(alreadyLinkedAccount, accountTobeLinked)) {
      const transaction = transactionFactory(accountTobeLinked, 'unlink');
      this.logger.info(
        `ノード ${nodeName} の ${accountName} ${print(accountTobeLinked)} に対する Unlink トランザクションを作成します。`
      );
      transactions.push(transaction);
      return transactions;
    }

    this.logger.warn(
      `ノード ${nodeName} は ${accountName} ${print(alreadyLinkedAccount)} にリンクされていますが、設定値 ${print(
        accountTobeLinked
      )} とは異なります。`
    );
    if (await this.confirmUnlink(accountName, alreadyLinkedAccount, print)) {
      const transaction = transactionFactory(alreadyLinkedAccount, 'unlink');
      this.logger.info(
        `ノード ${nodeName} の ${accountName} ${print(alreadyLinkedAccount)} に対する Unlink トランザクションを作成します。`
      );
      transactions.push(transaction);
    }
    return transactions;
  }

  private async createLinkTransactions<A extends KeyAccount, T>(
    alreadyLinkedAccount: A | undefined,
    transactionFactory: (transaction: A, action: 'link' | 'unlink') => T,
    nodeName: string,
    accountName: string,
    accountTobeLinked: A,
    print: (account: A) => string
  ): Promise<T[]> {
    const transactions: T[] = [];
    if (!alreadyLinkedAccount) {
      const transaction = transactionFactory(accountTobeLinked, 'link');
      this.logLinkTransaction(nodeName, accountName, print(accountTobeLinked));
      transactions.push(transaction);
      return transactions;
    }

    if (this.isSameKeyAccount(alreadyLinkedAccount, accountTobeLinked)) {
      this.logger.info(
        `ノード ${nodeName} は既に ${accountName} ${print(alreadyLinkedAccount)} にリンク済みです。`
      );
      return transactions;
    }

    this.logger.warn(
      `ノード ${nodeName} は既に ${accountName} ${print(
        alreadyLinkedAccount
      )} にリンクされていますが、設定値 ${print(accountTobeLinked)} と一致しません。`
    );
    if (await this.confirmUnlink(accountName, alreadyLinkedAccount, print)) {
      const unlinkTransaction = transactionFactory(alreadyLinkedAccount, 'unlink');
      this.logUnlinkTransaction(nodeName, accountName, print(alreadyLinkedAccount));
      transactions.push(unlinkTransaction);

      const linkTransaction = transactionFactory(accountTobeLinked, 'link');
      this.logLinkTransaction(nodeName, accountName, print(accountTobeLinked));
      transactions.push(linkTransaction);
    }
    return transactions;
  }

  private removeVotingKey(
    source: VotingKeyAccount[],
    votingKey: VotingKeyAccount
  ): VotingKeyAccount[] {
    return source.filter((account) => account !== votingKey);
  }

  private logLinkTransaction(nodeName: string, accountName: string, detail: string): void {
    this.logger.info(
      `ノード ${nodeName} から ${accountName} ${detail} への Link トランザクションを作成します。`
    );
  }

  private logUnlinkTransaction(nodeName: string, accountName: string, detail: string): void {
    this.logger.info(
      `ノード ${nodeName} から ${accountName} ${detail} への Unlink トランザクションを作成します。`
    );
  }

  private async confirmUnlink<T>(
    accountName: string,
    alreadyLinkedAccount: T,
    print: (account: T) => string
  ): Promise<boolean> {
    if (this.params.removeOldLinked === undefined) {
      if (this.params.ready) {
        return true;
      }
      const response = await confirm({
        message: `既存の ${accountName} ${print(alreadyLinkedAccount)} を unlink しますか？`,
        initialValue: false,
      });
      return isCancel(response) ? false : response;
    }
    return this.params.removeOldLinked;
  }
}
