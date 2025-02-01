import { Logger } from '../logger';
import { Addresses, ConfigPreset, DockerCompose } from '../model';
import { ComposeParams } from './ComposeService';
import { ConfigParams, ConfigResult } from './ConfigService';
import { LinkParams } from './LinkService';
import { ModifyMultisigParams } from './ModifyMultisigService';
import { ReportParams } from './ReportService';
import { RunParams } from './RunService';
export declare type StartParams = ConfigParams & ComposeParams & RunParams;
/**
 * Main entry point for API integration.
 */
export declare class BootstrapService {
    private readonly logger;
    constructor(logger: Logger);
    /**
     * It generates the configuration and nemesis for the provided preset
     *
     * @param config the params of the config command.
     */
    config(config: ConfigParams): Promise<ConfigResult>;
    /**
     * It resolves the preset used for preventive configuration.
     *
     * @param config the params of the config command.
     */
    resolveConfigPreset(config: ConfigParams): ConfigPreset;
    /**
     * It generates the docker-compose.yaml file from the previously generated configuration.
     *
     * The config method/command needs to be called before this method
     *
     * @param config the params of the compose command.
     * @param passedPresetData the created preset if you know it, otherwise will load the latest one resolved from the target folder.
     * @param passedAddresses the created addresses if you know if, otherwise will load the latest one resolved form the target folder.
     */
    compose(config: ComposeParams, passedPresetData?: ConfigPreset, passedAddresses?: Addresses): Promise<DockerCompose>;
    /**
     * It calls a running server announcing all the node transactions like VRF and Voting.
     *
     * This command is useful to link the nodes keys to an existing running network like testnet.
     *
     * @param config the params passed
     * @param passedPresetData  the created preset if you know it, otherwise will load the latest one resolved from the target folder.
     * @param passedAddresses  the created addresses if you know it, otherwise will load the latest one resolved from the target folder.
     */
    link(config: LinkParams, passedPresetData?: ConfigPreset | undefined, passedAddresses?: Addresses | undefined): Promise<void>;
    /**
     * It converts main account into multisig account or modifies multisig structure
     *
     * @param config the params passed
     * @param passedPresetData  the created preset if you know it, otherwise will load the latest one resolved from the target folder.
     * @param passedAddresses  the created addresses if you know it, otherwise will load the latest one resolved from the target folder.
     */
    modifyMultisig(config: ModifyMultisigParams, passedPresetData?: ConfigPreset | undefined, passedAddresses?: Addresses | undefined): Promise<void>;
    /**
     * It generates reStructuredText (.rst) reports describing the configuration of each node.
     *
     * The config method/command needs to be called before this method
     *
     * @param config the params of the report command.
     * @param passedPresetData the created preset if you know if, otherwise will load the latest one resolved from the target folder.
     * @return the paths of the created reports.
     */
    report(config: ReportParams, passedPresetData?: ConfigPreset): Promise<string[]>;
    /**
     * It boots the network via docker using the generated docker-compose.yml file and configuration
     *
     * The config and compose methods/commands need to be called before this method.
     *
     * This is just a wrapper for docker-compose up bash call.
     *
     * @param config the params of the run command.
     */
    run(config: RunParams): Promise<void>;
    /**
     * It resets the data keeping generated configuration, block 1, certificates and keys.
     *
     * @param config the params of the clean command.
     */
    resetData(config: {
        target: string;
    }): Promise<void>;
    /**
     * It checks if the health of the running services is ok.
     *
     * @param config the params of the clean command.
     */
    healthCheck(config: {
        target: string;
    }): Promise<void>;
    /**
     * This method aggregates config, compose and run all in one.
     *
     * @param config the aggregated params in order to run all the sub commands.
     */
    start(config: StartParams): Promise<ConfigResult>;
    /**
     * It stops the docker-compose network if running.
     *
     * This is just a wrapper for docker-compose down bash call.
     *
     * @param config the params necessary to detect and stop the network.
     */
    stop(config: RunParams): Promise<void>;
}
