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

import { Command } from '@oclif/core';
import { LoggerFactory, System } from '../../logger/index.js';
import { BootstrapService, CommandUtils } from '../../service/index.js';

export default class HealthCheck extends Command {
  static description = `It checks if the services created with docker compose are up and running.

This command checks:
- Whether the docker containers are running.
- Whether the services' exposed ports are listening.
- Whether the rest gateways' /node/health are OK.

The health check process handles 'repeat' and custom 'openPort' services.
    `;

  static examples = [`$ symbol-bootstrap healthCheck`];

  static flags = {
    help: CommandUtils.helpFlag,
    target: CommandUtils.targetFlag,
    logger: CommandUtils.getLoggerFlag(...System),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(HealthCheck);
    CommandUtils.showBanner();
    const logger = LoggerFactory.getLogger(flags.logger);
    await new BootstrapService(logger).healthCheck(flags);
  }
}
