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
class ModifyMultisig extends command_1.Command {
    async run() {
        const { flags } = this.parse(ModifyMultisig);
        const logger = logger_1.LoggerFactory.getLogger(flags.logger);
        service_1.CommandUtils.showBanner();
        flags.password = await service_1.CommandUtils.resolvePassword(logger, flags.password, flags.noPassword, service_1.CommandUtils.passwordPromptDefaultMessage, true);
        return new service_1.BootstrapService(logger).modifyMultisig(flags);
    }
}
exports.default = ModifyMultisig;
ModifyMultisig.description = `Create or modify a multisig account`;
ModifyMultisig.examples = [
    `$ symbol-bootstrap modifyMultisig`,
    `$ echo "$MY_ENV_VAR_PASSWORD" | symbol-bootstrap modifyMultisig --useKnownRestGateways`,
];
ModifyMultisig.flags = Object.assign(Object.assign({ help: service_1.CommandUtils.helpFlag, target: service_1.CommandUtils.targetFlag, minRemovalDelta: command_1.flags.integer({
        description: 'Delta of signatures needed to remove a cosignatory. ' +
            '0 means no change, a positive(+) number means increment and a negative(-) number means decrement to the actual value.',
        char: 'r',
    }), minApprovalDelta: command_1.flags.integer({
        description: 'Delta of signatures needed to approve a transaction. ' +
            '0 means no change, a positive(+) number means increment and a negative(-) number means decrement to the actual value.',
        char: 'a',
    }), addressAdditions: command_1.flags.string({
        description: 'Cosignatory accounts addresses to be added (separated by a comma).',
        char: 'A',
    }), addressDeletions: command_1.flags.string({
        description: 'Cosignatory accounts addresses to be removed (separated by a comma).',
        char: 'D',
    }) }, service_1.AnnounceService.flags), { logger: service_1.CommandUtils.getLoggerFlag(logger_1.LogType.Console) });
