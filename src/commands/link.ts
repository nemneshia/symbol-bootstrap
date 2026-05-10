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

import { LogType, LoggerFactory } from '../logger/index.js';
import {
  AnnounceService,
  BootstrapService,
  CommandUtils,
  KnownError,
  LinkService,
} from '../service/index.js';

export default class Link extends Command {
  static description = `'Peer' または 'Voting' ロールに対して、VRF と Voting Link トランザクションをネットワークへアナウンスします。
  既存ネットワークへのノード登録を完了するためのコマンドです。`;

  static examples = [
    `
$ symbol-bootstrap link
$ echo "$MY_ENV_VAR_PASSWORD" | symbol-bootstrap link --unlink
`,
  ];

  static flags = {
    help: CommandUtils.helpFlag,
    target: CommandUtils.targetFlag,
    unlink: Flags.boolean({
      description:
        'Voting キーと VRF キーをノード署名アカウントから解除する "Unlink" トランザクションを実行します。',
      default: LinkService.defaultParams.unlink,
    }),
    ...AnnounceService.flags,
    logger: CommandUtils.getLoggerFlag(LogType.Console),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(Link);
    CommandUtils.showBanner();
    const logger = LoggerFactory.getLogger(flags.logger);
    flags.password = await CommandUtils.resolvePassword(
      logger,
      flags.password,
      flags.noPassword,
      CommandUtils.passwordPromptDefaultMessage,
      true
    );
    try {
      return await new BootstrapService(logger).link(flags);
    } catch (error) {
      if (
        error instanceof KnownError &&
        error.message.includes('秘密鍵入力をキャンセルしました。')
      ) {
        logger.info('リンク処理をキャンセルしました。');
        return;
      }
      throw error;
    }
  }
}
