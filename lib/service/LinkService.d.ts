import { AccountInfo, Deadline, LinkAction, Transaction, UInt64 } from 'symbol-sdk';
import { Logger } from '../logger';
import { Addresses, ConfigPreset, NodeAccount } from '../model';
import { AccountResolver, Password } from '../service';
import { TransactionFactory } from './AnnounceService';
import { VotingKeyAccount } from './VotingUtils';
/**
 * params necessary to announce link transactions network.
 */
export declare type LinkParams = {
    target: string;
    password?: Password;
    url: string;
    maxFee?: number | undefined;
    unlink: boolean;
    useKnownRestGateways: boolean;
    ready?: boolean;
    customPreset?: string;
    serviceProviderPublicKey?: string;
    removeOldLinked?: boolean;
    accountResolver?: AccountResolver;
};
export declare type KeyAccount = {
    publicKey: string;
};
export interface LinkServiceTransactionFactoryParams {
    presetData: ConfigPreset;
    nodeAccount: NodeAccount;
    mainAccountInfo?: AccountInfo;
    deadline: Deadline;
    maxFee: UInt64;
    latestFinalizedBlockEpoch?: number;
}
export interface GenericNodeAccount {
    remote?: KeyAccount;
    vrf?: KeyAccount;
    voting?: VotingKeyAccount[];
}
export declare class LinkService implements TransactionFactory {
    private readonly logger;
    protected readonly params: LinkParams;
    static readonly defaultParams: LinkParams;
    private readonly configLoader;
    constructor(logger: Logger, params: LinkParams);
    run(passedPresetData?: ConfigPreset | undefined, passedAddresses?: Addresses | undefined): Promise<void>;
    createTransactions({ presetData, nodeAccount, mainAccountInfo, deadline, maxFee, latestFinalizedBlockEpoch, }: LinkServiceTransactionFactoryParams): Promise<Transaction[]>;
}
export declare class LinkTransactionGenericFactory {
    private readonly logger;
    private readonly params;
    constructor(logger: Logger, params: {
        unlink: boolean;
        ready?: boolean;
        removeOldLinked?: boolean;
    });
    createGenericTransactions<AccountKL, VRFKL, VotingKL>(nodeName: string, currentMainAccountKeys: GenericNodeAccount, nodeAccount: GenericNodeAccount, latestFinalizedBlockEpoch: number, remoteTransactionFactory: (keyAccount: KeyAccount, action: LinkAction) => AccountKL, vrfTransactionFactory: (keyAccount: KeyAccount, action: LinkAction) => VRFKL, votingKeyTransactionFactory: (account: VotingKeyAccount, action: LinkAction) => VotingKL): Promise<(AccountKL | VRFKL | VotingKL)[]>;
    addVotingKeyLinkTransactions<T>(linkedVotingKeyAccounts: VotingKeyAccount[], votingKeyFiles: VotingKeyAccount[], nodeName: string, lastKnownNetworkEpoch: number, transactionFactory: (transaction: VotingKeyAccount, action: LinkAction) => T, print: (account: VotingKeyAccount) => string): Promise<T[]>;
    addVotingKeyUnlinkTransactions<T>(linkedVotingKeyAccounts: VotingKeyAccount[], votingKeyFiles: VotingKeyAccount[], nodeName: string, transactionFactory: (transaction: VotingKeyAccount, action: LinkAction) => T, print: (account: VotingKeyAccount) => string): Promise<T[]>;
    static overlapsVotingAccounts(x: VotingKeyAccount, y: VotingKeyAccount): boolean;
    private addTransaction;
    private confirmUnlink;
}
