import { Logger } from '../logger';
import { Addresses, ConfigPreset, DockerCompose } from '../model';
import { Password } from './YamlUtils';
export declare type ComposeParams = {
    target: string;
    user?: string;
    upgrade?: boolean;
    password?: Password;
    workingDir: string;
    offline: boolean;
};
export interface PortConfiguration {
    internalPort: number;
    openPort: number | undefined | boolean | string;
}
export declare class ComposeService {
    private readonly logger;
    protected readonly params: ComposeParams;
    static defaultParams: ComposeParams;
    static readonly DEBUG_SERVICE_PARAMS: {
        security_opt: string[];
        cap_add: string[];
        privileged: boolean;
    };
    private readonly configLoader;
    private readonly fileSystemService;
    constructor(logger: Logger, params: ComposeParams);
    resolveDebugOptions(dockerComposeDebugMode: boolean, dockerComposeServiceDebugMode: boolean | undefined): any;
    run(passedPresetData?: ConfigPreset, passedAddresses?: Addresses): Promise<DockerCompose>;
    private getMainAccountPrivateKey;
}
