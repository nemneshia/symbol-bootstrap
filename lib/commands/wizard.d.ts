import { Command, flags } from '@oclif/command';
import { IOptionFlag } from '@oclif/command/lib/flags';
import { Account, NetworkType, PublicAccount } from 'symbol-sdk';
import { Logger } from '../logger';
import { PrivateKeySecurityMode } from '../model';
import { Assembly, KeyName, Password, Preset } from '../service';
export declare const assembliesDescriptions: Record<Assembly, string>;
export declare enum HttpsOption {
    Native = "Native",
    Automatic = "Automatic",
    None = "None"
}
export declare enum CustomNetwork {
    custom = "custom"
}
export declare type Network = Preset | CustomNetwork;
export declare const assemblies: Record<Network, Assembly[]>;
export interface ProvidedAccounts {
    seeded: boolean;
    main: Account;
    remote: Account;
    vrf: Account;
    transport: Account;
}
export default class WizardCommand extends Command {
    static description: string;
    static examples: string[];
    static flags: {
        help: import("@oclif/parser/lib/flags").IBooleanFlag<void>;
        target: flags.IOptionFlag<string>;
        password: flags.IOptionFlag<string | undefined>;
        noPassword: import("@oclif/parser/lib/flags").IBooleanFlag<boolean>;
        network: flags.IOptionFlag<Network | undefined>;
        customPreset: flags.IOptionFlag<string>;
        ready: import("@oclif/parser/lib/flags").IBooleanFlag<boolean>;
        logger: flags.IOptionFlag<string>;
    };
    static getNetworkIdFlag(): IOptionFlag<Network | undefined>;
    static getCustomPresetFile(): IOptionFlag<string>;
    run(): Promise<void>;
}
export declare class Wizard {
    private readonly logger;
    constructor(logger: Logger);
    execute(flags: {
        workingDir: string;
        noPassword: boolean;
        skipPull?: boolean;
        target: string;
        password: Password;
        network: Network | undefined;
        customPreset: string;
        ready?: boolean;
    }): Promise<void>;
    logAccount<T extends Account | PublicAccount | undefined>(account: T, keyName: KeyName, showPrivateKeys: boolean): T;
    private resolveAllAccounts;
    resolveAccountFromSelection(networkType: NetworkType, keyName: KeyName, keyDescription: string): Promise<Account>;
    generateAccount(networkType: NetworkType): Account;
    resolveAccount(networkType: NetworkType, keyName: KeyName): Promise<Account | undefined>;
    resolveNetwork(providedNetwork: Network | undefined): Promise<Network>;
    resolvePreset(network: Network, workingDir: string): Promise<string>;
    resolvePrivateKeySecurityMode(): Promise<PrivateKeySecurityMode>;
    resolveAssembly(network: Network): Promise<string>;
    private isVoting;
    resolveHost(message: string, required: boolean): Promise<string>;
    resolveRestSSLKeyAsBase64(): Promise<string>;
    resolveRestSSLCertAsBase64(): Promise<string>;
    resolveFileContent(encoding: 'base64', message: string, notFoundMessage: string): Promise<string>;
    isValidHost(input: string): boolean | string;
    isValidFriendlyName(input: string): boolean | string;
    resolveFriendlyName(defaultFriendlyName: string): Promise<string>;
    resolveHttpsOptions(): Promise<HttpsOption>;
}
