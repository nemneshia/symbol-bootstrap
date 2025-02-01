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
const healthCheck_1 = require("./healthCheck");
class Run extends command_1.Command {
    run() {
        const { flags } = this.parse(Run);
        service_1.CommandUtils.showBanner();
        const logger = logger_1.LoggerFactory.getLogger(flags.logger);
        return new service_1.BootstrapService(logger).run(flags);
    }
}
exports.default = Run;
Run.description = 'It boots the network via docker using the generated `docker-compose.yml` file and configuration. The config and compose methods/commands need to be called before this method. This is just a wrapper for the `docker-compose up` bash call.';
Run.examples = [`$ symbol-bootstrap run`];
Run.flags = {
    help: service_1.CommandUtils.helpFlag,
    target: service_1.CommandUtils.targetFlag,
    detached: command_1.flags.boolean({
        char: 'd',
        description: 'If provided, docker-compose will run with -d (--detached) and this command will wait unit server is running before returning',
    }),
    healthCheck: command_1.flags.boolean({
        description: healthCheck_1.default.description,
    }),
    resetData: command_1.flags.boolean({
        description: 'It reset the database and node data but keeps the generated configuration, keys, voting tree files and block 1',
    }),
    pullImages: command_1.flags.boolean({
        description: 'It pulls the images from DockerHub when running the configuration. It only affects alpha/dev docker images.',
        default: service_1.RunService.defaultParams.pullImages,
    }),
    args: command_1.flags.string({
        multiple: true,
        description: 'Add extra arguments to the docker-compose up command. Check out https://docs.docker.com/compose/reference/up.',
    }),
    build: command_1.flags.boolean({
        char: 'b',
        description: 'If provided, docker-compose will run with -b (--build)',
    }),
    timeout: command_1.flags.integer({
        description: 'If running in detached mode, how long before timing out (in milliseconds)',
        default: service_1.RunService.defaultParams.timeout,
    }),
    logger: service_1.CommandUtils.getLoggerFlag(...logger_1.System),
};
