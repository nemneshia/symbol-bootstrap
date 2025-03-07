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

export default class Stop extends Command {
  static description =
    'It stops the docker compose network if running (symbol-bootstrap started with --detached). This is just a wrapper for the `docker compose down` bash call.';
  static examples = [`$ symbol-bootstrap stop`];

  static flags = {
    help: CommandUtils.helpFlag,
    target: CommandUtils.targetFlag,
    logger: CommandUtils.getLoggerFlag(...System),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Stop);
    const logger = LoggerFactory.getLogger(flags.logger);
    CommandUtils.showBanner();
    return new BootstrapService(logger).stop(flags);
  }
}
