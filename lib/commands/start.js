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
const clean_1 = require("./clean");
const compose_1 = require("./compose");
const config_1 = require("./config");
const run_1 = require("./run");
class Start extends command_1.Command {
    async run() {
        const { flags } = this.parse(Start);
        service_1.CommandUtils.showBanner();
        const logger = logger_1.LoggerFactory.getLogger(flags.logger);
        flags.password = await service_1.CommandUtils.resolvePassword(logger, flags.password, flags.noPassword, service_1.CommandUtils.passwordPromptDefaultMessage, true);
        const workingDir = service_1.Constants.defaultWorkingDir;
        const accountResolver = new service_1.BootstrapAccountResolver(logger);
        await new service_1.BootstrapService(logger).start(Object.assign(Object.assign({}, flags), { accountResolver, workingDir }));
    }
}
exports.default = Start;
Start.description = 'Single command that aggregates config, compose and run in one line!';
Start.examples = [
    `$ symbol-bootstrap start -p bootstrap`,
    `$ symbol-bootstrap start -p testnet -a dual`,
    `$ symbol-bootstrap start -p mainnet -a peer -c custom-preset.yml`,
    `$ symbol-bootstrap start -p testnet -a dual --password 1234`,
    `$ symbol-bootstrap start -p mainnet -a my-custom-assembly.yml -c custom-preset.yml`,
    `$ symbol-bootstrap start -p my-custom-network.yml -a dual -c custom-preset.yml`,
    `$ echo "$MY_ENV_VAR_PASSWORD" | symbol-bootstrap start -p testnet -a dual`,
];
Start.flags = Object.assign(Object.assign(Object.assign(Object.assign({}, compose_1.default.flags), run_1.default.flags), clean_1.default.flags), config_1.default.flags);
