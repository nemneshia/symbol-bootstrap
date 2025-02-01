import { flags } from '@oclif/command';
import { AccountInfo, Currency, Deadline, PublicAccount, SignedTransaction, Transaction, UInt64 } from 'symbol-sdk';
import { Logger } from '../logger';
import { Addresses, ConfigPreset, NodeAccount, NodePreset } from '../model';
import { AccountResolver } from './AccountResolver';
export interface TransactionFactoryParams {
    presetData: ConfigPreset;
    nodePreset: NodePreset;
    nodeAccount: NodeAccount;
    mainAccountInfo?: AccountInfo;
    mainAccount: PublicAccount;
    deadline: Deadline;
    target: string;
    maxFee: UInt64;
    latestFinalizedBlockEpoch: number;
}
export interface TransactionFactory {
    createTransactions(params: TransactionFactoryParams): Promise<Transaction[]>;
}
export declare class AnnounceService {
    private readonly logger;
    private readonly accountResolver;
    constructor(logger: Logger, accountResolver: AccountResolver);
    private static onProcessListener;
    static flags: {
        password: flags.IOptionFlag<string | undefined>;
        noPassword: import("@oclif/parser/lib/flags").IBooleanFlag<boolean>;
        url: flags.IOptionFlag<string>;
        useKnownRestGateways: import("@oclif/parser/lib/flags").IBooleanFlag<boolean>;
        ready: import("@oclif/parser/lib/flags").IBooleanFlag<boolean>;
        maxFee: import("@oclif/parser/lib/flags").IOptionFlag<number | undefined>;
        customPreset: flags.IOptionFlag<string | undefined>;
        serviceProviderPublicKey: flags.IOptionFlag<string | undefined>;
    };
    announce(providedUrl: string, providedMaxFee: number | undefined, useKnownRestGateways: boolean, ready: boolean | undefined, target: string, presetData: ConfigPreset, addresses: Addresses, transactionFactory: TransactionFactory, tokenAmount?: string, serviceProviderPublicKey?: string): Promise<void>;
    private promptAccounts;
    private getAccountInfo;
    private getBestCosigner;
    private isAccountEmpty;
    private announceAggregateBonded;
    private announceAggregateComplete;
    private announceSimple;
    private getTransactionDescription;
    shouldAnnounce(transaction: Transaction, signedTransaction: SignedTransaction, ready: boolean | undefined, currency: Currency, nodeName: string): Promise<boolean>;
    private getMultisigBestCosigner;
}
