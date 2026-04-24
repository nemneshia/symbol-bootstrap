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

import { confirm } from '@inquirer/prompts';
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
import { AnnounceService, TransactionFactory, TransactionFactoryParams } from './AnnounceService.js';
import { BootstrapAccountResolver } from './BootstrapAccountResolver.js';
import { ConfigLoader } from './ConfigLoader.js';
import { RemoteNodeService } from './RemoteNodeService.js';

/**
 * params necessary to announce link transactions network.
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
  removeOldLinked?: boolean; //TEST ONLY!
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
    private readonly transactionPort: ITransactionPort = new SymbolTransactionAdapter(),
  ) {
    this.configLoader = new ConfigLoader(logger);
  }

  public async run(passedPresetData?: ConfigPreset | undefined, passedAddresses?: Addresses | undefined): Promise<void> {
    const presetData = passedPresetData ?? this.configLoader.loadExistingPresetData(this.params.target, this.params.password);
    const addresses = passedAddresses ?? this.configLoader.loadExistingAddresses(this.params.target, this.params.password);
    const customPreset = this.configLoader.loadCustomPreset(this.params.customPreset, this.params.password);
    this.logger.info(`${this.params.unlink ? 'Unlinking' : 'Linking'} nodes`);
    const accountResolver = this.params.accountResolver || new BootstrapAccountResolver(this.logger, this.cryptoPort);
    const remoteNodeService = new RemoteNodeService(
      this.logger,
      this.configLoader.mergePresets(presetData, customPreset),
      false,
      this.networkPort,
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
      this.params.serviceProviderPublicKey,
    );
  }
  public async createTransactions({
    presetData,
    nodeAccount,
    mainAccountInfo,
    networkConfig,
  }: TransactionFactoryParams): Promise<TransactionDescriptor[]> {
    const latestFinalizedBlockEpoch = networkConfig?.latestFinalizedBlockEpoch ?? presetData.lastKnownNetworkEpoch;
    const mainAccountAddress = nodeAccount.main.address;
    const nodeName = nodeAccount.name;
    const signerPublicKey = nodeAccount.main.publicKey;

    type LinkActionStr = 'link' | 'unlink';
    const remoteTransactionFactory = ({ publicKey }: KeyAccount, action: LinkActionStr): TransactionDescriptor =>
      this.transactionPort.createAccountKeyLinkDescriptor(publicKey, action, signerPublicKey);
    const vrfTransactionFactory = ({ publicKey }: KeyAccount, action: LinkActionStr): TransactionDescriptor =>
      this.transactionPort.createVrfKeyLinkDescriptor(publicKey, action, signerPublicKey);
    const votingKeyTransactionFactory = (account: VotingKeyAccount, action: LinkActionStr): TransactionDescriptor =>
      this.transactionPort.createVotingKeyLinkDescriptor(account, action, signerPublicKey);

    const spk = mainAccountInfo?.supplementalPublicKeys;

    this.logger.info(`Creating transactions for node: ${nodeName}, ca/main account: ${mainAccountAddress}`);
    const transactions = await new LinkTransactionGenericFactory(this.logger, this.params).createGenericTransactions(
      nodeName,
      {
        vrf: spk?.vrf ? { publicKey: spk.vrf } : undefined,
        remote: spk?.linked ? { publicKey: spk.linked } : undefined,
        voting: spk?.voting ? spk.voting.map((v) => ({ publicKey: v.publicKey, startEpoch: v.startEpoch, endEpoch: v.endEpoch })) : [],
      },
      nodeAccount,
      latestFinalizedBlockEpoch,
      remoteTransactionFactory,
      vrfTransactionFactory,
      votingKeyTransactionFactory,
    );
    // Unlink transactions go first
    return transactions.sort((t1, t2) => {
      const order = (d: TransactionDescriptor) => (d.linkAction === 'unlink' ? 0 : 1);
      return order(t1) - order(t2);
    });
  }
}

export class LinkTransactionGenericFactory {
  constructor(
    private readonly logger: Logger,
    private readonly params: { unlink: boolean; ready?: boolean; removeOldLinked?: boolean },
  ) {}

  public async createGenericTransactions<AccountKL, VRFKL, VotingKL>(
    nodeName: string,
    currentMainAccountKeys: GenericNodeAccount,
    nodeAccount: GenericNodeAccount,
    latestFinalizedBlockEpoch: number,
    remoteTransactionFactory: (keyAccount: KeyAccount, action: 'link' | 'unlink') => AccountKL,
    vrfTransactionFactory: (keyAccount: KeyAccount, action: 'link' | 'unlink') => VRFKL,
    votingKeyTransactionFactory: (account: VotingKeyAccount, action: 'link' | 'unlink') => VotingKL,
  ): Promise<(AccountKL | VRFKL | VotingKL)[]> {
    const transactions: (AccountKL | VRFKL | VotingKL)[] = [];
    const print = (account: { publicKey: string }) => `public key ${account.publicKey}`;
    if (nodeAccount.remote) {
      transactions.push(
        ...(await this.addTransaction(
          currentMainAccountKeys.remote,
          remoteTransactionFactory,
          nodeName,
          'Remote',
          nodeAccount.remote,
          print,
        )),
      );
    }

    if (nodeAccount.vrf) {
      transactions.push(
        ...(await this.addTransaction(currentMainAccountKeys.vrf, vrfTransactionFactory, nodeName, 'VRF', nodeAccount.vrf, print)),
      );
    }
    const votingPrint = (account: VotingKeyAccount) =>
      `public key ${account.publicKey}, start epoch ${account.startEpoch}, end epoch ${account.endEpoch}`;
    if (this.params.unlink) {
      transactions.push(
        ...(await this.addVotingKeyUnlinkTransactions(
          currentMainAccountKeys?.voting || [],
          nodeAccount.voting || [],
          nodeName,
          votingKeyTransactionFactory,
          votingPrint,
        )),
      );
    } else {
      transactions.push(
        ...(await this.addVotingKeyLinkTransactions(
          currentMainAccountKeys?.voting || [],
          nodeAccount.voting || [],
          nodeName,
          latestFinalizedBlockEpoch,
          votingKeyTransactionFactory,
          votingPrint,
        )),
      );
    }
    return transactions;
  }

  public async addVotingKeyLinkTransactions<T>(
    linkedVotingKeyAccounts: VotingKeyAccount[],
    votingKeyFiles: VotingKeyAccount[],
    nodeName: string,
    lastKnownNetworkEpoch: number,
    transactionFactory: (transaction: VotingKeyAccount, action: 'link' | 'unlink') => T,
    print: (account: VotingKeyAccount) => string,
  ): Promise<T[]> {
    const transactions: T[] = [];
    const accountName = 'Voting';
    let remainingVotingKeys: VotingKeyAccount[] = linkedVotingKeyAccounts;
    for (const alreadyLinkedAccount of linkedVotingKeyAccounts) {
      if (alreadyLinkedAccount.endEpoch < lastKnownNetworkEpoch && (await this.confirmUnlink(accountName, alreadyLinkedAccount, print))) {
        const unlinkTransaction = transactionFactory(alreadyLinkedAccount, 'unlink');
        this.logger.info(
          `Creating Unlink ${accountName} Transaction from Node ${nodeName} to ${accountName} ${print(alreadyLinkedAccount)}.`,
        );
        remainingVotingKeys = remainingVotingKeys.filter((a) => a != alreadyLinkedAccount);
        transactions.push(unlinkTransaction);
      }
    }
    const activeVotingKeyFiles = votingKeyFiles.filter((a) => a.endEpoch >= lastKnownNetworkEpoch);
    for (const accountTobeLinked of activeVotingKeyFiles) {
      const alreadyLinkedAccount = remainingVotingKeys.find((a) =>
        LinkTransactionGenericFactory.overlapsVotingAccounts(accountTobeLinked, a),
      );
      const isAlreadyLinkedSameAccount =
        alreadyLinkedAccount?.publicKey.toUpperCase() === accountTobeLinked.publicKey.toUpperCase() &&
        alreadyLinkedAccount?.startEpoch === accountTobeLinked.startEpoch &&
        alreadyLinkedAccount?.endEpoch === accountTobeLinked.endEpoch;

      let addTransaction = !isAlreadyLinkedSameAccount;
      if (alreadyLinkedAccount && !isAlreadyLinkedSameAccount) {
        this.logger.warn(
          `Node ${nodeName} is already linked to ${accountName} ${print(
            alreadyLinkedAccount,
          )} which is different from the configured ${print(accountTobeLinked)}.`,
        );
        if (await this.confirmUnlink(accountName, alreadyLinkedAccount, print)) {
          const unlinkTransaction = transactionFactory(alreadyLinkedAccount, 'unlink');
          this.logger.info(
            `Creating Unlink ${accountName} Transaction from Node ${nodeName} to ${accountName} ${print(alreadyLinkedAccount)}.`,
          );
          remainingVotingKeys = remainingVotingKeys.filter((a) => a != alreadyLinkedAccount);
          transactions.push(unlinkTransaction);
        } else {
          addTransaction = false;
        }
      }

      if (remainingVotingKeys.length < 3 && addTransaction) {
        const transaction = transactionFactory(accountTobeLinked, 'link');
        this.logger.info(`Creating Link ${accountName} Transaction from Node ${nodeName} to ${accountName} ${print(accountTobeLinked)}.`);
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
    print: (account: VotingKeyAccount) => string,
  ): Promise<T[]> {
    const transactions: T[] = [];
    const accountName = 'Voting';
    let remainingVotingKeys: VotingKeyAccount[] = linkedVotingKeyAccounts;
    for (const accountTobeLinked of votingKeyFiles) {
      const alreadyLinkedAccount = remainingVotingKeys.find((a) =>
        LinkTransactionGenericFactory.overlapsVotingAccounts(accountTobeLinked, a),
      );
      const isAlreadyLinkedSameAccount =
        alreadyLinkedAccount?.publicKey.toUpperCase() === accountTobeLinked.publicKey.toUpperCase() &&
        alreadyLinkedAccount?.startEpoch === accountTobeLinked.startEpoch &&
        alreadyLinkedAccount?.endEpoch === accountTobeLinked.endEpoch;

      if (alreadyLinkedAccount && isAlreadyLinkedSameAccount) {
        if (await this.confirmUnlink(accountName, alreadyLinkedAccount, print)) {
          const unlinkTransaction = transactionFactory(alreadyLinkedAccount, 'unlink');
          this.logger.info(
            `Creating Unlink ${accountName} Transaction from Node ${nodeName} to ${accountName} ${print(alreadyLinkedAccount)}.`,
          );
          remainingVotingKeys = remainingVotingKeys.filter((a) => a != alreadyLinkedAccount);
          transactions.push(unlinkTransaction);
        }
      }
    }
    return transactions;
  }

  public static overlapsVotingAccounts(x: VotingKeyAccount, y: VotingKeyAccount): boolean {
    return x.endEpoch >= y.startEpoch && x.startEpoch <= y.endEpoch;
  }

  private async addTransaction<A extends KeyAccount, T>(
    alreadyLinkedAccount: A | undefined,
    transactionFactory: (transaction: A, action: 'link' | 'unlink') => T,
    nodeName: string,
    accountName: string,
    accountTobeLinked: A,
    print: (account: A) => string,
  ): Promise<T[]> {
    const transactions: T[] = [];
    const isAlreadyLinkedSameAccount = accountTobeLinked.publicKey.toUpperCase() === alreadyLinkedAccount?.publicKey.toUpperCase();
    if (this.params.unlink) {
      if (alreadyLinkedAccount) {
        if (isAlreadyLinkedSameAccount) {
          const transaction = transactionFactory(accountTobeLinked, 'unlink');
          this.logger.info(
            `Creating Unlink ${accountName} Transaction for node ${nodeName} to ${accountName} ${print(accountTobeLinked)}.`,
          );
          transactions.push(transaction);
        } else {
          this.logger.warn(
            `Node ${nodeName} is linked to a different ${accountName} ${print(alreadyLinkedAccount)} and not the configured ${print(
              accountTobeLinked,
            )}.`,
          );

          if (await this.confirmUnlink(accountName, alreadyLinkedAccount, print)) {
            const transaction = transactionFactory(alreadyLinkedAccount, 'unlink');
            this.logger.info(
              `Creating Unlink ${accountName} Transaction  for node ${nodeName} to ${accountName} ${print(alreadyLinkedAccount)}.`,
            );
            transactions.push(transaction);
          }
        }
      } else {
        this.logger.info(`Node ${nodeName} is not linked to ${accountName} ${print(accountTobeLinked)}.`);
      }
    } else {
      if (alreadyLinkedAccount) {
        if (isAlreadyLinkedSameAccount) {
          this.logger.info(`Node ${nodeName} is already linked to ${accountName} ${print(alreadyLinkedAccount)}.`);
        } else {
          this.logger.warn(
            `Node ${nodeName} is already linked to ${accountName} ${print(
              alreadyLinkedAccount,
            )} which is different from the configured ${print(accountTobeLinked)}.`,
          );

          if (await this.confirmUnlink(accountName, alreadyLinkedAccount, print)) {
            const unlinkTransaction = transactionFactory(alreadyLinkedAccount, 'unlink');
            this.logger.info(
              `Creating Unlink ${accountName} Transaction from Node ${nodeName} to ${accountName} ${print(alreadyLinkedAccount)}.`,
            );
            transactions.push(unlinkTransaction);

            const linkTransaction = transactionFactory(accountTobeLinked, 'link');
            this.logger.info(
              `Creating Link ${accountName} Transaction from Node ${nodeName} to ${accountName} ${print(accountTobeLinked)}.`,
            );
            transactions.push(linkTransaction);
          }
        }
      } else {
        const transaction = transactionFactory(accountTobeLinked, 'link');
        this.logger.info(`Creating Link ${accountName} Transaction from Node ${nodeName} to ${accountName} ${print(accountTobeLinked)}.`);
        transactions.push(transaction);
      }
    }
    return transactions;
  }

  private async confirmUnlink<T>(accountName: string, alreadyLinkedAccount: T, print: (account: T) => string): Promise<boolean> {
    if (this.params.removeOldLinked === undefined) {
      return (
        this.params.ready ||
        (await confirm({
          message: `Do you want to unlink the old ${accountName} ${print(alreadyLinkedAccount)}?`,
          default: false,
        }))
      );
    }
    return this.params.removeOldLinked;
  }
}
