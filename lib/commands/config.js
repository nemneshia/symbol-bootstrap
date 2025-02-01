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
const command_1 = require("@oclif/command");
const logger_1 = require("../logger");
const service_1 = require("../service");
class Config extends command_1.Command {
    async run() {
        const { flags } = this.parse(Config);
        const logger = logger_1.LoggerFactory.getLogger(flags.logger);
        service_1.CommandUtils.showBanner();
        flags.password = await service_1.CommandUtils.resolvePassword(logger, flags.password, flags.noPassword, service_1.CommandUtils.passwordPromptDefaultMessage, true);
        const workingDir = service_1.Constants.defaultWorkingDir;
        const accountResolver = new service_1.BootstrapAccountResolver(logger);
        await new service_1.BootstrapService(logger).config(Object.assign(Object.assign({}, flags), { workingDir, accountResolver }));
    }
}
exports.default = Config;
Config.description = 'Command used to set up the configuration files and the nemesis block for the current network';
Config.examples = [
    `$ symbol-bootstrap config -p bootstrap`,
    `$ symbol-bootstrap config -p testnet -a dual --password 1234`,
    `$ symbol-bootstrap config -p mainnet -a peer -c custom-preset.yml`,
    `$ symbol-bootstrap config -p mainnet -a my-custom-assembly.yml -c custom-preset.yml`,
    `$ symbol-bootstrap config -p my-custom-network.yml -a dual -c custom-preset.yml`,
    `$ echo "$MY_ENV_VAR_PASSWORD" | symbol-bootstrap config -p testnet -a dual`,
];
Config.flags = {
    help: service_1.CommandUtils.helpFlag,
    target: service_1.CommandUtils.targetFlag,
    password: service_1.CommandUtils.passwordFlag,
    noPassword: service_1.CommandUtils.noPasswordFlag,
    preset: command_1.flags.string({
        char: 'p',
        description: `The network preset. It can be provided via custom preset or cli parameter. If not provided, the value is resolved from the target/preset.yml file. Options are: ${Object.keys(service_1.Preset).join(', ')}, my-custom-network.yml (advanced, only for custom networks).`,
    }),
    assembly: command_1.flags.string({
        char: 'a',
        description: `The assembly that defines the node(s) layout. It can be provided via custom preset or cli parameter. If not provided, the value is resolved from the target/preset.yml file. Options are: ${Object.keys(service_1.Assembly).join(', ')}, my-custom-assembly.yml (advanced).`,
    }),
    customPreset: command_1.flags.string({
        char: 'c',
        description: `External preset file. Values in this file will override the provided presets.`,
    }),
    reset: command_1.flags.boolean({
        char: 'r',
        description: 'It resets the configuration generating a new one.',
        default: service_1.ConfigService.defaultParams.reset,
    }),
    upgrade: command_1.flags.boolean({
        description: `It regenerates the configuration reusing the previous keys. Use this flag when upgrading the version of bootstrap to keep your node up to date without dropping the local data. Backup the target folder before upgrading.`,
        default: service_1.ConfigService.defaultParams.reset,
    }),
    offline: service_1.CommandUtils.offlineFlag,
    report: command_1.flags.boolean({
        description: 'It generates reStructuredText (.rst) reports describing the configuration of each node.',
        default: service_1.ConfigService.defaultParams.report,
    }),
    user: command_1.flags.string({
        char: 'u',
        description: `User used to run docker images when creating configuration files like certificates or nemesis block. "${service_1.Constants.CURRENT_USER}" means the current user.`,
        default: service_1.Constants.CURRENT_USER,
    }),
    logger: service_1.CommandUtils.getLoggerFlag(...logger_1.System),
};
