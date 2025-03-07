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
import { LoggerFactory, System } from '../../logger/index.js';
import { BootstrapService, CommandUtils, ComposeService, Constants } from '../../service/index.js';

export default class Compose extends Command {
  static description = 'It generates the `compose.yml` file from the configured network.';

  static examples = [`$ symbol-bootstrap compose`];

  static flags = {
    help: CommandUtils.helpFlag,
    target: CommandUtils.targetFlag,
    password: CommandUtils.passwordFlag,
    noPassword: CommandUtils.noPasswordFlag,
    upgrade: Flags.boolean({
      description: 'It regenerates the docker compose and utility files from the <target>/docker folder',
      default: ComposeService.defaultParams.upgrade,
    }),
    offline: CommandUtils.offlineFlag,
    user: Flags.string({
      char: 'u',
      description: `User used to run the services in the compose.yml file. "${Constants.CURRENT_USER}" means the current user.`,
      default: 'current',
    }),
    logger: CommandUtils.getLoggerFlag(...System),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Compose);
    CommandUtils.showBanner();

    const logger = LoggerFactory.getLogger(flags.logger);
    flags.password = await CommandUtils.resolvePassword(
      logger,
      flags.password,
      flags.noPassword,
      CommandUtils.passwordPromptDefaultMessage,
      true,
    );
    const workingDir = Constants.defaultWorkingDir;
    await new BootstrapService(logger).compose({ ...flags, workingDir });
  }
}
