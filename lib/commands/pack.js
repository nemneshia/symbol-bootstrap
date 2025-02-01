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
const fs_1 = require("fs");
const inquirer_1 = require("inquirer");
const path_1 = require("path");
const logger_1 = require("../logger");
const service_1 = require("../service");
const clean_1 = require("./clean");
const compose_1 = require("./compose");
const config_1 = require("./config");
class Pack extends command_1.Command {
    async run() {
        const { flags } = this.parse(Pack);
        service_1.CommandUtils.showBanner();
        const logger = logger_1.LoggerFactory.getLogger(flags.logger);
        const targetZip = (0, path_1.join)((0, path_1.dirname)(flags.target), `symbol-node.zip`);
        if ((0, fs_1.existsSync)(targetZip)) {
            throw new Error(`The target zip file ${targetZip} already exist. Do you want to delete it before repackaging your target folder?`);
        }
        logger.info('');
        logger.info('');
        if ((!flags.ready || flags.offline) &&
            !(await (0, inquirer_1.prompt)([
                {
                    name: 'offlineNow',
                    message: `Symbol Bootstrap is about to start working with sensitive information (certificates and voting file generation) so it is highly recommended that you disconnect from the network before continuing. Say YES if you are offline or if you don't care.`,
                    type: 'confirm',
                    default: true,
                },
            ])).offlineNow) {
            logger.info('Come back when you are offline...');
            return;
        }
        flags.password = await service_1.CommandUtils.resolvePassword(logger, flags.password, flags.noPassword, service_1.CommandUtils.passwordPromptDefaultMessage, true);
        const workingDir = service_1.Constants.defaultWorkingDir;
        const service = new service_1.BootstrapService(logger);
        const configOnlyCustomPresetFileName = 'config-only-custom-preset.yml';
        const accountResolver = new service_1.BootstrapAccountResolver(logger);
        const configResult = await service.config(Object.assign(Object.assign({}, flags), { workingDir, accountResolver }));
        await service.compose(Object.assign(Object.assign({}, flags), { workingDir }), configResult.presetData);
        const noPrivateKeyTempFile = 'custom-preset-temp.temp';
        if (flags.customPreset) {
            await service_1.YamlUtils.writeYaml(noPrivateKeyTempFile, service_1.CryptoUtils.removePrivateKeys(service_1.YamlUtils.loadYaml(flags.customPreset, flags.password)), flags.password);
        }
        else {
            await service_1.YamlUtils.writeYaml(noPrivateKeyTempFile, {}, flags.password);
        }
        const zipItems = [
            {
                from: flags.target,
                to: 'target',
                directory: true,
            },
            {
                from: noPrivateKeyTempFile,
                to: configOnlyCustomPresetFileName,
                directory: false,
            },
        ];
        await new service_1.ZipUtils(logger).zip(targetZip, zipItems);
        await new service_1.FileSystemService(logger).deleteFile(noPrivateKeyTempFile);
        logger.info('');
        logger.info(`Zip file ${targetZip} has been created. You can unzip it in your node's machine and run:`);
        logger.info(`$ symbol-bootstrap start`);
    }
}
exports.default = Pack;
Pack.description = 'It configures and packages your node into a zip file that can be uploaded to the final node machine.';
Pack.examples = [
    `$ symbol-bootstrap pack`,
    `$ symbol-bootstrap pack -c custom-preset.yml`,
    `$ symbol-bootstrap pack -p testnet -a dual -c custom-preset.yml`,
    `$ symbol-bootstrap pack -p mainnet -a dual --password 1234 -c custom-preset.yml`,
    `$ echo "$MY_ENV_VAR_PASSWORD" | symbol-bootstrap pack -c custom-preset.yml`,
];
Pack.flags = Object.assign(Object.assign(Object.assign(Object.assign({}, compose_1.default.flags), clean_1.default.flags), config_1.default.flags), { ready: command_1.flags.boolean({
        description: 'If --ready is provided, the command will not ask offline confirmation.',
    }), logger: service_1.CommandUtils.getLoggerFlag(logger_1.LogType.Console) });
