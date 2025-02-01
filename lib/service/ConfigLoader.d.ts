import { Account, PublicAccount } from 'symbol-sdk';
import { Logger } from '../logger';
import { Addresses, ConfigAccount, ConfigPreset, CustomPreset, NodePreset } from '../model';
import { Password } from './YamlUtils';
/**
 * Helper object that knows how to load addresses and preset files.
 */
export declare class ConfigLoader {
    private readonly logger;
    static presetInfoLogged: boolean;
    constructor(logger: Logger);
    loadCustomPreset(customPreset: string | undefined, password: Password): CustomPreset;
    static loadAssembly(preset: string, assembly: string, workingDir: string): CustomPreset;
    static loadNetworkPreset(preset: string, workingDir: string): CustomPreset;
    private static loadBundledPreset;
    static loadSharedPreset(): CustomPreset;
    mergePresets<T extends CustomPreset>(object: T | undefined, ...otherArgs: (CustomPreset | undefined)[]): T;
    createPresetData(params: {
        workingDir: string;
        password: Password;
        preset?: string;
        assembly?: string;
        customPreset?: string;
        customPresetObject?: CustomPreset;
        oldPresetData?: ConfigPreset;
    }): ConfigPreset;
    dynamicDefaultNodeConfiguration(nodes?: Partial<NodePreset>[]): NodePreset[];
    private getDefaultConfiguration;
    static toConfig(account: Account | PublicAccount): ConfigAccount;
    expandRepeat(presetData: ConfigPreset): ConfigPreset;
    applyValueTemplate(context: any, value: any): any;
    expandServicesRepeat(context: any, services: any[]): any[];
    loadExistingPresetDataIfPreset(target: string, password: Password): ConfigPreset | undefined;
    loadExistingPresetData(target: string, password: Password): ConfigPreset;
    getGeneratedPresetLocation(target: string): string;
    loadExistingAddressesIfPreset(target: string, password: Password): Addresses | undefined;
    loadExistingAddresses(target: string, password: Password): Addresses;
    getGeneratedAddressLocation(target: string): string;
}
