import { Account, NetworkType, PublicAccount } from 'symbol-sdk';
import { ConfigAccount, ConfigPreset, NodePreset } from '../model';
/**
 * Utility class for bootstrap configuration related methods.
 */
export declare class ConfigurationUtils {
    static toConfigAccountFomKeys(networkType: NetworkType, publicKey: string | undefined, privateKey: string | undefined): ConfigAccount | undefined;
    static toAccount(networkType: NetworkType, publicKey: string | undefined, privateKey: string | undefined): PublicAccount | Account | undefined;
    static toConfigAccount(account: PublicAccount | Account): ConfigAccount;
    static resolveRoles(nodePreset: NodePreset): string;
    static shouldCreateNemesis(presetData: ConfigPreset): boolean;
}
