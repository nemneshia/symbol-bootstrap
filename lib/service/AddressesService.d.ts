import { NetworkType } from 'symbol-sdk';
import { Logger } from '../logger';
import { Addresses, ConfigAccount, ConfigPreset, NodeAccount, NodePreset, PrivateKeySecurityMode } from '../model';
import { AccountResolver } from './AccountResolver';
import { KeyName } from './ConfigService';
/**
 * Object in charge of resolving the address.yml and its accounts.
 */
export declare class AddressesService {
    private readonly logger;
    private readonly accountResolver;
    private readonly migrationService;
    constructor(logger: Logger, accountResolver: AccountResolver);
    resolveAddresses(oldAddresses: Addresses | undefined, oldPresetData: ConfigPreset | undefined, presetData: ConfigPreset): Promise<Addresses>;
    private sum;
    private resolveNemesisAccount;
    private processNemesisBalances;
    private getMaxHarvesterBalance;
    resolveNodesAccounts(oldAddresses: Addresses | undefined, presetData: ConfigPreset, networkType: NetworkType): Promise<NodeAccount[]>;
    resolveNodeAccounts(oldNodeAccount: NodeAccount | undefined, presetData: ConfigPreset, index: number, nodePreset: NodePreset, networkType: NetworkType): Promise<NodeAccount>;
    generateAddresses(networkType: NetworkType, privateKeySecurityMode: PrivateKeySecurityMode, accounts: number | string[]): ConfigAccount[];
    resolveGenerateErrorMessage(keyName: KeyName, privateKeySecurityMode: PrivateKeySecurityMode): string | undefined;
    resolveAccount(networkType: NetworkType, privateKeySecurityMode: PrivateKeySecurityMode, keyName: KeyName, nodeName: string, oldStoredAccount: ConfigAccount | undefined, newProvidedAccount: ConfigAccount | undefined): Promise<ConfigAccount>;
}
