import { Account, NetworkType } from 'symbol-sdk';
import { CertificatePair } from '../model';
import { KeyName } from '../service';
/**
 * Delegate that knows how to retrieve or generate accounts.
 *
 * Implementations of this interface could for example prompt or load accounts from a key store.
 */
export interface AccountResolver {
    resolveAccount(networkType: NetworkType, account: CertificatePair | undefined, keyName: KeyName, nodeName: string | undefined, operationDescription: string, generateErrorMessage: string | undefined): Promise<Account>;
}
/**
 * Basic no prompt implementation. If the account cannot be resolved, it won't be prompted.
 */
export declare class DefaultAccountResolver implements AccountResolver {
    resolveAccount(networkType: NetworkType, account: CertificatePair | undefined, keyName: KeyName, nodeName: string, operationDescription: string, generateErrorMessage: string | undefined): Promise<Account>;
    generateNewAccount(networkType: NetworkType): Account;
}
