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
class UpdateVotingKeys extends command_1.Command {
    async run() {
        const { flags } = this.parse(UpdateVotingKeys);
        service_1.CommandUtils.showBanner();
        const password = false;
        const target = flags.target;
        const logger = logger_1.LoggerFactory.getLogger(flags.logger);
        const configLoader = new service_1.ConfigLoader(logger);
        const addressesLocation = configLoader.getGeneratedAddressLocation(target);
        let presetData;
        try {
            const oldPresetData = configLoader.loadExistingPresetData(target, password);
            presetData = configLoader.createPresetData({
                workingDir: service_1.Constants.defaultWorkingDir,
                password: password,
                oldPresetData,
            });
        }
        catch (e) {
            throw new Error(`Node's preset cannot be loaded. Have you provided the right --target? If you have, please rerun the 'config' command with --upgrade. Error: ${service_1.Utils.getMessage(e)}`);
        }
        const addresses = configLoader.loadExistingAddresses(target, password);
        const privateKeySecurityMode = service_1.CryptoUtils.getPrivateKeySecurityMode(presetData.privateKeySecurityMode);
        const finalizationEpoch = flags.finalizationEpoch || (await new service_1.RemoteNodeService(logger, presetData, false).resolveCurrentFinalizationEpoch());
        const votingKeyUpgrade = (await Promise.all((presetData.nodes || []).map((nodePreset, index) => {
            var _a;
            const nodeAccount = (_a = addresses.nodes) === null || _a === void 0 ? void 0 : _a[index];
            if (!nodeAccount) {
                throw new Error(`There is not node in addresses at index ${index}`);
            }
            return new service_1.VotingService(logger, {
                target,
                user: flags.user,
            }).run(presetData, nodeAccount, nodePreset, finalizationEpoch, true, false);
        }))).find((f) => f);
        if (votingKeyUpgrade) {
            await service_1.YamlUtils.writeYaml(addressesLocation, service_1.CryptoUtils.removePrivateKeysAccordingToSecurityMode(addresses, privateKeySecurityMode), undefined);
            logger.warn('Bootstrap has created new voting file(s). Review the logs!');
            logger.warn('');
        }
        else {
            logger.info('');
            logger.info('Voting files are up-to-date. There is nothing to upgrade');
            logger.info('');
        }
    }
}
exports.default = UpdateVotingKeys;
UpdateVotingKeys.description = `It updates the voting files containing the voting keys when required.

If the node's current voting file has an end epoch close to the current network epoch, this command will create a new 'private_key_treeX.dat' that continues the current file.

By default, bootstrap creates a new voting file once the current file reaches its last month. The current network epoch is resolved from the network or you can provide it with the \`finalizationEpoch\` param.

When a new voting file is created, Bootstrap will advise running the \`link\` command again.

`;
UpdateVotingKeys.examples = [`$ symbol-bootstrap updateVotingKeys`];
UpdateVotingKeys.flags = {
    help: service_1.CommandUtils.helpFlag,
    target: service_1.CommandUtils.targetFlag,
    user: command_1.flags.string({
        char: 'u',
        description: `User used to run docker images when creating the the voting key files. "${service_1.Constants.CURRENT_USER}" means the current user.`,
        default: service_1.Constants.CURRENT_USER,
    }),
    finalizationEpoch: command_1.flags.integer({
        description: `The network's finalization epoch. It can be retrieved from the /chain/info rest endpoint. If not provided, the bootstrap known epoch is used.`,
    }),
    logger: service_1.CommandUtils.getLoggerFlag(...logger_1.System),
};
