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
class Compose extends command_1.Command {
    async run() {
        const { flags } = this.parse(Compose);
        service_1.CommandUtils.showBanner();
        const logger = logger_1.LoggerFactory.getLogger(flags.logger);
        flags.password = await service_1.CommandUtils.resolvePassword(logger, flags.password, flags.noPassword, service_1.CommandUtils.passwordPromptDefaultMessage, true);
        const workingDir = service_1.Constants.defaultWorkingDir;
        await new service_1.BootstrapService(logger).compose(Object.assign(Object.assign({}, flags), { workingDir }));
    }
}
exports.default = Compose;
Compose.description = 'It generates the `docker-compose.yml` file from the configured network.';
Compose.examples = [`$ symbol-bootstrap compose`];
Compose.flags = {
    help: service_1.CommandUtils.helpFlag,
    target: service_1.CommandUtils.targetFlag,
    password: service_1.CommandUtils.passwordFlag,
    noPassword: service_1.CommandUtils.noPasswordFlag,
    upgrade: command_1.flags.boolean({
        description: 'It regenerates the docker compose and utility files from the <target>/docker folder',
        default: service_1.ComposeService.defaultParams.upgrade,
    }),
    offline: service_1.CommandUtils.offlineFlag,
    user: command_1.flags.string({
        char: 'u',
        description: `User used to run the services in the docker-compose.yml file. "${service_1.Constants.CURRENT_USER}" means the current user.`,
        default: 'current',
    }),
    logger: service_1.CommandUtils.getLoggerFlag(...logger_1.System),
};
