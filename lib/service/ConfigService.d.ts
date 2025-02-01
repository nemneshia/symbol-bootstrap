import { Logger } from '../logger';
import { Addresses, ConfigPreset, CustomPreset } from '../model';
import { AccountResolver } from './AccountResolver';
import { ReportParams } from './ReportService';
import { VotingParams } from './VotingService';
import { Password } from './YamlUtils';
/**
 * Defined presets.
 */
export declare enum Preset {
    bootstrap = "bootstrap",
    testnet = "testnet",
    mainnet = "mainnet"
}
export declare enum Assembly {
    dual = "dual",
    peer = "peer",
    api = "api",
    demo = "demo",
    multinode = "multinode",
    services = "services"
}
export declare const defaultAssembly: Record<string, string>;
export declare enum KeyName {
    Main = "Main",
    Remote = "Remote",
    Transport = "Transport",
    Voting = "Voting",
    VRF = "VRF",
    NemesisAccount = "Nemesis Account",
    ServiceProvider = "Service Provider"
}
export interface ConfigParams extends VotingParams, ReportParams {
    report: boolean;
    reset: boolean;
    upgrade: boolean;
    workingDir: string;
    offline: boolean;
    preset?: string;
    target: string;
    password?: Password;
    user: string;
    assembly?: string;
    customPreset?: string;
    customPresetObject?: CustomPreset;
    accountResolver: AccountResolver;
}
export interface ConfigResult {
    addresses: Addresses;
    presetData: ConfigPreset;
}
export declare class ConfigService {
    private readonly logger;
    private readonly params;
    static defaultParams: ConfigParams;
    private readonly configLoader;
    private readonly fileSystemService;
    private readonly addressesService;
    constructor(logger: Logger, params: ConfigParams);
    resolveConfigPreset(password: Password): ConfigPreset;
    run(): Promise<ConfigResult>;
    private resolveCurrentPresetData;
    private copyNemesis;
    private resolveNemesis;
    private generateNodes;
    private generateNodeCertificates;
    private generateNodeConfiguration;
    private generateP2PFile;
    private generateNemesisConfig;
    private createVrfTransaction;
    private createAccountKeyLinkTransaction;
    private createVotingKeyTransactions;
    private storeTransaction;
    private generateGateways;
    private resolveCurrencyName;
    private generateExplorers;
    private cleanUpConfiguration;
}
