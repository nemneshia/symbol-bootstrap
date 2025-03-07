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
import {
  Assembly,
  BootstrapAccountResolver,
  BootstrapService,
  CommandUtils,
  ConfigService,
  Constants,
  Preset,
} from '../../service/index.js';

export default class Config extends Command {
  static description = 'Command used to set up the configuration files and the nemesis block for the current network';

  static examples = [
    `$ symbol-bootstrap config -p bootstrap`,
    `$ symbol-bootstrap config -p testnet -a dual --password 1234`,
    `$ symbol-bootstrap config -p mainnet -a peer -c custom-preset.yml`,
    `$ symbol-bootstrap config -p mainnet -a my-custom-assembly.yml -c custom-preset.yml`,
    `$ symbol-bootstrap config -p my-custom-network.yml -a dual -c custom-preset.yml`,
    `$ echo "$MY_ENV_VAR_PASSWORD" | symbol-bootstrap config -p testnet -a dual`,
  ];

  static flags = {
    help: CommandUtils.helpFlag,
    target: CommandUtils.targetFlag,
    password: CommandUtils.passwordFlag,
    noPassword: CommandUtils.noPasswordFlag,
    preset: Flags.string({
      char: 'p',
      description: `The network preset. It can be provided via custom preset or cli parameter. If not provided, the value is resolved from the target/preset.yml file. Options are: ${Object.keys(
        Preset,
      ).join(', ')}, my-custom-network.yml (advanced, only for custom networks).`,
    }),
    assembly: Flags.string({
      char: 'a',
      description: `The assembly that defines the node(s) layout. It can be provided via custom preset or cli parameter. If not provided, the value is resolved from the target/preset.yml file. Options are: ${Object.keys(
        Assembly,
      ).join(', ')}, my-custom-assembly.yml (advanced).`,
    }),
    customPreset: Flags.string({
      char: 'c',
      description: `External preset file. Values in this file will override the provided presets.`,
    }),
    reset: Flags.boolean({
      char: 'r',
      description: 'It resets the configuration generating a new one.',
      default: ConfigService.defaultParams.reset,
    }),

    upgrade: Flags.boolean({
      description: `It regenerates the configuration reusing the previous keys. Use this flag when upgrading the version of bootstrap to keep your node up to date without dropping the local data. Backup the target folder before upgrading.`,
      default: ConfigService.defaultParams.reset,
    }),
    offline: CommandUtils.offlineFlag,
    report: Flags.boolean({
      description: 'It generates reStructuredText (.rst) reports describing the configuration of each node.',
      default: ConfigService.defaultParams.report,
    }),

    user: Flags.string({
      char: 'u',
      description: `User used to run docker images when creating configuration files like certificates or nemesis block. "${Constants.CURRENT_USER}" means the current user.`,
      default: Constants.CURRENT_USER,
    }),
    logger: CommandUtils.getLoggerFlag(...System),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Config);
    const logger = LoggerFactory.getLogger(flags.logger);
    CommandUtils.showBanner();
    flags.password = await CommandUtils.resolvePassword(
      logger,
      flags.password,
      flags.noPassword,
      CommandUtils.passwordPromptDefaultMessage,
      true,
    );
    const workingDir = Constants.defaultWorkingDir;
    const accountResolver = new BootstrapAccountResolver(logger);
    await new BootstrapService(logger).config({ ...flags, workingDir, accountResolver });
  }
}
