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
import { confirm, password } from '@inquirer/prompts';
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
import { AccountResolver } from './AccountResolver.js';
import { KeyName } from './ConfigService.js';
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

export class AnnounceService {
  constructor(
    private readonly logger: Logger,
    private readonly accountResolver: AccountResolver,
    private readonly remoteNodeService: RemoteNodeService,
    private readonly cryptoPort: ICryptoPort = new SymbolCryptoAdapter(),
    private readonly transactionPort: ITransactionPort = new SymbolTransactionAdapter(),
  ) {}

  private static onProcessListener = () => {
    process.on('SIGINT', () => {
      process.exit(400);
    });
  };

  public static flags = {
    password: Flags.string({
      description: `Prevents the prompting of the password by providing the password. Note that it's not recommended to use this feature.`,
      required: false,
    }),
    noPassword: Flags.boolean({
      description:
        'When provided, bootstrap will not use a password, so private keys will be stored in plain text. Use with caution, only for testing.',
      default: false,
    }),
    ready: Flags.boolean({
      description:
        'If --ready is provided, announcements won\'t be prompted for confirmation, just executed. This flag resolves "Do you want to announce? (y/N)" prompts.',
      default: false,
    }),
    url: Flags.string({
      description: 'the network url',
      default: 'http://localhost:3000',
    }),
    maxFee: Flags.integer({
      description: 'the max fee used to announce (absolute). The node min multiplier will be used if it is not provided.',
      required: false,
    }),
    customPreset: Flags.string({
      description: `This command uses the encrypted addresses.yml to resolve the main private key. If the main private is only stored in the custom preset, you can provide it using this param. Otherwise, the command may ask for it when required.`,
      required: false,
    }),
    serviceProviderPublicKey: Flags.string({
      description:
        'Public key of the service provider account, used when the transaction announcer(service provider account) is different than the main account private key holder',
    }),
  };

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
    serviceProviderPublicKey?: string,
  ): Promise<void> {
    AnnounceService.onProcessListener();
    if (!presetData.nodes || !presetData.nodes?.length) {
      this.logger.info(`There are no transactions to announce...`);
      return;
    }
    const url = await TransactionUtils.getBestUrl(
      this.remoteNodeService,
      useKnownRestGateways ? undefined : providedUrl.replace(/\/$/, ''),
    );
    const networkConfig = await this.transactionPort.getNetworkConfig(url);

    if (networkConfig.generationHashSeed.toUpperCase() !== presetData.nemesisGenerationHashSeed?.toUpperCase()) {
      throw new Error(
        `You are connecting to the wrong network. Expected generation hash is ${presetData.nemesisGenerationHashSeed} but got ${networkConfig.generationHashSeed}`,
      );
    }

    if (providedMaxFee) {
      this.logger.info(`MaxFee is ${providedMaxFee / Math.pow(10, networkConfig.currencyDivisibility)}`);
    } else {
      this.logger.info(`Node's minFeeMultiplier is ${networkConfig.minFeeMultiplier}`);
    }

    for (const [index, nodeAccount] of (addresses.nodes || []).entries()) {
      if (!nodeAccount || !nodeAccount.main) {
        throw new Error('CA/Main account is required!');
      }
      const nodePreset = (presetData.nodes || [])[index];
      const mainAccount: PublicAccountInfo = {
        publicKey: nodeAccount.main.publicKey,
        address: this.cryptoPort.getAddressFromPublicKey(nodeAccount.main.publicKey, presetData.networkType),
      };
      const serviceProviderAccount: PublicAccountInfo | undefined = serviceProviderPublicKey
        ? {
            publicKey: serviceProviderPublicKey,
            address: this.cryptoPort.getAddressFromPublicKey(serviceProviderPublicKey, presetData.networkType),
          }
        : undefined;

      if (serviceProviderAccount) {
        this.logger.info(
          `The Service Provider Account ${CommandUtils.formatAccount(serviceProviderAccount)} is creating transactions on behalf of your node account ${CommandUtils.formatAccount(mainAccount)}.`,
        );
      }

      const announcerAccount = serviceProviderAccount ?? mainAccount;
      const noFundsMessage = `Your account does not have enough XYM to complete this transaction. Send ${tokenAmount} tokens to ${announcerAccount.address} .`;
      const announcerAccountInfo = await this.transactionPort.getAccountInfo(url, announcerAccount.address);

      if (!announcerAccountInfo) {
        this.logger.error(`Node signing account ${CommandUtils.formatAccount(announcerAccount)} is not valid. \n\n${noFundsMessage}`);
        continue;
      }
      if (this.isAccountEmpty(announcerAccountInfo, networkConfig.currencyMosaicId)) {
        this.logger.error(
          `Node signing account ${CommandUtils.formatAccount(announcerAccount)} does not have enough currency. Mosaic id: ${networkConfig.currencyMosaicId}. \n\n${noFundsMessage}`,
        );
        continue;
      }

      const mainAccountInfo =
        mainAccount.address === announcerAccount.address
          ? announcerAccountInfo
          : await this.transactionPort.getAccountInfo(url, mainAccount.address);
      if (!mainAccountInfo) {
        this.logger.info(`Main account ${CommandUtils.formatAccount(mainAccount)} is brand new. There are no records on the chain yet.`);
      }

      const multisigInfo = await this.networkPort?.getMultisigInfo(url, announcerAccount.address).catch(() => undefined);

      const params: TransactionFactoryParams = {
        presetData,
        nodePreset,
        nodeAccount,
        mainAccountInfo: mainAccountInfo ?? undefined,
        networkConfig,
        target,
        mainAccount: announcerAccount,
      };
      const descriptors = await transactionFactory.createTransactions(params);
      if (!descriptors.length) {
        this.logger.info(`There are not transactions to announce for node ${nodeAccount.name}`);
        continue;
      }

      const confirmFn = async (description: string): Promise<boolean> => {
        return this.shouldAnnounce(description, ready, nodeAccount.name);
      };

      const resolveMainAccount = async (): Promise<GeneratedAccount> => {
        const presetMainPrivateKey = (presetData.nodes || [])[index]?.mainPrivateKey;
        if (presetMainPrivateKey) {
          const acc = this.cryptoPort.createAccountFromPrivateKey(presetMainPrivateKey, presetData.networkType);
          if (acc.address === announcerAccount.address) {
            return acc;
          }
        }
        return this.accountResolver.resolveAccount(
          presetData.networkType,
          nodeAccount.main,
          KeyName.Main,
          nodeAccount.name,
          'signing a transaction',
          'Should not generate!',
        );
      };

      const cosigners: GeneratedAccount[] = [];

      if (serviceProviderAccount) {
        let signerAccount: GeneratedAccount;
        let requiredCosignatures = 1; // for mainAccount
        if (multisigInfo) {
          const cosignerAddresses = [...multisigInfo.cosignatoryAddresses];
          const bestCosigner = await this.getMultisigBestCosigner(
            multisigInfo.minApproval,
            cosignerAddresses,
            cosigners,
            'Service provider account',
            presetData.networkType,
            url,
          );
          if (!bestCosigner) {
            this.logger.info(`There is no cosigner with enough tokens to announce!`);
            continue;
          }
          this.logger.info(
            `Cosigner ${CommandUtils.formatAccount({ publicKey: bestCosigner.publicKey, address: bestCosigner.address })} is initializing the transactions.`,
          );
          signerAccount = bestCosigner;
          requiredCosignatures = multisigInfo.minApproval;
        } else {
          signerAccount = await this.accountResolver.resolveAccount(
            presetData.networkType,
            { publicKey: serviceProviderAccount.publicKey } as any,
            KeyName.ServiceProvider,
            undefined,
            'signing a transaction',
            'Should not generate!',
          );
        }
        const mainMultisigInfo = await this.networkPort?.getMultisigInfo(url, mainAccount.address).catch(() => undefined);
        requiredCosignatures += mainMultisigInfo?.minApproval || 0;

        const selfTransferDescriptor = this.transactionPort.createSelfTransferDescriptor(
          serviceProviderAccount.address,
          networkConfig.currencyMosaicId,
          serviceProviderAccount.publicKey,
        );

        await this.transactionPort.announceAggregateBonded(
          [...descriptors, selfTransferDescriptor],
          mainAccount.publicKey,
          signerAccount.privateKey,
          cosigners.map((c) => c.privateKey),
          requiredCosignatures,
          networkConfig,
          url,
          providedMaxFee,
          confirmFn,
          this.logger,
        );
      } else {
        if (multisigInfo) {
          const cosignerAddresses = [...multisigInfo.cosignatoryAddresses];
          const bestCosigner = await this.getMultisigBestCosigner(
            multisigInfo.minApproval,
            cosignerAddresses,
            cosigners,
            `The node's main account`,
            presetData.networkType,
            url,
          );
          if (!bestCosigner) {
            this.logger.info(`There is no cosigner with enough tokens to announce!`);
            continue;
          }
          this.logger.info(
            `Cosigner ${CommandUtils.formatAccount({ publicKey: bestCosigner.publicKey, address: bestCosigner.address })} is initializing the transactions.`,
          );
          const cosignerKeys = cosigners.filter((a) => a.address !== bestCosigner.address).map((c) => c.privateKey);

          if (cosigners.length >= multisigInfo.minApproval) {
            await this.transactionPort.announceAggregateComplete(
              descriptors,
              mainAccount.publicKey,
              bestCosigner.privateKey,
              cosignerKeys,
              networkConfig,
              url,
              multisigInfo.minApproval,
              providedMaxFee,
              confirmFn,
              this.logger,
            );
          } else {
            await this.transactionPort.announceAggregateBonded(
              descriptors,
              mainAccount.publicKey,
              bestCosigner.privateKey,
              cosignerKeys,
              multisigInfo.minApproval,
              networkConfig,
              url,
              providedMaxFee,
              confirmFn,
              this.logger,
            );
          }
        } else {
          const signerAccount = await resolveMainAccount();
          if (descriptors.length === 1) {
            if (this.transactionPort.isMultisigModification(descriptors[0])) {
              const additions = (descriptors[0].addressAdditions as string[]) ?? [];
              const requiredCosignatures = additions.length + ((descriptors[0].minApprovalDelta as number) ?? 0);
              await this.transactionPort.announceAggregateBonded(
                descriptors,
                mainAccount.publicKey,
                signerAccount.privateKey,
                [],
                requiredCosignatures,
                networkConfig,
                url,
                providedMaxFee,
                confirmFn,
                this.logger,
              );
            } else {
              await this.transactionPort.announceSimple(
                descriptors[0],
                signerAccount.privateKey,
                networkConfig,
                url,
                providedMaxFee,
                confirmFn,
                this.logger,
              );
            }
          } else {
            await this.transactionPort.announceAggregateComplete(
              descriptors,
              mainAccount.publicKey,
              signerAccount.privateKey,
              [],
              networkConfig,
              url,
              0,
              providedMaxFee,
              confirmFn,
              this.logger,
            );
          }
        }
      }
    }
  }

  private networkPort?: INetworkPort;

  public setNetworkPort(networkPort: INetworkPort): void {
    this.networkPort = networkPort;
  }

  private async promptAccounts(networkType: NetworkType, expectedAddresses: string[], minApproval: number): Promise<GeneratedAccount[]> {
    const providedAccounts: GeneratedAccount[] = [];
    const allowedAddresses = [...expectedAddresses];
    while (true) {
      this.logger.info('');
      const expectedDescription = allowedAddresses.join(', ');
      const responses = await password({
        message: `Enter the 64 HEX private key of one of the addresses ${expectedDescription}. Already entered ${providedAccounts.length} out of ${minApproval} required cosigners.`,
        mask: '*',
        validate: CommandUtils.isValidPrivateKey,
      });
      const privateKey = responses;
      if (!privateKey) {
        this.logger.info('Please provide the private key....');
      } else {
        const account = this.cryptoPort.createAccountFromPrivateKey(privateKey.toUpperCase(), networkType);
        const expectedAddress = allowedAddresses.find((a) => a === account.address);
        if (!expectedAddress) {
          this.logger.info('');
          this.logger.info(
            `Invalid private key. The entered private key has this ${account.address} address and it's not one of ${expectedDescription}. \n`,
          );
          this.logger.info(`Please re enter private key...`);
        } else {
          allowedAddresses.splice(allowedAddresses.indexOf(expectedAddress), 1);
          providedAccounts.push(account);
          if (!allowedAddresses.length) {
            this.logger.info('All cosigners have been entered.');
            return providedAccounts;
          }
          if (providedAccounts.length === minApproval) {
            this.logger.info(`Min Approval of ${minApproval} has been reached. Aggregate Complete transaction can be created.`);
            return providedAccounts;
          }
          const responses = await confirm({
            message: `Do you want to enter more cosigners?`,
            default: providedAccounts.length < minApproval,
          });
          if (!responses) {
            return providedAccounts;
          } else {
            this.logger.info('Please provide an additional private key....');
          }
        }
      }
    }
  }

  private isAccountEmpty(accountInfo: AccountInfoDto, currencyMosaicId: string): boolean {
    const mosaic = accountInfo.mosaics.find((m) => m.id === currencyMosaicId);
    return !mosaic || mosaic.amount <= 0n;
  }

  public async shouldAnnounce(description: string, ready: boolean | undefined, nodeName: string): Promise<boolean> {
    const response: boolean =
      (ready as boolean) ||
      (await confirm({
        message: `Do you want to announce ${description}?`,
        default: true,
      }));
    if (!response) {
      this.logger.info(`Ignoring transaction for node[${nodeName}]`);
    }
    return response;
  }

  private async getBestCosigner(
    cosigners: GeneratedAccount[],
    url: string,
    currencyMosaicId: string,
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
    url: string,
  ): Promise<GeneratedAccount | undefined> {
    this.logger.info(
      `${accountName} is a multisig account with ${minApproval} min approval. Cosigners are: ${cosignatoryAddresses.join(', ')}. The tool will ask for the cosigners provide keys in order to announce the transactions. These private keys are not stored anywhere!`,
    );
    cosigners.push(...(await this.promptAccounts(networkType, cosignatoryAddresses, minApproval)));
    if (!cosigners.length) {
      return undefined;
    }
    return await this.getBestCosigner(cosigners, url, '');
  }
}
