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

import { LoggerFactory, System } from '../logger/index.js';
import { BootstrapService, CommandUtils } from '../service/index.js';

export default class Clean extends Command {
  static description = '対象フォルダを削除し、生成済みの設定とデータを消去します。';

  static examples = [`$ symbol-bootstrap clean`];

  static flags = {
    help: CommandUtils.helpFlag,
    target: CommandUtils.targetFlag,
    yes: CommandUtils.yesFlag,
    logger: CommandUtils.getLoggerFlag(...System),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Clean);
    CommandUtils.showBanner();
    const logger = LoggerFactory.getLogger(flags.logger);
    if (!flags.yes) {
      const confirmed = await CommandUtils.confirmDangerousAction(
        `対象フォルダ ${flags.target} を削除してもよいですか？`
      );
      if (!confirmed) {
        logger.info('削除をキャンセルしました。');
        return;
      }
    }
    new BootstrapService(logger).clean(flags);
  }
}
