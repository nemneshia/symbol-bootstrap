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
class Stop extends command_1.Command {
    run() {
        const { flags } = this.parse(Stop);
        const logger = logger_1.LoggerFactory.getLogger(flags.logger);
        service_1.CommandUtils.showBanner();
        return new service_1.BootstrapService(logger).stop(flags);
    }
}
exports.default = Stop;
Stop.description = 'It stops the docker-compose network if running (symbol-bootstrap started with --detached). This is just a wrapper for the `docker-compose down` bash call.';
Stop.examples = [`$ symbol-bootstrap stop`];
Stop.flags = {
    help: service_1.CommandUtils.helpFlag,
    target: service_1.CommandUtils.targetFlag,
    logger: service_1.CommandUtils.getLoggerFlag(...logger_1.System),
};
