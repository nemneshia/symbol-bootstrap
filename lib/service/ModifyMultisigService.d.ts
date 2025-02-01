import { MultisigAccountInfo, NetworkType, Transaction, UnresolvedAddress } from 'symbol-sdk';
import { Logger } from '../logger';
import { Addresses, ConfigPreset } from '../model';
import { AccountResolver } from './AccountResolver';
import { TransactionFactory, TransactionFactoryParams } from './AnnounceService';
import { Password } from './YamlUtils';
/**
 * params necessary to announce multisig account modification transaction to network.
 */
export declare type ModifyMultisigParams = {
    target: string;
    password?: Password;
    url: string;
    maxFee?: number;
    useKnownRestGateways: boolean;
    ready?: boolean;
    customPreset?: string;
    minRemovalDelta?: number;
    minApprovalDelta?: number;
    addressAdditions?: string;
    addressDeletions?: string;
    serviceProviderPublicKey?: string;
    accountResolver?: AccountResolver;
};
export declare class ModifyMultisigService implements TransactionFactory {
    private readonly logger;
    protected readonly params: ModifyMultisigParams;
    static readonly defaultParams: ModifyMultisigParams;
    private readonly configLoader;
    constructor(logger: Logger, params: ModifyMultisigParams);
    run(passedPresetData?: ConfigPreset | undefined, passedAddresses?: Addresses | undefined): Promise<void>;
    createTransactions({ presetData, deadline, maxFee, mainAccount }: TransactionFactoryParams): Promise<Transaction[]>;
    resolveMinRemovalDelta(delta?: number): Promise<number>;
    resolveMinApprovalDelta(delta?: number): Promise<number>;
    resolveDelta(name: string, message: string, delta?: number): Promise<number>;
    resolveAddressAdditions(networkType: NetworkType, cosigners?: string): Promise<UnresolvedAddress[]>;
    resolveAddressDeletions(networkType: NetworkType, cosigners?: string): Promise<UnresolvedAddress[]>;
    resolveCosigners(networkType: NetworkType, name: string, message: string, cosigners?: string): Promise<UnresolvedAddress[]>;
    private toAddresses;
    private toAddress;
    protected validateParams(addressAdditions?: UnresolvedAddress[], addressDeletions?: UnresolvedAddress[], minRemovalDelta?: number, minApprovalDelta?: number, currentMultisigInfo?: MultisigAccountInfo): void;
}
