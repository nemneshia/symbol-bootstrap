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

import { Command, Flags } from '@oclif/core';
import { LoggerFactory, System } from '../logger/index.js';
import { BootstrapService, CommandUtils, RunService } from '../service/index.js';
import HealthCheck from './healthCheck.js';

export default class Run extends Command {
  static description =
    'It boots the network via docker using the generated `compose.yml` file and configuration. The config and compose methods/commands need to be called before this method. This is just a wrapper for the `docker compose up` bash call.';

  static examples = [`$ symbol-bootstrap run`];

  static flags = {
    help: CommandUtils.helpFlag,
    target: CommandUtils.targetFlag,
    detached: Flags.boolean({
      char: 'd',
      description:
        'If provided, docker compose will run with -d (--detached) and this command will wait unit server is running before returning',
    }),

    healthCheck: Flags.boolean({
      description: HealthCheck.description,
    }),

    resetData: Flags.boolean({
      description: 'It reset the database and node data but keeps the generated configuration, keys, voting tree files and block 1',
    }),

    pullImages: Flags.boolean({
      description: 'It pulls the images from DockerHub when running the configuration. It only affects alpha/dev docker images.',
      default: RunService.defaultParams.pullImages,
    }),

    args: Flags.string({
      multiple: true,
      description: 'Add extra arguments to the docker compose up command. Check out https://docs.docker.com/compose/reference/up.',
    }),

    build: Flags.boolean({
      char: 'b',
      description: 'If provided, docker compose will run with -b (--build)',
    }),

    timeout: Flags.integer({
      description: 'If running in detached mode, how long before timing out (in milliseconds)',
      default: RunService.defaultParams.timeout,
    }),
    logger: CommandUtils.getLoggerFlag(...System),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Run);
    CommandUtils.showBanner();
    const logger = LoggerFactory.getLogger(flags.logger);
    return new BootstrapService(logger).run(flags);
  }
}
