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
import { AnnounceService, BootstrapService, CommandUtils, KnownError } from '../service/index.js';

export default class ModifyMultisig extends Command {
  // TODO: 今は使用しないが、将来的に CLI のコマンド一覧から隠すために hidden を true にする
  static hidden = true;

  static description = `multisig アカウントを作成または変更します。`;

  static examples = [
    `$ symbol-bootstrap modifyMultisig`,
    `$ echo "$MY_ENV_VAR_PASSWORD" | symbol-bootstrap modifyMultisig --useKnownRestGateways`,
  ];

  static flags = {
    help: CommandUtils.helpFlag,
    target: CommandUtils.targetFlag,
    minRemovalDelta: Flags.integer({
      description:
        '連署者を解除するために必要な署名数の差分を指定します。' +
        '0 は変更なし、正の値（+）は増加、負の値（-）は現在値から減少を意味します。',
      char: 'r',
    }),
    minApprovalDelta: Flags.integer({
      description:
        'トランザクション承認に必要な署名数の差分を指定します。' +
        '0 は変更なし、正の値（+）は増加、負の値（-）は現在値から減少を意味します。',
      char: 'a',
    }),
    addressAdditions: Flags.string({
      description: '追加する連署者アカウントのアドレスを指定します（カンマ区切り）。',
      char: 'A',
    }),
    addressDeletions: Flags.string({
      description: '削除する連署者アカウントのアドレスを指定します（カンマ区切り）。',
      char: 'D',
    }),
    ...AnnounceService.flags,
    logger: CommandUtils.getLoggerFlag(LogType.Console),
  };

  public async run(): Promise<void> {
    const { flags } = await this.parse(ModifyMultisig);
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
      return await new BootstrapService(logger).modifyMultisig(flags);
    } catch (error) {
      if (
        error instanceof KnownError &&
        error.message.includes('秘密鍵入力をキャンセルしました。')
      ) {
        logger.info('マルチシグ変更処理をキャンセルしました。');
        return;
      }
      throw error;
    }
  }
}
