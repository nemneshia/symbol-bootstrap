"use strict";
/*
 * Copyright 2022 Fernando Boucquez
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.BootstrapService = void 0;
const ComposeService_1 = require("./ComposeService");
const ConfigService_1 = require("./ConfigService");
const LinkService_1 = require("./LinkService");
const ModifyMultisigService_1 = require("./ModifyMultisigService");
const ReportService_1 = require("./ReportService");
const RunService_1 = require("./RunService");
/**
 * Main entry point for API integration.
 */
class BootstrapService {
    constructor(logger) {
        this.logger = logger;
    }
    /**
     * It generates the configuration and nemesis for the provided preset
     *
     * @param config the params of the config command.
     */
    config(config) {
        return new ConfigService_1.ConfigService(this.logger, config).run();
    }
    /**
     * It resolves the preset used for preventive configuration.
     *
     * @param config the params of the config command.
     */
    resolveConfigPreset(config) {
        return new ConfigService_1.ConfigService(this.logger, config).resolveConfigPreset(false);
    }
    /**
     * It generates the docker-compose.yaml file from the previously generated configuration.
     *
     * The config method/command needs to be called before this method
     *
     * @param config the params of the compose command.
     * @param passedPresetData the created preset if you know it, otherwise will load the latest one resolved from the target folder.
     * @param passedAddresses the created addresses if you know if, otherwise will load the latest one resolved form the target folder.
     */
    compose(config, passedPresetData, passedAddresses) {
        return new ComposeService_1.ComposeService(this.logger, config).run(passedPresetData, passedAddresses);
    }
    /**
     * It calls a running server announcing all the node transactions like VRF and Voting.
     *
     * This command is useful to link the nodes keys to an existing running network like testnet.
     *
     * @param config the params passed
     * @param passedPresetData  the created preset if you know it, otherwise will load the latest one resolved from the target folder.
     * @param passedAddresses  the created addresses if you know it, otherwise will load the latest one resolved from the target folder.
     */
    link(config, passedPresetData, passedAddresses) {
        return new LinkService_1.LinkService(this.logger, config).run(passedPresetData, passedAddresses);
    }
    /**
     * It converts main account into multisig account or modifies multisig structure
     *
     * @param config the params passed
     * @param passedPresetData  the created preset if you know it, otherwise will load the latest one resolved from the target folder.
     * @param passedAddresses  the created addresses if you know it, otherwise will load the latest one resolved from the target folder.
     */
    modifyMultisig(config, passedPresetData, passedAddresses) {
        return new ModifyMultisigService_1.ModifyMultisigService(this.logger, config).run(passedPresetData, passedAddresses);
    }
    /**
     * It generates reStructuredText (.rst) reports describing the configuration of each node.
     *
     * The config method/command needs to be called before this method
     *
     * @param config the params of the report command.
     * @param passedPresetData the created preset if you know if, otherwise will load the latest one resolved from the target folder.
     * @return the paths of the created reports.
     */
    report(config, passedPresetData) {
        return new ReportService_1.ReportService(this.logger, config).run(passedPresetData);
    }
    /**
     * It boots the network via docker using the generated docker-compose.yml file and configuration
     *
     * The config and compose methods/commands need to be called before this method.
     *
     * This is just a wrapper for docker-compose up bash call.
     *
     * @param config the params of the run command.
     */
    run(config) {
        return new RunService_1.RunService(this.logger, config).run();
    }
    /**
     * It resets the data keeping generated configuration, block 1, certificates and keys.
     *
     * @param config the params of the clean command.
     */
    resetData(config) {
        return new RunService_1.RunService(this.logger, config).resetData();
    }
    /**
     * It checks if the health of the running services is ok.
     *
     * @param config the params of the clean command.
     */
    healthCheck(config) {
        return new RunService_1.RunService(this.logger, config).healthCheck();
    }
    /**
     * This method aggregates config, compose and run all in one.
     *
     * @param config the aggregated params in order to run all the sub commands.
     */
    async start(config) {
        const configResult = await this.config(config);
        await this.compose(config, configResult.presetData);
        await this.run(config);
        return configResult;
    }
    /**
     * It stops the docker-compose network if running.
     *
     * This is just a wrapper for docker-compose down bash call.
     *
     * @param config the params necessary to detect and stop the network.
     */
    stop(config) {
        return new RunService_1.RunService(this.logger, config).stop();
    }
}
exports.BootstrapService = BootstrapService;
