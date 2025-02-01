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
class Link extends command_1.Command {
    async run() {
        const { flags } = this.parse(Link);
        const logger = logger_1.LoggerFactory.getLogger(flags.logger);
        service_1.CommandUtils.showBanner();
        flags.password = await service_1.CommandUtils.resolvePassword(logger, flags.password, flags.noPassword, service_1.CommandUtils.passwordPromptDefaultMessage, true);
        return new service_1.BootstrapService(logger).link(flags);
    }
}
exports.default = Link;
Link.description = `It announces VRF and Voting Link transactions to the network for each node with 'Peer' or 'Voting' roles. This command finalizes the node registration to an existing network.`;
Link.examples = [`$ symbol-bootstrap link`, `$ echo "$MY_ENV_VAR_PASSWORD" | symbol-bootstrap link --unlink --useKnownRestGateways`];
Link.flags = Object.assign(Object.assign({ help: service_1.CommandUtils.helpFlag, target: service_1.CommandUtils.targetFlag, unlink: command_1.flags.boolean({
        description: 'Perform "Unlink" transactions unlinking the voting and VRF keys from the node signer account',
        default: service_1.LinkService.defaultParams.unlink,
    }) }, service_1.AnnounceService.flags), { logger: service_1.CommandUtils.getLoggerFlag(logger_1.LogType.Console) });
