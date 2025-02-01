import { Address, MultisigAccountInfo, RepositoryFactory } from 'symbol-sdk';
import { Logger } from '../logger';
import { ConfigPreset } from '../model';
export declare class TransactionUtils {
    static getRepositoryFactory(logger: Logger, presetData: ConfigPreset, url: string | undefined): Promise<RepositoryFactory>;
    static getMultisigAccount(repositoryFactory: RepositoryFactory, accountAddress: Address): Promise<MultisigAccountInfo | undefined>;
}
