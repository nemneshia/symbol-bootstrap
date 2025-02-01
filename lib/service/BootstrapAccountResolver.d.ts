import { Account, NetworkType } from 'symbol-sdk';
import { Logger } from '../logger';
import { CertificatePair } from '../model';
import { AccountResolver, KeyName } from './';
/**
 * Prompt ready implementation of the account resolver.
 */
export declare class BootstrapAccountResolver implements AccountResolver {
    private readonly logger;
    constructor(logger: Logger);
    resolveAccount(networkType: NetworkType, account: CertificatePair | undefined, keyName: KeyName, nodeName: string, operationDescription: string, generateErrorMessage: string | undefined): Promise<Account>;
}
