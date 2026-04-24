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
import { LoggerFactory } from '../logger/index.js';
import { SymbolCryptoAdapter } from '../sdk/index.js';
import { BootstrapAccountResolver, BootstrapService, CommandUtils, Constants } from '../service/index.js';
import Clean from './clean.js';
import Compose from './compose.js';
import Config from './config.js';
import Run from './run.js';

export default class Start extends Command {
  static description = 'Single command that aggregates config, compose and run in one line!';

  static examples = [
    `$ symbol-bootstrap start -p bootstrap`,
    `$ symbol-bootstrap start -p testnet -a dual`,
    `$ symbol-bootstrap start -p mainnet -a peer -c custom-preset.yml`,
    `$ symbol-bootstrap start -p testnet -a dual --password 1234`,
    `$ symbol-bootstrap start -p mainnet -a my-custom-assembly.yml -c custom-preset.yml`,
    `$ symbol-bootstrap start -p my-custom-network.yml -a dual -c custom-preset.yml`,
    `$ echo "$MY_ENV_VAR_PASSWORD" | symbol-bootstrap start -p testnet -a dual`,
  ];

  static flags = { ...Compose.flags, ...Run.flags, ...Clean.flags, ...Config.flags };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Start);
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
    const accountResolver = new BootstrapAccountResolver(logger, new SymbolCryptoAdapter());
    await new BootstrapService(logger).start({ ...flags, accountResolver, workingDir });
  }
}
